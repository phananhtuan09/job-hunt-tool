import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createJSearchAdapter, JSEARCH_MONTHLY_QUOTA } from "../src/adapters/jsearch.js";

const fixture = readFileSync("fixtures/jsearch.sample.json", "utf8");
const now = new Date("2026-10-12T00:00:00.000Z");

function adapterWith(body: string, status = 200, calls: { url: URL; headers: Record<string, string> }[] = []) {
  const fetchImpl = (async (url: URL, init?: RequestInit) => {
    calls.push({ url, headers: (init?.headers as Record<string, string>) ?? {} });
    return new Response(body, { status });
  }) as unknown as typeof fetch;
  return createJSearchAdapter({ apiKey: "rapid-key-test", postedWithinDays: 3, fetchImpl });
}

describe("jsearch adapter", () => {
  it("requests RapidAPI JSearch with proper headers and params", async () => {
    const calls: { url: URL; headers: Record<string, string> }[] = [];
    const adapter = adapterWith(fixture, 200, calls);
    expect(adapter.monthlyQuota).toBe(JSEARCH_MONTHLY_QUOTA);

    await adapter.fetch({ keyword: "frontend developer", location: "Ho Chi Minh City" });
    expect(calls).toHaveLength(1);
    const { url, headers } = calls[0]!;
    expect(url.hostname).toBe("jsearch.p.rapidapi.com");
    expect(url.searchParams.get("query")).toBe("frontend developer in Ho Chi Minh City");
    expect(url.searchParams.get("date_posted")).toBe("3days");
    expect(headers["X-RapidAPI-Key"]).toBe("rapid-key-test");
    expect(headers["X-RapidAPI-Host"]).toBe("jsearch.p.rapidapi.com");
  });

  it("normalizes the fixture", async () => {
    const adapter = adapterWith(fixture);
    const jobs = (await adapter.fetch({ keyword: "x", location: "y" })).map((r) => adapter.normalize(r, now));

    expect(jobs).toHaveLength(2);

    // Job 1: salary provided, experience in months
    expect(jobs[0]).toMatchObject({
      title: "Senior Frontend Engineer (React/TypeScript)",
      company: "Kite Metric Co",
      city: "Ho Chi Minh City",
      level: "senior",
      expMin: 4,
      salaryMin: 35000000,
      salaryMax: 50000000,
      currency: "VND",
      status: "new",
    });
    expect(jobs[0]!.sources).toEqual([{ site: "jsearch", url: "https://kitemetric.com/careers/senior-fe" }]);
    expect(jobs[0]!.skills).toEqual(expect.arrayContaining(["react", "typescript", "tailwind"]));

    // Job 2: null salary, remote true
    expect(jobs[1]).toMatchObject({
      title: "Junior Fullstack Developer",
      company: "VN Tech Labs",
      city: "Hanoi",
      level: "junior",
      expMin: 1,
      salaryMin: null,
      salaryMax: null,
      remote: "remote",
      status: "new",
    });
  });

  it("handles HTTP errors", async () => {
    await expect(adapterWith("{}", 429).fetch({ keyword: "x", location: "y" })).rejects.toThrow(/429/);
    await expect(adapterWith("{}", 500).fetch({ keyword: "x", location: "y" })).rejects.toThrow(/500/);
  });
});
