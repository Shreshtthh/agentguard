/**
 * Normal Agent — Simulates healthy agent spending behavior.
 * Sends small XLM payments to a KNOWN (whitelisted) recipient.
 * These transactions should NOT trigger alerts in AgentGuard.
 * 
 * Usage: node demo/normal-agent.js
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
    }
    return null;
  }
}

async function main() {
  const alphaSecret = process.env.AGENT_ALPHA_SECRET;
  const recipient = process.env.KNOWN_RECIPIENT_PUBLIC;

  if (!alphaSecret || !recipient) {
    console.error("Missing AGENT_ALPHA_SECRET or KNOWN_RECIPIENT_PUBLIC in .env");
    console.error("   Run: node demo/setup-accounts.js");
    process.exit(1);
  }

  const alphaKeypair = Keypair.fromSecret(alphaSecret);
  const senderPub = alphaKeypair.publicKey();

  console.log("==============================================");
  console.log("  Normal Agent -- Agent-Alpha");
  console.log("  Sending small payments to known recipient");
  console.log("==============================================");
  console.log();
  console.log(`  Sender:    ${senderPub}`);
  console.log(`  Recipient: ${recipient} (whitelisted)`);
  console.log();
  console.log(`  Verify transactions on Stellar Expert:`);
  console.log(`  https://stellar.expert/explorer/testnet/account/${senderPub}`);
  console.log();

  const amounts = [0.5, 0.8, 0.3, 0.5, 0.4];

  for (let i = 0; i < amounts.length; i++) {
    const amount = amounts[i];
    process.stdout.write(`  [${i + 1}/${amounts.length}] Sending ${amount.toFixed(2)} XLM... `);

    const hash = await sendPayment(alphaKeypair, recipient, amount);
    if (hash) {
      console.log(`OK`);
      console.log(`     TX Hash: ${hash}`);
      console.log(`     View:    https://stellar.expert/explorer/testnet/tx/${hash}`);
    }

    if (i < amounts.length - 1) {
      console.log(`     Waiting 8 seconds...\n`);
      await new Promise((r) => setTimeout(r, 8000));
    }
  }

  console.log();
  console.log("  ==============================================");
  console.log("  Normal agent simulation complete.");
  console.log("  AgentGuard should show all-green for Agent-Alpha.");
  console.log("  ==============================================");
}

main().catch(console.error);
