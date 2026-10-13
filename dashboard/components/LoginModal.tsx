"use client";

import React, { useState } from "react";

interface LoginModalProps {
  onSuccess: () => void;
}

export function LoginModal({ onSuccess }: LoginModalProps) {
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secret.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Invalid secret key");
      }

      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "420px", textAlign: "center" }}>
        <div style={{ padding: "2.5rem 2rem" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.2))",
              border: "1px solid var(--accent-emerald)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
              fontSize: "1.75rem",
            }}
          >
            🔐
          </div>

          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Job Hunt Tool
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1.75rem" }}>
            Enter your dashboard passkey to access your personalized job tracker.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <input
              type="password"
              className="search-input"
              style={{ textAlign: "center", paddingLeft: "1rem" }}
              placeholder="Enter secret key..."
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoFocus
            />

            {error && (
              <div style={{ color: "var(--accent-rose)", fontSize: "0.82rem", fontWeight: 600 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="tab-btn active"
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "0.85rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.95rem",
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "Verifying..." : "Unlock Dashboard"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
