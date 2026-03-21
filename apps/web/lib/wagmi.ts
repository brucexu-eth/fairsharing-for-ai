import { createConfig, http } from "wagmi";
import { baseSepolia, hardhat } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [hardhat, baseSepolia],
  connectors: [injected()],
  transports: {
    [hardhat.id]: http("http://127.0.0.1:8545"),
    [baseSepolia.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
