"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_FILTERS,
  FilterBar,
  type FilterState,
} from "@/components/FilterBar";
import { JobDetailPane } from "@/components/JobDetailPane";
import { JobListItem } from "@/components/JobListItem";
import { LoginModal } from "@/components/LoginModal";
import { StatsHeader } from "@/components/StatsHeader";
import { IconUndo } from "@/components/Icons";
import { evaluateDecision, salaryTopInVND } from "@/lib/decision";
import type { Job, Status } from "@/lib/types";

interface UndoState {
  jobId: string;
  jobTitle: string;
  prevStatus: Status;
  newStatus: Status;
}

const STATUS_ACTION_LABELS: Record<Status, string> = {
  new: "Đưa lại inbox",
  saved: "Đã lưu — đã xử lý & ẩn khỏi inbox",
  applied: "Đã ghi nhận applied & ẩn khỏi inbox",
  rejected: "Đã bỏ qua & ẩn khỏi inbox",
};

function jobDate(job: Job): number {
  const t = new Date(job.postedAt ?? job.firstSeenAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [filters, setFilters] = useState<FilterState>({ ...DEFAULT_FILTERS });

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

  const filteredJobs = useMemo(() => {
    const filtered = jobs.filter((job) => {
      // View filter — the heart of the triage flow. The default inbox
      // shows ONLY jobs that have never been handled.
      if (filters.status === "inbox" && job.status !== "new") return false;
      if (filters.status === "processed" && job.status === "new") return false;
      if (filters.status === "applied" && job.status !== "applied") return false;

      if (filters.city !== "all" && job.city !== filters.city) return false;
      if (filters.level !== "all" && job.level !== filters.level) return false;
      if (filters.remote !== "all" && job.remote !== filters.remote) return false;
      if (filters.onlyMatched && !job.matched) return false;

      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const inTitle = job.title.toLowerCase().includes(q);
        const inCompany = job.company.toLowerCase().includes(q);
        const inSkills = job.skills.some((s) => s.toLowerCase().includes(q));
        const inDesc = job.description.toLowerCase().includes(q);
        if (!inTitle && !inCompany && !inSkills && !inDesc) return false;
      }

      return true;
    });

    const sorted = [...filtered];
    switch (filters.sort) {
      case "salary":
        sorted.sort((a, b) => {
          const sa = salaryTopInVND(a);
          const sb = salaryTopInVND(b);
          if (sa === null && sb === null) return jobDate(b) - jobDate(a);
          if (sa === null) return 1;
          if (sb === null) return -1;
          return sb - sa || jobDate(b) - jobDate(a);
        });
        break;
      case "score":
        sorted.sort(
          (a, b) =>
            evaluateDecision(b).score - evaluateDecision(a).score ||
            jobDate(b) - jobDate(a),
        );
        break;
      case "newest":
      default:
        sorted.sort((a, b) => jobDate(b) - jobDate(a));
        break;
    }
    return sorted;
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

  const persistStatus = async (id: string, status: Status) => {
    try {
      const res = await fetch(`/api/jobs/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) checkAuthAndLoad();
    } catch {
      checkAuthAndLoad();
    }
  };

  /**
   * The one action that drives the whole flow: set a job's status, hide it
   * from the current view when the status no longer belongs there, jump to
   * the next job, and offer Undo. Used by the detail pane, the list-item
   * quick actions, and the keyboard shortcuts alike.
   */
  const handleJobAction = (id: string, newStatus: Status) => {
    const job = jobs.find((j) => j.id === id);
    if (!job || job.status === newStatus) return;
    const prevStatus = job.status;

    // Auto-advance: if this action removes the selected job from the
    // current view, move selection to the next job (or the previous one
    // when it was last) so triage never breaks flow.
    const leavesView =
      (filters.status === "inbox" && newStatus !== "new") ||
      (filters.status === "processed" && newStatus === "new") ||
      (filters.status === "applied" && newStatus !== "applied");
    if (leavesView && selectedJobId === id) {
      const idx = filteredJobs.findIndex((j) => j.id === id);
      const next = filteredJobs[idx + 1] ?? filteredJobs[idx - 1] ?? null;
      if (next) setSelectedJobId(next.id);
    }

    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, status: newStatus } : j)),
    );
    persistStatus(id, newStatus);

    // Undo toast (restoring to the inbox is its own explicit action in the
    // detail pane, so no toast needed for it).
    if (undoTimer.current) clearTimeout(undoTimer.current);
    if (newStatus !== "new") {
      setUndoState({
        jobId: id,
        jobTitle: job.title,
        prevStatus,
        newStatus,
      });
      undoTimer.current = setTimeout(() => setUndoState(null), 8000);
    } else {
      setUndoState(null);
    }
  };

  const handleUndo = () => {
    if (!undoState) return;
    const { jobId, prevStatus } = undoState;
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: prevStatus } : j)),
    );
    persistStatus(jobId, prevStatus);
    setSelectedJobId(jobId);
    setUndoState(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  };

  // Always point the keyboard handler at the latest closures.
  const actionRef = useRef(handleJobAction);
  actionRef.current = handleJobAction;
  const undoRef = useRef(handleUndo);
  undoRef.current = handleUndo;

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setAuthenticated(false);
    setJobs([]);
  };

  // Keyboard triage: j/k or arrows move, o opens the source, s/a/x triage
  // the selected job (save-hide / applied / skip), u undoes the last action.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (
        activeTag === "input" ||
        activeTag === "textarea" ||
        activeTag === "select" ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }

      const currentIndex = filteredJobs.findIndex((j) => j.id === selectedJob?.id);

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        if (currentIndex < filteredJobs.length - 1) {
          setSelectedJobId(filteredJobs[currentIndex + 1]!.id);
        }
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        if (currentIndex > 0) {
          setSelectedJobId(filteredJobs[currentIndex - 1]!.id);
        }
      } else if (!selectedJob) {
        return;
      } else if (e.key === "o") {
        const url = selectedJob.sources[0]?.url;
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      } else if (e.key === "s") {
        actionRef.current(selectedJob.id, "saved");
      } else if (e.key === "a") {
        actionRef.current(selectedJob.id, "applied");
      } else if (e.key === "x") {
        actionRef.current(selectedJob.id, "rejected");
      } else if (e.key === "u") {
        undoRef.current();
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
  // Progress counts use the same matched scope as the tabs/header pills,
  // so "Đã duyệt X/Y" always agrees with the numbers next to it.
  const scopedJobs = filters.onlyMatched ? jobs.filter((j) => j.matched) : jobs;
  const processedCount = scopedJobs.filter((j) => j.status !== "new").length;
  const isInboxZero =
    !loading &&
    filteredJobs.length === 0 &&
    filters.status === "inbox" &&
    jobs.length > 0 &&
    jobs.every((j) => j.status !== "new");

  return (
    <div className="app-shell">
      <div className="app-container">
        <StatsHeader
          jobs={jobs}
          onRefresh={checkAuthAndLoad}
          onLogout={handleLogout}
          loading={loading}
          matchedOnly={filters.onlyMatched}
        />

        <FilterBar
          filters={filters}
          onChange={setFilters}
          jobs={jobs}
          matchedCount={matchedCount}
        />

        {loading ? (
          <div className="state-card loading-state">
            <div className="loading-spinner" />
            <p>Đang đồng bộ danh sách job...</p>
          </div>
        ) : isInboxZero ? (
          <div className="state-card empty-filter-state">
            <h3>🎉 Inbox Zero — đã xử lý hết job hiện có</h3>
            <p>
              Mọi job đã được lưu/apply/bỏ qua và sẽ không hiện lại trong inbox,
              kể cả sau các lần crawl sau. Job mới sẽ tự xuất hiện ở đây.
            </p>
            <div className="empty-state-actions">
              <button
                type="button"
                className="btn-reset-filters"
                onClick={() => setFilters({ ...filters, status: "processed" })}
              >
                Xem job đã xử lý
              </button>
              <button
                type="button"
                className="btn-reset-filters btn-ghost"
                onClick={() => setFilters({ ...DEFAULT_FILTERS, onlyMatched: false })}
              >
                Xem tất cả job
              </button>
            </div>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="state-card empty-filter-state">
            <h3>Không có job nào khớp bộ lọc hiện tại</h3>
            <p>
              Thử mở rộng địa điểm, xóa từ khóa tìm kiếm, hoặc tắt &quot;Chỉ job
              matched&quot;.
            </p>
            <button
              type="button"
              className="btn-reset-filters"
              onClick={() => setFilters({ ...DEFAULT_FILTERS })}
            >
              Đặt lại bộ lọc
            </button>
          </div>
        ) : (
          <div className="workspace-split">
            <aside className="split-list-column">
              <div className="list-column-header">
                <span className="count-label">
                  <strong>{filteredJobs.length}</strong>{" "}
                  {filteredJobs.length === 1 ? "JOB" : "JOBS"}
                </span>
                <span className="list-header-right">
                  <span className="triage-progress">
                    Đã duyệt {processedCount}/{scopedJobs.length}
                  </span>
                  <span className="shortcut-hint">j/k duyệt • o mở • s/a/x xử lý</span>
                </span>
              </div>
              <div className="list-items-container">
                {filteredJobs.map((job) => (
                  <JobListItem
                    key={job.id}
                    job={job}
                    isSelected={job.id === selectedJob?.id}
                    onSelect={(j) => setSelectedJobId(j.id)}
                    onQuickAction={handleJobAction}
                  />
                ))}
              </div>
            </aside>

            <main className="split-detail-column">
              <JobDetailPane job={selectedJob} onStatusChange={handleJobAction} />
            </main>
          </div>
        )}

        {undoState && (
          <div className="undo-toast" role="status">
            <span className="undo-toast-text">
              {STATUS_ACTION_LABELS[undoState.newStatus]}:{" "}
              <strong>{undoState.jobTitle}</strong>
            </span>
            <button type="button" className="undo-toast-btn" onClick={handleUndo}>
              <IconUndo size={13} />
              <span>Hoàn tác (U)</span>
            </button>
            <button
              type="button"
              className="undo-toast-close"
              onClick={() => setUndoState(null)}
              aria-label="Đóng thông báo hoàn tác"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
