"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FilterBar, type FilterState } from "@/components/FilterBar";
import { JobCard } from "@/components/JobCard";
import { JobDetailModal } from "@/components/JobDetailModal";
import { LoginModal } from "@/components/LoginModal";
import { StatsHeader } from "@/components/StatsHeader";
import type { Job, Status } from "@/lib/types";

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "all",
    city: "all",
    level: "all",
    remote: "all",
    onlyMatched: false,
  });

  const checkAuthAndLoad = async () => {
    try {
      const authRes = await fetch("/api/auth");
      const authData = await authRes.json();
      if (!authData.authenticated) {
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      setAuthenticated(true);
      const jobsRes = await fetch("/api/jobs");
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData.jobs ?? []);
      }
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const handleStatusChange = async (id: string, newStatus: Status) => {
    // Optimistic update
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: newStatus } : j))
    );
    if (selectedJob && selectedJob.id === id) {
      setSelectedJob((prev) => (prev ? { ...prev, status: newStatus } : null));
    }

    try {
      const res = await fetch(`/api/jobs/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        // Rollback on error
        checkAuthAndLoad();
      }
    } catch {
      checkAuthAndLoad();
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setAuthenticated(false);
    setJobs([]);
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Status filter
      if (filters.status !== "all" && job.status !== filters.status) {
        return false;
      }

      // City filter
      if (filters.city !== "all" && job.city !== filters.city) {
        return false;
      }

      // Level filter
      if (filters.level !== "all" && job.level !== filters.level) {
        return false;
      }

      // Remote filter
      if (filters.remote !== "all" && job.remote !== filters.remote) {
        return false;
      }

      // Only matched
      if (filters.onlyMatched && !job.matched) {
        return false;
      }

      // Search keyword
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const inTitle = job.title.toLowerCase().includes(q);
        const inCompany = job.company.toLowerCase().includes(q);
        const inSkills = job.skills.some((s) => s.toLowerCase().includes(q));
        const inDesc = job.description.toLowerCase().includes(q);
        if (!inTitle && !inCompany && !inSkills && !inDesc) {
          return false;
        }
      }

      return true;
    });
  }, [jobs, filters]);

  if (authenticated === false) {
    return <LoginModal onSuccess={() => { setAuthenticated(true); checkAuthAndLoad(); }} />;
  }

  return (
    <div className="container">
      {/* Header */}
      <header className="header-wrapper">
        <div className="brand-section">
          <div className="brand-logo">🚀</div>
          <div>
            <h1 className="brand-title">Job Crawler VN</h1>
            <p className="brand-subtitle">
              Automated Frontend & Fullstack Job Board • Single-User Hunt Tracker
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={checkAuthAndLoad}
            className="tab-btn"
            title="Refresh jobs"
          >
            🔄 Refresh
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="tab-btn"
            style={{ borderColor: "rgba(244, 63, 94, 0.3)", color: "var(--accent-rose)" }}
          >
            🔒 Lock
          </button>
        </div>
      </header>

      {/* Stats Summary */}
      <StatsHeader jobs={jobs} />

      {/* Filter and Search Bar */}
      <FilterBar filters={filters} onChange={setFilters} jobs={jobs} />

      {/* Jobs List */}
      {loading ? (
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <h3>Loading jobs from database...</h3>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="glass-panel empty-state">
          <div className="empty-icon">🎯</div>
          <h3 style={{ marginBottom: "0.5rem", color: "#ffffff" }}>No matching jobs found</h3>
          <p style={{ maxWidth: "420px", margin: "0 auto 1.5rem" }}>
            Try relaxing your search terms or changing your status and location filters.
          </p>
          <button
            type="button"
            className="tab-btn active"
            onClick={() =>
              setFilters({
                search: "",
                status: "all",
                city: "all",
                level: "all",
                remote: "all",
                onlyMatched: false,
              })
            }
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="jobs-grid">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onStatusChange={handleStatusChange}
              onSelect={setSelectedJob}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <JobDetailModal
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
