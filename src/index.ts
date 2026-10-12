import { createSerpApiAdapter } from "./adapters/serpapi.js";
import { loadConfig } from "./config.js";
import { runPipeline } from "./pipeline.js";
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
  for (const name of ["jsearch", "jobspy", "itviec", "topdev"] as const) {
    if (config.sources[name].enabled) console.warn(`${name}: adapter not implemented yet, skipped`);
  }

  const notifier = config.notify.telegram.enabled
    ? createTelegramNotifier({ token: requireEnv("TELEGRAM_BOT_TOKEN"), chatId: requireEnv("TELEGRAM_CHAT_ID") })
    : null;

  const result = await runPipeline(config, {
    adapters,
    notifier,
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
