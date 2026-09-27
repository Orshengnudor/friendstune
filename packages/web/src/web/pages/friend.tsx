import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { useConnection } from "wagmi";
import { Shell } from "../components/shell";
import { Btn, Empty, Meter, Panel, PixelArt, SimBadge, Spinner, Stat, Tag } from "../components/kit";
import { Scope, Sequencer, StepLamps, Vu } from "../components/visuals";
import { LikeButton } from "../components/like";
import { useEngine, useFriend, useOwner } from "../lib/hooks";
import type { Friend } from "../lib/friends";
import { player } from "../lib/player";
import { computeVibeScore, midiToName, type Composition, type LayerName } from "../lib/music";
import { downloadBlob, engine, renderWav, DEFAULT_REMIX, isDefaultRemix } from "../lib/audio";
import { formatRf, store, useSimRf } from "../lib/store";
import { COLLECTION_LABEL, EXPLORER, shortAddress, tokenUrl, type Collection } from "../lib/chain";
import { priceFor } from "../lib/pricing";
import { renderTuneCard } from "../lib/card";
import {
  useFriendStats,
  useMyPurchases,
  useRecordDownload,
  useRecordSave,
  useRecordTip,
} from "../queries/charts";
import { cn } from "../lib/utils";

const UNLOCK_COST = 2500;
const TIP_STEPS = [100, 500, 2500];

