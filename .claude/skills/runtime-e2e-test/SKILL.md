---
name: runtime-e2e-test
description: Plan and run real web and HTTP API runtime E2E acceptance or regression tests using Playwright scripts. Use for multi-case user flows, forms, authentication, permissions, persistence, async integrations, uploads/downloads, and approved visual baselines. Produce a human-reviewed Markdown plan, mapped executable tests, and auditable runtime evidence; never pass cases using screenshots alone, mocks, or source inspection.
argument-hint: "plan <scope> | run <suite.json>"
---

# Runtime E2E Test

Encode actions and assertions in native Playwright Test scripts.
Use judgment to design coverage and investigate failures, not to manually drive or score automated cases.
There are exactly two modes: `plan` and `run`, with explicit human approval between them.

## Source of truth

Read `docs/testing/README.md` before creating, executing, resuming, or auditing a plan. Store active plans in `docs/testing/active/` and useful completed plans in `docs/testing/completed/`.

Validate the artifact with:

```bash
python3 .claude/skills/runtime-e2e-test/validate_test_plan.py <plan.md> --mode plan
python3 .claude/skills/runtime-e2e-test/validate_test_plan.py <plan.md> --mode completion
```

Runtime adapters rewrite the skill path when installed.

## Project runtime reference

Before planning or execution, read
`.claude/skills/runtime-e2e-test/references/project-runtime.md`. This file is a
project-local template that maintainers customize after installation with the
actual service commands, readiness signals, environment profile, required
variable names, authentication, fixtures, evidence locations, cleanup, and safety
constraints.

Treat the reference as operational configuration, not product authority. Never
execute placeholder commands or invent environment values. `Status: READY` means
the project has verified the documented preflight. If the file is missing or
unconfigured, inspect existing repository configuration and runbooks for facts
you can establish safely. Record unresolved runtime prerequisites as blockers;
never compensate with a lower-level or mocked path. Never write secret values into
the reference or a test plan.

## Scope and boundaries

Support browser web flows and real HTTP APIs through Playwright Test, including runtime observations of permitted downstream state.
Native mobile/desktop, CLI-only systems, hardware, load benchmarks, and comprehensive security testing are outside this capability.
Subjective UX needs human review; screenshot comparisons need an approved baseline.
Coverage means the declared cases, not a claim that the application has no bugs.

Read `references/playwright-contract.md` before writing tests or running a suite.
Reuse existing Playwright config, fixtures, and helpers.
If setup is absent, propose minimal dependencies/config for approval before installing or changing them.
Do not build a custom browser runner or JSON action DSL.

Use this capability when verification has multiple cases, crosses runtime boundaries, must survive sessions, needs fixtures or cleanup, includes release blockers, or needs later audit.

Do not create a durable plan for a small same-session check that can be reproduced and proved directly.

A runtime case exercises the running system through its real user or operational entrypoint. Unit, widget, mocked, static-analysis, build, and source-inspection checks may supplement a run, but they never make a runtime case pass.

Interactive browser tools may discover selectors or debug a failure, but cannot replace script execution or score an automated case.
The fixed constraints are:

1. Exercise the declared runtime path.
2. Observe the declared outcome.
3. Record clear evidence.
4. Never convert unavailable or alternate-path proof into `PASS`.

## Mode: `plan`

1. Read the project runtime reference, current request, and the smallest relevant product, domain, architecture, code, configuration, and runtime surfaces.
2. Derive cases from observable behavior, boundaries, failures, and material negative paths.
3. Trace each release-blocking case far enough to name the real production path: user action or operational trigger, runtime entrypoint, boundary request, and persisted or visible outcome.
4. Separate agent-verifiable behavior from subjective human judgment.
5. Define isolated fixtures, authentication, cleanup, environment restrictions, and concurrency safety.
6. Write native Playwright tests and a `suite.json` contract mapping every case to one uniquely tagged test and its required checks.
7. For each expected outcome, name the assertion and observation source. Persistence claims require a fresh persisted-state observation; a successful response or toast is insufficient.
8. Capture baseline values before mutation when proving invariants such as unchanged totals. Assert the final UI after reload and persisted state separately where both are required.
9. Use real controls, stable unique locators, event-based waits, and bounded timeouts rather than arbitrary sleeps. No mocked production boundaries.
10. Mark `READY` only when paths, expectations, scripts, and required evidence are reviewable. Validate the Markdown and suite contracts.
11. Stop and ask the human to review the plan, tests, fixtures, config, and commands. Record approval only after an explicit decision, using the evidence tool's `approve` command.

