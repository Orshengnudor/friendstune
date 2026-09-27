import { useState } from "react";
import { Link } from "wouter";
import { PageHead, Shell } from "../components/shell";
import { Btn, Panel, PixelArt, SimBadge, Spinner, Stat, Tag } from "../components/kit";
import { Sequencer } from "../components/visuals";
import { useEngine, useFriend } from "../lib/hooks";
import { player } from "../lib/player";
import {
  EXPLORER,
  FAMILIES_REGISTRY_ADDRESS,
  GENERATIONS_ADDRESS,
  GENESIS_ADDRESS,
  GENESIS_MAX_ID,
  robinhoodChain,
  type Collection,
} from "../lib/chain";
import { SIM_RF_GRANT, formatRf } from "../lib/store";
import { cn } from "../lib/utils";

const CONTRACTS: { label: string; address: string; note: string }[] = [
  {
    label: "Rare Friends Genesis",
    address: GENESIS_ADDRESS,
    note: `ownerOf · tokenURI · ids 1…${GENESIS_MAX_ID}`,
  },
  {
    label: "Rare Friends Generations",
    address: GENERATIONS_ADDRESS,
    note: "ownerOf · tokenURI · generation · totalMinted",
  },
  {
    label: "Families registry",
    address: FAMILIES_REGISTRY_ADDRESS,
    note: "familyOf(tokenId) → family index",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Read the token",
    body: "tokenURI() comes back as a base64 data URI decoded in your browser. Inside it: the trait list and the artwork, both written by the contract itself. No IPFS, no metadata server, nothing cached by us.",
  },
  {
    n: "02",
    title: "Parse the artwork into a grid",
    body: "Both collections draw their figure as one SVG path of 1×1 rects, Genesis in an 8×8 viewBox, Generations at scale(32) inside 512, so 16×16. Friendstune parses those rects back into the exact bitmap the contract drew.",
  },
  {
    n: "03",
    title: "Play the bitmap as a sequence",
    body: "Columns become steps, rows become scale degrees, ink becomes notes. The figure is the score, which is why the tune looks like the Friend when you watch the sequencer.",
  },
  {
    n: "04",
    title: "Let the traits shape the sound",
    body: "Character or Lineage picks the mode. Scenery picks the room. Floor or Jaw writes the drums. Crown picks the oscillator. State and Generation change the tuning and stability. Same token, same tune, every time, on any device.",
  },
];

const HONEST: { q: string; a: string; tone: "teal" | "amber" }[] = [
  {
    q: "Is the music on chain?",
    a: "No. The data is. Every note is computed in your browser from on-chain traits and on-chain artwork, deterministically. No audio file is stored anywhere, and nothing about the tune is written back to the chain.",
    tone: "teal",
  },
  {
    q: "Does Friendstune spend real RF?",
    a: `No. Tipping and Remix Studio unlocks run on simulated RF: ${formatRf(SIM_RF_GRANT)} granted per identity, refillable, held in your browser's localStorage. The $RAREFRIENDS contract is never called, nothing is burned, no approval is requested.`,
    tone: "amber",
  },
  {
    q: "Does connecting a wallet risk anything?",
    a: "Connecting is read-only and optional. Friendstune requests no signature and builds no transaction anywhere in the app. A wallet only tells it which token ids to put on your shelf.",
    tone: "teal",
  },
  {
    q: "Is there a backend?",
    a: "No server, no database, no indexer. The Robinhood Chain RPC allows browser origins directly, so the app talks to the chain from your tab. Ownership discovery is a full-range eth_getLogs on Transfer, re-checked against ownerOf.",
    tone: "teal",
  },
];

const SAMPLES: { collection: Collection; id: string; label: string }[] = [
  { collection: "genesis", id: "1", label: "Genesis #1" },
  { collection: "genesis", id: "512", label: "Genesis #512" },
  { collection: "generations", id: "11381", label: "Generations #11381" },
];

