import { createITviecAdapter } from "./adapters/itviec.js";
import { createJobSpyAdapter } from "./adapters/jobspy.js";
import { createJSearchAdapter } from "./adapters/jsearch.js";
import { createSerpApiAdapter } from "./adapters/serpapi.js";
import { createTopDevAdapter } from "./adapters/topdev.js";
import { loadConfig } from "./config.js";
import { LlmNormalizer } from "./llm.js";
import { runPipeline } from "./pipeline.js";
import { createSupabaseStore } from "./supabase.js";
import { createTelegramNotifier } from "./telegram.js";
import type { SourceAdapter } from "./types.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return value;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const adapters: SourceAdapter[] = [];

  if (config.sources.serpapi.enabled) {
    adapters.push(createSerpApiAdapter({ apiKey: requireEnv("SERPAPI_KEY"), postedWithinDays: config.postedWithinDays }));
  }

  if (config.sources.jsearch.enabled) {
    adapters.push(createJSearchAdapter({ apiKey: requireEnv("RAPIDAPI_KEY"), postedWithinDays: config.postedWithinDays }));
  }

  if (config.sources.jobspy.enabled) {
    adapters.push(createJobSpyAdapter({ sites: config.sources.jobspy.sites, postedWithinDays: config.postedWithinDays }));
  }

  if (config.sources.itviec.enabled) {
    adapters.push(createITviecAdapter());
  }

  if (config.sources.topdev.enabled) {
    adapters.push(createTopDevAdapter());
  }

  const notifier = config.notify.telegram.enabled
    ? createTelegramNotifier({ token: requireEnv("TELEGRAM_BOT_TOKEN"), chatId: requireEnv("TELEGRAM_CHAT_ID") })
    : null;

  const store =
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
      ? createSupabaseStore({ url: process.env.SUPABASE_URL, serviceKey: process.env.SUPABASE_SERVICE_KEY })
      : undefined;

  const llmNormalizer =
    process.env.GEMINI_API_KEY || process.env.LLM_API_KEY ? new LlmNormalizer({ log: console.log }) : undefined;

  const result = await runPipeline(config, {
    adapters,
    notifier,
    store,
    llmNormalizer,
    jobsPath: "data/jobs.csv",
    quotaPath: "data/quota.json",
    log: console.log,
  });
  console.log(JSON.stringify(result));
  if (result.notifyFailed) process.exitCode = 1;
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
