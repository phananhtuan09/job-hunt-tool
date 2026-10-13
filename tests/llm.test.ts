import { describe, expect, it } from "vitest";
import { LlmNormalizer, needsLlmFallback } from "../src/llm.js";
import type { Job } from "../src/types.js";
import { testJob } from "./helpers.js";

describe("LLM Normalization Fallback", () => {
  const completeJob: Job = testJob({
    level: "senior",
    expMin: 3,
    expMax: 5,
    salaryMin: 30000000,
    salaryMax: 45000000,
    currency: "VND",
    negotiable: false,
    remote: "hybrid",
  });

  const missingJob: Job = testJob({
    level: null,
    expMin: null,
    expMax: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    negotiable: false,
    remote: null,
    description: "Cần tuyển lập trình viên React 3 năm kinh nghiệm làm việc remote lương 30-40 triệu.",
  });

  it("checks whether a job requires LLM fallback", () => {
    expect(needsLlmFallback(completeJob)).toBe(false);
    expect(needsLlmFallback(missingJob)).toBe(true);
  });

  it("does not call LLM when job already has all fields parsed", async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return new Response("{}");
    }) as unknown as typeof fetch;

    const normalizer = new LlmNormalizer({ apiKey: "test-key", fetchImpl });
    const result = await normalizer.enhance(completeJob);

    expect(called).toBe(false);
    expect(normalizer.callCount).toBe(0);
    expect(result).toEqual(completeJob);
  });

  it("calls Gemini API and fills in missing fields with validated output", async () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  level: "middle",
                  expMin: 3,
                  expMax: null,
                  salaryMin: 30000000,
                  salaryMax: 40000000,
                  currency: "VND",
                  negotiable: false,
                  remote: "remote",
                  skills: ["react"],
                }),
              },
            ],
          },
        },
      ],
    };

    const fetchImpl = (async () => {
      return new Response(JSON.stringify(mockGeminiResponse), { status: 200 });
    }) as unknown as typeof fetch;

    const normalizer = new LlmNormalizer({ apiKey: "test-key", fetchImpl });
    const enhanced = await normalizer.enhance(missingJob);

    expect(normalizer.callCount).toBe(1);
    expect(enhanced.level).toBe("middle");
    expect(enhanced.expMin).toBe(3);
    expect(enhanced.salaryMin).toBe(30000000);
    expect(enhanced.salaryMax).toBe(40000000);
    expect(enhanced.remote).toBe("remote");
  });

  it("respects maxCalls ceiling and skips LLM when budget reached", async () => {
    let callCounter = 0;
    const fetchImpl = (async () => {
      callCounter++;
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ level: "junior" }) }] } }],
        })
      );
    }) as unknown as typeof fetch;

    const normalizer = new LlmNormalizer({ apiKey: "test-key", maxCalls: 1, fetchImpl });
    await normalizer.enhance(missingJob);
    expect(callCounter).toBe(1);

    // Second call should be skipped
    const secondJob = { ...missingJob, id: "job-2" };
    await normalizer.enhance(secondJob);
    expect(callCounter).toBe(1);
  });

  it("handles invalid JSON or HTTP errors gracefully without failing", async () => {
    const logs: string[] = [];
    const fetchImpl = (async () => {
      return new Response("Internal Server Error", { status: 500 });
    }) as unknown as typeof fetch;

    const normalizer = new LlmNormalizer({
      apiKey: "test-key",
      fetchImpl,
      log: (msg) => logs.push(msg),
    });

    const result = await normalizer.enhance(missingJob);
    expect(result.level).toBeNull();
    expect(logs.some((l) => l.includes("failed"))).toBe(true);
  });

  it("rejects invalid schema values via Zod and keeps fields null", async () => {
    const invalidMock = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  level: "super-god-level-invalid", // Not in Level enum
                  expMin: 999, // Exceeds max 30
                }),
              },
            ],
          },
        },
      ],
    };

    const fetchImpl = (async () => {
      return new Response(JSON.stringify(invalidMock), { status: 200 });
    }) as unknown as typeof fetch;

    const normalizer = new LlmNormalizer({ apiKey: "test-key", fetchImpl });
    const result = await normalizer.enhance(missingJob);

    expect(result.level).toBeNull();
    expect(result.expMin).toBeNull();
  });
});
