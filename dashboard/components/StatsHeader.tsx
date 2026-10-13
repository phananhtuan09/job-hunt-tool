"use client";

import React from "react";
import type { Job } from "@/lib/types";

interface StatsHeaderProps {
  jobs: Job[];
}

export function StatsHeader({ jobs }: StatsHeaderProps) {
  const total = jobs.length;
  const newJobs = jobs.filter((j) => j.status === "new").length;
  const saved = jobs.filter((j) => j.status === "saved").length;
  const applied = jobs.filter((j) => j.status === "applied").length;
  const matched = jobs.filter((j) => j.matched).length;

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <span className="stat-label">Total Collected</span>
        <span className="stat-value" style={{ color: "#ffffff" }}>{total}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">New Opportunities</span>
        <span className="stat-value" style={{ color: "var(--accent-cyan)" }}>{newJobs}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Saved / Bookmarked</span>
        <span className="stat-value" style={{ color: "var(--accent-amber)" }}>{saved}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Applied</span>
        <span className="stat-value" style={{ color: "var(--accent-emerald)" }}>{applied}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Matched Criteria</span>
        <span className="stat-value" style={{ color: "var(--accent-violet)" }}>{matched}</span>
      </div>
    </div>
  );
}
