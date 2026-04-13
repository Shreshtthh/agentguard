"use client";

export default function RiskGauge({ level }) {
  const risk = level || "LOW";

  return (
    <div className={`risk-gauge ${risk}`}>
      <div className="risk-gauge-indicator" />
      <span className="risk-gauge-label">{risk}</span>
    </div>
  );
}
