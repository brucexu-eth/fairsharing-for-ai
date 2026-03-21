/**
 * ai-agent.ts
 *
 * Reusable FairSharingAgent class — an autonomous AI agent that interacts
 * with an FSProject contract using Claude tool-use to decide what to do.
 *
 * Each call to agent.runTurn() does one agentic cycle:
 *   1. Read on-chain project state (proposals, balances, votes)
 *   2. Ask Claude (with tools) what to do
 *   3. Execute the chosen tools (submit, vote, execute, finish)
 *   4. Return a list of action descriptions
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  keccak256,
  toBytes,
  formatUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, hardhat } from "viem/chains";

// ── ABIs ──────────────────────────────────────────────────────────────────────

const FS_PROJECT_ABI = [
  { inputs: [], name: "proposalCount", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "getAgents", outputs: [{ type: "address[]" }], stateMutability: "view", type: "function" },
  {
    inputs: [{ type: "uint256" }],
    name: "getProposal",
    outputs: [
      { name: "id", type: "uint256" },
      { name: "proposer", type: "address" },
      { name: "beneficiary", type: "address" },
      { name: "proofHash", type: "bytes32" },
      { name: "requestedReward", type: "uint256" },
      { name: "yesVotes", type: "uint256" },
      { name: "noVotes", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "createdAt", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  { inputs: [{ type: "uint256" }, { type: "address" }], name: "hasVoted", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "address" }], name: "isAgent", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
  {
    inputs: [
      { name: "title", type: "string" },
      { name: "summary", type: "string" },
      { name: "proofURI", type: "string" },
      { name: "proofHash", type: "bytes32" },
      { name: "requestedReward", type: "uint256" },
      { name: "beneficiary", type: "address" },
    ],
    name: "submitProposal",
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  { inputs: [{ type: "uint256" }, { type: "bool" }], name: "vote", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ type: "uint256" }], name: "executeProposal", outputs: [], stateMutability: "nonpayable", type: "function" },
] as const;

const REWARD_TOKEN_ABI = [
  { inputs: [{ type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ type: "string" }], stateMutability: "view", type: "function" },
] as const;

const PROPOSAL_SUBMITTED_EVENT = {
  anonymous: false,
  inputs: [
    { indexed: true, name: "id", type: "uint256" },
    { indexed: true, name: "proposer", type: "address" },
    { indexed: true, name: "beneficiary", type: "address" },
    { indexed: false, name: "title", type: "string" },
    { indexed: false, name: "summary", type: "string" },
    { indexed: false, name: "proofURI", type: "string" },
    { indexed: false, name: "proofHash", type: "bytes32" },
    { indexed: false, name: "requestedReward", type: "uint256" },
  ],
  name: "ProposalSubmitted",
  type: "event",
} as const;

// ── Tool definitions ───────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "submit_contribution",
    description:
      "Submit a new article/contribution to the platform. Only submit when you have something genuinely valuable. " +
      "Be fair with the reward — over-requesting dilutes YOUR OWN future earnings from platform revenue.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Article title (concise and descriptive)" },
        summary: {
          type: "string",
          description: "3–5 sentence summary of the article's key points and value to readers",
        },
        proof_uri: {
          type: "string",
          description: "URL to the article or supporting material (can be a realistic placeholder)",
        },
        requested_reward: {
          type: "number",
          description:
            "Share tokens to request. Guidelines: short post ~500, standard article ~1000, " +
            "in-depth technical piece ~2000, landmark contribution ~3000. Base on real effort and value.",
        },
      },
      required: ["title", "summary", "proof_uri", "requested_reward"],
    },
  },
  {
    name: "vote_on_contribution",
    description:
      "Vote approve or reject on a pending contribution. Read the title and summary carefully. " +
      "Approve if it's valuable and the reward is fair. Reject if it's vague, low-quality, or over-priced. " +
      "Skip if you already voted (iVoted: true).",
    input_schema: {
      type: "object" as const,
      properties: {
        contribution_id: { type: "number", description: "The contribution ID to vote on" },
        approve: { type: "boolean", description: "true to approve, false to reject" },
        reasoning: {
          type: "string",
          description: "1–2 sentences explaining your decision",
        },
      },
      required: ["contribution_id", "approve", "reasoning"],
    },
  },
  {
    name: "execute_contribution",
    description:
      "Execute a passed (approved) contribution to mint its reward tokens. " +
      "Call this when you see a contribution with status Passed.",
    input_schema: {
      type: "object" as const,
      properties: {
        contribution_id: { type: "number", description: "The passed contribution ID to execute" },
      },
      required: ["contribution_id"],
    },
  },
  {
    name: "finish",
    description: "End this turn without action. Use when nothing needs to be done right now.",
    input_schema: { type: "object" as const, properties: {} },
  },
];

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProposalInfo {
  id: number;
  title: string;
  summary: string;
  proofURI: string;
  requestedReward: string;
  requestedRewardRaw: bigint;
  yesVotes: number;
  noVotes: number;
  status: number;
  iVoted: boolean;
}

interface ProjectState {
  totalAgents: number;
  myAddress: string;
  myBalance: string;
  myPercentage: string;
  totalSupply: string;
  tokenSymbol: string;
  pending: ProposalInfo[];
  passed: ProposalInfo[];
}

export interface AgentConfig {
  name: string;
  privateKey: `0x${string}`;
  projectAddress: `0x${string}`;
  rewardTokenAddress: `0x${string}`;
  persona: string;
  rpcUrl?: string;
  useLocal?: boolean;
  model?: string;
}

// ── FairSharingAgent ───────────────────────────────────────────────────────────

export class FairSharingAgent {
  readonly name: string;
  readonly address: `0x${string}`;

  private readonly anthropic: Anthropic;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly publicClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly walletClient: any;
  private readonly projectAddress: `0x${string}`;
  private readonly rewardTokenAddress: `0x${string}`;
  private readonly persona: string;
  private readonly model: string;

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.persona = config.persona;
    this.projectAddress = config.projectAddress;
    this.rewardTokenAddress = config.rewardTokenAddress;
    this.model = config.model ?? process.env.ANTHROPIC_MODEL ?? "claude-haiku-3-5";

    const chain = config.useLocal ? hardhat : baseSepolia;
    const transport = http(config.rpcUrl ?? "https://sepolia.base.org");

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
      ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
    });

    const account = privateKeyToAccount(config.privateKey);
    this.address = account.address;
    this.publicClient = createPublicClient({ chain, transport });
    this.walletClient = createWalletClient({ account, chain, transport });
  }

  /**
   * Run one agentic turn: read state → ask Claude → execute tools → return actions.
   */
  async runTurn(): Promise<{ actions: string[] }> {
    const state = await this.getProjectState();
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: this.buildStateMessage(state) },
    ];

    const actions: string[] = [];
    let iterations = 0;

    while (iterations < 8) {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: this.buildSystemPrompt(),
        messages,
        tools: TOOLS,
      });

      messages.push({ role: "assistant", content: response.content });

      const toolBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      if (toolBlocks.length === 0 || response.stop_reason === "end_turn") break;

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      let shouldFinish = false;

      for (const block of toolBlocks) {
        if (block.name === "finish") {
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "OK" });
          shouldFinish = true;
          continue;
        }
        try {
          const result = await this.executeTool(block.name, block.input as Record<string, unknown>);
          actions.push(result.description);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result.output });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Error: ${msg}`,
            is_error: true,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
      iterations++;
      if (shouldFinish) break;
    }

    return { actions };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private buildSystemPrompt(): string {
    return `You are ${this.name}, a contributor to TechInsight — a decentralized AI-focused media platform.

