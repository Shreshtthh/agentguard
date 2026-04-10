#!/bin/bash
# ═══════════════════════════════════════════════════════════
# AgentGuard — Deploy Soroban SpendingPolicy Contract
# ═══════════════════════════════════════════════════════════

set -e

# Testnet config
RPC_URL="https://soroban-testnet.stellar.org"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

# Load env
if [ -f ../.env ]; then
  export $(grep -v '#' ../.env | xargs)
fi

if [ -z "$GUARD_SECRET" ]; then
  echo "❌ GUARD_SECRET not found in .env"
  echo "   Run: cd backend && node demo/setup-accounts.js"
  exit 1
fi

echo "╔══════════════════════════════════════════════╗"
echo "║   🛡️  Deploying SpendingPolicy Contract      ║"
echo "╚══════════════════════════════════════════════╝"

# Step 1: Build
echo ""
echo "1️⃣  Building contract..."
cd ../contracts/spending-policy
stellar contract build
echo "   ✅ Build complete"

# Step 2: Deploy
echo ""
echo "2️⃣  Deploying to testnet..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/spending_policy.wasm \
  --source "$GUARD_SECRET" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$NETWORK_PASSPHRASE")

echo "   ✅ Deployed: $CONTRACT_ID"

# Step 3: Update .env
cd ../../
sed -i "s|^SOROBAN_CONTRACT_ID=.*|SOROBAN_CONTRACT_ID=$CONTRACT_ID|" .env
echo ""
echo "3️⃣  Updated .env with SOROBAN_CONTRACT_ID=$CONTRACT_ID"

# Step 4: Create policies for each agent
echo ""
echo "4️⃣  Creating spending policies..."

if [ -n "$AGENT_ALPHA_PUBLIC" ]; then
  echo "   Creating policy for Agent-Alpha ($5/day, $1/tx)..."
  stellar contract invoke \
    --id "$CONTRACT_ID" --source "$GUARD_SECRET" \
    --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" \
    -- create_policy \
    --owner "$GUARD_PUBLIC" \
    --agent "$AGENT_ALPHA_PUBLIC" \
    --daily_limit 5000000 \
    --max_tx 1000000
  echo "   ✅ Agent-Alpha policy created"
fi

if [ -n "$AGENT_BETA_PUBLIC" ]; then
  echo "   Creating policy for Agent-Beta ($5/day, $1/tx)..."
  stellar contract invoke \
    --id "$CONTRACT_ID" --source "$GUARD_SECRET" \
    --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" \
    -- create_policy \
    --owner "$GUARD_PUBLIC" \
    --agent "$AGENT_BETA_PUBLIC" \
    --daily_limit 5000000 \
    --max_tx 1000000
  echo "   ✅ Agent-Beta policy created"
fi

if [ -n "$AGENT_GAMMA_PUBLIC" ]; then
  echo "   Creating policy for Agent-Gamma ($10/day, $2/tx)..."
  stellar contract invoke \
    --id "$CONTRACT_ID" --source "$GUARD_SECRET" \
    --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" \
    -- create_policy \
    --owner "$GUARD_PUBLIC" \
    --agent "$AGENT_GAMMA_PUBLIC" \
    --daily_limit 10000000 \
    --max_tx 2000000
  echo "   ✅ Agent-Gamma policy created"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ Deployment complete!"
echo "   Contract ID: $CONTRACT_ID"
echo "   View on:     https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID"
echo "═══════════════════════════════════════════════════"
