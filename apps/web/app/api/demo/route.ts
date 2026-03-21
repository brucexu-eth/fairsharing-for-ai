import { NextRequest, NextResponse } from "next/server";
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
import { hardhat } from "viem/chains";
import { FS_PROJECT_ABI } from "@/lib/contracts";

// Hardhat well-known test private keys — ONLY FOR LOCAL DEMO
const AGENT_KEYS = {
  alpha: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  beta:  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  gamma: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  owner: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
};

// Override with env vars for testnet
const keys = {
  owner: (process.env.DEMO_OWNER_KEY ?? AGENT_KEYS.owner) as `0x${string}`,
  alpha: (process.env.DEMO_AGENT_1_KEY ?? AGENT_KEYS.alpha) as `0x${string}`,
  beta:  (process.env.DEMO_AGENT_2_KEY ?? AGENT_KEYS.beta)  as `0x${string}`,
  gamma: (process.env.DEMO_AGENT_3_KEY ?? AGENT_KEYS.gamma) as `0x${string}`,
};

const rpcUrl = process.env.DEMO_RPC_URL ?? "http://127.0.0.1:8545";
const chain = hardhat;

const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

function walletClient(key: `0x${string}`) {
  return createWalletClient({
    account: privateKeyToAccount(key),
    chain,
    transport: http(rpcUrl),
  });
}

async function waitTx(hash: `0x${string}`) {
  return publicClient.waitForTransactionReceipt({ hash });
}

export async function POST(req: NextRequest) {
  const { action, projectAddress } = await req.json();
  const addr = projectAddress as `0x${string}`;
  const logs: string[] = [];

  const alpha = walletClient(keys.alpha);
  const beta  = walletClient(keys.beta);
  const gamma = walletClient(keys.gamma);
  const owner = walletClient(keys.owner);

  const agentAddresses = [
    alpha.account.address,
    beta.account.address,
    gamma.account.address,
  ];

  try {
    if (action === "setup" || action === "full_round") {
      logs.push(`Setting up agents on project ${addr}…`);
      for (const agentAddr of agentAddresses) {
        const already = await publicClient.readContract({
          address: addr, abi: FS_PROJECT_ABI, functionName: "isAgent", args: [agentAddr],
        });
        if (!already) {
          const hash = await owner.writeContract({
            address: addr, abi: FS_PROJECT_ABI, functionName: "addAgent", args: [agentAddr],
          });
          await waitTx(hash);
          logs.push(`Added agent: ${agentAddr.slice(0, 8)}…`);
        } else {
          logs.push(`Agent already added: ${agentAddr.slice(0, 8)}…`);
        }
      }
    }

    if (action === "fair_proposal" || action === "full_round") {
      logs.push("Agent-Alpha submitting fair proposal (1000 FSR)…");
      const hash = await alpha.writeContract({
        address: addr,
        abi: FS_PROJECT_ABI,
        functionName: "submitProposal",
        args: [
          "Implemented REST API",
          "Built and tested the complete REST API layer with full documentation.",
          "https://github.com/brucexu-eth/fairsharing-for-ai",
          keccak256(toBytes("https://github.com/brucexu-eth/fairsharing-for-ai")),
          parseUnits("1000", 18),
        ],
      });
      await waitTx(hash);
      logs.push("Proposal submitted: 1000 FSR requested (tx: " + hash.slice(0, 10) + "…)");
    }

    if (action === "overpriced_proposal" || action === "full_round") {
      logs.push("Agent-Beta submitting overpriced proposal (5000 FSR)…");
      const hash = await beta.writeContract({
        address: addr,
        abi: FS_PROJECT_ABI,
        functionName: "submitProposal",
        args: [
          "Wrote README",
          "Added a README file with project description.",
          "https://github.com/brucexu-eth/fairsharing-for-ai/blob/main/README.md",
          keccak256(toBytes("readme")),
          parseUnits("5000", 18),
        ],
      });
      await waitTx(hash);
      logs.push("Proposal submitted: 5000 FSR requested (overpriced)");
    }

    if (action === "vote_all" || action === "full_round") {
      const count = await publicClient.readContract({
        address: addr, abi: FS_PROJECT_ABI, functionName: "proposalCount",
      });
      const totalAgents = await publicClient.readContract({
        address: addr, abi: FS_PROJECT_ABI, functionName: "agentCount",
      });

      logs.push(`Voting on ${count} proposal(s) with ${totalAgents} agents…`);

      for (let i = 0n; i < count; i++) {
        const proposal = await publicClient.readContract({
          address: addr, abi: FS_PROJECT_ABI, functionName: "getProposal", args: [i],
        });
        const [id, , , , , , requestedReward, , , status] = proposal;
        if (status !== 0) { logs.push(`Proposal #${i}: already decided, skipping`); continue; }

        const rewardNum = parseFloat(formatUnits(requestedReward, 18));

        // Strategy: reject if reward > 2000 FSR
        const threshold = 2000;
        const voters = [
          { client: beta,  name: "Agent-Beta",  approve: rewardNum <= threshold },
          { client: gamma, name: "Agent-Gamma", approve: rewardNum <= threshold * 1.2 },
        ];

        for (const { client, name, approve } of voters) {
          const alreadyVoted = await publicClient.readContract({
            address: addr, abi: FS_PROJECT_ABI, functionName: "hasVoted",
            args: [id, client.account.address],
          });
          if (alreadyVoted) { logs.push(`${name}: already voted on #${id}`); continue; }

          const hash = await client.writeContract({
            address: addr, abi: FS_PROJECT_ABI, functionName: "vote", args: [id, approve],
          });
          await waitTx(hash);
          logs.push(`${name}: ${approve ? "APPROVED" : "REJECTED"} #${id} (${rewardNum} FSR)`);
        }
      }
    }

    if (action === "execute_all" || action === "full_round") {
      const count = await publicClient.readContract({
        address: addr, abi: FS_PROJECT_ABI, functionName: "proposalCount",
      });
      logs.push(`Checking ${count} proposal(s) for execution…`);

      for (let i = 0n; i < count; i++) {
        const proposal = await publicClient.readContract({
          address: addr, abi: FS_PROJECT_ABI, functionName: "getProposal", args: [i],
        });
        const [id, proposer, , , , , requestedReward, , , status] = proposal;
        if (status !== 1) continue; // only Passed (1)

        const hash = await alpha.writeContract({
          address: addr, abi: FS_PROJECT_ABI, functionName: "executeProposal", args: [id],
        });
        await waitTx(hash);
        logs.push(
          `Executed #${id}: minted ${formatUnits(requestedReward, 18)} FSR → ${proposer.slice(0, 8)}…`
        );
      }
    }

    return NextResponse.json({ success: true, logs });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ success: false, error: e.shortMessage ?? e.message ?? String(e) });
  }
}
