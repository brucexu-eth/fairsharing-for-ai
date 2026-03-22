import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Factory = await ethers.getContractFactory("FSProjectFactory");
  // ERC-8004 Identity Registry — only on Base Mainnet. Use address(0) on testnets.
  const ERC8004_MAINNET = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
  const network = await ethers.provider.getNetwork();
  const isMainnet = network.chainId === 8453n;
  const registry = process.env.ERC8004_REGISTRY ?? (isMainnet ? ERC8004_MAINNET : ethers.ZeroAddress);
  console.log("ERC-8004 Registry:", registry, isMainnet ? "(mainnet)" : "(testnet — skipped)");
  const factory = await Factory.deploy(registry);
  await factory.waitForDeployment();

  const addr = await factory.getAddress();
  console.log("FSProjectFactory deployed to:", addr);
  console.log("");
  console.log("Add this to apps/web/.env.local:");
  console.log(`NEXT_PUBLIC_FACTORY_ADDRESS=${addr}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
