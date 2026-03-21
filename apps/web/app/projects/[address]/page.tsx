"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  usePublicClient,
} from "wagmi";
import { keccak256, toBytes, parseUnits, formatUnits } from "viem";
import { FS_PROJECT_ABI, REWARD_TOKEN_ABI, PROPOSAL_SUBMITTED_EVENT } from "@/lib/contracts";
import { shortAddr, formatToken, timeAgo } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

type ProposalStrings = { title: string; summary: string; proofURI: string };

/** Fetch ProposalSubmitted logs, respecting RPC 10k-block limit. */
async function fetchProposalLogs(
  client: ReturnType<typeof usePublicClient>,
  projectAddress: `0x${string}`,
) {
  if (!client) return [];
  const latest = await client.getBlockNumber();
  const fromBlock = latest > 9999n ? latest - 9999n : 0n;
  return client.getLogs({
    address: projectAddress,
    event: PROPOSAL_SUBMITTED_EVENT,
    fromBlock,
    toBlock: latest,
  });
}

function logsToStrings(logs: Awaited<ReturnType<typeof fetchProposalLogs>>) {
  const map: Record<string, ProposalStrings> = {};
  for (const log of logs) {
    const { id, title, summary, proofURI } = log.args as any;
    if (id !== undefined)
      map[id.toString()] = { title: title ?? "", summary: summary ?? "", proofURI: proofURI ?? "" };
  }
  return map;
}

export default function ProjectPage() {
  const { address } = useParams<{ address: `0x${string}` }>();
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
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

  // ── Read proposals (on-chain state) ────────────────────────────────────────
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

  // ── Fetch string data from ProposalSubmitted events ─────────────────────────
  // title, summary, proofURI are stored in events only (gas optimisation).
  const [proposalStrings, setProposalStrings] = useState<Record<string, ProposalStrings>>({});
  useEffect(() => {
    if (!publicClient) return;
    fetchProposalLogs(publicClient, projectAddress)
      .then((logs) => setProposalStrings(logsToStrings(logs)))
      .catch(console.error);
  }, [publicClient, projectAddress, count]);

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
    // Re-fetch event logs on next render
    if (publicClient) {
      fetchProposalLogs(publicClient, projectAddress)
        .then((logs) => setProposalStrings(logsToStrings(logs)))
        .catch(console.error);
    }
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
    beneficiary: "",
  });
  function handleSubmitProposal(e: React.FormEvent) {
    e.preventDefault();
    const beneficiary = form.beneficiary.trim() as `0x${string}` | "";
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
        (beneficiary || "0x0000000000000000000000000000000000000000") as `0x${string}`,
      ],
    });
    setForm({ title: "", summary: "", proofURI: "", reward: "", beneficiary: "" });
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
            <div className="text-xs text-gray-400">{tokenSymbol ?? "—"} total minted</div>
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
          {/* Contributor Agents */}
          <div className="card p-4">
            <h2 className="font-semibold text-sm text-gray-700 mb-3">
              Contributor Agents ({agents?.length ?? 0})
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
              <p className="text-xs text-gray-400">No contributor agents yet.</p>
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
                  Add Contributor Agent
                </button>
              </form>
            )}
          </div>

          {/* Submit Contribution — always visible, locked state when not eligible */}
          <div className="card p-4">
            <h2 className="font-semibold text-sm text-gray-700 mb-3">Submit Contribution</h2>

            {!userAddress ? (
              <p className="text-xs text-gray-400 py-2">
                Connect your wallet to submit a contribution.
              </p>
            ) : !isAgent ? (
              <p className="text-xs text-gray-400 py-2">
                Only contributor agents can submit. Ask the project owner (<span className="font-mono">{shortAddr(owner ?? "")}</span>) to add your address.
              </p>
            ) : (
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
                  <label className="label text-xs">Requested Reward ({tokenSymbol ?? "tokens"})</label>
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
                <div>
                  <label className="label text-xs">Reward Recipient <span className="text-gray-400">(optional — defaults to you)</span></label>
                  <input
                    className="input text-xs font-mono"
                    placeholder="0x… leave blank to receive yourself"
                    value={form.beneficiary}
                    onChange={(e) => setForm((f) => ({ ...f, beneficiary: e.target.value }))}
                    disabled={isBusy}
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary w-full text-xs"
                  disabled={isBusy || !form.title || !form.reward}
                >
                  {isPending ? "Confirm in wallet…" : isConfirming ? "Submitting…" : "Submit Contribution"}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right column: contributions */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-semibold text-gray-700">
            Contributions ({count})
          </h2>

          {count === 0 && (
            <div className="card p-8 text-center text-gray-400 text-sm">
              No contributions yet. Submit one on the left.
            </div>
          )}

          {proposalResults?.map((result) => {
            if (result.status !== "success" || !result.result) return null;
            // getProposal now returns: [id, proposer, beneficiary, proofHash, requestedReward, yesVotes, noVotes, status, createdAt]
            const [id, proposer, beneficiary, , requestedReward, yesVotes, noVotes, status, createdAt] =
              result.result;
            const strings = proposalStrings[id.toString()] ?? { title: `Contribution #${id}`, summary: "", proofURI: "" };

            return (
              <ProposalCard
                key={id.toString()}
                id={id}
                proposer={proposer}
                beneficiary={beneficiary}
                title={strings.title}
                summary={strings.summary}
                proofURI={strings.proofURI}
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
                tokenSymbol={tokenSymbol ?? "tokens"}
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
  id, proposer, beneficiary, title, summary, proofURI, requestedReward,
  yesVotes, noVotes, status, createdAt,
  projectAddress, isAgent, userAddress, isBusy, onWrite, tokenSymbol, totalAgents,
}: {
  id: bigint; proposer: string; beneficiary: string; title: string; summary: string; proofURI: string;
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
  const showBeneficiary = beneficiary.toLowerCase() !== proposer.toLowerCase();

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">#{id.toString()}</span>
            <StatusBadge status={status} />
          </div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {summary && <p className="text-sm text-gray-600 whitespace-pre-wrap">{summary}</p>}
          {proofURI && (
            <a
              href={proofURI}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:underline break-all"
            >
              {proofURI} ↗
            </a>
          )}
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
        <div className="text-xs text-gray-400 space-y-0.5">
          <div>by {shortAddr(proposer)} · {timeAgo(createdAt)}</div>
          {showBeneficiary && (
            <div>reward → <span className="font-mono">{shortAddr(beneficiary)}</span></div>
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
