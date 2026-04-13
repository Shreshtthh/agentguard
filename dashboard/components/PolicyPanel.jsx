"use client";

import { useState } from "react";

export default function PolicyPanel({ contractId, wallets }) {
  const [isOpen, setIsOpen] = useState(false);
  const [policyData, setPolicyData] = useState({});
  const [loading, setLoading] = useState(false);

  async function checkAll() {
    if (!wallets) return;
    setLoading(true);
    for (const pubkey of Object.keys(wallets)) {
      try {
        const res = await fetch(`/api/check-policy?agent=${pubkey}`);
        const data = await res.json();
        setPolicyData((prev) => ({ ...prev, [pubkey]: data }));
      } catch (err) {
        setPolicyData((prev) => ({
          ...prev,
          [pubkey]: { error: err.message },
        }));
      }
    }
    setLoading(false);
  }

  const displayContractId = contractId
    ? `${contractId.slice(0, 8)}...${contractId.slice(-6)}`
    : "Not configured";

  return (
    <div className="policy-panel dashboard-grid-full">
      <div className="policy-header" onClick={() => setIsOpen(!isOpen)}>
        <h3 style={{
          fontSize: "0.8rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-secondary)",
        }}>
          Soroban SpendingPolicy Contract
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="mono" style={{
            fontSize: "0.7rem",
            color: "var(--accent-light)",
          }}>
            {displayContractId}
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
            {isOpen ? "\u25B2" : "\u25BC"}
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="policy-content animate-slide-down">
          {contractId && (
            <div style={{ marginBottom: "12px" }}>
              <a
                href={`https://stellar.expert/explorer/testnet/contract/${contractId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="incident-link"
                style={{ fontSize: "0.72rem" }}
              >
                View contract on Stellar Expert
              </a>
            </div>
          )}

          <button
            className="policy-check-btn"
            onClick={checkAll}
            disabled={loading || !wallets || Object.keys(wallets).length === 0}
          >
            {loading ? "Querying Soroban RPC..." : "Check All Policies On-Chain"}
          </button>

          {Object.keys(policyData).length > 0 && (
            <div style={{ marginTop: "16px" }}>
              {Object.entries(policyData).map(([pubkey, data]) => {
                const walletInfo = wallets?.[pubkey];
                return (
                  <div key={pubkey} style={{ marginBottom: "16px" }}>
                    <div style={{
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      marginBottom: "8px",
                      color: "var(--text-primary)",
                    }}>
                      {walletInfo?.name || pubkey.slice(0, 12)}
                    </div>

                    {data.error ? (
                      <div style={{
                        fontSize: "0.72rem",
                        color: "var(--danger)",
                        padding: "8px 12px",
                        background: "var(--danger-bg)",
                        borderRadius: "var(--radius-sm)",
                      }}>
                        Error: {data.error}
                      </div>
                    ) : (
                      <div className="policy-grid">
                        <div className="policy-stat">
                          <div className="policy-stat-label">Status</div>
                          <div
                            className="policy-stat-value"
                            style={{
                              color: data.paused ? "var(--critical)" : "var(--safe)",
                            }}
                          >
                            {data.paused ? "PAUSED" : "ACTIVE"}
                          </div>
                        </div>
                        <div className="policy-stat">
                          <div className="policy-stat-label">Daily Limit</div>
                          <div className="policy-stat-value">
                            ${((data.daily_limit || 0) / 1_000_000).toFixed(2)}
                          </div>
                        </div>
                        <div className="policy-stat">
                          <div className="policy-stat-label">Spent Today</div>
                          <div className="policy-stat-value">
                            ${((data.spent_today || 0) / 1_000_000).toFixed(2)}
                          </div>
                        </div>
                        <div className="policy-stat">
                          <div className="policy-stat-label">Blocked</div>
                          <div className="policy-stat-value" style={{ color: "var(--danger)" }}>
                            {data.total_blocked || 0}
                          </div>
                        </div>
                        <div className="policy-stat">
                          <div className="policy-stat-label">Allowed</div>
                          <div className="policy-stat-value" style={{ color: "var(--safe)" }}>
                            {data.total_allowed || 0}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
