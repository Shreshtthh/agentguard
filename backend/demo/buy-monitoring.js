/**
 * Buy Monitoring — x402 client demo.
 * Pays a micropayment to access the monitoring API.
 * Demonstrates agent-to-agent payments via x402 protocol.
 * 
 * Prerequisites:
 *   npm install @x402/fetch @x402/stellar
 * 
 * Usage: node demo/buy-monitoring.js
 */

import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   💰 x402 — Buy Monitoring Status           ║");
  console.log("║   Pays $0.01 USDC for wallet status check   ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log();

  const alphaPublic = process.env.AGENT_ALPHA_PUBLIC;
  const gammaSecret = process.env.AGENT_GAMMA_SECRET;

  if (!alphaPublic || !gammaSecret) {
    console.error("❌ Missing AGENT_ALPHA_PUBLIC or AGENT_GAMMA_SECRET in .env");
    process.exit(1);
  }

  let x402Client, x402HTTPClient, createEd25519Signer, ExactStellarScheme;

  try {
    ({ x402Client, x402HTTPClient } = await import("@x402/fetch"));
    ({ createEd25519Signer } = await import("@x402/stellar"));
    ({ ExactStellarScheme } = await import("@x402/stellar/exact/client"));
  } catch (err) {
    console.error("❌ x402 packages not installed. Run:");
    console.error("   npm install @x402/fetch @x402/stellar");
    process.exit(1);
  }

  console.log("  Setting up x402 client...");
  console.log(`  Paying from Agent-Gamma's wallet`);
  console.log(`  Checking status of Agent-Alpha`);
  console.log();

  // Create signer from Agent-Gamma (the buyer)
  const signer = createEd25519Signer(gammaSecret, "stellar:testnet");

  const client = new x402Client().register(
    "stellar:*",
    new ExactStellarScheme(signer, {
      url: process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
    })
  );

  const http = new x402HTTPClient(client);

  try {
    console.log("  📡 Sending x402 request to /monitor/status...");
    const res = await http.get(
      `http://localhost:4000/monitor/status?wallet=${alphaPublic}`
    );

    if (res.ok) {
      const data = await res.json();
      console.log("  ✅ Response received!");
      console.log();
      console.log("  ═══════════════════════════════════════");
      console.log(`  Wallet: ${data.name}`);
      console.log(`  Status: ${data.status}`);
      console.log(`  Risk:   ${data.riskLevel}`);
      console.log(`  Spent:  $${data.spentToday?.toFixed(2)}`);
      console.log(`  Limit:  $${data.dailyLimit?.toFixed(2)}`);
      console.log(`  Txns:   ${data.txCount}`);
      console.log("  ═══════════════════════════════════════");
    } else {
      console.error(`  ❌ Request failed: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.error(`  ${text}`);
    }
  } catch (err) {
    console.error("  ❌ Error:", err.message);
  }
}

main().catch(console.error);
