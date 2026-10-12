import { createHash } from "node:crypto";
import type { Currency, Level, Remote } from "./types.js";

const SKILLS = ["react", "vue", "angular", "typescript", "javascript", "next.js", "node.js", "redux", "tailwind", "graphql", "html", "css"];

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeCity(location: string | null | undefined): string | null {
  if (!location) return null;
  const text = normalizeText(location);
  if (/\b(ho chi minh|hcm|hcmc|sai gon|saigon)\b/.test(text)) return "Ho Chi Minh City";
  if (/\b(ha noi|hanoi)\b/.test(text)) return "Hanoi";
  if (/\bda nang\b/.test(text)) return "Da Nang";
  const first = location.split(",")[0]?.trim() ?? "";
  if (!first || normalizeText(first) === "vietnam" || normalizeText(first) === "viet nam") return null;
  return first;
}

export function jobId(company: string, title: string, city: string | null): string {
  const key = [normalizeText(company), normalizeText(title), normalizeText(city ?? "")].join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export interface Salary {
  salaryMin: number | null;
  salaryMax: number | null;
  currency: Currency | null;
  negotiable: boolean;
}

function parseAmount(raw: string): number {
  if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) return Number(raw.replace(/[.,]/g, ""));
  return Number(raw.replace(",", "."));
}

export function parseSalary(text: string | null | undefined): Salary {
  const result: Salary = { salaryMin: null, salaryMax: null, currency: null, negotiable: false };
  if (!text) return result;
  const t = text.toLowerCase();
  if (/thỏa thuận|thoả thuận|negotiable/.test(t)) result.negotiable = true;

  const matches = [...t.matchAll(/(\d+(?:[.,]\d+)*)\s*(triệu|tr|m|k|nghìn)?(?![\p{L}\d])/gu)];
  if (matches.length === 0) return result;

  let carry = "";
  const amounts = matches
    .reverse()
    .map((m) => {
      carry = m[2] ?? carry;
      const unit = carry;
      const factor = unit === "k" || unit === "nghìn" ? 1e3 : unit ? 1e6 : 1;
      return parseAmount(m[1] as string) * factor;
    })
    .reverse();

  result.currency = /\$|usd/.test(t) ? "USD" : /₫|vnd|đ|triệu|\btr\b/.test(t) ? "VND" : amounts.some((a) => a >= 1e6) ? "VND" : null;
  const perYear = /\/\s*(năm|year|yr)|một năm|per year|a year|annual/.test(t) ? 12 : 1;
  const [first, second] = amounts.map((a) => Math.round(a / perYear)) as [number, number | undefined];
  if (second !== undefined) {
    result.salaryMin = Math.min(first, second);
    result.salaryMax = Math.max(first, second);
  } else if (/up to|tối đa|đến|upto/.test(t)) {
    result.salaryMax = first;
  } else if (/from|từ|trên|over|above|\+/.test(t)) {
    result.salaryMin = first;
  } else {
    result.salaryMin = first;
    result.salaryMax = first;
  }
  return result;
}

export function parseLevel(title: string): Level | null {
  const t = normalizeText(title);
  if (/\b(intern|internship|thuc tap)\b/.test(t)) return "intern";
  if (/\b(lead|principal|truong nhom)\b/.test(t)) return "lead";
  if (/\b(senior|sr)\b/.test(t)) return "senior";
  if (/\b(junior|jr|fresher|entry)\b/.test(t)) return "junior";
  if (/\b(middle|mid)\b/.test(t)) return "middle";
  return null;
}

export function parseExperience(description: string): { expMin: number | null; expMax: number | null } {
  const m = description.toLowerCase().match(/(\d{1,2})\s*(?:(?:-|–|to)\s*(\d{1,2}))?\s*\+?\s*(?:years?|yrs?|năm)\b/);
  if (!m) return { expMin: null, expMax: null };
  const min = Number(m[1]);
  return { expMin: min, expMax: m[2] ? Number(m[2]) : null };
}

const UNIT_MS: [RegExp, number][] = [
  [/^(phút|minute)/, 60_000],
  [/^(giờ|hour)/, 3_600_000],
  [/^(ngày|day)/, 86_400_000],
  [/^(tuần|week)/, 7 * 86_400_000],
  [/^(tháng|month)/, 30 * 86_400_000],
];

export function parsePostedAt(text: string | null | undefined, now: Date): string | null {
  if (!text) return null;
  const t = text.toLowerCase().trim();
  if (/hôm nay|today|just posted|vừa đăng/.test(t)) return now.toISOString();
  const m = t.match(/(\d+)\s*\+?\s*([\p{L}]+)\s*(trước|ago)/u);
  if (!m) return null;
  const unit = UNIT_MS.find(([re]) => re.test(m[2] as string));
  if (!unit) return null;
  return new Date(now.getTime() - Number(m[1]) * unit[1]).toISOString();
}

export function parseRemote(title: string, description: string, workFromHome?: boolean): Remote | null {
  const text = `${title} ${description}`.toLowerCase();
  if (/hybrid/.test(text)) return "hybrid";
  if (workFromHome || /\bremote\b/.test(title.toLowerCase())) return "remote";
  return null;
}

export function parseSkills(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  return SKILLS.filter((skill) => new RegExp(`(^|[^a-z0-9])${skill.replace(".", "\\.")}([^a-z0-9]|$)`).test(text));
}