${this.persona}

== FairSharing Platform Rules ==
- Contributors submit articles and request share tokens reflecting their value
- ALL agents vote on each contribution; simple majority (>50% of total agents) passes
- Passed contributions must be executed to mint tokens
- Your token % = your share of future platform revenue (ads, subscriptions, grants)
- IMPORTANT: Over-requesting dilutes YOUR OWN future earnings — request fairly
- Vote honestly: low-quality or overpriced content hurts everyone long-term

== Your Task This Turn ==
Based on the current platform state, decide what to do (in priority order):
1. Execute any passed contributions (status: Passed) to mint tokens
2. Vote on any pending contributions you haven't voted on yet (iVoted: false)
3. Submit a new article if you have something valuable to contribute
4. Use "finish" if there's nothing to do right now

Be strategic and fair. Quality contributions + honest voting = better long-term outcomes.`;
  }

  private buildStateMessage(state: ProjectState): string {
    const lines = [
      `== TechInsight Platform State ==`,
      `Agents: ${state.totalAgents}  |  Total supply: ${state.totalSupply} ${state.tokenSymbol}`,
      `Your address: ${state.myAddress}`,
      `Your balance: ${state.myBalance} ${state.tokenSymbol} (${state.myPercentage}%)`,
      "",
    ];

    if (state.passed.length > 0) {
      lines.push(`=== Passed — Ready to Execute ===`);
      for (const p of state.passed) {
        lines.push(`  [#${p.id}] "${p.title}" — ${p.requestedReward} tokens (APPROVED, execute to mint)`);
      }
      lines.push("");
    }

    if (state.pending.length > 0) {
      lines.push(`=== Pending — Awaiting Votes ===`);
      for (const p of state.pending) {
        const voted = p.iVoted ? " ← YOU ALREADY VOTED" : "";
        lines.push(
          `[#${p.id}] "${p.title}"${voted}` +
          `\n  Summary: ${p.summary}` +
          (p.proofURI ? `\n  Proof: ${p.proofURI}` : "") +
          `\n  Requested: ${p.requestedReward} tokens  |  Votes: ${p.yesVotes} yes / ${p.noVotes} no`
        );
      }
      lines.push("");
    } else {
      lines.push(`No pending contributions.`, "");
    }

    lines.push(`What will you do this turn?`);
    return lines.join("\n");
  }

  private async getProjectState(): Promise<ProjectState> {
    const myAddr = this.address;

    const [count, agents, myBalance, totalSupply, tokenSymbol] = await Promise.all([
      this.publicClient.readContract({
        address: this.projectAddress, abi: FS_PROJECT_ABI, functionName: "proposalCount",
      }) as Promise<bigint>,
      this.publicClient.readContract({
        address: this.projectAddress, abi: FS_PROJECT_ABI, functionName: "getAgents",
      }) as Promise<`0x${string}`[]>,
      this.publicClient.readContract({
        address: this.rewardTokenAddress, abi: REWARD_TOKEN_ABI, functionName: "balanceOf", args: [myAddr],
      }) as Promise<bigint>,
      this.publicClient.readContract({
        address: this.rewardTokenAddress, abi: REWARD_TOKEN_ABI, functionName: "totalSupply",
      }) as Promise<bigint>,
      this.publicClient.readContract({
        address: this.rewardTokenAddress, abi: REWARD_TOKEN_ABI, functionName: "symbol",
      }) as Promise<string>,
    ]);

    const stringMap = await this.fetchProposalStrings();

    const rawProposals = await Promise.all(
      Array.from({ length: Number(count) }, (_, i) =>
        this.publicClient.readContract({
          address: this.projectAddress, abi: FS_PROJECT_ABI, functionName: "getProposal",
          args: [BigInt(i)],
        }) as Promise<readonly [bigint, string, string, `0x${string}`, bigint, bigint, bigint, number, bigint]>
      )
    );

    const pending: ProposalInfo[] = [];
    const passed: ProposalInfo[] = [];

    for (const p of rawProposals) {
      const [id, , , , requestedReward, yesVotes, noVotes, status] = p;
      const strings = stringMap[id.toString()] ?? {
        title: `Contribution #${id}`, summary: "", proofURI: "",
      };
      const base: ProposalInfo = {
        id: Number(id),
        title: strings.title,
        summary: strings.summary,
        proofURI: strings.proofURI,
        requestedReward: Number(formatUnits(requestedReward, 18)).toLocaleString("en-US", { maximumFractionDigits: 0 }),
        requestedRewardRaw: requestedReward,
        yesVotes: Number(yesVotes),
        noVotes: Number(noVotes),
        status,
        iVoted: false,
      };

      if (status === 0) {
        const voted = await this.publicClient.readContract({
          address: this.projectAddress, abi: FS_PROJECT_ABI,
          functionName: "hasVoted", args: [id, myAddr],
        }) as boolean;
        pending.push({ ...base, iVoted: voted });
      } else if (status === 1) {
        passed.push(base);
      }
    }

    const myPct = totalSupply > 0n
      ? ((Number(formatUnits(myBalance, 18)) / Number(formatUnits(totalSupply, 18))) * 100).toFixed(1)
      : "0.0";

    return {
      totalAgents: agents.length,
      myAddress: myAddr,
      myBalance: Number(formatUnits(myBalance, 18)).toLocaleString("en-US", { maximumFractionDigits: 0 }),
      myPercentage: myPct,
      totalSupply: Number(formatUnits(totalSupply, 18)).toLocaleString("en-US", { maximumFractionDigits: 0 }),
      tokenSymbol,
      pending,
      passed,
    };
  }

  private async fetchProposalStrings(): Promise<Record<string, { title: string; summary: string; proofURI: string }>> {
    const latest = await this.publicClient.getBlockNumber();
    const fromBlock = latest > 9999n ? latest - 9999n : 0n;

    const logs = await this.publicClient.getLogs({
      address: this.projectAddress,
      event: PROPOSAL_SUBMITTED_EVENT,
      fromBlock,
      toBlock: latest,
    });

    const map: Record<string, { title: string; summary: string; proofURI: string }> = {};
    for (const log of logs) {
      const { id, title, summary, proofURI } = log.args as {
        id?: bigint; title?: string; summary?: string; proofURI?: string;
      };
      if (id !== undefined) {
        map[id.toString()] = {
          title: title ?? "",
          summary: summary ?? "",
          proofURI: proofURI ?? "",
        };
      }
    }
    return map;
  }

  private async executeTool(
    name: string,
    input: Record<string, unknown>,
  ): Promise<{ description: string; output: string }> {
    const wait = (h: `0x${string}`) =>
      this.publicClient.waitForTransactionReceipt({ hash: h });

    if (name === "submit_contribution") {
      const { title, summary, proof_uri, requested_reward } = input as {
        title: string; summary: string; proof_uri: string; requested_reward: number;
      };
      const hash = await this.walletClient.writeContract({
        address: this.projectAddress,
        abi: FS_PROJECT_ABI,
        functionName: "submitProposal",
        args: [
          title,
          summary,
          proof_uri ?? "",
          keccak256(toBytes(proof_uri || title)),
          parseUnits(String(Math.round(requested_reward)), 18),
          "0x0000000000000000000000000000000000000000",
        ],
      });
      await wait(hash);
      return {
        description: `Submitted: "${title}" (${Math.round(requested_reward).toLocaleString()} tokens)`,
        output: `Contribution submitted. tx: ${hash}`,
      };
    }

    if (name === "vote_on_contribution") {
      const { contribution_id, approve, reasoning } = input as {
        contribution_id: number; approve: boolean; reasoning: string;
      };
      const hash = await this.walletClient.writeContract({
        address: this.projectAddress,
        abi: FS_PROJECT_ABI,
        functionName: "vote",
        args: [BigInt(contribution_id), approve],
      });
      await wait(hash);
      return {
        description: `Voted ${approve ? "APPROVE ✓" : "REJECT ✗"} on #${contribution_id}: ${reasoning}`,
        output: `Vote recorded. tx: ${hash}`,
      };
    }

    if (name === "execute_contribution") {
      const { contribution_id } = input as { contribution_id: number };
      const hash = await this.walletClient.writeContract({
        address: this.projectAddress,
        abi: FS_PROJECT_ABI,
        functionName: "executeProposal",
        args: [BigInt(contribution_id)],
      });
      await wait(hash);
      return {
        description: `Executed #${contribution_id} — tokens minted`,
        output: `Executed. tx: ${hash}`,
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  }
}
