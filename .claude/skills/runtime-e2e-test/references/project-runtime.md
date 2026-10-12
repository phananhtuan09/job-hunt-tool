# Project Runtime E2E Reference

This file is a project-local operational reference. Complete it after installing the
skill, keep commands and paths current, and never store secret values here.

- Status: UNCONFIGURED
- Maintainer: —
- Last verified: —
- Applies to: job-hunt-tool, a batch pipeline (config, source adapters, normalize, dedupe, Supabase, Telegram) with no web UI or HTTP API

Use `Status: READY` only after the preflight commands and environment assumptions
below have been verified in this project.

## Runtime topology

List only services required for runtime E2E verification. Prefer links to an
existing runbook over duplicated instructions.

| Service | Working directory | Start command | Ready signal | Stop/reset command | Log location |
| --- | --- | --- | --- | --- | --- |
| None | — | — | — | — | — |

The tool is a batch run started by GitHub Actions cron or locally; it exposes no web or HTTP service.
The Next.js dashboard is deferred; add a `<web>` row here when it is built.

## Environment

- Runtime profile: `<local or a dedicated test Supabase project; not yet created>`
- Environment file or setup command: copy `.env.example` to `.env`
- Required variable names: `SERPAPI_KEY`, `RAPIDAPI_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- Secret acquisition method: `<approved secret manager or human-provided session>`
- Allowed external dependencies: Supabase and Telegram test targets only; SerpApi and JSearch are quota-limited and MUST NOT be called by tests (use `fixtures/*.json`)
- Prohibited targets: the real Supabase project and the real Telegram chat used for daily notifications
- Configuration identity to record in plans: `<version, profile, image tag, etc.>`

## Existing E2E entrypoints

- Full-suite command: `pnpm test` (Vitest unit tests; not runtime E2E)
- Focused-case command/filter: `pnpm test -- <file or -t name>`
- Browser harness: NOT_AVAILABLE (Playwright is not installed)
- Runtime artifacts produced by the harness: `<paths>`

Existing automated E2E commands may execute cases, but the plan ledger remains the
source for declared paths, observed outcomes, and evidence.

## UI and authentication

- Application URL: `<URL>`
- Supported browser/device and viewport: `<value>`
- Authentication setup: `<fixture account, login flow, or approved session method>`
- Roles/accounts available: `<non-secret identifiers or fixture creation method>`
- Important user entrypoints: `<routes or navigation landmarks>`

## API and state observation

- API base URL: `<URL>`
- Health/readiness endpoint: `<method and route>`
- Request observation method: `<browser network, proxy, logs, tracing, etc.>`
- Correlation/trace lookup: `<method>`
- Persisted-state observation: `<supported API, UI reload, read-only query, etc.>`
- Forbidden shortcuts: `<direct writes, internal endpoints, or unsupported probes>`

## Fixtures and cleanup

- Seed/setup command: `<command or procedure>`
- Fixture namespace or identifier convention: `<value>`
- Required baseline data: `<description>`
- Cleanup command or procedure: `<value>`
- Isolation/concurrency constraints: `<value>`
- Recovery procedure after interruption: `<value>`

## Evidence conventions

- Artifact root: `<repository-relative or approved external path>`
- Screenshot/recording naming: `<pattern>`
- Runtime log references: `<path plus timestamp/correlation convention>`
- Request evidence: `<method, route, status, and identifier convention>`
- Retention or redaction rules: `<rules>`

## Safety constraints

- `<Data mutation boundaries>`
- `<Rate, cost, or external side-effect limits>`
- `<Required cleanup or rollback>`
- `<Actions requiring explicit human approval>`

## Preflight

Before setting `Status: READY`, verify:

- every required service can start and exposes the documented ready signal;
- the selected environment is permitted and distinguishable from production;
- required variable names are documented and their values are available securely;
- authentication and fixture setup work;
- evidence can be captured at the documented locations;
- cleanup restores the environment to its baseline;
- commands use repository-relative paths where practical.

## Known limitations

- This project has no web UI or HTTP API, so the pipeline is a CLI-style batch and is outside this skill's scope (browser and HTTP API only).
- Pipeline behavior is verified with Vitest and saved fixtures, not with this skill.
- Keep `Status: UNCONFIGURED` until the dashboard or an HTTP API exists and the preflight has been run.

## Playwright execution and audit

- Project root: `<directory containing the Playwright config>`
- Test/config/helper locations: `<existing project conventions>`
- Dependency/browser installation: `<approved command; never install implicitly>`
- Native execution command: `<argument array ending in Playwright test; no shell operators>`
- Evidence attachment policy: `<redaction and retention, including traces and screenshots>`
- Persistence proof: `<fresh API read, read-only DB query, or verified server-backed UI load>`

Use the skill's suite contract and evidence tool described in `playwright-contract.md`.
Launch a separate browser per invocation rather than attaching to a shared CDP session.
Tests must emit structured checkpoint observations, not screenshot-only proof.

## Parallel execution

- Isolation: `<isolated fixtures/accounts/databases OR serialized>`
- Run marker: `<use RUNTIME_E2E_RUN_ID in fixture identifiers>`
- Shared mutation lock: `<project-provided lock procedure or NOT_REQUIRED with reason>`
- Ports/service ownership: `<assigned ports and which process owns shutdown>`
- Interrupted-run recovery: `<scoped cleanup for a specific run marker>`

Unknown isolation means serialize mutation runs.
Browser contexts do not isolate database state or external side effects.
Never reset a shared database or stop services owned by another run.
