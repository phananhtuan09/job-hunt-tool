import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSerpApiAdapter } from "../src/adapters/serpapi.js";
import { runPipeline } from "../src/pipeline.js";
import { readJobs } from "../src/store.js";
import { testConfig } from "./helpers.js";

describe("MVP flow with the SerpApi fixture", () => {
  it("fetches, matches, dedupes, stores to CSV and notifies once", async () => {
    const body = readFileSync("fixtures/serpapi-google-jobs.sample.json", "utf8");
    const fetchImpl = (async () => new Response(body)) as unknown as typeof fetch;
    const adapter = createSerpApiAdapter({ apiKey: "k", postedWithinDays: 3, fetchImpl });
    const dir = mkdtempSync(join(tmpdir(), "mvp-"));
    const sent: string[] = [];
    const deps = {
      adapters: [adapter],
      notifier: { sendJob: async (j: { company: string }) => void sent.push(j.company), sendText: async () => {} },
      jobsPath: join(dir, "jobs.csv"),
      quotaPath: join(dir, "quota.json"),
      now: new Date("2026-10-12T00:00:00.000Z"),
      delayMs: 0,
    };
    const config = testConfig({ locations: ["Ho Chi Minh City"] });

    const first = await runPipeline(config, deps);
    expect(first).toMatchObject({ fetched: 6, newJobs: 5, notified: 2 });
    // Acme (merged from LinkedIn + TopCV) and Initech match; Globex is Hanoi, LowPay is under the salary, Stale is 21 days old.
    expect(sent.sort()).toEqual(["Acme Vietnam", "Initech"]);
    const stored = readJobs(deps.jobsPath);
    expect(stored.find((j) => j.company === "Acme Vietnam")!.sources).toHaveLength(2);
    expect(stored.filter((j) => j.matched)).toHaveLength(2);

    expect(await runPipeline(config, deps)).toMatchObject({ newJobs: 0, notified: 0 });
  });
});
