#!/usr/bin/env node
// SessionStart hook: injects the coder contract and records the starting tree,
// so pre-existing uncommitted changes never trigger the Stop gate.

const fs = require("fs");
const path = require("path");
const { readStdinJson, treeFingerprint, writeAccepted } = require("./gate-state.cjs");

function contractBody() {
  const skill = fs.readFileSync(path.join(__dirname, "..", "SKILL.md"), "utf8");
  return skill.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();
}

try {
  const input = readStdinJson();
  const fingerprint = treeFingerprint(input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
  if (fingerprint) writeAccepted(input.session_id, fingerprint.hash);

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: contractBody(),
      },
    })
  );
} catch (_) {
  // Fail open: a broken hook must never prevent the session from starting.
}
