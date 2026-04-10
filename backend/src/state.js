/**
 * State Store — In-memory state for the monitoring engine.
 * The dashboard polls this via /api/state.
 */

const state = {
  wallets: {},   // keyed by publicKey
  alerts: [],    // most recent first
  incidents: [], // full AI-scored incidents
  systemRisk: "LOW",
  stats: {
    totalMonitored: 0,
    totalBlocked: 0,
    totalAllowed: 0,
    totalAlerts: 0,
  },
  startedAt: Date.now(),
};

export function initWallet(publicKey, config) {
  state.wallets[publicKey] = {
    name: config.name,
    publicKey,
    status: "ACTIVE",       // ACTIVE | WARNED | CRITICAL | PAUSED
    riskLevel: "LOW",       // LOW | MEDIUM | HIGH | CRITICAL
    spentToday: 0,
    dailyLimit: config.dailyLimit,
    maxTx: config.maxTx,
    txCount: 0,
    txHistory: [],          // last 50 transactions
    whitelistSize: config.whitelist?.length || 0,
  };
  state.stats.totalMonitored++;
}

export function updateWallet(publicKey, updates) {
  if (!state.wallets[publicKey]) return;
  Object.assign(state.wallets[publicKey], updates);
}

export function addTransaction(publicKey, tx) {
  if (!state.wallets[publicKey]) return;
  const wallet = state.wallets[publicKey];
  wallet.txHistory.unshift(tx);
  if (wallet.txHistory.length > 50) wallet.txHistory.pop();
  wallet.txCount++;
  if (tx.direction === "outgoing") {
    wallet.spentToday += tx.amount;
  }
}

export function addAlert(alert) {
  // alert: { id, timestamp, wallet, walletName, severity, rule, detail, aiVerdict? }
  state.alerts.unshift(alert);
  if (state.alerts.length > 100) state.alerts.pop();
  state.stats.totalAlerts++;
}

export function addIncident(incident) {
  // incident: { id, timestamp, wallet, walletName, flags, aiVerdict, action, tx }
  state.incidents.unshift(incident);
  if (state.incidents.length > 50) state.incidents.pop();
}

export function updateSystemRisk() {
  const wallets = Object.values(state.wallets);
  const risks = wallets.map((w) => w.riskLevel);
  if (risks.includes("CRITICAL")) state.systemRisk = "CRITICAL";
  else if (risks.includes("HIGH")) state.systemRisk = "HIGH";
  else if (risks.includes("MEDIUM")) state.systemRisk = "MEDIUM";
  else state.systemRisk = "LOW";
}

export function getState() {
  return {
    ...state,
    uptime: Math.floor((Date.now() - state.startedAt) / 1000),
  };
}

export default state;
