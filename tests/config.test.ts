import { describe, expect, it } from "vitest";
import { loadConfig, parseConfig } from "../src/config.js";

describe("config", () => {
  it("loads the shipped config.yaml", () => {
    const config = loadConfig();
    expect(config.keywords).toHaveLength(3);
    expect(config.sources.serpapi.pagesPerQuery).toBe(1);
  });

  it("rejects invalid config before collection", () => {
    expect(() => parseConfig("keywords: []")).toThrow();
  });

  it("rejects experience.min above experience.max", () => {
    const yaml = `
keywords: [a]
locations: [b]
levels: [junior]
experience: { min: 5, max: 1 }
salary: { minVND: 0, includeNegotiable: true }
remote: any
postedWithinDays: 3
sources:
  serpapi: { enabled: true, pagesPerQuery: 1 }
  jsearch: { enabled: true }
  jobspy: { enabled: true, sites: [indeed] }
  itviec: { enabled: true }
  topdev: { enabled: true }
notify: { telegram: { enabled: true, onlyMatched: true } }
`;
    expect(() => parseConfig(yaml)).toThrow(/experience/);
  });
});
