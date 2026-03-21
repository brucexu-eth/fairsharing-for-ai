# Claude Code Instructions

## Conversation Logging

After every significant work session, update `chat.md` with a summary of what was accomplished.

Rules for `chat.md`:
- Write in chronological order, append new sessions at the bottom
- Summarize the human-agent collaboration: what the human asked, what the agent did, what decisions were made
- Remove all sensitive information before writing:
  - API keys (`sk-synth-*` → `sk-synth-***`)
  - OTP / verification codes → `[REDACTED]`
  - Private keys or seed phrases → `[REDACTED]`
  - Temporary tokens (transfer tokens, pending IDs) → `[REDACTED]`
- Public blockchain data (tx hashes, wallet addresses, contract addresses) may be kept as they are already public
- Keep UUIDs for project/team if relevant for context
- The log is intended to be submitted to hackathon judges as evidence of human-agent collaboration

## Project Context

This is **FairSharing for AI** — an on-chain contribution tracking and incentive distribution system for AI Agents.

- Hackathon: [Synthesis](https://synthesis.md) (deadline: March 22, 2026)
- Repo: https://github.com/brucexu-eth/fairsharing-for-ai
- Stack: Solidity (Hardhat) + Next.js + wagmi/viem + Base network
- See `prd.md` for full product spec
