import { useMemo, useState } from "react";
import { useConnection } from "wagmi";
import { PageHead, Shell } from "../components/shell";
import { Btn, Empty, Panel, SimBadge, Spinner, Stat, Tag } from "../components/kit";
import { FriendTile } from "../components/friend-tile";
import { WalletButton } from "../components/wallet-button";
import { useOwned } from "../lib/hooks";
import { player } from "../lib/player";
import { fetchFriend } from "../lib/friends";
import { deriveComposition } from "../lib/music";
import {
  SIM_RF_GRANT,
  computeBadges,
  formatRf,
  store,
  useStore,
} from "../lib/store";
import { COLLECTION_LABEL, EXPLORER, shortAddress, type Collection } from "../lib/chain";
import { cn } from "../lib/utils";

type Shelf = "owned" | "favourites" | "history";

const parseKey = (key: string) => {
  const [collection, tokenId] = key.split(":");
  return { collection: collection as Collection, tokenId: tokenId ?? "" };
};

const when = (ts: number) => {
  const mins = Math.round((Date.now() - ts) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

const LEDGER_TONE: Record<string, "teal" | "amber" | "orange" | "violet" | "dim"> = {
  grant: "amber",
  refill: "amber",
  tip: "orange",
  unlock: "violet",
};

export default function Mine() {
  const { address, isConnected } = useConnection();
  const { data } = useStore();
  const [shelf, setShelf] = useState<Shelf>("owned");
  const owned = useOwned(address);

  const badges = useMemo(() => computeBadges(data), [data]);
  const earned = badges.filter((b) => b.earned).length;

  const ownedKeys = useMemo(() => {
    const g = (owned.data?.genesis ?? []).map((id) => `genesis:${id}`);
    const n = (owned.data?.generations ?? []).map((id) => `generations:${id}`);
    return [...g, ...n];
  }, [owned.data]);

  const keys =
    shelf === "owned" ? ownedKeys : shelf === "favourites" ? data.favourites : data.history;

  const tipTotal = Object.values(data.tips).reduce((a, b) => a + b, 0);
  const playTotal = Object.values(data.plays).reduce((a, b) => a + b, 0);

  /** Queue the current shelf so the deck can walk it. */
  const playShelf = async () => {
    if (keys.length === 0) return;
    let i = 0;
    const jump = async (step: number) => {
      i = (i + step + keys.length) % keys.length;
      await go();
    };
    const go = async () => {
      const { collection, tokenId } = parseKey(keys[i]);
      try {
        const friend = await fetchFriend(collection, tokenId);
        await player.start(friend, deriveComposition(friend), {
          queue: {
            label: `${SHELVES.find((s) => s.id === shelf)?.label} · ${i + 1}/${keys.length}`,
            next: () => void jump(1),
            prev: () => void jump(-1),
          },
          onFinish: () => void jump(1),
        });
      } catch {
        /* token vanished from chain, skip on */
        if (keys.length > 1) void jump(1);
      }
    };
    await go();
  };

  return (
    <Shell>
      <PageHead
        eyebrow="My Friends"
        title={isConnected ? "Your shelf" : "Bring your wallet, or don't"}
        right={
          keys.length > 0 ? (
            <Btn variant="primary" onClick={() => void playShelf()}>
              play this shelf
            </Btn>
          ) : undefined
        }
      >
        {isConnected ? (
          <>
            Read straight off chain from every <span className="data text-ink">Transfer</span> that
            ever landed on{" "}
            <a
              href={`${EXPLORER}/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="data text-teal hover:underline"
            >
              {shortAddress(address)}
            </a>
            , then re-checked against <span className="data text-ink">ownerOf</span>. Connecting is
            read-only. Friendstune never asks you to sign anything.
          </>
        ) : (
          <>
            Everything on Friendstune plays without a wallet. Connect one only if you want your own
            Friends on a shelf. It is a read-only connection, no signature, no transaction, ever.
          </>
        )}
      </PageHead>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <Panel
            bodyClass="p-0"
            title="shelf"
            right={
              <div className="flex items-center gap-1">
                {SHELVES.map((s) => {
                  const count =
                    s.id === "owned"
                      ? ownedKeys.length
                      : s.id === "favourites"
                        ? data.favourites.length
                        : data.history.length;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setShelf(s.id)}
                      className={cn(
                        "data press rounded-[3px] border px-2 py-1 text-[10px] tracking-[0.1em] uppercase",
                        shelf === s.id
                          ? "border-teal/40 bg-teal/10 text-teal"
                          : "border-line bg-panel-2 text-ink-dim hover:text-ink",
                      )}
                    >
                      {s.label}
                      <span className="ml-1 opacity-60">{count}</span>
                    </button>
                  );
                })}
              </div>
            }
          >
            {shelf === "owned" && !isConnected ? (
              <Empty
                title="No wallet connected"
                detail="Connect a wallet to see the Friends you hold. Or head to Explore and listen to the whole population without one."
                action={<WalletButton />}
              />
            ) : shelf === "owned" && owned.isLoading ? (
              <Spinner label="scanning transfer logs" />
            ) : shelf === "owned" && owned.isError ? (
              <Empty
                title="Log scan failed"
                detail="The RPC refused the transfer-log range."
                action={<Btn onClick={() => void owned.refetch()}>retry</Btn>}
              />
            ) : keys.length === 0 ? (
              <Empty
                title={
                  shelf === "owned"
                    ? "No Rare Friends here yet"
                    : shelf === "favourites"
                      ? "Nothing saved yet"
                      : "Nothing played yet"
                }
                detail={
                  shelf === "owned"
                    ? "This wallet holds no Genesis or Generations tokens. Every Friend is still yours to listen to."
                    : shelf === "favourites"
                      ? "Tap the heart on any Friend page to keep it here."
                      : "Play something and it shows up here."
                }
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-4">
                {keys.slice(0, 48).map((key) => {
                  const { collection, tokenId } = parseKey(key);
                  return <FriendTile key={key} collection={collection} tokenId={tokenId} />;
                })}
              </div>
            )}
          </Panel>

          {shelf === "owned" && isConnected && owned.data && (
            <Panel title="holdings breakdown">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat
                  label={COLLECTION_LABEL.genesis}
                  value={owned.data.genesis.length}
                  sub="8×8 originals"
                  tone="orange"
                />
                <Stat
                  label={COLLECTION_LABEL.generations}
                  value={owned.data.generations.length}
                  sub="16×16 population"
                  tone="teal"
                />
                <Stat label="Tunes on shelf" value={ownedKeys.length} sub="one per token" />
                <Stat label="Plays logged" value={playTotal} sub="this browser" />
              </div>
            </Panel>
          )}

          <Panel
            title="simulated RF ledger"
            right={<span className="data text-[10px] text-ink-dim">{data.ledger.length} entries</span>}
            bodyClass="p-0"
          >
            {data.ledger.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-ink-dim">Nothing logged yet.</div>
            ) : (
              <ul>
                {data.ledger.slice(0, 14).map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-3 border-b border-line/60 px-4 py-2.5 last:border-0"
                  >
                    <Tag tone={LEDGER_TONE[e.kind] ?? "dim"}>{e.kind}</Tag>
                    <span className="min-w-0 flex-1 truncate text-xs text-ink-dim">{e.label}</span>
                    <span className="data shrink-0 text-[10px] text-ink-dim/70">{when(e.ts)}</span>
                    <span
                      className={cn(
                        "data w-20 shrink-0 text-right text-[11px]",
                        e.kind === "grant" || e.kind === "refill" ? "text-amber" : "text-orange",
                      )}
                    >
                      {e.kind === "grant" || e.kind === "refill" ? "+" : "−"}
                      {formatRf(e.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="simulated wallet" right={<SimBadge />}>
            <div className="data text-[34px] leading-none text-amber">{formatRf(data.balance)}</div>
            <div className="micro mt-2">simulated RF · this browser only</div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-dim">
              Friendstune never touches the real <span className="data">$RAREFRIENDS</span> token.
              Nothing is burned, transferred or approved. This balance lives in localStorage purely
              so tipping and the Remix Studio are safe to play with.
            </p>
            <Btn variant="warm" className="mt-4 w-full" onClick={() => store.refill()}>
              refill +{formatRf(SIM_RF_GRANT)}
            </Btn>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
              <Stat label="Tipped out" value={formatRf(tipTotal)} sub={`${Object.keys(data.tips).length} friends`} tone="orange" />
              <Stat label="Studios" value={data.unlocked.length} sub="unlocked" tone="violet" />
            </div>
          </Panel>

          <Panel
            title="badges"
            right={
              <span className="data text-[10px] text-teal">
                {earned}/{badges.length}
              </span>
            }
            bodyClass="p-0"
          >
            <ul>
              {badges.map((b) => (
                <li
                  key={b.id}
                  className={cn(
                    "flex items-center gap-3 border-b border-line/60 px-4 py-2.5 last:border-0",
                    !b.earned && "opacity-45",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-[3px] border",
                      b.earned ? "border-teal/45 bg-teal/12 text-teal" : "border-line text-ink-dim",
                    )}
                  >
                    {b.earned ? (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2.5 6.5 5 9l4.5-6" />
                      </svg>
                    ) : (
                      <i className="block size-1.5 rounded-full bg-current" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="data text-[11px] text-ink">{b.label}</div>
                    <div className="text-[10px] text-ink-dim">{b.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="streak">
            <div className="flex items-end gap-3">
              <span className="data text-[34px] leading-none text-teal">{data.streak.days}</span>
              <span className="micro pb-1.5">
                day{data.streak.days === 1 ? "" : "s"} in a row
              </span>
            </div>
            <div className="mt-3 flex gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <i
                  key={i}
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    i < Math.min(data.streak.days, 7) ? "bg-teal" : "bg-panel-2",
                  )}
                />
              ))}
            </div>
            <p className="mt-3 text-[11px] text-ink-dim">
              Come back tomorrow and it keeps counting. Kept locally, per identity.
            </p>
          </Panel>
        </aside>
      </div>
    </Shell>
  );
}

const SHELVES: { id: Shelf; label: string }[] = [
  { id: "owned", label: "Owned" },
  { id: "favourites", label: "Saved" },
  { id: "history", label: "Recent" },
];
