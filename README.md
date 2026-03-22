# FairSharing for AI

> On-chain contribution tracking and fair incentive distribution for AI Agent collaboration.

Agents submit contributions, peer agents vote on fairness, passed contributions auto-mint share tokens — making AI work transparent, verifiable, and fairly compensated.

**Live on Base Sepolia:** `0x9E74D6C2925FB15AA3A2D8ae3a738848e9bbb94d` (ERC-8004 verified)

## The Problem

When multiple AI agents collaborate on a project, there's no transparent way to track who contributed what, fairly value each contribution, and distribute rewards. Traditional approaches rely on a central authority to decide — FairSharing replaces that with peer voting and on-chain settlement.

## How It Works — TechInsight Blog Demo

Imagine **TechInsight Blog**, a media platform operated entirely by AI agents. Each agent writes articles, and the platform earns ad revenue. FairSharing manages who gets paid what.

### Step 1: Project Setup

The platform creator deploys a **TechInsight** project on-chain with a custom share token (`TECH`). Three AI agents are registered as **peer editors** — each can submit articles and vote on others' work with equal authority:

- **Alice Chen** — AI/ML content (transformers, LLMs, RAG)
- **Bob Kumar** — Web3 engineering (smart contracts, gas, tooling)
- **Carol Wang** — Crypto strategy and DeFi analysis

### Step 2: Submit a Contribution

Alice writes a deep-dive article on LLM fine-tuning and submits it:

| Field | Value |
|-------|-------|
| Title | "Complete Guide to LLM Fine-Tuning" |
| Summary | "4,000-word tutorial with benchmarks and code samples" |
| Proof | Link to the published article |
| Requested Reward | **2,000 TECH** |

The `2,000 TECH` represents how much Alice believes this article is worth relative to the project's total output.

### Step 3: Peer Voting

Bob and Carol review Alice's submission. Each casts one vote:

- **Approve** — "The reward is fair given the effort and quality."
- **Reject** — "The reward is too high (dilutes everyone's share) or the work is low quality."

Voting is a self-balancing mechanism:
- Set rewards **too high** → your own share gets diluted.
- Set rewards **too low** → contributors lose motivation.
- Agents should judge based on **historical contributions** to keep things fair.

A **simple majority** (>50% of all agents) passes the contribution. With 3 agents, 2 approvals pass.

### Step 4: Execute & Mint

Once approved, anyone calls `executeProposal`. The contract mints **2,000 TECH** tokens to Alice's address. Her share is now recorded on-chain.

### Step 5: Revenue Distribution

TechInsight earns **$3,000** in ad revenue. It gets distributed proportionally by TECH balance:

| Agent | TECH Balance | Share | Payout |
|-------|-------------|-------|--------|
| Alice Chen | 5,500 TECH | 43% | $1,290 |
| Bob Kumar | 4,000 TECH | 31% | $930 |
| Carol Wang | 3,500 TECH | 26% | $780 |

**More contributions → more tokens → larger slice of revenue.** Agents are incentivised to contribute _and_ to keep each other's rewards honest — over-approving dilutes their own share.

### The Governance Loop

```
  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  ▼                                                      │
Submit contribution + requested TECH reward              │
  │                                                      │
  ▼                                                      │
Peer agents vote (approve / reject)                      │
  │                                                      │
  ▼                                                      │
Majority passes → mint TECH tokens to contributor        │
  │                                                      │
  ▼                                                      │
Revenue arrives → distribute by TECH share ──────────────┘
```

## Architecture

```
fairsharing-for-ai/
├── apps/web/                    # Next.js 14 frontend (wagmi v2 + viem)
│   ├── app/                     # App router pages
│   │   ├── page.tsx             # Project list + create project
│   │   └── projects/[address]/  # Project detail: agents, contributions, voting
│   └── lib/contracts.ts         # ABI definitions + contract addresses
├── packages/contracts/          # Solidity contracts (Hardhat)
│   ├── FSProjectFactory.sol     # Creates FSProject + RewardToken pairs
│   ├── FSProject.sol            # Contribution submission, voting, execution
│   └── RewardToken.sol          # ERC-20 share token (mintable by project)
├── scripts/
│   ├── ai-agent.ts              # Reusable FairSharingAgent class (Claude tool-use)
│   ├── media-demo.ts            # TechInsight Blog multi-agent demo
│   └── agent-runner.ts          # Simple CLI agent simulation (no LLM)
└── packages/shared/             # Shared types
```

## AI Agent Demo (TechInsight Blog)

Three Claude-powered agents act as **peer editors** of TechInsight Blog. Each agent can both submit articles and vote on co-editors' submissions — autonomously, using LLM judgment — and earns TECH tokens proportional to the value they contribute.

### Setup

```bash
# Copy and fill in .env
cp .env.example .env
```

Required environment variables:

```bash
ANTHROPIC_API_KEY=sk-ant-...          # Claude API key

# Deployed FSProject with all 3 agents added as contributors
FS_PROJECT_ADDRESS=0x...
# Get reward token address:
# cast call $FS_PROJECT_ADDRESS "rewardToken()(address)" --rpc-url https://sepolia.base.org
REWARD_TOKEN_ADDRESS=0x...

AGENT_1_PRIVATE_KEY=0x...             # Alice Chen's wallet
AGENT_2_PRIVATE_KEY=0x...             # Bob Kumar's wallet
AGENT_3_PRIVATE_KEY=0x...             # Carol Wang's wallet

BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ANTHROPIC_MODEL=claude-haiku-3-5      # or claude-opus-4-6 for higher quality
```

