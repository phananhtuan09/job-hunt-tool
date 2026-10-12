import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_NOTIFICATIONS_PER_RUN, runPipeline, type PipelineDeps } from "../src/pipeline.js";
import { addQuotaUsed, readJobs, writeJobs } from "../src/store.js";
import type { Notifier } from "../src/telegram.js";
import type { Job, RawJob, SourceAdapter } from "../src/types.js";
import { testConfig, testJob } from "./helpers.js";

const now = new Date("2026-10-12T00:00:00.000Z");

function fakeAdapter(jobs: Job[], overrides: Partial<SourceAdapter> = {}): SourceAdapter {
  return {
    name: "fake",
    fetch: async () => jobs.map((j) => ({ ...j }) as unknown as RawJob),
    normalize: (raw) => raw as unknown as Job,
    ...overrides,
  };
}

function setup(adapter: SourceAdapter, notifier?: Partial<Notifier> | null) {
  const dir = mkdtempSync(join(tmpdir(), "pipe-"));
  const sent: string[] = [];
  const full: Notifier = {
    sendJob: async (j) => void sent.push(j.id),
    sendText: async (t) => void sent.push(t),
    ...notifier,
  };
  const deps: PipelineDeps = {
    adapters: [adapter], notifier: notifier === null ? null : full,
    jobsPath: join(dir, "jobs.csv"), quotaPath: join(dir, "quota.json"), now, delayMs: 0,
  };
  return { deps, sent };
}

const config = testConfig();

describe("runPipeline", () => {
  it("first run stores and notifies new matched jobs; the repeat run notifies nothing", async () => {
    const { deps, sent } = setup(fakeAdapter([testJob({ id: "a" }), testJob({ id: "b", level: "lead" })]));
    const first = await runPipeline(config, deps);
    expect(first).toMatchObject({ newJobs: 2, notified: 1 });
    expect(sent).toEqual(["a"]);
    expect(readJobs(deps.jobsPath).map((j) => [j.id, j.matched, j.status])).toEqual([["a", true, "new"], ["b", false, "new"]]);
    const second = await runPipeline(config, deps);
    expect(second).toMatchObject({ newJobs: 0, notified: 0 });
    expect(sent).toEqual(["a"]);
  });

  it("merges a repeated posting's sources without notifying or changing status", async () => {
    const { deps, sent } = setup(fakeAdapter([testJob({ id: "a" })]));
    await runPipeline(config, deps);
    const stored = readJobs(deps.jobsPath);
    stored[0]!.status = "rejected";
    writeJobs(deps.jobsPath, stored);
    deps.adapters = [fakeAdapter([testJob({ id: "a", sources: [{ site: "y", url: "https://y/1" }] })])];
    await runPipeline(config, deps);
    const [job] = readJobs(deps.jobsPath);
    expect(job!.sources.map((s) => s.url)).toEqual(["https://x/1", "https://y/1"]);
    expect(job!.status).toBe("rejected");
    expect(sent).toEqual(["a"]);
  });

  it("merges duplicates within one run into one job", async () => {
    const { deps, sent } = setup(fakeAdapter([testJob({ id: "a" }), testJob({ id: "a", sources: [{ site: "y", url: "https://y/1" }] })]));
    await runPipeline(config, deps);
    expect(readJobs(deps.jobsPath)).toHaveLength(1);
    expect(readJobs(deps.jobsPath)[0]!.sources).toHaveLength(2);
    expect(sent).toEqual(["a"]);
  });

  it("does not store a job whose notification failed so the next run retries it", async () => {
    const { deps } = setup(fakeAdapter([testJob({ id: "a" })]), { sendJob: async () => { throw new Error("down"); } });
    const result = await runPipeline(config, deps);
    expect(result.notifyFailed).toBe(true);
    expect(readJobs(deps.jobsPath)).toEqual([]);
  });

  it("caps notifications per run and leaves the rest for the next run", async () => {
    const jobs = Array.from({ length: MAX_NOTIFICATIONS_PER_RUN + 3 }, (_, i) => testJob({ id: `j${i}` }));
    const { deps, sent } = setup(fakeAdapter(jobs));
    const first = await runPipeline(config, deps);
    expect(first.notified).toBe(MAX_NOTIFICATIONS_PER_RUN);
    expect(sent.at(-1)).toMatch(/3 more/);
    expect(readJobs(deps.jobsPath)).toHaveLength(MAX_NOTIFICATIONS_PER_RUN);
    const second = await runPipeline(config, deps);
    expect(second.notified).toBe(3);
  });

  it("stores everything without notifying when Telegram is disabled", async () => {
    const { deps, sent } = setup(fakeAdapter([testJob({ id: "a" })]), null);
    await runPipeline(config, deps);
    expect(sent).toEqual([]);
    expect(readJobs(deps.jobsPath)).toHaveLength(1);
  });

  it("keeps going when one query fails and throws when every query fails", async () => {
    let calls = 0;
    const flaky = fakeAdapter([testJob({ id: "a" })], { fetch: async () => { if (calls++ === 0) throw new Error("429"); return [testJob({ id: "a" }) as unknown as RawJob]; } });
    const { deps } = setup(flaky);
    const result = await runPipeline(testConfig(), deps);
    expect(result).toMatchObject({ failedQueries: 1, newJobs: 1 });
    const broken = setup(fakeAdapter([], { fetch: async () => { throw new Error("blocked"); } }));
    await expect(runPipeline(config, broken.deps)).rejects.toThrow(/All source queries failed/);
  });

  it("skips a source whose monthly quota is used up", async () => {
    let fetched = 0;
    const { deps } = setup(fakeAdapter([], { monthlyQuota: 1, fetch: async () => { fetched++; return []; } }));
    addQuotaUsed(deps.quotaPath, "fake", now);
    await runPipeline(config, deps);
    expect(fetched).toBe(0);
  });
});
