# Phase 2: More sources, cross-source dedupe, daily schedule

Status: Implemented with fixtures and unit tests; live GitHub Actions run pending human credentials
Last updated: 2026-10-13

## Goal

All configured sources feed the same pipeline, one posting seen on several sources is one Job, and the run happens automatically once per day on GitHub Actions.

Governing knowledge:
- [Job collection and notification](../../product/job-collection.md)
- [Technology stack and architecture](../../decisions/2026-10-12-technology-stack-and-architecture.md)
- [Source strategy and quota budget](../../decisions/2026-10-12-source-strategy-and-quota.md)

## Prerequisites

- Phase 1 pipeline, adapter interface, store, and Telegram notifier work end to end with real or fixture data.
- A persistent store that survives between GitHub Actions runs: Supabase store implemented with `schema.sql`.
- Python available locally (.venv) and in CI for JobSpy.

## Out of scope

Dashboard (Phase 3), LLM normalization (Phase 3), any source excluded by the source decision (Facebook, logged-in LinkedIn).

## Steps

1. **JSearch adapter**: RapidAPI fetch, map the provided salary and employment type fields, count against the 200 per month hard limit. Proof: Vitest on a saved fixture in `tests/jsearch.test.ts`.
2. **JobSpy script and adapter**: Python script `scripts/jobspy_scrape.py` printing JSON to stdout for LinkedIn and Indeed; Node calls it with `execa`; delays between requests; handles 429/blocked as source failure. Proof: Vitest in `tests/jobspy.test.ts`.
3. **ITviec adapter**: Cheerio HTML parser with relative date conversion and skill extraction. Proof: Vitest on a saved response in `tests/itviec.test.ts`.
4. **TopDev adapter**: Internal JSON API client (`api.topdev.vn/td/v2/jobs`) with query filters and field normalization. Proof: Vitest in `tests/topdev.test.ts`.
5. **Cross-source dedupe check**: `normalizeCompany` (legal prefixes and corporate suffixes) and `normalizeJobTitle` yielding unified job IDs. Proof: Vitest in `tests/dedupe.test.ts`.
6. **Run resilience**: per-source error isolation, per-source timeouts, summary log of fetched, new, and failed counts per source in `RunResult.sources`. Proof: Vitest with failing/slow adapters in `tests/pipeline.test.ts`.
7. **Persistent store**: Supabase store (`src/supabase.ts`) implementing `JobStore` alongside CSV store, plus `schema.sql`. Proof: Vitest in `tests/supabase.test.ts`.
8. **GitHub Actions cron**: `.github/workflows/daily.yml` daily schedule (01:00 UTC) with Node 22 and Python, manual trigger support.
9. **LinkedIn fallback**: Diagnostic and graceful handling for IP rate-limiting in CI environments.

## Dependencies and human inputs

- API keys and credentials in repository secrets: `SERPAPI_KEY`, `RAPIDAPI_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

## Validation evidence

- `pnpm test` passed: 14 test files, 57 tests passing.
- `pnpm typecheck` passed with zero errors.
- Adapters wired into `src/index.ts` with Supabase store fallback to CSV store.

## Completion

Move to `docs/plans/completed/` after live credentials are added in GitHub Actions secrets and a successful live run is verified.
