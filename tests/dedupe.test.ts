import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { jobId, normalizeCompany, normalizeJobTitle } from "../src/normalize.js";
import { runPipeline } from "../src/pipeline.js";
import { readJobs } from "../src/store.js";
import type { RawJob, SourceAdapter, SourceQuery } from "../src/types.js";
import { testConfig } from "./helpers.js";

describe("cross-source dedupe and normalization", () => {
  it("normalizes Vietnamese company prefixes and corporate suffixes", () => {
    expect(normalizeCompany("CÔNG TY TNHH SoftFlex LLC")).toBe("softflex");
    expect(normalizeCompany("SoftFlex Co., Ltd.")).toBe("softflex");
    expect(normalizeCompany("Cty Cổ Phần VNG Corporation")).toBe("vng");
    expect(normalizeCompany("VNG")).toBe("vng");
  });

  it("yields identical job IDs across near-miss company variations", () => {
    const id1 = jobId("CÔNG TY TNHH SoftFlex LLC", "Senior React Developer", "Hanoi");
    const id2 = jobId("SoftFlex Co., Ltd", "Senior React Developer (Urgent)", "Hà Nội");
    expect(id1).toBe(id2);
  });

  describe("pipeline deduplication across multiple sources", () => {
    let dir: string;
    let jobsPath: string;
    let quotaPath: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), "hunt-dedupe-"));
      jobsPath = join(dir, "jobs.csv");
      quotaPath = join(dir, "quota.json");
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it("merges the same job from two different sources into one record with both sources", async () => {
      const adapterA: SourceAdapter = {
        name: "sourceA",
        async fetch(_query: SourceQuery): Promise<RawJob[]> {
          return [{ title: "Frontend Developer", company: "CÔNG TY TNHH SoftFlex LLC", city: "Hanoi" }];
        },
        normalize(raw, now = new Date()) {
          return {
            id: jobId(raw.company as string, raw.title as string, raw.city as string),
            title: raw.title as string,
            company: raw.company as string,
            city: raw.city as string,
            level: "middle",
            expMin: 2,
            expMax: 4,
            salaryMin: 25e6,
            salaryMax: 35e6,
            currency: "VND",
            negotiable: false,
            remote: null,
            skills: ["react"],
            sources: [{ site: "sourceA", url: "https://source-a.com/job/1" }],
            description: "Some description",
            postedAt: now.toISOString(),
            firstSeenAt: now.toISOString(),
            matched: true,
            status: "new",
          };
        },
      };

      const adapterB: SourceAdapter = {
        name: "sourceB",
        async fetch(_query: SourceQuery): Promise<RawJob[]> {
          return [{ title: "Frontend Developer", company: "SoftFlex", city: "Hà Nội" }];
        },
        normalize(raw, now = new Date()) {
          return {
            id: jobId(raw.company as string, raw.title as string, raw.city as string),
            title: raw.title as string,
            company: raw.company as string,
            city: "Hanoi",
            level: "middle",
            expMin: 2,
            expMax: 4,
            salaryMin: 25e6,
            salaryMax: 35e6,
            currency: "VND",
            negotiable: false,
            remote: null,
            skills: ["react"],
            sources: [{ site: "sourceB", url: "https://source-b.com/job/2" }],
            description: "Some description B",
            postedAt: now.toISOString(),
            firstSeenAt: now.toISOString(),
            matched: true,
            status: "new",
          };
        },
      };

      const config = testConfig({
        keywords: ["frontend developer"],
        locations: ["Hanoi"],
      });

      const result = await runPipeline(config, {
        adapters: [adapterA, adapterB],
        notifier: null,
        jobsPath,
        quotaPath,
        delayMs: 0,
      });

      expect(result.fetched).toBe(2);
      expect(result.newJobs).toBe(1);

      const stored = readJobs(jobsPath);
      expect(stored).toHaveLength(1);
      expect(stored[0]!.sources).toEqual([
        { site: "sourceA", url: "https://source-a.com/job/1" },
        { site: "sourceB", url: "https://source-b.com/job/2" },
      ]);
    });
  });
});
