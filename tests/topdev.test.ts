import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTopDevAdapter } from "../src/adapters/topdev.js";

const fixture = readFileSync("fixtures/topdev.sample.json", "utf8");
const now = new Date("2026-10-12T00:00:00.000Z");

function adapterWith(body: string, status = 200, calls: URL[] = []) {
  const fetchImpl = (async (url: URL | string) => {
    calls.push(new URL(url.toString()));
    return new Response(body, { status });
  }) as unknown as typeof fetch;
  return createTopDevAdapter({ fetchImpl });
}

describe("topdev adapter", () => {
  it("requests TopDev internal JSON API with query params", async () => {
    const calls: URL[] = [];
    const adapter = adapterWith(fixture, 200, calls);
    await adapter.fetch({ keyword: "react", location: "Hanoi" });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.hostname).toBe("api.topdev.vn");
    expect(calls[0]!.pathname).toBe("/td/v2/jobs");
    expect(calls[0]!.searchParams.get("keyword")).toBe("react");
    expect(calls[0]!.searchParams.get("fields[job]")).toContain("title");
  });

  it("normalizes jobs from TopDev fixture", async () => {
    const adapter = adapterWith(fixture);
    const jobs = (await adapter.fetch({ keyword: "x", location: "y" })).map((r) => adapter.normalize(r, now));

    expect(jobs).toHaveLength(2);

    // Job 1: SoftFlex with salary min/max
    expect(jobs[0]).toMatchObject({
      title: "Full Stack Developer (NodeJS/ReactJS)",
      company: "SoftFlex LLC",
      city: "Hanoi",
      salaryMin: 20000000,
      salaryMax: 35000000,
      currency: "VND",
      expMin: 2,
      expMax: 4,
      remote: "remote",
      status: "new",
    });
    expect(jobs[0]!.sources).toEqual([
      { site: "topdev", url: "https://topdev.vn/detail-jobs/full-stack-developer-nodejs-reactjs-softflex-2138283" },
    ]);
    expect(jobs[0]!.skills).toEqual(expect.arrayContaining(["nodejs", "reactjs", "typescript"]));

    // Job 2: VNPAY with negotiable salary
    expect(jobs[1]).toMatchObject({
      title: "Senior Frontend Developer",
      company: "VNPAY",
      city: "Ho Chi Minh City",
      level: "senior",
      expMin: 4,
      negotiable: true,
      remote: "hybrid",
      status: "new",
    });
  });

  it("handles HTTP errors", async () => {
    await expect(adapterWith("{}", 500).fetch({ keyword: "x", location: "y" })).rejects.toThrow(/TopDev HTTP 500/);
  });
});
