"use client";

import React from "react";
import type { Job } from "@/lib/types";
import { IconLock, IconRadar, IconRefresh, IconSparkles } from "./Icons";

interface StatsHeaderProps {
  jobs: Job[];
  onRefresh: () => void;
  onLogout: () => void;
  loading: boolean;
  /** When the matched-only toggle is on, the INBOX / ĐÃ XỬ LÝ / APPLIED
   *  pills count within that scope — the same scope the view tabs use —
   *  so every number on screen agrees with what the list can show. */
  matchedOnly: boolean;
}

export function StatsHeader({ jobs, onRefresh, onLogout, loading, matchedOnly }: StatsHeaderProps) {
  const total = jobs.length;
  const matched = jobs.filter((j) => j.matched).length;
  const scoped = matchedOnly ? jobs.filter((j) => j.matched) : jobs;
  const scopedTotal = scoped.length;
  const inbox = scoped.filter((j) => j.status === "new").length;
  const processed = scopedTotal - inbox;
  const applied = scoped.filter((j) => j.status === "applied").length;
  const progressPct = scopedTotal > 0 ? Math.round((processed / scopedTotal) * 100) : 0;

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
          <p className="brand-sub">
            Frontend & Fullstack Roles • Quick Triage — quyết định nhanh, JD xem ở nguồn
          </p>
        </div>
      </div>

      <div className="header-right-group">
        <div className="metric-pills-bar">
          <div className="metric-pill" title="Tổng số job đã thu thập">
            <span className="metric-label">SCOUTED</span>
            <span className="metric-num">{total}</span>
          </div>
          <div className="metric-pill metric-highlight" title="Khớp tiêu chí trong config.yaml">
            <IconSparkles size={11} />
            <span className="metric-label">MATCHED</span>
            <span className="metric-num accent-cyan">{matched}</span>
          </div>
          <div className="metric-pill" title="Job chưa xử lý trong phạm vi đang xem — khớp số trên tab Inbox">
            <span className="metric-label">INBOX</span>
            <span className="metric-num accent-cyan">{inbox}</span>
          </div>
          <div
            className="metric-pill"
            title={`Đã xử lý ${processed}/${scopedTotal} job trong phạm vi đang xem (${progressPct}%) — đã xem, đã apply hoặc đã bỏ qua, không còn hiện trong inbox`}
          >
            <span className="metric-label">ĐÃ XỬ LÝ</span>
            <span className="metric-num accent-amber">
              {processed}/{scopedTotal}
            </span>
          </div>
          <div className="metric-pill" title="Đã nộp đơn">
            <span className="metric-label">APPLIED</span>
            <span className="metric-num accent-emerald">{applied}</span>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            onClick={onRefresh}
            className={`btn-header-action ${loading ? "spinning" : ""}`}
            title="Tải lại danh sách job"
          >
            <IconRefresh size={14} />
            <span>Sync</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="btn-header-action btn-logout"
            title="Khóa phiên đăng nhập"
          >
            <IconLock size={13} />
            <span>Lock</span>
          </button>
        </div>
      </div>
    </header>
  );
}
