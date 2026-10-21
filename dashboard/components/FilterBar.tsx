"use client";

import React from "react";
import type { Job } from "@/lib/types";
import { IconFilter, IconLocation, IconSearch, IconSparkles } from "./Icons";

/**
 * Which slice of the hunt is on screen:
 * - `inbox`: only un-triaged jobs (`status = new`) — the default view.
 *   Anything already saved/applied/rejected never appears here again.
 * - `processed`: everything already handled (`saved` + `applied` +
 *   `rejected`) — the place to review or restore a hidden job.
 * - `applied`: just the applications, for follow-up.
 * - `all`: the whole collection, regardless of status.
 */
export type ViewFilter = "inbox" | "processed" | "applied" | "all";

export type SortMode = "newest" | "salary" | "score";

export interface FilterState {
  search: string;
  status: ViewFilter;
  city: string;
  level: string;
  remote: string;
  onlyMatched: boolean;
  sort: SortMode;
}

export const DEFAULT_FILTERS: FilterState = {
  search: "",
  status: "inbox",
  city: "all",
  level: "all",
  remote: "all",
  onlyMatched: true,
  sort: "newest",
};

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  jobs: Job[];
  matchedCount: number;
}

const VIEW_TABS: { key: ViewFilter; label: string }[] = [
  { key: "inbox", label: "Inbox — chưa xử lý" },
  { key: "processed", label: "Đã xử lý" },
  { key: "applied", label: "Đã apply" },
  { key: "all", label: "Tất cả" },
];

export function countForView(jobs: Job[], view: ViewFilter): number {
  switch (view) {
    case "inbox":
      return jobs.filter((j) => j.status === "new").length;
    case "processed":
      return jobs.filter((j) => j.status !== "new").length;
    case "applied":
      return jobs.filter((j) => j.status === "applied").length;
    case "all":
      return jobs.length;
  }
}

export function FilterBar({ filters, onChange, jobs, matchedCount }: FilterBarProps) {
  // Tab counts respect the matched-only scope so a count never promises
  // jobs the toggle is currently hiding (search/text filters still do not
  // affect counts — they are transient).
  const scopedJobs = filters.onlyMatched ? jobs.filter((j) => j.matched) : jobs;

  return (
    <div className="filter-bar-wrapper">
      {/* Search & view tabs */}
      <div className="filter-main-row">
        <div className="search-box">
          <IconSearch size={16} className="search-icon-svg" />
          <input
            type="text"
            className="search-field"
            placeholder="Tìm theo title, công ty, skill (vd: React, Next.js, TypeScript)..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
          />
          {filters.search && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => onChange({ ...filters, search: "" })}
              aria-label="Xóa từ khóa tìm kiếm"
            >
              ✕
            </button>
          )}
        </div>

        <div className="status-tabs-group" role="tablist" aria-label="Chế độ xem">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={filters.status === tab.key}
              className={`filter-tab ${filters.status === tab.key ? "active" : ""}`}
              onClick={() => onChange({ ...filters, status: tab.key })}
            >
              <span>{tab.label}</span>
              <span className="tab-pill-count">{countForView(scopedJobs, tab.key)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Secondary filters, sort & matched toggle */}
      <div className="filter-secondary-row">
        <div className="dropdowns-group">
          <div className="select-container">
            <IconLocation size={13} className="select-icon" />
            <select
              className="select-control"
              value={filters.city}
              onChange={(e) => onChange({ ...filters, city: e.target.value })}
              aria-label="Lọc theo địa điểm"
            >
              <option value="all">Mọi địa điểm</option>
              <option value="Ho Chi Minh City">Ho Chi Minh City</option>
              <option value="Hanoi">Hanoi</option>
              <option value="Da Nang">Da Nang</option>
            </select>
          </div>

          <div className="select-container">
            <IconFilter size={13} className="select-icon" />
            <select
              className="select-control"
              value={filters.level}
              onChange={(e) => onChange({ ...filters, level: e.target.value })}
              aria-label="Lọc theo level"
            >
              <option value="all">Mọi level</option>
              <option value="junior">Junior</option>
              <option value="middle">Middle</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead</option>
            </select>
          </div>

          <div className="select-container">
            <select
              className="select-control"
              value={filters.remote}
              onChange={(e) => onChange({ ...filters, remote: e.target.value })}
              aria-label="Lọc theo hình thức làm việc"
            >
              <option value="all">Mọi hình thức</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">Onsite</option>
            </select>
          </div>

          <div className="select-container">
            <select
              className="select-control"
              value={filters.sort}
              onChange={(e) =>
                onChange({ ...filters, sort: e.target.value as SortMode })
              }
              aria-label="Sắp xếp danh sách"
              title="Sắp xếp: mới đăng nhất, lương cao nhất, hoặc điểm khớp cao nhất"
            >
              <option value="newest">Sắp xếp: Mới nhất</option>
              <option value="salary">Sắp xếp: Lương cao nhất</option>
              <option value="score">Sắp xếp: Khớp nhất</option>
            </select>
          </div>
        </div>

        <label className={`toggle-matched-label ${filters.onlyMatched ? "active" : ""}`}>
          <input
            type="checkbox"
            className="toggle-checkbox-input"
            checked={filters.onlyMatched}
            onChange={(e) => onChange({ ...filters, onlyMatched: e.target.checked })}
          />
          <span className="toggle-switch-slider" />
          <IconSparkles size={13} />
          <span className="toggle-text">Chỉ job matched</span>
          <span className="matched-counter-badge">{matchedCount}</span>
        </label>
      </div>
    </div>
  );
}
