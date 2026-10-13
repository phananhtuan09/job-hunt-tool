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

const topdevJobSchema = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string(),
  content: z.string().optional(),
  company: z
    .object({
      id: z.union([z.number(), z.string()]).optional(),
      display_name: z.string(),
      detail_url: z.string().optional(),
    })
    .optional(),
  skills_str: z.string().optional(),
  addresses: z
    .object({
      sort_addresses: z.string().optional(),
      full_addresses: z.array(z.string()).optional(),
      address_region_list: z.string().optional(),
    })
    .optional(),
  detail_url: z.string().optional(),
  salary: z
    .object({
      is_negotiable: z.union([z.string(), z.number(), z.boolean()]).optional(),
      unit: z.string().optional(),
      min: z.union([z.string(), z.number()]).optional(),
      max: z.union([z.string(), z.number()]).optional(),
      currency: z.string().optional(),
    })
    .optional(),
  published: z
    .object({
      date: z.string().optional(),
      datetime: z.string().optional(),
      since: z.string().optional(),
    })
    .optional(),
});

const responseSchema = z.object({
  data: z.array(z.unknown()).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export interface TopDevOptions {
  fetchImpl?: typeof fetch;
}

export function createTopDevAdapter(options: TopDevOptions = {}): SourceAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    name: "topdev",

    async fetch(query: SourceQuery): Promise<RawJob[]> {
      const url = new URL("https://api.topdev.vn/td/v2/jobs");
      url.searchParams.set(
        "fields[job]",
        "id,title,salary,company,addresses,detail_url,skills_str,content,published"
      );
      url.searchParams.set("keyword", query.keyword);
      url.searchParams.set("page", "1");

      const response = await fetchImpl(url, {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`TopDev HTTP ${response.status}`);
      }

      const body = responseSchema.parse(await response.json());
      return (body.data ?? []).filter((r): r is RawJob => topdevJobSchema.safeParse(r).success);
    },

    normalize(raw: RawJob, now = new Date()): Job {
      const item = topdevJobSchema.parse(raw);
      const company = item.company?.display_name ?? "";
      const description = item.content ? item.content.replace(/<[^>]+>/g, " ").trim() : "";
      const rawLocation = item.addresses?.sort_addresses ?? item.addresses?.full_addresses?.[0] ?? "";
      const city = normalizeCity(rawLocation);

      let salaryMin: number | null = null;
      let salaryMax: number | null = null;
      let currency: Currency | null = null;
      let negotiable = false;

      const sal = item.salary;
      if (sal) {
        if (sal.is_negotiable === "1" || sal.is_negotiable === 1 || sal.is_negotiable === true) {
          negotiable = true;
        }
        const minStr = String(sal.min ?? "").trim();
        const maxStr = String(sal.max ?? "").trim();
        const numMin = minStr !== "*" && minStr !== "" ? Number(minStr) : null;
        const numMax = maxStr !== "*" && maxStr !== "" ? Number(maxStr) : null;

        if (numMin != null || numMax != null) {
          const factor = sal.unit?.toUpperCase() === "YEAR" ? 1 / 12 : 1;
          salaryMin = numMin != null ? Math.round(numMin * factor) : null;
          salaryMax = numMax != null ? Math.round(numMax * factor) : null;
          const cur = sal.currency?.toUpperCase();
          if (cur === "VND" || cur === "USD") currency = cur as Currency;
        }
      }

      if (salaryMin == null && salaryMax == null && !negotiable) {
        const parsedSalary = parseSalary(description);
        salaryMin = parsedSalary.salaryMin;
        salaryMax = parsedSalary.salaryMax;
        currency = parsedSalary.currency;
        negotiable = parsedSalary.negotiable;
      }

      const sources: JobSource[] = item.detail_url ? [{ site: "topdev", url: item.detail_url }] : [];
      const parsedExp = parseExperience(description);

      let postedAt: string | null = null;
      if (item.published?.since) {
        postedAt = parsePostedAt(item.published.since, now);
      }
      if (!postedAt && item.published?.date) {
        const parts = item.published.date.split("-");
        if (parts.length === 3) {
          // DD-MM-YYYY
          postedAt = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00.000Z`).toISOString();
        }
      }

      const tags = (item.skills_str ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const isRemote = /\b(remote|work from home|làm việc từ xa)\b/i.test(`${item.title} ${description}`);

      return {
        id: jobId(company, item.title, city),
        title: item.title,
        company,
        city,
        level: parseLevel(item.title),
        expMin: parsedExp.expMin,
        expMax: parsedExp.expMax,
        salaryMin,
        salaryMax,
        currency,
        negotiable,
        remote: parseRemote(item.title, description, isRemote),
        skills: Array.from(new Set([...tags, ...parseSkills(item.title, description)])),
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
