import { Link } from "wouter";
import type { Collection } from "../lib/chain";
import { useEngine, useFriend } from "../lib/hooks";
import { player, type Queue } from "../lib/player";
import { useSimRf } from "../lib/store";
import { computeVibeScore } from "../lib/music";
import { cn } from "../lib/utils";
import { PixelArt, Tag } from "./kit";
import { Heart, LikeChip, useLiked } from "./like";

export function FriendTile({
  collection,
  tokenId,
  queue,
  compact,
}: {
  collection: Collection;
  tokenId: string;
  queue?: Queue | null;
  compact?: boolean;
}) {
  const { friend, comp, isLoading, isError } = useFriend(collection, tokenId);
  const { status, comp: liveComp } = useEngine();
  const { favourites } = useSimRf();

  const key = `${collection}:${tokenId}`;
  const isLive = status !== "idle" && liveComp?.key === key;
  const fav = favourites.includes(key);
  const liked = useLiked(key);

  if (isLoading) {
    return (
      <div className="panel flex aspect-square animate-pulse items-center justify-center">
        <span className="micro text-ink-dim/40">#{tokenId}</span>
      </div>
    );
  }

  if (isError || !friend || !comp) {
    return (
      <div className="panel flex aspect-square flex-col items-center justify-center gap-1 opacity-50">
        <span className="micro">#{tokenId}</span>
        <span className="data text-[9px] text-ink-dim">not minted</span>
      </div>
    );
  }

  const vibe = computeVibeScore(comp);

  return (
    <div
      className={cn(
        "panel group relative overflow-hidden transition-colors",
        isLive ? "border-teal/60" : "hover:border-ink-dim/40",
      )}
    >
      <Link href={`/f/${collection}/${tokenId}`} className="block">
        <div className="relative">
          <PixelArt
            src={friend.imageDataUri}
            alt={friend.name}
            className="aspect-square w-full rounded-none border-0"
          />
          {isLive && (
            <span className="absolute top-2 left-2 flex items-center gap-1 rounded-[3px] border border-teal/50 bg-bg/80 px-1.5 py-0.5">
              <i className="ft-pulse block size-1.5 rounded-full bg-teal" />
              <span className="data text-[9px] tracking-[0.1em] text-teal uppercase">live</span>
            </span>
          )}
          {fav && (
            <span className="absolute top-2 right-2 text-orange" title="Saved to your shelf">
              <svg width="11" height="12" viewBox="0 0 12 14" fill="currentColor">
                <path d="M2 1h8v12l-4-3.2L2 13z" />
              </svg>
            </span>
          )}
          {liked && (
            <span className="absolute bottom-2 right-2 text-pink" title="You liked this">
              <Heart filled size={11} />
            </span>
          )}
        </div>
      </Link>

      <div className="flex items-center gap-2 border-t border-line px-2.5 py-2">
        <button
          onClick={() => (isLive ? player.stop() : void player.start(friend, comp, { queue }))}
          className={cn(
            "press flex size-7 shrink-0 items-center justify-center rounded-[3px] border",
            isLive
              ? "border-teal/50 bg-teal/16 text-teal"
              : "border-line bg-panel-2 text-ink-dim group-hover:text-teal",
          )}
          title={isLive ? "Stop" : "Play"}
        >
          {isLive ? (
            <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
              <rect width="10" height="10" />
            </svg>
          ) : (
            <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
              <path d="M2 0v10l7-5z" />
            </svg>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="data truncate text-[11px] text-ink">#{tokenId}</div>
          {!compact && (
            <div className="data truncate text-[9px] text-ink-dim">
              {comp.rootName} {comp.scaleName} · {comp.bpm}
            </div>
          )}
        </div>
        {!compact && (
          <>
            <span className="data shrink-0 text-[10px] text-teal/70" title="Vibe Score">
              {vibe.total}
            </span>
            <LikeChip
              friendKey={key}
              meta={{
                name: friend.name,
                generation: friend.generation,
                tier: friend.tier,
              }}
            />
          </>
        )}
      </div>

      {(friend.state || friend.lineage) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[38px] flex gap-1 px-2 pb-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          {friend.lineage && <Tag tone="orange">{friend.lineage}</Tag>}
          {friend.character && <Tag tone="teal">{friend.character}</Tag>}
          {friend.state === "Temporary" && <Tag tone="violet">temp</Tag>}
        </div>
      )}
    </div>
  );
}
