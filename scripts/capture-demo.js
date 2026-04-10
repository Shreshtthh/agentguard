/**
 * Capture Demo — Runs the live system and captures state snapshots
 * into demo-data.json for the Vercel replay mode.
 * 
 * Usage:
 *   1. Start backend:  cd backend && node src/index.js
 *   2. Run normal:     node demo/normal-agent.js  (in another terminal)
 *   3. Run rogue:      sleep 30 && node demo/rogue-agent.js
 *   4. Capture:        node ../scripts/capture-demo.js
 * 
 * This script polls /api/state every 2s and records the deltas.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";
const DURATION_MS = 120_000; // Capture for 2 minutes
const POLL_INTERVAL = 2000;

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   📸 Capture Demo Data                      ║");
  console.log("║   Recording state changes for replay mode   ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log();
  console.log(`  Backend: ${BACKEND_URL}`);
  console.log(`  Duration: ${DURATION_MS / 1000}s`);
  console.log(`  Polling every ${POLL_INTERVAL / 1000}s`);
  console.log();

  let initialState = null;
  const timeline = [];
  let lastState = null;
  let lastAlertCount = 0;
  let lastIncidentCount = 0;
  const startTime = Date.now();

  const timer = setInterval(async () => {
    const elapsed = Date.now() - startTime;

    if (elapsed > DURATION_MS) {
      clearInterval(timer);
      saveCapturedData();
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/state`);
      const state = await res.json();

      if (!initialState) {
        initialState = JSON.parse(JSON.stringify(state));
        lastState = JSON.parse(JSON.stringify(state));
        lastAlertCount = state.alerts?.length || 0;
        lastIncidentCount = state.incidents?.length || 0;
        console.log(`  [${(elapsed / 1000).toFixed(0)}s] Initial state captured`);
        return;
      }

      // Detect new alerts
      const newAlerts = (state.alerts?.length || 0) - lastAlertCount;
      if (newAlerts > 0) {
        for (let i = 0; i < newAlerts; i++) {
          const alert = state.alerts[i];
          timeline.push({
            delay: Math.min(elapsed - (timeline[timeline.length - 1]?.delay || 0), 5000) || 500,
            type: "alert",
            data: alert,
          });
        }
        lastAlertCount = state.alerts.length;
        console.log(`  [${(elapsed / 1000).toFixed(0)}s] ${newAlerts} new alert(s)`);
      }

      // Detect new incidents
      const newIncidents = (state.incidents?.length || 0) - lastIncidentCount;
      if (newIncidents > 0) {
        for (let i = 0; i < newIncidents; i++) {
          const incident = state.incidents[i];
          timeline.push({
            delay: 1000,
            type: "incident",
            data: incident,
          });
        }
        lastIncidentCount = state.incidents.length;
        console.log(`  [${(elapsed / 1000).toFixed(0)}s] ${newIncidents} new incident(s)`);
      }

      // Detect wallet changes
      for (const [pubkey, w] of Object.entries(state.wallets || {})) {
        const prev = lastState.wallets?.[pubkey];
        if (!prev) continue;

        const changes = {};
        if (w.spentToday !== prev.spentToday) changes.spentToday = w.spentToday;
        if (w.txCount !== prev.txCount) changes.txCount = w.txCount;
        if (w.status !== prev.status) changes.status = w.status;
        if (w.riskLevel !== prev.riskLevel) changes.riskLevel = w.riskLevel;

        if (Object.keys(changes).length > 0) {
          timeline.push({
            delay: 2000,
            type: "state_update",
            data: { wallet: pubkey, updates: changes },
          });
        }
      }

      // Detect system risk change
      if (state.systemRisk !== lastState.systemRisk) {
        timeline.push({
          delay: 500,
          type: "system_risk",
          data: { systemRisk: state.systemRisk },
        });
      }

      // Detect stat changes
      if (JSON.stringify(state.stats) !== JSON.stringify(lastState.stats)) {
        timeline.push({
          delay: 500,
          type: "stat_update",
          data: state.stats,
        });
      }

      lastState = JSON.parse(JSON.stringify(state));
    } catch (err) {
      console.error(`  [${(elapsed / 1000).toFixed(0)}s] Poll error:`, err.message);
    }
  }, POLL_INTERVAL);

  function saveCapturedData() {
    const demoData = {
      initialState,
      timeline,
    };

    const outPath = path.join(__dirname, "..", "dashboard", "lib", "demo-data.json");
    fs.writeFileSync(outPath, JSON.stringify(demoData, null, 2));
    console.log();
    console.log(`  ✅ Captured ${timeline.length} events → ${outPath}`);
    console.log("  You can now deploy the dashboard with NEXT_PUBLIC_MODE=demo");
    process.exit(0);
  }

  // Allow graceful exit
  process.on("SIGINT", () => {
    clearInterval(timer);
    saveCapturedData();
  });

  console.log("  Recording... (Press Ctrl+C to stop early)");
}

main().catch(console.error);
