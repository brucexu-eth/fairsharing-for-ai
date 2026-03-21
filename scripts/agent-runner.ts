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

import { createPublicClient, createWalletClient, http, parseUnits, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, hardhat } from "viem/chains";

const FS_PROJECT_ABI = [
  { inputs: [{ type: "address" }], name: "addAgent", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ type: "string" }, { type: "string" }, { type: "string" }, { type: "bytes32" }, { type: "uint256" }], name: "submitProposal", outputs: [{ type: "uint256" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ type: "uint256" }, { type: "bool" }], name: "vote", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ type: "uint256" }], name: "executeProposal", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "proposalCount", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "uint256" }], name: "getProposal", outputs: [{ type: "uint256" }, { type: "address" }, { type: "string" }, { type: "string" }, { type: "string" }, { type: "bytes32" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint8" }, { type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "uint256" }, { type: "address" }], name: "hasVoted", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "address" }], name: "isAgent", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
] as const;

const useLocal = process.env.USE_LOCAL === "1";
const RPC_URL = useLocal
  ? "http://127.0.0.1:8545"
  : (process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org");
const chain = useLocal ? hardhat : baseSepolia;
const PROJECT_ADDRESS = process.env.FS_PROJECT_ADDRESS as `0x${string}`;

// Hardhat well-known keys as fallback for local dev; override via .env for testnet
const defaultKeys = [
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // account #1
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // account #2
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // account #3
];

const agentKeys = [
  process.env.AGENT_1_PRIVATE_KEY ?? defaultKeys[0],
  process.env.AGENT_2_PRIVATE_KEY ?? defaultKeys[1],
  process.env.AGENT_3_PRIVATE_KEY ?? defaultKeys[2],
] as `0x${string}`[];

const agentProfiles = [
  { name: "Agent-Alpha", strategy: "neutral" as const },
  { name: "Agent-Beta", strategy: "conservative" as const },
  { name: "Agent-Gamma", strategy: "aggressive" as const },
];

const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });

function getWalletClient(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({ account, chain, transport: http(RPC_URL) });
}

const wait = (h: `0x${string}`) => publicClient.waitForTransactionReceipt({ hash: h });

/** Approve if reward <= threshold based on strategy */
function shouldApprove(requestedReward: bigint, strategy: string): boolean {
  const thresholds: Record<string, bigint> = {
    conservative: parseUnits("1500", 18),
    neutral: parseUnits("2000", 18),
    aggressive: parseUnits("3000", 18),
  };
  return requestedReward <= (thresholds[strategy] ?? parseUnits("2000", 18));
}

async function submitDemo() {
  if (!PROJECT_ADDRESS) { console.error("FS_PROJECT_ADDRESS not set"); process.exit(1); }
  console.log(`Submitting demo proposal from ${agentProfiles[0].name}...`);
  const wallet = getWalletClient(agentKeys[0]);
  const h = await wallet.writeContract({
    address: PROJECT_ADDRESS,
    abi: FS_PROJECT_ABI,
    functionName: "submitProposal",
    args: [
      "Demo Task",
      "Automated demo proposal from agent-runner",
      "https://github.com/brucexu-eth/fairsharing-for-ai",
      keccak256(toBytes(`demo-${Date.now()}`)),
      parseUnits("1000", 18),
    ],
  });
  await wait(h);
  console.log("Proposal submitted. tx:", h);
}

async function voteDemo() {
  if (!PROJECT_ADDRESS) { console.error("FS_PROJECT_ADDRESS not set"); process.exit(1); }
  console.log("Voting on pending proposals...");
  const count = await publicClient.readContract({
    address: PROJECT_ADDRESS,
    abi: FS_PROJECT_ABI,
    functionName: "proposalCount",
  }) as bigint;

  for (let i = 0n; i < count; i++) {
    const p = await publicClient.readContract({
      address: PROJECT_ADDRESS,
      abi: FS_PROJECT_ABI,
      functionName: "getProposal",
      args: [i],
    }) as readonly [bigint, string, string, string, string, `0x${string}`, bigint, bigint, bigint, number, bigint];

    const status = p[9]; // 0=Pending,1=Passed,2=Rejected,3=Executed
    if (status !== 0) { console.log(`  Proposal #${i}: not pending, skipping`); continue; }

    const reward = p[6];
    for (let j = 0; j < agentKeys.length; j++) {
      const wallet = getWalletClient(agentKeys[j]);
      const voted = await publicClient.readContract({
        address: PROJECT_ADDRESS,
        abi: FS_PROJECT_ABI,
        functionName: "hasVoted",
        args: [i, wallet.account.address],
      }) as boolean;
      if (voted) continue;

      const isAgent = await publicClient.readContract({
        address: PROJECT_ADDRESS,
        abi: FS_PROJECT_ABI,
        functionName: "isAgent",
        args: [wallet.account.address],
      }) as boolean;
      if (!isAgent) continue;

      const support = shouldApprove(reward, agentProfiles[j].strategy);
      const h = await wallet.writeContract({
        address: PROJECT_ADDRESS,
        abi: FS_PROJECT_ABI,
        functionName: "vote",
        args: [i, support],
      });
      await wait(h);
      console.log(`  ${agentProfiles[j].name} voted ${support ? "YES" : "NO"} on #${i}`);
    }
  }
}

async function runRound() {
  await submitDemo();
  await voteDemo();
  console.log("Round complete.");
}

if (!PROJECT_ADDRESS) {
  console.error("Error: FS_PROJECT_ADDRESS environment variable is required.");
  console.error("Example: FS_PROJECT_ADDRESS=0x... USE_LOCAL=1 bun scripts/agent-runner.ts round");
  process.exit(1);
}

const cmd = process.argv[2];
if (cmd === "submit") await submitDemo();
else if (cmd === "vote") await voteDemo();
else if (cmd === "round") await runRound();
else console.log("Usage: agent-runner.ts <submit|vote|round>");
