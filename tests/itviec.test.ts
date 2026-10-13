import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createITviecAdapter } from "../src/adapters/itviec.js";

const fixture = readFileSync("fixtures/itviec.sample.html", "utf8");
const now = new Date("2026-10-12T00:00:00.000Z");

function adapterWith(body: string, status = 200, calls: URL[] = []) {
  const fetchImpl = (async (url: URL | string) => {
    calls.push(new URL(url.toString()));
    return new Response(body, { status });
  }) as unknown as typeof fetch;
  return createITviecAdapter({ fetchImpl });
}

describe("itviec adapter", () => {
  it("requests ITviec URL with slugified keyword", async () => {
    const calls: URL[] = [];
    const adapter = adapterWith(fixture, 200, calls);
    await adapter.fetch({ keyword: "reactjs developer", location: "Ho Chi Minh City" });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.pathname).toBe("/it-jobs/reactjs-developer");
  });

  it("parses and normalizes jobs from HTML fixture", async () => {
    const adapter = adapterWith(fixture);
    const jobs = (await adapter.fetch({ keyword: "x", location: "y" })).map((r) => adapter.normalize(r, now));

    expect(jobs).toHaveLength(2);

    // Job 1: IncepIT
    expect(jobs[0]).toMatchObject({
      title: "Senior ReactJS Developer (TypeScript)",
      company: "IncepIT Vietnam",
      city: "Ho Chi Minh City",
      level: "senior",
      expMin: 3,
      salaryMin: 25000000,
      salaryMax: 40000000,
      currency: "VND",
      remote: "hybrid",
      status: "new",
    });
    expect(jobs[0]!.sources).toEqual([
      { site: "itviec", url: "https://itviec.com/it-jobs/senior-reactjs-developer-incepit-4351" },
    ]);
    expect(jobs[0]!.skills).toEqual(expect.arrayContaining(["react", "typescript"]));

    // Job 2: TechAsia
    expect(jobs[1]).toMatchObject({
      title: "Junior Frontend Developer",
      company: "TechAsia Corp",
      city: "Hanoi",
      level: "junior",
      expMin: 1,
      expMax: 2,
      negotiable: true,
      status: "new",
    });
    expect(jobs[1]!.sources).toEqual([
      { site: "itviec", url: "https://itviec.com/it-jobs/junior-frontend-techasia-1024" },
    ]);
  });

  it("handles HTTP errors", async () => {
    await expect(adapterWith("{}", 500).fetch({ keyword: "x", location: "y" })).rejects.toThrow(/ITviec HTTP 500/);
  });
});
