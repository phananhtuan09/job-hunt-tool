import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createJobSpyAdapter, type JobSpyRunner } from "../src/adapters/jobspy.js";

const fixture = readFileSync("fixtures/jobspy.sample.json", "utf8");
const now = new Date("2026-10-12T00:00:00.000Z");

describe("jobspy adapter", () => {
  it("passes correct arguments to runner", async () => {
    let capturedArgs: string[] = [];
    const runner: JobSpyRunner = async (args) => {
      capturedArgs = args;
      return { stdout: fixture };
    };

    const adapter = createJobSpyAdapter({
      sites: ["linkedin", "indeed"],
      postedWithinDays: 3,
      runner,
    });

    const raw = await adapter.fetch({ keyword: "frontend", location: "Ho Chi Minh City" });
    expect(capturedArgs).toEqual([
      "--site",
      "linkedin,indeed",
      "--search_term",
      "frontend",
      "--location",
      "Ho Chi Minh City",
      "--results_wanted",
      "10",
      "--hours_old",
      "72",
    ]);
    expect(raw).toHaveLength(2);
  });

  it("normalizes LinkedIn and Indeed jobs from fixture", async () => {
    const runner: JobSpyRunner = async () => ({ stdout: fixture });
    const adapter = createJobSpyAdapter({
      sites: ["linkedin", "indeed"],
      postedWithinDays: 3,
      runner,
    });

    const jobs = (await adapter.fetch({ keyword: "frontend", location: "Vietnam" })).map((r) =>
      adapter.normalize(r, now)
    );

    expect(jobs).toHaveLength(2);

    // Job 1: LinkedIn with monthly salary
    expect(jobs[0]).toMatchObject({
      title: "Senior Frontend Developer (React, Next.js)",
      company: "FPT Software",
      city: "Ho Chi Minh City",
      level: "senior",
      expMin: 3,
      salaryMin: 30000000,
      salaryMax: 45000000,
      currency: "VND",
      remote: "hybrid",
      status: "new",
    });
    expect(jobs[0]!.sources).toEqual([{ site: "linkedin", url: "https://www.linkedin.com/jobs/view/12345" }]);
    expect(jobs[0]!.skills).toEqual(expect.arrayContaining(["react", "next.js", "typescript"]));

    // Job 2: Indeed with remote: true
    expect(jobs[1]).toMatchObject({
      title: "Junior Fullstack Engineer",
      company: "VNG Corporation",
      city: "Hanoi",
      level: "junior",
      expMin: 1,
      remote: "remote",
      status: "new",
    });
    expect(jobs[1]!.sources).toEqual([{ site: "indeed", url: "https://vn.indeed.com/viewjob?jk=67890" }]);
  });

  it("handles runner execution error as caught exception", async () => {
    const failingRunner: JobSpyRunner = async () => {
      throw new Error("HTTP 429 Too Many Requests");
    };
    const adapter = createJobSpyAdapter({
      sites: ["linkedin"],
      postedWithinDays: 3,
      runner: failingRunner,
    });

    await expect(adapter.fetch({ keyword: "x", location: "y" })).rejects.toThrow(/JobSpy scrape failed: HTTP 429/);
  });

  it("handles and sanitizes NaN values in stdout gracefully", async () => {
    const rawWithNaN = `[{"title": "Dev", "company": "Tech Corp", "min_amount": NaN, "max_amount": NaN}]`;
    const runner: JobSpyRunner = async () => ({ stdout: rawWithNaN });
    const adapter = createJobSpyAdapter({
      sites: ["indeed"],
      postedWithinDays: 3,
      runner,
    });

    const raw = await adapter.fetch({ keyword: "dev", location: "Hanoi" });
    expect(raw).toHaveLength(1);
    expect(raw[0]!.min_amount).toBeNull();
  });
});
