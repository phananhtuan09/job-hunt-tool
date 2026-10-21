export type Level = "intern" | "junior" | "middle" | "senior" | "lead";
export type Remote = "remote" | "onsite" | "hybrid";
/**
 * Lifecycle of a job in the hunt:
 * - `new`: still in the inbox, not yet triaged. This is the ONLY status
 *   shown in the default inbox view.
 * - `saved`: handled — the user has seen it and saved it as processed.
 *   Hidden from the inbox; reviewable/restorable in the "Đã xử lý" view.
 * - `applied`: application submitted. Hidden from the inbox.
 * - `rejected`: dismissed as not worth it. Hidden from the inbox.
 *
 * Statuses persist through the status API and survive re-crawls (the
 * pipeline only merges sources into an existing job, never resets its
 * status), so a handled job never resurfaces as new.
 */
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
