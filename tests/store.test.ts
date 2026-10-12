import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addQuotaUsed, quotaUsed, readJobs, writeJobs } from "../src/store.js";
import { testJob } from "./helpers.js";

const dir = () => mkdtempSync(join(tmpdir(), "jobs-"));

describe("store", () => {
  it("round-trips jobs through CSV including commas, quotes, newlines and nulls", () => {
    const path = join(dir(), "data", "jobs.csv");
    const job = testJob({
      description: 'Line1, "quoted"\nLine2', skills: ["react", "css"], salaryMax: 2000, currency: "USD", matched: true,
      sources: [{ site: "a", url: "https://a/1" }, { site: "b", url: "https://b/2" }],
    });
    writeJobs(path, [job, testJob({ id: "id2" })]);
    const back = readJobs(path);
    expect(back[0]).toEqual(job);
    expect(back[1]!.salaryMax).toBeNull();
  });
  it("returns no jobs when the file is missing", () => {
    expect(readJobs(join(dir(), "none.csv"))).toEqual([]);
  });
  it("tracks quota per month", () => {
    const path = join(dir(), "quota.json");
    addQuotaUsed(path, "serpapi", new Date("2026-10-12"));
    addQuotaUsed(path, "serpapi", new Date("2026-10-13"));
    expect(quotaUsed(path, "serpapi", new Date("2026-10-20"))).toBe(2);
    expect(quotaUsed(path, "serpapi", new Date("2026-11-01"))).toBe(0);
  });
});
