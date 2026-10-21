"use client";

import React, { useMemo } from "react";
import { evaluateDecision, formatSalary, postedAgeLabel } from "@/lib/decision";
import type { Job, Status } from "@/lib/types";
import { IconArchive, IconLocation, IconSalary, IconSend, IconSparkles, IconX } from "./Icons";

interface JobListItemProps {
  job: Job;
  isSelected: boolean;
  onSelect: (job: Job) => void;
  /** Quick triage without opening the detail pane. Hidden in the
   *  "Đã xử lý" view's restore flow is handled by the detail pane instead. */
  onQuickAction?: (id: string, status: Status) => void;
}

function getSourceClass(site?: string): string {
  const s = (site || "").toLowerCase();
  if (s.includes("itviec")) return "source-itviec";
  if (s.includes("topdev")) return "source-topdev";
  if (s.includes("indeed")) return "source-indeed";
  if (s.includes("linkedin")) return "source-linkedin";
  return "source-default";
}

const STATUS_LABELS: Record<Status, string> = {
  new: "Chưa xử lý",
  saved: "Đã xử lý",
  applied: "Đã apply",
  rejected: "Đã bỏ qua",
};

export function JobListItem({ job, isSelected, onSelect, onQuickAction }: JobListItemProps) {
  const salaryText = formatSalary(job);
  const primarySource = job.sources[0]?.site || "direct";
  const decision = useMemo(() => evaluateDecision(job), [job]);
  const showSalary = job.salaryMin !== null || job.salaryMax !== null || job.negotiable;

  const quickAction = (e: React.MouseEvent, status: Status) => {
    e.stopPropagation();
    onQuickAction?.(job.id, status);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`job-list-item ${isSelected ? "selected" : ""}`}
      onClick={() => onSelect(job)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(job);
        }
      }}
    >
      <div className="item-top-row">
        <span className="item-company" title={job.company}>
          {job.company}
        </span>
        <div className="item-indicators">
          <span className={`source-dot-pill ${getSourceClass(primarySource)}`}>
            <span className="source-dot" />
            {primarySource}
          </span>
          {job.status !== "new" ? (
            <span className={`status-chip status-chip-${job.status}`}>
              {STATUS_LABELS[job.status]}
            </span>
          ) : (
            <span className="status-dot status-new" title="Chưa xử lý" />
          )}
        </div>
      </div>

      <h3 className="item-title">{job.title}</h3>

      <div className="item-meta-row">
        {job.city && (
          <span className="meta-pill">
            <IconLocation size={12} />
            {job.city === "Ho Chi Minh City" ? "HCMC" : job.city}
          </span>
        )}
        {showSalary && (
          <span className="meta-pill meta-salary">
            <IconSalary size={12} />
            {salaryText}
          </span>
        )}
        {job.remote && <span className="meta-pill">{job.remote}</span>}
        <span className="meta-pill meta-age">{postedAgeLabel(job)}</span>
        {job.matched && (
          <span className="meta-pill meta-match" title="Khớp config của bạn">
            <IconSparkles size={11} />
            Match
          </span>
        )}
        <span
          className={`meta-pill verdict-pill verdict-pill-${decision.verdict}`}
          title={`Điểm khớp ${decision.score}/100 — ${decision.verdictLabel}`}
        >
          {decision.score} • {decision.verdictLabel}
        </span>
      </div>

      {job.skills.length > 0 && (
        <div className="item-skills-row">
          {job.skills.slice(0, 4).map((skill) => (
            <span key={skill} className="skill-chip-sm">
              {skill}
            </span>
          ))}
          {job.skills.length > 4 && (
            <span className="skill-chip-sm more">+{job.skills.length - 4}</span>
          )}
        </div>
      )}

      {onQuickAction && job.status === "new" && (
        <div className="item-quick-actions">
          <button
            type="button"
            className="quick-btn quick-btn-applied"
            onClick={(e) => quickAction(e, "applied")}
            title="Đã apply — ẩn khỏi inbox"
            aria-label={`Đã apply: ${job.title}`}
          >
            <IconSend size={12} />
            <span>Đã apply</span>
          </button>
          <button
            type="button"
            className="quick-btn quick-btn-saved"
            onClick={(e) => quickAction(e, "saved")}
            title="Lưu — đã xem/đã xử lý, ẩn khỏi inbox"
            aria-label={`Lưu đã xử lý: ${job.title}`}
          >
            <IconArchive size={12} />
            <span>Lưu & ẩn</span>
          </button>
          <button
            type="button"
            className="quick-btn quick-btn-rejected"
            onClick={(e) => quickAction(e, "rejected")}
            title="Bỏ qua — ẩn khỏi inbox"
            aria-label={`Bỏ qua: ${job.title}`}
          >
            <IconX size={12} />
            <span>Bỏ qua</span>
          </button>
        </div>
      )}
    </div>
  );
}
