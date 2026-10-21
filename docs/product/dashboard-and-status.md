# Dashboard and status management

Status: Active
Scope: User interface for exploring, filtering, and updating status of collected jobs.

## Purpose

Enable the user to triage collected postings fast: for each job, decide in a few seconds whether it is worth opening on the source site, act on that decision in one click/keystroke, and never see a handled job in the inbox again. The dashboard is a decision tool, not a job-description reader — the full JD lives on the source site.

## Definitions

- **Status**: Lifecycle state of a job in the user's hunt:
  - `new`: newly collected, unreviewed. The only status shown in the default **inbox** view.
  - `saved`: handled — the user has seen the job and saved it as processed. Hidden from the inbox; reviewable and restorable in the **Đã xử lý** view.
  - `applied`: application submitted. Hidden from the inbox.
  - `rejected`: dismissed as not worth applying to. Hidden from the inbox.
- **View**: A slice of the collection shown in the list:
  - `inbox` (default): `status = new` only.
  - `processed` (Đã xử lý): `saved` + `applied` + `rejected` — where handled jobs can be reviewed or restored to the inbox.
  - `applied`: `status = applied` only, for follow-up.
  - `all`: everything, regardless of status.
- **Quick decision**: The rule-based verdict computed in `dashboard/lib/decision.ts` from the job's fields against the user's criteria in `config.yaml` (levels, experience range, minimum salary, city, posting age): a verdict (`Nên mở` / `Cân nhắc` / `Có thể bỏ qua`), a 0–100 match score, a per-criterion pass/fail/unknown comparison, strengths and warnings, and at most 3 short decision-bearing excerpts (pay/benefits, experience, hard requirements) extracted from the description. No LLM is involved.

## Rules

- The dashboard MUST display jobs stored in the persistent database.
- The default view MUST be the inbox: only `new` jobs, so a job that has been saved, applied to, or rejected never appears there again — including after later crawl runs (the pipeline preserves an existing job's status and only merges new sources into it).
- The dashboard MUST provide view tabs (`inbox`, `processed`, `applied`, `all`) and filters for:
  - `city` (`all`, `Ho Chi Minh City`, `Hanoi`, `Da Nang`)
  - `level` (`intern`, `junior`, `middle`, `senior`, `lead`)
  - `remote` (`remote`, `hybrid`, `onsite`)
  - Matched-only toggle (jobs the pipeline matched against `config.yaml`)
  - Search query across title, company, skills, and description.
  - Sort order: newest posting, highest salary, or highest decision score.
- The detail pane MUST be a quick-decision pane: it MUST show the verdict, the criteria comparison, strengths/warnings, skills, sources, and at most 3 decision excerpts. It MUST NOT render the full job description; the full text is read on the source site via the "Mở nguồn" link.
- Opening a source link MUST NOT by itself change a job's status. Only an explicit triage action marks a job handled.
- Triage actions MUST persist immediately and MUST be available from the detail pane, from quick actions on each list item, and from the keyboard (`s` save & hide, `a` applied, `x` skip, `o` open source, `u` undo, `j`/`k` or arrow keys to move). After an action hides the selected job, selection MUST advance to the next job, and an Undo affordance MUST be offered.
- A handled job MUST be restorable to the inbox from the processed view (status back to `new`).
- When the inbox is empty because everything has been handled, the dashboard MUST show an explicit "Inbox Zero" state instead of a generic no-results message.
- The dashboard MUST show all linked sources (`itviec`, `topdev`, `jsearch`, `linkedin`, `indeed`, `serpapi`) with direct navigation links.
- The dashboard MUST enforce authentication using a single-user passkey/secret key.
- Unauthenticated visitors MUST see an access lock screen and MUST NOT access job records or update endpoints.

## References

- [Job collection and notification](job-collection.md)
- [Dashboard and LLM fallback architecture](../decisions/2026-10-13-dashboard-and-llm-fallback.md)
