import { useState } from "react";
import { useConnect, useConnection, useDisconnect } from "wagmi";
import { Btn } from "./kit";
import { shortAddress } from "../lib/chain";

/**
 * Optional wallet. Listening never needs one. Connecting only labels the local
 * simulated-RF ledger and unlocks /mine. No signing, no transactions, ever.
 */
export function WalletButton() {
  const { address, isConnected, isConnecting } = useConnection();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);

  if (isConnected && address) {
    return (
      <Btn variant="primary" size="sm" onClick={() => disconnect()} title="Disconnect wallet">
        <span className="size-1.5 rounded-full bg-teal" />
        {shortAddress(address)}
      </Btn>
    );
  }

  const injectedConnectors = connectors.filter((c) => c.type === "injected" || c.id === "injected");
  const list = injectedConnectors.length ? injectedConnectors : connectors;

  return (
    <div className="relative">
      <Btn
        size="sm"
        onClick={() => {
          if (list.length === 1) connect({ connector: list[0] });
          else setOpen((v) => !v);
        }}
        disabled={isConnecting || isPending}
      >
        {isConnecting || isPending ? "connecting…" : "connect"}
      </Btn>
      {open && list.length > 1 && (
        <div className="panel absolute right-0 z-50 mt-2 w-52 p-1.5">
          {list.map((c) => (
            <button
              key={c.uid}
              onClick={() => {
                connect({ connector: c });
                setOpen(false);
              }}
              className="data block w-full px-2.5 py-2 text-left text-[11px] text-ink-dim hover:bg-panel-2 hover:text-ink"
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      {error && !open && (
        <div className="panel absolute right-0 z-50 mt-2 w-60 p-2.5 text-[10px] text-orange">
          {error.message.slice(0, 140)}
        </div>
      )}
    </div>
  );
}
