import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const FSProjectFactoryModule = buildModule("FSProjectFactoryModule", (m) => {
  // Set ERC-8004 registry address via parameter. Defaults to zero address (skip checks) for local dev.
  const erc8004Registry = m.getParameter(
    "erc8004Registry",
    "0x0000000000000000000000000000000000000000"
  );

  const factory = m.contract("FSProjectFactory", [erc8004Registry]);

  return { factory };
});

export default FSProjectFactoryModule;
