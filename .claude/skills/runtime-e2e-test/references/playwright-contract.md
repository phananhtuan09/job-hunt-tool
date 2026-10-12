# Playwright plan and evidence contract

Use native Playwright Test files, not a restricted action language.
Paths below are relative to the project root; suite files live beside the Markdown plan.

## Suite file

```json
{
  "plan": "docs/testing/active/orders.md",
  "files": ["tests/orders.spec.ts", "playwright.config.ts", "package-lock.json"],
  "command": ["npx", "--no-install", "playwright", "test", "tests/orders.spec.ts"],
  "environment": "isolated-local",
  "revision": "web@<commit>; dirty-tree identity recorded in approved file hashes",
  "cases": [
    {
      "id": "E2E-01",
      "kind": "browser",
      "checks": [
        {"id": "ui_staff", "expected": "Staff B after reload", "source": "rendered DOM"},
        {"id": "saved_staff", "expected": "staff-b persisted", "source": "fresh API read"},
        {"id": "total", "expected": "unchanged from captured baseline", "source": "fresh API read"}
      ]
    }
  ]
}
```

List every executed local dependency in `files`, including helpers, fixture modules, configs, dependency manifests/lockfiles, and approved baselines.
Use one test per case, titled `[E2E-01] descriptive title`.
The command must target exactly these tests with one configured browser project and one repeat.
Expand cases explicitly when multiple roles, inputs, browsers, or viewports are acceptance requirements.
Do not use `test.fail`, conditional skips, or retries to turn an unmet outcome into acceptance.
Configure `trace: 'on'` for browser cases after reviewing privacy implications.
The evidence tool adds native JSON reporting and a per-run output directory.
The environment label and revision are declarations; record actual service versions/config identity separately when they differ from the checkout.

## Structured observations

Tests attach one `runtime-observations` JSON document after recording checkpoints.
Register cleanup in `finally`/fixture teardown and attach the final cleanup outcome even on failure where possible.
Use Playwright `expect` assertions in addition to attaching observations.
Do not manually fabricate actual values or pass flags.

```ts
const baseline = await readPersistedOrder(orderId);
// Drive the real UI save path, then reload and read the persisted order again.
const actual = await readPersistedOrder(orderId);
const observations = {
  actualPath: `Order Detail -> Edit -> Save -> Reload; PATCH /api/orders/${orderId}`,
  checks: [
    { id: 'ui_staff', source: 'rendered DOM after reload',
      expected: 'Staff B', actual: await page.getByTestId('staff').innerText() },
    { id: 'saved_staff', source: `GET /api/orders/${orderId}`,
      expected: 'staff-b', actual: actual.staffId },
    { id: 'total', source: `GET /api/orders/${orderId}`,
      expected: baseline.total, actual: actual.total }
  ],
  cleanup: 'COMPLETE'
};
await test.info().attach('runtime-observations', {
  body: Buffer.from(JSON.stringify(observations)),
  contentType: 'application/json'
});
for (const check of observations.checks) {
  expect(check.actual, check.id).toEqual(check.expected);
}
```

This is a shape example, not a fixture implementation: emit `COMPLETE` only after cleanup actually succeeds.
Use `NOT_REQUIRED` for read-only cases; incomplete cleanup prevents acceptance.
Check evidence uses equality of JSON values; express other predicates as observed boolean comparisons and retain the underlying measurements in extra fields.
For invariants, retain baseline resource identity, values, observation time, and source in the document.
For requests, retain method/route/status and sanitized checkpoint values.
API cases use `kind: "api"` and retain request/downstream observations rather than a browser trace.
Boolean-only observations without supporting values are weak proof for an auditor.
Declared expectations are human-reviewed semantics; the tool cannot infer whether an observed value was derived honestly or whether a query bypasses the intended boundary.

## Commands

```bash
python3 <skill-root>/scripts/evidence.py validate <suite.json> --root <project>
# Only after explicit human approval, never as an agent's own decision:
python3 <skill-root>/scripts/evidence.py approve <suite.json> --root <project> --reviewer <human-id>
python3 <skill-root>/scripts/evidence.py run <suite.json> --root <project> --out <new-run-directory>
python3 <skill-root>/scripts/evidence.py audit <run-directory>
```

`approve` snapshots the suite and declared files in `<suite.json>.approval.json` by hash.
`run` rejects stale approval, creates a new directory, snapshots approved inputs, records the command/environment/revision and git identity, and executes without a shell.
The project must perform authorized preflight and acquire any required shared-state lock before invoking `run`.
Keep the lock through fixture cleanup; release it using the project's interruption-safe procedure.
`RUNTIME_E2E_RUN_ID` is available to fixtures, and `PLAYWRIGHT_JSON_OUTPUT_NAME` selects the native result file.
Do not permit tests to write generated output into approved files.

The bundle includes `inputs/`, `approval.json`, `run-manifest.json`, `native.json`, `artifacts/`, `stdout.log`, `stderr.log`, `results.json`, `summary.md`, and `integrity.json`.
Snapshots make the audit independent of later working-tree changes.
Attachment paths in native results are normalized to bundle-relative locations.
Only per-run artifact files and inline observations are accepted as attachments.
Keep the bundle locally unless its privacy/retention policy authorizes sharing it.

## Result and audit semantics

- `PASS`: native execution passed on the first attempt, all declared observation checks match, required evidence exists, and cleanup completed or was unnecessary.
- `FAIL`: native failure or a recorded expected/actual mismatch, including flaky retry-pass.
- `BLOCKED`: passing native execution lacks required proof/cleanup; malformed or missing output prevents acceptance.
- `NOT_RUN`: skipped or absent test; never coverage credit.

The tool exits nonzero for any result other than PASS or an execution failure.
It records all attempts, and rejects duplicate/undeclared tests rather than silently broadening coverage.
`audit` checks bundle integrity and recomputes the generated results/summary from raw results.
It does not automatically establish `SUPPORTED`: Agent B still inspects assertions, trace/request checkpoints, baseline values, persistence sources, safety and approval provenance.
Do not alter the bundle to repair failures; create a newly approved run instead.
For prerequisites discovered before execution, record the blocker in the Markdown ledger; do not manufacture a native PASS or a fake run bundle.
