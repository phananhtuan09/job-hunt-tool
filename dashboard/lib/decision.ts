import type { Job } from "./types.js";

/**
 * Quick-decision engine for the dashboard detail pane.
 *
 * The detail pane is NOT a copy of the source posting: it answers one
 * question in a few seconds — "is this job worth opening on the source
 * site?" — by comparing the job against the user's own hunt criteria.
 *
 * TARGET_CRITERIA mirrors `config.yaml` at the repo root (the same values
 * the crawl pipeline matches with in `src/match.ts`). If the hunt criteria
 * change in `config.yaml`, update this constant to match — the pane labels
 * every row with the target it used, so a stale value is visible, never
 * silent. Pure rule-based logic: no LLM, no token cost.
 */
export const TARGET_CRITERIA = {
  levels: ["middle", "senior"] as const,
  expMin: 3,
  expMax: 4,
  salaryMinVND: 15_000_000,
  city: "Ho Chi Minh City",
  postedWithinDays: 30,
  /** Same fixed rate the pipeline uses in `src/match.ts`. */
  usdToVnd: 25_000,
} as const;

export type CheckStatus = "pass" | "fail" | "unknown";

export interface CriterionCheck {
  key: "salary" | "exp" | "level" | "location" | "freshness";
  label: string;
  /** What the user is looking for, e.g. "≥ 15tr VND". */
  target: string;
  /** What this job actually offers, e.g. "25–40tr VND". */
  actual: string;
  status: CheckStatus;
}

export type Verdict = "open" | "consider" | "skip";

export interface Decision {
  checks: CriterionCheck[];
  strengths: string[];
  warnings: string[];
  /** 0–100 over the criteria that are actually known for this job. */
  score: number;
  verdict: Verdict;
  verdictLabel: string;
}

/** Top of the salary range converted to VND, or null when undisclosed. */
export function salaryTopInVND(job: Job): number | null {
  const top = job.salaryMax ?? job.salaryMin;
  if (top === null) return null;
  const currency = job.currency ?? (top >= 1_000_000 ? "VND" : "USD");
  return currency === "USD" ? top * TARGET_CRITERIA.usdToVnd : top;
}

export function formatSalary(job: Job): string {
  if (job.salaryMin === null && job.salaryMax === null) {
    return job.negotiable ? "Thỏa thuận" : "Không công bố";
  }
  const fmt = (v: number) =>
    job.currency === "USD" ? `$${v.toLocaleString()}` : `${Math.round(v / 1e6)}tr`;
  if (job.salaryMin !== null && job.salaryMax !== null) {
    return job.currency === "USD"
      ? `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)}`
      : `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)} VND`;
  }
  if (job.salaryMax !== null) return `Up to ${fmt(job.salaryMax)}`;
  return `Từ ${fmt(job.salaryMin!)}`;
}

