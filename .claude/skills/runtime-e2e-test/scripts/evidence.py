#!/usr/bin/env python3
"""Snapshot approved inputs, run native Playwright, and audit evidence bundles."""
import argparse
import base64
import hashlib
import json
import os
import re
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def local(root, name):
    path = (root / name).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError(f"Path outside root: {name}")
    return path


def contract(suite, root):
    data = load(suite)
    for key in ("plan", "environment", "revision"):
        if not isinstance(data.get(key), str) or not data[key].strip():
            raise ValueError(f"Missing {key}")
    command = data.get("command")
    if not isinstance(command, list) or not command or any(not isinstance(x, str) or not x for x in command):
        raise ValueError("command must be a nonempty argument array")
    if any(x.startswith(("--output", "--reporter")) for x in command):
        raise ValueError("Runner owns --output and --reporter")
    cases = data.get("cases", [])
    ids = [c["id"] for c in cases]
    if not ids or len(ids) != len(set(ids)):
        raise ValueError("Cases must have unique IDs")
    for case in cases:
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", case["id"]) or case.get("kind") not in {"browser", "api"}:
            raise ValueError("Invalid case ID/kind")
        checks = case.get("checks", [])
        if not checks or len({c["id"] for c in checks}) != len(checks):
            raise ValueError("Each case needs uniquely mapped checks")
        for check in checks:
            if any(not check.get(k) for k in ("id", "expected", "source")):
                raise ValueError("Checks need id, expected, source")
    files = data.get("files", [])
    if not isinstance(files, list) or not files:
        raise ValueError("List test/config/helper files in files")
    names = list(dict.fromkeys([str(suite.resolve().relative_to(root)), data["plan"], *files]))
    hashes = {name: digest(local(root, name)) for name in names}
    plan = local(root, data["plan"]).read_text(encoding="utf-8")
    plan_ids = re.findall(r"^## Case ([A-Za-z0-9_.-]+)\s+[—-]\s+", plan, re.M)
    if sorted(ids) != sorted(plan_ids):
        raise ValueError("Suite cases must exactly match Markdown cases")
    validator = Path(__file__).resolve().parents[1] / "validate_test_plan.py"
    checked = subprocess.run([sys.executable, str(validator), str(local(root, data["plan"]))], capture_output=True, text=True)
    if checked.returncode:
        raise ValueError(checked.stderr or checked.stdout)
    return data, hashes


def specs(node):
    yield from node.get("specs", [])
    for child in node.get("suites", []):
        yield from specs(child)


def attachment(bundle, value):
    if "body" in value:
        return base64.b64decode(value["body"], validate=True)
    return local(bundle, value["path"]).read_bytes()