export default function About() {
  const [sample, setSample] = useState(0);
  const active = SAMPLES[sample];
  const { friend, comp, isLoading } = useFriend(active.collection, active.id);
  const { status, comp: liveComp } = useEngine();
  const isLive = status !== "idle" && liveComp?.key === comp?.key;

  return (
    <Shell>
      <PageHead
        eyebrow="About"
        title="Every note has a receipt"
        right={
          <Link href="/explore">
            <Btn variant="primary">start listening</Btn>
          </Link>
        }
      >
        Friendstune turns a Rare Friend into a piece of music without adding anything of its own
        invention. Below is exactly what it reads, exactly what it does with it, and exactly which
        parts are simulated.
      </PageHead>

      <div className="grid gap-px overflow-hidden rounded-[4px] border border-line bg-line sm:grid-cols-2">
        {STEPS.map((s) => (
          <div key={s.n} className="bg-panel p-5">
            <div className="data text-[11px] text-teal">{s.n}</div>
            <div className="mt-2 font-display text-base font-semibold text-ink">{s.title}</div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-dim">{s.body}</p>
          </div>
        ))}
      </div>

      <Panel
        className="mt-6"
        title="derivation, live"
        right={
          <div className="flex items-center gap-1">
            {SAMPLES.map((s, i) => (
              <button
                key={s.label}
                onClick={() => setSample(i)}
                className={cn(
                  "data press rounded-[3px] border px-2 py-1 text-[10px] tracking-[0.08em] uppercase",
                  i === sample
                    ? "border-teal/40 bg-teal/10 text-teal"
                    : "border-line bg-panel-2 text-ink-dim hover:text-ink",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        }
        bodyClass="p-0"
      >
        {isLoading || !friend || !comp ? (
          <Spinner label={`reading ${active.label} from chain`} />
        ) : (
          <div className="grid gap-px bg-line lg:grid-cols-[320px_1fr]">
            <div className="space-y-4 bg-panel p-4">
              <PixelArt
                src={friend.imageDataUri}
                alt={friend.name}
                className="w-full"
                tone={friend.collection}
              />
              <Sequencer comp={comp} grid={friend.grid} />
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Key" value={`${comp.rootName} ${comp.scaleName}`} tone="teal" />
                <Stat label="Tempo" value={`${comp.bpm} BPM`} />
                <Stat label="Steps" value={`${comp.steps}`} sub={`${comp.gridSize}×${comp.gridSize} grid`} />
                <Stat label="Ink" value={comp.inkCount} sub="note cells" tone="orange" />
              </div>
              <Btn
                variant={isLive ? "warm" : "primary"}
                className="w-full"
                onClick={() => (isLive ? player.stop() : void player.start(friend, comp))}
              >
                {isLive ? "stop" : "hear this one"}
              </Btn>
            </div>

            <div className="no-scrollbar overflow-x-auto bg-panel">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="border-b border-line">
                    <th className="micro px-4 py-2.5">on-chain source</th>
                    <th className="micro px-4 py-2.5">value</th>
                    <th className="micro px-4 py-2.5">what it does to the sound</th>
                  </tr>
                </thead>
                <tbody>
                  {comp.derivation.map((row, i) => (
                    <tr key={`${row.source}-${i}`} className="border-b border-line/60 last:border-0">
                      <td className="data px-4 py-2.5 text-[11px] whitespace-nowrap text-ink-dim">
                        {row.source}
                      </td>
                      <td className="data px-4 py-2.5 text-[11px] whitespace-nowrap text-teal">
                        {row.value}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-ink">{row.effect}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <Panel title="straight answers" bodyClass="p-0">
          <ul>
            {HONEST.map((h) => (
              <li key={h.q} className="border-b border-line/60 px-4 py-3.5 last:border-0">
                <div className="flex items-center gap-2">
                  <Tag tone={h.tone}>{h.tone === "amber" ? "simulated" : "on chain"}</Tag>
                  <span className="font-display text-sm font-semibold text-ink">{h.q}</span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-dim">{h.a}</p>
              </li>
            ))}
          </ul>
        </Panel>

        <aside className="space-y-6">
          <Panel title="what it reads" bodyClass="p-0">
            <div className="border-b border-line px-4 py-3">
              <div className="micro">network</div>
              <div className="data mt-1 text-[12px] text-ink">
                {robinhoodChain.name} · chain {robinhoodChain.id}
              </div>
              <div className="data mt-0.5 text-[10px] break-all text-ink-dim">
                {robinhoodChain.rpcUrls.default.http[0]}
              </div>
            </div>
            {CONTRACTS.map((c) => (
              <a
                key={c.address}
                href={`${EXPLORER}/address/${c.address}`}
                target="_blank"
                rel="noreferrer"
                className="block border-b border-line/60 px-4 py-3 transition-colors last:border-0 hover:bg-panel-2"
              >
                <div className="data text-[11px] text-ink">{c.label}</div>
                <div className="data mt-1 text-[10px] break-all text-teal/80">{c.address}</div>
                <div className="micro mt-1">{c.note}</div>
              </a>
            ))}
          </Panel>

          <Panel title="the simulated economy" right={<SimBadge />}>
            <p className="text-[12px] leading-relaxed text-ink-dim">
              Tips and Remix Studio unlocks exist to make the app playable, not to move value. Every
              identity, wallet or guest, is granted{" "}
              <span className="data text-amber">{formatRf(SIM_RF_GRANT)} simulated RF</span> and can
              refill for free from{" "}
              <Link href="/mine" className="text-teal hover:underline">
                My Friends
              </Link>
              . Nothing leaves your browser. Nothing reaches a token contract.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
              <Stat label="Tip amounts" value="100 / 500 / 2.5k" sub="simulated RF" tone="orange" />
              <Stat label="Studio unlock" value="2,500" sub="simulated RF" tone="violet" />
            </div>
          </Panel>

          <Panel title="built for">
            <div className="font-display text-base font-semibold text-ink">
              Rare Friends Vibeathon
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-dim">
              A generative music player for the Rare Friends collections on Robinhood Chain. Same
              token, same tune, forever, because the score was already on chain.
            </p>
          </Panel>
        </aside>
      </div>
    </Shell>
  );
}
