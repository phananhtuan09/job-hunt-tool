# Dashboard and status management

Status: Active
Scope: User interface for exploring, filtering, and updating status of collected jobs.

## Purpose

Enable the user to browse collected postings through a visual dashboard, filter by criteria (status, level, salary, work mode, location), inspect source links, and track job applications across lifecycle stages.

## Definitions

- **Status**: Lifecycle state of a job in the user's hunt:
  - `new`: newly collected, unreviewed.
  - `saved`: bookmarked for later application.
  - `applied`: application submitted.
  - `rejected`: discarded or declined.

## Rules

- The dashboard MUST display jobs stored in the persistent database.
- The dashboard MUST provide filters for:
  - `status` (`all`, `new`, `saved`, `applied`, `rejected`)
  - `city` (`all`, `Ho Chi Minh City`, `Hanoi`, `Da Nang`)
  - `level` (`intern`, `junior`, `middle`, `senior`, `lead`)
  - `remote` (`remote`, `hybrid`, `onsite`)
  - `salaryMin` (minimum monthly compensation)
  - Search query across title, company, skills, and description.
- The dashboard MUST provide instant status update actions (`new` -> `saved` -> `applied` -> `rejected`) that persist immediately.
- The dashboard MUST show all linked sources (`itviec`, `topdev`, `jsearch`, `linkedin`, `indeed`, `serpapi`) with direct navigation links.
- The dashboard MUST enforce authentication using a single-user passkey/secret key.
- Unauthenticated visitors MUST see an access lock screen and MUST NOT access job records or update endpoints.

## References

- [Job collection and notification](job-collection.md)
- [Dashboard and LLM fallback architecture](../decisions/2026-10-13-dashboard-and-llm-fallback.md)
