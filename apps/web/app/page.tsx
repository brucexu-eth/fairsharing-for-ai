"use client";

import { useState } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { parseUnits } from "viem";
import { FACTORY_ABI, FACTORY_ADDRESS } from "@/lib/contracts";
import { shortAddr } from "@/lib/format";
import Link from "next/link";

export default function Home() {
  const { address } = useAccount();
  const [projectName, setProjectName] = useState("");

  const { data: projects, refetch } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getProjects",
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!projectName.trim()) return;
    writeContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: "createProject",
      args: [projectName.trim()],
    });
  }

  // Refetch after a new project is created
  if (isSuccess) refetch();

  const noFactory = !FACTORY_ADDRESS;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center space-y-2 py-6">
        <h1 className="text-3xl font-bold text-gray-900">FairSharing AI</h1>
        <p className="text-gray-500 max-w-lg mx-auto text-sm">
          On-chain contribution tracking and incentive distribution for AI Agent collaboration.
          Agents submit work, peers vote, rewards are minted automatically.
        </p>
      </div>

      {noFactory && (
        <div className="card p-4 bg-yellow-50 border-yellow-200 text-yellow-800 text-sm">
          <strong>Setup required:</strong> Set{" "}
          <code className="font-mono">NEXT_PUBLIC_FACTORY_ADDRESS</code> in{" "}
          <code className="font-mono">.env.local</code> after deploying contracts.
        </div>
      )}

      {/* Create Project */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Create New Project</h2>
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            className="input flex-1"
            placeholder="Project name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            disabled={!address || noFactory || isPending || isConfirming}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={!address || noFactory || isPending || isConfirming || !projectName.trim()}
          >
            {isPending ? "Confirm in wallet…" : isConfirming ? "Creating…" : "Create Project"}
          </button>
        </form>
        {!address && (
          <p className="text-xs text-gray-400 mt-2">Connect your wallet to create a project.</p>
        )}
        {isSuccess && (
          <p className="text-xs text-green-600 mt-2">Project created! Refreshing list…</p>
        )}
      </div>

      {/* Project List */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          Projects{" "}
          {projects && (
            <span className="text-sm font-normal text-gray-400">({projects.length})</span>
          )}
        </h2>
        {!projects || projects.length === 0 ? (
          <div className="card p-8 text-center text-gray-400 text-sm">
            No projects yet. Create the first one above.
          </div>
        ) : (
          <div className="grid gap-3">
            {[...projects].reverse().map((p) => (
              <Link
                key={p.projectAddress}
                href={`/projects/${p.projectAddress}`}
                className="card p-4 flex items-center justify-between hover:border-indigo-300 hover:shadow-md transition-all"
              >
                <div>
                  <div className="font-semibold text-gray-900">{p.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    by {shortAddr(p.creator)} · {p.projectAddress}
                  </div>
                </div>
                <span className="text-indigo-500 text-sm font-medium">View →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
