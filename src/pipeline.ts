import type { Config } from "./config.js";
import { evaluateMatch } from "./match.js";
import { addQuotaUsed, quotaUsed, readJobs, writeJobs } from "./store.js";
import type { Notifier } from "./telegram.js";
import type { Job, SourceAdapter } from "./types.js";

export const MAX_NOTIFICATIONS_PER_RUN = 20;

export interface PipelineDeps {
  adapters: SourceAdapter[];
  notifier: Notifier | null;
  jobsPath: string;
  quotaPath: string;
  now?: Date;
  delayMs?: number;
  log?: (message: string) => void;
}

export interface RunResult {
  fetched: number;
  newJobs: number;
  notified: number;
  failedQueries: number;
  notifyFailed: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  const stored = readJobs(deps.jobsPath);
  const byId = new Map(stored.map((j) => [j.id, j]));
  const seenThisRun = new Map<string, Job>();
  let succeededQueries = 0;
  let failedQueries = 0;
  let fetched = 0;

  for (const adapter of deps.adapters) {
    for (const keyword of config.keywords) {
      for (const location of config.locations) {
        if (adapter.monthlyQuota !== undefined && quotaUsed(deps.quotaPath, adapter.name, now) >= adapter.monthlyQuota) {
          log(`${adapter.name}: monthly quota reached, skipping`);
          continue;
        }
        try {
          const raws = await adapter.fetch({ keyword, location });
          addQuotaUsed(deps.quotaPath, adapter.name, now);
          succeededQueries++;
          for (const raw of raws) {
            const job = adapter.normalize(raw, now);
            fetched++;
            const earlier = seenThisRun.get(job.id);
            if (earlier) mergeSources(earlier, job);
            else seenThisRun.set(job.id, job);
          }
        } catch (error) {
          failedQueries++;
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
      job.matched = evaluateMatch(job, config, now);
      newJobs.push(job);
    }
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
  if (toStore.length > 0 || storedChanged) writeJobs(deps.jobsPath, [...stored, ...toStore]);

  return { fetched, newJobs: newJobs.length, notified: notifiedIds.size, failedQueries, notifyFailed };
}