export function postedAgeDays(job: Job, now: Date = new Date()): number | null {
  if (!job.postedAt) return null;
  const ms = now.getTime() - new Date(job.postedAt).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function postedAgeLabel(job: Job, now: Date = new Date()): string {
  const days = postedAgeDays(job, now);
  if (days === null) return "Không rõ ngày đăng";
  if (days === 0) return "Đăng hôm nay";
  if (days === 1) return "Đăng hôm qua";
  if (days < 30) return `Đăng ${days} ngày trước`;
  return `Đăng ${Math.floor(days / 7)} tuần trước (${days} ngày)`;
}

const WEIGHTS: Record<CriterionCheck["key"], number> = {
  salary: 3,
  exp: 3,
  level: 2,
  location: 2,
  freshness: 1,
};

export function evaluateDecision(job: Job, now: Date = new Date()): Decision {
  const t = TARGET_CRITERIA;
  const checks: CriterionCheck[] = [];
  const strengths: string[] = [];
  const warnings: string[] = [];

  // --- Salary -------------------------------------------------------------
  const topVND = salaryTopInVND(job);
  const salaryStatus: CheckStatus =
    topVND === null ? "unknown" : topVND >= t.salaryMinVND ? "pass" : "fail";
  checks.push({
    key: "salary",
    label: "Lương",
    target: `≥ ${Math.round(t.salaryMinVND / 1e6)}tr VND`,
    actual: formatSalary(job),
    status: salaryStatus,
  });
  if (salaryStatus === "pass") {
    strengths.push(`Lương ${formatSalary(job)} — đạt mức tối thiểu ${Math.round(t.salaryMinVND / 1e6)}tr`);
  } else if (salaryStatus === "fail") {
    warnings.push(`Lương tối đa dưới mức tối thiểu ${Math.round(t.salaryMinVND / 1e6)}tr VND`);
  } else {
    warnings.push(
      job.negotiable
        ? "Lương thỏa thuận — phải mở nguồn mới biết con số thật"
        : "Không công bố lương — phải mở nguồn mới biết con số thật",
    );
  }

  // --- Experience -----------------------------------------------------------
  const hasExp = job.expMin !== null || job.expMax !== null;
  const expMin = job.expMin ?? 0;
  const expMax = job.expMax ?? job.expMin ?? Number.POSITIVE_INFINITY;
  const expStatus: CheckStatus = !hasExp
    ? "unknown"
    : expMin <= t.expMax && expMax >= t.expMin
      ? "pass"
      : "fail";
  const expActual = !hasExp
    ? "Không rõ"
    : job.expMax !== null && job.expMin !== null
      ? `${job.expMin}–${job.expMax} năm`
      : job.expMin !== null
        ? `${job.expMin}+ năm`
        : `≤ ${job.expMax} năm`;
  checks.push({
    key: "exp",
    label: "Kinh nghiệm",
    target: `${t.expMin}–${t.expMax} năm`,
    actual: expActual,
    status: expStatus,
  });
  if (expStatus === "pass") {
    strengths.push(`Kinh nghiệm ${expActual} — khớp dải ${t.expMin}–${t.expMax} năm đang tìm`);
  } else if (expStatus === "fail") {
    warnings.push(`Kinh nghiệm yêu cầu ${expActual} — ngoài dải ${t.expMin}–${t.expMax} năm đang tìm`);
  } else {
    warnings.push("Không rõ yêu cầu kinh nghiệm trong tin đăng");
  }

  // --- Level ----------------------------------------------------------------
  const levelStatus: CheckStatus =
    job.level === null
      ? "unknown"
      : (t.levels as readonly string[]).includes(job.level)
        ? "pass"
        : "fail";
  checks.push({
    key: "level",
    label: "Level",
    target: "Middle / Senior",
    actual: job.level ? job.level.toUpperCase() : "Không rõ",
    status: levelStatus,
  });
  if (levelStatus === "pass") {
    strengths.push(`Level ${job.level!.toUpperCase()} — đúng nhóm Middle/Senior`);
  } else if (levelStatus === "fail") {
    warnings.push(`Level ${job.level!.toUpperCase()} — ngoài nhóm Middle/Senior đang tìm`);
  }

  // --- Location ---------------------------------------------------------------
  const locationStatus: CheckStatus =
    job.city === null ? "unknown" : job.city === t.city ? "pass" : "fail";
  checks.push({
    key: "location",
    label: "Địa điểm",
    target: "Ho Chi Minh City",
    actual: job.city ?? "Không rõ",
    status: locationStatus,
  });
  if (locationStatus === "pass") {
    strengths.push("Địa điểm Ho Chi Minh City — đúng mục tiêu");
  } else if (locationStatus === "fail") {
    warnings.push(`Địa điểm ${job.city} — ngoài Ho Chi Minh City`);
  }

  // --- Freshness ----------------------------------------------------------------
  const age = postedAgeDays(job, now);
  const freshnessStatus: CheckStatus =
    age === null ? "unknown" : age <= t.postedWithinDays ? "pass" : "fail";
  checks.push({
    key: "freshness",
    label: "Độ mới",
    target: `≤ ${t.postedWithinDays} ngày`,
    actual: postedAgeLabel(job, now),
    status: freshnessStatus,
  });
  if (age !== null && age <= 3) {
    strengths.push(`${postedAgeLabel(job, now)} — tin rất mới, nộp sớm có lợi thế`);
  } else if (age !== null && age > 14 && age <= t.postedWithinDays) {
    warnings.push(`Đã đăng ${age} ngày — nên xử lý sớm, tin có thể sắp đóng`);
  } else if (freshnessStatus === "fail") {
    warnings.push(`Đã đăng ${age} ngày — quá ${t.postedWithinDays} ngày, tin có thể đã đóng`);
  }

  // --- Cross-cutting signals ------------------------------------------------------
  if (job.matched) {
    strengths.push("Pipeline đã đánh dấu khớp config (matched)");
  } else {
    warnings.push("Pipeline chưa đánh dấu matched — đối chiếu kỹ bảng tiêu chí ở trên");
  }
  if (job.sources.length >= 2) {
    strengths.push(`Có trên ${job.sources.length} nguồn — đối chiếu được, ít rủi ro tin trùng/ảo`);
  }

  // --- Score & verdict ---------------------------------------------------------------
  const known = checks.filter((c) => c.status !== "unknown");
  const totalWeight = known.reduce((sum, c) => sum + WEIGHTS[c.key], 0);
  const earnedWeight = known
    .filter((c) => c.status === "pass")
    .reduce((sum, c) => sum + WEIGHTS[c.key], 0);
  const score =
    totalWeight > 0 ? Math.round((100 * earnedWeight) / totalWeight) : job.matched ? 60 : 40;

  const hardFail =
    checks.some((c) => c.key === "salary" && c.status === "fail") ||
    checks.some((c) => c.key === "exp" && c.status === "fail");

  let verdict: Verdict;
  if (known.length >= 3 && score >= 70 && !hardFail) {
    verdict = "open";
  } else if ((known.length >= 2 && score <= 35) || (hardFail && score < 50)) {
    verdict = "skip";
  } else {
    verdict = "consider";
  }

  const verdictLabel =
    verdict === "open" ? "Nên mở" : verdict === "skip" ? "Có thể bỏ qua" : "Cân nhắc";

  return { checks, strengths, warnings, score, verdict, verdictLabel };
}

export interface Snippet {
  label: string;
  text: string;
}

const SNIPPET_RULES: { label: string; pattern: RegExp }[] = [
  {
    label: "Lương & phúc lợi",
    pattern:
      /(lương|salary|thưởng|bonus|phúc lợi|benefit|bảo hiểm|insurance|allowance|trợ cấp|tháng 13|13th|review lương)/i,
  },
  {
    label: "Kinh nghiệm",
    pattern: /(kinh nghiệm|experience|years of|yrs\b)/i,
  },
  {
    label: "Yêu cầu chính",
    pattern: /(yêu cầu|requirement|required|must have|bắt buộc|thành thạo|proficient)/i,
  },
];

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max)}…`;
}

/**
 * At most `max` short excerpts from the description — only the fragments
 * that carry decision data (pay/benefits, experience, hard requirements).
 * The full JD is deliberately never returned here: for the full text, the
 * user opens the source site.
 */
export function extractSnippets(description: string, max = 3): Snippet[] {
  if (!description || !description.trim()) return [];

  const fragments = description
    .replace(/\r/g, "")
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?;])\s+/))
    .map((s) => s.replace(/^[\s\-•*▪◦>]+/, "").trim())
    .filter((s) => s.length >= 25);

  const used = new Set<string>();
  const picked: Snippet[] = [];

  for (const rule of SNIPPET_RULES) {
    if (picked.length >= max) break;
    const hit = fragments.find((f) => rule.pattern.test(f) && !used.has(f));
    if (hit) {
      used.add(hit);
      picked.push({ label: rule.label, text: truncate(hit, 280) });
    }
  }
  // Fill remaining slots with more decision-bearing fragments, in order.
  for (const f of fragments) {
    if (picked.length >= max) break;
    if (used.has(f)) continue;
    const rule = SNIPPET_RULES.find((r) => r.pattern.test(f));
    if (rule) {
      used.add(f);
      picked.push({ label: rule.label, text: truncate(f, 280) });
    }
  }
  return picked;
}
