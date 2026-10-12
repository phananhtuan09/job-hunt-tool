import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";

const levels = ["intern", "junior", "middle", "senior", "lead"] as const;

export const configSchema = z.object({
  keywords: z.array(z.string().min(1)).min(1),
  locations: z.array(z.string().min(1)).min(1),
  levels: z.array(z.enum(levels)).min(1),
  experience: z.object({ min: z.number().min(0), max: z.number().min(0) }).refine((e) => e.min <= e.max, {
    message: "experience.min must not exceed experience.max",
  }),
  salary: z.object({ minVND: z.number().min(0), includeNegotiable: z.boolean() }),
  remote: z.enum(["any", "remote", "onsite", "hybrid"]),
  postedWithinDays: z.number().int().positive(),
  sources: z.object({
    serpapi: z.object({ enabled: z.boolean(), pagesPerQuery: z.number().int().positive() }),
    jsearch: z.object({ enabled: z.boolean() }),
    jobspy: z.object({ enabled: z.boolean(), sites: z.array(z.enum(["linkedin", "indeed"])).min(1) }),
    itviec: z.object({ enabled: z.boolean() }),
    topdev: z.object({ enabled: z.boolean() }),
  }),
  notify: z.object({ telegram: z.object({ enabled: z.boolean(), onlyMatched: z.boolean() }) }),
});

export type Config = z.infer<typeof configSchema>;

export function parseConfig(yamlText: string): Config {
  return configSchema.parse(parse(yamlText));
}

export function loadConfig(path = "config.yaml"): Config {
  return parseConfig(readFileSync(path, "utf8"));
}
