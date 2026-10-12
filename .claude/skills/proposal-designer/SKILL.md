---
name: proposal-designer
description: Turn a vague product or feature idea into a reviewable proposal in docs/proposals, or review, revise, compare alternatives, and finalize an existing proposal before human approval. Use for decisions that need product framing and high-level feasibility, not for ordinary bounded implementation work.
---

# Proposal Designer

Shape an idea into `docs/proposals/<topic>/proposal.md` so a human can decide whether to pursue it and which direction to take.
The proposal covers product intent and high-level technical feasibility.
Do not produce implementation tasks, API designs, schemas, class layouts, file structures, or code.
This skill is optional and does not make a proposal a prerequisite for normal repository work.

## Repository boundary

Read `AGENTS.md`, the relevant parts of `docs/WORKFLOW.md`, and `docs/proposals/README.md` before writing a proposal.
Inspect the smallest relevant product rules, decisions, code, and existing behavior.
Treat an unapproved proposal as a candidate, not accepted repository intent.
Surface conflicts with accepted intent instead of silently replacing it.
After approval, hand accepted long-lived product rules or decisions to their existing namespaces when the current task authorizes that work; the proposal does not replace `docs/product/` or `docs/decisions/`.

Use one topic directory and one `proposal.md` per proposal.
Keep research findings, review feedback, alternatives, and human decisions in that file when they materially affect the proposal.
Do not create companion review, research, decision, or task files for this capability.
Follow the local namespace contract for naming, status, and content.

## Choose the operation

- **Create:** Start with the human's idea, even if it is only one sentence.
  Investigate the problem, users, existing behavior, constraints, and feasible directions.
  Research uncertain external claims when material.
  Ask only for unresolved decisions that change the proposal materially.
  Write a draft using supported facts and clearly marked assumptions.
- **Review:** Start a fresh, independent sub-agent without conversation history when the runtime supports it.
  Give it only the complete `proposal.md` and the fixed criteria below.
  Do not pass prior conversation, author reasoning, intended answers, or extra explanations.
  The reviewer does not edit the file or redesign the proposal.
  Return findings to the author and human as advisory feedback.
  If a fresh isolated sub-agent is unavailable, report that independent review could not be performed; do not present a self-review as independent.
- **Revise:** Update the same file from human feedback, new research, or review findings.
  Resolve supported issues, preserve still-valid decisions, and leave unresolved material choices explicit.
  A substantive change to an Approved proposal returns it to Draft until the human approves the changed version.
- **Compare:** Investigate a small set of realistic alternatives in the current proposal.
  Explain how each meets the goal, its meaningful trade-offs, evidence, and limitations.
  Recommend a direction when one is clearly stronger.
  Ask the human to choose only when the remaining options differ materially in product, security, compatibility, cost, or operations.
- **Finalize:** Remove stale alternatives and resolved questions from the main recommendation, check that the proposed behavior and feasibility claims are coherent and sourced, and mark the document Ready for Approval.
  Do this before the final human decision.
  Mark Approved only after the human explicitly approves that version; approval of an earlier version does not transfer to a substantively changed one.

Operations are entry points, not a required sequence.
Create may include comparison or revision when useful.
Run independent review when requested or when its findings would materially improve a consequential proposal; if review is invoked, preserve the independence rule above.
Reviewer feedback is advisory, and the human has final authority over approval.

## Research and questions

Investigate uncertainty that affects feasibility or the recommendation, including available solutions, third-party limits, platform constraints, and simpler approaches.
Use current primary sources when external facts may have changed.
Record consequential findings with source links or repository paths, relevant versions or dates, and distinguish evidence from inference.
Do not imply a library, service, or approach is feasible solely because it exists.
Do not research or compare options that would not change the decision.

Ask focused questions in one batch only after available evidence has narrowed the choices.
Present the recommended option and the concrete trade-offs when the human must decide.
Do not ask the human to supply a full requirement document before beginning.
If a blocking decision remains unanswered, keep the proposal Draft and state the open decision; do not invent approval.

## Fixed independent review criteria

Give the reviewer the complete proposal and exactly these criteria as its substantive review input:

1. **Problem:** Does the proposal address a specific, credible user problem and goal?
2. **Scope:** Are the included and excluded behaviors coherent and proportionate?
3. **User flow:** Are the main behavior, failure paths, and decision points understandable and consistent?
4. **Solution:** Does the recommended direction plausibly achieve the stated goal?
5. **Feasibility:** Are the high-level technical claims supported, and are material constraints or unknowns visible?
6. **Alternatives:** Is an obvious simpler or better direction missing or dismissed without reason?
7. **Risks and assumptions:** Could an untested assumption or unresolved decision change the recommendation?

The reviewer should report only concrete findings with the affected proposal section, why each matters, and a severity of blocking or advisory.
It may say that no material issue was found, but must not claim to have verified sources or runtime behavior it could not access.
Its assessment never approves the proposal.

## Handoff

Report the proposal path, current status, recommendation, material open decisions, sources or checks actually used, and any independent review limitation.
Do not start planning or implementation from this skill.
