// Shared working-tree fingerprint and per-session state for the coder hooks.
// Every helper fails open: callers treat a null result as "do not gate".

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) return null;
  return result.stdout;
}

function treeFingerprint(cwd) {
  if (!cwd || git(cwd, ["rev-parse", "--is-inside-work-tree"]) === null) return null;

  const status = git(cwd, ["status", "--porcelain=v1", "-uall"]);
  const unstaged = git(cwd, ["diff", "--no-ext-diff", "--binary"]);
  const staged = git(cwd, ["diff", "--no-ext-diff", "--binary", "--cached"]);
  if ([status, unstaged, staged].includes(null)) return null;

  const statusText = status.toString("utf8");
  if (statusText.trim() === "") return { clean: true, hash: "clean" };

  // Untracked files count by path only (status lists them), so a log that keeps
  // growing in the tree does not look like a new change on every stop.
  const hash = crypto.createHash("sha256");
  hash.update(statusText).update(unstaged).update(staged);

  return { clean: false, hash: hash.digest("hex") };
}

function statePath(sessionId) {
  const safeId = String(sessionId || "").replace(/[^A-Za-z0-9_-]/g, "_");
  if (!safeId) return null;
  return path.join(os.tmpdir(), "claude-coder-gate", safeId);
}

function readAccepted(sessionId) {
  const file = statePath(sessionId);
  if (!file) return null;
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch (_) {
    return null;
  }
}

function writeAccepted(sessionId, hash) {
  const file = statePath(sessionId);
  if (!file || !hash) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, hash);
  } catch (_) {
    // State is an optimization; without it the gate only asks for a handoff again.
  }
}

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

module.exports = { readAccepted, readStdinJson, treeFingerprint, writeAccepted };
