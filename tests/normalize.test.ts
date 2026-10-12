import { describe, expect, it } from "vitest";
import { jobId, normalizeCity, parseExperience, parseLevel, parsePostedAt, parseSalary } from "../src/normalize.js";

describe("parseSalary", () => {
  it("parses a Vietnamese million range", () => {
    expect(parseSalary("15 Tr ₫–22 Tr ₫ một tháng")).toEqual({ salaryMin: 15e6, salaryMax: 22e6, currency: "VND", negotiable: false });
  });
  it("inherits the unit across a range", () => {
    expect(parseSalary("15–22 triệu")).toMatchObject({ salaryMin: 15e6, salaryMax: 22e6, currency: "VND" });
  });
  it("parses an upper bound in USD", () => {
    expect(parseSalary("Up to $2000")).toEqual({ salaryMin: null, salaryMax: 2000, currency: "USD", negotiable: false });
  });
  it("flags negotiable salary", () => {
    expect(parseSalary("Thỏa thuận")).toEqual({ salaryMin: null, salaryMax: null, currency: null, negotiable: true });
  });
  it("returns empty for missing text", () => {
    expect(parseSalary(undefined).salaryMin).toBeNull();
  });
});

describe("parseLevel / parseExperience", () => {
  it("derives level from title", () => {
    expect(parseLevel("Senior React Dev")).toBe("senior");
    expect(parseLevel("Thực tập sinh Frontend")).toBe("intern");
    expect(parseLevel("Frontend Developer")).toBeNull();
  });
  it("derives experience from description", () => {
    expect(parseExperience("Yêu cầu 2 năm kinh nghiệm")).toEqual({ expMin: 2, expMax: null });
    expect(parseExperience("3+ years of React")).toEqual({ expMin: 3, expMax: null });
    expect(parseExperience("2-4 years")).toEqual({ expMin: 2, expMax: 4 });
    expect(parseExperience("no info")).toEqual({ expMin: null, expMax: null });
  });
});

describe("parsePostedAt", () => {
  const now = new Date("2026-10-12T00:00:00.000Z");
  it("converts relative dates", () => {
    expect(parsePostedAt("21 ngày trước", now)).toBe("2026-09-21T00:00:00.000Z");
    expect(parsePostedAt("3 days ago", now)).toBe("2026-10-09T00:00:00.000Z");
    expect(parsePostedAt("garbage", now)).toBeNull();
  });
});

describe("city and id", () => {
  it("normalizes city aliases", () => {
    expect(normalizeCity("TP. Hồ Chí Minh")).toBe("Ho Chi Minh City");
    expect(normalizeCity("Hà Nội, Vietnam")).toBe("Hanoi");
    expect(normalizeCity("Vietnam")).toBeNull();
  });
  it("gives the same id for accent and case variants", () => {
    expect(jobId("Acme Việt Nam", "Senior Dev", "Hanoi")).toBe(jobId("ACME Viet Nam", "senior  dev", "Hanoi"));
  });
});
