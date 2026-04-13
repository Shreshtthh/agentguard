"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import WalletGrid from "@/components/WalletGrid";
import AlertFeed from "@/components/AlertFeed";
import SpendingChart from "@/components/SpendingChart";
import IncidentLog from "@/components/IncidentLog";
import PolicyPanel from "@/components/PolicyPanel";
import DemoButton from "@/components/DemoButton";

const DEFAULT_STATE = {
  wallets: {},
  alerts: [],
  incidents: [],
  systemRisk: "LOW",
  stats: { totalMonitored: 0, totalBlocked: 0, totalAllowed: 0, totalAlerts: 0 },
  uptime: 0,
};

export default function Dashboard() {
  const [state, setState] = useState(DEFAULT_STATE);
  const [mode, setMode] = useState("demo"); // always start as demo to avoid hydration mismatch

  // Set mode after mount to avoid hydration mismatch
  useEffect(() => {
    const envMode = process.env.NEXT_PUBLIC_MODE || "demo";
    setMode(envMode);
  }, []);

  // Live mode: poll backend every 2 seconds
  useEffect(() => {
    if (mode !== "live") return;

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

    async function poll() {
      try {
        const res = await fetch(`${backendUrl}/api/state`);
        if (res.ok) {
          const data = await res.json();
          setState(data);
        }
      } catch {
        // Backend might not be running yet
      }
    }

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [mode]);

  // Demo mode: handle replay events
  const handleDemoUpdate = useCallback((event) => {
    const now = Date.now();

    setState((prev) => {
      const next = JSON.parse(JSON.stringify(prev));

      switch (event.type) {
        case "state_update": {
          if (event.data.wallets) {
            next.wallets = event.data.wallets;
            next.alerts = event.data.alerts || [];
            next.incidents = event.data.incidents || [];
            next.systemRisk = event.data.systemRisk || "LOW";
            next.stats = event.data.stats || next.stats;
          } else if (event.data.wallet && event.data.updates) {
            const w = next.wallets[event.data.wallet];
            if (w) {
              Object.assign(w, event.data.updates);
            }
          }
          break;
        }

        case "alert": {
          const alert = { ...event.data, timestamp: event.data.timestamp || now };
          next.alerts.unshift(alert);
          if (next.alerts.length > 100) next.alerts.pop();
          next.stats.totalAlerts = (next.stats.totalAlerts || 0) + 1;
          break;
        }

        case "incident": {
          const incident = { ...event.data, timestamp: event.data.timestamp || now };
          next.incidents.unshift(incident);
          if (next.incidents.length > 50) next.incidents.pop();
          break;
        }

        case "system_risk": {
          next.systemRisk = event.data.systemRisk;
          break;
        }

        case "stat_update": {
          Object.assign(next.stats, event.data);
          break;
        }

        default:
          break;
      }

      return next;
    });
  }, []);

  return (
    <div className="dashboard">
      <Header
        systemRisk={state.systemRisk}
        stats={state.stats}
        mode={mode}
        uptime={state.uptime}
      />

      <DemoButton onUpdate={handleDemoUpdate} mode={mode} />

      <div className="dashboard-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <WalletGrid wallets={state.wallets} />
          <SpendingChart wallets={state.wallets} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <AlertFeed alerts={state.alerts} />
          <IncidentLog incidents={state.incidents} />
        </div>
      </div>

      <div style={{ marginTop: "20px" }}>
        <PolicyPanel
          contractId={process.env.NEXT_PUBLIC_CONTRACT_ID}
          wallets={state.wallets}
        />
      </div>
    </div>
  );
}
