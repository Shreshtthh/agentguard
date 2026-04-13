"use client";

export default function AlertFeed({ alerts }) {
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

  return (
    <div className="card">
      <div className="card-header">
        <h3>Alert Feed</h3>
        {alerts && alerts.length > 0 && (
          <span className="badge badge-danger">{alerts.length}</span>
        )}
      </div>
      <div className="card-body">
        {!alerts || alerts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ fontSize: "1.4rem", opacity: 0.4 }}>--</div>
            <div className="empty-state-text">No alerts — all systems normal</div>
          </div>
        ) : (
          <div className="alert-feed">
            {alerts.slice(0, 30).map((alert, i) => (
              <div key={alert.id || i} className="alert-item animate-slide-down">
                <div className={`alert-dot ${alert.severity}`} />
                <div className="alert-content">
                  <div className="alert-meta">
                    <span className="alert-wallet">{alert.walletName || "Unknown"}</span>
                    <span className="alert-rule">{alert.rule}</span>
                    <span className="alert-time">{formatTime(alert.timestamp)}</span>
                  </div>
                  <div className="alert-detail">{alert.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
