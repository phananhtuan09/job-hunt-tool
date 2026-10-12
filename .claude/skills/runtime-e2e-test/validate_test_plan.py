#!/usr/bin/env python3
"""Validate the Markdown contract for a runtime E2E plan and ledger."""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


ALLOWED_STATUSES = {
    "DRAFT",
    "READY",
    "RUNNING",
    "FAILED",
    "BLOCKED",
    "AWAITING_HUMAN",
    "COMPLETED",
}
ALLOWED_RESULTS = {"NOT_RUN", "PASS", "FAIL", "BLOCKED", "INVALIDATED"}
ALLOWED_PRIORITIES = {"RELEASE_BLOCKING", "NORMAL"}
ALLOWED_HUMAN_JUDGMENT = {"YES", "NO"}
ALLOWED_PATH_MATCH = {"NOT_RUN", "YES", "NO"}
ALLOWED_DECISIONS = {"PENDING", "ACCEPTED", "REJECTED"}
CASE_HEADING = re.compile(
    r"^## Case (?P<id>[A-Za-z0-9][A-Za-z0-9_.-]*)\s+[—-]\s+(?P<title>.+?)\s*$",
    re.MULTILINE,
)


@dataclass
class Case:
    case_id: str
    title: str
    body: str

    def field(self, name: str) -> str | None:
        match = re.search(
            rf"^- {re.escape(name)}:\s*(.*?)\s*$", self.body, re.MULTILINE
        )
        return match.group(1).strip() if match else None

    def section(self, name: str) -> str | None:
        match = re.search(
            rf"^### {re.escape(name)}\s*$\n(?P<body>.*?)(?=^### |^## |\Z)",
            self.body,
            re.MULTILINE | re.DOTALL,
        )
        return match.group("body").strip() if match else None


def top_field(text: str, name: str, stop: int | None = None) -> str | None:
    search_text = text[:stop] if stop is not None else text
    match = re.search(
        rf"^- {re.escape(name)}:\s*(.*?)\s*$", search_text, re.MULTILINE
    )
    return match.group(1).strip() if match else None


def parse_cases(text: str) -> list[Case]:
    matches = list(CASE_HEADING.finditer(text))
    cases: list[Case] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        cases.append(
            Case(
                case_id=match.group("id"),
                title=match.group("title").strip(),
                body=text[match.end() : end],
            )
        )
    return cases


def missing_value(value: str | None) -> bool:
    if value is None:
        return True
    normalized = value.strip().upper()
    return not normalized or normalized in {"NOT_RUN", "NOT_STARTED", "TBD", "—", "-"}


def parse_count(text: str, label: str, stop: int | None) -> int | None:
    value = top_field(text, label, stop)
    if value is None or not value.isdigit():
        return None
    return int(value)