def score(bundle):
    manifest = load(bundle / "run-manifest.json")
    suite = load(local(bundle / "inputs", manifest["suite"]))
    native = load(bundle / "native.json")
    if normalize(bundle, load(bundle / "native-raw.json"), Path(manifest["projectRoot"])) != native:
        raise ValueError("Normalized results disagree with original native report")
    tests = {}
    for spec in specs(native):
        match = re.search(r"\[([A-Za-z0-9_.-]+)\]", spec["title"])
        if not match or match[1] in tests or len(spec.get("tests", [])) != 1:
            raise ValueError("Undeclared, duplicate, or multi-project test")
        tests[match[1]] = spec["tests"][0]
    if set(tests) - {c["id"] for c in suite["cases"]}:
        raise ValueError("Native output contains undeclared cases")
    rows = []
    for case in suite["cases"]:
        test = tests.get(case["id"], {})
        attempts = test.get("results", [])
        row = {"caseId": case["id"], "result": "NOT_RUN", "attempts": len(attempts), "reasons": []}
        rows.append(row)
        if not attempts or all(a["status"] == "skipped" for a in attempts):
            row["reasons"].append("Absent or skipped test")
            continue
        if test.get("expectedStatus", "passed") != "passed" or len(attempts) != 1 or attempts[0]["status"] != "passed":
            row.update(result="FAIL", reasons=["Native failure, expected failure, or retry/flaky execution"])
            continue
        attachments = attempts[0].get("attachments", [])
        for item in attachments:
            if "path" in item and (not item["path"].startswith("artifacts/") or not attachment(bundle, item)):
                raise ValueError("Missing or invalid artifact attachment")
        observations = [a for a in attachments if a["name"] == "runtime-observations"]
        if len(observations) != 1:
            row.update(result="BLOCKED", reasons=["Missing unique structured observations"])
            continue
        observed = json.loads(attachment(bundle, observations[0]))
        row["observations"] = observed
        checks = observed.get("checks", [])
        by_id = {c["id"]: c for c in checks}
        if len(by_id) != len(checks) or set(by_id) != {c["id"] for c in case["checks"]}:
            row.update(result="BLOCKED", reasons=["Observation checks do not match contract"])
            continue
        if any("actual" not in c or "expected" not in c or not c.get("source") for c in checks):
            row.update(result="BLOCKED", reasons=["Missing expected/actual/source"])
            continue
        if any(c["actual"] != c["expected"] for c in checks):
            row.update(result="FAIL", reasons=["Observed expected/actual mismatch"])
            continue
        if not observed.get("actualPath") or observed.get("cleanup") not in {"COMPLETE", "NOT_REQUIRED"}:
            row.update(result="BLOCKED", reasons=["Missing runtime path or completed cleanup"])
            continue
        if case["kind"] == "browser" and not any(a["name"] == "trace" and a.get("path") for a in attachments):
            row.update(result="BLOCKED", reasons=["Browser case lacks trace"])
            continue
        row["result"] = "PASS"
    return {"cases": rows, "exitCode": manifest["exitCode"], "nativeErrors": native.get("errors", [])}


def summary(result):
    lines = ["# Runtime E2E results", "", "Mechanical proof only; semantic audit still required.", ""]
    for row in result["cases"]:
        lines.append(f"- {row['caseId']}: {row['result']} ({row['attempts']} attempt(s)); {'; '.join(row['reasons'])}")
    lines += ["", f"Execution exit code: {result['exitCode']}", f"Native global errors: {len(result['nativeErrors'])}"]
    return "\n".join(lines) + "\n"


def inventory(bundle):
    if any(p.is_symlink() for p in bundle.rglob("*")):
        raise ValueError("Evidence bundle must not contain symlinks")
    return {str(p.relative_to(bundle)): digest(p) for p in sorted(bundle.rglob("*")) if p.is_file() and p.name != "integrity.json"}


def audit(bundle):
    if inventory(bundle) != load(bundle / "integrity.json"):
        raise ValueError("Bundle integrity mismatch")
    approval = load(bundle / "approval.json")
    manifest = load(bundle / "run-manifest.json")
    suite = load(local(bundle / "inputs", manifest["suite"]))
    required = {manifest["suite"], suite["plan"], *suite["files"]}
    if set(approval["hashes"]) != required or not approval.get("reviewer"):
        raise ValueError("Approval does not cover declared inputs")
    if manifest["command"][:-2] != suite["command"] or manifest["command"][-2] != "--reporter=json":
        raise ValueError("Recorded command disagrees with approved command")
    if any(manifest[k] != suite[k] for k in ("environment", "revision")):
        raise ValueError("Recorded environment/revision disagrees with approved suite")
    for name, value in approval["hashes"].items():
        if digest(local(bundle / "inputs", name)) != value:
            raise ValueError("Approved input snapshot mismatch")
    result = score(bundle)
    if result != load(bundle / "results.json") or summary(result) != (bundle / "summary.md").read_text():
        raise ValueError("Generated report disagrees with native evidence")
    print(summary(result))
    return 0 if result["exitCode"] == 0 and not result["nativeErrors"] and all(c["result"] == "PASS" for c in result["cases"]) else 1


