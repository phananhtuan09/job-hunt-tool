# Job collection and notification

Status: Active
Scope: Personal single-user tool that collects Frontend / Fullstack job postings in the Vietnam market and notifies the user of new matches.

## Purpose

Replace manual browsing of many job sites with one automated daily run.
The user receives only new, matching postings from all sources in a single normalized form, without duplicates.

## Definitions

- **Source**: a place postings are collected from, such as Google Jobs through SerpApi or JSearch, LinkedIn and Indeed through JobSpy, ITviec, or TopDev.
- **Job**: one normalized posting; the same posting seen on several sources is one Job with several source links.
- **Matched**: a Job that satisfies the user's configured filters.
- **New**: a Job not previously stored.
- **Query**: one keyword and location pair sent to a source.

## Rules

- The tool MUST run once per day and MUST operate at zero cost, using only free tiers.
- The tool MUST collect only Frontend and Fullstack roles in Vietnam.
- The tool MUST NOT collect from Facebook and MUST NOT use a logged-in LinkedIn account.
- The tool MUST crawl politely, with delays between requests and respect for rate limits.
- All behavior MUST be driven by a user-editable `config.yaml` with these settings:
  - `keywords` and `locations` define the queries;
  - `levels`, `experience` (min, max in years), `salary` (minimum in VND and whether negotiable salary is included), `remote` (any, remote, onsite, hybrid), and `postedWithinDays` define the filters;
  - per-source `enabled` flags and source options;
  - Telegram notification `enabled` and `onlyMatched` flags.
- The config MUST be validated on load, and invalid config MUST fail the run before any collection.
- Every Job MUST be normalized to one schema with these fields:
  - `id`, `title`, `company`, `city`;
  - `level` (intern, junior, middle, senior, lead, or unknown);
  - `expMin`, `expMax`;
  - `salaryMin`, `salaryMax`, `currency` (VND or USD), `negotiable`;
  - `remote` (remote, onsite, hybrid, or unknown);
  - `skills`;
  - `sources` (list of site and URL pairs);
  - `description`, `postedAt`, `firstSeenAt`;
  - `matched`;
  - `status` (new, saved, applied, rejected).
- Salary strings such as `15 Tr ₫–22 Tr ₫ một tháng`, `Up to $2000`, and `Thỏa thuận` MUST be parsed into min, max, currency, and negotiable.
- Level MUST be derived from the title.
- Experience MUST be derived from the description with patterns such as `2 năm` or `3+ years`.
- Relative posting dates such as `21 ngày trước` MUST be converted to an absolute date as of crawl time.
- A Job's `id` MUST be derived from the normalized company, normalized title, and city.
- A posting whose `id` already exists MUST add its source to the existing Job and MUST NOT create a new Job.
- Jobs MUST be stored persistently with their `status`, defaulting to `new`.
- A Job is `matched` only when every known field satisfies the config; a field that could not be determined (unknown level, experience, salary, remote mode, posting date, or city) MUST NOT cause a mismatch.
- Experience matches when the Job's range overlaps the configured range; a Job with only a lower bound has no upper limit.
- Salary matches only when the Job's top amount is at least `salary.minVND`; salary in a currency other than VND is treated as unknown.
- A Job with negotiable salary and no amount matches only when `salary.includeNegotiable` is true.
- A Job's city MUST be one of the configured locations when the city is known.
- A Job posted more than `postedWithinDays` days ago MUST NOT match.
- Unmatched Jobs MUST still be stored.
- A posting that matches an existing Job MUST only add its new source links; the stored fields and `status` MUST NOT change, and no new notification is sent.
- A Job that was stored MUST NOT be notified again, whatever its `status`.
- The first run MUST notify for every new matched Job, subject to the per-run cap.
- A run MUST send at most 20 job notifications; the remaining Jobs stay unstored and unnotified until the next run, and one message states how many are pending.
- A Job whose notification failed MUST NOT be stored, so the next run retries it.
- A notification message MUST show title, company, city, level, salary, remote mode, and every source link.
- If every query of a run fails, the run MUST fail with a non-zero exit and store nothing.
- If a notification fails, the run MUST end with a non-zero exit.
- Each run MUST send a Telegram notification for Jobs that are new and matched.
- When `onlyMatched` is disabled, new unmatched Jobs MAY also be notified.
- A failing source MUST NOT prevent other sources from running.
- Per-query pagination and quota usage rules are defined in [Source strategy and quota budget](../decisions/2026-10-12-source-strategy-and-quota.md).

## Examples

- The same "Senior React Developer" at one company appears on SerpApi and ITviec; one Job is stored with two entries in `sources`, and one notification is sent.
- A posting with `Thỏa thuận` salary is kept when `salary.includeNegotiable` is true.

## References

- [Technology stack and architecture](../decisions/2026-10-12-technology-stack-and-architecture.md)
- [Source strategy and quota budget](../decisions/2026-10-12-source-strategy-and-quota.md)
- [MVP storage in a CSV file](../decisions/2026-10-12-mvp-csv-storage.md)
