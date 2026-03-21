"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { keccak256, toBytes, parseUnits, formatUnits } from "viem";
import { FS_PROJECT_ABI, REWARD_TOKEN_ABI } from "@/lib/contracts";
import { shortAddr, formatToken, statusLabel, statusClasses, timeAgo } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

export default function ProjectPage() {
  const { address } = useParams<{ address: `0x${string}` }>();
  const { address: userAddress } = useAccount();
  const projectAddress = address as `0x${string}`;

  // ── Project info ───────────────────────────────────────────────────────────
  const { data: projectName } = useReadContract({
    address: projectAddress,
    abi: FS_PROJECT_ABI,
    functionName: "name",
  });
  const { data: owner } = useReadContract({
    address: projectAddress,
    abi: FS_PROJECT_ABI,
    functionName: "owner",
  });
  const { data: rewardTokenAddr } = useReadContract({
    address: projectAddress,
    abi: FS_PROJECT_ABI,
    functionName: "rewardToken",
  });
  const { data: agents, refetch: refetchAgents } = useReadContract({
    address: projectAddress,
    abi: FS_PROJECT_ABI,
    functionName: "getAgents",
  });
  const { data: proposalCount, refetch: refetchCount } = useReadContract({
    address: projectAddress,
    abi: FS_PROJECT_ABI,
    functionName: "proposalCount",
  });
  const { data: tokenSymbol } = useReadContract({
    address: rewardTokenAddr,
    abi: REWARD_TOKEN_ABI,
    functionName: "symbol",
    query: { enabled: !!rewardTokenAddr },
  });
  const { data: totalSupply } = useReadContract({
    address: rewardTokenAddr,
    abi: REWARD_TOKEN_ABI,
    functionName: "totalSupply",
    query: { enabled: !!rewardTokenAddr },
  });
  const { data: myBalance, refetch: refetchBalance } = useReadContract({
    address: rewardTokenAddr,
    abi: REWARD_TOKEN_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!rewardTokenAddr && !!userAddress },
  });

  const isOwner = userAddress && owner && userAddress.toLowerCase() === owner.toLowerCase();
  const isAgent = userAddress && agents?.some((a) => a.toLowerCase() === userAddress.toLowerCase());

  // ── Read proposals ─────────────────────────────────────────────────────────
  const count = Number(proposalCount ?? 0);
  const { data: proposalResults, refetch: refetchProposals } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: projectAddress,
      abi: FS_PROJECT_ABI,
      functionName: "getProposal" as const,
      args: [BigInt(i)] as const,
    })),
    query: { enabled: count > 0 },
  });

  // ── Write contract ─────────────────────────────────────────────────────────
  const { writeContract, data: txHash, isPending, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const refetchAll = () => {
    refetchAgents();
    refetchCount();
    refetchProposals();
    refetchBalance();
    resetWrite();
  };

  if (isTxSuccess) refetchAll();

  // ── Add agent ──────────────────────────────────────────────────────────────
  const [newAgent, setNewAgent] = useState("");
  function handleAddAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!newAgent.trim()) return;
    writeContract({
      address: projectAddress,
      abi: FS_PROJECT_ABI,
      functionName: "addAgent",
      args: [newAgent.trim() as `0x${string}`],
    });
    setNewAgent("");
  }

  // ── Submit proposal ────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    title: "",
    summary: "",
    proofURI: "",
    reward: "",
  });
  function handleSubmitProposal(e: React.FormEvent) {
    e.preventDefault();
    writeContract({
      address: projectAddress,
      abi: FS_PROJECT_ABI,
      functionName: "submitProposal",
      args: [
        form.title,
        form.summary,
        form.proofURI,
        keccak256(toBytes(form.proofURI || form.title)),
        parseUnits(form.reward || "0", 18),
      ],
    });
    setForm({ title: "", summary: "", proofURI: "", reward: "" });
  }

  const isBusy = isPending || isConfirming;

  return (
    <div className="space-y-6">
      {/* Back */}
      <a href="/" className="text-sm text-indigo-600 hover:underline">
        ← All Projects
      </a>

      {/* Project header */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{projectName ?? "Loading…"}</h1>
            <div className="mt-1 text-xs text-gray-400 space-y-0.5">
              <div>Owner: <span className="font-mono">{shortAddr(owner ?? "")}</span></div>
              <div>Contract: <span className="font-mono">{projectAddress}</span></div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-indigo-600">
              {totalSupply !== undefined ? formatToken(totalSupply) : "—"}
            </div>
            <div className="text-xs text-gray-400">{tokenSymbol ?? "FSR"} total minted</div>
            {userAddress && myBalance !== undefined && (
              <div className="text-xs text-gray-500 mt-0.5">
                Your balance: <strong>{formatToken(myBalance)} {tokenSymbol}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: agents + forms */}
        <div className="space-y-4">
          {/* Agents */}
          <div className="card p-4">
            <h2 className="font-semibold text-sm text-gray-700 mb-3">
              Agents ({agents?.length ?? 0})
            </h2>
            {agents && agents.length > 0 ? (
              <ul className="space-y-1">
                {agents.map((a) => (
                  <li key={a} className="text-xs font-mono text-gray-600 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                    {shortAddr(a)}
                    {a.toLowerCase() === userAddress?.toLowerCase() && (
                      <span className="text-indigo-500 ml-1">(you)</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400">No agents yet.</p>
            )}

            {isOwner && (
              <form onSubmit={handleAddAgent} className="mt-3 space-y-2">
                <input
                  className="input text-xs"
                  placeholder="0x… agent address"
                  value={newAgent}
                  onChange={(e) => setNewAgent(e.target.value)}
                  disabled={isBusy}
                />
                <button type="submit" className="btn-primary w-full text-xs" disabled={isBusy || !newAgent.trim()}>
                  Add Agent
                </button>
              </form>
            )}
          </div>

          {/* Submit Proposal (agents only) */}
          {isAgent && (
            <div className="card p-4">
              <h2 className="font-semibold text-sm text-gray-700 mb-3">Submit Contribution</h2>
              <form onSubmit={handleSubmitProposal} className="space-y-2">
                <div>
                  <label className="label text-xs">Title</label>
                  <input
                    className="input text-xs"
                    placeholder="What did you build?"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    required
                    disabled={isBusy}
                  />
                </div>
                <div>
                  <label className="label text-xs">Summary</label>
                  <textarea
                    className="input text-xs resize-none"
                    rows={3}
                    placeholder="Describe what was done and why it's valuable"
                    value={form.summary}
                    onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                    required
                    disabled={isBusy}
                  />
                </div>
                <div>
                  <label className="label text-xs">Proof URI</label>
                  <input
                    className="input text-xs"
                    placeholder="GitHub PR, Gist, or Notion link"
                    value={form.proofURI}
                    onChange={(e) => setForm((f) => ({ ...f, proofURI: e.target.value }))}
                    disabled={isBusy}
                  />
                </div>
                <div>
                  <label className="label text-xs">Requested Reward (FSR)</label>
                  <input
                    className="input text-xs"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="1000"
                    value={form.reward}
                    onChange={(e) => setForm((f) => ({ ...f, reward: e.target.value }))}
                    required
                    disabled={isBusy}
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary w-full text-xs"
                  disabled={isBusy || !form.title || !form.reward}
                >
                  {isPending ? "Confirm in wallet…" : isConfirming ? "Submitting…" : "Submit Proposal"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right column: proposals */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-semibold text-gray-700">
            Proposals ({count})
          </h2>

          {count === 0 && (
            <div className="card p-8 text-center text-gray-400 text-sm">
              No proposals yet.{isAgent ? " Submit one on the left." : ""}
            </div>
          )}

          {proposalResults?.map((result) => {
            if (result.status !== "success" || !result.result) return null;
            const [id, proposer, title, summary, proofURI, , requestedReward, yesVotes, noVotes, status, createdAt] =
              result.result;

            return (
              <ProposalCard
                key={id.toString()}
                id={id}
                proposer={proposer}
                title={title}
                summary={summary}
                proofURI={proofURI}
                requestedReward={requestedReward}
                yesVotes={yesVotes}
                noVotes={noVotes}
                status={Number(status)}
                createdAt={createdAt}
                projectAddress={projectAddress}
                isAgent={!!isAgent}
                userAddress={userAddress}
                isBusy={isBusy}
                onWrite={(args) => writeContract(args)}
                tokenSymbol={tokenSymbol ?? "FSR"}
                totalAgents={agents?.length ?? 0}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── ProposalCard ───────────────────────────────────────────────────────────────

function ProposalCard({
  id, proposer, title, summary, proofURI, requestedReward,
  yesVotes, noVotes, status, createdAt,
  projectAddress, isAgent, userAddress, isBusy, onWrite, tokenSymbol, totalAgents,
}: {
  id: bigint; proposer: string; title: string; summary: string; proofURI: string;
  requestedReward: bigint; yesVotes: bigint; noVotes: bigint; status: number;
  createdAt: bigint; projectAddress: `0x${string}`; isAgent: boolean;
  userAddress?: string; isBusy: boolean;
  onWrite: (args: any) => void;
  tokenSymbol: string; totalAgents: number;
}) {
  const { data: alreadyVoted } = useReadContract({
    address: projectAddress,
    abi: FS_PROJECT_ABI,
    functionName: "hasVoted",
    args: userAddress ? [id, userAddress as `0x${string}`] : undefined,
    query: { enabled: !!userAddress },
  });

  const canVote = isAgent && status === 0 && !alreadyVoted;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">#{id.toString()}</span>
            <StatusBadge status={status} />
          </div>
          <h3 className="font-semibold text-gray-900 mt-1 truncate">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{summary}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-indigo-600">
            {formatToken(requestedReward)}
          </div>
          <div className="text-xs text-gray-400">{tokenSymbol}</div>
        </div>
      </div>

      {/* Vote bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>{yesVotes.toString()} yes / {noVotes.toString()} no</span>
          <span>{totalAgents > 0 ? `needs >${Math.floor(totalAgents / 2)} to pass` : ""}</span>
        </div>
        {totalAgents > 0 && (
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden flex">
            <div
              className="bg-green-400 h-full transition-all"
              style={{ width: `${(Number(yesVotes) / totalAgents) * 100}%` }}
            />
            <div
              className="bg-red-400 h-full transition-all"
              style={{ width: `${(Number(noVotes) / totalAgents) * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">
          by {shortAddr(proposer)} · {timeAgo(createdAt)}
          {proofURI && (
            <>
              {" · "}
              <a href={proofURI} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">
                proof ↗
              </a>
            </>
          )}
        </div>

        <div className="flex gap-2">
          {canVote && (
            <>
              <button
                className="btn-success text-xs px-3 py-1"
                disabled={isBusy}
                onClick={() =>
                  onWrite({
                    address: projectAddress,
                    abi: FS_PROJECT_ABI,
                    functionName: "vote",
                    args: [id, true],
                  })
                }
              >
                Approve
              </button>
              <button
                className="btn-danger text-xs px-3 py-1"
                disabled={isBusy}
                onClick={() =>
                  onWrite({
                    address: projectAddress,
                    abi: FS_PROJECT_ABI,
                    functionName: "vote",
                    args: [id, false],
                  })
                }
              >
                Reject
              </button>
            </>
          )}
          {status === 1 && (
            <button
              className="btn-primary text-xs px-3 py-1"
              disabled={isBusy}
              onClick={() =>
                onWrite({
                  address: projectAddress,
                  abi: FS_PROJECT_ABI,
                  functionName: "executeProposal",
                  args: [id],
                })
              }
            >
              Execute & Mint
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
