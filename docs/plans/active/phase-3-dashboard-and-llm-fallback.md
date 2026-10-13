# Phase 3: Dashboard and LLM normalization fallback

Status: Implemented with Next.js dashboard, passkey access control, and LLM fallback normalizer
Last updated: 2026-10-13

## Goal

Browse, filter, and update the status of stored Jobs in a Next.js dashboard on Vercel, and improve normalization of postings the rule-based normalizer cannot parse by using an LLM as a fallback.

Governing knowledge:
- [Job collection and notification](../../product/job-collection.md) defines the Job schema and status values.
- [Dashboard and status management](../../product/dashboard-and-status.md) defines user interactions and filters.
- [Dashboard and LLM fallback architecture](../../decisions/2026-10-13-dashboard-and-llm-fallback.md) defines access control and LLM boundaries.

## Prerequisites

- Phase 2 complete and verified with automated test suites.
- Architecture and product decisions recorded in canonical docs.

## Out of scope

Multi-user accounts, any paid service beyond free tiers.

## Steps

1. **Product and decision docs**: Accepted dashboard behavior, single-user access control, and zero-cost LLM fallback policy recorded in canonical docs. Proof: `docs/decisions/2026-10-13-dashboard-and-llm-fallback.md` and `docs/product/dashboard-and-status.md`.
2. **LLM fallback**: `src/llm.ts` invoked only when rule-based parsing leaves fields null; validated with Zod (`llmExtractionSchema`); cap of 10 calls per run; failure resilience leaving fields null without failing runs. Proof: Vitest suite in `tests/llm.test.ts`.
3. **Dashboard read views**: Next.js App Router app (`dashboard/`) with rich aesthetics, dark theme, glassmorphism, and responsive layout. Supports status tabs, keyword search, city/level/remote filters, and match toggles. Proof: successful `next build`.
4. **Status updates**: `PATCH /api/jobs/[id]/status` route handler persisting status changes to Supabase or store, with optimistic UI updates.
5. **Access control**: Token and passkey authentication (`DASHBOARD_SECRET_KEY`) with HTTP-only cookies and unlock modal.
6. **Vercel deployment readiness**: Self-contained Next.js app in `dashboard/` with workspace scripts (`pnpm dashboard:dev`, `pnpm dashboard:build`).

## Validation evidence

- `pnpm test`: 15 test files, 63 tests passing (100% pass rate).
- `pnpm typecheck`: Root project TypeScript compiles with 0 errors.
- `pnpm --filter job-hunt-dashboard typecheck`: Dashboard TypeScript compiles with 0 errors.
- `pnpm --filter job-hunt-dashboard build`: Production Next.js build compiled successfully (static pages + dynamic API routes).

## Completion

Move to `docs/plans/completed/` after deploying to Vercel and verifying live status persistence against production Supabase.
