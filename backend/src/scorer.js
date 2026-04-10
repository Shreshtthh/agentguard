/**
 * Scorer — Groq LLM-powered risk scoring.
 * Only called when the rule engine flags something (saves API calls).
 * Uses Llama 3.3 70B via Groq for sub-200ms inference.
 */

import Groq from "groq-sdk";

let groq = null;

function getGroq() {
  if (!groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.warn("[Scorer] ⚠️  GROQ_API_KEY not set — AI scoring disabled, using fallback");
      return null;
    }
    groq = new Groq({ apiKey });
  }
  return groq;
}

function isToday(timestamp) {
  const now = new Date();
  const d = new Date(timestamp);
  return d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
}

/**
 * Score a flagged transaction with Groq AI.
 * @param {Object} tx - Transaction data
 * @param {Array} flags - Triggered rule flags
 * @param {Array} history - wallet tx history
 * @param {Object} config - wallet config
 * @returns {{ risk_score, risk_level, reason, recommended_action }}
 */
export async function scoreWithAI(tx, flags, history, config) {
  const client = getGroq();

  // Fallback if no API key
  if (!client) {
    return fallbackScore(flags);
  }

  const todaySpent = history
    .filter((t) => t.direction === "outgoing" && isToday(t.timestamp))
    .reduce((s, t) => s + t.amount, 0);

  const recentCount = history.filter(
    (t) => t.direction === "outgoing" && t.timestamp > Date.now() - 60_000
  ).length;

  const prompt = `You are an AI security analyst monitoring autonomous agent wallets on the Stellar blockchain.

Analyze this flagged transaction for risk:
- Amount: $${tx.amount.toFixed(2)} ${tx.asset}
- Recipient: ${tx.to}
- Sender: ${tx.from}
- Direction: ${tx.direction}

Wallet context for "${config.name}":
- Daily budget: $${config.dailyLimit} USDC
- Max per-tx: $${config.maxTx} USDC
- Spent today: $${todaySpent.toFixed(2)} USDC
- Known recipients (whitelisted): ${config.whitelist?.length || 0} addresses
- Is recipient whitelisted: ${config.whitelist?.includes(tx.to) || false}
- Outgoing txns in last 60s: ${recentCount}
- Total txns in history: ${history.length}

Triggered security rules:
${flags.map((f) => `- ${f.rule} (${f.severity}): ${f.detail}`).join("\n")}

Respond in JSON ONLY (no markdown, no explanation outside JSON):
{
  "risk_score": <number 0-100>,
  "risk_level": "<LOW|MEDIUM|HIGH|CRITICAL>",
  "reason": "<1-2 sentence natural language explanation of why this is suspicious>",
  "recommended_action": "<ALLOW|FLAG|BLOCK>"
}`;

  try {
    const start = Date.now();
    const completion = await client.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const elapsed = Date.now() - start;
    const result = JSON.parse(completion.choices[0].message.content);

    console.log(
      `[Scorer] 🤖 AI verdict for ${config.name}: ` +
      `score=${result.risk_score} level=${result.risk_level} ` +
      `action=${result.recommended_action} (${elapsed}ms)`
    );

    return {
      ...result,
      inference_time_ms: elapsed,
      model: "llama-3.3-70b-versatile",
    };
  } catch (err) {
    console.error("[Scorer] Groq API error:", err.message);
    return fallbackScore(flags);
  }
}

/**
 * Deterministic fallback when Groq is unavailable.
 */
function fallbackScore(flags) {
  const severityScores = { LOW: 10, MEDIUM: 30, HIGH: 60, CRITICAL: 90 };
  let score = 0;
  for (const flag of flags) {
    score = Math.max(score, severityScores[flag.severity] || 0);
  }
  // Add 5 per additional flag beyond the first
  score += Math.max(0, (flags.length - 1) * 5);
  score = Math.min(score, 100);

  let level = "LOW";
  if (score >= 80) level = "CRITICAL";
  else if (score >= 60) level = "HIGH";
  else if (score >= 40) level = "MEDIUM";

  return {
    risk_score: score,
    risk_level: level,
    reason: `Fallback scoring: ${flags.map((f) => f.rule).join(", ")} triggered.`,
    recommended_action: score >= 80 ? "BLOCK" : score >= 50 ? "FLAG" : "ALLOW",
    inference_time_ms: 0,
    model: "fallback-heuristic",
  };
}
