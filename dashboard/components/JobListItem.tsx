"use client";

import React from "react";
import type { Job, Status } from "@/lib/types";
import { IconLocation, IconSalary, IconSparkles } from "./Icons";

interface JobListItemProps {
  job: Job;
  isSelected: boolean;
  onSelect: (job: Job) => void;
}

function formatSalary(job: Job): string | null {
  if (job.salaryMin && job.salaryMax) {
    if (job.currency === "USD") {
      return `$${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}`;
    }
    const minM = Math.round(job.salaryMin / 1e6);
    const maxM = Math.round(job.salaryMax / 1e6);
    return `${minM}–${maxM}M`;
  }
  if (job.salaryMin) {
    if (job.currency === "USD") return `From $${job.salaryMin.toLocaleString()}`;
    return `≥ ${Math.round(job.salaryMin / 1e6)}M`;
  }
  if (job.salaryMax) {
    if (job.currency === "USD") return `Up to $${job.salaryMax.toLocaleString()}`;
    return `≤ ${Math.round(job.salaryMax / 1e6)}M`;
  }
  if (job.negotiable) return "Negotiable";
  return null;
}

function getSourceClass(site?: string): string {
  const s = (site || "").toLowerCase();
  if (s.includes("itviec")) return "source-itviec";
  if (s.includes("topdev")) return "source-topdev";
  if (s.includes("indeed")) return "source-indeed";
  if (s.includes("linkedin")) return "source-linkedin";
  return "source-default";
}

export function JobListItem({ job, isSelected, onSelect }: JobListItemProps) {
  const salaryText = formatSalary(job);
  const primarySource = job.sources[0]?.site || "direct";

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
          <span className={`status-dot status-${job.status}`} title={`Status: ${job.status}`} />
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
        {salaryText && (
          <span className="meta-pill meta-salary">
            <IconSalary size={12} />
            {salaryText}
          </span>
        )}
        {job.remote && (
          <span className="meta-pill">
            {job.remote}
          </span>
        )}
        {job.matched && (
          <span className="meta-pill meta-match" title="Matched your search filters">
            <IconSparkles size={11} />
            Match
          </span>
        )}
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
    </div>
  );
}
