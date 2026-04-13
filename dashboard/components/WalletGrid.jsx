"use client";

export default function WalletGrid({ wallets }) {
  if (!wallets || Object.keys(wallets).length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3>Monitored Wallets</h3>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <div className="empty-state-icon" style={{ fontSize: "1.4rem", opacity: 0.4 }}>--</div>
            <div className="empty-state-text">Waiting for wallet data...</div>
          </div>
        </div>
      </div>
    );
  }

  const statusIcon = {
    ACTIVE: "\u25CF", // filled circle
    WARNED: "\u25CF",
    CRITICAL: "\u25CF",
    PAUSED: "\u25A0", // filled square
  };

  const statusColor = {
    ACTIVE: "var(--safe)",
    WARNED: "var(--warning)",
    CRITICAL: "var(--danger)",
    PAUSED: "var(--critical)",
  };

  const statusClass = {
    ACTIVE: "status-active",
    WARNED: "status-warned",
    CRITICAL: "status-critical",
    PAUSED: "status-paused",
  };

  function getProgressColor(ratio) {
    if (ratio > 1) return "var(--critical)";
    if (ratio > 0.8) return "var(--danger)";
    if (ratio > 0.5) return "var(--warning)";
    return "var(--safe)";
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>Monitored Wallets</h3>
        <span className="badge badge-accent">{Object.keys(wallets).length}</span>
      </div>
      <div className="card-body">
        <div className="wallet-grid">
          {Object.entries(wallets).map(([pubkey, w]) => {
            const ratio = w.dailyLimit > 0 ? w.spentToday / w.dailyLimit : 0;
            const percent = Math.min(ratio * 100, 120);

            return (
              <div
                key={pubkey}
                className={`wallet-card ${statusClass[w.status] || ""}`}
              >
                <div className="wallet-header">
                  <span className="wallet-name">
                    <span style={{ color: statusColor[w.status], marginRight: "6px" }}>
                      {statusIcon[w.status] || "\u25CB"}
                    </span>
                    {w.name}
                  </span>
                  <span className={`badge badge-${
                    w.status === "ACTIVE" ? "safe" :
                    w.status === "WARNED" ? "warning" :
                    w.status === "PAUSED" ? "critical" : "danger"
                  }`}>
                    {w.status}
                  </span>
                </div>

                <div className="wallet-address">
                  {pubkey.slice(0, 8)}...{pubkey.slice(-6)}
                </div>

                <div className="wallet-progress">
                  <div className="wallet-progress-bar">
                    <div
                      className="wallet-progress-fill"
                      style={{
                        width: `${Math.min(percent, 100)}%`,
                        background: getProgressColor(ratio),
                      }}
                    />
                  </div>
                  <div className="wallet-progress-label">
                    <span>${w.spentToday?.toFixed(2) || "0.00"} spent</span>
                    <span>${w.dailyLimit?.toFixed(2) || "0.00"} limit</span>
                  </div>
                </div>

                <div className="wallet-stats">
                  <span>
                    Txns: <span className="wallet-stat-value">{w.txCount || 0}</span>
                  </span>
                  <span>
                    Risk: <span className="wallet-stat-value" style={{
                      color: w.riskLevel === "CRITICAL" ? "var(--critical)" :
                             w.riskLevel === "HIGH" ? "var(--danger)" :
                             w.riskLevel === "MEDIUM" ? "var(--warning)" :
                             "var(--safe)"
                    }}>{w.riskLevel || "LOW"}</span>
                  </span>
                  <a
                    href={`https://stellar.expert/explorer/testnet/account/${pubkey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="incident-link"
                    style={{ fontSize: "0.68rem" }}
                  >
                    View on Stellar
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
