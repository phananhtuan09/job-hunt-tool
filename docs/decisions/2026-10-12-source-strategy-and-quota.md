# Source strategy and quota budget

Status: Accepted
Date: 2026-10-12
Scope: Which sources are collected, how often, and how free quotas are protected.

## Context

Two sources are quota-limited free APIs, and scraped sources can be rate limited or blocked.
The daily run must stay within free limits.

## Decision

Sources and their limits:

| Source | Method | Free limit | Note |
| --- | --- | --- | --- |
| SerpApi | Google Jobs, `engine=google_jobs`, `gl=vn`, `hl=vi` | 250 searches per month | One page of about 10 Jobs is one search. |
| JSearch | RapidAPI | 200 requests per month, hard limit | Provides salary and employment type fields. |
| JobSpy LinkedIn | Scrape, location `Ho Chi Minh City` | Unlimited | Returns 429 on rapid requests; may be blocked from GitHub Actions and then run locally. |
| JobSpy Indeed | Scrape, `country_indeed=Vietnam` | Unlimited | Most stable. |
| ITviec | Custom adapter | Unlimited | Look for an internal JSON API first. |
| TopDev | Custom adapter | Unlimited | Look for an internal JSON API first. |

Safety margin: the tool stops using SerpApi at 240 requests in a calendar month (UTC).

Budget: 3 keywords across 2 cities is 6 queries per day, about 180 requests per month for each of SerpApi and JSearch.

## Constraints

- Each quota-limited query MUST fetch only page 1 and MUST restrict to recently posted jobs.
- Pagination MUST stop on reaching a Job that is already stored.
- The tool MUST record quota used per source in persistent storage (a JSON file in the MVP, see [MVP storage in a CSV file](2026-10-12-mvp-csv-storage.md)) and MUST skip a source close to its limit.
- Requests to scraped sources MUST include delays.

## Consequences

- Positive: usage stays inside free tiers with a margin of roughly 70 requests per month.
- Negative: raising keywords or cities beyond the budget exhausts SerpApi and JSearch before month end.
- Negative: page-1-only collection can miss postings on busy days.

## Alternatives considered

- Facebook and logged-in LinkedIn: rejected because of login requirements and strong anti-bot measures.

## References

- [Job collection and notification](../product/job-collection.md)
- [Technology stack and architecture](2026-10-12-technology-stack-and-architecture.md)
