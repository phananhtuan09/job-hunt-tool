import { parse } from "yaml";
import { configSchema, type Config } from "../src/config.js";
import type { Job } from "../src/types.js";

export function testConfig(overrides: Record<string, unknown> = {}): Config {
  return configSchema.parse({ ...parse(`
keywords: [frontend developer]
locations: ["Ho Chi Minh City", "Hanoi"]
levels: [junior, middle, senior]
experience: { min: 1, max: 5 }
salary: { minVND: 20000000, includeNegotiable: true }
remote: any
postedWithinDays: 3
sources:
  serpapi: { enabled: true, pagesPerQuery: 1 }
  jsearch: { enabled: false }
  jobspy: { enabled: false, sites: [indeed] }
  itviec: { enabled: false }
  topdev: { enabled: false }
notify: { telegram: { enabled: true, onlyMatched: true } }
`), ...overrides });
}

export function testJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "id1", title: "Dev", company: "Co", city: "Hanoi", level: null, expMin: null, expMax: null,
    salaryMin: null, salaryMax: null, currency: null, negotiable: false, remote: null, skills: [],
    sources: [{ site: "x", url: "https://x/1" }], description: "", postedAt: null,
    firstSeenAt: "2026-10-12T00:00:00.000Z", matched: false, status: "new", ...overrides,
  };
}
