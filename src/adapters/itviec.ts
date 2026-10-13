import * as cheerio from "cheerio";
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

const itviecRawSchema = z.object({
  title: z.string(),
  url: z.string(),
  company: z.string(),
  cityText: z.string().optional(),
  salaryText: z.string().optional(),
  remoteText: z.string().optional(),
  postedText: z.string().optional(),
  tags: z.array(z.string()).optional(),
  description: z.string().optional(),
});

export interface ITviecOptions {
  fetchImpl?: typeof fetch;
}

export function createITviecAdapter(options: ITviecOptions = {}): SourceAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    name: "itviec",

    async fetch(query: SourceQuery): Promise<RawJob[]> {
      const slug = encodeURIComponent(query.keyword.replace(/\s+/g, "-").toLowerCase());
      const url = `https://itviec.com/it-jobs/${slug}`;

      const response = await fetchImpl(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        throw new Error(`ITviec HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const items: RawJob[] = [];
      $(".job-card").each((_, el) => {
        const $el = $(el);
        const title = $el.find("h3 a").first().text().trim();
        const link = $el.find("h3 a").first().attr("href")?.split("?")[0] || "";
        const fullUrl = link.startsWith("http") ? link : `https://itviec.com${link}`;

        // Find company: take text of company link
        const company = $el
          .find("a[href*='/companies/']")
          .filter((_, a) => $(a).text().trim().length > 0)
          .first()
          .text()
          .trim();

        if (!title || !company) return;

        const salaryText = $el.find(".salary").text().trim();
        const cityText =
          $el
            .find("div[title*='Ho Chi Minh'], div[title*='Ha Noi'], div[title*='Hanoi'], div[title*='Da Nang']")
            .first()
            .attr("title") ||
          $el.find(".text-truncate[title]").first().attr("title") ||
          "";

        const textAll = $el.text();
        const remoteText = /remote/i.test(textAll) ? "remote" : /hybrid/i.test(textAll) ? "hybrid" : "";
        const postedText = $el.find("span:contains('Posted')").first().text().replace(/Posted/i, "").trim();
        const tags = $el
          .find("a.itag")
          .map((_, t) => $(t).text().trim())
          .get();
        const description = $el.find(".job-description").text().trim();

        items.push({
          title,
          url: fullUrl,
          company,
          cityText,
          salaryText,
          remoteText,
          postedText,
          tags,
          description,
        });
      });

      return items;
    },

    normalize(raw: RawJob, now = new Date()): Job {
      const item = itviecRawSchema.parse(raw);
      const description = item.description ?? "";
      const city = normalizeCity(item.cityText);

      const salaryText =
        item.salaryText && !/sign in to view/i.test(item.salaryText)
          ? item.salaryText
          : /thỏa thuận|negotiable|sign in to view/i.test(`${item.salaryText ?? ""} ${description}`)
            ? "thỏa thuận"
            : undefined;
      const parsedSalary = parseSalary(salaryText);
      const parsedExp = parseExperience(description);

      const sources: JobSource[] = [{ site: "itviec", url: item.url }];

      return {
        id: jobId(item.company, item.title, city),
        title: item.title,
        company: item.company,
        city,
        level: parseLevel(item.title),
        expMin: parsedExp.expMin,
        expMax: parsedExp.expMax,
        salaryMin: parsedSalary.salaryMin,
        salaryMax: parsedSalary.salaryMax,
        currency: parsedSalary.currency,
        negotiable: parsedSalary.negotiable,
        remote: item.remoteText === "remote" ? "remote" : item.remoteText === "hybrid" ? "hybrid" : parseRemote(item.title, description),
        skills: Array.from(new Set([...(item.tags?.map((t) => t.toLowerCase()) ?? []), ...parseSkills(item.title, description)])),
        sources,
        description,
        postedAt: parsePostedAt(item.postedText, now),
        firstSeenAt: now.toISOString(),
        matched: false,
        status: "new",
      };
    },
  };
}
