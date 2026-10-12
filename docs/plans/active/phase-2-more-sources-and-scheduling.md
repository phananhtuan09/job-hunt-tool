# Phase 2: More sources, cross-source dedupe, daily schedule

Status: Not started (starts after [Phase 1](phase-1-serpapi-to-telegram.md) completes)
Last updated: 2026-10-12

## Goal

All configured sources feed the same pipeline, one posting seen on several sources is one Job, and the run happens automatically once per day on GitHub Actions.

Governing knowledge:
- [Job collection and notification](../../product/job-collection.md)
- [Technology stack and architecture](../../decisions/2026-10-12-technology-stack-and-architecture.md)
- [Source strategy and quota budget](../../decisions/2026-10-12-source-strategy-and-quota.md)

## Prerequisites

- Phase 1 pipeline, adapter interface, store, and Telegram notifier work end to end with real data.
- A persistent store that survives between GitHub Actions runs. The Phase 1 CSV file does not, so choose Supabase or committed state before the cron step ([MVP storage in a CSV file](../../decisions/2026-10-12-mvp-csv-storage.md)).
- Python available locally and in CI for JobSpy.

## Out of scope

Dashboard, LLM normalization, any source excluded by the source decision (Facebook, logged-in LinkedIn).

## Steps

1. **JSearch adapter**: RapidAPI fetch, map the provided salary and employment type fields, count against the 200 per month hard limit. Proof: Vitest on a saved fixture; one approved live call to record the fixture.
2. **JobSpy script and adapter**: one Python script that prints JSON to stdout for LinkedIn and Indeed; Node calls it with `execa`; delays between requests; handle 429 and non-zero exit as a source failure, not a run failure. Proof: Vitest on a saved JSON output; one local live run.
3. **ITviec adapter**: inspect the site's network calls for an internal JSON API first; use Cheerio only if none exists; Playwright only if unavoidable. Proof: Vitest on a saved response.
4. **TopDev adapter**: same approach as ITviec.
5. **Cross-source dedupe check**: fixtures where the same company, title, and city appear on two sources must yield one Job with both sources; review the id normalization for near-miss cases (company suffixes, accents, title variants) and fix only observed misses. Proof: Vitest.
6. **Run resilience**: per-source error isolation, per-source timeouts, summary log of fetched, new, and failed counts per source. Proof: Vitest with a failing adapter.
7. **Persistent store**: replace the CSV storage functions with Supabase (or another store accepted by decision) and migrate existing rows. Proof: Vitest on the store contract and a run against a test project.
8. **GitHub Actions cron**: one daily workflow that installs Node 22 and Python, runs the pipeline with secrets from repository secrets, and exposes a manual trigger. Proof: a manual workflow run that completes and a log showing per-source results.
9. **LinkedIn fallback**: if the CI run shows LinkedIn blocked, make LinkedIn local-only via config and record the finding in the source decision. Proof: CI run log.

## Dependencies and human inputs

- RapidAPI key for JSearch, GitHub repository with Actions secrets configured.
- Approval for live calls used to record fixtures.
- Permission to inspect ITviec and TopDev network traffic from a browser for API discovery.

## Open decisions

- Whether ITviec and TopDev allow this kind of collection under their terms is unverified; check before building steps 3 and 4 and stop if prohibited.
- Whether a blocked LinkedIn run means dropping it from CI or running it locally is decided at step 8 from evidence.

## Validation evidence

None yet.

## Completion

Move to `docs/plans/completed/` after a scheduled or manually triggered CI run collects from every enabled source (or records a documented failure for LinkedIn), stores deduplicated Jobs, and sends Telegram messages only for new matched Jobs.
