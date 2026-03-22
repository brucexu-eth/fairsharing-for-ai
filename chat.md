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

---

## Session 3 — 2026-03-22: AI Agent Integration, Demo Polish, and UI Improvements

### Participants
- Human: brucexu.eth
- Agent: bruce-agent (Claude Code, claude-sonnet-4-6)

### What the human asked

1. **Responsive UI**: Make the project page compact — agent cards side by side, submit form alongside the agents panel, collapsible governance banner, minimal spacing.
2. **AI agent integration**: How to add autonomous LLM-driven agents to the demo? Simulate a media platform (TechInsight Blog) where agents write articles and vote on each other's work.
3. **README update**: Rewrite to use "TechInsight Blog" / TECH token branding and add an AI Agent Demo section.
4. **All three agents are editors**: "三个人都是编辑者" — peer editors with equal submit + vote rights, no asymmetric roles.
5. **Demo output polish**: Better formatting, shorter content, one-sentence vote reasoning, randomness (agents try to get inflated rewards, get rejected), parallel agent execution per round.
6. **RPC optimization**: Test publicnode.com and pocket.network for concurrency limits; switch to fastest endpoint.
7. **Default 5 rounds** for the demo.
8. **UI: reject with reason**: When disapproving, prompt the user for a one-sentence reason before confirming the vote.
9. **UI: icon labels**: Action buttons (Approve / Reject / Execute) need clearer word labels alongside icons.

### What the agent did

**1. Responsive layout (`apps/web/app/projects/[address]/page.tsx`)**
- Wrapped Contributor Agents + Submit Contribution in a `grid grid-cols-1 md:grid-cols-2` — side by side on medium screens, stacked on mobile
- Agent cards use `grid grid-cols-1 sm:grid-cols-2` for a 2-column micro-grid
- Governance banner changed to `<details>/<summary>` collapsible
- Add Agent form: `flex gap-2` inline row (input + Add button)
- Reward + Recipient fields on one row with `flex gap-2`
- Overall spacing reduced: `space-y-3` throughout

**2. `scripts/ai-agent.ts` — FairSharingAgent class with Claude tool-use**
- Tools: `submit_contribution`, `vote_on_contribution`, `execute_contribution`, `finish`
- Agentic loop: up to 8 iterations per turn; `finish` tool breaks the loop
- System prompt instructs alternating fair / inflated (2–3×) submissions to stress-test governance
- Vote reasoning capped at one sentence, max 60 chars in output
- Output symbols: `✦` submit, `✓` approve, `✗` reject, `⚡` execute
- Receipt revert check: if `receipt.status === "reverted"` → throw, so races on `executeProposal` don't print false success
- Parallelized `hasVoted` checks with `Promise.all` (was sequential `for` loop)
- Auth: `ANTHROPIC_API_KEY || ANTHROPIC_AUTH_TOKEN` for OpenRouter compatibility
- RPC transport: `retryCount: 5, retryDelay: 1500, timeout: 30_000`

**3. `scripts/media-demo.ts` — TechInsight Blog multi-agent demo**
- Three peer editors: Alice Chen (AI/ML), Bob Kumar (Web3/Solidity), Carol Wang (DeFi)
- Each has a normal reward range; votes fairly and rejects inflated requests
- `Promise.all(agents.map(a => a.runTurn()))` for fully parallel per-round execution
- 2s inter-round pause to avoid RPC burst
- Fixed-width 52-char header box with `shortAddr` for addresses
- Default 5 rounds; `--rounds=N` CLI override

**4. RPC benchmarking**
- Tested 60 concurrent requests: pocket.network (877ms), publicnode.com (262ms), sepolia.base.org (429 rate-limited)
- Switched default to `https://base-sepolia-rpc.publicnode.com`

**5. UI improvements — reject with reason + icon labels**
- `ContributionCard`: "✗ Reject" button no longer votes immediately — it shows an inline panel asking "Why are you rejecting this?" with a text input
- Confirm Reject button is disabled until the user types a reason (local UX only; on-chain vote carries no reason field)
- Cancel dismisses the panel without voting
- Vote/action buttons updated: `✓ Approve`, `✗ Reject`, `⚡ Execute & Mint`
- `(voted)` badge → `✓ voted`
- AgentCard green dot: added `active` text label in green

