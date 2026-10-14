"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FilterBar, type FilterState } from "@/components/FilterBar";
import { JobDetailPane } from "@/components/JobDetailPane";
import { JobListItem } from "@/components/JobListItem";
import { LoginModal } from "@/components/LoginModal";
import { StatsHeader } from "@/components/StatsHeader";
import type { Job, Status } from "@/lib/types";

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "all",
    city: "all",
    level: "all",
    remote: "all",
    onlyMatched: true,
  });

  const checkAuthAndLoad = async () => {
    try {
      setLoading(true);
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

  const handleStatusUpdate = async (id: string, newStatus: Status) => {
    // Optimistic update
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: newStatus } : j))
    );

    try {
      const res = await fetch(`/api/jobs/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
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

  // Keep selected job valid
  const selectedJob = useMemo(() => {
    if (filteredJobs.length === 0) return null;
    const found = filteredJobs.find((j) => j.id === selectedJobId);
    return found || filteredJobs[0] || null;
  }, [filteredJobs, selectedJobId]);

  // Sync selectedId when selection auto-shifts
  useEffect(() => {
    if (selectedJob && selectedJob.id !== selectedJobId) {
      setSelectedJobId(selectedJob.id);
    }
  }, [selectedJob, selectedJobId]);

  // Keyboard navigation: Up/Down arrow keys to select next/prev job
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in input or select
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
        return;
      }

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const currentIndex = filteredJobs.findIndex((j) => j.id === selectedJob?.id);
        if (currentIndex < filteredJobs.length - 1) {
          setSelectedJobId(filteredJobs[currentIndex + 1]!.id);
        }
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const currentIndex = filteredJobs.findIndex((j) => j.id === selectedJob?.id);
        if (currentIndex > 0) {
          setSelectedJobId(filteredJobs[currentIndex - 1]!.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredJobs, selectedJob]);

  if (authenticated === false) {
    return (
      <LoginModal
        onSuccess={() => {
          setAuthenticated(true);
          checkAuthAndLoad();
        }}
      />
    );
  }

  const matchedCount = jobs.filter((j) => j.matched).length;

  return (
    <div className="app-shell">
      <div className="app-container">
        {/* App Header */}
        <StatsHeader
          jobs={jobs}
          onRefresh={checkAuthAndLoad}
          onLogout={handleLogout}
          loading={loading}
        />

        {/* Filter Bar */}
        <FilterBar
          filters={filters}
          onChange={setFilters}
          jobs={jobs}
          matchedCount={matchedCount}
        />

        {/* Master-Detail Split Workspace */}
        {loading ? (
          <div className="state-card loading-state">
            <div className="loading-spinner" />
            <p>Syncing verified opportunities...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="state-card empty-filter-state">
            <h3>No opportunities match current criteria</h3>
            <p>
              Try expanding your location, clearing search terms, or toggling off "Matched Only".
            </p>
            <button
              type="button"
              className="btn-reset-filters"
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
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="workspace-split">
            {/* Left Column: Job List */}
            <aside className="split-list-column">
              <div className="list-column-header">
                <span className="count-label">
                  <strong>{filteredJobs.length}</strong> {filteredJobs.length === 1 ? "POSITION" : "POSITIONS"}
                </span>
                <span className="shortcut-hint">↑ ↓ to navigate</span>
              </div>
              <div className="list-items-container">
                {filteredJobs.map((job) => (
                  <JobListItem
                    key={job.id}
                    job={job}
                    isSelected={job.id === selectedJob?.id}
                    onSelect={(j) => setSelectedJobId(j.id)}
                  />
                ))}
              </div>
            </aside>

            {/* Right Column: Detail Inspector */}
            <main className="split-detail-column">
              <JobDetailPane
                job={selectedJob}
                onStatusChange={handleStatusUpdate}
              />
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
