"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortAddr } from "@/lib/format";

export function ConnectButtonClient() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">
          {shortAddr(address)}
        </span>
        <button onClick={() => disconnect()} className="btn-secondary text-xs px-3 py-1">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: connectors[0] })}
      className="btn-primary"
    >
      Connect Wallet
    </button>
  );
}
