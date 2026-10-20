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

  it("filters out unrelated roles by title and skills", () => {
    expect(evaluateMatch(testJob({ title: "Senior QA/QC" }), config, now)).toBe(false);
    expect(evaluateMatch(testJob({ title: "Backend Engineer" }), config, now)).toBe(false);
    expect(evaluateMatch(testJob({ title: "WordPress Developer" }), config, now)).toBe(false);
    expect(evaluateMatch(testJob({ title: "Fullstack Engineer" }), config, now)).toBe(true);
    expect(evaluateMatch(testJob({ title: "ReactJS Developer" }), config, now)).toBe(true);
  });

  it("applies OR logic between level and experience", () => {
    const orConfig = testConfig({
      levels: ["middle", "senior"],
      experience: { min: 3, max: 4 },
    });

    // Level matches (senior), exp is missing or different -> passes
    expect(evaluateMatch(testJob({ level: "senior", expMin: null }), orConfig, now)).toBe(true);
    expect(evaluateMatch(testJob({ level: "middle", expMin: 2, expMax: 2 }), orConfig, now)).toBe(true);

    // Level missing or junior, but exp matches 3-4 years -> passes
    expect(evaluateMatch(testJob({ level: null, expMin: 3, expMax: 4 }), orConfig, now)).toBe(true);
    expect(evaluateMatch(testJob({ level: "junior", expMin: 3, expMax: 4 }), orConfig, now)).toBe(true);

    // Neither matches -> fails
    expect(evaluateMatch(testJob({ level: "junior", expMin: 1, expMax: 2 }), orConfig, now)).toBe(false);
    expect(evaluateMatch(testJob({ level: null, expMin: 1, expMax: null }), orConfig, now)).toBe(false);
    expect(evaluateMatch(testJob({ level: null, expMin: 2, expMax: null }), orConfig, now)).toBe(false);
    expect(evaluateMatch(testJob({ level: null, expMin: 3, expMax: null }), orConfig, now)).toBe(true);
    expect(evaluateMatch(testJob({ level: "intern" }), orConfig, now)).toBe(false);
  });

  it("accepts Ho Chi Minh City OR keyword onsite in other cities", () => {
    const hcmConfig = testConfig({ locations: ["Ho Chi Minh City"] });

    // HCM city passes
    expect(evaluateMatch(testJob({ city: "Ho Chi Minh City" }), hcmConfig, now)).toBe(true);

    // Hanoi fails unless onsite
    expect(evaluateMatch(testJob({ city: "Hanoi" }), hcmConfig, now)).toBe(false);
    expect(evaluateMatch(testJob({ city: "Hanoi", remote: "onsite" }), hcmConfig, now)).toBe(true);
    expect(evaluateMatch(testJob({ city: "Hanoi", description: "Làm việc onsite tại văn phòng" }), hcmConfig, now)).toBe(true);
  });

  it("honors 15M minimum salary and keeps missing salary", () => {
    const salConfig = testConfig({ salary: { minVND: 15_000_000, includeNegotiable: true } });
    expect(evaluateMatch(testJob({ salaryMin: 12_000_000, currency: "VND" }), salConfig, now)).toBe(false);
    expect(evaluateMatch(testJob({ salaryMin: 15_000_000, currency: "VND" }), salConfig, now)).toBe(true);
    expect(evaluateMatch(testJob({ salaryMin: null, salaryMax: null }), salConfig, now)).toBe(true);
  });
});
