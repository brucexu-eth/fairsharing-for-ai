/**
 * media-demo.ts
 *
 * End-to-end demo: three AI agents autonomously run TechInsight Blog,
 * a decentralized media platform built on FairSharing for AI.
 *
 * Agents submit articles, vote on each other's work using LLM judgment,
 * and earn share tokens proportional to the value they contribute.
 * Final token distribution = funding allocation ratio.
 *
 * Prerequisites:
 *   .env must contain:
 *     ANTHROPIC_API_KEY           — Claude API key
 *     AGENT_1_PRIVATE_KEY         — Alice's wallet private key
 *     AGENT_2_PRIVATE_KEY         — Bob's wallet private key
 *     AGENT_3_PRIVATE_KEY         — Carol's wallet private key
 *     FS_PROJECT_ADDRESS          — Deployed FSProject contract (all 3 agents added as contributors)
 *     REWARD_TOKEN_ADDRESS        — The project's reward token (read from rewardToken() on the contract)
 *     BASE_SEPOLIA_RPC_URL        — (optional) defaults to https://sepolia.base.org
 *     ANTHROPIC_MODEL             — (optional) defaults to claude-haiku-3-5
 *
 * Usage:
 *   bun scripts/media-demo.ts                  # 5 rounds (default)
 *   bun scripts/media-demo.ts --rounds=3       # custom rounds
 *   USE_LOCAL=1 bun scripts/media-demo.ts      # against local Hardhat node
 *
 * To get REWARD_TOKEN_ADDRESS:
 *   cast call $FS_PROJECT_ADDRESS "rewardToken()(address)" --rpc-url https://sepolia.base.org
 */

import { createPublicClient, http, formatUnits } from "viem";
import { baseSepolia, hardhat } from "viem/chains";
import { FairSharingAgent } from "./ai-agent";

// ── Agent personas ─────────────────────────────────────────────────────────────

// All three are peer editors of TechInsight Blog with equal submit + vote rights.

const PERSONAS = [
  {
    name: "Alice Chen",
    persona: `AI/ML editor — covers LLMs, RAG, fine-tuning, transformers.
Normal reward range: 1000–2000 tokens. Votes no on overpriced or vague work.`.trim(),
  },
  {
    name: "Bob Kumar",
    persona: `Web3 / Solidity editor — covers smart contracts, gas optimisation, Base/L2.
Normal reward range: 800–1500 tokens. Strict voter; rejects inflated rewards quickly.`.trim(),
  },
  {
    name: "Carol Wang",
    persona: `DeFi strategy editor — covers tokenomics, protocols, crypto business models.
Normal reward range: 1000–1800 tokens. Fair voter; approves solid work, rejects fluff.`.trim(),
  },
];

// ── Reward token ABI (minimal) ─────────────────────────────────────────────────

const REWARD_TOKEN_ABI = [
  { inputs: [{ type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ type: "string" }], stateMutability: "view", type: "function" },
] as const;

