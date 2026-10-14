import type { Config } from "./config.js";
import { normalizeCity, normalizeText } from "./normalize.js";
import type { Job } from "./types.js";

export function matchesRoleKeywords(job: Job, keywords: string[]): boolean {
  const normTitle = normalizeText(job.title);

  // Exclude non-developer or unrelated specialties
  if (/\b(qa|qc|tester|testing|kiem thu|designer|hr|recruiter|sales|product manager|ba|business analyst)\b/i.test(normTitle)) {
    return false;
  }

  for (const kw of keywords) {
    const normKw = normalizeText(kw);
    if (normTitle.includes(normKw)) return true;
    const words = normKw.split(/\s+/).filter((w) => w.length > 2 && w !== "developer" && w !== "engineer");
    if (words.length > 0 && words.every((w) => normTitle.includes(w))) return true;
  }

  return /\b(frontend|front end|fullstack|full stack|react|reactjs)\b/i.test(normTitle);
}

/** A known value must satisfy the config; an unknown (null) value never rejects a job. */
export function evaluateMatch(job: Job, config: Config, now: Date): boolean {
  // 1. Role keyword filter: Must match frontend, fullstack, reactjs
  if (!matchesRoleKeywords(job, config.keywords)) {
    return false;
  }

  // 2. Level OR Experience filter
  const hasLevel = job.level !== null;
  const hasExp = job.expMin !== null || job.expMax !== null;

  const levelMatch = hasLevel && config.levels.includes(job.level!);
  const expMatch =
    hasExp &&
    (() => {
      const low = job.expMin ?? 0;
      const high = job.expMax ?? Infinity;
      return low <= config.experience.max && high >= config.experience.min;
    })();

  if (hasLevel || hasExp) {
    if (!levelMatch && !expMatch) return false;
  }

  // 3. Salary filter: min 15M, keep if missing
  const top = job.salaryMax ?? job.salaryMin;
  if (top !== null) {
    if (job.currency === "VND" && top < config.salary.minVND) {
      return false;
    }
    if (job.currency === "USD" && top * 25000 < config.salary.minVND) {
      return false;
    }
  } else {
    if (job.negotiable && !config.salary.includeNegotiable) {
      return false;
    }
  }

  // 4. Remote filter if configured
  if (config.remote !== "any" && job.remote && job.remote !== config.remote) {
    return false;
  }

  // 5. Posted date: within configured days (e.g. 30 days)
  if (job.postedAt) {
    const ageDays = (now.getTime() - new Date(job.postedAt).getTime()) / 86_400_000;
    if (ageDays > config.postedWithinDays) {
      return false;
    }
  }

  // 6. Location: Ho Chi Minh City OR keyword onsite
  const textAll = `${job.title} ${job.description} ${job.city ?? ""}`.toLowerCase();
  const wanted = config.locations.map((l) => normalizeCity(l) ?? l);
  const cityMatch = job.city ? wanted.includes(job.city) : wanted.some((w) => w && textAll.includes(w.toLowerCase()));
  const isOnsite = job.remote === "onsite" || /\b(onsite|on-site|tai van phong|tại văn phòng)\b/i.test(textAll);

  if (!cityMatch && !isOnsite) {
    return false;
  }

  return true;
}
