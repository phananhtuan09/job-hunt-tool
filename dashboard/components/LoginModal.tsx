"use client";

import React, { useState } from "react";
import { IconLock } from "./Icons";

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
        throw new Error(data.error || "Invalid passkey");
      }

      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-modal-overlay">
      <div className="login-modal-card">
        <div className="login-icon-box">
          <IconLock size={22} />
        </div>

        <h2 className="login-title">HUNT RADAR</h2>
        <p className="login-subtitle">
          Enter your passkey to access your personal triage tracker.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="password"
            className="login-input"
            placeholder="Enter passkey (e.g. hunter2026)..."
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoFocus
          />

          {error && <div className="login-error-msg">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="login-submit-btn"
          >
            {loading ? "Verifying..." : "Unlock Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
