import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSerpApiAdapter } from "../src/adapters/serpapi.js";

const fixture = readFileSync("fixtures/serpapi-google-jobs.sample.json", "utf8");
const now = new Date("2026-10-12T00:00:00.000Z");

function adapterWith(body: string, status = 200, calls: URL[] = []) {
  const fetchImpl = (async (url: URL) => {
    calls.push(url);
    return new Response(body, { status });
  }) as unknown as typeof fetch;
  return createSerpApiAdapter({ apiKey: "k", postedWithinDays: 3, fetchImpl });
}

describe("serpapi adapter", () => {
  it("requests Google Jobs for Vietnam, page 1, recent postings", async () => {
    const calls: URL[] = [];
    await adapterWith(fixture, 200, calls).fetch({ keyword: "reactjs", location: "Hanoi" });
    const q = calls[0]!.searchParams;
    expect([q.get("engine"), q.get("gl"), q.get("hl"), q.get("chips"), q.get("start")]).toEqual(["google_jobs", "vn", "vi", "date_posted:3days", null]);
  });

  it("normalizes the fixture", async () => {
    const adapter = adapterWith(fixture);
    const jobs = (await adapter.fetch({ keyword: "x", location: "y" })).map((r) => adapter.normalize(r, now));
    expect(jobs).toHaveLength(6);
    expect(jobs[0]).toMatchObject({
      city: "Ho Chi Minh City", level: "senior", expMin: 3, salaryMin: 25e6, salaryMax: 35e6, currency: "VND",
      remote: "hybrid", postedAt: "2026-10-10T00:00:00.000Z", status: "new",
    });
    expect(jobs[0]!.sources).toEqual([{ site: "LinkedIn", url: "https://example.com/linkedin/acme-senior-fe" }]);
    expect(jobs[0]!.skills).toEqual(expect.arrayContaining(["react", "typescript"]));
    expect(jobs[0]!.id).toBe(jobs[1]!.id);
    expect(jobs[2]).toMatchObject({ negotiable: true, expMin: 2, expMax: 4 });
    expect(jobs[3]).toMatchObject({ salaryMax: 2000, currency: "USD", remote: "remote" });
  });

  it("treats 'no results' as empty and other errors as failures", async () => {
    const none = adapterWith(JSON.stringify({ error: "Google hasn't returned any results for this query." }));
    expect(await none.fetch({ keyword: "x", location: "y" })).toEqual([]);
    await expect(adapterWith("{}", 429).fetch({ keyword: "x", location: "y" })).rejects.toThrow(/429/);
    await expect(adapterWith(JSON.stringify({ error: "Invalid API key" })).fetch({ keyword: "x", location: "y" })).rejects.toThrow(/Invalid/);
  });
});
