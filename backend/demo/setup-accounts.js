/**
 * Setup Accounts — Creates all testnet wallets needed for the demo.
 * 
 * Creates 6 accounts:
 * 1. AGENT_ALPHA  — normal agent
 * 2. AGENT_BETA   — will be "compromised" during demo
 * 3. AGENT_GAMMA  — normal agent
 * 4. GUARD        — AgentGuard owner
 * 5. KNOWN_RECIPIENT    — whitelisted destination
 * 6. UNKNOWN_RECIPIENT  — attacker's drain address
 * 
 * Funds each with XLM via friendbot and creates USDC trustlines.
 * Outputs a ready-to-use .env file.
 * 
 * Usage: node demo/setup-accounts.js
 */

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

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC = new Asset("USDC", USDC_ISSUER);

const server = new Horizon.Server(HORIZON_URL);

async function fundWithFriendbot(publicKey) {
  const res = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`);
  if (!res.ok) {
    const text = await res.text();
    // Account might already exist
    if (text.includes("createAccountAlreadyExist")) {
      console.log(`  ⚡ Already funded: ${publicKey.slice(0, 8)}...`);
      return;
    }
    throw new Error(`Friendbot failed: ${text}`);
  }
  console.log(`  ✅ Funded: ${publicKey.slice(0, 8)}...`);
}

async function createUSDCTrustline(keypair) {
  try {
    const account = await server.loadAccount(keypair.publicKey());
    
    // Check if trustline already exists
    const hasTrustline = account.balances.some(
      (b) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER
    );
    if (hasTrustline) {
      console.log(`  ⚡ USDC trustline exists: ${keypair.publicKey().slice(0, 8)}...`);
      return;
    }

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.changeTrust({ asset: USDC }))
      .setTimeout(30)
      .build();

    tx.sign(keypair);
    await server.submitTransaction(tx);
    console.log(`  ✅ USDC trustline created: ${keypair.publicKey().slice(0, 8)}...`);
  } catch (err) {
    console.error(`  ❌ Trustline error for ${keypair.publicKey().slice(0, 8)}...:`, err.message);
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   🛡️  AgentGuard — Testnet Account Setup     ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log();

  const accounts = {
    AGENT_ALPHA: Keypair.random(),
    AGENT_BETA: Keypair.random(),
    AGENT_GAMMA: Keypair.random(),
    GUARD: Keypair.random(),
    KNOWN_RECIPIENT: Keypair.random(),
    UNKNOWN_RECIPIENT: Keypair.random(),
  };

  // Fund all accounts
  console.log("1️⃣  Funding accounts via Friendbot...");
  for (const [name, kp] of Object.entries(accounts)) {
    process.stdout.write(`   ${name}: `);
    await fundWithFriendbot(kp.publicKey());
    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Create USDC trustlines for agent wallets and recipients
  console.log("\n2️⃣  Creating USDC trustlines...");
  const needsTrustline = ["AGENT_ALPHA", "AGENT_BETA", "AGENT_GAMMA", "GUARD", "KNOWN_RECIPIENT", "UNKNOWN_RECIPIENT"];
  for (const name of needsTrustline) {
    process.stdout.write(`   ${name}: `);
    await createUSDCTrustline(accounts[name]);
    await new Promise((r) => setTimeout(r, 500));
  }

  // Generate .env content
  console.log("\n3️⃣  Generating .env file...\n");

  const envContent = `# ═══════════════════════════════════════════════════════════
# AgentGuard — Auto-generated Environment Configuration
# Generated: ${new Date().toISOString()}
# ═══════════════════════════════════════════════════════════

# === Stellar Testnet ===
STELLAR_NETWORK=testnet
HORIZON_URL=https://horizon-testnet.stellar.org
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# === Agent Wallets ===
AGENT_ALPHA_SECRET=${accounts.AGENT_ALPHA.secret()}
AGENT_ALPHA_PUBLIC=${accounts.AGENT_ALPHA.publicKey()}
AGENT_BETA_SECRET=${accounts.AGENT_BETA.secret()}
AGENT_BETA_PUBLIC=${accounts.AGENT_BETA.publicKey()}
AGENT_GAMMA_SECRET=${accounts.AGENT_GAMMA.secret()}
AGENT_GAMMA_PUBLIC=${accounts.AGENT_GAMMA.publicKey()}

# === AgentGuard Owner ===
GUARD_SECRET=${accounts.GUARD.secret()}
GUARD_PUBLIC=${accounts.GUARD.publicKey()}

# === Recipients ===
KNOWN_RECIPIENT_PUBLIC=${accounts.KNOWN_RECIPIENT.publicKey()}
UNKNOWN_RECIPIENT_PUBLIC=${accounts.UNKNOWN_RECIPIENT.publicKey()}

# === Soroban Contract (set after deploying) ===
SOROBAN_CONTRACT_ID=

# === AI (get from https://console.groq.com) ===
GROQ_API_KEY=

# === x402 ===
X402_FACILITATOR_URL=https://www.x402.org/facilitator

# === Server ===
PORT=4000
`;

  // Write .env file
  const fs = await import("fs");
  const path = await import("path");
  const envPath = path.join(process.cwd(), "..", ".env");
  fs.writeFileSync(envPath, envContent);
  console.log(`✅ .env file written to: ${envPath}`);

  // Print summary
  console.log("\n═══════════════════════════════════════════════════");
  console.log("📋 Account Summary:");
  console.log("═══════════════════════════════════════════════════");
  for (const [name, kp] of Object.entries(accounts)) {
    console.log(`  ${name}:`);
    console.log(`    Public:  ${kp.publicKey()}`);
    console.log(`    Secret:  ${kp.secret()}`);
    console.log();
  }

  console.log("═══════════════════════════════════════════════════");
  console.log("⚠️  NEXT STEPS:");
  console.log("═══════════════════════════════════════════════════");
  console.log("1. Get test USDC from: https://faucet.circle.com");
  console.log("   Send to AGENT_ALPHA, AGENT_BETA, AGENT_GAMMA");
  console.log("   (Select 'Stellar' network, 'USDC' token)");
  console.log();
  console.log("2. Add your Groq API key to .env:");
  console.log("   GROQ_API_KEY=gsk_...");
  console.log();
  console.log("3. (Optional) Deploy Soroban contract and set:");
  console.log("   SOROBAN_CONTRACT_ID=C...");
  console.log();
  console.log("4. Start AgentGuard:");
  console.log("   cd backend && node src/index.js");
}

main().catch(console.error);
