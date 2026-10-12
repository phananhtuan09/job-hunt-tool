import type { Job } from "./types.js";

export interface Notifier {
  sendJob(job: Job): Promise<void>;
  sendText(text: string): Promise<void>;
}

function formatSalary(job: Job): string {
  if (job.salaryMin === null && job.salaryMax === null) return job.negotiable ? "negotiable" : "salary n/a";
  const fmt = (n: number | null) => (n === null ? "?" : n.toLocaleString("en-US"));
  return `${fmt(job.salaryMin)} - ${fmt(job.salaryMax)} ${job.currency ?? ""}`.trim();
}

export function formatJobMessage(job: Job): string {
  const details = [job.city ?? "city n/a", job.level ?? "level n/a", formatSalary(job), job.remote ?? "remote n/a"];
  const links = job.sources.filter((s) => s.url).map((s) => `${s.site}: ${s.url}`);
  return [`${job.title} - ${job.company}`, details.join(" | "), ...links].join("\n");
}

export function createTelegramNotifier(options: { token: string; chatId: string; fetchImpl?: typeof fetch }): Notifier {
  const fetchImpl = options.fetchImpl ?? fetch;
  async function sendText(text: string): Promise<void> {
    const response = await fetchImpl(`https://api.telegram.org/bot${options.token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: options.chatId, text, disable_web_page_preview: true }),
    });
    if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
  }
  return { sendText, sendJob: (job) => sendText(formatJobMessage(job)) };
}