def normalize(bundle, native, root):
    for spec in specs(native):
        for test in spec.get("tests", []):
            for attempt in test.get("results", []):
                for item in attempt.get("attachments", []):
                    if "path" in item:
                        path = Path(item["path"])
                        path = path.resolve() if path.is_absolute() else (root / path).resolve()
                        # Original reports use absolute paths; locate them in a moved bundle too.
                        original = load(bundle / "run-manifest.json")["artifactRoot"]
                        relative = path.relative_to(original)
                        stored = local(bundle / "artifacts", str(relative))
                        if not stored.is_file():
                            raise ValueError("Missing artifact attachment")
                        item["path"] = str(stored.relative_to(bundle))
    return native


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["validate", "approve", "run", "audit"])
    parser.add_argument("target", type=Path)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--reviewer")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    if args.mode == "audit":
        return audit(args.target.resolve())
    root, suite = args.root.resolve(), args.target.resolve()
    data, hashes = contract(suite, root)
    approval_path = suite.with_name(suite.name + ".approval.json")
    if args.mode == "validate":
        print("Suite and Markdown contract valid")
        return 0
    if args.mode == "approve":
        if not args.reviewer:
            raise ValueError("Explicit human reviewer required")
        write(approval_path, {"reviewer": args.reviewer, "approvedAt": datetime.now(timezone.utc).isoformat(), "hashes": hashes})
        return 0
    approval = load(approval_path)
    if approval["hashes"] != hashes or not approval.get("reviewer"):
        raise ValueError("Approval missing or stale; human reapproval required")
    if args.out is None:
        raise ValueError("--out must name a new run directory")
    bundle = args.out.resolve()
    bundle.mkdir(parents=True, exist_ok=False)
    for name in hashes:
        dest = local(bundle / "inputs", name)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(local(root, name).read_bytes())
    write(bundle / "approval.json", approval)
    env = os.environ.copy()
    run_id = str(uuid.uuid4())
    env.update(RUNTIME_E2E_RUN_ID=run_id, PLAYWRIGHT_JSON_OUTPUT_NAME=str(bundle / "native.json"))
    command = data["command"] + ["--reporter=json", "--output=" + str(bundle / "artifacts")]
    git = subprocess.run(["git", "rev-parse", "HEAD"], cwd=root, capture_output=True, text=True)
    dirty = subprocess.run(["git", "status", "--porcelain"], cwd=root, capture_output=True, text=True)
    manifest = {"runId": run_id, "suite": str(suite.relative_to(root)), "projectRoot": str(root), "artifactRoot": str(bundle / "artifacts"), "command": command, "environment": data["environment"], "revision": data["revision"], "gitHead": git.stdout.strip(), "gitStatus": dirty.stdout, "startedAt": datetime.now(timezone.utc).isoformat()}
    write(bundle / "run-manifest.json", manifest)
    with (bundle / "stdout.log").open("wb") as stdout, (bundle / "stderr.log").open("wb") as stderr:
        try:
            execution = subprocess.run(command, cwd=root, env=env, stdout=stdout, stderr=stderr)
            manifest["exitCode"] = execution.returncode
        except OSError as error:
            stderr.write(str(error).encode())
            manifest["exitCode"] = 127
    manifest["finishedAt"] = datetime.now(timezone.utc).isoformat()
    write(bundle / "run-manifest.json", manifest)
    native_path = bundle / "native.json"
    if not native_path.exists():
        write(native_path, {"suites": [], "errors": [{"message": "Native output missing; inspect stderr.log"}]})
    (bundle / "native-raw.json").write_bytes(native_path.read_bytes())
    native = normalize(bundle, load(native_path), root)
    write(native_path, native)
    result = score(bundle)
    write(bundle / "results.json", result)
    (bundle / "summary.md").write_text(summary(result), encoding="utf-8")
    write(bundle / "integrity.json", inventory(bundle))
    return audit(bundle)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, KeyError, TypeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(2)
