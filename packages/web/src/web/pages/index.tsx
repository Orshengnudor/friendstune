import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { PageHead, Shell } from "../components/shell";
import { Btn, Panel, PixelArt, Spinner, Stat, Tag } from "../components/kit";
import { Scope, Sequencer, StepLamps, Vu } from "../components/visuals";
import { FriendTile } from "../components/friend-tile";
import { useEngine, useFriend, useGenerationsMinted, useRandomIds } from "../lib/hooks";
import { player } from "../lib/player";
import { computeVibeScore } from "../lib/music";
import { COLLECTION_LABEL, GENESIS_MAX_ID, type Collection } from "../lib/chain";
import { cn } from "../lib/utils";

type Station = "mixed" | "genesis" | "generations";

const STATIONS: { id: Station; label: string; detail: string }[] = [
  { id: "mixed", label: "Full spectrum", detail: "Genesis + Generations, shuffled" },
  { id: "genesis", label: "Genesis 1024", detail: "The 8×8 originals" },
  { id: "generations", label: "Generations", detail: "The 16×16 population" },
];

export default function Index() {
  const [station, setStation] = useState<Station>("mixed");
  const [salt, setSalt] = useState(0);
  const [idx, setIdx] = useState(0);
  const [on, setOn] = useState(false);
  const [jump, setJump] = useState("");
  const [, navigate] = useLocation();

  const genesis = useRandomIds("genesis", 10, salt);
  const generations = useRandomIds("generations", 14, salt);
  const minted = useGenerationsMinted();

  const playlist = useMemo(() => {
    const g = (genesis.data ?? []).map((id) => ({ collection: "genesis" as Collection, id }));
    const n = (generations.data ?? []).map((id) => ({
      collection: "generations" as Collection,
      id,
    }));
    if (station === "genesis") return g;
    if (station === "generations") return n;
    const mixed: { collection: Collection; id: string }[] = [];
    for (let i = 0; i < Math.max(g.length, n.length); i++) {
      if (n[i]) mixed.push(n[i]);
      if (g[i]) mixed.push(g[i]);
    }
    return mixed;
  }, [genesis.data, generations.data, station]);

  const current = playlist[idx % Math.max(1, playlist.length)];
  const { friend, comp, isLoading, isError } = useFriend(
    current?.collection ?? "generations",
    current?.id,
  );
  const engineState = useEngine();
  const playing = engineState.status !== "idle" && engineState.comp?.key === comp?.key;

  const next = () => setIdx((i) => i + 1);
  const prev = () => setIdx((i) => (i === 0 ? playlist.length - 1 : i - 1));

  // Skip ids that turn out not to be minted.
  useEffect(() => {
    if (isError) next();
  }, [isError]);

  // Radio chain: when the loaded Friend changes and the radio is on, play it.
  useEffect(() => {
    if (!on || !friend || !comp) return;
    if (engineState.comp?.key === comp.key && engineState.status !== "idle") return;
    void player.start(friend, comp, {
      queue: { label: `Radio · ${STATIONS.find((s) => s.id === station)?.label}`, next, prev },
      onFinish: next,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, comp?.key]);

  const vibe = comp ? computeVibeScore(comp) : null;

  return (
    <Shell>
      <PageHead
        eyebrow="Rare Friends · Robinhood Chain 4663 · live reads"
        title="Every Rare Friend already had a tune."
        right={
          <>
            <Btn
              variant={on ? "primary" : "ghost"}
              size="lg"
              onClick={() => {
                if (on) {
                  setOn(false);
                  player.stop();
                } else {
                  setOn(true);
                }
              }}
            >
              {on ? "radio on" : "power on"}
            </Btn>
            <Btn size="lg" onClick={() => setSalt((s) => s + 1)} title="New random selection">
              reshuffle
            </Btn>
          </>
        }
      >
        Friendstune reads a Friend straight off chain and plays what is already there: the artwork
        bitmap becomes the note grid, the traits pick the key, the instruments, the tempo and the
        room. No wallet needed to listen.
      </PageHead>

      {/* station select */}
      <div className="ft-rise mb-4 flex flex-wrap gap-2">
        {STATIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setStation(s.id);
              setIdx(0);
            }}
            className={cn(
              "press rounded-[4px] border px-3 py-2 text-left",
              station === s.id
                ? "border-teal/45 bg-teal/10"
                : "border-line bg-panel hover:border-ink-dim/40",
            )}
          >
            <div
              className={cn(
                "data text-[11px] tracking-[0.08em] uppercase",
                station === s.id ? "text-teal" : "text-ink",
              )}
            >
              {s.label}
            </div>
            <div className="data text-[9px] text-ink-dim">{s.detail}</div>
          </button>
        ))}
        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const id = jump.trim();
            if (!id) return;
            navigate(
              `/f/${Number(id) <= GENESIS_MAX_ID && station === "genesis" ? "genesis" : "generations"}/${id}`,
            );
          }}
        >
          <input
            value={jump}
            onChange={(e) => setJump(e.target.value.replace(/\D/g, ""))}
            placeholder="tune to id"
            className="h-9 w-[120px] rounded-[4px] border border-line bg-panel-2 px-2.5 text-[11px] text-ink placeholder:text-ink-dim/60 focus:border-teal/50 focus:outline-none"
          />
          <Btn type="submit">go</Btn>
        </form>
      </div>

      {/* main deck view */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel
          title={friend ? `now on air · ${COLLECTION_LABEL[friend.collection]}` : "now on air"}
          right={
            comp && (
              <span className="data text-[10px] text-ink-dim">
                {comp.gridSize}×{comp.gridSize} grid
              </span>
            )
          }
          bodyClass="p-3"
          className="ft-rise"
        >
          {!friend || !comp ? (
            <div className="flex aspect-square items-center justify-center">
              {isLoading ? <Spinner label="reading chain" /> : <span className="micro">idle</span>}
            </div>
          ) : (
            <div className="scanlines relative aspect-square overflow-hidden rounded-[3px] border border-line bg-[#070a0f]">
              <Sequencer
                grid={friend.grid}
                comp={comp}
                step={engineState.step}
                playing={playing}
              />
            </div>
          )}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1">
              <Scope active={playing} height={34} />
            </div>
            <Vu active={playing} />
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel
            title="signal"
            className="ft-rise"
            right={
              friend && (
                <Link
                  href={`/f/${friend.collection}/${friend.tokenId}`}
                  className="data text-[10px] text-teal hover:underline"
                >
                  open friend →
                </Link>
              )
            }
          >
            {!friend || !comp ? (
              <Spinner />
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <PixelArt
                    src={friend.imageDataUri}
                    alt={friend.name}
                    tone={friend.collection}
                    className="size-16 shrink-0"
                  />
                  <div className="min-w-0">
                    <h2 className="font-display truncate text-xl text-ink">{friend.name}</h2>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Tag tone={friend.collection === "genesis" ? "orange" : "teal"}>
                        {COLLECTION_LABEL[friend.collection]}
                      </Tag>
                      {friend.character && <Tag>{friend.character}</Tag>}
                      {friend.lineage && <Tag>{friend.lineage}</Tag>}
                      {friend.state && (
                        <Tag tone={friend.state === "Temporary" ? "violet" : "dim"}>
                          {friend.state}
                        </Tag>
                      )}
                      {friend.generation !== null && <Tag>gen {friend.generation}</Tag>}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
                  <Stat label="key" value={`${comp.rootName} ${comp.scaleName}`} tone="teal" />
                  <Stat label="tempo" value={`${comp.bpm} BPM`} />
                  <Stat label="room" value={comp.room.name} />
                  <Stat label="vibe score" value={vibe?.total ?? "n/a"} tone="amber" sub="arrangement, not rarity" />
                </div>

                <div className="mt-4 space-y-2 border-t border-line pt-4">
                  <div className="flex items-center justify-between">
                    <span className="micro">kick</span>
                    <span className="data text-[10px] text-ink-dim">{comp.steps} steps</span>
                  </div>
                  <StepLamps values={comp.kick} step={engineState.step} playing={playing} />
                  <span className="micro block pt-1">hat</span>
                  <StepLamps
                    values={comp.hat}
                    step={engineState.step}
                    playing={playing}
                    tone="amber"
                  />
                </div>
              </>
            )}
          </Panel>

          <Panel title="how this works" className="ft-rise">
            <ol className="space-y-2 text-sm text-ink-dim">
              <li>
                <span className="data text-teal">01</span> `tokenURI` is read live from the Rare
                Friends contract. The artwork is an on-chain SVG of 1×1 rects, so it decodes back
                to the exact bitmap the contract drew.
              </li>
              <li>
                <span className="data text-teal">02</span> Every column of that bitmap is one 16th
                step; every row is a degree of the scale. Ink is a note, blank is a rest.
              </li>
              <li>
                <span className="data text-teal">03</span> Traits do the arranging: Character or
                Lineage picks the mode, Scenery picks the room, tier and Stature set tempo, Crown
                and family pick the oscillator.
              </li>
            </ol>
            <Link
              href="/about"
              className="data mt-3 inline-block text-[10px] tracking-[0.1em] text-teal uppercase hover:underline"
            >
              full derivation map →
            </Link>
          </Panel>
        </div>
      </div>

      {/* up next */}
      <div className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <div className="micro">up next on this station</div>
            <h3 className="font-display mt-1 text-lg text-ink">
              {playlist.length} Friends queued
              {minted.data ? (
                <span className="data ml-2 text-[11px] text-ink-dim">
                  of {minted.data.toLocaleString()} Generations + {GENESIS_MAX_ID} Genesis
                </span>
              ) : null}
            </h3>
          </div>
          <Link href="/explore" className="data text-[10px] tracking-[0.1em] text-teal uppercase">
            explore all →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {playlist.slice(0, 12).map((t, i) => (
            <div
              key={`${t.collection}:${t.id}`}
              onClick={() => setIdx(i)}
              className={cn(i === idx % Math.max(1, playlist.length) && "ring-1 ring-teal/40")}
            >
              <FriendTile collection={t.collection} tokenId={t.id} compact />
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
