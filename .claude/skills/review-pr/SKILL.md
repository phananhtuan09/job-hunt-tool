---
name: review-pr
description: Review a pull request, branch, commit range, or working-tree diff against relevant repository authority and affected behavior. Report only evidence-backed merge-blocking defects or material decisions, without modifying the reviewed change.
---

# Review PR

Review a proposed change as repository-driven read-only work.

Inspect the change directly and report a small number of concrete issues that matter before merge.
Do not turn the review into a broad audit, a style critique, or an implementation session.

## Boundaries

Do not modify reviewed code, tests, schemas, configuration, requirements, plans, or evidence.
Run validation in non-fixing mode and do not invoke formatters, generators, migrations, or commands that intentionally rewrite the workspace.
Return the review in the conversation unless the caller explicitly supplies an output path.
When an output path is supplied, write only the requested review artifact.

## Determine The Change Set

Prefer the target and base supplied by the user.
A review target may be a PR URL or number, refs, a commit range, the current branch relative to its merge base, or a staged, unstaged, or working-tree diff.

If no target is supplied, infer the most reasonable local change set and state the inference.
Ask one focused question only when multiple materially different change sets remain plausible after inspection.
Use `Không thể đánh giá` only when no reliable change set can be determined or inspected.

## Establish The Review Basis

Follow applicable repository instructions and inspect the smallest authoritative surface needed to judge the affected behavior.
Keep these sources distinct:

- The current explicit human request is immediate intent authority for the requested delta.
- Relevant approved product or domain rules define durable intended behavior.
- Relevant architecture, security, and compatibility decisions constrain the implementation.
- Code, tests, schemas, configuration, and runtime output are current-state evidence.
- Active plans are work memory and do not override intent authority.

Use supplied PR descriptions, issues, acceptance criteria, design notes, risk areas, and verification evidence when relevant.
Do not trust an author or implementer summary in place of inspecting the diff and underlying evidence.

When intended-behavior sources conflict and the current request does not resolve the conflict, identify the smallest material decision needed.
Missing context by itself is not a defect or a decision blocker.
When the diff can still be reviewed, infer only its apparent purpose and record the unverified business-rule scope as a limitation.
Do not invent product rules or claim that unspecified behavior is wrong.

## Review The Affected Behavior

Summarize the apparent outcome of the change in one or two sentences.
Trace the changed behavior through its relevant callers, consumers, contracts, schemas, configuration, and failure paths.
Choose review concerns from the surfaces the change actually affects rather than applying a fixed checklist.

Look for concrete problems such as:

- behavior that contradicts applicable intent authority or a named acceptance criterion
- an incorrect condition, return value, state transition, lifecycle, or error outcome on a changed path
- a reachable null, type, exception, cleanup, transaction, or state-restoration failure introduced or exposed by the change
- an incomplete cross-file update to a caller, consumer, API contract, schema, serialization path, migration, route, dependency, export, or configuration value
- a technical assumption contradicted by local code, installed types, tests, or authoritative documentation
- an unauthorized trust-boundary bypass, unsafe data mutation, secret exposure, or demonstrable loss of existing data
- proof that does not observe the behavior it claims to verify, or a test weakened so it can pass while the changed behavior is broken
- unrelated behavior added outside the authorized change, or durable authority left inconsistent by an accepted durable behavior change

Check performance, concurrency, idempotency, retry behavior, timezone handling, accessibility, UX, observability, deployment, rollback, or maintainability only when the request or authority makes it relevant, or the diff directly changes it and a concrete defect can be demonstrated.

Do not report style preferences, speculative future risks, optional refactors, generic best-practice advice, or missing tests by themselves.
Do not widen the review into unrelated pre-existing code.
Report a pre-existing problem only when the proposed change makes it newly reachable, materially worse, or directly claims to resolve it but does not.

## Validate Concerns

Use repository search and surrounding code to prove or disprove suspected defects.
Choose the cheapest reliable proof for the affected behavior:

- focused unit proof for pure local logic
- integration proof for boundaries and contracts
- runtime or browser proof for externally visible behavior
- measurement for performance claims
- dry-run or recovery evidence for migration and recovery-sensitive behavior

Lint, type checks, builds, and broad suites may supplement focused proof but do not replace it.
Run only checks that materially improve confidence in a concrete concern or the reviewed outcome.
Record commands actually run and distinguish observed evidence from checks that remain unavailable or require human judgment.

## Finding Bar

Report a defect only when all of the following can be stated:

- the exact changed or affected location
- the concrete input, state, or path that triggers the problem
- the incorrect observable outcome
- supporting evidence from authority, code, repository search, types, documentation, or command output
- the condition required to correct the problem

If the trigger, outcome, or evidence cannot be stated concretely, record the uncertainty as a limitation rather than a finding.
Do not convert uncertainty into a defect.

Use `Cần sửa` only for a defect established by direct evidence or a complete static reasoning chain.
Use `Cần quyết định` only when conflicting or missing authority leaves materially different product, security, compatibility, or operational outcomes unresolved.

## Status

Choose one status using this precedence:

- `Không thể đánh giá`: the change set cannot be reliably determined or inspected.
- `Chưa thể merge — cần sửa`: one or more `Cần sửa` findings remain.
- `Chưa thể kết luận — cần quyết định`: no established defect takes precedence, but a material `Cần quyết định` remains.
- `Có thể merge`: no defect or unresolved decision met the reporting bar within the reviewed scope.

`Có thể merge` reports only the result of the inspected scope and observed evidence; it does not prove the absence of defects or replace human PR approval.

## Output

Always write the review response in Vietnamese, including headings, status, findings, and any review artifact written to a supplied output path.
Preserve identifiers, paths, commands, and quoted source text in their original form when needed for traceability.
Start with a brief summary and merge status, then present findings ordered by impact.
Use concise bullet points; include the location, trigger, outcome, evidence, and required correction for each finding without repeating context.
Omit empty sections other than `Phát hiện`.

```markdown
# Review PR — {target}

## Tóm tắt
- Thay đổi: {mục đích chính, một câu}.
- Trạng thái: **Có thể merge | Chưa thể merge — cần sửa | Chưa thể kết luận — cần quyết định | Không thể đánh giá**.
- Lý do: {kết luận ngắn, nêu số lỗi cần sửa hoặc quyết định còn thiếu nếu có}.

## Phát hiện
- PR-01 — `Cần sửa`: {vị trí}; {điều kiện gây lỗi} → {hậu quả}. Bằng chứng: {mã nguồn hoặc kết quả kiểm tra}. Cần sửa: {điều kiện để khắc phục}.

## Cần quyết định
- PR-02: {quy tắc hoặc ý định còn thiếu/mâu thuẫn}; {các lựa chọn ảnh hưởng đến quyết định merge}.

## Phạm vi và kiểm tra
- So sánh: {target} với {base}; căn cứ: {nguồn yêu cầu liên quan}.
- Đã kiểm tra: {bằng chứng và lệnh đã chạy, nếu có}.
- Giới hạn: {phần chưa thể kiểm chứng có ảnh hưởng đến kết luận, nếu có}.
```

If no findings exist, write `Không phát hiện lỗi cần sửa trong phạm vi đã review.` under `Phát hiện`.
When explicit requirements are absent, briefly note that business-rule completeness was not verified; this limitation alone does not prevent `Có thể merge`.
Do not add non-blocking suggestions unless the user explicitly requests them.
