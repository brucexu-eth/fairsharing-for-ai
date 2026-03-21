import { formatUnits } from "viem";
import { PROPOSAL_STATUS, type ProposalStatus } from "./contracts";

export function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatToken(amount: bigint, decimals = 18): string {
  const n = parseFloat(formatUnits(amount, decimals));
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function statusLabel(status: number): ProposalStatus {
  return PROPOSAL_STATUS[status] ?? "Pending";
}

export function statusClasses(status: number): string {
  switch (status) {
    case 0: return "bg-yellow-100 text-yellow-800 border-yellow-200";  // Pending
    case 1: return "bg-green-100 text-green-800 border-green-200";     // Passed
    case 2: return "bg-red-100 text-red-800 border-red-200";           // Rejected
    case 3: return "bg-blue-100 text-blue-800 border-blue-200";        // Executed
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export function timeAgo(ts: bigint): string {
  const secs = Math.floor(Date.now() / 1000) - Number(ts);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}
