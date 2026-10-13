"use client";

import React from "react";
import type { Job, Status } from "@/lib/types";

interface JobDetailModalProps {
  job: Job | null;
  onClose: () => void;
  onStatusChange: (id: string, status: Status) => void;
}

export function JobDetailModal({ job, onClose, onStatusChange }: JobDetailModalProps) {
  if (!job) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: "1.4rem", color: "#ffffff", fontWeight: 700 }}>
              {job.title}
            </h2>
            <div style={{ color: "var(--accent-emerald)", fontWeight: 600, marginTop: "0.25rem" }}>
              {job.company} • {job.city || "Vietnam"}
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="badge-group">
            {job.level && <span className="badge badge-level">Level: {job.level}</span>}
            {job.expMin != null && (
              <span className="badge badge-level">
                Exp: {job.expMin}{job.expMax ? ` - ${job.expMax}` : "+"} yrs
              </span>
            )}
            {job.remote && <span className="badge badge-remote">Mode: {job.remote}</span>}
            {job.matched && <span className="badge badge-match">Criteria Matched</span>}
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Current status:</span>
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

          {job.skills.length > 0 && (
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                Skills & Technologies:
              </div>
              <div className="skills-list">
                {job.skills.map((s) => (
                  <span key={s} className="skill-chip">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
              Original Sources:
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {job.sources.map((src, i) => (
                <a
                  key={i}
                  href={src.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-link-btn"
                >
                  Open on {src.site} ↗
                </a>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.5rem" }}>
              Job Description:
            </div>
            <div
              style={{
                background: "rgba(10, 14, 24, 0.6)",
                padding: "1.25rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)",
                fontSize: "0.9rem",
                maxHeight: "350px",
                overflowY: "auto",
              }}
            >
              {job.description || "No description provided."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
