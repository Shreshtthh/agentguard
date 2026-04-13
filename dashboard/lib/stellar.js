/**
 * Stellar helpers — Shared Horizon + Soroban utilities for API routes.
 */

import { Horizon, SorobanRpc } from "@stellar/stellar-sdk";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";

let horizonServer = null;
let sorobanServer = null;

export function getHorizonServer() {
  if (!horizonServer) {
    horizonServer = new Horizon.Server(HORIZON_URL);
  }
  return horizonServer;
}

export function getSorobanServer() {
  if (!sorobanServer) {
    sorobanServer = new SorobanRpc.Server(SOROBAN_RPC_URL);
  }
  return sorobanServer;
}