def validate(path: Path, mode: str) -> tuple[list[str], list[str]]:
    text = path.read_text(encoding="utf-8")
    cases = parse_cases(text)
    errors: list[str] = []
    warnings: list[str] = []
    first_case = CASE_HEADING.search(text)
    top_end = first_case.start() if first_case else len(text)

    status = top_field(text, "Status", top_end)
    decision = top_field(text, "Decision", top_end)

    if status not in ALLOWED_STATUSES:
        errors.append(
            f"Status must be one of {', '.join(sorted(ALLOWED_STATUSES))}; got {status!r}."
        )
    if decision not in ALLOWED_DECISIONS:
        errors.append(
            f"Human sign-off Decision must be one of {', '.join(sorted(ALLOWED_DECISIONS))}; got {decision!r}."
        )

    for field_name in ("Run ID", "Environment", "Tested revisions", "Last updated"):
        if top_field(text, field_name, top_end) is None:
            errors.append(f"Missing required top-level field '{field_name}'.")
    for field_name in ("Environment", "Last updated"):
        if missing_value(top_field(text, field_name, top_end)):
            errors.append(f"Top-level field '{field_name}' must be concrete.")
    if not cases:
        errors.append("No cases found. Use headings like '## Case D2 — Title'.")
        return errors, warnings

    duplicate_ids = [
        case_id for case_id, count in Counter(case.case_id for case in cases).items() if count > 1
    ]
    if duplicate_ids:
        errors.append(f"Duplicate case IDs: {', '.join(sorted(duplicate_ids))}.")

    results: Counter[str] = Counter()
    release_total = 0
    release_pass = 0
    human_cases = 0

    for case in cases:
        prefix = f"Case {case.case_id}"
        priority = case.field("Priority")
        human_judgment = case.field("Human judgment")
        result = case.field("Result")
        path_match = case.field("Path match")

        if priority not in ALLOWED_PRIORITIES:
            errors.append(f"{prefix}: invalid or missing Priority {priority!r}.")
        if human_judgment not in ALLOWED_HUMAN_JUDGMENT:
            errors.append(
                f"{prefix}: Human judgment must be YES or NO; got {human_judgment!r}."
            )
        if result not in ALLOWED_RESULTS:
            errors.append(f"{prefix}: invalid or missing Result {result!r}.")
        else:
            results[result] += 1
        if path_match not in ALLOWED_PATH_MATCH:
            errors.append(f"{prefix}: invalid or missing Path match {path_match!r}.")

        runtime_path = case.section("Runtime path")
        expected = case.section("Expected")
        if missing_value(runtime_path):
            errors.append(f"{prefix}: Runtime path is missing or unresolved.")
        if missing_value(expected):
            errors.append(f"{prefix}: Expected is missing or unresolved.")

        if priority == "RELEASE_BLOCKING":
            release_total += 1
            if result == "PASS":
                release_pass += 1
        if human_judgment == "YES":
            human_cases += 1

        if result == "PASS":
            if path_match != "YES":
                errors.append(f"{prefix}: PASS requires Path match: YES.")
            for field_name in ("Actual path", "Observed", "Evidence", "Cleanup"):
                if missing_value(case.field(field_name)):
                    errors.append(f"{prefix}: PASS requires a concrete {field_name} value.")
        elif result in {"FAIL", "BLOCKED"}:
            for field_name in ("Actual path", "Observed", "Evidence"):
                if missing_value(case.field(field_name)):
                    errors.append(
                        f"{prefix}: {result} requires a concrete {field_name} value."
                    )
        elif result == "INVALIDATED":
            for field_name in ("Observed", "Evidence"):
                if missing_value(case.field(field_name)):
                    errors.append(
                        f"{prefix}: INVALIDATED requires a concrete {field_name} value."
                    )

    expected_summary = {
        "Total": len(cases),
        "PASS": results["PASS"],
        "FAIL": results["FAIL"],
        "BLOCKED": results["BLOCKED"],
        "NOT_RUN": results["NOT_RUN"],
        "INVALIDATED": results["INVALIDATED"],
    }
    for label, expected_count in expected_summary.items():
        actual = parse_count(text, label, top_end)
        if actual is None:
            errors.append(f"Run summary is missing numeric '{label}'.")
        elif actual != expected_count:
            errors.append(
                f"Run summary {label} is {actual}, but case ledger contains {expected_count}."
            )

    release_summary = top_field(text, "Release-blocking PASS", top_end)
    expected_release = f"{release_pass}/{release_total}"
    if release_summary != expected_release:
        errors.append(
            "Run summary Release-blocking PASS is "
            f"{release_summary!r}, expected {expected_release!r}."
        )

    if mode == "completion":
        if status not in {"AWAITING_HUMAN", "COMPLETED"}:
            errors.append(
                "Completion validation requires Status: AWAITING_HUMAN or COMPLETED."
            )
        for field_name in ("Run ID", "Environment", "Tested revisions", "Last updated"):
            if missing_value(top_field(text, field_name, top_end)):
                errors.append(
                    f"Completion validation requires a concrete '{field_name}'."
                )
        unresolved = results["NOT_RUN"] + results["FAIL"] + results["BLOCKED"]
        if unresolved:
            errors.append(
                f"Completion validation found {unresolved} unresolved case(s)."
            )
        if release_pass != release_total:
            errors.append("Every release-blocking case must PASS before completion.")
        if status == "AWAITING_HUMAN":
            if human_cases == 0:
                errors.append(
                    "AWAITING_HUMAN requires at least one case with Human judgment: YES."
                )
            if decision != "PENDING":
                errors.append("AWAITING_HUMAN requires Decision: PENDING.")
        if status == "COMPLETED" and human_cases > 0:
            if decision != "ACCEPTED":
                errors.append(
                    "COMPLETED requires Decision: ACCEPTED when human judgment is required."
                )
            for field_name in ("Reviewer", "Date"):
                if missing_value(top_field(text, field_name, top_end)):
                    errors.append(
                        f"Accepted human sign-off requires a concrete {field_name}."
                    )

    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate a runtime E2E test-plan Markdown artifact."
    )
    parser.add_argument("plan", type=Path)
    parser.add_argument("--mode", choices=("plan", "completion"), default="plan")
    args = parser.parse_args()

    if not args.plan.is_file():
        print(f"ERROR: plan not found: {args.plan}", file=sys.stderr)
        return 2

    errors, warnings = validate(args.plan, args.mode)
    for warning in warnings:
        print(f"WARNING: {warning}")
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print(f"Runtime E2E plan is valid for {args.mode}: {args.plan}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
