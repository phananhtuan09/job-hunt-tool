# Coder hook scripts

These scripts are Claude Code hooks, not tools for the `coder` skill to call.
`SKILL.md` is the contract; the hooks are what load it into a session and enforce the handoff.
Without the hooks in `settings.json`, the coder does nothing.

| Script | Hook event | Purpose |
| --- | --- | --- |
| `session-start.cjs` | `SessionStart` | Injects the `SKILL.md` contract after startup, resume, clear, and compact, and records the starting working tree. |
| `stop-gate.cjs` | `Stop` | Blocks once when the tree changed and the final message has no handoff or JSON report. |
| `gate-state.cjs` | none | Shared helper for the two scripts above. |

Both hooks fail open, so a broken hook never traps or blocks a session.

## Automatic setup

`npx ai-workflow-init --kit coding-standard --tool claude --bundle coder-agent` installs the scripts under `.claude/.claude/skills/coder/scripts/`.
When the project has no `.claude/settings.json`, the installer writes it with these hooks.
When the project already has one, the installer leaves it untouched and prints the hooks to merge.
In that case follow the manual setup below.

## Manual setup (project scope)

The scripts must exist at `.claude/.claude/skills/coder/scripts/` in the project, and `node` must be on `PATH`.
The hooks to add are:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/.claude/skills/coder/scripts/session-start.cjs\"" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/.claude/skills/coder/scripts/stop-gate.cjs\"" }]
      }
    ]
  }
}
```

## Keep the existing settings intact

Never replace `.claude/settings.json` with the snippet above.
Merge it, so every existing key stays exactly as it is.

- Put the coder hooks in `.claude/settings.local.json` instead when you do not want to change the committed settings file.
  Claude Code merges it with `settings.json`, and it is normally gitignored, so only your machine gets the coder.
- If `hooks` already exists, add the new entries to the existing `SessionStart` and `Stop` arrays.
  Do not overwrite those arrays, because that removes the project's own hooks.
  Hooks from several entries all run.
- Do not add the entries twice.
  A duplicate makes the contract inject twice.
- Back up the file before editing, and review `git diff .claude/settings.json` afterwards.
  Only the added hook entries should show as changes.

To merge with `jq` without touching any other key (requires `jq`; write to a temp file first):

```bash
jq '.hooks.SessionStart += [{"matcher":"startup|resume|clear|compact","hooks":[{"type":"command","command":"node \"$CLAUDE_PROJECT_DIR/.claude/.claude/skills/coder/scripts/session-start.cjs\""}]}]
  | .hooks.Stop += [{"hooks":[{"type":"command","command":"node \"$CLAUDE_PROJECT_DIR/.claude/.claude/skills/coder/scripts/stop-gate.cjs\""}]}]' \
  .claude/settings.json > .claude/settings.json.new \
  && mv .claude/settings.json.new .claude/settings.json
```

## Verify

1. Open the project in Claude Code, accept the workspace trust dialog, and run `/hooks`.
   `SessionStart` and `Stop` should list the two commands.
   Project hooks are ignored in an untrusted workspace.
2. Start a new session and ask for a small change.
   The final message should start with `Status:` unless the assigning prompt set another report format.

## Remove

Delete the two hook entries from the settings file you edited.
Leave every other key as it is.
