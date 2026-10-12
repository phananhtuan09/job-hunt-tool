# MVP storage in a CSV file

Status: Accepted
Date: 2026-10-12
Scope: Phase 1 MVP persistence and run state. Supabase is deferred, not rejected.

## Context

The MVP must run before any Supabase project exists, and the tool has no UI yet.
The stack decision names Supabase as the database.

## Decision

- Jobs are stored in `data/jobs.csv`, one row per Job, with the columns of the Job schema.
- List fields are encoded in one cell: `skills` joined with `|`, `sources` as JSON.
- Monthly source quota usage is stored in `data/quota.json`.
- The `data/` directory is git-ignored because it holds personal job data.
- The MVP reads `SERPAPI_KEY`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHAT_ID` from `.env`.
- `RAPIDAPI_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_KEY` stay listed in `.env.example` but are not read yet.
- Supabase replaces the CSV file in a later phase; the storage functions are the only code that touches the file.

## Constraints

- The whole file is rewritten on each run through a temporary file and rename, so an interrupted run never leaves a partial file.
- Only one run at a time may use the same `data/` directory.
- The CSV file is not a shared store: GitHub Actions cannot persist it between runs, so the daily cron (Phase 2) requires a different store or committed state.

## Consequences

- Positive: the MVP runs locally with no database setup and the data is readable in a spreadsheet.
- Negative: no concurrent access, no queries, and a later migration to Supabase is needed.

## Alternatives considered

- Plain text or JSONL: not selected because CSV opens directly in a spreadsheet for review.
- Supabase now: not selected because the user wants to run the MVP before creating accounts.

## References

- [Job collection and notification](../product/job-collection.md)
- [Technology stack and architecture](2026-10-12-technology-stack-and-architecture.md)
- [Source strategy and quota budget](2026-10-12-source-strategy-and-quota.md)
