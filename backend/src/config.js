import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const config = {
  // Stellar
  horizonUrl: process.env.HORIZON_URL || "https://horizon-testnet.stellar.org",
  sorobanRpcUrl: process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",

  // Agent wallets
  agents: [],

  // Guard
  guardSecret: process.env.GUARD_SECRET,
  guardPublic: process.env.GUARD_PUBLIC,

  // Known/Unknown recipients
  knownRecipient: process.env.KNOWN_RECIPIENT_PUBLIC,
  unknownRecipient: process.env.UNKNOWN_RECIPIENT_PUBLIC,

  // Contract
  contractId: process.env.SOROBAN_CONTRACT_ID,

  // AI
  groqApiKey: process.env.GROQ_API_KEY,

  // x402
  facilitatorUrl: process.env.X402_FACILITATOR_URL || "https://www.x402.org/facilitator",

  // Server
  port: parseInt(process.env.PORT || "4000"),
};

// Build agent list from env
const agentNames = ["ALPHA", "BETA", "GAMMA"];
for (const name of agentNames) {
  const secret = process.env[`AGENT_${name}_SECRET`];
  const pubkey = process.env[`AGENT_${name}_PUBLIC`];
  if (pubkey) {
    config.agents.push({
      name: `Agent-${name.charAt(0) + name.slice(1).toLowerCase()}`,
      publicKey: pubkey,
      secretKey: secret,
      dailyLimit: name === "GAMMA" ? 50 : 20, // XLM
      maxTx: name === "GAMMA" ? 10 : 5,       // XLM per tx
      whitelist: config.knownRecipient ? [config.knownRecipient] : [],
    });
  }
}

export default config;
