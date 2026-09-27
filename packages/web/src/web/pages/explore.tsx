import { useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageHead, Shell } from "../components/shell";
import { Btn, Panel, Spinner, Tag } from "../components/kit";
import { FriendTile } from "../components/friend-tile";
import { fetchFriend, friendKey, randomIds, type Friend } from "../lib/friends";
import { deriveComposition, computeVibeScore } from "../lib/music";
import { player } from "../lib/player";
import { useGenerationsMinted } from "../lib/hooks";
import { COLLECTION_LABEL, FAMILY_NAMES, GENESIS_MAX_ID, type Collection } from "../lib/chain";
import { cn } from "../lib/utils";

type Scope = "all" | "genesis" | "generations";
type Sort = "id" | "vibe" | "tempo";

const BATCH = 24;

export default function Explore() {
  const [scope, setScope] = useState<Scope>("all");
  const [family, setFamily] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("id");
  const [pages, setPages] = useState(1);
  const [jump, setJump] = useState("");
  const [, navigate] = useLocation();
  const minted = useGenerationsMinted();

  // Random sampling is the only honest way to browse without an indexer:
  // Generations ids are not contiguous, so we sample and keep what resolves.
  const sample = useQueries({
    queries: Array.from({ length: pages }, (_, page) => ({
      queryKey: ["sample", scope, page],
      queryFn: async () => {
        const out: { collection: Collection; id: string }[] = [];
        if (scope !== "generations") {
          const g = await randomIds("genesis", scope === "genesis" ? BATCH : 8);
          out.push(...g.map((id) => ({ collection: "genesis" as Collection, id })));
        }
        if (scope !== "genesis") {
          const n = await randomIds("generations", scope === "generations" ? BATCH : 16);
          out.push(...n.map((id) => ({ collection: "generations" as Collection, id })));
        }
        return out;
      },
      staleTime: Infinity,
    })),
  });

  const ids = useMemo(
    () => sample.flatMap((s) => s.data ?? []),
    [sample.map((s) => (s.data ? s.data.length : 0)).join(","), scope, pages],
  );

  const friendQueries = useQueries({
    queries: ids.map((t) => ({
      queryKey: ["friend", t.collection, t.id],
      queryFn: () => fetchFriend(t.collection, t.id),
      staleTime: Infinity,
      retry: 0,
    })),
  });

  const loaded = friendQueries.filter((q) => q.data).map((q) => q.data as Friend);
  const loading = friendQueries.some((q) => q.isLoading) || sample.some((s) => s.isLoading);

  const filtered = useMemo(() => {
    let out = loaded;
    if (family) out = out.filter((f) => (f.character ?? f.registryFamilyName) === family);
    if (state) out = out.filter((f) => f.state === state);
    if (sort === "vibe") {
      out = [...out].sort(
        (a, b) => computeVibeScore(deriveComposition(b)).total - computeVibeScore(deriveComposition(a)).total,
      );
    } else if (sort === "tempo") {
      out = [...out].sort((a, b) => deriveComposition(b).bpm - deriveComposition(a).bpm);
    }
    return out;
  }, [loaded.length, family, state, sort]);

  const listRef = useRef<Friend[]>(filtered);
  listRef.current = filtered;

  const step = async (dir: number) => {
    const list = listRef.current;
    if (!list.length) return;
    const curKey = player.getSnapshot().comp?.key;
    const at = list.findIndex((f) => friendKey(f) === curKey);
    const i = at < 0 ? 0 : (at + dir + list.length) % list.length;
    const f = list[i];
    await player.start(f, deriveComposition(f), {
      queue: {
        label: "Explore run",
        next: () => void step(1),
        prev: () => void step(-1),
      },
      onFinish: () => void step(1),
    });
  };

  const queue = {
    label: "Explore run",
    next: () => void step(1),
    prev: () => void step(-1),
  };

  const states = useMemo(
    () => Array.from(new Set(loaded.map((f) => f.state).filter(Boolean))) as string[],
    [loaded.length],
  );

  return (
    <Shell>
      <PageHead
        eyebrow={
          minted.data
            ? `${minted.data.toLocaleString()} Generations · ${GENESIS_MAX_ID} Genesis · read live`
            : "reading collection size from chain"
        }
        title="Explore the population"
        right={
          <>
            <Btn variant="primary" size="lg" onClick={() => void step(1)}>
              play this run
            </Btn>
            <Btn size="lg" onClick={() => setPages((p) => p + 1)}>
              sample more
            </Btn>
          </>
        }
      >
        There is no indexer behind this. Friendstune samples real token ids straight from the
        contracts and keeps the ones that resolve. Filters apply to what has loaded.
      </PageHead>

      <Panel className="ft-rise mb-4" bodyClass="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {(["all", "generations", "genesis"] as Scope[]).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setScope(s);
                  setPages(1);
                }}
                className={cn(
                  "data press rounded-[3px] border px-2.5 py-1.5 text-[10px] uppercase",
                  scope === s
                    ? "border-teal/45 bg-teal/10 text-teal"
                    : "border-line bg-panel-2 text-ink-dim hover:text-ink",
                )}
              >
                {s === "all" ? "both" : COLLECTION_LABEL[s as Collection]}
              </button>
            ))}
          </div>

          <span className="mx-1 h-5 w-px bg-line" />

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFamily(null)}
              className={cn(
                "data press rounded-[3px] border px-2 py-1.5 text-[10px] uppercase",
                !family
                  ? "border-teal/45 bg-teal/10 text-teal"
                  : "border-line bg-panel-2 text-ink-dim",
              )}
            >
              all families
            </button>
            {FAMILY_NAMES.map((f) => (
              <button
                key={f}
                onClick={() => setFamily(family === f ? null : f)}
                className={cn(
                  "data press rounded-[3px] border px-2 py-1.5 text-[10px] uppercase",
                  family === f
                    ? "border-teal/45 bg-teal/10 text-teal"
                    : "border-line bg-panel-2 text-ink-dim hover:text-ink",
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {states.length > 0 && (
            <>
              <span className="mx-1 h-5 w-px bg-line" />
              {states.map((s) => (
                <button
                  key={s}
                  onClick={() => setState(state === s ? null : s)}
                  className={cn(
                    "data press rounded-[3px] border px-2 py-1.5 text-[10px] uppercase",
                    state === s
                      ? "border-violet/45 bg-violet/10 text-violet"
                      : "border-line bg-panel-2 text-ink-dim hover:text-ink",
                  )}
                >
                  {s}
                </button>
              ))}
            </>
          )}

          <span className="mx-1 h-5 w-px bg-line" />
          <div className="flex gap-1.5">
            {(["id", "vibe", "tempo"] as Sort[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={cn(
                  "data press rounded-[3px] border px-2 py-1.5 text-[10px] uppercase",
                  sort === s
                    ? "border-amber/45 bg-amber/10 text-amber"
                    : "border-line bg-panel-2 text-ink-dim hover:text-ink",
                )}
              >
                {s === "id" ? "as sampled" : `by ${s}`}
              </button>
            ))}
          </div>

          <form
            className="ml-auto flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const id = jump.trim();
              if (!id) return;
              const target =
                scope === "genesis" || (scope === "all" && Number(id) <= GENESIS_MAX_ID && false)
                  ? "genesis"
                  : "generations";
              navigate(`/f/${target}/${id}`);
            }}
          >
            <input
              value={jump}
              onChange={(e) => setJump(e.target.value.replace(/\D/g, ""))}
              placeholder="jump to id"
              className="h-8 w-[110px] rounded-[4px] border border-line bg-panel-2 px-2.5 text-[11px] text-ink placeholder:text-ink-dim/60 focus:border-teal/50 focus:outline-none"
            />
            <Btn type="submit" size="sm">
              open
            </Btn>
          </form>
        </div>
        <div className="mt-2.5 flex items-center gap-2 border-t border-line pt-2.5">
          <Tag tone="teal">{filtered.length} loaded</Tag>
          <span className="data text-[10px] text-ink-dim">
            {ids.length} ids sampled · unminted ids are dropped
          </span>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {filtered.map((f) => (
          <FriendTile
            key={friendKey(f)}
            collection={f.collection}
            tokenId={f.tokenId}
            queue={queue}
          />
        ))}
      </div>

      {loading && <Spinner label="reading chain" />}

      {!loading && filtered.length === 0 && (
        <Panel className="mt-4">
          <p className="text-sm text-ink-dim">
            Nothing in this sample matches those filters. Sample more, or clear the family filter.
          </p>
        </Panel>
      )}

      <div className="mt-6 flex justify-center">
        <Btn size="lg" onClick={() => setPages((p) => p + 1)}>
          sample {BATCH} more
        </Btn>
      </div>
    </Shell>
  );
}
