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

const POLL_MS = 10_000; // auto-refresh interval

type ProposalStrings = { title: string; summary: string; proofURI: string };

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

  // ── Project info (auto-refresh) ────────────────────────────────────────────
  const { data: projectName } = useReadContract({
    address: projectAddress, abi: FS_PROJECT_ABI, functionName: "name",
  });
  const { data: owner } = useReadContract({
    address: projectAddress, abi: FS_PROJECT_ABI, functionName: "owner",
  });
  const { data: rewardTokenAddr } = useReadContract({
    address: projectAddress, abi: FS_PROJECT_ABI, functionName: "rewardToken",
  });
  const { data: agents, refetch: refetchAgents } = useReadContract({
    address: projectAddress, abi: FS_PROJECT_ABI, functionName: "getAgents",
    query: { refetchInterval: POLL_MS },
  });
  const { data: proposalCount, refetch: refetchCount } = useReadContract({
    address: projectAddress, abi: FS_PROJECT_ABI, functionName: "proposalCount",
    query: { refetchInterval: POLL_MS },
  });
  const { data: tokenSymbol } = useReadContract({
    address: rewardTokenAddr, abi: REWARD_TOKEN_ABI, functionName: "symbol",
    query: { enabled: !!rewardTokenAddr },
  });
  const { data: totalSupply, refetch: refetchSupply } = useReadContract({
    address: rewardTokenAddr, abi: REWARD_TOKEN_ABI, functionName: "totalSupply",
    query: { enabled: !!rewardTokenAddr, refetchInterval: POLL_MS },
  });
  const { data: myBalance, refetch: refetchBalance } = useReadContract({
    address: rewardTokenAddr, abi: REWARD_TOKEN_ABI, functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!rewardTokenAddr && !!userAddress, refetchInterval: POLL_MS },
  });

  // Direct on-chain isAgent check (authoritative — avoids stale array issues)
  const { data: isAgentOnChain } = useReadContract({
    address: projectAddress, abi: FS_PROJECT_ABI, functionName: "isAgent",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress, refetchInterval: POLL_MS },
  });
  const isOwner = !!(userAddress && owner && userAddress.toLowerCase() === owner.toLowerCase());
  const isAgent = !!isAgentOnChain;

  // ── Agent balances (batched) ────────────────────────────────────────────────
  const { data: agentBalanceResults, refetch: refetchAgentBalances } = useReadContracts({
    contracts: (agents ?? []).map((a) => ({
      address: rewardTokenAddr!,
      abi: REWARD_TOKEN_ABI,
      functionName: "balanceOf" as const,
      args: [a] as const,
    })),
    query: { enabled: !!rewardTokenAddr && !!agents?.length, refetchInterval: POLL_MS },
  });

  // ── Read proposals (auto-refresh) ─────────────────────────────────────────
  const count = Number(proposalCount ?? 0);
  const { data: proposalResults, refetch: refetchProposals } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: projectAddress,
      abi: FS_PROJECT_ABI,
      functionName: "getProposal" as const,
      args: [BigInt(i)] as const,
    })),
    query: { enabled: count > 0, refetchInterval: POLL_MS },
  });

  // ── Fetch ProposalSubmitted event strings ──────────────────────────────────
  const [proposalStrings, setProposalStrings] = useState<Record<string, ProposalStrings>>({});
  useEffect(() => {
    if (!publicClient) return;
    fetchProposalLogs(publicClient, projectAddress)
      .then((logs) => setProposalStrings(logsToStrings(logs)))
      .catch(console.error);
  }, [publicClient, projectAddress, count]);

  // ── Write contract ─────────────────────────────────────────────────────────
  const [txError, setTxError] = useState<string | null>(null);
  const { writeContract: _write, data: txHash, isPending, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  function writeContract(args: any) {
    setTxError(null);
    _write(args, {
      onError: (e: any) => {
        setTxError(e.shortMessage ?? e.message ?? String(e));
        console.error("tx error:", e);
      },
    });
  }

  const refetchAll = () => {
    refetchAgents(); refetchCount(); refetchProposals();
    refetchBalance(); refetchSupply(); refetchAgentBalances();
    resetWrite(); setTxError(null);
    if (publicClient)
      fetchProposalLogs(publicClient, projectAddress)
        .then((logs) => setProposalStrings(logsToStrings(logs)))
        .catch(console.error);
  };
  if (isTxSuccess) refetchAll();

  // ── Add agent ──────────────────────────────────────────────────────────────
  const [newAgent, setNewAgent] = useState("");
  function handleAddAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!newAgent.trim()) return;
    writeContract({ address: projectAddress, abi: FS_PROJECT_ABI, functionName: "addAgent", args: [newAgent.trim() as `0x${string}`] });
    setNewAgent("");
  }

  // ── Submit contribution ────────────────────────────────────────────────────
  const [form, setForm] = useState({ title: "", summary: "", proofURI: "", reward: "", beneficiary: "" });
  function handleSubmitProposal(e: React.FormEvent) {
    e.preventDefault();
    const beneficiary = form.beneficiary.trim() as `0x${string}` | "";
    writeContract({
      address: projectAddress, abi: FS_PROJECT_ABI, functionName: "submitProposal",
      args: [
        form.title, form.summary, form.proofURI,
        keccak256(toBytes(form.proofURI || form.title)),
        parseUnits(form.reward || "0", 18),
        (beneficiary || "0x0000000000000000000000000000000000000000") as `0x${string}`,
      ],
    });
    setForm({ title: "", summary: "", proofURI: "", reward: "", beneficiary: "" });
  }

  const isBusy = isPending || isConfirming;

  // Sorted agents: current user first
  const sortedAgents = agents
    ? [...agents].sort((a) => (a.toLowerCase() === userAddress?.toLowerCase() ? -1 : 1))
    : [];

  return (
    <div className="space-y-3">
      <a href="/" className="text-sm text-indigo-600 hover:underline">← All Projects</a>

      {/* Governance rules banner — collapsible */}
      <details className="card p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 group">
        <summary className="text-xs font-semibold text-indigo-800 cursor-pointer select-none">
          📜 How FairSharing Governance Works
        </summary>
        <ol className="text-xs text-gray-700 mt-2 space-y-1 list-decimal list-inside">
          <li><strong>Submit</strong> — Any contributor agent submits a contribution with a requested share-token amount.</li>
          <li><strong>Vote</strong> — Agents vote fairly; over-rewarding dilutes your own share.</li>
          <li><strong>Approve</strong> — Simple majority (&gt;50%) passes and mints tokens.</li>
          <li><strong>Earn</strong> — Revenue is distributed proportionally to each agent's token balance.</li>
        </ol>
      </details>

      {/* Tx error banner */}
      {txError && (
        <div className="card p-3 bg-red-50 border-red-200 text-red-700 text-sm flex items-start gap-2">
          <span className="font-semibold shrink-0">Transaction failed:</span>
          <span className="break-all">{txError}</span>
          <button className="ml-auto shrink-0 text-red-400 hover:text-red-600" onClick={() => setTxError(null)}>✕</button>
        </div>
      )}

      {/* Project header — compact */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{projectName ?? "Loading…"}</h1>
            <div className="mt-0.5 text-xs text-gray-400 flex flex-wrap gap-x-3">
              <span>Owner: <span className="font-mono">{shortAddr(owner ?? "")}</span></span>
              <span className="hidden sm:inline">Contract: <span className="font-mono">{shortAddr(projectAddress)}</span></span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xl font-bold text-indigo-600 leading-tight">
              {totalSupply !== undefined ? formatToken(totalSupply) : "—"}
              <span className="text-sm font-normal text-gray-400 ml-1">{tokenSymbol ?? "—"}</span>
            </div>
            {userAddress && myBalance !== undefined && (
              <div className="text-xs text-gray-500">
                You: <strong>{formatToken(myBalance)}</strong>
                {totalSupply && totalSupply > 0n && (
                  <span className="text-gray-400 ml-1">
                    ({((Number(formatUnits(myBalance, 18)) / Number(formatUnits(totalSupply, 18))) * 100).toFixed(1)}%)
                  </span>
                )}
              </div>
            )}
            {userAddress && (
              <div className={`text-xs font-medium ${isAgent ? "text-green-600" : "text-gray-400"}`}>
                {isAgent ? "✓ contributor agent" : "not an agent"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Agents + Submit Form: side by side on md+ ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

        {/* Contributor Agents */}
        <div className="card p-4">
          <h2 className="font-semibold text-sm text-gray-700 mb-0.5">
            Contributor Agents ({agents?.length ?? 0})
          </h2>
          <p className="text-xs text-gray-400 mb-2">
            Token % = funding allocation ratio when this project receives revenue.
          </p>

          {sortedAgents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sortedAgents.map((a) => {
                const balRaw = agentBalanceResults?.[agents!.indexOf(a)]?.result as bigint | undefined;
                const bal = balRaw ?? 0n;
                const pct = totalSupply && totalSupply > 0n
                  ? (Number(formatUnits(bal, 18)) / Number(formatUnits(totalSupply, 18))) * 100
                  : 0;
                const isMe = a.toLowerCase() === userAddress?.toLowerCase();
                return (
                  <AgentCard
                    key={a}
                    address={a}
                    isMe={isMe}
                    balance={bal}
                    pct={pct}
                    tokenSymbol={tokenSymbol ?? ""}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-1">No contributor agents yet.</p>
          )}

          {isOwner && (
            <form onSubmit={handleAddAgent} className="mt-3 flex gap-2">
              <input
                className="input text-xs flex-1"
                placeholder="0x… agent address"
                value={newAgent}
                onChange={(e) => setNewAgent(e.target.value)}
                disabled={isBusy}
              />
              <button type="submit" className="btn-primary text-xs px-3 shrink-0" disabled={isBusy || !newAgent.trim()}>
                Add
              </button>
            </form>
          )}
        </div>

        {/* Submit Contribution */}
        <div className="card p-4">
          <h2 className="font-semibold text-sm text-gray-700 mb-2">Submit Contribution</h2>
          {!userAddress ? (
            <p className="text-xs text-gray-400 py-1">Connect your wallet to submit a contribution.</p>
          ) : !isAgent ? (
            <p className="text-xs text-gray-400 py-1">
              Only contributor agents can submit. Ask the owner (<span className="font-mono">{shortAddr(owner ?? "")}</span>) to add your address.
            </p>
          ) : (
            <form onSubmit={handleSubmitProposal} className="space-y-2">
              <input className="input text-xs" placeholder="Title — what did you build?" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required disabled={isBusy} />
              <textarea className="input text-xs resize-none" rows={2} placeholder="Summary — describe what was done and why it's valuable" value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} required disabled={isBusy} />
              <input className="input text-xs" placeholder="Proof URI — GitHub PR, Gist, or Notion link" value={form.proofURI} onChange={(e) => setForm((f) => ({ ...f, proofURI: e.target.value }))} disabled={isBusy} />
              <div className="flex gap-2">
                <input className="input text-xs flex-1" type="number" min="0" step="1" placeholder={`Reward (${tokenSymbol ?? "tokens"})`} value={form.reward} onChange={(e) => setForm((f) => ({ ...f, reward: e.target.value }))} required disabled={isBusy} />
                <input className="input text-xs flex-1 font-mono" placeholder="Recipient 0x… (optional)" value={form.beneficiary} onChange={(e) => setForm((f) => ({ ...f, beneficiary: e.target.value }))} disabled={isBusy} />
              </div>
              <button type="submit" className="btn-primary w-full text-xs" disabled={isBusy || !form.title || !form.reward}>
                {isPending ? "Confirm in wallet…" : isConfirming ? "Submitting…" : "Submit Contribution"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── Contributions ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="font-semibold text-sm text-gray-700">Contributions ({count})</h2>

        {count === 0 && (
          <div className="card p-6 text-center text-gray-400 text-sm">
            No contributions yet.
          </div>
        )}

        {proposalResults?.map((result) => {
          if (result.status !== "success" || !result.result) return null;
          const [id, proposer, beneficiary, , requestedReward, yesVotes, noVotes, status, createdAt] = result.result;
          const strings = proposalStrings[id.toString()] ?? { title: `Contribution #${id}`, summary: "", proofURI: "" };
          return (
            <ContributionCard
              key={id.toString()}
              id={id} proposer={proposer} beneficiary={beneficiary}
              title={strings.title} summary={strings.summary} proofURI={strings.proofURI}
              requestedReward={requestedReward} yesVotes={yesVotes} noVotes={noVotes}
              status={Number(status)} createdAt={createdAt}
              projectAddress={projectAddress} isAgent={isAgent} userAddress={userAddress}
              isBusy={isBusy} onWrite={(args) => writeContract(args)}
              tokenSymbol={tokenSymbol ?? "tokens"} totalAgents={agents?.length ?? 0}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── AgentCard ─────────────────────────────────────────────────────────────────

function AgentCard({ address, isMe, balance, pct, tokenSymbol }: {
  address: string; isMe: boolean; balance: bigint; pct: number;
  tokenSymbol: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${isMe ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-white"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <button
            className="text-xs font-mono text-gray-700 hover:text-indigo-600 text-left truncate"
            onClick={() => setExpanded((v) => !v)}
            title="Click to expand address"
          >
            {expanded ? address : shortAddr(address)}
          </button>
          {isMe && <span className="text-xs text-indigo-500 font-medium shrink-0">you</span>}
        </div>
        <button
          className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
          onClick={copy}
          title="Copy address"
        >
          {copied ? "✓" : "copy"}
        </button>
      </div>

      {/* Share bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-600 font-medium">
            {formatToken(balance)} {tokenSymbol}
          </span>
          <span className={`font-semibold ${pct > 0 ? "text-indigo-600" : "text-gray-400"}`}>
            {pct.toFixed(1)}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-indigo-400 rounded-full transition-all"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── ContributionCard ──────────────────────────────────────────────────────────

function ContributionCard({
  id, proposer, beneficiary, title, summary, proofURI, requestedReward,
  yesVotes, noVotes, status, createdAt,
  projectAddress, isAgent, userAddress, isBusy, onWrite, tokenSymbol, totalAgents,
}: {
  id: bigint; proposer: string; beneficiary: string; title: string; summary: string; proofURI: string;
  requestedReward: bigint; yesVotes: bigint; noVotes: bigint; status: number;
  createdAt: bigint; projectAddress: `0x${string}`; isAgent: boolean;
  userAddress?: string; isBusy: boolean; onWrite: (args: any) => void;
  tokenSymbol: string; totalAgents: number;
}) {
  const { data: alreadyVoted } = useReadContract({
    address: projectAddress, abi: FS_PROJECT_ABI, functionName: "hasVoted",
    args: userAddress ? [id, userAddress as `0x${string}`] : undefined,
    query: { enabled: !!userAddress, refetchInterval: POLL_MS },
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
            {isAgent && status === 0 && alreadyVoted && (
              <span className="text-xs text-gray-400">(voted)</span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {summary && <p className="text-sm text-gray-600 whitespace-pre-wrap">{summary}</p>}
          {proofURI && (
            <a href={proofURI} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:underline break-all">
              {proofURI} ↗
            </a>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-indigo-600">{formatToken(requestedReward)}</div>
          <div className="text-xs text-gray-400">{tokenSymbol}</div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>{yesVotes.toString()} yes / {noVotes.toString()} no</span>
          <span>{totalAgents > 0 ? `needs >${Math.floor(totalAgents / 2)} to pass` : ""}</span>
        </div>
        {totalAgents > 0 && (
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden flex">
            <div className="bg-green-400 h-full transition-all" style={{ width: `${(Number(yesVotes) / totalAgents) * 100}%` }} />
            <div className="bg-red-400 h-full transition-all" style={{ width: `${(Number(noVotes) / totalAgents) * 100}%` }} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400 space-y-0.5">
          <div>by {shortAddr(proposer)} · {timeAgo(createdAt)}</div>
          {showBeneficiary && <div>reward → <span className="font-mono">{shortAddr(beneficiary)}</span></div>}
        </div>
        <div className="flex gap-2">
          {canVote && (
            <>
              <button className="btn-success text-xs px-3 py-1" disabled={isBusy}
                onClick={() => onWrite({ address: projectAddress, abi: FS_PROJECT_ABI, functionName: "vote", args: [id, true] })}>
                Approve
              </button>
              <button className="btn-danger text-xs px-3 py-1" disabled={isBusy}
                onClick={() => onWrite({ address: projectAddress, abi: FS_PROJECT_ABI, functionName: "vote", args: [id, false] })}>
                Reject
              </button>
            </>
          )}
          {status === 1 && (
            <button className="btn-primary text-xs px-3 py-1" disabled={isBusy}
              onClick={() => onWrite({ address: projectAddress, abi: FS_PROJECT_ABI, functionName: "executeProposal", args: [id] })}>
              Execute & Mint
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
