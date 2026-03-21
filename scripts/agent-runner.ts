/**
 * agent-runner.ts
 *
 * Simulates multiple AI Agents interacting with FSProject on-chain.
 * Uses pre-funded test wallets from .env — NEVER use real funds.
 *
 * Usage:
 *   node --loader ts-node/esm scripts/agent-runner.ts submit
 *   node --loader ts-node/esm scripts/agent-runner.ts vote
 *   node --loader ts-node/esm scripts/agent-runner.ts round   (submit + vote + execute)
 */

import { createPublicClient, createWalletClient, http, parseEther, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// TODO: import ABI from @fairsharing/shared after first compile
const FS_PROJECT_ABI = [] as const; // replace with actual ABI

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";
const PROJECT_ADDRESS = process.env.FS_PROJECT_ADDRESS as `0x${string}`;

const agentKeys = [
  process.env.AGENT_1_PRIVATE_KEY,
  process.env.AGENT_2_PRIVATE_KEY,
  process.env.AGENT_3_PRIVATE_KEY,
].filter(Boolean) as string[];

const agentProfiles = [
  { name: "Agent-Alpha", strategy: "neutral" as const },
  { name: "Agent-Beta", strategy: "conservative" as const },
  { name: "Agent-Gamma", strategy: "aggressive" as const },
];

const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

function getWalletClient(privateKey: string) {
  const account = privateKeyToAccount(`0x${privateKey.replace("0x", "")}`);
  return createWalletClient({ account, chain: baseSepolia, transport: http(RPC_URL) });
}

/** Simple pricing strategy: accept if reward <= 1.2x median of past proposals */
function shouldApprove(requestedReward: bigint, medianReward: bigint, strategy: string): boolean {
  const multiplier = strategy === "conservative" ? 1.1 : strategy === "aggressive" ? 1.5 : 1.2;
  return requestedReward <= BigInt(Math.floor(Number(medianReward) * multiplier));
}

async function submitDemo() {
  console.log("Submitting demo proposal from Agent-Alpha...");
  const wallet = getWalletClient(agentKeys[0]);
  // TODO: uncomment after ABI is available
  // await wallet.writeContract({ address: PROJECT_ADDRESS, abi: FS_PROJECT_ABI, functionName: "submitProposal", args: [...] });
  console.log("(stub) submitProposal called");
}

async function voteDemo() {
  console.log("Voting on pending proposals...");
  // TODO: read proposals, apply strategy, vote
  console.log("(stub) vote called");
}

async function runRound() {
  await submitDemo();
  await voteDemo();
  console.log("Round complete.");
}

const cmd = process.argv[2];
if (cmd === "submit") submitDemo();
else if (cmd === "vote") voteDemo();
else if (cmd === "round") runRound();
else console.log("Usage: agent-runner.ts <submit|vote|round>");
