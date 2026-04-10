/**
 * AgentGuard — Main Entry Point
 * 
 * Orchestrates the monitoring pipeline:
 * 1. Loads config
 * 2. Initializes state for each watched wallet
 * 3. Starts Horizon SSE streams
 * 4. On each payment: Analyze → Score (AI) → Enforce → Update state
 * 5. Starts API server for dashboard
 */

import config from "./config.js";
import { WalletWatcher } from "./watcher.js";
import { SpendingAnalyzer } from "./analyzer.js";
import { scoreWithAI } from "./scorer.js";
import { pauseAgent } from "./enforcer.js";
import {
  initWallet,
  updateWallet,
  addTransaction,
  addAlert,
  addIncident,
  updateSystemRisk,
  getState,
} from "./state.js";
import { createAPIServer } from "./api.js";

let alertCounter = 0;
let incidentCounter = 0;

function generateAlertId() {
  return `alert-${++alertCounter}-${Date.now()}`;
}

function generateIncidentId() {
  return `incident-${++incidentCounter}-${Date.now()}`;
}

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   🛡️  AgentGuard — AI Security Watchdog      ║");
  console.log("║   Stellar Hacks: Agents Hackathon 2026       ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log();

  // ═══════════════════════════════════════════
  // Validate config
  // ═══════════════════════════════════════════
  if (config.agents.length === 0) {
    console.error("❌ No agent wallets configured. Run: node demo/setup-accounts.js");
    process.exit(1);
  }

  console.log(`[Config] Monitoring ${config.agents.length} agent(s):`);
  for (const agent of config.agents) {
    console.log(`  • ${agent.name}: ${agent.publicKey.slice(0, 8)}... (limit: $${agent.dailyLimit}/day)`);
  }
  console.log(`[Config] Groq AI: ${config.groqApiKey ? "✅ enabled" : "⚠️  disabled (fallback mode)"}`);
  console.log(`[Config] Contract: ${config.contractId || "⚠️  not deployed"}`);
  console.log();

  // ═══════════════════════════════════════════
  // Initialize state
  // ═══════════════════════════════════════════
  for (const agent of config.agents) {
    initWallet(agent.publicKey, agent);
  }

  // ═══════════════════════════════════════════
  // Create analyzer
  // ═══════════════════════════════════════════
  const analyzer = new SpendingAnalyzer();

  // ═══════════════════════════════════════════
  // Create watcher and wire up the pipeline
  // ═══════════════════════════════════════════
  const watcher = new WalletWatcher(config.horizonUrl);

  watcher.onPayment = async (publicKey, tx, agentConfig) => {
    // Step 1: Record transaction
    addTransaction(publicKey, tx);

    // Only analyze outgoing txns
    if (tx.direction !== "outgoing") return;

    // Step 2: Run rule engine
    const wallet = getState().wallets[publicKey];
    const history = wallet?.txHistory || [];
    const { flags, maxSeverity } = analyzer.analyze(tx, agentConfig, history);

    // Step 3: If flags triggered, run AI scoring
    let aiVerdict = null;
    if (flags.length > 0) {
      // Add alerts for each flag
      for (const flag of flags) {
        addAlert({
          id: generateAlertId(),
          timestamp: Date.now(),
          wallet: publicKey,
          walletName: agentConfig.name,
          severity: flag.severity,
          rule: flag.rule,
          detail: flag.detail,
        });
      }

      // Update wallet risk level
      updateWallet(publicKey, { riskLevel: maxSeverity });

      // Score with AI
      try {
        aiVerdict = await scoreWithAI(tx, flags, history, agentConfig);
      } catch (err) {
        console.error("[Main] AI scoring error:", err.message);
      }

      if (aiVerdict) {
        // Update wallet status based on AI verdict
        let status = "ACTIVE";
        if (aiVerdict.risk_score >= 80) status = "CRITICAL";
        else if (aiVerdict.risk_score >= 50) status = "WARNED";

        updateWallet(publicKey, {
          riskLevel: aiVerdict.risk_level,
          status,
        });

        // Record incident
        addIncident({
          id: generateIncidentId(),
          timestamp: Date.now(),
          wallet: publicKey,
          walletName: agentConfig.name,
          tx,
          flags,
          aiVerdict,
          action: aiVerdict.recommended_action,
        });

        // Add AI verdict as a special alert
        addAlert({
          id: generateAlertId(),
          timestamp: Date.now(),
          wallet: publicKey,
          walletName: agentConfig.name,
          severity: aiVerdict.risk_level,
          rule: "AI_VERDICT",
          detail: `Score: ${aiVerdict.risk_score}/100 — ${aiVerdict.reason}`,
          aiVerdict,
        });

        // Step 4: If critical, trigger circuit breaker
        if (aiVerdict.risk_score >= 90 && aiVerdict.recommended_action === "BLOCK") {
          console.log(`[Main] 🚨 CRITICAL THREAT — Pausing ${agentConfig.name}...`);

          const paused = await pauseAgent(publicKey);
          if (paused) {
            updateWallet(publicKey, { status: "PAUSED" });
            getState().stats.totalBlocked++;
            addAlert({
              id: generateAlertId(),
              timestamp: Date.now(),
              wallet: publicKey,
              walletName: agentConfig.name,
              severity: "CRITICAL",
              rule: "CIRCUIT_BREAKER",
              detail: `⛔ ${agentConfig.name} PAUSED on-chain by Soroban SpendingPolicy contract`,
            });
          } else {
            // Even without contract, mark as paused locally
            updateWallet(publicKey, { status: "PAUSED" });
            addAlert({
              id: generateAlertId(),
              timestamp: Date.now(),
              wallet: publicKey,
              walletName: agentConfig.name,
              severity: "CRITICAL",
              rule: "CIRCUIT_BREAKER",
              detail: `⛔ ${agentConfig.name} flagged for pause (contract call ${config.contractId ? "failed" : "skipped — no contract"})`,
            });
          }
        }
      }
    } else {
      // No flags — normal transaction
      getState().stats.totalAllowed++;
    }

    // Step 5: Update system risk
    updateSystemRisk();
  };

  // ═══════════════════════════════════════════
  // Start watching all agents
  // ═══════════════════════════════════════════
  for (const agent of config.agents) {
    watcher.watch(agent.publicKey, agent);
  }

  console.log();
  console.log(`[Watcher] 👁️  Monitoring ${watcher.getStreamCount()} wallet(s) via Horizon SSE`);

  // ═══════════════════════════════════════════
  // Start API server
  // ═══════════════════════════════════════════
  const app = createAPIServer(config.port);

  // ═══════════════════════════════════════════
  // Start x402 paywall (optional — won't crash if packages missing)
  // ═══════════════════════════════════════════
  try {
    const { setupX402Routes } = await import("./x402-server.js");
    await setupX402Routes(app);
  } catch (err) {
    console.log("[Main] x402 paywall not available:", err.message);
  }

  console.log();
  console.log("🛡️  AgentGuard is running. Waiting for transactions...");
  console.log("   Press Ctrl+C to stop.");

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n[Main] Shutting down...");
    watcher.unwatchAll();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
