/**
 * Watcher — Horizon SSE multi-wallet stream manager.
 * Connects to Stellar Horizon and streams real-time payments for each monitored wallet.
 */

import StellarSdk from "@stellar/stellar-sdk";
const { Horizon } = StellarSdk;

export class WalletWatcher {
  constructor(horizonUrl) {
    this.server = new Horizon.Server(horizonUrl);
    this.streams = new Map(); // publicKey → { close, config }
    this.onPayment = null;    // callback: (publicKey, tx, config) => void
  }

  watch(publicKey, config) {
    if (this.streams.has(publicKey)) {
      console.log(`[Watcher] Already watching ${config.name} (${publicKey.slice(0, 8)}...)`);
      return;
    }

    console.log(`[Watcher] 👁️  Starting stream for ${config.name} (${publicKey.slice(0, 8)}...)`);

    const close = this.server
      .payments()
      .forAccount(publicKey)
      .cursor("now")
      .stream({
        onmessage: (payment) => this._handlePayment(publicKey, payment, config),
        onerror: (err) => {
          console.error(`[Watcher] Stream error for ${config.name}:`, err?.message || err);
          // Horizon SSE auto-reconnects, so we just log
        },
      });

    this.streams.set(publicKey, { close, config });
  }

  unwatch(publicKey) {
    const entry = this.streams.get(publicKey);
    if (entry) {
      console.log(`[Watcher] Stopping stream for ${entry.config.name}`);
      entry.close(); // calling the returned function closes the SSE connection
      this.streams.delete(publicKey);
    }
  }

  unwatchAll() {
    for (const [pubkey] of this.streams) {
      this.unwatch(pubkey);
    }
  }

  _handlePayment(publicKey, payment, config) {
    // Only process actual payments (not create_account, path_payment, etc.)
    if (payment.type !== "payment" && payment.type !== "path_payment_strict_receive" && payment.type !== "path_payment_strict_send") {
      return;
    }

    const tx = {
      id: payment.id,
      from: payment.from,
      to: payment.to,
      amount: parseFloat(payment.amount || "0"),
      asset: payment.asset_code || "XLM",
      assetIssuer: payment.asset_issuer || null,
      timestamp: Date.now(),
      createdAt: payment.created_at,
      hash: payment.transaction_hash,
      direction: payment.from === publicKey ? "outgoing" : "incoming",
    };

    console.log(
      `[Watcher] 💸 ${config.name}: ${tx.direction} $${tx.amount} ${tx.asset} ` +
      `${tx.direction === "outgoing" ? "→" : "←"} ${(tx.direction === "outgoing" ? tx.to : tx.from).slice(0, 8)}...`
    );

    if (this.onPayment) {
      this.onPayment(publicKey, tx, config);
    }
  }

  getStreamCount() {
    return this.streams.size;
  }
}
