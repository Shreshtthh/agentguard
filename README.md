# 🛡️ AgentGuard

> **AI-Powered Security Watchdog for Autonomous Stellar Agents**

[![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue?logo=stellar)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Soroban-Smart%20Contract-purple)](https://soroban.stellar.org)
[![x402](https://img.shields.io/badge/x402-Micropayments-green)](https://x402.org)
[![AI](https://img.shields.io/badge/AI-Groq%20LLM-orange)](https://groq.com)

---

## 🎯 Problem

Autonomous agents on Stellar can spend without guardrails. A compromised agent could drain a wallet before anyone notices. Current solutions:
- No real-time monitoring for agent wallets
- No AI-powered threat detection
- No on-chain circuit breaker for rogue agents
- No monetized monitoring-as-a-service

## 💡 Solution

**AgentGuard** monitors, detects, and blocks rogue agents in real-time:

1. **Watch** — Horizon SSE streams every payment for monitored wallets
2. **Analyze** — 5 deterministic rules flag anomalies instantly
3. **Score** — Groq AI (Llama 3.3 70B) provides risk scores in <200ms
4. **Enforce** — Soroban SpendingPolicy contract pauses compromised agents on-chain
5. **Monetize** — x402 micropayments let other agents buy monitoring status

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     AGENTGUARD SYSTEM                           │
│                                                                 │
│  ┌─ BACKEND (Node.js) ──────────────────────────────────────┐  │
│  │                                                           │  │
│  │  Watcher ──► Rule Engine ──► Groq AI ──► Enforcer        │  │
│  │  (Horizon SSE)  (flags)    (risk score) (pause on-chain) │  │
│  │       │                                                   │  │
│  │       ├── x402 Paywall Server (monitoring-as-a-service)  │  │
│  │       └── HTTP API: /api/state (dashboard polls this)    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                   HTTP poll / SSE                                │
│                          ▼                                      │
│  ┌─ DASHBOARD (Next.js) ────────────────────────────────────┐  │
│  │  MODE=live  → polls backend /api/state every 2s          │  │
│  │  MODE=demo  → replays pre-captured events from JSON      │  │
│  │                                                           │  │
│  │  Components: WalletGrid, AlertFeed, SpendingChart,       │  │
│  │              RiskGauge, IncidentLog, PolicyPanel          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ SOROBAN CONTRACT ───────────────────────────────────────┐  │
│  │  SpendingPolicy: create_policy, check_spend,             │  │
│  │  pause_agent, resume_agent, get_policy, record_spend     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Component | Technology | Why |
|---|---|---|
| Backend | Node.js + Express | Real-time SSE streaming, fast event processing |
| AI Scoring | Groq (Llama 3.3 70B) | Sub-200ms inference, JSON mode |
| Smart Contract | Soroban (Rust) | On-chain spending policies + circuit breaker |
| Dashboard | Next.js 15 | React 19, App Router, serverless API routes |
| Payments | x402 Protocol | Micropayment-gated monitoring endpoints |
| Streaming | Horizon SSE | Real-time payment monitoring via Server-Sent Events |
| Network | Stellar Testnet | USDC payments, friendbot funding |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 22+
- Rust + `stellar-cli` (for Soroban contract)
- [Groq API key](https://console.groq.com) (free)

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/agentguard.git
cd agentguard

# Install backend
cd backend && npm install && cd ..

# Install dashboard
cd dashboard && npm install && cd ..
```

### 2. Create Testnet Accounts
```bash
cd backend
node demo/setup-accounts.js
cd ..
```
This generates 6 testnet wallets and writes `.env`.

### 3. Fund with USDC
Go to [Circle Faucet](https://faucet.circle.com) → Select **Stellar** → Send USDC to Agent-Alpha, Agent-Beta, Agent-Gamma.

### 4. Add Groq API Key
Edit `.env` and set:
```
GROQ_API_KEY=gsk_your_key_here
```

### 5. (Optional) Deploy Soroban Contract
```bash
cd scripts
chmod +x deploy-contract.sh
./deploy-contract.sh
cd ..
```

### 6. Start Everything
```bash
# Terminal 1: Backend
cd backend && node src/index.js

# Terminal 2: Dashboard
cd dashboard && npm run dev
```

Open **http://localhost:3000** 🎉

---

## 🎬 Demo Flow

### Normal Agent (builds baseline)
```bash
cd backend && node demo/normal-agent.js
```
Sends small USDC payments to a known recipient. Dashboard stays green.

### Rogue Agent (triggers alerts)
```bash
cd backend && node demo/rogue-agent.js
```
Sends rapid, escalating payments to an unknown address. Triggers:
- 🟡 `UNKNOWN_RECIPIENT` — sending to non-whitelisted address
- 🟠 `TX_LIMIT_EXCEEDED` — exceeds $1 per-tx limit
- 🔴 `SPENDING_SPIKE` — 3x recent average
- 🔴 `RAPID_FIRE` — >3 txns in 60 seconds
- ⛔ `BUDGET_EXCEEDED` — exceeds $5 daily limit
- 🤖 AI scores 95/100 → **BLOCK** → circuit breaker pauses agent on-chain

### x402 Micropayment (monitoring-as-a-service)
```bash
cd backend && node demo/buy-monitoring.js
```
Agent-Gamma pays $0.01 USDC to check Agent-Alpha's monitoring status.

---

## 🔍 Detection Rules

| # | Rule | Severity | Trigger |
|---|---|---|---|
| 1 | `UNKNOWN_RECIPIENT` | MEDIUM | Recipient not in whitelist |
| 2 | `SPENDING_SPIKE` | HIGH | Amount > 3x recent average |
| 3 | `BUDGET_EXCEEDED` | CRITICAL | Daily spending limit exceeded |
| 4 | `TX_LIMIT_EXCEEDED` | HIGH | Single tx exceeds per-tx max |
| 5 | `RAPID_FIRE` | HIGH | >3 outgoing txns in 60 seconds |

When rules are triggered, Groq AI provides a holistic risk assessment with a 0-100 score, natural language reasoning, and a recommended action (ALLOW / FLAG / BLOCK).

---

## 📜 Soroban Smart Contract

The `SpendingPolicy` contract enforces on-chain limits:

```rust
pub fn create_policy(owner, agent, daily_limit, max_tx)
pub fn check_spend(agent, amount) -> bool
pub fn record_spend(caller, agent, amount)
pub fn pause_agent(caller, agent)     // Circuit breaker
pub fn resume_agent(caller, agent)
pub fn get_policy(agent) -> Policy
```

View your deployed contract: `https://stellar.expert/explorer/testnet/contract/{CONTRACT_ID}`

---

## 💰 x402 Integration

AgentGuard offers **monitoring-as-a-service** via x402 micropayments:

| Endpoint | Price | Description |
|---|---|---|
| `GET /monitor/status?wallet=G...` | $0.01 USDC | Wallet monitoring status |
| `GET /monitor/alerts` | $0.05 USDC | Recent security alerts feed |

Other agents can programmatically check if a wallet is safe before transacting.

---

## 🌐 Horizon SSE Streaming

AgentGuard uses Horizon's Server-Sent Events API to monitor wallets in real-time:

```javascript
server.payments()
  .forAccount(publicKey)
  .cursor("now")
  .stream({ onmessage: handlePayment });
```

- **Live mode** (`localhost`): Backend runs actual SSE streams → Dashboard polls `/api/state`
- **Demo mode** (`Vercel`): Dashboard replays pre-captured events from `demo-data.json`

---

## 📁 Project Structure

```
agentguard/
├── backend/               # Node.js monitoring engine
│   ├── src/
│   │   ├── index.js       # Entry: watcher + analyzer + scorer + enforcer
│   │   ├── watcher.js     # Horizon SSE multi-wallet streams
│   │   ├── analyzer.js    # 5 deterministic detection rules
│   │   ├── scorer.js      # Groq AI risk scoring
│   │   ├── enforcer.js    # Soroban contract calls
│   │   ├── state.js       # In-memory state store
│   │   ├── api.js         # Express REST API
│   │   ├── x402-server.js # x402-paywalled endpoints
│   │   └── config.js      # Environment config
│   └── demo/
│       ├── setup-accounts.js   # Create testnet wallets
│       ├── normal-agent.js     # Simulate normal behavior
│       ├── rogue-agent.js      # Simulate wallet drain attack
│       └── buy-monitoring.js   # x402 client demo
├── dashboard/             # Next.js 15 dashboard
│   ├── app/               # App Router pages + API routes
│   ├── components/        # React components
│   └── lib/               # Replay engine + demo data
├── contracts/             # Soroban smart contract (Rust)
│   └── spending-policy/
└── scripts/               # Deployment + demo scripts
```

---

## 🏆 Built for Stellar Hacks: Agents 2026

**AgentGuard** demonstrates the real need for security infrastructure as autonomous agents become first-class citizens on Stellar. It combines:
- **Real-time blockchain monitoring** (Horizon SSE)
- **AI-powered threat detection** (Groq)
- **On-chain policy enforcement** (Soroban)
- **Agent-to-agent micropayments** (x402)

---

## 📄 License

MIT
