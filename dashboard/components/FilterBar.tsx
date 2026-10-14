"use client";

import React from "react";
import type { Job, Status } from "@/lib/types";
import { IconFilter, IconLocation, IconSearch, IconSparkles } from "./Icons";

export interface FilterState {
  search: string;
  status: "all" | Status;
  city: string;
  level: string;
  remote: string;
  onlyMatched: boolean;
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  jobs: Job[];
  matchedCount: number;
}

export function FilterBar({ filters, onChange, jobs, matchedCount }: FilterBarProps) {
  const getCount = (st: "all" | Status) => {
    if (st === "all") return jobs.length;
    return jobs.filter((j) => j.status === st).length;
  };

  return (
    <div className="filter-bar-wrapper">
      {/* Top search & status tabs */}
      <div className="filter-main-row">
        <div className="search-box">
          <IconSearch size={16} className="search-icon-svg" />
          <input
            type="text"
            className="search-field"
            placeholder="Search role, company, skill (e.g. React, Next.js, TypeScript)..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
          />
          {filters.search && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => onChange({ ...filters, search: "" })}
            >
              ✕
            </button>
          )}
        </div>

        {/* Status segmented tabs */}
        <div className="status-tabs-group">
          {(["all", "new", "saved", "applied", "rejected"] as const).map((st) => {
            const count = getCount(st);
            return (
              <button
                key={st}
                type="button"
                className={`filter-tab ${filters.status === st ? "active" : ""}`}
                onClick={() => onChange({ ...filters, status: st })}
              >
                <span>{st.toUpperCase()}</span>
                <span className="tab-pill-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary filter chips & matched toggle */}
      <div className="filter-secondary-row">
        <div className="dropdowns-group">
          <div className="select-container">
            <IconLocation size={13} className="select-icon" />
            <select
              className="select-control"
              value={filters.city}
              onChange={(e) => onChange({ ...filters, city: e.target.value })}
            >
              <option value="all">All Locations</option>
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
            >
              <option value="all">All Levels</option>
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
            >
              <option value="all">Any Work Mode</option>
              <option value="remote">Remote Only</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">Onsite</option>
            </select>
          </div>
        </div>

        {/* Only matched toggle */}
        <label className={`toggle-matched-label ${filters.onlyMatched ? "active" : ""}`}>
          <input
            type="checkbox"
            className="toggle-checkbox-input"
            checked={filters.onlyMatched}
            onChange={(e) => onChange({ ...filters, onlyMatched: e.target.checked })}
          />
          <span className="toggle-switch-slider" />
          <IconSparkles size={13} />
          <span className="toggle-text">Matched Only</span>
          <span className="matched-counter-badge">{matchedCount}</span>
        </label>
      </div>
    </div>
  );
}
