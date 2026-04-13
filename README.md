# AgentGuard

> **AI-Powered Security Watchdog for Autonomous Stellar Agents**

[![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue?logo=stellar)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Soroban-Smart%20Contract-purple)](https://soroban.stellar.org)
[![x402](https://img.shields.io/badge/x402-Micropayments-green)](https://x402.org)
[![AI](https://img.shields.io/badge/AI-Groq%20LLM-orange)](https://groq.com)

---

## The Problem

Autonomous agents on Stellar can spend without guardrails. A compromised agent could drain a wallet before anyone notices. Today there is:

- No real-time monitoring for agent wallets
- No AI-powered threat detection
- No on-chain circuit breaker for rogue agents
- No monetized monitoring-as-a-service for the agent economy

## The Solution

**AgentGuard** monitors, detects, and blocks rogue agents in real-time through a four-stage pipeline:

1. **Watch** — Horizon SSE streams every payment for monitored wallets
2. **Analyze** — 5 deterministic rules flag anomalies instantly
3. **Score** — Groq AI (Llama 3.3 70B) provides risk scores in <1s
4. **Enforce** — Soroban SpendingPolicy contract pauses compromised agents on-chain

Plus: **Monetize** — x402 micropayments let other agents buy monitoring status

---

## Architecture

### System Overview

```
                          AGENTGUARD SYSTEM
  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │   Stellar Testnet                                        │
  │   ┌──────────────┐                                       │
  │   │  Horizon SSE  │──── real-time payment events ────┐   │
  │   └──────────────┘                                   │   │
  │                                                      ▼   │
  │   ┌─────────────────── BACKEND (Node.js) ──────────────┐ │
  │   │                                                     │ │
  │   │   Watcher ──► Analyzer ──► Scorer ──► Enforcer      │ │
  │   │   (SSE)       (5 rules)   (Groq AI)  (Soroban)     │ │
  │   │      │                                    │         │ │
  │   │      │                                    ▼         │ │
  │   │      │                          ┌──────────────┐    │ │
  │   │      │                          │  Soroban RPC │    │ │
  │   │      │                          │ pause_agent()│    │ │
  │   │      │                          └──────────────┘    │ │
  │   │      │                                              │ │
  │   │      ├── Express API (/api/state)                   │ │
  │   │      └── x402 Paywall (/monitor/*)                  │ │
  │   └──────────────────────────────────────────────────────┘ │
  │                          │                                 │
  │                    polls every 2s                           │
  │                          ▼                                 │
  │   ┌─────────────── DASHBOARD (Next.js) ──────────────────┐ │
  │   │                                                       │ │
  │   │  ┌───────────┐  ┌───────────┐  ┌──────────────────┐  │ │
  │   │  │WalletGrid │  │AlertFeed  │  │IncidentLog (AI)  │  │ │
  │   │  │(3 agents) │  │(real-time)│  │(Groq reasoning)  │  │ │
  │   │  └───────────┘  └───────────┘  └──────────────────┘  │ │
  │   │  ┌───────────────┐  ┌─────────────────────────────┐  │ │
  │   │  │SpendingChart  │  │PolicyPanel (Soroban query)  │  │ │
  │   │  └───────────────┘  └─────────────────────────────┘  │ │
  │   └───────────────────────────────────────────────────────┘ │
  └──────────────────────────────────────────────────────────────┘
```

### Detection Pipeline

```
  Payment Event (Horizon SSE)
        │
        ▼
  ┌─────────────────────────────────────────────────────┐
  │  RULE ENGINE (deterministic, <1ms)                  │
  │                                                     │
  │  Rule 1: UNKNOWN_RECIPIENT   → Is dest whitelisted? │
  │  Rule 2: SPENDING_SPIKE      → Amount > 3x average? │
  │  Rule 3: BUDGET_EXCEEDED     → Over daily limit?    │
  │  Rule 4: TX_LIMIT_EXCEEDED   → Over per-tx max?     │
  │  Rule 5: RAPID_FIRE          → >3 txns in 60s?      │
  └─────────────────────────────────────────────────────┘
        │
        │ flags triggered?
        │
   No ──┤──► Log & Allow
        │
   Yes ─┤
        ▼
  ┌─────────────────────────────────────────────────────┐
  │  GROQ AI SCORER (Llama 3.3 70B, ~500ms)             │
  │                                                     │
  │  Input:  Transaction context + triggered rules      │
  │  Output: {                                          │
  │    risk_score: 0-100,                               │
  │    risk_level: LOW|MEDIUM|HIGH|CRITICAL,            │
  │    reason: "natural language explanation",          │
  │    recommended_action: ALLOW|FLAG|BLOCK             │
  │  }                                                  │
  └─────────────────────────────────────────────────────┘
        │
        │ action?
        │
  ALLOW ┤──► Log only
  FLAG  ┤──► Alert + update dashboard
  BLOCK ┤
        ▼
  ┌─────────────────────────────────────────────────────┐
  │  SOROBAN ENFORCER (on-chain circuit breaker)        │
  │                                                     │
  │  SpendingPolicy.pause_agent(agent_pubkey)           │
  │  → Agent is PAUSED on-chain                         │
  │  → No further spending allowed                      │
  │  → Resume requires manual admin call                │
  └─────────────────────────────────────────────────────┘
```

### Dashboard Modes

```
  ┌─────────────────────────────────────────────┐
  │  MODE = "live" (localhost development)      │
  │                                             │
  │  Dashboard ──poll──► Backend /api/state     │
  │             every 2s                        │
  │                                             │
  │  Real Horizon SSE ──► Real Groq AI          │
  │  Real Soroban TXs                           │
  └─────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────┐
  │  MODE = "demo" (Vercel deployment)          │
  │                                             │
  │  Dashboard ──replay──► demo-data.json       │
  │             timed events                    │
  │                                             │
  │  No backend needed                          │
  │  Pre-captured attack scenario               │
  │  "RUN ATTACK SIMULATION" button             │
  └─────────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| Backend | Node.js + Express | Real-time SSE streaming, event processing pipeline |
| AI Scoring | Groq (Llama 3.3 70B) | Sub-second risk assessment with JSON structured output |
| Smart Contract | Soroban (Rust) | On-chain spending policies + circuit breaker enforcement |
| Dashboard | Next.js 15 + React 19 | Real-time monitoring UI with App Router + API routes |
| Payments | x402 Protocol | Micropayment-gated monitoring-as-a-service endpoints |
| Streaming | Horizon SSE | Real-time payment monitoring via Server-Sent Events |
| Network | Stellar Testnet | Native XLM payments, friendbot funding |

---

## Quick Start

### Prerequisites
- Node.js 20+
- Rust + `stellar-cli` (for Soroban contract deployment)
- [Groq API key](https://console.groq.com) (free tier available)

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/agentguard.git
cd agentguard

# Install backend dependencies
cd backend && npm install && cd ..

# Install dashboard dependencies
cd dashboard && npm install && cd ..
```

### 2. Create Testnet Accounts
```bash
cd backend
node demo/setup-accounts.js
cd ..
```
This generates 6 testnet wallets (3 agents + guard + known recipient + unknown recipient), funds them with XLM via Stellar friendbot, creates USDC trustlines, and writes all keys to `.env`.

### 3. Add Groq API Key
Edit `.env` in the project root:
```
GROQ_API_KEY=gsk_your_key_here
```

### 4. Deploy Soroban Contract (recommended)
```bash
cd scripts
chmod +x deploy-contract.sh
./deploy-contract.sh
cd ..
```
This builds the Rust contract, deploys to Stellar testnet, creates spending policies for each agent wallet, and updates `.env` with the contract ID.

### 5. Configure Dashboard Environment
```bash
cd dashboard
cp .env.local.example .env.local
```
Edit `dashboard/.env.local`:
```bash
# "live" polls the backend; "demo" replays pre-captured events
NEXT_PUBLIC_MODE=live

# Backend API URL (only needed in live mode)
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000

# Soroban contract ID (copy from root .env after step 4)
NEXT_PUBLIC_CONTRACT_ID=your_contract_id_here
```

### 6. Start Backend
```bash
cd backend
node src/index.js
```
You should see:
```
[Watcher] Monitoring 3 wallet(s) via Horizon SSE
[API] Server running on http://localhost:4000
[x402] Paywall endpoints active
```

### 7. Start Dashboard (separate terminal)
```bash
cd dashboard
npm run dev
```
Open **http://localhost:3000**

---

## Demo Flow

### Step 1: Normal Agent (builds healthy baseline)
```bash
cd backend && node demo/normal-agent.js
```
Sends small XLM payments (0.3–0.8 XLM) to a known, whitelisted recipient. Dashboard stays green — AgentGuard correctly identifies this as normal behavior.

### Step 2: Rogue Agent (triggers full detection cascade)
```bash
cd backend && node demo/rogue-agent.js
```
Sends rapid, escalating payments (2→5→10→15→25 XLM) to an unknown address. The detection cascade:

| Amount | Rules Triggered | AI Score | Action |
|---|---|---|---|
| 2 XLM | UNKNOWN_RECIPIENT | 60/100 | FLAG |
| 5 XLM | UNKNOWN_RECIPIENT, TX_LIMIT_EXCEEDED | 60/100 | FLAG |
| 10 XLM | UNKNOWN_RECIPIENT, TX_LIMIT, BUDGET_EXCEEDED | 95/100 | **BLOCK** |
| 15 XLM | + RAPID_FIRE | 98/100 | **BLOCK** |
| 25 XLM | All 5 rules | 98/100 | **BLOCK** |

Result: Agent-Beta is **PAUSED on-chain** by the Soroban SpendingPolicy contract.

### Step 3: x402 Micropayment (monitoring-as-a-service)
```bash
cd backend && node demo/buy-monitoring.js
```
Agent-Gamma pays $0.01 USDC to query Agent-Alpha's monitoring status via the x402-paywalled endpoint.

---

## Detection Rules

| # | Rule | Severity | Trigger | Example |
|---|---|---|---|---|
| 1 | `UNKNOWN_RECIPIENT` | MEDIUM | Recipient not in whitelist | Payment to unrecognized address |
| 2 | `SPENDING_SPIKE` | HIGH | Amount > 3x recent average | $10 when average is $0.50 |
| 3 | `BUDGET_EXCEEDED` | CRITICAL | Daily spending limit exceeded | $25 spent against $20 limit |
| 4 | `TX_LIMIT_EXCEEDED` | HIGH | Single tx exceeds per-tx max | $10 tx against $5 max |
| 5 | `RAPID_FIRE` | HIGH | >3 outgoing txns in 60 seconds | 4 payments in 16 seconds |

When rules trigger, the transaction context is sent to Groq AI for holistic assessment. The AI returns:
- **Risk score** (0–100)
- **Risk level** (LOW / MEDIUM / HIGH / CRITICAL)
- **Natural language reasoning** explaining the assessment
- **Recommended action** (ALLOW / FLAG / BLOCK)

---

## Soroban Smart Contract

The `SpendingPolicy` contract provides on-chain spending guardrails:

```rust
// Create a policy for an agent wallet
pub fn create_policy(owner: Address, agent: Address, daily_limit: i128, max_tx: i128)

// Check if a spend is within policy (read-only)
pub fn check_spend(agent: Address, amount: i128) -> bool

// Record a spend against the daily budget
pub fn record_spend(caller: Address, agent: Address, amount: i128)

// Circuit breaker: pause a compromised agent
pub fn pause_agent(caller: Address, agent: Address)

// Resume a paused agent (admin only)
pub fn resume_agent(caller: Address, agent: Address)

// Read current policy state
pub fn get_policy(agent: Address) -> Policy
```

The contract stores per-agent state:
- **daily_limit** — Maximum XLM/USDC per 24h period
- **max_tx** — Maximum per-transaction amount
- **spent_today** — Running total for current day
- **paused** — Circuit breaker flag
- **total_blocked / total_allowed** — Lifetime counters

---

## x402 Integration

AgentGuard offers **monitoring-as-a-service** via the x402 protocol. Other agents can programmatically pay to check if a wallet is safe before transacting:

| Endpoint | Price | Returns |
|---|---|---|
| `GET /monitor/status?wallet=G...` | $0.01 USDC | Wallet status, risk level, spending data |
| `GET /monitor/alerts` | $0.05 USDC | Recent security alerts, system risk level |

Implementation uses `@x402/express` middleware with `ExactStellarScheme` for Stellar testnet settlement via a facilitator service.

---

## Horizon SSE Streaming

AgentGuard uses Horizon's Server-Sent Events API to monitor wallets in real-time with zero polling overhead:

```javascript
server.payments()
  .forAccount(publicKey)
  .cursor("now")
  .stream({ onmessage: handlePayment });
```

Each incoming payment event triggers the full detection pipeline: Rules → AI → Enforce. The SSE connection auto-reconnects on network interruptions.

---

## Dashboard Components

| Component | Purpose |
|---|---|
| **Header** | System risk gauge, LIVE/DEMO mode, monitored count, alerts, blocked count, uptime |
| **WalletGrid** | Per-agent cards with status, spending progress bars, risk levels, Stellar Expert links |
| **AlertFeed** | Chronological alert stream with severity dots, rule names, timestamps |
| **SpendingChart** | Horizontal bars showing spending vs. daily limits with color-coded thresholds |
| **IncidentLog** | Expandable AI reasoning cards with risk scores, triggered rules, model latency |
| **PolicyPanel** | Collapsible panel querying Soroban contract state for each agent on-chain |

---

## Project Structure

```
agentguard/
├── backend/                    # Node.js monitoring engine
│   ├── src/
│   │   ├── index.js            # Entry point: orchestrates the pipeline
│   │   ├── watcher.js          # Horizon SSE multi-wallet streams
│   │   ├── analyzer.js         # 5 deterministic detection rules
│   │   ├── scorer.js           # Groq AI risk scoring (Llama 3.3 70B)
│   │   ├── enforcer.js         # Soroban contract interaction layer
│   │   ├── state.js            # In-memory state store
│   │   ├── api.js              # Express REST API for dashboard
│   │   ├── x402-server.js      # x402-paywalled monitoring endpoints
│   │   └── config.js           # Environment configuration
│   └── demo/
│       ├── setup-accounts.js   # Create & fund 6 testnet wallets
│       ├── normal-agent.js     # Simulate healthy agent behavior
│       ├── rogue-agent.js      # Simulate wallet drain attack
│       └── buy-monitoring.js   # x402 client demo
│
├── dashboard/                  # Next.js 15 real-time dashboard
│   ├── app/
│   │   ├── layout.jsx          # Root layout + Inter font + SEO
│   │   ├── page.jsx            # Main dashboard (dual-mode)
│   │   └── api/
│   │       ├── check-policy/   # Soroban RPC read (serverless)
│   │       └── lookup-wallet/  # Horizon REST lookup (serverless)
│   ├── components/
│   │   ├── Header.jsx          # Branding + system status
│   │   ├── WalletGrid.jsx      # Agent wallet cards
│   │   ├── AlertFeed.jsx       # Real-time alert stream
│   │   ├── SpendingChart.jsx   # Spending vs. limits bars
│   │   ├── IncidentLog.jsx     # AI reasoning display
│   │   ├── PolicyPanel.jsx     # On-chain contract state
│   │   ├── RiskGauge.jsx       # Risk level indicator
│   │   └── DemoButton.jsx      # Attack simulation trigger
│   └── lib/
│       ├── demo-data.json      # Pre-captured events for Vercel
│       ├── replay-engine.js    # Timer-based event replayer
│       └── stellar.js          # Stellar SDK helpers
│
├── contracts/                  # Soroban smart contract
│   └── spending-policy/
│       ├── src/lib.rs          # Rust contract implementation
│       └── Cargo.toml
│
├── scripts/
│   ├── deploy-contract.sh      # Build + deploy + create policies
│   ├── capture-demo.js         # Record live state for demo mode
│   └── start-all.sh            # Launch backend + dashboard
│
├── .env                        # Environment variables (generated)
├── .env.example                # Template
└── README.md                   # This file
```

---

## Vercel Deployment (Demo Mode)

The dashboard can be deployed to Vercel for a no-backend demo:

```bash
cd dashboard

# Set demo mode
echo "NEXT_PUBLIC_MODE=demo" > .env.local

# Deploy
npx vercel --prod
```

In demo mode, clicking "RUN ATTACK SIMULATION" replays a pre-captured attack scenario from `demo-data.json` — no backend, no API keys, no testnet access required.

---

## Built for Stellar Hacks: Agents 2026

**AgentGuard** demonstrates the critical need for security infrastructure as autonomous agents become first-class citizens on Stellar. It combines:

- **Real-time blockchain monitoring** via Horizon SSE streaming
- **AI-powered threat detection** via Groq (Llama 3.3 70B)
- **On-chain policy enforcement** via Soroban smart contracts
- **Agent-to-agent micropayments** via the x402 protocol

The system detected and blocked a simulated wallet drain attack in under 20 seconds, with AI risk scores escalating from 60 to 98 as the attack intensified — ultimately pausing the compromised agent on-chain.

---

## License

MIT
