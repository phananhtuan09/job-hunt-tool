import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Job, JobSource } from "./types.js";

export interface JobStore {
  readJobs(): Promise<Job[]>;
  writeJobs(jobs: Job[]): Promise<void>;
  quotaUsed(source: string, now: Date): Promise<number>;
  addQuotaUsed(source: string, now: Date, count?: number): Promise<void>;
}

export interface SupabaseRow {
  id: string;
  title: string;
  company: string;
  city: string | null;
  level: string | null;
  exp_min: number | null;
  exp_max: number | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  negotiable: boolean;
  remote: string | null;
  skills: string[];
  sources: JobSource[];
  description: string;
  posted_at: string | null;
  first_seen_at: string;
  matched: boolean;
  status: string;
}

export function jobToRow(job: Job): SupabaseRow {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    city: job.city,
    level: job.level,
    exp_min: job.expMin,
    exp_max: job.expMax,
    salary_min: job.salaryMin,
    salary_max: job.salaryMax,
    currency: job.currency,
    negotiable: job.negotiable,
    remote: job.remote,
    skills: job.skills,
    sources: job.sources,
    description: job.description,
    posted_at: job.postedAt,
    first_seen_at: job.firstSeenAt,
    matched: job.matched,
    status: job.status,
  };
}

export function rowToJob(row: SupabaseRow): Job {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    city: row.city,
    level: row.level as Job["level"],
    expMin: row.exp_min,
    expMax: row.exp_max,
    salaryMin: row.salary_min != null ? Number(row.salary_min) : null,
    salaryMax: row.salary_max != null ? Number(row.salary_max) : null,
    currency: row.currency as Job["currency"],
    negotiable: row.negotiable,
    remote: row.remote as Job["remote"],
    skills: row.skills ?? [],
    sources: (row.sources ?? []) as JobSource[],
    description: row.description ?? "",
    postedAt: row.posted_at,
    firstSeenAt: row.first_seen_at,
    matched: row.matched,
    status: row.status as Job["status"],
  };
}

export interface SupabaseStoreOptions {
  url?: string;
  serviceKey?: string;
  client?: SupabaseClient;
}

export function createSupabaseStore(options: SupabaseStoreOptions): JobStore {
  const client =
    options.client ??
    createClient(options.url!, options.serviceKey!, {
      auth: { persistSession: false },
    });

  const monthOf = (d: Date) => d.toISOString().slice(0, 7);

  return {
    async readJobs(): Promise<Job[]> {
      const { data, error } = await client.from("jobs").select("*");
      if (error) throw new Error(`Supabase readJobs failed: ${error.message}`);
      return (data as unknown as SupabaseRow[]).map(rowToJob);
    },

    async writeJobs(jobs: Job[]): Promise<void> {
      if (jobs.length === 0) return;
      const rows = jobs.map(jobToRow);
      const { error } = await client.from("jobs").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(`Supabase writeJobs failed: ${error.message}`);
    },

    async quotaUsed(source: string, now: Date): Promise<number> {
      const month = monthOf(now);
      const { data, error } = await client
        .from("quota")
        .select("used")
        .eq("source", source)
        .eq("month", month)
        .maybeSingle();

      if (error) throw new Error(`Supabase quotaUsed failed: ${error.message}`);
      return data?.used ?? 0;
    },

    async addQuotaUsed(source: string, now: Date, count = 1): Promise<void> {
      const month = monthOf(now);
      const current = await this.quotaUsed(source, now);
      const { error } = await client
        .from("quota")
        .upsert({ source, month, used: current + count, updated_at: now.toISOString() }, { onConflict: "source" });
      if (error) throw new Error(`Supabase addQuotaUsed failed: ${error.message}`);
    },
  };
}
