"use client";

import { useState } from "react";
import { shortAddr } from "@/lib/format";

// Hardhat well-known test accounts (public info, safe for demo docs)
const DEMO_AGENTS = [
  { name: "Agent-Alpha", address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", strategy: "neutral" },
  { name: "Agent-Beta",  address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", strategy: "conservative" },
  { name: "Agent-Gamma", address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", strategy: "aggressive" },
];

interface LogEntry {
  time: string;
  level: "info" | "success" | "error" | "warn";
  msg: string;
}

export default function DemoPage() {
  const [projectAddress, setProjectAddress] = useState(
    process.env.NEXT_PUBLIC_DEMO_PROJECT_ADDRESS ?? ""
  );
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  function log(level: LogEntry["level"], msg: string) {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { time, level, msg }]);
  }

  async function runAction(action: string) {
    if (!projectAddress.trim()) {
      log("error", "Set a project address first.");
      return;
    }
    setLoading(true);
    log("info", `Running: ${action}…`);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectAddress: projectAddress.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        for (const entry of data.logs ?? []) log("success", entry);
      } else {
        log("error", data.error ?? "Unknown error");
      }
    } catch (e: any) {
      log("error", e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  const logColors: Record<LogEntry["level"], string> = {
    info:    "text-gray-400",
    success: "text-green-400",
    error:   "text-red-400",
    warn:    "text-yellow-400",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Demo Control Panel</h1>
        <p className="text-sm text-gray-500 mt-1">
          Simulate AI Agent behavior on a local hardhat node.{" "}
          <a href="https://github.com/brucexu-eth/fairsharing-for-ai#demo" target="_blank" className="text-indigo-500 hover:underline">
            Setup guide ↗
          </a>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Config & Agents */}
        <div className="space-y-4">
          <div className="card p-4">
            <label className="label">Project Address</label>
            <input
              className="input text-sm font-mono"
              placeholder="0x…"
              value={projectAddress}
              onChange={(e) => setProjectAddress(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Or set <code className="font-mono">NEXT_PUBLIC_DEMO_PROJECT_ADDRESS</code> in .env.local
            </p>
          </div>

          <div className="card p-4">
            <h2 className="font-semibold text-sm text-gray-700 mb-3">Demo Agents</h2>
            <div className="space-y-2">
              {DEMO_AGENTS.map((a) => (
                <div key={a.address} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{a.name}</span>
                    <span className="text-gray-400 text-xs ml-2">({a.strategy})</span>
                  </div>
                  <span className="font-mono text-xs text-gray-500">{shortAddr(a.address)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              These are hardhat test accounts. Run <code className="font-mono">bun hardhat node</code> locally.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold text-sm text-gray-700">Scenarios</h2>

            <div className="space-y-2">
              <button
                onClick={() => runAction("setup")}
                className="btn-secondary w-full justify-start text-sm"
                disabled={loading}
              >
                <span className="mr-2">🔧</span>
                Setup: Add 3 agents to project
              </button>
              <button
                onClick={() => runAction("fair_proposal")}
                className="btn-secondary w-full justify-start text-sm"
                disabled={loading}
              >
                <span className="mr-2">✅</span>
                Scenario 1: Agent-Alpha submits fair proposal (1000 FSR)
              </button>
              <button
                onClick={() => runAction("overpriced_proposal")}
                className="btn-secondary w-full justify-start text-sm"
                disabled={loading}
              >
                <span className="mr-2">💸</span>
                Scenario 2: Agent-Beta submits overpriced proposal (5000 FSR)
              </button>
              <button
                onClick={() => runAction("vote_all")}
                className="btn-secondary w-full justify-start text-sm"
                disabled={loading}
              >
                <span className="mr-2">🗳️</span>
                Auto-vote: Agents vote on all pending proposals
              </button>
              <button
                onClick={() => runAction("execute_all")}
                className="btn-secondary w-full justify-start text-sm"
                disabled={loading}
              >
                <span className="mr-2">⚡</span>
                Execute: Mint rewards for all passed proposals
              </button>
              <button
                onClick={() => runAction("full_round")}
                className="btn-primary w-full justify-start text-sm"
                disabled={loading}
              >
                <span className="mr-2">🚀</span>
                Full Round: Run all scenarios in sequence
              </button>
            </div>
          </div>
        </div>

        {/* Log Panel */}
        <div className="card p-4 flex flex-col" style={{ minHeight: 400 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm text-gray-700">Agent Log</h2>
            <button
              className="text-xs text-gray-400 hover:text-gray-600"
              onClick={() => setLogs([])}
            >
              Clear
            </button>
          </div>
          <div className="flex-1 bg-gray-900 rounded-lg p-3 overflow-y-auto font-mono text-xs">
            {logs.length === 0 ? (
              <span className="text-gray-600">Waiting for actions…</span>
            ) : (
              logs.map((entry, i) => (
                <div key={i} className={logColors[entry.level]}>
                  <span className="text-gray-600">[{entry.time}]</span>{" "}
                  {entry.msg}
                </div>
              ))
            )}
            {loading && (
              <div className="text-yellow-400 animate-pulse">Processing…</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
