"use client";

export default function SpendingChart({ wallets }) {
  if (!wallets || Object.keys(wallets).length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3>Spending vs. Limits</h3>
        </div>
        <div className="card-body">
          <div className="empty-state">
            <div className="empty-state-icon" style={{ fontSize: "1.4rem", opacity: 0.4 }}>--</div>
            <div className="empty-state-text">No spending data yet</div>
          </div>
        </div>
      </div>
    );
  }

  function getBarColor(ratio) {
    if (ratio > 1) return "linear-gradient(90deg, var(--danger), var(--critical))";
    if (ratio > 0.8) return "linear-gradient(90deg, var(--warning), var(--danger))";
    if (ratio > 0.5) return "linear-gradient(90deg, var(--safe), var(--warning))";
    return "linear-gradient(90deg, var(--safe), #00e6b8)";
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>Spending vs. Limits</h3>
      </div>
      <div className="card-body">
        <div className="spending-chart">
          {Object.entries(wallets).map(([pubkey, w]) => {
            const limit = w.dailyLimit || 1;
            const spent = w.spentToday || 0;
            const ratio = spent / limit;
            const percent = Math.min(ratio * 100, 120);

            return (
              <div key={pubkey} className="spending-row">
                <span className="spending-label">{w.name}</span>
                <div className="spending-bar-container">
                  <div
                    className="spending-bar-fill"
                    style={{
                      width: `${Math.min(percent, 100)}%`,
                      background: getBarColor(ratio),
                    }}
                  />
                  <div
                    className="spending-limit-line"
                    style={{ left: "100%" }}
                    title={`Daily limit: $${limit.toFixed(2)}`}
                  />
                </div>
                <span
                  className="spending-value"
                  style={{
                    color: ratio > 1 ? "var(--critical)" :
                           ratio > 0.8 ? "var(--danger)" :
                           "var(--text-primary)",
                  }}
                >
                  ${spent.toFixed(2)} / ${limit.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
