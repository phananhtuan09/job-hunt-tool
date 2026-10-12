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
import type { Job, JobSource, RawJob, SourceAdapter, SourceQuery } from "../types.js";

const serpJobSchema = z.object({
  title: z.string(),
  company_name: z.string(),
  location: z.string().optional(),
  via: z.string().optional(),
  description: z.string().optional(),
  share_link: z.string().optional(),
  extensions: z.array(z.string()).optional(),
  apply_options: z.array(z.object({ title: z.string(), link: z.string() })).optional(),
  detected_extensions: z
    .object({ posted_at: z.string().optional(), salary: z.string().optional(), work_from_home: z.boolean().optional() })
    .optional(),
});

const responseSchema = z.object({ jobs_results: z.array(z.unknown()).optional(), error: z.string().optional() });

export const SERPAPI_MONTHLY_QUOTA = 240; // free tier is 250; keep a margin

function datePostedChip(days: number): string {
  if (days <= 1) return "today";
  if (days <= 3) return "3days";
  if (days <= 7) return "week";
  return "month";
}

export interface SerpApiOptions {
  apiKey: string;
  postedWithinDays: number;
  fetchImpl?: typeof fetch;
}

export function createSerpApiAdapter(options: SerpApiOptions): SourceAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    name: "serpapi",
    monthlyQuota: SERPAPI_MONTHLY_QUOTA,

    async fetch(query: SourceQuery): Promise<RawJob[]> {
      const url = new URL("https://serpapi.com/search.json");
      url.searchParams.set("engine", "google_jobs");
      url.searchParams.set("q", query.keyword);
      url.searchParams.set("location", query.location);
      url.searchParams.set("gl", "vn");
      url.searchParams.set("hl", "vi");
      url.searchParams.set("chips", `date_posted:${datePostedChip(options.postedWithinDays)}`);
      url.searchParams.set("api_key", options.apiKey);
      const response = await fetchImpl(url);
      if (!response.ok) throw new Error(`SerpApi HTTP ${response.status}`);
      const body = responseSchema.parse(await response.json());
      if (body.error && !body.jobs_results) {
        // SerpApi reports "no results" as an error string, which is not a failure.
        if (/hasn't returned any results/i.test(body.error)) return [];
        throw new Error(`SerpApi error: ${body.error}`);
      }
      return (body.jobs_results ?? []).filter((r): r is RawJob => serpJobSchema.safeParse(r).success);
    },

    normalize(raw: RawJob, now = new Date()): Job {
      const job = serpJobSchema.parse(raw);
      const description = job.description ?? "";
      const city = normalizeCity(job.location);
      const salaryText =
        job.detected_extensions?.salary ?? job.extensions?.find((e) => /\d.*(₫|\$|vnd|usd|\btr\b|triệu|\dk\b)/i.test(e));
      const sources: JobSource[] = (job.apply_options ?? []).map((o) => ({
        site: o.title.replace(/^(apply|ứng tuyển)\s+(on|at|trên|tại)\s+/i, ""),
        url: o.link,
      }));
      if (sources.length === 0) {
        sources.push({ site: job.via?.replace(/^(via|qua)\s+/i, "") ?? "google_jobs", url: job.share_link ?? "" });
      }
      return {
        id: jobId(job.company_name, job.title, city),
        title: job.title,
        company: job.company_name,
        city,
        level: parseLevel(job.title),
        ...parseExperience(description),
        ...parseSalary(salaryText),
        remote: parseRemote(job.title, description, job.detected_extensions?.work_from_home),
        skills: parseSkills(job.title, description),
        sources,
        description,
        postedAt: parsePostedAt(job.detected_extensions?.posted_at, now),
        firstSeenAt: now.toISOString(),
        matched: false,
        status: "new",
      };
    },
  };
}
