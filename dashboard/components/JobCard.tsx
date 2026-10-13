"use client";

import React from "react";
import type { Job, Status } from "@/lib/types";

interface JobCardProps {
  job: Job;
  onStatusChange: (id: string, status: Status) => void;
  onSelect: (job: Job) => void;
}

function formatSalary(job: Job): string {
  if (job.salaryMin && job.salaryMax) {
    if (job.currency === "USD") {
      return `$${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}`;
    }
    const minM = Math.round(job.salaryMin / 1e6);
    const maxM = Math.round(job.salaryMax / 1e6);
    return `${minM} - ${maxM}M VND`;
  }
  if (job.salaryMin) {
    if (job.currency === "USD") return `From $${job.salaryMin.toLocaleString()}`;
    return `From ${Math.round(job.salaryMin / 1e6)}M VND`;
  }
  if (job.salaryMax) {
    if (job.currency === "USD") return `Up to $${job.salaryMax.toLocaleString()}`;
    return `Up to ${Math.round(job.salaryMax / 1e6)}M VND`;
  }
  if (job.negotiable) return "Negotiable";
  return "Undisclosed";
}

export function JobCard({ job, onStatusChange, onSelect }: JobCardProps) {
  const salaryText = formatSalary(job);

  return (
    <div className="job-card" data-status={job.status}>
      <div>
        <div className="job-card-header">
          <div>
            <h3 className="job-title" onClick={() => onSelect(job)}>
              {job.title}
            </h3>
            <div className="company-name">{job.company}</div>
          </div>
        </div>

        <div className="badge-group" style={{ marginTop: "0.85rem" }}>
          {job.city && <span className="badge badge-location">📍 {job.city}</span>}
          {job.level && <span className="badge badge-level">⚡ {job.level}</span>}
          {job.remote && <span className="badge badge-remote">🌐 {job.remote}</span>}
          {salaryText !== "Undisclosed" && (
            <span className="badge badge-salary">💰 {salaryText}</span>
          )}
          {job.matched && <span className="badge badge-match">✨ Matched</span>}
        </div>

        {job.skills.length > 0 && (
          <div className="skills-list" style={{ marginTop: "0.75rem" }}>
            {job.skills.slice(0, 6).map((skill) => (
              <span key={skill} className="skill-chip">
                {skill}
              </span>
            ))}
            {job.skills.length > 6 && (
              <span className="skill-chip">+{job.skills.length - 6}</span>
            )}
          </div>
        )}
      </div>

      <div className="job-card-footer">
        <div className="sources-container">
          {job.sources.map((s, idx) => (
            <a
              key={idx}
              href={s.url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="source-link-btn"
              title={`View on ${s.site}`}
            >
              ↗ {s.site}
            </a>
          ))}
        </div>

        <div className="status-actions">
          {(["new", "saved", "applied", "rejected"] as const).map((st) => (
            <button
              key={st}
              type="button"
              className={`status-btn ${job.status === st ? `active-${st}` : ""}`}
              onClick={() => onStatusChange(job.id, st)}
            >
              {st}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
