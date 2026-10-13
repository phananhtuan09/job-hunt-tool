import { z } from "zod";
import type { Job } from "./types.js";

export const llmExtractionSchema = z.object({
  level: z.enum(["intern", "junior", "middle", "senior", "lead"]).nullable().optional(),
  expMin: z.number().int().min(0).max(30).nullable().optional(),
  expMax: z.number().int().min(0).max(30).nullable().optional(),
  salaryMin: z.number().nullable().optional(),
  salaryMax: z.number().nullable().optional(),
  currency: z.enum(["VND", "USD"]).nullable().optional(),
  negotiable: z.boolean().optional(),
  remote: z.enum(["remote", "onsite", "hybrid"]).nullable().optional(),
  skills: z.array(z.string()).optional(),
});

export type LlmExtraction = z.infer<typeof llmExtractionSchema>;

export const MAX_LLM_CALLS_PER_RUN = 10;

export interface LlmFallbackOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  maxCalls?: number;
  log?: (message: string) => void;
}

export function needsLlmFallback(job: Job): boolean {
  return (
    job.level == null ||
    job.expMin == null ||
    (job.salaryMin == null && !job.negotiable) ||
    job.remote == null
  );
}

export function buildPrompt(title: string, description: string): string {
  return `You are a job parser. Extract job details from this Vietnamese or English job posting.
Title: ${title}
Description:
${description.slice(0, 2000)}

Respond with ONLY a raw JSON object (no markdown, no backticks, no explanations) matching this structure:
{
  "level": "intern" | "junior" | "middle" | "senior" | "lead" | null,
  "expMin": integer_years | null,
  "expMax": integer_years | null,
  "salaryMin": monthly_amount_in_numbers | null,
  "salaryMax": monthly_amount_in_numbers | null,
  "currency": "VND" | "USD" | null,
  "negotiable": boolean,
  "remote": "remote" | "onsite" | "hybrid" | null,
  "skills": ["string", ...]
}`;
}

export class LlmNormalizer {
  private callsMade = 0;
  private readonly maxCalls: number;
  private readonly apiKey?: string;
  private readonly baseUrl?: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly log: (msg: string) => void;

  constructor(options: LlmFallbackOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.LLM_API_KEY;
    this.baseUrl = options.baseUrl ?? process.env.LLM_BASE_URL;
    this.model = options.model ?? "gemini-2.0-flash";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxCalls = options.maxCalls ?? MAX_LLM_CALLS_PER_RUN;
    this.log = options.log ?? (() => {});
  }

  get callCount(): number {
    return this.callsMade;
  }

  async enhance(job: Job): Promise<Job> {
    if (!needsLlmFallback(job)) return job;
    if (!this.apiKey) return job;
    if (this.callsMade >= this.maxCalls) {
      this.log(`LLM normalization limit reached (${this.maxCalls} calls), skipping job ${job.id}`);
      return job;
    }

    this.callsMade++;
    try {
      const extracted = await this.queryLlm(job.title, job.description);
      if (!extracted) return job;

      return {
        ...job,
        level: job.level ?? extracted.level ?? null,
        expMin: job.expMin ?? extracted.expMin ?? null,
        expMax: job.expMax ?? extracted.expMax ?? null,
        salaryMin: job.salaryMin ?? extracted.salaryMin ?? null,
        salaryMax: job.salaryMax ?? extracted.salaryMax ?? null,
        currency: job.currency ?? extracted.currency ?? null,
        negotiable: job.negotiable || Boolean(extracted.negotiable),
        remote: job.remote ?? extracted.remote ?? null,
        skills: Array.from(new Set([...job.skills, ...(extracted.skills ?? [])])),
      };
    } catch (error) {
      this.log(`LLM normalization failed for ${job.id}: ${(error as Error).message}`);
      return job;
    }
  }

  private async queryLlm(title: string, description: string): Promise<LlmExtraction | null> {
    const prompt = buildPrompt(title, description);

    let rawText = "";
    if (this.baseUrl) {
      // OpenAI-compatible endpoint
      const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
        }),
      });
      if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
      const data = await res.json();
      rawText = data?.choices?.[0]?.message?.content ?? "";
    } else {
      // Google Gemini API endpoint
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      });
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const data = await res.json();
      rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    }

    const cleanJson = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    const result = llmExtractionSchema.safeParse(parsed);
    if (!result.success) {
      this.log(`LLM output validation error: ${result.error.message}`);
      return null;
    }
    return result.data;
  }
}
