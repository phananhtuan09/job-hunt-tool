"use client";

import React from "react";
import type { Job, Level, Remote, Status } from "@/lib/types";

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
}

export function FilterBar({ filters, onChange, jobs }: FilterBarProps) {
  const getCount = (st: "all" | Status) => {
    if (st === "all") return jobs.length;
    return jobs.filter((j) => j.status === st).length;
  };

  return (
    <div className="glass-panel filter-container">
      <div className="search-row">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search by role, company, skill, or keyword (e.g. React, Next.js, Fintech)..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
          />
        </div>
      </div>

      <div className="tabs-row">
        {(["all", "new", "saved", "applied", "rejected"] as const).map((st) => (
          <button
            key={st}
            type="button"
            className={`tab-btn ${filters.status === st ? "active" : ""}`}
            onClick={() => onChange({ ...filters, status: st })}
          >
            <span>{st.toUpperCase()}</span>
            <span className="tab-count">{getCount(st)}</span>
          </button>
        ))}
      </div>

      <div className="filters-secondary">
        <select
          className="filter-select"
          value={filters.city}
          onChange={(e) => onChange({ ...filters, city: e.target.value })}
        >
          <option value="all">📍 All Locations</option>
          <option value="Ho Chi Minh City">Ho Chi Minh City</option>
          <option value="Hanoi">Hanoi</option>
          <option value="Da Nang">Da Nang</option>
        </select>

        <select
          className="filter-select"
          value={filters.level}
          onChange={(e) => onChange({ ...filters, level: e.target.value })}
        >
          <option value="all">⚡ All Levels</option>
          <option value="intern">Intern</option>
          <option value="junior">Junior</option>
          <option value="middle">Middle</option>
          <option value="senior">Senior</option>
          <option value="lead">Lead</option>
        </select>

        <select
          className="filter-select"
          value={filters.remote}
          onChange={(e) => onChange({ ...filters, remote: e.target.value })}
        >
          <option value="all">🌐 Any Work Mode</option>
          <option value="remote">Remote Only</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">Onsite</option>
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer", marginLeft: "auto" }}>
          <input
            type="checkbox"
            checked={filters.onlyMatched}
            onChange={(e) => onChange({ ...filters, onlyMatched: e.target.checked })}
          />
          <span>Only Matched Config</span>
        </label>
      </div>
    </div>
  );
}
