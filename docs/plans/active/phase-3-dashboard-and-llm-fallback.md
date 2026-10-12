# Phase 3: Dashboard and LLM normalization fallback

Status: Not started, blocked on product definition (starts after [Phase 2](phase-2-more-sources-and-scheduling.md) completes)
Last updated: 2026-10-12

## Goal

Browse, filter, and update the status of stored Jobs in a Next.js dashboard on Vercel, and improve normalization of postings the rule-based normalizer cannot parse by using an LLM as a fallback.

Governing knowledge:
- [Job collection and notification](../../product/job-collection.md) defines the Job schema and status values.
- [Technology stack and architecture](../../decisions/2026-10-12-technology-stack-and-architecture.md) defers both items and says they must not be built until requested.

## Prerequisites

- Phase 2 complete, with real stored data to design against.
- Human request to start this phase, and accepted answers to the open decisions below.

## Out of scope

Multi-user accounts, any paid service beyond free tiers.

## Open decisions (block building)

- Dashboard behavior: views, filters, and how status changes (`new`, `saved`, `applied`, `rejected`) are made; record accepted behavior in `docs/product/` first (use the proposal-designer skill if framing is needed).
- Dashboard access control: a personal tool holding job data and a Supabase service key needs an access decision (for example a single-user login) before deployment; record it in `docs/decisions/`.
- LLM provider, cost ceiling to stay at zero cost, and which fields it fills; record in `docs/decisions/` and update the stack decision that currently defers it.
- Which unparsed cases justify the fallback; measure rule-based misses on real data first.

## Steps

1. **Measure normalization misses**: count Jobs with null salary, level, or experience despite the description containing the information; decide whether the fallback is worth it. Proof: query results recorded here.
2. **Product and decision docs**: write the accepted dashboard behavior, access control, and LLM decisions per the open decisions. Proof: docs match namespace contracts.
3. **LLM fallback**: invoked only when rule-based parsing leaves a field null; output validated with Zod; failures leave the field null and never fail the run; calls limited to stay within the cost ceiling. Proof: Vitest with recorded model responses and invalid-output cases; before and after miss counts on saved real data.
4. **Dashboard read views**: Next.js app reading Jobs from Supabase with the agreed filters. Proof: runtime E2E plan using the runtime-e2e-test skill once the app exists (update `.claude/skills/runtime-e2e-test/references/project-runtime.md` first).
5. **Status updates**: change a Job's status from the dashboard and persist it. Proof: runtime E2E case with fresh persisted-state observation.
6. **Deploy to Vercel**: with the access control decision applied and secrets only in Vercel environment settings. Proof: deployed URL rejects unauthenticated access and shows data when authenticated.

## Dependencies and human inputs

- Vercel account, LLM provider account if chosen, and decisions above.

## Validation evidence

None yet.

## Completion

Move to `docs/plans/completed/` after the dashboard is deployed with the accepted access control, status changes persist, and the LLM fallback measurably reduces null fields without adding cost.
