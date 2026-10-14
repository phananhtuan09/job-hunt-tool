"use client";

import React from "react";
import type { Job } from "@/lib/types";
import { IconLock, IconRadar, IconRefresh, IconSparkles } from "./Icons";

interface StatsHeaderProps {
  jobs: Job[];
  onRefresh: () => void;
  onLogout: () => void;
  loading: boolean;
}

export function StatsHeader({ jobs, onRefresh, onLogout, loading }: StatsHeaderProps) {
  const total = jobs.length;
  const matched = jobs.filter((j) => j.matched).length;
  const saved = jobs.filter((j) => j.status === "saved").length;
  const applied = jobs.filter((j) => j.status === "applied").length;

  return (
    <header className="app-header">
      <div className="brand-group">
        <div className="brand-icon-box">
          <IconRadar size={20} />
        </div>
        <div>
          <div className="brand-row">
            <h1 className="brand-name">HUNT RADAR</h1>
            <span className="version-pill">PRO</span>
            <span className="live-dot" title="Live sync enabled" />
          </div>
          <p className="brand-sub">Curated Frontend & Fullstack Roles • Master Triage</p>
        </div>
      </div>

      <div className="header-right-group">
        {/* Metric pills */}
        <div className="metric-pills-bar">
          <div className="metric-pill" title="Total opportunities collected">
            <span className="metric-label">SCOUTED</span>
            <span className="metric-num">{total}</span>
          </div>
          <div className="metric-pill metric-highlight" title="Matches your target criteria">
            <IconSparkles size={11} />
            <span className="metric-label">MATCHED</span>
            <span className="metric-num accent-cyan">{matched}</span>
          </div>
          <div className="metric-pill">
            <span className="metric-label">APPLIED</span>
            <span className="metric-num accent-emerald">{applied}</span>
          </div>
          <div className="metric-pill">
            <span className="metric-label">SAVED</span>
            <span className="metric-num accent-amber">{saved}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="header-actions">
          <button
            type="button"
            onClick={onRefresh}
            className={`btn-header-action ${loading ? "spinning" : ""}`}
            title="Refresh jobs database"
          >
            <IconRefresh size={14} />
            <span>Sync</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="btn-header-action btn-logout"
            title="Lock session"
          >
            <IconLock size={13} />
            <span>Lock</span>
          </button>
        </div>
      </div>
    </header>
  );
}
