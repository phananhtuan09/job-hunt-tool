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
