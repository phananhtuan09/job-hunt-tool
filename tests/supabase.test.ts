import { describe, expect, it } from "vitest";
import { runPipeline } from "../src/pipeline.js";
import { createSupabaseStore, jobToRow, rowToJob, type JobStore, type SupabaseRow } from "../src/supabase.js";
import type { Job, RawJob, SourceAdapter } from "../src/types.js";
import { testConfig, testJob } from "./helpers.js";

describe("supabase store", () => {
  const sampleJob: Job = {
    id: "abc-123",
    title: "Senior React Developer",
    company: "Acme Corp",
    city: "Ho Chi Minh City",
    level: "senior",
    expMin: 3,
    expMax: 5,
    salaryMin: 30000000,
    salaryMax: 45000000,
    currency: "VND",
    negotiable: false,
    remote: "hybrid",
    skills: ["react", "typescript"],
    sources: [{ site: "topdev", url: "https://topdev.vn/1" }],
    description: "Sample job description",
    postedAt: "2026-10-12T00:00:00.000Z",
    firstSeenAt: "2026-10-12T00:00:00.000Z",
    matched: true,
    status: "new",
  };

  it("converts Job to SupabaseRow and back without losing fields", () => {
    const row = jobToRow(sampleJob);
    expect(row.salary_min).toBe(30000000);
    expect(row.exp_min).toBe(3);
    expect(row.skills).toEqual(["react", "typescript"]);

    const restored = rowToJob(row);
    expect(restored).toEqual(sampleJob);
  });

  it("implements JobStore readJobs, writeJobs, and quota management with Supabase client", async () => {
    const storedRows: SupabaseRow[] = [];
    const storedQuota = new Map<string, { source: string; month: string; used: number }>();

    const fakeClient = {
      from: (table: string) => {
        if (table === "jobs") {
          return {
            select: async () => ({ data: storedRows, error: null }),
            upsert: async (rows: SupabaseRow[]) => {
              for (const r of rows) {
                const idx = storedRows.findIndex((existing) => existing.id === r.id);
                if (idx >= 0) storedRows[idx] = r;
                else storedRows.push(r);
              }
              return { error: null };
            },
          };
        }
        if (table === "quota") {
          return {
            select: () => ({
              eq: (_f1: string, sourceVal: string) => ({
                eq: (_f2: string, monthVal: string) => ({
                  maybeSingle: async () => {
                    const found = storedQuota.get(`${sourceVal}:${monthVal}`);
                    return { data: found ? { used: found.used } : null, error: null };
                  },
                }),
              }),
            }),
            upsert: async (record: { source: string; month: string; used: number }) => {
              storedQuota.set(`${record.source}:${record.month}`, record);
              return { error: null };
            },
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    };

    const store = createSupabaseStore({ client: fakeClient as any });

    // Initial state is empty
    expect(await store.readJobs()).toEqual([]);
    expect(await store.quotaUsed("serpapi", new Date("2026-10-12"))).toBe(0);

    // Write jobs
    await store.writeJobs([sampleJob]);
    const jobs = await store.readJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.title).toBe("Senior React Developer");

    // Add quota
    await store.addQuotaUsed("serpapi", new Date("2026-10-12"), 2);
    expect(await store.quotaUsed("serpapi", new Date("2026-10-12"))).toBe(2);
  });

  it("pipeline runs cleanly against pluggable JobStore", async () => {
    const memoryJobs: Job[] = [];
    const memoryQuota = new Map<string, number>();

    const store: JobStore = {
      async readJobs() {
        return [...memoryJobs];
      },
      async writeJobs(jobs) {
        memoryJobs.splice(0, memoryJobs.length, ...jobs);
      },
      async quotaUsed(source, now) {
        return memoryQuota.get(`${source}:${now.toISOString().slice(0, 7)}`) ?? 0;
      },
      async addQuotaUsed(source, now, count = 1) {
        const key = `${source}:${now.toISOString().slice(0, 7)}`;
        memoryQuota.set(key, (memoryQuota.get(key) ?? 0) + count);
      },
    };

    const adapter: SourceAdapter = {
      name: "custom",
      fetch: async () => [testJob({ id: "plug-1" }) as unknown as RawJob],
      normalize: (raw) => raw as unknown as Job,
    };

    const result = await runPipeline(testConfig(), {
      adapters: [adapter],
      notifier: null,
      jobsPath: "",
      quotaPath: "",
      store,
      delayMs: 0,
    });

    expect(result.newJobs).toBe(1);
    expect(memoryJobs).toHaveLength(1);
    expect(memoryJobs[0]!.id).toBe("plug-1");
  });
});