### Key technical fixes

- **`Cannot find module 'dotenv/config'`**: Removed `import "dotenv/config"` — Bun loads `.env` natively, no import needed
- **Empty `ANTHROPIC_API_KEY`**: `.env` had only `ANTHROPIC_AUTH_TOKEN` (OpenRouter key). Fixed by checking both env vars
- **`FS_PROJECT_ADDRESS` was factory**: `.env` pointed to the factory address, not a deployed project. Fixed by calling `getProjects()` on-chain to find the actual project at `0xD7dF5Ac4d22546541F271b71b394432C027148D5`
- **429 rate limit on `sepolia.base.org`**: Three parallel agents × many proposals = burst exceeds public RPC. Fixed by switching to publicnode.com + retry config + 2s inter-round sleep
- **Parallel execute race**: All 3 agents see same Passed proposal → all send `executeProposal` → only first wins, others revert. Fixed by checking `receipt.status === "reverted"` and suppressing false success logs

### Demo result (final run, 5 rounds, Base Sepolia)

```
Total supply: 70,200 TEST1

Alice Chen     21,200 TEST1   30.2%  ████████████
Bob Kumar      30,150 TEST1   42.9%  █████████████████
Carol Wang     18,850 TEST1   26.9%  ███████████

Token % = revenue share when TechInsight receives ad/subscription income
```

Governance worked as intended: Carol's 4,500-token submission was rejected by Bob and Alice; a 3,800-token submission was rejected by both Bob and Carol. Fair submissions passed; inflated ones were vetoed.

### Key decisions made
- Script-based polling (not event-driven, not MCP) — simplest approach for a hackathon demo
- All three agents are peer editors with equal submit + vote rights — no asymmetric roles
- Bun loads `.env` natively; no dotenv import needed
- publicnode.com chosen as default RPC over pocket.network (3× faster, no rate limit)
- Reject-with-reason is a local UX affordance only (on-chain `vote(id, false)` carries no reason)

### Outcomes
- `scripts/ai-agent.ts` — production-ready autonomous agent class ✅
- `scripts/media-demo.ts` — end-to-end TechInsight Blog demo, 5 rounds, 3 parallel editors ✅
- Demo runs cleanly on Base Sepolia with publicnode.com RPC ✅
- Frontend UI: reject-with-reason flow, icon labels, active badge ✅
- README rewritten for TechInsight Blog / TECH branding ✅

---

## Session 4 — 2026-03-22: ERC-8004 Interface Expansion & Reputation Signal

### Participants
- Human: brucexu.eth
- Agent: Amp (claude-sonnet-4-6)

### What the human asked
Enhance the ERC-8004 integration in the Solidity contracts: expand the `IERC8004Registry` interface, add a `ContributionRecorded` reputation event to `FSProject`, and verify everything compiles and passes tests.

### What the agent did

**1. Expanded `IERC8004Registry` interface**
- Added `balanceOf(address)` — ERC-721 balance check for agent NFTs
- Added `tokenURI(uint256)` — links to the agent registration file
- Updated NatSpec to reflect that the real registry is an ERC-721

**2. Added `ContributionRecorded` event to `FSProject`**
- New event with 6 fields: `agent`, `proposalId`, `reward`, `yesVotes`, `noVotes`, `totalAgents`
- Emitted at the end of `executeProposal()` right after `ProposalExecuted`
- Creates an on-chain reputation signal that ERC-8004 reputation registries can index

**3. Verified contracts**
- `bun hardhat test` — 8/8 tests passing ✅
- `bun hardhat compile` — clean compilation ✅

### Outcomes
- `IERC8004Registry.sol` now has 3 functions (was 1) matching real ERC-8004 spec ✅
- `FSProject.sol` emits `ContributionRecorded` for on-chain reputation indexing ✅
- All tests pass, contracts compile cleanly ✅
