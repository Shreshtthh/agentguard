/**
 * Analyzer — Rule-based anomaly detection engine.
 * 5 deterministic rules that flag suspicious transaction patterns.
 * When flags are triggered, the scorer (Groq AI) is called for deeper analysis.
 */

function isToday(timestamp) {
  const now = new Date();
  const d = new Date(timestamp);
  return d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
}

export class SpendingAnalyzer {
  /**
   * Analyze a transaction against all rules.
   * @param {Object} tx - The transaction to analyze
   * @param {Object} config - Wallet config (dailyLimit, maxTx, whitelist)
   * @param {Array} history - Transaction history for this wallet
   * @returns {{ flags: Array, maxSeverity: string }}
   */
  analyze(tx, config, history) {
    // Only analyze outgoing transactions
    if (tx.direction !== "outgoing") {
      return { flags: [], maxSeverity: "LOW" };
    }

    const flags = [];

    // ═══════════════════════════════════════════
    // RULE 1: Unknown Recipient
    // ═══════════════════════════════════════════
    if (config.whitelist && config.whitelist.length > 0 && !config.whitelist.includes(tx.to)) {
      flags.push({
        rule: "UNKNOWN_RECIPIENT",
        severity: "MEDIUM",
        detail: `${tx.to.slice(0, 8)}...${tx.to.slice(-4)} not in whitelist (${config.whitelist.length} known addresses)`,
      });
    }

    // ═══════════════════════════════════════════
    // RULE 2: Spending Spike (amount > 3x recent average)
    // ═══════════════════════════════════════════
    const recentOutgoing = history.filter(
      (t) => t.direction === "outgoing" && t.timestamp > Date.now() - 3600_000
    );
    if (recentOutgoing.length >= 2) {
      const avg = recentOutgoing.reduce((s, t) => s + t.amount, 0) / recentOutgoing.length;
      if (avg > 0 && tx.amount > avg * 3) {
        flags.push({
          rule: "SPENDING_SPIKE",
          severity: "HIGH",
          detail: `$${tx.amount.toFixed(2)} is ${(tx.amount / avg).toFixed(1)}x the recent average ($${avg.toFixed(4)})`,
        });
      }
    }

    // ═══════════════════════════════════════════
    // RULE 3: Daily Budget Exceeded
    // ═══════════════════════════════════════════
    const todaySpent = history
      .filter((t) => t.direction === "outgoing" && isToday(t.timestamp))
      .reduce((s, t) => s + t.amount, 0);

    if (config.dailyLimit && todaySpent + tx.amount > config.dailyLimit) {
      flags.push({
        rule: "BUDGET_EXCEEDED",
        severity: "CRITICAL",
        detail: `$${(todaySpent + tx.amount).toFixed(2)} spent today exceeds daily limit of $${config.dailyLimit}`,
      });
    }

    // ═══════════════════════════════════════════
    // RULE 4: Single Transaction Limit
    // ═══════════════════════════════════════════
    if (config.maxTx && tx.amount > config.maxTx) {
      flags.push({
        rule: "TX_LIMIT_EXCEEDED",
        severity: "HIGH",
        detail: `$${tx.amount.toFixed(2)} exceeds per-transaction max of $${config.maxTx}`,
      });
    }

    // ═══════════════════════════════════════════
    // RULE 5: Rapid Fire (>3 outgoing txns in 60 seconds)
    // ═══════════════════════════════════════════
    const lastMinute = history.filter(
      (t) => t.direction === "outgoing" && t.timestamp > Date.now() - 60_000
    );
    if (lastMinute.length >= 3) {
      flags.push({
        rule: "RAPID_FIRE",
        severity: "HIGH",
        detail: `${lastMinute.length} outgoing transactions in the last 60 seconds`,
      });
    }

    // Determine max severity
    const severityOrder = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
    let maxSeverity = "LOW";
    for (const flag of flags) {
      if (severityOrder[flag.severity] > severityOrder[maxSeverity]) {
        maxSeverity = flag.severity;
      }
    }

    return { flags, maxSeverity };
  }
}
