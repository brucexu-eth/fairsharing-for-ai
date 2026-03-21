# Human-Agent Collaboration Log

This file documents the collaboration between **brucexu.eth** (human) and **bruce-agent** (Claude Code, claude-sonnet-4-6) during the development of FairSharing for AI for the [Synthesis Hackathon](https://synthesis.md).

---

## Session 1 — 2026-03-21: Hackathon Registration & Project Setup

### Participants
- Human: brucexu.eth (`brucexu_eth` on X/Twitter)
- Agent: bruce-agent (Claude Code, claude-sonnet-4-6)

### What the human asked
Register for the Synthesis AI Agent Hackathon by following the skill at `synthesis.md/skill.md`.

### What the agent did

**1. Fetched the registration API spec**
Agent fetched `https://synthesis.md/skill.md` to understand the three-phase registration process and API structure.

**2. Collected human information**
Agent prompted the human for all required `humanInfo` fields:
- Full name: brucexu.eth
- Email: brucex2710+hackathon@gmail.com
- Social handle: brucexu_eth
- Background: Builder
- Crypto experience: Experienced (mapped to `"yes"`)
- AI agent experience: Experienced (mapped to `"yes"`)
- Coding comfort: 8/10
- Problem statement: AI contribution tracking and incentive distribution for multi-agent collaboration

Agent also determined agent-specific fields:
- `agentHarness`: `claude-code`
- `model`: `claude-sonnet-4-6`
- `name`: `bruce-agent`

**3. Phase 1 — Registration init**
Agent discovered the actual API base URL was `https://synthesis.devfolio.co` (not `synthesis.md`) by analyzing HTTP responses. Made POST to `/register/init`. Encountered a 409 on the first email (`brucex2710@gmail.com`, already registered), switched to `+hackathon` alias on human's instruction.

Also corrected field validation errors from the first attempt (wrong enum values for `background`, `cryptoExperience`, `aiAgentExperience`; wrong field names `fullName` → `name`, `problemStatement` → `problemToSolve`).

**4. Phase 2 — Email verification**
Agent sent OTP to `brucex2710+hackathon@gmail.com` via `/register/verify/email/send`. Human provided the OTP code. Agent confirmed via `/register/verify/email/confirm`.

**5. Phase 3 — Complete registration**
Called `/register/complete`. Registration succeeded with on-chain ERC-8004 identity minted on Base Mainnet.
- On-chain tx: `0x2ccbe0d08b1cb233f658d27865ae931c0382e953c79600f449b94494eda2c38a`

**6. Self-custody transfer**
Human provided wallet address. Agent initiated and confirmed self-custody transfer of the ERC-8004 agent NFT to `0x17c57bD297175e5711Ee3Daf045252B588f3162F`.
- On-chain tx: `0x1fa45c5164c4ede64cf216554259eb74e206507145e73f641f0287f7ef706e61`

**7. Track selection**
Agent fetched all available prize tracks from `/catalog`, analyzed each track's relevance to the project direction, and recommended 4 tracks:
- Synthesis Open Track ($28,134 prize pool)
- Agents With Receipts — ERC-8004 (Protocol Labs, $4,000)
- Mechanism Design for Public Goods Evaluation (Octant, $1,000)
- Agent Services on Base (Base, $5,000)

Human confirmed this selection.

**8. Project draft submission**
Agent created a draft project via `POST /projects` with:
- Name: FairSharing for AI
- Repo: https://github.com/brucexu-eth/fairsharing-for-ai
- 4 selected tracks
- Conversation log and submission metadata

**9. PRD review**
Human shared `prd.md` (full product spec). Agent reviewed and identified key issues:
- Network mismatch: PRD targets Sepolia, but "Agent Services on Base" track requires Base
- ERC-8004 integration missing from PRD despite registering for that track
- No voting deadline in proposal lifecycle
- Moltbook post required for final submission (not in PRD)

### Key decisions made
- Use `brucex2710+hackathon@gmail.com` as registration email
- Agent harness: `claude-code`, model: `claude-sonnet-4-6`
- Selected 4 tracks covering open, ERC-8004, public goods, and Base agent services angles
- Created `CLAUDE.md` to establish conversation logging convention going forward

### Outcomes
- Synthesis hackathon registration complete
- On-chain ERC-8004 identity created on Base Mainnet
- Self-custody transferred to human's wallet
- Project draft created on Synthesis platform (status: draft)
- API key saved securely: `sk-synth-***` (redacted)

### Remaining before deadline (March 22)
- [x] Fix network target: Base (not Sepolia)
- [x] Add ERC-8004 integration to contracts
- [x] Build and push code to GitHub
- [ ] Post on Moltbook
- [ ] Publish project via API

---

## Session 2 — 2026-03-21: Full-Stack Build, E2E Test, and Agent Runner

### Participants
- Human: brucexu.eth
- Agent: bruce-agent (Claude Code, claude-sonnet-4-6)

### What the human asked
Complete the entire technical implementation independently ("好的，你直接自己全部做完"), then report how to verify and test.

### What the agent did

**1. Smart contracts (`packages/contracts`)**
- Written in Solidity 0.8.24, compiled with Hardhat
- `FSProjectFactory.sol` — deploys and tracks `FSProject` instances
- `FSProject.sol` — agent whitelist + proposal + voting (majority > N/2) + execution
- `RewardToken.sol` — ERC-20, mintable only by FSProject
- `IERC8004Registry.sol` — optional identity check on `addAgent()`
- 7 unit tests, all passing
- Deployed locally: factory at `0x5FbDB2315678afecb367f032d93F642f64180aa3`

**2. Frontend (`apps/web` — Next.js 14 + wagmi v2 + viem)**
- `/` — create project, list all factory projects
- `/projects/[address]` — proposals, voting, add agent, token balances
- `/demo` — one-click demo with pre-configured hardhat test agents
- `/api/demo` — server-side POST endpoint that runs agent actions with hardhat keys
- Build: 6 routes, zero errors

**3. E2E integration test (`scripts/e2e-test.ts`)**
- Full flow: create project → add 3 agents → submit 2 proposals (fair + overpriced) → vote → execute → verify balance
- All 4 assertions pass
- Root cause fixed: `getProjects()` ABI had unnamed tuple components; viem needs all fields named to return object with named keys

**4. Agent runner (`scripts/agent-runner.ts`)**
- Replaced stubs with real implementation
- Strategy-based voting: conservative (≤1500 FSR), neutral (≤2000 FSR), aggressive (≤3000 FSR)
- Works with `USE_LOCAL=1` for hardhat node or real Base Sepolia via env vars

### Key technical fixes
- E2E: ABI `getProjects` tuple components needed `name` fields for viem to return named object
- Frontend: `metaMask()` connector pulls in `@react-native-async-storage/async-storage` → removed, kept `injected()` only; added webpack externals
- Next.js config must be `.mjs` (not `.ts`) for Next.js 14
- Hardhat deploy: ignition module incompatible with bun workspace hoisting → plain `scripts/deploy.ts` with ethers

### Outcomes
- Full monorepo committed and pushed to GitHub
- E2E test: all 4 assertions pass ✅
- Next.js build: 6 routes, zero build errors ✅
- Contract unit tests: 7/7 pass ✅

### Remaining before deadline (March 22)
- [ ] Deploy to Base Sepolia and set `NEXT_PUBLIC_FACTORY_ADDRESS` in production
- [ ] Post on Moltbook
- [ ] Publish project via Synthesis API
