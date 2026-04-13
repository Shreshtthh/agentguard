"use client";

import { useState, useCallback } from "react";
import { startReplay } from "@/lib/replay-engine";

export default function DemoButton({ onUpdate, mode }) {
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState("idle");

  const handleClick = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    setPhase("running");

    try {
      const demoData = (await import("@/lib/demo-data.json")).default;

      startReplay(demoData, (event) => {
        onUpdate(event);
      }, () => {
        setPhase("done");
        setIsRunning(false);
      });
    } catch (err) {
      console.error("Demo replay error:", err);
      setPhase("idle");
      setIsRunning(false);
    }
  }, [isRunning, onUpdate]);

  if (mode !== "demo") return null;

  return (
    <div className="demo-button-container dashboard-grid-full">
      <button
        className={`demo-button ${phase === "done" ? "demo-button-replay" : ""}`}
        onClick={handleClick}
        disabled={isRunning}
      >
        {phase === "idle" && "RUN ATTACK SIMULATION"}
        {phase === "running" && "SIMULATION IN PROGRESS..."}
        {phase === "done" && "REPLAY SIMULATION"}
      </button>
    </div>
  );
}
