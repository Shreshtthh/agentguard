import { NextResponse } from "next/server";
import { Horizon } from "@stellar/stellar-sdk";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Missing 'address' query parameter" },
      { status: 400 }
    );
  }

  try {
    const server = new Horizon.Server("https://horizon-testnet.stellar.org");
    const payments = await server
      .payments()
      .forAccount(address)
      .limit(20)
      .order("desc")
      .call();

    const records = payments.records
      .filter((p) => p.type === "payment" || p.type === "path_payment_strict_receive")
      .map((p) => ({
        id: p.id,
        type: p.type,
        from: p.from,
        to: p.to,
        amount: p.amount,
        asset: p.asset_code || "XLM",
        asset_issuer: p.asset_issuer || null,
        created_at: p.created_at,
        tx_hash: p.transaction_hash,
      }));

    return NextResponse.json(records);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to lookup wallet" },
      { status: 500 }
    );
  }
}
