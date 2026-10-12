# Phase 1: SerpApi to Telegram (MVP)

Status: Implemented against a sample fixture; live run pending credentials
Last updated: 2026-10-12

## Goal

One local command (`pnpm start`) runs the pipeline for the SerpApi source: load config, fetch, normalize, dedupe, store to `data/jobs.csv`, and send Telegram messages for new matched Jobs.
Scheduling and other sources are Phase 2.

Governing knowledge:
- [Job collection and notification](../../product/job-collection.md)
- [Technology stack and architecture](../../decisions/2026-10-12-technology-stack-and-architecture.md)
- [Source strategy and quota budget](../../decisions/2026-10-12-source-strategy-and-quota.md)
- [MVP storage in a CSV file](../../decisions/2026-10-12-mvp-csv-storage.md)

## Current state

- Done and covered by Vitest: Job and adapter types, normalizer (salary, level, experience, relative date, city, remote, skills, id), match rules, SerpApi adapter, dedupe and merge, CSV store with quota file, Telegram notifier, pipeline with notification cap and retry, `pnpm start` entrypoint, `.env` with empty keys.
- Not done: any live call. The only SerpApi data is a synthetic sample, `fixtures/serpapi-google-jobs.sample.json`, built from the documented response shape.

## Out of scope

Supabase, JSearch, JobSpy, ITviec, TopDev, GitHub Actions cron, dashboard, LLM normalization.

## Remaining steps

1. Fill `SERPAPI_KEY`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHAT_ID` in `.env` (human).
2. Record one real SerpApi `google_jobs` response in `fixtures/` (one search, with approval), replace the sample, and fix any field the real shape breaks in the adapter or normalizer.
3. Run `pnpm start` once live, check `data/jobs.csv` and the Telegram message, then run it again and confirm nothing new is sent.
4. Review normalization quality on the real rows (salary, level, experience) and fix observed misses.

## Choices made for the MVP

The accepted behavior is in the product doc; implementation-level choices:
- `pagesPerQuery` in `config.yaml` is accepted but the adapter fetches page 1 only, as the source decision requires.
- The sample fixture assumes Vietnamese `hl=vi` strings and English strings both occur.
- Delay between queries is 1 second.
- Sources other than SerpApi that are enabled in `config.yaml` are skipped with a warning until their adapters exist.

## Validation evidence

- `pnpm typecheck` and `pnpm test` passed (8 files, 37 tests), including a fixture-driven run of the real adapter, matcher, CSV store and pipeline with a fake notifier.
- `pnpm start` without credentials exits non-zero with a message naming the missing variable.
- No live SerpApi or Telegram call has been made.

## Completion

Move this plan to `docs/plans/completed/` after steps 1 to 4 are done.