export default function FriendPage() {
  const params = useParams<{ collection: string; id: string }>();
  const collection = (params.collection === "genesis" ? "genesis" : "generations") as Collection;
  const tokenId = params.id;

  const { friend, comp, isLoading, isError, error } = useFriend(collection, tokenId);
  const owner = useOwner(collection, tokenId);
  const engineState = useEngine();
  const { address } = useConnection();
  const { balance, tips, unlocked, favourites, purchased } = useSimRf();

  const key = `${collection}:${tokenId}`;
  const live = engineState.status !== "idle" && engineState.comp?.key === key;
  const isUnlocked = unlocked.includes(key);
  const fav = favourites.includes(key);
  const tipped = tips[key] ?? 0;

  const { stats } = useFriendStats(key);
  const purchases = useMyPurchases();
  const recordSave = useRecordSave();
  const recordTip = useRecordTip();

  const meta = {
    name: friend?.name,
    generation: friend?.generation ?? null,
    tier: friend?.tier ?? null,
  };
  const isHolder =
    !!address && !!owner.data && address.toLowerCase() === owner.data.toLowerCase();
  const paid = purchased.includes(key) || (purchases.data ?? []).includes(key);

  const [rendering, setRendering] = useState(false);
  const [copied, setCopied] = useState(false);

  // Leaving the page does not stop playback (the deck keeps it), but remix edits
  // should not leak onto the next Friend.
  useEffect(() => {
    return () => {
      if (!isDefaultRemix(engine.getState().settings)) engine.resetSettings();
    };
  }, [key]);

  if (isLoading) {
    return (
      <Shell>
        <Spinner label={`reading ${COLLECTION_LABEL[collection]} #${tokenId} from chain`} />
      </Shell>
    );
  }

  if (isError || !friend || !comp) {
    return (
      <Shell>
        <Empty
          title={`#${tokenId} is not readable on chain`}
          detail={
            error instanceof Error
              ? `${COLLECTION_LABEL[collection]} returned: ${error.message.slice(0, 160)}`
              : "This token id is not minted in this collection."
          }
          action={
            <Link href="/explore">
              <Btn variant="primary">back to explore</Btn>
            </Link>
          }
        />
      </Shell>
    );
  }

  const vibe = computeVibeScore(comp);

  return (
    <Shell>
      {/* header */}
      <div className="ft-rise mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="micro mb-2 flex items-center gap-2">
            <Link href="/explore" className="hover:text-teal">
              explore
            </Link>
            <span className="text-line">/</span>
            <span>{COLLECTION_LABEL[collection]}</span>
          </div>
          <h1 className="font-display truncate text-[34px] leading-tight font-bold text-ink sm:text-[42px]">
            {friend.name}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <Tag tone={collection === "genesis" ? "orange" : "teal"}>
              {COLLECTION_LABEL[collection]}
            </Tag>
            {friend.character && <Tag>{friend.character}</Tag>}
            {friend.registryFamilyName && friend.registryFamilyName !== friend.character && (
              <Tag tone="violet">registry: {friend.registryFamilyName}</Tag>
            )}
            {friend.lineage && <Tag>{friend.lineage}</Tag>}
            {friend.state && (
              <Tag tone={friend.state === "Temporary" ? "violet" : "dim"}>{friend.state}</Tag>
            )}
            {friend.tier !== null && <Tag tone="amber">tier {friend.tier}</Tag>}
            {friend.generation !== null && <Tag>gen {friend.generation}</Tag>}
            {owner.data && (
              <a
                href={`${EXPLORER}/address/${owner.data}`}
                target="_blank"
                rel="noreferrer"
                className="data text-[10px] text-ink-dim hover:text-teal"
              >
                held by {shortAddress(owner.data)} ↗
              </a>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Btn
            variant={live ? "primary" : "primary"}
            size="lg"
            onClick={() =>
              live
                ? player.stop()
                : void player.start(friend, comp, { queue: null, settings: engineState.settings })
            }
          >
            {live ? "stop" : "play tune"}
          </Btn>
          <LikeButton
            friendKey={key}
            meta={meta}
            size="lg"
            count={stats?.likes ?? null}
          />
          <Btn
            size="lg"
            variant={fav ? "warm" : "ghost"}
            onClick={() => {
              store.toggleFavourite(key);
              recordSave.mutate({ key, on: !fav, meta });
            }}
            title="Save to your own shelf on My Friends. Private, unlike a like."
          >
            {fav ? "saved" : "save"}
          </Btn>
          <Btn
            size="lg"
            onClick={() => {
              void navigator.clipboard.writeText(window.location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? "link copied" : "share"}
          </Btn>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* ---- media column ---- */}
        <div className="flex flex-col gap-4">
          <Panel
            title="the artwork is the sequencer"
            right={
              <span className="data text-[10px] text-ink-dim">
                {comp.gridSize}×{comp.gridSize} · {comp.inkCount} ink
              </span>
            }
            bodyClass="p-3"
            className="ft-rise"
          >
            <div className="scanlines relative aspect-square overflow-hidden rounded-[3px] border border-line bg-[#070a0f]">
              <Sequencer grid={friend.grid} comp={comp} step={engineState.step} playing={live} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <PixelArt
                src={friend.imageDataUri}
                alt={friend.name}
                tone={collection}
                className="size-12 shrink-0"
              />
              <div className="flex-1">
                <Scope active={live} height={34} />
              </div>
              <Vu active={live} />
            </div>
            <div className="mt-3 space-y-1.5 border-t border-line pt-3">
              <span className="micro">kick</span>
              <StepLamps values={comp.kick} step={engineState.step} playing={live} />
              <span className="micro block pt-1">hat</span>
              <StepLamps values={comp.hat} step={engineState.step} playing={live} tone="amber" />
            </div>
          </Panel>

          <TuneFilePanel
            friend={friend}
            comp={comp}
            friendKey={key}
            stats={stats}
            isHolder={isHolder}
            paid={paid}
            rendering={rendering}
            setRendering={setRendering}
          />

          <Panel title="tip the friend" right={<SimBadge />} className="ft-rise">
            <p className="text-sm text-ink-dim">
              In the Rare Friends protocol every Friend has a wallet of its own. Friendstune models
              that. Tips are recorded locally against this Friend and paid in{" "}
              <span className="text-amber">simulated RF</span>. Nothing here ever touches the real
              $RAREFRIENDS token or signs a transfer.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {TIP_STEPS.map((amount) => (
                <Btn
                  key={amount}
                  variant="warm"
                  disabled={balance < amount}
                  onClick={() => {
                    if (store.spend(amount, "tip", `Tipped ${friend.name}`, key)) {
                      recordTip.mutate({ key, amount, meta });
                    }
                  }}
                >
                  +{formatRf(amount)} rf
                </Btn>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4 border-t border-line pt-3 sm:grid-cols-3">
              <Stat label="you tipped" value={`${formatRf(tipped)} RF`} tone="orange" />
              <Stat
                label="friend has earned"
                value={`${formatRf(stats?.earnedRf ?? 0)} RF`}
                sub="tips + tune sales, all listeners"
                tone="teal"
              />
              <Stat label="your sim balance" value={`${formatRf(balance)} RF`} tone="amber" />
            </div>
          </Panel>
        </div>

        {/* ---- data column ---- */}
        <div className="flex flex-col gap-4">
          <Panel title="tune" className="ft-rise">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="key" value={`${comp.rootName} ${comp.scaleName}`} tone="teal" />
              <Stat label="tempo" value={`${comp.bpm} BPM`} sub={`swing ${Math.round(comp.swing * 100)}%`} />
              <Stat label="oscillator" value={comp.waveform} sub={`note ${comp.noteLength}`} />
              <Stat
                label="room"
                value={comp.room.name}
                sub={`${Math.round(comp.room.wet * 100)}% wet`}
              />
              <Stat label="steps" value={`${comp.steps}`} sub={`${comp.loopSeconds.toFixed(1)}s loop`} />
              <Stat label="root" value={midiToName(comp.rootMidi)} />
              <Stat
                label="layers"
                value={`${Object.values(comp.layers).filter(Boolean).length} / 7`}
                sub={Object.entries(comp.layers)
                  .filter(([, v]) => v)
                  .map(([k]) => k)
                  .join(" ")}
              />
              <Stat
                label="stability"
                value={comp.unstable ? "vibrato" : "steady"}
                tone={comp.unstable ? "violet" : undefined}
                sub={comp.unstable ? "Temporary state" : "fixed pitch"}
              />
            </div>
          </Panel>

          <Panel
            title="vibe score"
            right={<span className="data text-lg text-amber">{vibe.total}</span>}
            className="ft-rise"
          >
            <p className="mb-3 text-[11px] text-ink-dim">
              Describes how busy the arrangement is, not rarity, not value.
            </p>
            <div className="space-y-2.5">
              {vibe.parts.map((p) => (
                <div key={p.label}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="micro">{p.label}</span>
                    <span className="data text-[10px] text-ink-dim">{p.value}</span>
                  </div>
                  <Meter value={p.value} tone={p.value > 66 ? "amber" : "teal"} />
                </div>
              ))}
            </div>
          </Panel>

          <RemixStudio comp={comp} unlocked={isUnlocked} friendKey={key} live={live} />

          <Panel title="derivation: chain field → musical parameter" className="ft-rise">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    <th className="micro pb-2">source</th>
                    <th className="micro pb-2">on-chain value</th>
                    <th className="micro pb-2">effect</th>
                  </tr>
                </thead>
                <tbody>
                  {comp.derivation.map((row, i) => (
                    <tr key={i} className="border-b border-line/50 last:border-0">
                      <td className="data py-2 pr-3 align-top text-[11px] whitespace-nowrap text-ink-dim">
                        {row.source}
                      </td>
                      <td className="data py-2 pr-3 align-top text-[11px] whitespace-nowrap text-ink">
                        {row.value}
                      </td>
                      <td className="py-2 align-top text-[12px] text-teal/85">{row.effect}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="on-chain traits"
            right={
              friend.dna ? (
                <span className="data max-w-[160px] truncate text-[10px] text-ink-dim">
                  dna {friend.dna}
                </span>
              ) : null
            }
            className="ft-rise"
          >
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
              {friend.traits.map((t) => (
                <div key={t.type} className="border-b border-line/40 pb-1.5">
                  <div className="micro truncate">{t.type}</div>
                  <div className="data truncate text-[12px] text-ink">{String(t.value)}</div>
                </div>
              ))}
            </div>
            {friend.description && (
              <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-ink-dim">
                {friend.description}
              </p>
            )}
          </Panel>
        </div>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */

/**
 * THE TUNE FILE
 * The wallet that holds the Friend gets the WAV for nothing. Everyone else pays
 * its price in simulated RF, and that payment is credited to the Friend's own
 * wallet, the way the real protocol keeps rewards with the Friend rather than
 * with whoever happens to hold it.
 */
function TuneFilePanel({
  friend,
  comp,
  friendKey,
  stats,
  isHolder,
  paid,
  rendering,
  setRendering,
}: {
  friend: Friend;
  comp: Composition;
  friendKey: string;
  stats: { likes?: number; plays?: number; downloads?: number; earnedRf?: number } | null;
  isHolder: boolean;
  paid: boolean;
  rendering: boolean;
  setRendering: (v: boolean) => void;
}) {
  const { settings } = useEngine();
  const { balance } = useSimRf();
  const record = useRecordDownload();
  const [card, setCard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = priceFor(friend, stats ?? undefined);
  const free = isHolder || paid;
  const affordable = balance >= price.total;
  const meta = { name: friend.name, generation: friend.generation, tier: friend.tier };
  const remixed = !isDefaultRemix(settings);

  const download = async () => {
    setError(null);
    let charged = 0;
    if (!free) {
      const ok = store.spend(
        price.total,
        "download",
        `Bought the tune of ${friend.name}`,
        friendKey,
      );
      if (!ok) {
        setError("Not enough simulated RF. Refill for free on My Friends.");
        return;
      }
      charged = price.total;
    }
    setRendering(true);
    try {
      const blob = await renderWav(comp, settings, 4);
      downloadBlob(
        blob,
        `friendstune-${friend.collection}-${friend.tokenId}${remixed ? "-remix" : ""}.wav`,
      );
      record.mutate({
        key: friendKey,
        kind: isHolder ? "holder" : "paid",
        priceRf: charged,
        meta,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The render failed");
    } finally {
      setRendering(false);
    }
  };

  const downloadCard = async () => {
    setError(null);
    setCard(true);
    try {
      const tags = [
        COLLECTION_LABEL[friend.collection],
        friend.character,
        friend.lineage,
        friend.state,
        friend.tier !== null ? `tier ${friend.tier}` : null,
        friend.generation !== null ? `gen ${friend.generation}` : null,
      ].filter((t): t is string => !!t);

      const blob = await renderTuneCard({
        name: friend.name,
        collection: friend.collection,
        tokenId: friend.tokenId,
        grid: friend.grid,
        comp,
        tags,
        counters: stats,
        priceLabel: price.generationLabel,
      });
      downloadBlob(blob, `friendstune-card-${friend.collection}-${friend.tokenId}.png`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The card could not be drawn");
    } finally {
      setCard(false);
    }
  };

  return (
    <Panel
      title="the tune file"
      right={
        free ? (
          <Tag tone="teal">{isHolder ? "yours, free" : "paid for"}</Tag>
        ) : (
          <SimBadge />
        )
      }
      className="ft-rise"
    >
      {isHolder ? (
        <p className="text-sm text-ink-dim">
          This wallet holds {friend.name}, so its tune is yours. Four loops, 44.1kHz WAV, rendered
          here in your browser.
        </p>
      ) : paid ? (
        <p className="text-sm text-ink-dim">
          You already paid this Friend for its tune. Download it again as often as you like, in any
          remix you make.
        </p>
      ) : (
        <>
          <p className="text-sm text-ink-dim">
            Rewards in the Rare Friends protocol belong to the Friend and travel with the NFT.
            Friendstune models that: whoever holds {friend.name} downloads this tune for nothing,
            everyone else pays its price into the Friend's own wallet in{" "}
            <span className="text-amber">simulated RF</span>. The real $RAREFRIENDS token is never
            called.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 rounded-[4px] border border-line bg-panel-2 p-3">
            <Stat label="price now" value={`${formatRf(price.total)} RF`} tone="amber" />
            <Stat
              label="floor"
              value={`${formatRf(price.floor)} RF`}
              sub={price.generationLabel}
            />
            <Stat
              label="demand"
              value={`${price.demand.toFixed(2)}×`}
              sub={
                price.drivers.length > 0
                  ? price.drivers.map((d) => d.label).join(" + ")
                  : "nobody has charted it yet"
              }
              tone={price.demand > 1 ? "teal" : undefined}
            />
          </div>
        </>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Btn
          variant="primary"
          disabled={rendering || (!free && !affordable)}
          onClick={() => void download()}
        >
          {rendering
            ? "rendering…"
            : free
              ? `download wav${remixed ? " · remix" : ""}`
              : `buy wav · ${formatRf(price.total)} rf`}
        </Btn>
        <Btn variant="warm" disabled={card} onClick={() => void downloadCard()}>
          {card ? "drawing…" : "tune card png"}
        </Btn>
        <a href={tokenUrl(friend.collection, friend.tokenId)} target="_blank" rel="noreferrer">
          <Btn>token on explorer ↗</Btn>
        </a>
      </div>

      {!free && !affordable && (
        <p className="data mt-3 text-[10px] text-orange">
          not enough simulated RF, refill for free on My Friends
        </p>
      )}
      {error && <p className="data mt-3 text-[10px] text-orange">{error}</p>}
      <p className="data mt-3 text-[10px] text-ink-dim">
        the card is a 1080×1350 png drawn from the same bitmap and traits the player uses
      </p>
    </Panel>
  );
}

const LAYERS: LayerName[] = ["lead", "pad", "bass", "arp", "shimmer", "kick", "hat"];
const WAVES = ["sine", "triangle", "square", "sawtooth", "fatsawtooth", "pulse", "fmsine"];

function RemixStudio({
  comp,
  unlocked,
  friendKey,
  live,
}: {
  comp: Composition;
  unlocked: boolean;
  friendKey: string;
  live: boolean;
}) {
  const { settings } = useEngine();
  const { balance } = useSimRf();

  if (!unlocked) {
    return (
      <Panel title="remix studio" right={<SimBadge />} className="ft-rise">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-display text-base text-ink">Locked</div>
            <p className="mt-1 max-w-md text-sm text-ink-dim">
              Unlock the studio for this Friend to transpose it, bend the tempo, swap the
              oscillator, open the filter and mute layers, then export your version.
            </p>
          </div>
          <Btn
            variant="primary"
            size="lg"
            disabled={balance < UNLOCK_COST}
            onClick={() =>
              store.spend(UNLOCK_COST, "unlock", `Unlocked Remix Studio · ${comp.label}`, friendKey)
            }
          >
            unlock · {formatRf(UNLOCK_COST)} rf
          </Btn>
        </div>
        {balance < UNLOCK_COST && (
          <p className="data mt-3 text-[10px] text-orange">
            not enough simulated RF, refill for free on My Friends
          </p>
        )}
      </Panel>
    );
  }

  const set = (patch: Parameters<typeof engine.updateSettings>[0]) => engine.updateSettings(patch);

  return (
    <Panel
      title="remix studio"
      right={
        <div className="flex items-center gap-2">
          <SimBadge />
          <button
            onClick={() => engine.resetSettings()}
            className="data text-[10px] tracking-[0.1em] text-ink-dim uppercase hover:text-teal"
          >
            reset
          </button>
        </div>
      }
      className="ft-rise"
    >
      {!live && (
        <p className="data mb-3 text-[10px] text-ink-dim">
          press play, edits apply to the running tune live
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Knob
          label="transpose"
          value={settings.transpose}
          min={-12}
          max={12}
          step={1}
          format={(v) => `${v > 0 ? "+" : ""}${v} st`}
          onChange={(v) => set({ transpose: v })}
        />
        <Knob
          label="tempo"
          value={settings.tempoScale}
          min={0.6}
          max={1.6}
          step={0.02}
          format={(v) => `${Math.round(comp.bpm * v)} BPM`}
          onChange={(v) => set({ tempoScale: v })}
        />
        <Knob
          label="tone / filter"
          value={settings.tone}
          min={0.3}
          max={2.2}
          step={0.05}
          format={(v) => `${Math.round(comp.brightness * v)} Hz`}
          onChange={(v) => set({ tone: v })}
        />
        <Knob
          label="swing"
          value={settings.swing ?? comp.swing}
          min={0}
          max={0.6}
          step={0.02}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => set({ swing: v })}
        />
        <Knob
          label="reverb"
          value={settings.reverb ?? comp.room.wet}
          min={0}
          max={0.9}
          step={0.02}
          format={(v) => `${Math.round(v * 100)}% wet`}
          onChange={(v) => set({ reverb: v })}
        />
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="micro">oscillator</span>
            <span className="data text-[10px] text-teal">{settings.waveform ?? comp.waveform}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => set({ waveform: null })}
              className={cn(
                "data press rounded-[3px] border px-2 py-1 text-[9px] uppercase",
                settings.waveform === null
                  ? "border-teal/45 bg-teal/10 text-teal"
                  : "border-line bg-panel-2 text-ink-dim",
              )}
            >
              chain
            </button>
            {WAVES.map((w) => (
              <button
                key={w}
                onClick={() => set({ waveform: w })}
                className={cn(
                  "data press rounded-[3px] border px-2 py-1 text-[9px] uppercase",
                  settings.waveform === w
                    ? "border-teal/45 bg-teal/10 text-teal"
                    : "border-line bg-panel-2 text-ink-dim hover:text-ink",
                )}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <span className="micro">layers</span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {LAYERS.map((l) => {
            const inComp = comp.layers[l];
            const muted = settings.mutes[l] === true;
            return (
              <button
                key={l}
                disabled={!inComp}
                onClick={() => set({ mutes: { ...settings.mutes, [l]: !muted } })}
                className={cn(
                  "data press rounded-[3px] border px-2.5 py-1.5 text-[10px] uppercase",
                  !inComp
                    ? "border-line/50 bg-panel text-ink-dim/35"
                    : muted
                      ? "border-line bg-panel-2 text-ink-dim/60 line-through"
                      : "border-teal/45 bg-teal/10 text-teal",
                )}
                title={inComp ? undefined : "this Friend's tier does not include this layer"}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function Knob({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="micro">{label}</span>
        <span className="data text-[10px] text-teal">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-line [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-[2px] [&::-webkit-slider-thumb]:bg-teal"
      />
    </div>
  );
}

export { DEFAULT_REMIX };
