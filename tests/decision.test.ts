import { describe, expect, it } from "vitest";
import {
  evaluateDecision,
  extractSnippets,
  salaryTopInVND,
} from "../dashboard/lib/decision.js";
import { testJob } from "./helpers.js";

const NOW = new Date("2026-10-20T00:00:00.000Z");
const recent = new Date(NOW.getTime() - 2 * 86_400_000).toISOString();

/** A job that matches Tuấn's config.yaml criteria on every known axis. */
function strongJob() {
  return testJob({
    title: "Senior Frontend Developer",
    city: "Ho Chi Minh City",
    level: "senior",
    expMin: 3,
    expMax: 5,
    salaryMin: 25_000_000,
    salaryMax: 40_000_000,
    currency: "VND",
    matched: true,
    postedAt: recent,
    sources: [
      { site: "itviec", url: "https://itviec.com/1" },
      { site: "topdev", url: "https://topdev.vn/1" },
    ],
  });
}

describe("salaryTopInVND", () => {
  it("uses the top of a VND range as-is", () => {
    expect(salaryTopInVND(strongJob())).toBe(40_000_000);
  });

  it("converts USD at the pipeline rate (25,000)", () => {
    const job = testJob({ salaryMin: 1000, salaryMax: 2000, currency: "USD" });
    expect(salaryTopInVND(job)).toBe(50_000_000);
  });

  it("returns null when salary is undisclosed", () => {
    expect(salaryTopInVND(testJob({ negotiable: true }))).toBeNull();
  });
});

describe("evaluateDecision", () => {
  it("says 'open' for a job passing every known criterion", () => {
    const d = evaluateDecision(strongJob(), NOW);
    expect(d.verdict).toBe("open");
    expect(d.score).toBe(100);
    expect(d.checks.every((c) => c.status === "pass")).toBe(true);
    expect(d.strengths.length).toBeGreaterThan(0);
    expect(d.warnings).toHaveLength(0);
  });

  it("says 'skip' when salary and experience both hard-fail", () => {
    const job = testJob({
      city: "Hanoi",
      level: "junior",
      expMin: 0,
      expMax: 1,
      salaryMin: 8_000_000,
      salaryMax: 10_000_000,
      currency: "VND",
      matched: false,
      postedAt: new Date(NOW.getTime() - 60 * 86_400_000).toISOString(),
    });
    const d = evaluateDecision(job, NOW);
    expect(d.verdict).toBe("skip");
    expect(d.score).toBeLessThanOrEqual(35);
    expect(d.warnings.length).toBeGreaterThan(0);
  });

  it("treats unknown salary/exp as warnings, not failures", () => {
    const job = testJob({ city: "Ho Chi Minh City", level: "middle", matched: true, postedAt: recent });
    const d = evaluateDecision(job, NOW);
    const salary = d.checks.find((c) => c.key === "salary");
    const exp = d.checks.find((c) => c.key === "exp");
    expect(salary?.status).toBe("unknown");
    expect(exp?.status).toBe("unknown");
    // Known axes all pass, but with only 3 known criteria and hard data
    // missing the verdict must not be a hard 'skip'.
    expect(d.verdict).not.toBe("skip");
    expect(d.warnings.some((w) => w.includes("lương") || w.includes("Lương"))).toBe(true);
  });

  it("does not say 'open' on a single known criterion alone", () => {
    const job = testJob({ city: null, salaryMin: 20_000_000, salaryMax: 30_000_000, currency: "VND" });
    const d = evaluateDecision(job, NOW);
    expect(d.score).toBe(100); // only salary is known, and it passes
    expect(d.verdict).toBe("consider"); // but 1 known axis is not enough to open
  });

  it("flags an old posting as stale", () => {
    const job = strongJob();
    job.postedAt = new Date(NOW.getTime() - 45 * 86_400_000).toISOString();
    const d = evaluateDecision(job, NOW);
    const freshness = d.checks.find((c) => c.key === "freshness");
    expect(freshness?.status).toBe("fail");
  });
});

describe("extractSnippets", () => {
  const jd = [
    "We are a product company building fintech apps for the SEA market.",
    "Mức lương từ 25 đến 40 triệu, thưởng tháng 13 và bảo hiểm sức khỏe toàn diện cho nhân viên.",
    "Yêu cầu tối thiểu 3 năm kinh nghiệm với React và TypeScript trong môi trường production.",
    "Ứng viên thành thạo Next.js và có kinh nghiệm làm việc với REST API là một lợi thế lớn.",
    "Văn phòng tại quận 1 với nhiều hoạt động team building định kỳ mỗi quý.",
  ].join("\n");

  it("returns at most 3 decision-bearing excerpts, labelled by kind", () => {
    const snippets = extractSnippets(jd);
    expect(snippets.length).toBeGreaterThan(0);
    expect(snippets.length).toBeLessThanOrEqual(3);
    expect(snippets.some((s) => s.label === "Lương & phúc lợi")).toBe(true);
    expect(snippets.some((s) => s.label === "Kinh nghiệm")).toBe(true);
  });

  it("never returns the whole description", () => {
    const snippets = extractSnippets(jd);
    const joined = snippets.map((s) => s.text).join(" ");
    expect(joined.length).toBeLessThan(jd.length);
    expect(joined).not.toContain("team building");
  });

  it("returns nothing for an empty or signal-free description", () => {
    expect(extractSnippets("")).toEqual([]);
    expect(extractSnippets("Short text.")).toEqual([]);
    expect(
      extractSnippets("We are a friendly product company with a lovely office and a great team culture overall."),
    ).toEqual([]);
  });

  it("truncates very long fragments", () => {
    const long = `Mức lương cạnh tranh ${"và phúc lợi hấp dẫn ".repeat(40)}cho ứng viên phù hợp.`;
    const snippets = extractSnippets(long);
    expect(snippets).toHaveLength(1);
    expect(snippets[0]!.text.length).toBeLessThanOrEqual(281);
    expect(snippets[0]!.text.endsWith("…")).toBe(true);
  });
});
