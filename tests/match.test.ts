import { describe, expect, it } from "vitest";
import { evaluateMatch } from "../src/match.js";
import { testConfig, testJob } from "./helpers.js";

const now = new Date("2026-10-12T00:00:00.000Z");
const config = testConfig();

describe("evaluateMatch", () => {
  it("accepts a job whose optional fields are unknown", () => {
    expect(evaluateMatch(testJob(), config, now)).toBe(true);
  });
  it("rejects a level outside the config", () => {
    expect(evaluateMatch(testJob({ level: "lead" }), config, now)).toBe(false);
  });
  it("rejects experience ranges that do not overlap", () => {
    expect(evaluateMatch(testJob({ expMin: 7, expMax: null }), config, now)).toBe(false);
    expect(evaluateMatch(testJob({ expMin: 3, expMax: null }), config, now)).toBe(true);
  });
  it("rejects VND salary below the minimum but passes unknown currency", () => {
    expect(evaluateMatch(testJob({ salaryMin: 8e6, salaryMax: 12e6, currency: "VND" }), config, now)).toBe(false);
    expect(evaluateMatch(testJob({ salaryMax: 2000, currency: "USD" }), config, now)).toBe(true);
  });
  it("honors includeNegotiable", () => {
    const strict = testConfig({ salary: { minVND: 1, includeNegotiable: false } });
    expect(evaluateMatch(testJob({ negotiable: true }), strict, now)).toBe(false);
    expect(evaluateMatch(testJob({ negotiable: true }), config, now)).toBe(true);
  });
  it("rejects stale postings and other cities", () => {
    expect(evaluateMatch(testJob({ postedAt: "2026-09-21T00:00:00.000Z" }), config, now)).toBe(false);
    expect(evaluateMatch(testJob({ city: "Da Nang" }), config, now)).toBe(false);
  });
  it("filters by remote mode only when both sides are known", () => {
    const remoteOnly = testConfig({ remote: "remote" });
    expect(evaluateMatch(testJob({ remote: "onsite" }), remoteOnly, now)).toBe(false);
    expect(evaluateMatch(testJob({ remote: null }), remoteOnly, now)).toBe(true);
  });
});
