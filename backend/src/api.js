/**
 * API Server — Express endpoints for the dashboard.
 * GET /api/state   — Full monitoring state (dashboard polls this)
 * GET /api/health  — Health check
 */

import express from "express";
import cors from "cors";
import { getState } from "./state.js";

export function createAPIServer(port) {
  const app = express();

  app.use(cors({
    origin: [
      "http://localhost:3000",    // Next.js dev server
      "http://localhost:3001",
      /\.vercel\.app$/,           // Vercel deployments
    ],
    credentials: true,
  }));

  app.use(express.json());

  // ═══════════════════════════════════════════
  // Dashboard state endpoint
  // ═══════════════════════════════════════════
  app.get("/api/state", (req, res) => {
    res.json(getState());
  });

  // ═══════════════════════════════════════════
  // Health check
  // ═══════════════════════════════════════════
  app.get("/api/health", (req, res) => {
    const state = getState();
    res.json({
      status: "ok",
      uptime: state.uptime,
      monitored: state.stats.totalMonitored,
      alerts: state.stats.totalAlerts,
      blocked: state.stats.totalBlocked,
    });
  });

  app.listen(port, () => {
    console.log(`[API] 🌐 Server running on http://localhost:${port}`);
    console.log(`[API]    Dashboard state: http://localhost:${port}/api/state`);
    console.log(`[API]    Health check:    http://localhost:${port}/api/health`);
  });

  return app;
}
