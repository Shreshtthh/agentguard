"use client";

export default function Header({ systemRisk, stats, mode, uptime }) {
  function formatUptime(seconds) {
    if (!seconds) return "0s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-logo">AG</div>
        <div>
          <div className="header-title">AgentGuard</div>
          <div className="header-subtitle">
            AI-Powered Security Watchdog for Stellar Agents
          </div>
        </div>
      </div>

      <div className="header-right">
        <div className={`risk-gauge ${systemRisk || "LOW"}`}>
          <div className="risk-gauge-indicator" />
          <span className="risk-gauge-label">
            System: {systemRisk || "LOW"}
          </span>
        </div>

        <span className={`badge ${mode === "demo" ? "badge-accent" : "badge-safe"}`}>
          {mode === "demo" ? "DEMO" : "LIVE"}
        </span>

        <div className="header-stat">
          <div className="header-stat-label">Monitored</div>
          <div className="header-stat-value" style={{ color: "var(--safe)" }}>
            {stats?.totalMonitored || 0}
          </div>
        </div>

        <div className="header-stat">
          <div className="header-stat-label">Alerts</div>
          <div className="header-stat-value" style={{ color: "var(--warning)" }}>
            {stats?.totalAlerts || 0}
          </div>
        </div>

        <div className="header-stat">
          <div className="header-stat-label">Blocked</div>
          <div className="header-stat-value" style={{ color: "var(--danger)" }}>
            {stats?.totalBlocked || 0}
          </div>
        </div>

        <div className="header-stat">
          <div className="header-stat-label">Uptime</div>
          <div className="header-stat-value mono" style={{ color: "var(--text-secondary)" }}>
            {formatUptime(uptime)}
          </div>
        </div>
      </div>
    </header>
  );
}
