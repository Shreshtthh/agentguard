/**
 * x402 Paywall Server — Monitoring-as-a-Service.
 * Adds x402-paywalled endpoints to the Express app.
 * Agents can pay micropayments to check their monitoring status.
 * 
 * Based on x402-stellar reference implementation:
 *   - paymentMiddleware from @x402/express
 *   - ExactStellarScheme from @x402/stellar/exact/server
 *   - HTTPFacilitatorClient from @x402/core/server
 */

export async function setupX402Routes(app) {
  let x402Server;

  try {
    const { paymentMiddleware, x402ResourceServer } = await import("@x402/express");
    const { ExactStellarScheme } = await import("@x402/stellar/exact/server");
    const { HTTPFacilitatorClient } = await import("@x402/core/server");

    const facilitatorUrl = process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator";
    const guardPublic = process.env.GUARD_PUBLIC;

    if (!guardPublic) {
      console.warn("[x402] GUARD_PUBLIC not set — x402 paywall disabled");
      return;
    }

    // Build facilitator client
    const facilitatorClient = new HTTPFacilitatorClient({
      url: facilitatorUrl,
    });

    // Build x402 resource server with Stellar scheme
    x402Server = new x402ResourceServer(facilitatorClient).register(
      "stellar:testnet",
      new ExactStellarScheme()
    );

    // Import state for the endpoints
    const { getState } = await import("./state.js");

    // GET /monitor/status?wallet=G...
    // Price: $0.01 USDC
    const statusMiddleware = paymentMiddleware(
      {
        "GET /monitor/status": {
          accepts: [
            {
              scheme: "exact",
              price: "100000",   // 0.01 USDC in stroops (7 decimals)
              network: "stellar:testnet",
              payTo: guardPublic,
            },
          ],
          description: "Check monitoring status for a wallet",
        },
      },
      x402Server,
      undefined,
      undefined,
      true
    );

    app.use(statusMiddleware);

    app.get("/monitor/status", (req, res) => {
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
    });

    // GET /monitor/alerts
    // Price: $0.05 USDC
    const alertsMiddleware = paymentMiddleware(
      {
        "GET /monitor/alerts": {
          accepts: [
            {
              scheme: "exact",
              price: "500000",   // 0.05 USDC in stroops (7 decimals)
              network: "stellar:testnet",
              payTo: guardPublic,
            },
          ],
          description: "Access recent security alerts feed",
        },
      },
      x402Server,
      undefined,
      undefined,
      true
    );

    app.use(alertsMiddleware);

    app.get("/monitor/alerts", (req, res) => {
      const state = getState();
      res.json({
        alerts: state.alerts.slice(0, 20),
        systemRisk: state.systemRisk,
        stats: state.stats,
      });
    });

    console.log("[x402] Paywall endpoints active:");
    console.log("[x402]    GET /monitor/status?wallet=G... ($0.01 USDC)");
    console.log("[x402]    GET /monitor/alerts              ($0.05 USDC)");

  } catch (err) {
    console.warn(`[x402] Paywall setup failed: ${err.message}`);
    console.warn("[x402] Paywall disabled. If packages are missing, install with:");
    console.warn("       npm install @x402/core @x402/express @x402/stellar");
    return;
  }
}
