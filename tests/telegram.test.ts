import { describe, expect, it } from "vitest";
import { createTelegramNotifier, formatJobMessage } from "../src/telegram.js";
import { testJob } from "./helpers.js";

describe("telegram", () => {
  it("formats a job with its source links", () => {
    const msg = formatJobMessage(testJob({ title: "FE", company: "Acme", level: "senior", salaryMin: 1, salaryMax: 2, currency: "USD" }));
    expect(msg).toContain("FE - Acme");
    expect(msg).toContain("senior");
    expect(msg).toContain("x: https://x/1");
  });
  it("posts to the bot API and fails on HTTP errors", async () => {
    const calls: { url: string; body: string }[] = [];
    const ok = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: String(init.body) });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    await createTelegramNotifier({ token: "T", chatId: "C", fetchImpl: ok }).sendJob(testJob());
    expect(calls[0]!.url).toBe("https://api.telegram.org/botT/sendMessage");
    expect(JSON.parse(calls[0]!.body).chat_id).toBe("C");
    const bad = (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;
    await expect(createTelegramNotifier({ token: "T", chatId: "C", fetchImpl: bad }).sendText("x")).rejects.toThrow(/401/);
  });
});
