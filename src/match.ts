import type { Config } from "./config.js";
import { normalizeCity } from "./normalize.js";
import type { Job } from "./types.js";

/** A known value must satisfy the config; an unknown (null) value never rejects a job. */
export function evaluateMatch(job: Job, config: Config, now: Date): boolean {
  if (job.level && !config.levels.includes(job.level)) return false;

  if (job.expMin !== null || job.expMax !== null) {
    const low = job.expMin ?? 0;
    const high = job.expMax ?? Infinity;
    if (low > config.experience.max || high < config.experience.min) return false;
  }

  const top = job.salaryMax ?? job.salaryMin;
  if (top === null) {
    if (job.negotiable && !config.salary.includeNegotiable) return false;
  } else if (job.currency === "VND" && top < config.salary.minVND) {
    return false;
  }

  if (config.remote !== "any" && job.remote && job.remote !== config.remote) return false;

  if (job.postedAt) {
    const ageDays = (now.getTime() - new Date(job.postedAt).getTime()) / 86_400_000;
    if (ageDays > config.postedWithinDays) return false;
  }

  if (job.city) {
    const wanted = config.locations.map((l) => normalizeCity(l));
    if (!wanted.includes(job.city)) return false;
  }
  return true;
}