// ── Distribution summary ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function printDistribution(
  publicClient: any,
  agents: FairSharingAgent[],
  rewardTokenAddress: `0x${string}`,
) {
  const [totalSupply, symbol] = await Promise.all([
    publicClient.readContract({
      address: rewardTokenAddress, abi: REWARD_TOKEN_ABI, functionName: "totalSupply",
    }) as Promise<bigint>,
    publicClient.readContract({
      address: rewardTokenAddress, abi: REWARD_TOKEN_ABI, functionName: "symbol",
    }) as Promise<string>,
  ]);

  const rows: { name: string; balance: bigint; pct: number }[] = [];
  for (const agent of agents) {
    const balance = await publicClient.readContract({
      address: rewardTokenAddress, abi: REWARD_TOKEN_ABI,
      functionName: "balanceOf", args: [agent.address],
    }) as bigint;
    const pct = totalSupply > 0n
      ? (Number(formatUnits(balance, 18)) / Number(formatUnits(totalSupply, 18))) * 100
      : 0;
    rows.push({ name: agent.name, balance, pct });
  }

  const total = Number(formatUnits(totalSupply, 18)).toLocaleString("en-US", { maximumFractionDigits: 0 });
  console.log(`\n  Total supply: ${total} ${symbol}\n`);
  for (const row of rows) {
    const balStr = Number(formatUnits(row.balance, 18)).toLocaleString("en-US", { maximumFractionDigits: 0 });
    const pctStr = row.pct.toFixed(1).padStart(5) + "%";
    const bar = "█".repeat(Math.round(row.pct / 2.5));
    console.log(`  ${row.name.padEnd(13)} ${balStr.padStart(7)} ${symbol.padEnd(6)} ${pctStr}  ${bar}`);
  }
  console.log(`\n  Token % = revenue share when TechInsight receives ad/subscription income`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const projectAddress = process.env.FS_PROJECT_ADDRESS as `0x${string}`;
  const rewardTokenAddress = process.env.REWARD_TOKEN_ADDRESS as `0x${string}`;

  if (!projectAddress || !rewardTokenAddress) {
    console.error("Error: FS_PROJECT_ADDRESS and REWARD_TOKEN_ADDRESS must be set in .env");
    console.error("  REWARD_TOKEN_ADDRESS: cast call $FS_PROJECT_ADDRESS \"rewardToken()(address)\" --rpc-url https://sepolia.base.org");
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error("Error: ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN must be set in .env");
    process.exit(1);
  }

  const agentKeys = [
    process.env.AGENT_1_PRIVATE_KEY,
    process.env.AGENT_2_PRIVATE_KEY,
    process.env.AGENT_3_PRIVATE_KEY,
  ] as string[];

  if (agentKeys.some((k) => !k)) {
    console.error("Error: AGENT_1_PRIVATE_KEY, AGENT_2_PRIVATE_KEY, AGENT_3_PRIVATE_KEY must be set in .env");
    process.exit(1);
  }

  const useLocal = process.env.USE_LOCAL === "1";
  const rpcUrl = useLocal
    ? "http://127.0.0.1:8545"
    : (process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org");
  const chain = useLocal ? hardhat : baseSepolia;

  const roundsArg = process.argv.find((a) => a.startsWith("--rounds="));
  const nRounds = roundsArg ? parseInt(roundsArg.split("=")[1]) : 5;

  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

  const agents = PERSONAS.map((p, i) =>
    new FairSharingAgent({
      name: p.name,
      privateKey: agentKeys[i] as `0x${string}`,
      projectAddress,
      rewardTokenAddress,
      persona: p.persona,
      rpcUrl,
      useLocal,
    })
  );

  const W = 52;
  const row = (s: string) => `│  ${s.slice(0, W - 4).padEnd(W - 4)}  │`;
  const shortAddr = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;
  console.log("┌" + "─".repeat(W - 2) + "┐");
  console.log(row("TechInsight Blog — AI Multi-Agent Demo"));
  console.log(row("Powered by FairSharing for AI × Claude"));
  console.log("├" + "─".repeat(W - 2) + "┤");
  console.log(row(`Project : ${projectAddress.slice(0, 10)}…${projectAddress.slice(-8)}`));
  console.log(row(`Model   : ${process.env.ANTHROPIC_MODEL ?? "claude-haiku-3-5"}`));
  console.log(row(`Rounds  : ${nRounds}  (agents run in parallel)`));
  console.log("├" + "─".repeat(W - 2) + "┤");
  for (const a of agents) {
    console.log(row(`${a.name.padEnd(13)}  ${shortAddr(a.address)}`));
  }
  console.log("└" + "─".repeat(W - 2) + "┘");

  for (let round = 1; round <= nRounds; round++) {
    console.log(`\n${"─".repeat(W)}`);
    console.log(`  Round ${round} / ${nRounds}`);
    console.log("─".repeat(W));

    // All agents run concurrently — they each read the current chain state
    // and act. New submissions in this round become visible next round.
    const results = await Promise.all(
      agents.map((agent) => agent.runTurn().then((r) => ({ name: agent.name, actions: r.actions })))
    );

    // Brief pause between rounds so the public RPC recovers from burst load
    if (round < nRounds) await new Promise((r) => setTimeout(r, 2000));

    for (const { name, actions } of results) {
      console.log(`\n  ${name}`);
      if (actions.length === 0) {
        console.log(`    —  (no action)`);
      } else {
        for (const a of actions) console.log(`    ${a}`);
      }
    }
  }

  console.log(`\n${"─".repeat(W)}`);
  console.log("  Final distribution");
  console.log("─".repeat(W));
  await printDistribution(publicClient, agents, rewardTokenAddress);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
