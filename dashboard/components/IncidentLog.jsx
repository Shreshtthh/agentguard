"use client";

import { useState } from "react";

export default function IncidentLog({ incidents }) {
  const [expanded, setExpanded] = useState({});

  function toggleExpand(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function formatTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  function getScoreColor(score) {
    if (score >= 80) return "var(--critical)";
    if (score >= 60) return "var(--danger)";
    if (score >= 40) return "var(--warning)";
    return "var(--safe)";
  }

  function getActionColor(action) {
    if (action === "BLOCK") return "var(--critical)";
    if (action === "FLAG") return "var(--warning)";
    return "var(--safe)";
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>AI Incident Log</h3>
        {incidents && incidents.length > 0 && (
          <span className="badge badge-accent">{incidents.length}</span>
        )}
      </div>
      <div className="card-body">
        {!incidents || incidents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ fontSize: "1.4rem", opacity: 0.4 }}>--</div>
            <div className="empty-state-text">No AI-scored incidents yet</div>
          </div>
        ) : (
          <div className="incident-list">
            {incidents.slice(0, 20).map((inc, i) => {
              const isExpanded = expanded[inc.id || i];
              const verdict = inc.aiVerdict || {};

              return (
                <div
                  key={inc.id || i}
                  className="incident-item animate-slide-up"
                  onClick={() => toggleExpand(inc.id || i)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="incident-header">
                    <span className="incident-wallet">
                      {inc.walletName || "Unknown"}{" "}
                      <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                        {formatTime(inc.timestamp)}
                      </span>
                    </span>
                    <span
                      className="incident-score"
                      style={{ color: getScoreColor(verdict.risk_score) }}
                    >
                      {verdict.risk_score ?? "--"}/100
                    </span>
                  </div>

                  {verdict.reason && (
                    <div className="incident-reason">
                      {verdict.reason}
                    </div>
                  )}

                  <div className="incident-tags">
                    {inc.flags?.map((f, j) => (
                      <span key={j} className="incident-tag">
                        {f.rule}
                      </span>
                    ))}
                  </div>

                  <div className="incident-action">
                    <span
                      className="incident-action-badge"
                      style={{ color: getActionColor(verdict.recommended_action) }}
                    >
                      {verdict.recommended_action || "--"}
                    </span>

                    {verdict.model && (
                      <span style={{
                        fontSize: "0.62rem",
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                      }}>
                        {verdict.model} / {verdict.inference_time_ms}ms
                      </span>
                    )}
                  </div>

                  {isExpanded && inc.tx && (
                    <div
                      className="animate-slide-down"
                      style={{
                        marginTop: "10px",
                        padding: "10px 12px",
                        background: "rgba(0,0,0,0.2)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.68rem",
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <div>Amount: ${inc.tx.amount?.toFixed(2)} {inc.tx.asset}</div>
                      <div>To: {inc.tx.to?.slice(0, 12)}...{inc.tx.to?.slice(-6)}</div>
                      <div>Hash: {inc.tx.hash?.slice(0, 16)}...</div>
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${inc.tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="incident-link"
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginTop: "6px", display: "inline-block" }}
                      >
                        View on Stellar Expert
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
