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

const jsearchJobSchema = z.object({
  job_id: z.string().optional(),
  job_title: z.string(),
  employer_name: z.string(),
  job_city: z.string().nullable().optional(),
  job_state: z.string().nullable().optional(),
  job_country: z.string().nullable().optional(),
  job_apply_link: z.string().nullable().optional(),
  job_google_link: z.string().nullable().optional(),
  job_description: z.string().optional(),
  job_is_remote: z.boolean().optional(),
  job_posted_at_datetime_utc: z.string().nullable().optional(),
  job_required_experience: z
    .object({
      no_experience_required: z.boolean().optional(),
      required_experience_in_months: z.number().nullable().optional(),
      experience_mentioned: z.boolean().optional(),
    })
    .optional(),
  job_min_salary: z.number().nullable().optional(),
  job_max_salary: z.number().nullable().optional(),
  job_salary_currency: z.string().nullable().optional(),
  job_salary_period: z.string().nullable().optional(),
});

const responseSchema = z.object({
  status: z.string().optional(),
  data: z.array(z.unknown()).optional(),
  message: z.string().optional(),
});

export const JSEARCH_MONTHLY_QUOTA = 190; // Hard limit 200/month on RapidAPI; keep safety margin

function datePostedParam(days: number): string {
  if (days <= 1) return "today";
  if (days <= 3) return "3days";
  if (days <= 7) return "week";
  return "month";
}

export interface JSearchOptions {
  apiKey: string;
  postedWithinDays: number;
  fetchImpl?: typeof fetch;
}

export function createJSearchAdapter(options: JSearchOptions): SourceAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    name: "jsearch",
    monthlyQuota: JSEARCH_MONTHLY_QUOTA,

    async fetch(query: SourceQuery): Promise<RawJob[]> {
      const url = new URL("https://jsearch.p.rapidapi.com/search");
      url.searchParams.set("query", `${query.keyword} in ${query.location}`);
      url.searchParams.set("page", "1");
      url.searchParams.set("num_pages", "1");
      url.searchParams.set("date_posted", datePostedParam(options.postedWithinDays));

      const response = await fetchImpl(url, {
        headers: {
          "X-RapidAPI-Key": options.apiKey,
          "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        },
      });

      if (!response.ok) {
        throw new Error(`JSearch HTTP ${response.status}`);
      }

      const body = responseSchema.parse(await response.json());
      return (body.data ?? []).filter((r): r is RawJob => jsearchJobSchema.safeParse(r).success);
    },

    normalize(raw: RawJob, now = new Date()): Job {
      const job = jsearchJobSchema.parse(raw);
      const description = job.job_description ?? "";
      const city = normalizeCity(job.job_city ?? job.job_state ?? null);

      // Map salary
      let salaryMin: number | null = null;
      let salaryMax: number | null = null;
      let currency: Currency | null = null;
      let negotiable = false;

      if (job.job_min_salary != null || job.job_max_salary != null) {
        const factor = job.job_salary_period?.toUpperCase() === "YEAR" ? 1 / 12 : 1;
        salaryMin = job.job_min_salary != null ? Math.round(job.job_min_salary * factor) : null;
        salaryMax = job.job_max_salary != null ? Math.round(job.job_max_salary * factor) : null;
        const cur = job.job_salary_currency?.toUpperCase();
        if (cur === "VND" || cur === "USD") {
          currency = cur as Currency;
        }
      } else {
        const snippet = description.match(/(?:salary|lương|thu nhập)[\s:]*([^\n;]+)/i)?.[0]
          ?? description.match(/(?:\$|₫|vnd|usd|\d+\s*(?:triệu|tr|m|k))\s*[-–~to]*\s*(?:\$|₫|vnd|usd|\d+\s*(?:triệu|tr|m|k))?/i)?.[0];
        const parsed = parseSalary(snippet ?? (/thỏa thuận|negotiable/i.test(description) ? "thỏa thuận" : null));
        salaryMin = parsed.salaryMin;
        salaryMax = parsed.salaryMax;
        currency = parsed.currency;
        negotiable = parsed.negotiable;
      }

      // Map experience
      let expMin: number | null = null;
      let expMax: number | null = null;
      if (job.job_required_experience?.required_experience_in_months != null) {
        expMin = Math.floor(job.job_required_experience.required_experience_in_months / 12);
      } else {
        const parsedExp = parseExperience(description);
        expMin = parsedExp.expMin;
        expMax = parsedExp.expMax;
      }

      const link = job.job_apply_link || job.job_google_link || "";
      const sources: JobSource[] = link ? [{ site: "jsearch", url: link }] : [];

      let postedAt: string | null = null;
      if (job.job_posted_at_datetime_utc) {
        try {
          postedAt = new Date(job.job_posted_at_datetime_utc).toISOString();
        } catch {
          postedAt = null;
        }
      }
      if (!postedAt) {
        postedAt = parsePostedAt(description, now);
      }

      return {
        id: jobId(job.employer_name, job.job_title, city),
        title: job.job_title,
        company: job.employer_name,
        city,
        level: parseLevel(job.job_title),
        expMin,
        expMax,
        salaryMin,
        salaryMax,
        currency,
        negotiable,
        remote: parseRemote(job.job_title, description, job.job_is_remote),
        skills: parseSkills(job.job_title, description),
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
