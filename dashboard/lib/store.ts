import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import type { Job, JobSource, Status } from "./types.js";

let cachedClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

function findCsvPath(): string | null {
  const candidates = [
    resolve(process.cwd(), "data/jobs.csv"),
    resolve(process.cwd(), "../data/jobs.csv"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function parseCsvJobs(content: string): Job[] {
  if (!content || !content.trim()) return [];
  const rows = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  return rows.map((r, i) => {
    const skills = r.skills ? r.skills.split("|").filter(Boolean) : [];
    let sources: JobSource[] = [];
    try {
      sources = JSON.parse(r.sources || "[]");
    } catch {
      sources = r.url ? [{ site: "direct", url: r.url }] : [];
    }

    return {
      id: r.id ?? `job-${i}`,
      title: r.title ?? "",
      company: r.company ?? "",
      city: r.city || null,
      level: (r.level as Job["level"]) || null,
      expMin: r.expMin ? Number(r.expMin) : null,
      expMax: r.expMax ? Number(r.expMax) : null,
      salaryMin: r.salaryMin ? Number(r.salaryMin) : null,
      salaryMax: r.salaryMax ? Number(r.salaryMax) : null,
      currency: (r.currency as Job["currency"]) || null,
      negotiable: r.negotiable === "true",
      remote: (r.remote as Job["remote"]) || null,
      skills,
      sources,
      description: r.description ?? "",
      postedAt: r.postedAt || null,
      firstSeenAt: r.firstSeenAt || new Date().toISOString(),
      matched: r.matched === "true",
      status: (r.status as Status) || "new",
    };
  });
}

export async function fetchJobs(): Promise<Job[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .order("first_seen_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      return data.map((r) => ({
        id: r.id,
        title: r.title,
        company: r.company,
        city: r.city,
        level: r.level,
        expMin: r.exp_min,
        expMax: r.exp_max,
        salaryMin: r.salary_min != null ? Number(r.salary_min) : null,
        salaryMax: r.salary_max != null ? Number(r.salary_max) : null,
        currency: r.currency,
        negotiable: r.negotiable,
        remote: r.remote,
        skills: r.skills ?? [],
        sources: r.sources ?? [],
        description: r.description ?? "",
        postedAt: r.posted_at,
        firstSeenAt: r.first_seen_at,
        matched: r.matched,
        status: r.status,
      }));
    }
  }

  // Fallback to local CSV file
  const csvPath = findCsvPath();
  if (csvPath) {
    const content = readFileSync(csvPath, "utf8");
    return parseCsvJobs(content);
  }

  // Fallback mock jobs for development/preview
  return [
    {
      id: "sample-1",
      title: "Senior Frontend Engineer (React/TypeScript)",
      company: "Kite Metric Co",
      city: "Ho Chi Minh City",
      level: "senior",
      expMin: 4,
      expMax: 6,
      salaryMin: 35000000,
      salaryMax: 50000000,
      currency: "VND",
      negotiable: false,
      remote: "hybrid",
      skills: ["react", "typescript", "tailwind", "next.js"],
      sources: [
        { site: "itviec", url: "https://itviec.com" },
        { site: "topdev", url: "https://topdev.vn" },
      ],
      description: "We are looking for a Senior Frontend Engineer with 4+ years of experience with React, TypeScript, and modern web architectures. Generous benefits, hybrid working model.",
      postedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      firstSeenAt: new Date().toISOString(),
      matched: true,
      status: "new",
    },
    {
      id: "sample-2",
      title: "Full Stack Developer (Node.js & React)",
      company: "VNG Corporation",
      city: "Ho Chi Minh City",
      level: "middle",
      expMin: 2,
      expMax: 4,
      salaryMin: 25000000,
      salaryMax: 40000000,
      currency: "VND",
      negotiable: false,
      remote: "remote",
      skills: ["react", "node.js", "typescript", "graphql"],
      sources: [{ site: "linkedin", url: "https://linkedin.com" }],
      description: "Build high-scale game platform services with React and Node.js. 100% remote within Vietnam.",
      postedAt: new Date(Date.now() - 3600000 * 20).toISOString(),
      firstSeenAt: new Date().toISOString(),
      matched: true,
      status: "saved",
    },
    {
      id: "sample-3",
      title: "Junior ReactJS Developer",
      company: "FPT Software",
      city: "Hanoi",
      level: "junior",
      expMin: 1,
      expMax: 2,
      salaryMin: 15000000,
      salaryMax: 22000000,
      currency: "VND",
      negotiable: true,
      remote: "onsite",
      skills: ["react", "javascript", "html", "css"],
      sources: [{ site: "jsearch", url: "https://google.com" }],
      description: "Chương trình tuyển dụng Junior ReactJS. Đào tạo nâng cao, hỗ trợ chứng chỉ chuyên nghiệp.",
      postedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      firstSeenAt: new Date().toISOString(),
      matched: false,
      status: "applied",
    },
  ];
}

export async function updateJobStatus(id: string, status: Status): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from("jobs").update({ status }).eq("id", id);
    if (!error) return true;
  }

  // Update in CSV if exists
  const csvPath = findCsvPath();
  if (csvPath) {
    try {
      const content = readFileSync(csvPath, "utf8");
      const rows = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
      let found = false;
      const updatedRows = rows.map((r) => {
        if (r.id === id) {
          found = true;
          return { ...r, status };
        }
        return r;
      });
      if (found) {
        const columns = Object.keys(rows[0] ?? {});
        writeFileSync(csvPath, stringify(updatedRows, { header: true, columns }));
        return true;
      }
    } catch (e) {
      console.error("Failed to update status in CSV", e);
    }
  }

  return true;
}