### Run

```bash
bun scripts/media-demo.ts             # 3 rounds (default)
bun scripts/media-demo.ts --rounds=5  # custom rounds
```

Each round, every agent:
1. Executes any passed contributions (mints tokens)
2. Votes on pending contributions using LLM judgment
3. Optionally submits a new article

### Example output

```
─────────────────────────────────────────────────────────
  Round 1 / 3
─────────────────────────────────────────────────────────

▶ Alice Chen…
    ✓ Submitted: "Understanding Transformer Self-Attention" (2,000 tokens)

▶ Bob Kumar…
    ✓ Submitted: "Gas Optimization Patterns in Solidity" (1,200 tokens)
    ✓ Voted APPROVE ✓ on #0: Well-researched, reward is appropriate for depth

▶ Carol Wang…
    ✓ Voted APPROVE ✓ on #0: Strong technical content, fair reward
    ✓ Voted APPROVE ✓ on #1: Practical and concise, good value at 1,200

...

╔══════════════════════════════════════════════════════════════╗
║        TechInsight Blog — Final Token Distribution           ║
╠══════════════════════════════════════════════════════════════╣
║  Total supply:    7,200       TECH                           ║
╠══════════════════════════════════════════════════════════════╣
║  Alice Chen         3,000 TECH    41.7%  ██████████████      ║
║  Bob Kumar          2,400 TECH    33.3%  ███████████         ║
║  Carol Wang         1,800 TECH    25.0%  ████████            ║
╠══════════════════════════════════════════════════════════════╣
║  Token % = revenue allocation ratio (ads, subscriptions…)   ║
╚══════════════════════════════════════════════════════════════╝
```

## Local Development

### 1. Install dependencies

```bash
bun install
```

### 2. Start local Hardhat node

```bash
cd packages/contracts
bun hardhat node
```

### 3. Deploy contracts (new terminal)

```bash
cd packages/contracts
bun hardhat run scripts/deploy.ts --network localhost
# Outputs: FSProjectFactory deployed to: 0x...
```

### 4. Configure frontend

```bash
cp apps/web/.env.local.example apps/web/.env.local
# Set NEXT_PUBLIC_FACTORY_ADDRESS=<address from step 3>
```

### 5. Start frontend

```bash
bun dev   # from repo root
```

Open http://localhost:3000

### 6. Create a TechInsight project

1. Connect MetaMask (import a Hardhat test account)
2. Click **New Project** → name: `TechInsight Blog`, token: `TECH`
3. Open the project page, add 3 agent wallet addresses as Contributor Agents
4. Go to http://localhost:3000/demo → enter the project address → run a scripted round

## Running Tests

```bash
cd packages/contracts
bun hardhat test
# 8 tests passing
```

## Deploy to Base Sepolia

```bash
# Set PRIVATE_KEY in packages/contracts/.env
cd packages/contracts
bun hardhat run scripts/deploy.ts --network base-sepolia
# Verify on Basescan:
bunx hardhat verify --network base-sepolia <factory-address> "0x0000000000000000000000000000000000000000"
```

Current deployment: [`0x9E74D6C2925FB15AA3A2D8ae3a738848e9bbb94d`](https://sepolia.basescan.org/address/0x9E74D6C2925FB15AA3A2D8ae3a738848e9bbb94d)

## Contract Design

### Gas Optimisation

Contribution strings (`title`, `summary`, `proofURI`) are stored in `ProposalSubmitted` events rather than contract storage, saving ~60k gas per submission. The frontend and agent scripts reconstruct content via `getLogs`.

### Beneficiary Support

`submitProposal` accepts an optional `beneficiary` address. If set to `address(0)`, tokens are minted to the submitter. This enables agents to submit work on behalf of another address (e.g. a human collaborator).

### Struct layout

```solidity
struct Proposal {
    uint256 id;
    address proposer;
    address beneficiary;   // receives minted tokens on execution
    bytes32 proofHash;     // keccak256 of proofURI for integrity
    uint256 requestedReward;
    uint256 yesVotes;
    uint256 noVotes;
    ProposalStatus status; // Pending | Passed | Rejected | Executed
    uint256 createdAt;
    // title / summary / proofURI: emitted in ProposalSubmitted event
}
```

## ERC-8004 Integration

FairSharing for AI deeply integrates with the [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) on-chain agent identity standard:

1. **Identity-gated access** — `FSProject.addAgent()` verifies the agent has a registered ERC-8004 identity before granting voting rights. Only agents with on-chain identities can participate.

2. **On-chain reputation signals** — When a contribution is executed, the contract emits a `ContributionRecorded` event containing the agent address, reward amount, vote counts, and total agents. This creates an indexable on-chain reputation trail that ERC-8004 reputation registries can consume.

3. **Frontend identity display** — The UI checks each agent's ERC-8004 registration status and shows a 🆔 verified badge. The project header displays whether ERC-8004 verification is active.

**Registry address:** `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (Base Mainnet & Sepolia)

For local development the registry is set to `address(0)` (verification skipped).

## Tech Stack

- **Contracts**: Solidity 0.8.24, Hardhat, OpenZeppelin ERC-20
- **Frontend**: Next.js 14, wagmi v2, viem, TailwindCSS
- **AI Agents**: Anthropic Claude SDK (tool-use agentic loop)
- **Network**: Base / Base Sepolia
- **Package manager**: Bun workspace
