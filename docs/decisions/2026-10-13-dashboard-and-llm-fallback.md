# Dashboard and LLM fallback architecture

Status: Accepted
Date: 2026-10-13
Scope: Next.js job dashboard, access control, and LLM normalization fallback.

## Context

Phase 3 requires browsing, filtering, and updating job statuses in a web interface, as well as handling edge cases where regex-based normalization leaves key fields (salary, level, experience, remote) empty.
The tool operates at zero running cost and is used solely by the owner.

## Decision

- **Dashboard Tech Stack**: Next.js App Router with Vanilla CSS / CSS Modules for maximum control and rich, premium aesthetics (dark mode, glassmorphism, responsive grid).
- **Dashboard Access Control**: Single-user token/PIN protection (`DASHBOARD_SECRET_KEY`). Access requires submitting the secret, which is verified server-side and stored in an HTTP-only cookie. Unauthenticated requests are redirected to a sleek unlock screen.
- **Data Access & State Updates**: Server components and Route Handlers interact with the persistent store (Supabase or CSV store). Status changes (`new`, `saved`, `applied`, `rejected`) persist immediately.
- **LLM Normalization Fallback**:
  - Invoked **only** when rule-based parsing leaves essential fields (`salary`, `level`, `expMin`, or `remote`) null.
  - Zero-cost provider: Google Gemini API (or compatible free tier provider) via `GEMINI_API_KEY` / `LLM_API_KEY`.
  - Structured output validated strictly using Zod.
  - Hard cap of 10 calls per crawler run to ensure 100% adherence to free quotas.
  - Any LLM failure (network, timeout, invalid JSON) leaves the field null and MUST NOT fail the crawl run.

## Constraints

- Total running cost MUST remain 0 VND.
- The dashboard MUST NOT require multi-user management or third-party paid auth services.
- The LLM fallback MUST NEVER be called when regex extraction already parsed the fields.

## Consequences

- Positive: Personal dashboard is fast, secure, deployable on Vercel free tier, and provides status management.
- Positive: Postings with complex or informal Vietnamese phrasing get normalized accurately without breaking the zero-cost ceiling.
- Negative: Secrets must be configured on Vercel environment variables for production access.

## References

- [Job collection and notification](../product/job-collection.md)
- [Dashboard and status management](../product/dashboard-and-status.md)
- [Technology stack and architecture](2026-10-12-technology-stack-and-architecture.md)
