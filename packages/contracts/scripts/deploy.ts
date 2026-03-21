import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Factory = await ethers.getContractFactory("FSProjectFactory");
  // address(0) = skip ERC-8004 verification for local dev
  const factory = await Factory.deploy("0x0000000000000000000000000000000000000000");
  await factory.waitForDeployment();

  const addr = await factory.getAddress();
  console.log("FSProjectFactory deployed to:", addr);
  console.log("");
  console.log("Add this to apps/web/.env.local:");
  console.log(`NEXT_PUBLIC_FACTORY_ADDRESS=${addr}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
