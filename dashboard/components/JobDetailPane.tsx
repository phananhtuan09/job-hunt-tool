"use client";

import React, { useMemo, useState } from "react";
import {
  evaluateDecision,
  extractSnippets,
  postedAgeLabel,
  type CheckStatus,
} from "@/lib/decision";
import type { Job, Status } from "@/lib/types";
import {
  IconArchive,
  IconBriefcase,
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconSearch,
  IconSend,
  IconSparkles,
  IconUndo,
  IconX,
} from "./Icons";

interface JobDetailPaneProps {
  job: Job | null;
  onStatusChange: (id: string, status: Status) => void;
}

const STATUS_LABELS: Record<Status, string> = {
  new: "Chưa xử lý",
  saved: "Đã xử lý",
  applied: "Đã apply",
  rejected: "Đã bỏ qua",
};

function checkIcon(status: CheckStatus): string {
  if (status === "pass") return "✓";
  if (status === "fail") return "✗";
  return "?";
}

/**
 * Quick-decision pane. Deliberately does NOT render the full job
 * description: it shows only what is needed to decide whether the job is
 * worth opening on the source site (verdict, criteria comparison,
 * strengths/warnings, at most 3 decision-bearing excerpts). The full JD
 * lives on the source site, one click away via "Mở nguồn".
 */
