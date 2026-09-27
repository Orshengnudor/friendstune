import { useState } from "react";
import { Link } from "wouter";
import { PageHead, Shell } from "../components/shell";
import { Empty, Panel, PixelArt, SimBadge, Spinner, Stat, Tag } from "../components/kit";
import { LikeChip } from "../components/like";
import { useChartTop, useChartTotals, type ChartScope, type ChartSort } from "../queries/charts";
import { useEngine, useFriend } from "../lib/hooks";
import { player } from "../lib/player";
import { COLLECTION_LABEL, type Collection } from "../lib/chain";
import { formatRf } from "../lib/store";
import { cn } from "../lib/utils";

/**
 * THE CHARTS
 * Every listener's likes, plays, saves, downloads and simulated RF land in one
 * shared table, so the only honest question about this project can finally be
 * answered: can a Generations tune out-chart a Genesis one.
 */

const SORTS: { id: ChartSort; label: string; detail: string; emptyTitle: string; empty: string }[] = [
  {
    id: "likes",
    label: "most liked",
    detail: "hearts from every listener",
    emptyTitle: "No likes yet",
    empty: "No Friend has been liked yet. Hit the heart on any Friend and it lands here for everyone.",
  },
  {
    id: "plays",
    label: "most played",
    detail: "tunes actually started",
    emptyTitle: "No plays yet",
    empty: "No tune has been played yet. Press play on any Friend and this fills up.",
  },
  {
    id: "downloads",
    label: "most downloaded",
    detail: "wav files taken away",
    emptyTitle: "No downloads yet",
    empty:
      "No wav has left the building yet. Downloads are free if you hold the Friend, otherwise the price goes to that Friend in simulated RF.",
  },
  {
    id: "earned",
    label: "most RF earned",
    detail: "tips + tune sales, simulated",
    emptyTitle: "No simulated RF earned yet",
    empty:
      "No Friend has earned simulated RF yet. Tips and paid tune downloads both credit the Friend, and this column is where it shows up.",
  },
  {
    id: "saves",
    label: "most saved",
    detail: "added to a private shelf",
    emptyTitle: "No saves yet",
    empty: "No Friend has been saved yet. Save one and it goes to your shelf under My Friends.",
  },
];

const SCOPES: { id: ChartScope; label: string }[] = [
  { id: "all", label: "both collections" },
  { id: "genesis", label: "Genesis only" },
  { id: "generations", label: "Generations only" },
];

type Row = {
  key: string;
  collection: string;
  tokenId: number;
  name: string | null;
  generation: number | null;
  tier: number | null;
  likes: number;
  plays: number;
  saves: number;
  downloads: number;
  earnedRf: number;
};

const valueOf = (row: Row, sort: ChartSort) =>
  sort === "earned" ? row.earnedRf : (row[sort] as number);

export default function Leaderboard() {
  const [sort, setSort] = useState<ChartSort>("likes");
  const [scope, setScope] = useState<ChartScope>("all");
  const chart = useChartTop(sort, scope, 50);
  const totals = useChartTotals();

  const rows = (chart.data ?? []) as Row[];
  const genesis = (totals.data ?? []).find((t) => t.collection === "genesis");
  const generations = (totals.data ?? []).find((t) => t.collection === "generations");

  return (
    <Shell>
      <PageHead
        eyebrow="shared charts · every listener counts once"
        title="Which Friend is charting?"
        right={<SimBadge />}
      >
        Likes, plays, downloads and simulated RF from everyone who has opened Friendstune, in one
        table. Filter it by collection to settle the argument: a 16×16 Generations bitmap has four
        times the notes of a Genesis 8×8, so it should be able to out-chart it.
      </PageHead>

      {/* head to head */}
      <div className="ft-rise mb-4 grid gap-3 sm:grid-cols-2">
        <SideCard
          label="Genesis"
          tone="orange"
          totals={genesis}
          loading={totals.isLoading}
        />
        <SideCard
          label="Generations"
          tone="teal"
          totals={generations}
          loading={totals.isLoading}
        />
      </div>

      {/* controls */}
      {/* the two rows stay stacked at every width: five sort tabs and three
          scope pills never fit side by side without one of them clipping */}
      <div className="ft-rise mb-4 flex flex-col gap-2">
        <div className="no-scrollbar -mx-1 flex min-w-0 gap-2 overflow-x-auto px-1">
          {SORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              title={s.detail}
              className={cn(
                "press shrink-0 rounded-[4px] border px-3 py-2 text-left",
                sort === s.id
                  ? "border-teal/45 bg-teal/10"
                  : "border-line bg-panel hover:border-ink-dim/40",
              )}
            >
              <div
                className={cn(
                  "data text-[11px] tracking-[0.08em] uppercase",
                  sort === s.id ? "text-teal" : "text-ink",
                )}
              >
                {s.label}
              </div>
              <div className="data hidden text-[9px] text-ink-dim sm:block">{s.detail}</div>
            </button>
          ))}
        </div>
        <div className="no-scrollbar -mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              onClick={() => setScope(s.id)}
              className={cn(
                "data press shrink-0 rounded-[4px] border px-2.5 py-1.5 text-[10px] tracking-[0.1em] uppercase",
                scope === s.id
                  ? "border-amber/45 bg-amber/10 text-amber"
                  : "border-line bg-panel-2 text-ink-dim hover:text-ink",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {chart.isLoading ? (
        <Spinner label="reading the charts" />
      ) : rows.length === 0 ? (
        <Empty
          title={SORTS.find((s) => s.id === sort)?.emptyTitle ?? "Nothing has charted yet"}
          detail={SORTS.find((s) => s.id === sort)?.empty ?? ""}
          action={
            <Link href="/explore">
              <span className="data text-[10px] tracking-[0.1em] text-teal uppercase">
                go find one →
              </span>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row, i) => (
            <ChartRow
              key={row.key}
              rank={i + 1}
              row={row}
              sort={sort}
              leader={valueOf(rows[0], sort)}
            />
          ))}
        </div>
      )}

      <p className="data mt-6 text-[10px] leading-relaxed text-ink-dim">
        RF on this page is SIMULATED, the app's own play money. It is credited to each Friend's
        wallet the way the real protocol keeps rewards with the Friend, but nothing here touches the
        real $RAREFRIENDS token and no transfer is ever signed.
      </p>
    </Shell>
  );
}

