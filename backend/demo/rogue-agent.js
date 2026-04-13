/**
 * Rogue Agent — Simulates a compromised agent draining a wallet.
 * Sends rapid, escalating XLM payments to an UNKNOWN recipient.
 * This SHOULD trigger multiple alerts and eventually a circuit breaker.
 *
 * Triggers:
 *   - UNKNOWN_RECIPIENT (every tx)
 *   - SPENDING_SPIKE (amount escalation)
 *   - BUDGET_EXCEEDED (daily limit exceeded)
 *   - TX_LIMIT_EXCEEDED (per-tx limit exceeded)
 *   - RAPID_FIRE (>3 txns in 60s)
 * 
 * Usage: node demo/rogue-agent.js
 */

import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import StellarSdk from "@stellar/stellar-sdk";
const {
  Keypair,
  Horizon,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  BASE_FEE,
} = StellarSdk;

const HORIZON_URL = process.env.HORIZON_URL || "https://horizon-testnet.stellar.org";
const server = new Horizon.Server(HORIZON_URL);

async function sendPayment(senderKeypair, destination, amount) {
  try {
    const account = await server.loadAccount(senderKeypair.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination,
          asset: Asset.native(),
          amount: amount.toFixed(7),
        })
      )
      .setTimeout(30)
      .build();

    tx.sign(senderKeypair);
    const result = await server.submitTransaction(tx);
    return result.hash;
  } catch (err) {
    const resultCodes = err?.response?.data?.extras?.result_codes;
    if (resultCodes) {
      console.error(`  Payment failed: ${JSON.stringify(resultCodes)}`);
    } else {
      console.error(`  Payment failed: ${err.message || err}`);
      if (err.response?.data) {
        console.error(`  Response: ${JSON.stringify(err.response.data).slice(0, 300)}`);
      }
    }
    return null;
  }
}

async function main() {
  const betaSecret = process.env.AGENT_BETA_SECRET;
  const unknownRecipient = process.env.UNKNOWN_RECIPIENT_PUBLIC;

  if (!betaSecret || !unknownRecipient) {
    console.error("Missing AGENT_BETA_SECRET or UNKNOWN_RECIPIENT_PUBLIC in .env");
    console.error("   Run: node demo/setup-accounts.js");
    process.exit(1);
  }

  const betaKeypair = Keypair.fromSecret(betaSecret);
  const senderPub = betaKeypair.publicKey();

  console.log("==============================================");
  console.log("  ROGUE AGENT -- Agent-Beta COMPROMISED");
  console.log("  Draining wallet to unknown address!");
  console.log("==============================================");
  console.log();
  console.log(`  Sender:   ${senderPub}`);
  console.log(`  Drain to: ${unknownRecipient} (NOT whitelisted)`);
  console.log();
  console.log(`  Verify transactions on Stellar Expert:`);
  console.log(`  https://stellar.expert/explorer/testnet/account/${senderPub}`);
  console.log();

  // Escalating amounts to trigger multiple rules
  const attacks = [
    { amount: 2,  delay: 4000, note: "Initial probe" },
    { amount: 5,  delay: 3000, note: "Escalation (exceeds per-tx limit)" },
    { amount: 10, delay: 3000, note: "Major escalation (spending spike)" },
    { amount: 15, delay: 3000, note: "Budget exceeded" },
    { amount: 25, delay: 3000, note: "Full drain attempt" },
  ];

  let totalSent = 0;
  for (let i = 0; i < attacks.length; i++) {
    const { amount, delay, note } = attacks[i];
    totalSent += amount;

    console.log(`  [${i + 1}/${attacks.length}] ${amount.toFixed(2)} XLM -- ${note}`);
    process.stdout.write(`     Sending... `);

    const hash = await sendPayment(betaKeypair, unknownRecipient, amount);
    if (hash) {
      console.log(`OK`);
      console.log(`     TX Hash: ${hash}`);
      console.log(`     View:    https://stellar.expert/explorer/testnet/tx/${hash}`);
    }
    console.log(`     Running total: ${totalSent.toFixed(2)} XLM drained`);

    if (i < attacks.length - 1) {
      console.log(`     Next attack in ${delay / 1000}s...\n`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  console.log();
  console.log("  ==============================================");
  console.log(`  Attack complete. ${totalSent.toFixed(2)} XLM sent to:`);
  console.log(`  ${unknownRecipient}`);
  console.log("  ==============================================");
  console.log();
  console.log("  AgentGuard should have:");
  console.log("    Agent-Beta -> CRITICAL / PAUSED");
  console.log("    AI verdict with risk score 80+");
  console.log("    Circuit breaker triggered on-chain");
}

main().catch(console.error);
