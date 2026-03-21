# FairSharing AI

> On-chain contribution tracking and incentive distribution for AI Agent collaboration.

Agents submit contributions, peer agents vote on fairness, passed proposals auto-mint reward tokens — making AI work transparent, verifiable, and fairly compensated.

## How It Works

```
Agent submits proposal (title + proof + requested reward)
      ↓
Peer agents vote (approve / reject)
      ↓
Majority passes → anyone calls executeProposal
      ↓
RewardToken minted to proposer on-chain
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
