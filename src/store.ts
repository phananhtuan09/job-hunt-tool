import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import type { Job, JobSource } from "./types.js";

const COLUMNS = [
  "id", "title", "company", "url", "city", "level", "expMin", "expMax", "salaryMin", "salaryMax", "currency",
  "negotiable", "remote", "skills", "sources", "description", "postedAt", "firstSeenAt", "matched", "status",
] as const;

function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function writeAtomic(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.tmp`, content);
  renameSync(`${path}.tmp`, path);
}

const text = (v: string) => (v === "" ? null : v);
const num = (v: string) => (v === "" ? null : Number(v));

export function readJobs(path: string): Job[] {
  const content = readText(path);
  if (!content) return [];
  const rows = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    company: r.company as string,
    city: text(r.city as string),
    level: text(r.level as string) as Job["level"],
    expMin: num(r.expMin as string),
    expMax: num(r.expMax as string),
    salaryMin: num(r.salaryMin as string),
    salaryMax: num(r.salaryMax as string),
    currency: text(r.currency as string) as Job["currency"],
    negotiable: r.negotiable === "true",
    remote: text(r.remote as string) as Job["remote"],
    skills: r.skills ? (r.skills as string).split("|") : [],
    sources: JSON.parse((r.sources as string) || "[]") as JobSource[],
    description: r.description as string,
    postedAt: text(r.postedAt as string),
    firstSeenAt: r.firstSeenAt as string,
    matched: r.matched === "true",
    status: r.status as Job["status"],
  }));
}

export function writeJobs(path: string, jobs: Job[]): void {
  const rows = jobs.map((j) => ({
    ...j,
    url: j.sources[0]?.url ?? "",
    skills: j.skills.join("|"),
    sources: JSON.stringify(j.sources),
  }));
  writeAtomic(path, stringify(rows, { header: true, columns: [...COLUMNS], cast: { boolean: (v) => String(v) } }));
}

type Quota = Record<string, { month: string; used: number }>;

function readQuota(path: string): Quota {
  const content = readText(path);
  return content ? (JSON.parse(content) as Quota) : {};
}

const monthOf = (now: Date) => now.toISOString().slice(0, 7);

export function quotaUsed(path: string, source: string, now: Date): number {
  const entry = readQuota(path)[source];
  return entry && entry.month === monthOf(now) ? entry.used : 0;
}

export function addQuotaUsed(path: string, source: string, now: Date, count = 1): void {
  const quota = readQuota(path);
  quota[source] = { month: monthOf(now), used: quotaUsed(path, source, now) + count };
  writeAtomic(path, JSON.stringify(quota, null, 2));
}