Include imported local helpers, fixture modules, relevant dependency lockfiles, config, and visual baselines in approved files.
Any change to approved files, steps, assertions, or expected values invalidates approval.
Planning may use read-only inventory; do not exercise mutation flows until approved execution.

Do not freeze an implementation detail unless it identifies the production path or observable contract. If several valid runtime methods exist, describe the required boundary and outcome rather than one exact tool command.

## Mode: `run`

1. Read the entire plan, project runtime reference, and current repository authority.
2. Run the documented preflight where needed; do not start against a prohibited or unidentified environment.
3. Record the tested revisions, environment, configuration identity, and a unique run ID without storing secrets.
4. Check approval and snapshot approved files, then execute through `scripts/evidence.py run`. Launch independent browsers; never attach to a shared Chrome DevTools MCP/CDP session.
5. Let Playwright drive the declared path and assert observable outcomes. Fresh contexts isolate sessions; run-marked fixtures isolate data. Serialize shared mutations or acquire the project lock before execution.
6. Use the tool-generated native results, observations, attempts, trace, cleanup, and summary. Never hand-edit evidence or generated reports.
7. Mark:
   - `PASS` only when the declared runtime path and expected outcome were observed.
   - `FAIL` when the path runs and the outcome differs.
   - `BLOCKED` when the required runtime path cannot be exercised.
   - `INVALIDATED` when accepted intent changed and the old case no longer represents the required behavior.
8. Do not fix application code in this mode. Preserve failures and report them for a separate authorized fix. Test/config changes require reapproval and a new run; rerun the same case after a fix.
9. Complete cleanup and record its status.
10. Update the run summary and set the suite status:
   - `FAILED` or `BLOCKED` while material cases remain unresolved.
   - `AWAITING_HUMAN` when machine-verifiable cases pass but subjective review remains.
   - `COMPLETED` only after required human sign-off is accepted.
11. Audit the bundle and run the Markdown validator in `completion` mode before claiming completion. Update the Markdown ledger from generated results, linking the immutable run summary; never invent observations or counts.

Do not silently resume by reusing earlier PASS results for a changed revision or environment.
Each invocation is a separate run; partial suites require an explicitly narrowed, reviewed contract and never count as full coverage.

## Path fidelity

An alternate endpoint, direct database mutation, lower-level method, test double, or automation-only shortcut is not the declared production path unless the case explicitly targets it.

If the production path changes because accepted behavior changed, revise the case and note why. Do not revise a path merely because another path is easier to test.

## Evidence

Evidence must let another session determine what actually ran without replaying the entire conversation. Prefer stable repository-relative paths and identifiers:

- browser screenshot or recording path
- request method, route, and status
- correlation or trace ID
- runtime log path and relevant timestamp
- persisted resource ID and observed post-reload state
- generated file or exported document path

Every machine-verifiable expected outcome needs a mapped assertion and structured observation.
Screenshots supplement this proof; their existence is not a passing criterion.
Keep native results and all retry attempts. A retry-pass is reported as flaky, not silently counted as a clean PASS.
Retain sanitized traces for browser cases, and structured request/state evidence for API-only cases.
Avoid sensitive payloads in trace capture; establish redaction before execution and never upload artifacts without authorization.

Never copy secrets, tokens, cookies, passwords, or production-sensitive payloads into the plan.

## Human sign-off

Keep human review small. The reviewer checks:

1. Summary counts and release blockers.
2. `Runtime path` versus `Actual path` for important cases.
3. Evidence for failures, blockers, and subjective UI/UX cases.
4. The running product directly where judgment is subjective.

The agent may prepare the sign-off section but must never set `Decision: ACCEPTED` without an explicit human decision.

## Evidence audit (within either mode; not a third mode)

For an existing plan:

1. Run `scripts/evidence.py audit <run-directory>` and the Markdown validator.
2. Read the approved plan and test snapshots, not just the summary or PASS flags.
3. Match expected → assertions → runtime path in trace/request checkpoints → actual observations → native results. Inspect every release blocker, failure, skipped/flaky case, and suspicious PASS.
4. Verify baseline/invariant checks, persisted state, fixture identity, and cleanup. Screenshot-only claims are unsupported.
5. Classify claims as `SUPPORTED`, `UNSUPPORTED`, `INCONSISTENT`, or `HUMAN_REVIEW_REQUIRED`. Mechanical validation is necessary but cannot establish assertion quality or semantic path fidelity.
6. Request targeted reruns only for missing, contradictory, stale, or insufficient evidence. Unsupported proof is not itself a product bug.

Hashes detect changes relative to the approved snapshot; they do not prove execution authenticity against a dishonest producer.
Use independent CI logs/artifact storage when stronger provenance is required.