export function JobDetailPane({ job, onStatusChange }: JobDetailPaneProps) {
  const [copied, setCopied] = useState(false);

  const decision = useMemo(() => (job ? evaluateDecision(job) : null), [job]);
  const snippets = useMemo(
    () => (job ? extractSnippets(job.description, 3) : []),
    [job],
  );

  if (!job || !decision) {
    return (
      <div className="detail-pane empty-pane">
        <div className="empty-content">
          <div className="empty-icon-box">
            <IconBriefcase size={28} />
          </div>
          <h3>Chọn một job để ra quyết định</h3>
          <p>
            Chọn job ở danh sách bên trái để xem nhanh: có đáng mở nguồn để apply hay
            không. Cần đọc JD đầy đủ thì mở thẳng trang nguồn.
          </p>
        </div>
      </div>
    );
  }

  const primaryUrl = job.sources[0]?.url || "";
  const primarySite = job.sources[0]?.site || "Direct";
  const isLinkedIn =
    primarySite.toLowerCase().includes("linkedin") || primaryUrl.includes("linkedin.com");
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `${job.company} ${job.title}`,
  )}`;

  const handleCopyLink = () => {
    if (!primaryUrl) return;
    navigator.clipboard.writeText(primaryUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const passCount = decision.checks.filter((c) => c.status === "pass").length;
  const failCount = decision.checks.filter((c) => c.status === "fail").length;
  const isHandled = job.status !== "new";

  return (
    <div className="detail-pane">
      {/* Header + open-source actions */}
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
            {isHandled && (
              <span className={`badge-status badge-status-${job.status}`}>
                {STATUS_LABELS[job.status].toUpperCase()}
              </span>
            )}
          </div>
          <h2 className="pane-title">{job.title}</h2>
          <div className="pane-meta-line">
            <span>{postedAgeLabel(job)}</span>
            <span aria-hidden="true">•</span>
            <span>
              Thấy lần đầu {new Date(job.firstSeenAt).toLocaleDateString("vi-VN")}
            </span>
            <span aria-hidden="true">•</span>
            <span>
              {job.sources.length} nguồn
              {job.remote ? ` • ${job.remote.toUpperCase()}` : ""}
            </span>
          </div>
        </div>

        <div className="pane-primary-actions">
          {primaryUrl && (
            <a
              href={primaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary-apply"
              title="Mở trang gốc để đọc JD đầy đủ và apply (không tự ghi nhận đã apply)"
            >
              <span>Mở nguồn {primarySite}</span>
              <IconExternalLink size={14} />
            </a>
          )}
          {isLinkedIn && (
            <a
              href={googleSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary-search"
              title="Tìm tin tuyển dụng trên Google nếu mạng bị chặn LinkedIn"
            >
              <IconSearch size={14} />
              <span>Tìm trên Google</span>
            </a>
          )}
          {primaryUrl && (
            <button
              type="button"
              className="btn-secondary-copy"
              onClick={handleCopyLink}
              title="Copy link gốc"
            >
              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
              <span>{copied ? "Đã copy" : "Copy"}</span>
            </button>
          )}
        </div>
      </div>

      {isLinkedIn && (
        <div className="linkedin-notice-banner">
          <span className="notice-icon">💡</span>
          <div className="notice-text">
            <strong>Mẹo mở LinkedIn:</strong> Nhiều nhà mạng tại VN (Viettel, VNPT, FPT)
            chặn domain <code>linkedin.com</code>. Hãy bật <strong>Cloudflare WARP
            (1.1.1.1)</strong> hoặc <strong>VPN</strong> để mở link gốc, hoặc bấm{" "}
            <strong>Tìm trên Google</strong> ở trên.
          </div>
        </div>
      )}

      {/* Verdict banner — the 5-second answer */}
      <div className={`verdict-banner verdict-${decision.verdict}`}>
        <div className="verdict-main">
          <span className="verdict-label">{decision.verdictLabel}</span>
          <span className="verdict-summary">
            {passCount} tiêu chí đạt • {failCount} không đạt • điểm khớp{" "}
            {decision.score}/100 theo tiêu chí của bạn trong config.yaml
          </span>
        </div>
        <div className="verdict-score" aria-label={`Điểm khớp ${decision.score} trên 100`}>
          {decision.score}
        </div>
      </div>

      {/* Quick triage actions — every action hides the job from the inbox */}
      {!isHandled ? (
        <div className="quick-actions">
          <button
            type="button"
            className="btn-action btn-action-applied"
            onClick={() => onStatusChange(job.id, "applied")}
            title="Đã nộp đơn ở trang nguồn — ghi nhận và ẩn khỏi inbox (phím A)"
          >
            <IconSend size={15} />
            <span>Đã apply — ẩn</span>
            <kbd>A</kbd>
          </button>
          <button
            type="button"
            className="btn-action btn-action-saved"
            onClick={() => onStatusChange(job.id, "saved")}
            title="Đã xem / đã xử lý — lưu lại và ẩn khỏi inbox, xem lại ở tab Đã xử lý (phím S)"
          >
            <IconArchive size={15} />
            <span>Lưu — đã xử lý, ẩn</span>
            <kbd>S</kbd>
          </button>
          <button
            type="button"
            className="btn-action btn-action-rejected"
            onClick={() => onStatusChange(job.id, "rejected")}
            title="Không đáng apply — bỏ qua và ẩn khỏi inbox (phím X)"
          >
            <IconX size={15} />
            <span>Bỏ qua — ẩn</span>
            <kbd>X</kbd>
          </button>
        </div>
      ) : (
        <div className="quick-actions">
          <button
            type="button"
            className="btn-action btn-action-restore"
            onClick={() => onStatusChange(job.id, "new")}
            title="Đưa job này trở lại inbox chưa xử lý"
          >
            <IconUndo size={15} />
            <span>Đưa lại inbox</span>
          </button>
          <span className="handled-note">
            Job đang ở trạng thái <strong>{STATUS_LABELS[job.status]}</strong> — không
            hiện trong inbox. Đổi trạng thái:
          </span>
          <div className="triage-segmented-control handled-switch">
            {(["saved", "applied", "rejected"] as const).map((st) => (
              <button
                key={st}
                type="button"
                className={`triage-btn ${job.status === st ? `active active-${st}` : ""}`}
                onClick={() => onStatusChange(job.id, st)}
              >
                <span className={`btn-dot status-${st}`} />
                <span className="triage-text">{STATUS_LABELS[st].toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Criteria comparison: your target vs this job */}
      <div className="pane-section">
        <div className="section-title">TIÊU CHÍ CỦA BẠN vs JOB NÀY</div>
        <div className="criteria-table">
          {decision.checks.map((check) => (
            <div key={check.key} className="criteria-row">
              <span className={`criteria-icon criteria-${check.status}`}>
                {checkIcon(check.status)}
              </span>
              <span className="criteria-label">{check.label}</span>
              <span className="criteria-actual">{check.actual}</span>
              <span className="criteria-target">mục tiêu: {check.target}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths & warnings */}
      {(decision.strengths.length > 0 || decision.warnings.length > 0) && (
        <div className="signals-grid">
          <div className="signal-card signal-strengths">
            <div className="section-title">ĐIỂM MẠNH</div>
            {decision.strengths.length > 0 ? (
              <ul className="signal-list">
                {decision.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="signal-empty">Chưa thấy điểm nào khớp rõ ràng.</p>
            )}
          </div>
          <div className="signal-card signal-warnings">
            <div className="section-title">CẦN LƯU Ý</div>
            {decision.warnings.length > 0 ? (
              <ul className="signal-list">
                {decision.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : (
              <p className="signal-empty">Không có điểm nào cần lưu ý.</p>
            )}
          </div>
        </div>
      )}

      {/* Skills */}
      {job.skills.length > 0 && (
        <div className="pane-section">
          <div className="section-title">TECH STACK & TỪ KHÓA</div>
          <div className="skills-cloud">
            {job.skills.map((skill) => (
              <span key={skill} className="skill-tag">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Decision excerpts — never the full JD */}
      <div className="pane-section">
        <div className="section-title">
          TRÍCH ĐOẠN QUYẾT ĐỊNH{" "}
          <span className="section-title-note">
            (tối đa 3 đoạn — JD đầy đủ xem ở nguồn)
          </span>
        </div>
        {snippets.length > 0 ? (
          <div className="snippets-list">
            {snippets.map((snippet, idx) => (
              <blockquote key={idx} className="snippet-card">
                <span className="snippet-label">{snippet.label}</span>
                <p className="snippet-text">{snippet.text}</p>
              </blockquote>
            ))}
          </div>
        ) : (
          <p className="signal-empty">
            Tin đăng không có đoạn nào chứa dữ kiện quyết định (lương, kinh nghiệm, yêu
            cầu cứng) — quyết định dựa trên bảng tiêu chí phía trên, hoặc mở nguồn để
            kiểm tra.
          </p>
        )}
      </div>

      {/* Sources */}
      <div className="pane-section">
        <div className="section-title">NGUỒN ĐĂNG</div>
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
  );
}
