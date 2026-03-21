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
 *   bun scripts/media-demo.ts                  # 3 rounds
 *   bun scripts/media-demo.ts --rounds=5       # custom rounds
 *   USE_LOCAL=1 bun scripts/media-demo.ts      # against local Hardhat node
 *
 * To get REWARD_TOKEN_ADDRESS:
 *   cast call $FS_PROJECT_ADDRESS "rewardToken()(address)" --rpc-url https://sepolia.base.org
 */

import { createPublicClient, http, formatUnits } from "viem";
import { baseSepolia, hardhat } from "viem/chains";
import { FairSharingAgent } from "./ai-agent";

// ── Agent personas ─────────────────────────────────────────────────────────────

// All three are peer editors of TechInsight Blog.
// Each can submit articles AND vote on others' work with equal authority.

const PERSONAS = [
  {
    name: "Alice Chen",
    persona: `
You are an editor at TechInsight Blog, specialising in AI/ML content.
You cover transformer architecture, LLM fine-tuning, RAG systems, and practical ML
engineering. Your articles run 2000–3000 words and are packed with code examples.

As an editor you also review your co-editors' submissions. You vote yes when the
content is technically solid and the reward reflects the effort. You vote no on
vague, low-effort, or overpriced articles — every bad approval dilutes your own share.

Typical reward you request: 1500–2500 TECH for a deep technical article.`.trim(),
  },
  {
    name: "Bob Kumar",
    persona: `
You are an editor at TechInsight Blog, specialising in web3 and blockchain engineering.
You write concise, hands-on articles (1000–1500 words) on smart contract patterns,
gas optimisation, Solidity testing, and Base/L2 infrastructure.

As an editor you also review your co-editors' submissions. You are a careful voter:
you reject overpriced or vague work and approve articles that give readers something
concrete they can use today.

Typical reward you request: 800–1500 TECH for a focused how-to article.`.trim(),
  },
  {
    name: "Carol Wang",
    persona: `
You are an editor at TechInsight Blog, specialising in crypto strategy and DeFi.
You write accessible analysis pieces (1200–2000 words) on token economics, DeFi
protocols, and the business models of decentralised platforms.

As an editor you also review your co-editors' submissions. You vote fairly — yes on
well-argued, original content with a reasonable reward, no on low-effort or
copy-paste submissions.

Typical reward you request: 1000–2000 TECH for a strategy or analysis article.`.trim(),
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

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log(`║        TechInsight Blog — Final Token Distribution           ║`);
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log(`║  Total supply: ${Number(formatUnits(totalSupply, 18)).toLocaleString().padEnd(12)} ${symbol.padEnd(6)}                        ║`);
  console.log("╠══════════════════════════════════════════════════════════════╣");
  for (const row of rows) {
    const balStr = Number(formatUnits(row.balance, 18)).toLocaleString("en-US", { maximumFractionDigits: 0 });
    const pctStr = row.pct.toFixed(1) + "%";
    const bar = "█".repeat(Math.round(row.pct / 3));
    console.log(`║  ${row.name.padEnd(14)}  ${balStr.padStart(8)} ${symbol.padEnd(6)}  ${pctStr.padStart(6)}  ${bar.padEnd(20)} ║`);
  }
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log(`║  Token % = revenue allocation ratio (ads, subscriptions…)   ║`);
  console.log("╚══════════════════════════════════════════════════════════════╝");
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
  const nRounds = roundsArg ? parseInt(roundsArg.split("=")[1]) : 3;

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

  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║   TechInsight Blog — AI Multi-Agent Demo               ║");
  console.log("║   Powered by FairSharing for AI × Claude               ║");
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log(`║  Project:  ${projectAddress.slice(0, 22)}…          ║`);
  console.log(`║  Model:    ${(process.env.ANTHROPIC_MODEL ?? "claude-haiku-3-5").padEnd(30)}      ║`);
  console.log(`║  Rounds:   ${String(nRounds).padEnd(30)}      ║`);
  console.log("╠════════════════════════════════════════════════════════╣");
  for (const a of agents) {
    console.log(`║  ${a.name.padEnd(14)}  ${a.address.slice(0, 20)}…     ║`);
  }
  console.log("╚════════════════════════════════════════════════════════╝");

  for (let round = 1; round <= nRounds; round++) {
    console.log(`\n${"─".repeat(58)}`);
    console.log(`  Round ${round} / ${nRounds}`);
    console.log(`${"─".repeat(58)}`);

    for (const agent of agents) {
      process.stdout.write(`\n▶ ${agent.name}… `);
      const { actions } = await agent.runTurn();
      if (actions.length === 0) {
        console.log("(no action this turn)");
      } else {
        console.log();
        for (const a of actions) console.log(`    ✓ ${a}`);
      }
    }
  }

  console.log("\n\n=== Demo complete. Final distribution: ===");
  await printDistribution(publicClient, agents, rewardTokenAddress);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
