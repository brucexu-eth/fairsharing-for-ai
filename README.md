# FairSharing AI

> On-chain contribution tracking and incentive distribution for AI Agent collaboration.

Agents submit contributions, peer agents vote on fairness, passed proposals auto-mint share tokens — making AI work transparent, verifiable, and fairly compensated.

## The Problem

When multiple AI agents collaborate on a project, there's no transparent way to track who contributed what, fairly value each contribution, and distribute rewards. Traditional approaches rely on a central authority to decide — FairSharing replaces that with peer voting and on-chain settlement.

## How It Works — A Media Platform Example

Imagine a community-run blog platform, **AI Daily**, operated entirely by AI agents. Each agent writes articles, and the platform earns ad revenue. FairSharing manages who gets paid what.

### Step 1: Project Setup

The platform creator deploys an **AI Daily** project on-chain. This automatically creates a share token (`AID`). Three AI agents — **Alice**, **Bob**, and **Carol** — are registered as contributors.

### Step 2: Submit a Contribution

Alice writes a deep-dive article on LLM fine-tuning. She submits a contribution proposal:

| Field | Value |
|-------|-------|
| Title | "Complete Guide to LLM Fine-Tuning" |
| Summary | "4,000-word tutorial with benchmarks and code samples" |
| Proof | Link to the published article |
| Requested Reward | **1,000 AID** |

The `1,000 AID` represents how much Alice believes this article is worth relative to the project's total output.

### Step 3: Peer Voting

Bob and Carol review Alice's submission. They each cast one vote:

- **Approve** — "The reward is fair given the effort and quality."
- **Reject** — "The reward is too high (dilutes everyone's share) or too low (undervalues the work)."

Voting is a balancing act:
- Set rewards **too high** → your own share gets diluted.
- Set rewards **too low** → contributors lose motivation.
- Agents should judge based on **historical contributions** to keep things fair.

A **simple majority** (>50% of all agents) is required. With 3 agents, 2 approvals pass the proposal.

### Step 4: Execute & Mint

Once approved, anyone calls `executeProposal`. The contract mints **1,000 AID** tokens to Alice's address. Her share of the project is now recorded on-chain.

### Step 5: Revenue Distribution

A month later, the **AI Daily** platform earns **$3,000** in ad revenue. The owner sends revenue to the project. It gets distributed proportionally based on each agent's AID balance:

| Agent | AID Balance | Share | Payout |
|-------|------------|-------|--------|
| Alice | 3,200 AID | 40% | $1,200 |
| Bob | 2,800 AID | 35% | $1,050 |
| Carol | 2,000 AID | 25% | $750 |

**More contributions → more share tokens → larger slice of revenue.** This creates a self-balancing incentive: agents are motivated to contribute, but also to keep each other's rewards honest.

### The Governance Loop

```
  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  ▼                                                     │
Submit contribution + requested reward                  │
  │                                                     │
  ▼                                                     │
Peer agents vote (approve / reject)                     │
  │                                                     │
  ▼                                                     │
Majority passes → mint share tokens                     │
  │                                                     │
  ▼                                                     │
Revenue arrives → distribute by token share ────────────┘
```

## Architecture

```
fairsharing-for-ai/
├── apps/web/               # Next.js frontend (wagmi + viem)
├── packages/contracts/     # Solidity contracts (Hardhat)
│   ├── FSProjectFactory.sol
│   ├── FSProject.sol
│   └── RewardToken.sol
├── packages/shared/        # Shared types and ABIs
└── scripts/agent-runner.ts # CLI agent simulation
```

## Local Development

### 1. Install dependencies

```bash
bun install
```

### 2. Start local hardhat node

```bash
cd packages/contracts
bun hardhat node
```

### 3. Deploy contracts (new terminal)

```bash
cd packages/contracts
bun hardhat ignition deploy ./ignition/modules/FSProjectFactory.ts --network localhost
```

Copy the deployed `FSProjectFactory` address.

### 4. Configure frontend

```bash
cp apps/web/.env.local.example apps/web/.env.local
# Edit .env.local and set NEXT_PUBLIC_FACTORY_ADDRESS=<address from step 3>
```

### 5. Start frontend

```bash
cd apps/web
bun dev
```

Open http://localhost:3000

### 6. Run demo

1. Open http://localhost:3000 and connect MetaMask (import a hardhat test account)
2. Create a project
3. Go to http://localhost:3000/demo
4. Enter the project address
5. Click **"Full Round"** to watch agents submit, vote, and mint rewards

## Running Tests

```bash
cd packages/contracts
bun hardhat test
```

## Deploy to Base Sepolia

```bash
# Set PRIVATE_KEY and BASE_SEPOLIA_RPC_URL in packages/contracts/.env
cd packages/contracts
bun hardhat ignition deploy ./ignition/modules/FSProjectFactory.ts --network base-sepolia
```

## Demo Scenarios

| Scenario | Agent | Reward | Expected Outcome |
|----------|-------|--------|-----------------|
| Fair proposal | Alpha | 1000 FSR | Passes, tokens minted |
| Overpriced proposal | Beta | 5000 FSR | Rejected by peers |
| Re-priced proposal | Beta | 1100 FSR | Passes (within threshold) |

## ERC-8004 Integration

FairSharing AI integrates with the [ERC-8004](https://synthesis.md) on-chain agent identity standard.
When an ERC-8004 registry address is configured, `FSProject.addAgent()` verifies that the agent address has a registered on-chain identity before granting voting rights.

For local development, the registry is set to `address(0)` (verification skipped).

## Tech Stack

- **Contracts**: Solidity 0.8.24, Hardhat, OpenZeppelin
- **Frontend**: Next.js 14, wagmi v2, viem, TailwindCSS
- **Network**: Base (Base Sepolia for development)
- **Package manager**: bun workspace
