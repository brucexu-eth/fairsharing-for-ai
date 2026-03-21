/**
 * End-to-end integration test
 * Tests the full: create project → add agents → submit → vote → execute → verify balance flow
 * Run: bun scripts/e2e-test.ts
 */
import { createPublicClient, createWalletClient, http, parseUnits, keccak256, toBytes, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";

const rpc = process.env.E2E_RPC_URL ?? "http://127.0.0.1:8545";
const factoryAddress = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? "0x5FbDB2315678afecb367f032d93F642f64180aa3") as `0x${string}`;

const FACTORY_ABI = [
  { inputs: [{ type: "string", name: "name" }, { type: "string", name: "tokenName" }, { type: "string", name: "tokenSymbol" }], name: "createProject", outputs: [{ type: "address" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "getProjects", outputs: [{ components: [{ type: "address", name: "projectAddress" }, { type: "address", name: "creator" }, { type: "string", name: "name" }, { type: "uint256", name: "createdAt" }], type: "tuple[]" }], stateMutability: "view", type: "function" },
] as const;
const FS_ABI = [
  { inputs: [{ type: "address" }], name: "addAgent", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ type: "string" }, { type: "string" }, { type: "string" }, { type: "bytes32" }, { type: "uint256" }, { type: "address" }], name: "submitProposal", outputs: [{ type: "uint256" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ type: "uint256" }, { type: "bool" }], name: "vote", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ type: "uint256" }], name: "executeProposal", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "rewardToken", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  // [id, proposer, beneficiary, proofHash, requestedReward, yesVotes, noVotes, status, createdAt]
  { inputs: [{ type: "uint256" }], name: "getProposal", outputs: [{ type: "uint256" }, { type: "address" }, { type: "address" }, { type: "bytes32" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint8" }, { type: "uint256" }], stateMutability: "view", type: "function" },
] as const;
const ERC20_ABI = [
  { inputs: [{ type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

const pub = createPublicClient({ chain: hardhat, transport: http(rpc) });
const wc = (key: `0x${string}`) =>
  createWalletClient({ account: privateKeyToAccount(key), chain: hardhat, transport: http(rpc) });

const owner = wc("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const alpha = wc("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const beta  = wc("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
const gamma = wc("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");

const wait = (h: `0x${string}`) => pub.waitForTransactionReceipt({ hash: h });

function assert(cond: boolean, msg: string) {
  if (!cond) { console.error("FAIL:", msg); process.exit(1); }
  console.log("  ✓", msg);
}

console.log("\n=== FairSharing AI — E2E Integration Test ===\n");
console.log("Factory:", factoryAddress, "\n");

// 1. Create project (with custom token name/symbol)
process.stdout.write("1. Create project... ");
let h = await owner.writeContract({ address: factoryAddress, abi: FACTORY_ABI, functionName: "createProject", args: ["E2E Test Project", "E2E Reward Token", "E2E"] });
await wait(h);
const projects = await pub.readContract({ address: factoryAddress, abi: FACTORY_ABI, functionName: "getProjects" });
const project = projects[projects.length - 1].projectAddress as `0x${string}`;
console.log("deployed to", project);

// 2. Add agents
process.stdout.write("2. Add 3 agents... ");
for (const addr of [alpha.account.address, beta.account.address, gamma.account.address]) {
  h = await owner.writeContract({ address: project, abi: FS_ABI, functionName: "addAgent", args: [addr] });
  await wait(h);
}
console.log("done");

// 3. Submit fair proposal (beneficiary = address(0) → defaults to proposer)
process.stdout.write("3. Alpha: submit fair proposal (1000 tokens)... ");
h = await alpha.writeContract({ address: project, abi: FS_ABI, functionName: "submitProposal", args: ["Built REST API", "Full REST API implementation with tests", "https://github.com/example/pr/1", keccak256(toBytes("pr1")), parseUnits("1000", 18), "0x0000000000000000000000000000000000000000"] });
await wait(h);
console.log("submitted as #0");

// 4. Submit overpriced proposal
process.stdout.write("4. Beta: submit overpriced proposal (5000 tokens)... ");
h = await beta.writeContract({ address: project, abi: FS_ABI, functionName: "submitProposal", args: ["Wrote README", "Added README", "https://github.com/example/readme", keccak256(toBytes("readme")), parseUnits("5000", 18), "0x0000000000000000000000000000000000000000"] });
await wait(h);
console.log("submitted as #1");

// 5. Submit proposal with explicit beneficiary (gamma submits, alpha receives)
process.stdout.write("5. Gamma: submit proposal with Alpha as beneficiary (500 tokens)... ");
h = await gamma.writeContract({ address: project, abi: FS_ABI, functionName: "submitProposal", args: ["Delegated Work", "Work done by gamma, reward goes to alpha", "https://github.com/example/pr/3", keccak256(toBytes("delegated")), parseUnits("500", 18), alpha.account.address] });
await wait(h);
console.log("submitted as #2");

// 6. Vote on proposals
console.log("6. Voting...");
h = await beta.writeContract({ address: project, abi: FS_ABI, functionName: "vote", args: [0n, true] }); await wait(h);
h = await gamma.writeContract({ address: project, abi: FS_ABI, functionName: "vote", args: [0n, true] }); await wait(h);
h = await alpha.writeContract({ address: project, abi: FS_ABI, functionName: "vote", args: [1n, false] }); await wait(h);
h = await gamma.writeContract({ address: project, abi: FS_ABI, functionName: "vote", args: [1n, false] }); await wait(h);
h = await alpha.writeContract({ address: project, abi: FS_ABI, functionName: "vote", args: [2n, true] }); await wait(h);
h = await beta.writeContract({ address: project, abi: FS_ABI, functionName: "vote", args: [2n, true] }); await wait(h);

// 7. Verify proposal states
const p0 = await pub.readContract({ address: project, abi: FS_ABI, functionName: "getProposal", args: [0n] });
const p1 = await pub.readContract({ address: project, abi: FS_ABI, functionName: "getProposal", args: [1n] });
const p2 = await pub.readContract({ address: project, abi: FS_ABI, functionName: "getProposal", args: [2n] });
const S = ["Pending", "Passed", "Rejected", "Executed"] as const;
console.log("  Proposal #0 status:", S[p0[7]]);
console.log("  Proposal #1 status:", S[p1[7]]);
console.log("  Proposal #2 status:", S[p2[7]]);
assert(p0[7] === 1, "Proposal #0 should be Passed");
assert(p1[7] === 2, "Proposal #1 should be Rejected");
assert(p2[7] === 1, "Proposal #2 should be Passed");
assert(p2[2] === alpha.account.address, "Proposal #2 beneficiary should be Alpha");

// 8. Execute passed proposals
process.stdout.write("7. Execute proposal #0 (mint 1000 to Alpha)... ");
h = await owner.writeContract({ address: project, abi: FS_ABI, functionName: "executeProposal", args: [0n] });
await wait(h);
console.log("done");

process.stdout.write("8. Execute proposal #2 (mint 500 to Alpha via Gamma's beneficiary)... ");
h = await owner.writeContract({ address: project, abi: FS_ABI, functionName: "executeProposal", args: [2n] });
await wait(h);
console.log("done");

// 9. Verify balances
const tokenAddr = await pub.readContract({ address: project, abi: FS_ABI, functionName: "rewardToken" }) as `0x${string}`;
const alphaBalance = await pub.readContract({ address: tokenAddr, abi: ERC20_ABI, functionName: "balanceOf", args: [alpha.account.address] });
const gammaBalance = await pub.readContract({ address: tokenAddr, abi: ERC20_ABI, functionName: "balanceOf", args: [gamma.account.address] });
const formattedAlpha = formatUnits(alphaBalance, 18);
const formattedGamma = formatUnits(gammaBalance, 18);
console.log("  Alpha balance:", formattedAlpha, "E2E");
console.log("  Gamma balance:", formattedGamma, "E2E");
assert(alphaBalance === parseUnits("1500", 18), `Alpha should have 1500 (1000+500), got ${formattedAlpha}`);
assert(gammaBalance === 0n, `Gamma should have 0 (submitted on behalf of alpha), got ${formattedGamma}`);

// 10. Verify executed states
const p0Final = await pub.readContract({ address: project, abi: FS_ABI, functionName: "getProposal", args: [0n] });
const p2Final = await pub.readContract({ address: project, abi: FS_ABI, functionName: "getProposal", args: [2n] });
assert(p0Final[7] === 3, "Proposal #0 should be Executed");
assert(p2Final[7] === 3, "Proposal #2 should be Executed");

console.log("\n✅ All tests passed! Full demo flow works end-to-end.");
console.log("\nTo view in the browser:");
console.log("  1. Start frontend: cd apps/web && bun dev");
console.log("  2. Import hardhat account #0 into MetaMask (pk: 0xac0974...)");
console.log("  3. Visit http://localhost:3000");
console.log("  4. Go to /demo and set project address:", project);
