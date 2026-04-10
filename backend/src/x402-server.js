/**
 * x402 Paywall Server — Monitoring-as-a-Service.
 * Adds x402-paywalled endpoints to the Express app.
 * Agents can pay micropayments to check their monitoring status.
 * 
 * NOTE: x402 packages must be installed:
 *   npm install @x402/core @x402/express @x402/stellar
 */

export async function setupX402Routes(app) {
  let paymentMiddleware;

  try {
    // Dynamic import to avoid crashing if x402 packages not installed
    const { paymentMiddlewareFromConfig } = await import("@x402/express");
    const { ExactStellarScheme } = await import("@x402/stellar/exact/server");

    const facilitatorUrl = process.env.X402_FACILITATOR_URL || "https://www.x402.org/facilitator";
    const guardPublic = process.env.GUARD_PUBLIC;

    if (!guardPublic) {
      console.warn("[x402] GUARD_PUBLIC not set — x402 paywall disabled");
      return;
    }

    const stellarScheme = new ExactStellarScheme({
      network: "testnet",
      rpcUrl: process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
    });

    paymentMiddleware = paymentMiddlewareFromConfig(
      facilitatorUrl,
      guardPublic,
      [stellarScheme]
    );
  } catch (err) {
    console.warn("[x402] x402 packages not installed — paywall disabled. Install with:");
    console.warn("       npm install @x402/core @x402/express @x402/stellar");
    return;
  }

  // Import state for the endpoints
  const { getState } = await import("./state.js");

  // ═══════════════════════════════════════════
  // GET /monitor/status?wallet=G...
  // Price: $0.01 USDC
  // Returns monitoring status for a specific wallet
  // ═══════════════════════════════════════════
  app.get(
    "/monitor/status",
    paymentMiddleware({
      price: "0.01",
      asset: "USDC",
      network: "stellar:testnet",
      description: "Check monitoring status for a wallet",
    }),
    (req, res) => {
      const wallet = req.query.wallet;
      if (!wallet) {
        return res.status(400).json({ error: "Missing 'wallet' query param" });
      }

      const state = getState();
      const w = state.wallets[wallet];

      if (!w) {
        return res.status(404).json({
          error: "Wallet not monitored",
          monitored_wallets: Object.keys(state.wallets).length,
        });
      }

      res.json({
        name: w.name,
        status: w.status,
        riskLevel: w.riskLevel,
        spentToday: w.spentToday,
        dailyLimit: w.dailyLimit,
        txCount: w.txCount,
        lastUpdate: Date.now(),
      });
    }
  );

  // ═══════════════════════════════════════════
  // GET /monitor/alerts
  // Price: $0.05 USDC
  // Returns recent security alerts
  // ═══════════════════════════════════════════
  app.get(
    "/monitor/alerts",
    paymentMiddleware({
      price: "0.05",
      asset: "USDC",
      network: "stellar:testnet",
      description: "Access recent security alerts feed",
    }),
    (req, res) => {
      const state = getState();
      res.json({
        alerts: state.alerts.slice(0, 20),
        systemRisk: state.systemRisk,
        stats: state.stats,
      });
    }
  );

  console.log("[x402] 💰 Paywall endpoints active:");
  console.log("[x402]    GET /monitor/status?wallet=G... ($0.01 USDC)");
  console.log("[x402]    GET /monitor/alerts              ($0.05 USDC)");
}
