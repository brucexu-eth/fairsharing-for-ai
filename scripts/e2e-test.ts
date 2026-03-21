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
  { inputs: [{ type: "string", name: "name" }], name: "createProject", outputs: [{ type: "address" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "getProjects", outputs: [{ components: [{ type: "address", name: "projectAddress" }, { type: "address", name: "creator" }, { type: "string", name: "name" }, { type: "uint256", name: "createdAt" }], type: "tuple[]" }], stateMutability: "view", type: "function" },
] as const;
const FS_ABI = [
  { inputs: [{ type: "address" }], name: "addAgent", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ type: "string" }, { type: "string" }, { type: "string" }, { type: "bytes32" }, { type: "uint256" }], name: "submitProposal", outputs: [{ type: "uint256" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ type: "uint256" }, { type: "bool" }], name: "vote", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ type: "uint256" }], name: "executeProposal", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "rewardToken", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "uint256" }], name: "getProposal", outputs: [{ type: "uint256" }, { type: "address" }, { type: "string" }, { type: "string" }, { type: "string" }, { type: "bytes32" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint8" }, { type: "uint256" }], stateMutability: "view", type: "function" },
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

// 1. Create project
process.stdout.write("1. Create project... ");
let h = await owner.writeContract({ address: factoryAddress, abi: FACTORY_ABI, functionName: "createProject", args: ["E2E Test Project"] });
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

// 3. Submit fair proposal
process.stdout.write("3. Alpha: submit fair proposal (1000 FSR)... ");
h = await alpha.writeContract({ address: project, abi: FS_ABI, functionName: "submitProposal", args: ["Built REST API", "Full REST API implementation with tests", "https://github.com/example/pr/1", keccak256(toBytes("pr1")), parseUnits("1000", 18)] });
await wait(h);
console.log("submitted as #0");

// 4. Submit overpriced proposal
process.stdout.write("4. Beta: submit overpriced proposal (5000 FSR)... ");
h = await beta.writeContract({ address: project, abi: FS_ABI, functionName: "submitProposal", args: ["Wrote README", "Added README", "https://github.com/example/readme", keccak256(toBytes("readme")), parseUnits("5000", 18)] });
await wait(h);
console.log("submitted as #1");

// 5. Vote on proposals
console.log("5. Voting...");
h = await beta.writeContract({ address: project, abi: FS_ABI, functionName: "vote", args: [0n, true] }); await wait(h);
h = await gamma.writeContract({ address: project, abi: FS_ABI, functionName: "vote", args: [0n, true] }); await wait(h);
h = await alpha.writeContract({ address: project, abi: FS_ABI, functionName: "vote", args: [1n, false] }); await wait(h);
h = await gamma.writeContract({ address: project, abi: FS_ABI, functionName: "vote", args: [1n, false] }); await wait(h);

// 6. Verify proposal states
const p0 = await pub.readContract({ address: project, abi: FS_ABI, functionName: "getProposal", args: [0n] });
const p1 = await pub.readContract({ address: project, abi: FS_ABI, functionName: "getProposal", args: [1n] });
const S = ["Pending", "Passed", "Rejected", "Executed"] as const;
console.log("  Proposal #0 status:", S[p0[9]]);
console.log("  Proposal #1 status:", S[p1[9]]);
assert(p0[9] === 1, "Proposal #0 should be Passed");
assert(p1[9] === 2, "Proposal #1 should be Rejected");

// 7. Execute passed proposal
process.stdout.write("6. Execute proposal #0 (mint 1000 FSR to Alpha)... ");
h = await owner.writeContract({ address: project, abi: FS_ABI, functionName: "executeProposal", args: [0n] });
await wait(h);
console.log("done");

// 8. Verify balance
const tokenAddr = await pub.readContract({ address: project, abi: FS_ABI, functionName: "rewardToken" }) as `0x${string}`;
const balance = await pub.readContract({ address: tokenAddr, abi: ERC20_ABI, functionName: "balanceOf", args: [alpha.account.address] });
const formattedBalance = formatUnits(balance, 18);
console.log("  Alpha balance:", formattedBalance, "FSR");
assert(balance === parseUnits("1000", 18), `Alpha should have 1000 FSR, got ${formattedBalance}`);

// 9. Verify executed state
const p0Final = await pub.readContract({ address: project, abi: FS_ABI, functionName: "getProposal", args: [0n] });
assert(p0Final[9] === 3, "Proposal #0 should be Executed");

console.log("\n✅ All tests passed! Full demo flow works end-to-end.");
console.log("\nTo view in the browser:");
console.log("  1. Start frontend: cd apps/web && bun dev");
console.log("  2. Import hardhat account #0 into MetaMask (pk: 0xac0974...)");
console.log("  3. Visit http://localhost:3000");
console.log("  4. Go to /demo and set project address:", project);