function SideCard({
  label,
  tone,
  totals,
  loading,
}: {
  label: string;
  tone: "orange" | "teal";
  totals?: {
    friends: number;
    likes: number;
    plays: number;
    downloads: number;
    earnedRf: number;
  };
  loading: boolean;
}) {
  return (
    <Panel
      title={label}
      right={<Tag tone={tone}>{totals ? `${totals.friends} charting` : "no entries"}</Tag>}
    >
      {loading ? (
        <div className="h-[52px] animate-pulse rounded-[3px] bg-panel-2" />
      ) : (
        <div className="grid grid-cols-4 gap-3">
          <Stat label="likes" value={formatRf(totals?.likes ?? 0)} tone={tone} />
          <Stat label="plays" value={formatRf(totals?.plays ?? 0)} />
          <Stat label="downloads" value={formatRf(totals?.downloads ?? 0)} />
          <Stat label="rf earned" value={formatRf(totals?.earnedRf ?? 0)} tone="amber" />
        </div>
      )}
    </Panel>
  );
}

function ChartRow({
  rank,
  row,
  sort,
  leader,
}: {
  rank: number;
  row: Row;
  sort: ChartSort;
  leader: number;
}) {
  const collection = (row.collection === "genesis" ? "genesis" : "generations") as Collection;
  const tokenId = String(row.tokenId);
  const { friend, comp } = useFriend(collection, tokenId);
  const { status, comp: liveComp } = useEngine();
  const live = status !== "idle" && liveComp?.key === row.key;

  const value = valueOf(row, sort);
  const share = leader > 0 ? Math.max(4, Math.round((value / leader) * 100)) : 0;
  const unit = sort === "earned" ? "RF" : sort;

  return (
    <div
      className={cn(
        "panel relative flex items-center gap-3 overflow-hidden p-2.5",
        live ? "border-teal/60" : "hover:border-ink-dim/40",
      )}
    >
      {/* the bar is the ranking, drawn behind the row */}
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0",
          collection === "genesis" ? "bg-orange/8" : "bg-teal/8",
        )}
        style={{ width: `${share}%` }}
      />

      <span className="data relative w-7 shrink-0 text-center text-[13px] text-ink-dim">
        {rank}
      </span>

      <Link
        href={`/f/${collection}/${tokenId}`}
        className="relative flex min-w-0 flex-1 items-center gap-3"
      >
        {friend ? (
          <PixelArt
            src={friend.imageDataUri}
            alt={friend.name}
            tone={collection}
            className="size-11 shrink-0"
          />
        ) : (
          <div className="size-11 shrink-0 animate-pulse rounded-[3px] border border-line bg-panel-2" />
        )}
        <div className="min-w-0">
          <div className="font-display truncate text-[15px] text-ink">
            {friend?.name ?? row.name ?? `#${tokenId}`}
          </div>
          <div className="data flex flex-wrap items-center gap-1.5 truncate text-[9px] text-ink-dim">
            <span className={collection === "genesis" ? "text-orange/80" : "text-teal/80"}>
              {COLLECTION_LABEL[collection]}
            </span>
            {row.generation !== null && <span>gen {row.generation}</span>}
            {row.tier !== null && <span>tier {row.tier}</span>}
            {comp && (
              <span className="hidden sm:inline">
                {comp.rootName} {comp.scaleName} · {comp.bpm} BPM
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="relative hidden shrink-0 items-center gap-4 md:flex">
        <Mini label="likes" value={row.likes} on={sort === "likes"} />
        <Mini label="plays" value={row.plays} on={sort === "plays"} />
        <Mini label="dl" value={row.downloads} on={sort === "downloads"} />
        <Mini label="rf" value={row.earnedRf} on={sort === "earned"} />
      </div>

      <div className="relative shrink-0 text-right md:hidden">
        <div className="data text-[13px] text-amber">{formatRf(value)}</div>
        <div className="micro">{unit}</div>
      </div>

      <div className="relative flex shrink-0 items-center gap-1.5">
        <LikeChip
          friendKey={row.key}
          meta={{
            name: friend?.name ?? row.name ?? undefined,
            generation: row.generation,
            tier: row.tier,
          }}
        />
        <button
          disabled={!friend || !comp}
          onClick={() =>
            live ? player.stop() : void player.start(friend!, comp!, { queue: null })
          }
          className={cn(
            "press flex size-7 shrink-0 items-center justify-center rounded-[3px] border disabled:opacity-40",
            live
              ? "border-teal/50 bg-teal/16 text-teal"
              : "border-line bg-panel-2 text-ink-dim hover:text-teal",
          )}
          title={live ? "Stop" : "Play"}
        >
          {live ? (
            <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
              <rect width="10" height="10" />
            </svg>
          ) : (
            <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
              <path d="M2 0v10l7-5z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

function Mini({ label, value, on }: { label: string; value: number; on: boolean }) {
  return (
    <div className="w-12 text-right">
      <div className={cn("data text-[12px]", on ? "text-amber" : "text-ink-dim")}>
        {formatRf(value)}
      </div>
      <div className="micro">{label}</div>
    </div>
  );
}
