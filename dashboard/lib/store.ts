import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];

  // Simple CSV parser for stored rows
  const headers = lines[0]!.split(",");
  const jobs: Job[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    // Match CSV columns handling quoted values
    const regex = /(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g;
    const values: string[] = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      values.push((match[1] ? match[1].replace(/""/g, '"') : match[2] ?? "").trim());
    }
    if (values.length < 5) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx] ?? "";
    });

    try {
      const skills = row.skills ? row.skills.split("|").filter(Boolean) : [];
      let sources: JobSource[] = [];
      try {
        sources = JSON.parse(row.sources || "[]");
      } catch {
        sources = [];
      }

      jobs.push({
        id: row.id ?? `job-${i}`,
        title: row.title ?? "",
        company: row.company ?? "",
        city: row.city || null,
        level: (row.level as Job["level"]) || null,
        expMin: row.expMin ? Number(row.expMin) : null,
        expMax: row.expMax ? Number(row.expMax) : null,
        salaryMin: row.salaryMin ? Number(row.salaryMin) : null,
        salaryMax: row.salaryMax ? Number(row.salaryMax) : null,
        currency: (row.currency as Job["currency"]) || null,
        negotiable: row.negotiable === "true",
        remote: (row.remote as Job["remote"]) || null,
        skills,
        sources,
        description: row.description ?? "",
        postedAt: row.postedAt || null,
        firstSeenAt: row.firstSeenAt || new Date().toISOString(),
        matched: row.matched === "true",
        status: (row.status as Status) || "new",
      });
    } catch {
      // skip corrupted row
    }
  }
  return jobs;
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
      const lines = content.split("\n");
      if (lines.length > 1) {
        // Find column index for status and id
        const headers = lines[0]!.split(",");
        const statusIdx = headers.indexOf("status");
        const idIdx = headers.indexOf("id");
        if (statusIdx >= 0 && idIdx >= 0) {
          const updatedLines = lines.map((line, idx) => {
            if (idx === 0) return line;
            const parts = line.split(",");
            if (parts[idIdx] === id) {
              parts[statusIdx] = status;
              return parts.join(",");
            }
            return line;
          });
          writeFileSync(csvPath, updatedLines.join("\n"));
          return true;
        }
      }
    } catch {
      // ignore
    }
  }

  return true;
}
