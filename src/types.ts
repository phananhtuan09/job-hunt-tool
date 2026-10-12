export type Level = "intern" | "junior" | "middle" | "senior" | "lead";
export type Remote = "remote" | "onsite" | "hybrid";
export type Status = "new" | "saved" | "applied" | "rejected";
export type Currency = "VND" | "USD";

export interface JobSource {
  site: string;
  url: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  city: string | null;
  level: Level | null;
  expMin: number | null;
  expMax: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: Currency | null;
  negotiable: boolean;
  remote: Remote | null;
  skills: string[];
  sources: JobSource[];
  description: string;
  postedAt: string | null;
  firstSeenAt: string;
  matched: boolean;
  status: Status;
}

export type RawJob = Record<string, unknown>;

export interface SourceQuery {
  keyword: string;
  location: string;
}

export interface SourceAdapter {
  name: string;
  /** Free requests per month; the pipeline skips the source when the recorded usage reaches it. */
  monthlyQuota?: number;
  fetch(query: SourceQuery): Promise<RawJob[]>;
  normalize(raw: RawJob, now?: Date): Job;
}
