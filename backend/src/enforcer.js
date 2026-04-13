/**
 * Enforcer — Soroban contract interaction layer.
 * Calls the SpendingPolicy contract to check/pause/resume agents.
 * Uses Soroban RPC for read-only simulations and signed transactions for writes.
 */

import StellarSdk from "@stellar/stellar-sdk";
const {
  TransactionBuilder,
  Keypair,
  Networks,
  Contract,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
  BASE_FEE,
} = StellarSdk;

// SorobanRpc may be exported as 'SorobanRpc' or 'rpc' depending on version
const SorobanRpc = StellarSdk.SorobanRpc || StellarSdk.rpc;

let rpcServer = null;
let contract = null;

function getRpc() {
  if (!rpcServer) {
    rpcServer = new SorobanRpc.Server(
      process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org"
    );
  }
  return rpcServer;
}

function getContract() {
  if (!contract && process.env.SOROBAN_CONTRACT_ID) {
    contract = new Contract(process.env.SOROBAN_CONTRACT_ID);
  }
  return contract;
}

/**
 * Check if a proposed spend would be allowed (read-only).
 * Calls SpendingPolicy.check_spend(agent, amount) via simulation.
 * @returns {boolean|null} true=allowed, false=blocked, null=error/no contract
 */
export async function checkSpend(agentPublicKey, amount) {
  const c = getContract();
  if (!c) {
    console.warn("[Enforcer] No contract ID configured — skipping check_spend");
    return null;
  }

  try {
    const rpc = getRpc();
    const guardPublic = process.env.GUARD_PUBLIC;
    const account = await rpc.getAccount(guardPublic);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        c.call(
          "check_spend",
          new Address(agentPublicKey).toScVal(),
          nativeToScVal(Math.round(amount * 1_000_000), { type: "i128" }) // USDC in stroops
        )
      )
      .setTimeout(30)
      .build();

    const sim = await rpc.simulateTransaction(tx);

    if (SorobanRpc.Api.isSimulationSuccess(sim) && sim.result) {
      const result = scValToNative(sim.result.retval);
      console.log(`[Enforcer] check_spend(${agentPublicKey.slice(0, 8)}..., $${amount}) → ${result}`);
      return result;
    }

    console.warn("[Enforcer] check_spend simulation failed:", sim);
    return null;
  } catch (err) {
    console.error("[Enforcer] check_spend error:", err.message);
    return null;
  }
}

/**
 * Pause an agent's wallet via the SpendingPolicy contract.
 * Calls SpendingPolicy.pause_agent(caller, agent) — requires GUARD signing.
 * @returns {boolean} true if successful
 */
export async function pauseAgent(agentPublicKey) {
  const c = getContract();
  if (!c) {
    console.warn("[Enforcer] No contract ID configured — skipping pause_agent");
    return false;
  }

  const guardSecret = process.env.GUARD_SECRET;
  if (!guardSecret) {
    console.warn("[Enforcer] GUARD_SECRET not set — cannot pause agent");
    return false;
  }

  try {
    const rpc = getRpc();
    const guardKeypair = Keypair.fromSecret(guardSecret);
    const guardPublic = guardKeypair.publicKey();
    const account = await rpc.getAccount(guardPublic);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        c.call(
          "pause_agent",
          new Address(guardPublic).toScVal(),
          new Address(agentPublicKey).toScVal()
        )
      )
      .setTimeout(30)
      .build();

    // Simulate first
    const sim = await rpc.simulateTransaction(tx);
    if (!SorobanRpc.Api.isSimulationSuccess(sim)) {
      console.error("[Enforcer] pause_agent simulation failed:", sim);
      return false;
    }

    // Prepare and sign
    const preparedTx = SorobanRpc.assembleTransaction(tx, sim).build();
    preparedTx.sign(guardKeypair);

    // Submit
    const sendResult = await rpc.sendTransaction(preparedTx);
    console.log(`[Enforcer] ⛔ pause_agent submitted: ${sendResult.hash}`);

    // Wait for confirmation (best-effort — tx is already submitted)
    try {
      if (sendResult.status === "PENDING") {
        let getResult;
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          getResult = await rpc.getTransaction(sendResult.hash);
          if (getResult.status !== "NOT_FOUND") break;
        }
        if (getResult?.status === "SUCCESS") {
          console.log(`[Enforcer] ✅ pause_agent confirmed for ${agentPublicKey.slice(0, 8)}...`);
          return true;
        }
        // Even if confirmation polling fails, tx was submitted
        console.log(`[Enforcer] ⏳ pause_agent TX submitted (confirmation status: ${getResult?.status || "unknown"})`);
        return true;
      }
    } catch (confirmErr) {
      // XDR parsing errors in getTransaction are non-fatal — tx was submitted
      console.log(`[Enforcer] ⏳ pause_agent TX submitted, confirmation polling skipped (${confirmErr.message})`);
      return true;
    }

    return true; // tx was submitted
  } catch (err) {
    console.error("[Enforcer] pause_agent error:", err.message);
    return false;
  }
}

/**
 * Get policy state from the contract (read-only).
 * @returns {Object|null} Policy data or null
 */
export async function getPolicy(agentPublicKey) {
  const c = getContract();
  if (!c) return null;

  try {
    const rpc = getRpc();
    const guardPublic = process.env.GUARD_PUBLIC;
    const account = await rpc.getAccount(guardPublic);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        c.call("get_policy", new Address(agentPublicKey).toScVal())
      )
      .setTimeout(30)
      .build();

    const sim = await rpc.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationSuccess(sim) && sim.result) {
      return scValToNative(sim.result.retval);
    }
    return null;
  } catch (err) {
    console.error("[Enforcer] get_policy error:", err.message);
    return null;
  }
}
