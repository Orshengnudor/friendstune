import { useMyLikes, useToggleLike, type FriendMeta } from "../queries/charts";
import { cn } from "../lib/utils";

/**
 * LIKE is public and counts toward the charts. SAVE is private and only fills
 * your own shelf on My Friends. They are deliberately two different things.
 */

export function Heart({ filled, size = 14 }: { filled: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.8 5.6a5.4 5.4 0 0 0-7.6 0L12 6.8l-1.2-1.2a5.4 5.4 0 1 0-7.6 7.6l8.8 8.8 8.8-8.8a5.4 5.4 0 0 0 0-7.6z" />
    </svg>
  );
}

/** True when this listener has already liked that Friend. */
export function useLiked(friendKey: string) {
  const likes = useMyLikes();
  return (likes.data ?? []).includes(friendKey);
}

export function LikeButton({
  friendKey,
  meta,
  count,
  size = "md",
  className,
}: {
  friendKey: string;
  meta?: FriendMeta;
  count?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const liked = useLiked(friendKey);
  const toggle = useToggleLike();

  const sizes = {
    sm: "h-7 px-2 text-[10px]",
    md: "h-9 px-3 text-[11px]",
    lg: "h-11 px-4 text-xs",
  } as const;
  const hearts = { sm: 11, md: 13, lg: 15 } as const;

  return (
    <button
      type="button"
      title={liked ? "Unlike" : "Like, this counts on the leaderboard"}
      disabled={toggle.isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate({ key: friendKey, on: !liked, meta });
      }}
      className={cn(
        "press inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[4px] border font-mono font-medium tracking-[0.1em] uppercase disabled:opacity-50",
        liked
          ? "border-pink/45 bg-pink/12 text-pink hover:bg-pink/20"
          : "border-line bg-panel-2 text-ink-dim hover:border-pink/40 hover:text-pink",
        sizes[size],
        className,
      )}
    >
      <Heart filled={liked} size={hearts[size]} />
      {typeof count === "number" ? <span>{count}</span> : <span>{liked ? "liked" : "like"}</span>}
    </button>
  );
}

/** Icon-only heart for artwork overlays and dense grids. */
export function LikeChip({ friendKey, meta }: { friendKey: string; meta?: FriendMeta }) {
  const liked = useLiked(friendKey);
  const toggle = useToggleLike();
  return (
    <button
      type="button"
      title={liked ? "Unlike" : "Like"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate({ key: friendKey, on: !liked, meta });
      }}
      className={cn(
        "press flex size-7 shrink-0 items-center justify-center rounded-[3px] border",
        liked
          ? "border-pink/50 bg-pink/16 text-pink"
          : "border-line bg-panel-2 text-ink-dim hover:text-pink",
      )}
    >
      <Heart filled={liked} size={12} />
    </button>
  );
}
