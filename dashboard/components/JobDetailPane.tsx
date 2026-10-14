"use client";

import React, { useState } from "react";
import type { Job, Status } from "@/lib/types";
import {
  IconBriefcase,
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconGlobe,
  IconLocation,
  IconSalary,
  IconSparkles,
} from "./Icons";

interface JobDetailPaneProps {
  job: Job | null;
  onStatusChange: (id: string, status: Status) => void;
}

function formatDetailedSalary(job: Job): string {
  if (job.salaryMin && job.salaryMax) {
    if (job.currency === "USD") {
      return `$${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}/mo`;
    }
    const minM = Math.round(job.salaryMin / 1e6);
    const maxM = Math.round(job.salaryMax / 1e6);
    return `${minM} - ${maxM} Million VND / month`;
  }
  if (job.salaryMin) {
    if (job.currency === "USD") return `From $${job.salaryMin.toLocaleString()}/mo`;
    return `From ${Math.round(job.salaryMin / 1e6)} Million VND / month`;
  }
  if (job.salaryMax) {
    if (job.currency === "USD") return `Up to $${job.salaryMax.toLocaleString()}/mo`;
    return `Up to ${Math.round(job.salaryMax / 1e6)} Million VND / month`;
  }
  if (job.negotiable) return "Negotiable (Thỏa thuận)";
  return "Undisclosed";
}

export function JobDetailPane({ job, onStatusChange }: JobDetailPaneProps) {
  const [copied, setCopied] = useState(false);

  if (!job) {
    return (
      <div className="detail-pane empty-pane">
        <div className="empty-content">
          <div className="empty-icon-box">
            <IconBriefcase size={28} />
          </div>
          <h3>Select a job to inspect</h3>
          <p>Choose an opportunity from the list on the left to view full requirements, apply, or track status.</p>
        </div>
      </div>
    );
  }

  const primaryUrl = job.sources[0]?.url || "";
  const primarySite = job.sources[0]?.site || "Direct";

  const handleCopyLink = () => {
    if (!primaryUrl) return;
    navigator.clipboard.writeText(primaryUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="detail-pane">
      {/* Top action banner */}
      <div className="pane-top-bar">
        <div className="pane-title-group">
          <div className="pane-company-badge">
            <span>{job.company}</span>
            {job.matched && (
              <span className="badge-match-glow">
                <IconSparkles size={12} />
                MATCHED PROFILE
              </span>
            )}
          </div>
          <h2 className="pane-title">{job.title}</h2>
        </div>

        <div className="pane-primary-actions">
          {primaryUrl && (
            <a
              href={primaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary-apply"
            >
              <span>Apply on {primarySite}</span>
              <IconExternalLink size={14} />
            </a>
          )}
          {primaryUrl && (
            <button
              type="button"
              className="btn-secondary-copy"
              onClick={handleCopyLink}
              title="Copy original link"
            >
              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick triage status segmented bar */}
      <div className="triage-section">
        <span className="triage-label">APPLICATION STAGE:</span>
        <div className="triage-segmented-control">
          {(["new", "saved", "applied", "rejected"] as const).map((st) => (
            <button
              key={st}
              type="button"
              className={`triage-btn ${job.status === st ? `active active-${st}` : ""}`}
              onClick={() => onStatusChange(job.id, st)}
            >
              <span className={`btn-dot status-${st}`} />
              <span className="triage-text">{st.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Specs Grid */}
      <div className="specs-grid">
        <div className="spec-card">
          <div className="spec-header">
            <IconSalary size={14} className="spec-icon" />
            <span>COMPENSATION</span>
          </div>
          <div className="spec-value spec-value-salary">{formatDetailedSalary(job)}</div>
        </div>

        <div className="spec-card">
          <div className="spec-header">
            <IconLocation size={14} className="spec-icon" />
            <span>LOCATION & WORK MODE</span>
          </div>
          <div className="spec-value">
            {job.city || "Vietnam"} • {job.remote ? job.remote.toUpperCase() : "ONSITE/HYBRID"}
          </div>
        </div>

        <div className="spec-card">
          <div className="spec-header">
            <IconBriefcase size={14} className="spec-icon" />
            <span>SENIORITY & EXP</span>
          </div>
          <div className="spec-value">
            {job.level ? job.level.toUpperCase() : "STANDARD"} •{" "}
            {job.expMin != null ? `${job.expMin}${job.expMax ? `–${job.expMax}` : "+"} Years Exp` : "Not specified"}
          </div>
        </div>

        <div className="spec-card">
          <div className="spec-header">
            <IconGlobe size={14} className="spec-icon" />
            <span>SOURCES</span>
          </div>
          <div className="spec-sources">
            {job.sources.map((s, idx) => (
              <a
                key={idx}
                href={s.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="spec-source-link"
              >
                {s.site} ↗
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Skills list */}
      {job.skills.length > 0 && (
        <div className="pane-section">
          <div className="section-title">REQUIRED TECH STACK & KEYWORDS</div>
          <div className="skills-cloud">
            {job.skills.map((skill) => (
              <span key={skill} className="skill-tag">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Full JD Description */}
      <div className="pane-section desc-section">
        <div className="section-title">JOB DESCRIPTION & REQUIREMENTS</div>
        <div className="desc-box">
          <pre className="desc-text">{job.description || "No full description available for this position."}</pre>
        </div>
      </div>
    </div>
  );
}
