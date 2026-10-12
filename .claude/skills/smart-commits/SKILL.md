---
name: smart-commits
description: Use when the user asks to commit existing work, group or clean up changes into logical commits, or push a finished change set. Organizes the current working tree into intent-based commits with repository-appropriate proof, without editing product code. Do not use for implementing or fixing anything, and do not use to rewrite already-published history.
---

# Smart Commits

Turn the current working tree into one or more coherent commits that each describe a single product intent.
This skill commits work that already exists; it must never become an editing session.
Follow repository authority and reuse the repository's own validation commands.
Do not create a durable plan or workflow artifact for this work.

## Inputs

- Optional: the scope of the current task, such as the feature, bug, or paths the commits should cover
- Optional: an explicit boundary, such as paths or topics to leave untouched
- Optional: explicit authorization to push without a further confirmation

## Tool Mapping

- Shell tools -> run read-only `git` inspection first, then staging and commit commands one group at a time
- File inspection tools -> read representative diffs and files to establish intent before grouping
- Search tools -> trace whether a changed symbol belongs to the same behavior as another changed file
- User clarification -> ask when an uncommitted change cannot be attributed to a known intent, or when the push destination is ambiguous

## Boundaries

- Never edit product code, tests, or docs to make a commit easier or to make a check pass.
- Treat every change you did not make as intentional work by another contributor or agent.
- Respect an explicit boundary from the user; do not stage a path they asked you to leave alone.
- Stage exact files or hunks; avoid `git add .` unless the whole tree has been inspected and belongs to one group.

### Confirm before a destructive or history-changing command

Do not reach for `stash`, `reset`, `checkout`, `restore`, `clean`, `revert`, `commit --amend`, `rebase`, or a force push as a way to work around uncommitted changes.
Grouping and committing never require them.

When one is genuinely the right action, ask first and state which changes or commits it would discard, then run it only after the user agrees.
Rewriting a commit that already exists on a remote branch also rewrites it for everyone tracking that branch; say so when proposing it.

This is a confirmation step, not a capability limit.
Enforce a permanent block through the runtime's own permission settings when you want one.

## Workflow

### 1. Establish scope before touching anything

Run read-only inspection first:

```bash
git status --porcelain=v1
git branch --show-current
git remote -v
git diff --stat
git diff --cached --stat
```

Determine which changes belong to the current task.
Use the user's stated scope when given; otherwise derive it from the work performed in this session.

**When other agents may be working in the same repository concurrently**, list the in-scope paths explicitly before staging anything, and treat every path outside that list as another agent's work.
Report those out-of-scope changes in the final summary instead of committing them.
Commit them only when the user confirms they are also yours.

### 2. Read the diffs to establish intent

Inspect staged, unstaged, untracked, deleted, and renamed entries.
Read enough of each diff to name the behavior it changes.
Do not infer intent from file paths or extensions alone.

If a changed file has no identifiable intent, treat it as out of scope and ask rather than guessing a message for it.

### 3. Group by product intent

Group changes by the behavior they produce, not by file type.

| Rule | Reason |
|------|--------|
| Foundational and configuration changes commit before the feature that depends on them | Each commit stays buildable in isolation |
| Source and its directly coupled tests commit together | They prove one behavior |
| A pure refactor commits separately from behavior changes | Reviewers can verify parity independently |
| Docs commit separately only when independently meaningful | Otherwise they belong with the change they describe |
| Generated artifacts commit only when part of the requested deliverable | Avoids noise and spurious conflicts |

### 4. Prove before committing

Choose the cheapest reliable proof for the changed behavior, following `docs/WORKFLOW.md`.
Prefer the repository's own focused commands over a full repository-wide suite.

- Behavior change in code -> run the focused test or check that observes it
- Configuration or dependency change -> run the command that proves the project still builds or resolves
- Docs-only change -> no code proof is required; state that explicitly

If a check fails, stop.
Report the failure and keep the working tree intact.
Do not modify code to make the check pass unless the user explicitly asks for a fix, which is separate work.

If a check is unavailable, already known broken, or disproportionately expensive, say so in the final summary rather than silently skipping it.

### 5. Commit one group at a time

```bash
git add <specific files>
git commit -m "<type>(<scope>): <subject>" -m "<body>"
```

Use conventional commit messages.
Write a body that explains why the group belongs together when the subject alone does not make that clear.

After each commit, re-run `git status --porcelain=v1` and continue until every in-scope change is committed.

### 6. Confirm before pushing

Pushing publishes work outside the local repository.
Report the commit stack and ask before pushing, unless the user already authorized a push in this task.

When authorized and an upstream exists:

```bash
git push
```

Use `git push -u origin <branch>` only when the branch lacks an upstream and both the remote and branch name are clearly correct.
If no push destination exists, leave the commits local and say so.

### 7. Report

Report the commits created in order, the proof actually run, the push result or the fact that a push is pending confirmation, and any change left uncommitted with the reason.

If the tree is already clean when invoked, verify the latest relevant commit and state that no new commit was needed.

## Grouping Examples

Good:

1. `chore(deps): add mail transport dependency`
2. `refactor(auth): extract token validation helper`
3. `feat(users): add email verification endpoint`
4. `docs: clarify local setup steps`

Bad:

1. `chore: update files`
2. `docs: update docs and app code`
3. `test: update tests` when the tests prove unrelated features

## When To Ask The User

Ask only when:
- A changed file cannot be attributed to any known intent
- The working tree contains changes that may belong to another agent or contributor
- A push destination is ambiguous, or the branch has no upstream and the correct remote is unclear
- A validation failure blocks committing and the user has not authorized a fix
- A destructive or history-changing command appears necessary, including one that would rewrite a commit already on a remote branch

## Quality Bar

- Every commit leaves the repository in a state that still builds
- No commit mixes unrelated intents
- No file outside the confirmed scope is staged
- Proof claims name the command that was actually run
- Failures and skipped checks are reported, never implied as passing

## Attribution

Adapted from the `smart-commits` skill in the MIT-licensed [`hoangnb24/skills`](https://github.com/hoangnb24/skills) Khuym plugin.
Scope control, proof selection, and push confirmation follow this repository's protocol.
