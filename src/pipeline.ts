import type { Config } from "./config.js";
import { evaluateMatch } from "./match.js";
import { addQuotaUsed, quotaUsed, readJobs, writeJobs } from "./store.js";
import type { JobStore } from "./supabase.js";
import type { Notifier } from "./telegram.js";
import type { Job, SourceAdapter } from "./types.js";

export const MAX_NOTIFICATIONS_PER_RUN = 20;

export interface SourceStats {
  fetched: number;
  newJobs: number;
  failedQueries: number;
}

export interface PipelineDeps {
  adapters: SourceAdapter[];
  notifier: Notifier | null;
  jobsPath: string;
  quotaPath: string;
  store?: JobStore;
  llmNormalizer?: { enhance(job: Job): Promise<Job> };
  now?: Date;
  delayMs?: number;
  queryTimeoutMs?: number;
  log?: (message: string) => void;
}

export interface RunResult {
  fetched: number;
  newJobs: number;
  notified: number;
  failedQueries: number;
  notifyFailed: boolean;
  sources: Record<string, SourceStats>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withTimeout<T>(promise: Promise<T>, ms: number, message = "Operation timed out"): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function mergeSources(target: Job, extra: Job): boolean {
  let changed = false;
  for (const source of extra.sources) {
    if (!target.sources.some((s) => s.url === source.url)) {
      target.sources.push(source);
      changed = true;
    }
  }
  return changed;
}

export async function runPipeline(config: Config, deps: PipelineDeps): Promise<RunResult> {
  const now = deps.now ?? new Date();
  const log = deps.log ?? (() => {});
  const delayMs = deps.delayMs ?? 1000;
  const timeoutMs = deps.queryTimeoutMs ?? 30000;

  const stored = deps.store ? await deps.store.readJobs() : readJobs(deps.jobsPath);
  const byId = new Map(stored.map((j) => [j.id, j]));
  const seenThisRun = new Map<string, Job>();
  const sourceStats: Record<string, SourceStats> = {};
  const jobOriginSource = new Map<string, string>();

  let succeededQueries = 0;
  let failedQueries = 0;
  let fetched = 0;

  for (const adapter of deps.adapters) {
    if (!sourceStats[adapter.name]) {
      sourceStats[adapter.name] = { fetched: 0, newJobs: 0, failedQueries: 0 };
    }
    const stats = sourceStats[adapter.name]!;

    for (const keyword of config.keywords) {
      for (const location of config.locations) {
        const usedQuota = deps.store
          ? await deps.store.quotaUsed(adapter.name, now)
          : quotaUsed(deps.quotaPath, adapter.name, now);

        if (adapter.monthlyQuota !== undefined && usedQuota >= adapter.monthlyQuota) {
          log(`${adapter.name}: monthly quota reached, skipping`);
          continue;
        }
        try {
          const fetchPromise = adapter.fetch({ keyword, location });
          const raws = await withTimeout(fetchPromise, timeoutMs, `${adapter.name} query timed out after ${timeoutMs}ms`);
          if (deps.store) {
            await deps.store.addQuotaUsed(adapter.name, now);
          } else {
            addQuotaUsed(deps.quotaPath, adapter.name, now);
          }
          succeededQueries++;
          stats.fetched += raws.length;

          for (const raw of raws) {
            const job = adapter.normalize(raw, now);
            fetched++;
            const earlier = seenThisRun.get(job.id);
            if (earlier) {
              mergeSources(earlier, job);
            } else {
              seenThisRun.set(job.id, job);
              jobOriginSource.set(job.id, adapter.name);
            }
          }
        } catch (error) {
          failedQueries++;
          stats.failedQueries++;
          log(`${adapter.name}: query "${keyword}" in "${location}" failed: ${(error as Error).message}`);
        }
        await sleep(delayMs);
      }
    }
  }

  if (succeededQueries === 0 && failedQueries > 0) {
    throw new Error("All source queries failed; nothing was stored or notified");
  }

  let storedChanged = false;
  const newJobs: Job[] = [];
  for (const job of seenThisRun.values()) {
    const existing = byId.get(job.id);
    if (existing) {
      if (mergeSources(existing, job)) storedChanged = true;
    } else {
      let finalJob = job;
      if (deps.llmNormalizer) {
        finalJob = await deps.llmNormalizer.enhance(job);
      }
      finalJob.matched = evaluateMatch(finalJob, config, now);
      newJobs.push(finalJob);
      const origin = jobOriginSource.get(job.id);
      if (origin && sourceStats[origin]) {
        sourceStats[origin]!.newJobs++;
      }
    }
  }

  // Summary log per source
  for (const [name, stats] of Object.entries(sourceStats)) {
    log(`${name}: fetched ${stats.fetched}, new ${stats.newJobs}, failed ${stats.failedQueries}`);
  }

  const telegram = config.notify.telegram;
  const toNotify = deps.notifier && telegram.enabled ? newJobs.filter((j) => j.matched || !telegram.onlyMatched) : [];
  const notifiedIds = new Set<string>();
  let notifyFailed = false;
  for (const job of toNotify.slice(0, MAX_NOTIFICATIONS_PER_RUN)) {
    try {
      await deps.notifier!.sendJob(job);
      notifiedIds.add(job.id);
    } catch (error) {
      notifyFailed = true;
      log(`telegram: send failed: ${(error as Error).message}`);
      break;
    }
  }
  const pending = toNotify.length - notifiedIds.size;
  if (pending > 0 && !notifyFailed) {
    await deps.notifier!.sendText(`${pending} more new jobs will be sent in the next run.`).catch(() => {});
  }

  // Jobs that still need a notification stay unstored so the next run retries them.
  const toStore = newJobs.filter((j) => !toNotify.includes(j) || notifiedIds.has(j.id));
  if (toStore.length > 0 || storedChanged) {
    if (deps.store) {
      await deps.store.writeJobs([...stored, ...toStore]);
    } else {
      writeJobs(deps.jobsPath, [...stored, ...toStore]);
    }
  }

  return {
    fetched,
    newJobs: newJobs.length,
    notified: notifiedIds.size,
    failedQueries,
    notifyFailed,
    sources: sourceStats,
  };
}
