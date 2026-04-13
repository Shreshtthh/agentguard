import { NextResponse } from "next/server";
import {
  SorobanRpc,
  TransactionBuilder,
  Contract,
  Address,
  Keypair,
  Networks,
  BASE_FEE,
  scValToNative,
} from "@stellar/stellar-sdk";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const agent = searchParams.get("agent");
  const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID;

  if (!agent) {
    return NextResponse.json({ error: "Missing 'agent' query parameter" }, { status: 400 });
  }

  if (!contractId) {
    return NextResponse.json({ error: "Contract ID not configured" }, { status: 500 });
  }

  try {
    const rpc = new SorobanRpc.Server("https://soroban-testnet.stellar.org");
    const contract = new Contract(contractId);

    // We need a source account for simulation (any funded account works)
    // Use a throwaway keypair — simulation is free and doesn't need real signing
    const sourceKeypair = Keypair.random();

    // For simulation, we need a valid account. Use the agent address itself
    // if available, otherwise this will fail gracefully
    let account;
    try {
      account = await rpc.getAccount(agent);
    } catch {
      // If the agent account doesn't exist on-chain, create a minimal account object
      return NextResponse.json({
        error: "Could not load account for simulation",
        paused: null,
        daily_limit: 0,
        spent_today: 0,
        total_blocked: 0,
        total_allowed: 0,
      });
    }

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        contract.call("get_policy", new Address(agent).toScVal())
      )
      .setTimeout(30)
      .build();

    const sim = await rpc.simulateTransaction(tx);

    if (SorobanRpc.Api.isSimulationSuccess(sim) && sim.result) {
      const policy = scValToNative(sim.result.retval);
      return NextResponse.json({
        paused: policy.paused ?? false,
        daily_limit: Number(policy.daily_limit ?? 0),
        max_tx: Number(policy.max_tx ?? 0),
        spent_today: Number(policy.spent_today ?? 0),
        last_reset: Number(policy.last_reset ?? 0),
        total_blocked: Number(policy.total_blocked ?? 0),
        total_allowed: Number(policy.total_allowed ?? 0),
      });
    }

    return NextResponse.json({
      error: "Policy not found or simulation failed",
      paused: null,
      daily_limit: 0,
      spent_today: 0,
      total_blocked: 0,
      total_allowed: 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
