# Technology stack and architecture

Status: Accepted
Date: 2026-10-12
Scope: Whole job collection tool: runtime, pipeline, storage, scheduling, notification.

## Context

A personal tool must run daily at zero cost and combine heterogeneous sources into one normalized, deduplicated store.

## Decision

- Language and tooling: TypeScript on Node 22, managed with pnpm.
- Validation: Zod for the config file and the Job schema.
- Vietnamese job sites: Crawlee with Cheerio, preferring the site's internal JSON API; Playwright only when no other approach works.
- LinkedIn and Indeed: JobSpy (Python) as one script that prints JSON to stdout, invoked from Node with `execa`.
- Google Jobs: SerpApi and JSearch (RapidAPI) through `fetch`.
- Normalization: regex and rule based.
- Database: Supabase (Postgres). The Phase 1 MVP stores to a CSV file instead; see [MVP storage in a CSV file](2026-10-12-mvp-csv-storage.md).
- Scheduler: GitHub Actions cron, once per day.
- Notification: Telegram Bot.
- Pipeline: config, then source adapters, then normalize, then dedupe, then Supabase, then Telegram for new and matched Jobs.
- Every source implements one shared adapter interface with a name, a `fetch` for a keyword and location returning raw jobs, and a `normalize` from raw job to Job.
- Secrets are supplied as environment variables: `SERPAPI_KEY`, `RAPIDAPI_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

## Constraints

- Only free tiers MAY be used.
- Secrets MUST NOT be committed to the repository.
- Adding a source MUST NOT require changes outside its adapter, config entry, and registration.
- During development and tests, adapters MUST use saved sample responses in `fixtures/*.json` and MUST NOT call paid or quota-limited APIs.
- LLM-based normalization and a Next.js dashboard on Vercel are deferred and MUST NOT be built until requested.

## Consequences

- Positive: zero running cost, one uniform pipeline, and new sources are cheap to add.
- Negative: two runtimes (Node and Python) are needed for JobSpy.
- Negative: LinkedIn scraping may be blocked from GitHub Actions IPs and may need to run locally.
- Negative: rule-based normalization will miss unusual formats until the LLM fallback is built.

## Alternatives considered

- Playwright for all sites: not selected as the default because internal JSON APIs are lighter and more stable.

## References

- [Job collection and notification](../product/job-collection.md)
- [Source strategy and quota budget](2026-10-12-source-strategy-and-quota.md)
- [MVP storage in a CSV file](2026-10-12-mvp-csv-storage.md)
