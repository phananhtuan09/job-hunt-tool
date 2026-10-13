import { existsSync } from "node:fs";
import { execa } from "execa";
import { z } from "zod";
import {
  jobId,
  normalizeCity,
  parseExperience,
  parseLevel,
  parsePostedAt,
  parseRemote,
  parseSalary,
  parseSkills,
} from "../normalize.js";
import type { Currency, Job, JobSource, RawJob, SourceAdapter, SourceQuery } from "../types.js";

const jobspyJobSchema = z.object({
  id: z.string().optional(),
  site: z.string().optional(),
  job_url: z.string().nullable().optional(),
  job_url_direct: z.string().nullable().optional(),
  title: z.string(),
  company: z.string(),
  location: z.string().nullable().optional(),
  date_posted: z.string().nullable().optional(),
  job_type: z.string().nullable().optional(),
  interval: z.string().nullable().optional(),
  min_amount: z.number().nullable().optional(),
  max_amount: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  is_remote: z.boolean().nullable().optional(),
  description: z.string().nullable().optional(),
});

function defaultPython(): string {
  if (existsSync(".venv/bin/python3")) return ".venv/bin/python3";
  if (existsSync(".venv/bin/python")) return ".venv/bin/python";
  return "python3";
}

export type JobSpyRunner = (args: string[]) => Promise<{ stdout: string }>;

export interface JobSpyOptions {
  sites: ("linkedin" | "indeed")[];
  postedWithinDays: number;
  pythonPath?: string;
  scriptPath?: string;
  runner?: JobSpyRunner;
}

export function createJobSpyAdapter(options: JobSpyOptions): SourceAdapter {
  const pythonPath = options.pythonPath ?? defaultPython();
  const scriptPath = options.scriptPath ?? "scripts/jobspy_scrape.py";

  const run: JobSpyRunner =
    options.runner ??
    (async (args: string[]) => {
      const result = await execa(pythonPath, [scriptPath, ...args]);
      return { stdout: result.stdout };
    });

  return {
    name: "jobspy",

    async fetch(query: SourceQuery): Promise<RawJob[]> {
      const args = [
        "--site",
        options.sites.join(","),
        "--search_term",
        query.keyword,
        "--location",
        query.location,
        "--results_wanted",
        "10",
        "--hours_old",
        String(options.postedWithinDays * 24),
      ];

      try {
        const { stdout } = await run(args);
        const parsed = JSON.parse(stdout);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((r): r is RawJob => jobspyJobSchema.safeParse(r).success);
      } catch (error) {
        const errMessage = (error as Error).message;
        if (process.env.CI && options.sites.includes("linkedin")) {
          throw new Error(`JobSpy scrape failed in CI (LinkedIn may be IP-blocked): ${errMessage}`);
        }
        throw new Error(`JobSpy scrape failed: ${errMessage}`);
      }
    },

    normalize(raw: RawJob, now = new Date()): Job {
      const job = jobspyJobSchema.parse(raw);
      const description = job.description ?? "";
      const city = normalizeCity(job.location);

      let salaryMin: number | null = null;
      let salaryMax: number | null = null;
      let currency: Currency | null = null;
      let negotiable = false;

      if (job.min_amount != null || job.max_amount != null) {
        const factor = job.interval?.toLowerCase() === "yearly" || job.interval?.toLowerCase() === "annual" ? 1 / 12 : 1;
        salaryMin = job.min_amount != null ? Math.round(job.min_amount * factor) : null;
        salaryMax = job.max_amount != null ? Math.round(job.max_amount * factor) : null;
        const cur = job.currency?.toUpperCase();
        if (cur === "VND" || cur === "USD") {
          currency = cur as Currency;
        }
      } else {
        const snippet =
          description.match(/(?:salary|lương|thu nhập)[\s:]*([^\n;]+)/i)?.[0] ??
          description.match(/(?:\$|₫|vnd|usd|\d+\s*(?:triệu|tr|m|k))\s*[-–~to]*\s*(?:\$|₫|vnd|usd|\d+\s*(?:triệu|tr|m|k))?/i)?.[0];
        const parsed = parseSalary(snippet ?? (/thỏa thuận|negotiable/i.test(description) ? "thỏa thuận" : null));
        salaryMin = parsed.salaryMin;
        salaryMax = parsed.salaryMax;
        currency = parsed.currency;
        negotiable = parsed.negotiable;
      }

      const url = job.job_url_direct || job.job_url || "";
      const sources: JobSource[] = url ? [{ site: job.site?.toLowerCase() ?? "jobspy", url }] : [];

      let postedAt: string | null = null;
      if (job.date_posted) {
        try {
          postedAt = new Date(job.date_posted).toISOString();
        } catch {
          postedAt = null;
        }
      }
      if (!postedAt) {
        postedAt = parsePostedAt(description, now);
      }

      return {
        id: jobId(job.company, job.title, city),
        title: job.title,
        company: job.company,
        city,
        level: parseLevel(job.title),
        ...parseExperience(description),
        salaryMin,
        salaryMax,
        currency,
        negotiable,
        remote: parseRemote(job.title, description, job.is_remote ?? undefined),
        skills: parseSkills(job.title, description),
        sources,
        description,
        postedAt,
        firstSeenAt: now.toISOString(),
        matched: false,
        status: "new",
      };
    },
  };
}
