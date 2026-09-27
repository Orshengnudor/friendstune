import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHead, Shell } from "../components/shell";
import { Btn, Panel, Spinner, Tag } from "../components/kit";
import { FriendTile } from "../components/friend-tile";
import { sampleFamilies } from "../lib/friends";
import { FAMILY_MODE, FAMILY_WAVE, SCALES } from "../lib/music";
import { FAMILY_NAMES } from "../lib/chain";
import { cn } from "../lib/utils";

const INTERVALS = ["1", "2", "b3/3", "4/#4", "5", "6", "7"];

/** How each family's mode reads out loud, fully derived from FAMILY_MODE. */
function modeBlurb(mode: string) {
  const degrees = SCALES[mode] ?? [];
  return `${degrees.length} notes · ${degrees.join(" · ")} semitones`;
}

export default function Atlas() {
  const [salt, setSalt] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  const census = useQuery({
    queryKey: ["families", salt],
    queryFn: () => sampleFamilies(180),
    staleTime: Infinity,
  });

  const total = useMemo(
    () => Object.values(census.data ?? {}).reduce((a, ids) => a + ids.length, 0),
    [census.data],
  );

  return (
    <Shell>
      <PageHead
        eyebrow="Family Atlas"
        title="Nine families, nine modes"
        right={
          <Btn onClick={() => setSalt((s) => s + 1)} disabled={census.isFetching}>
            {census.isFetching ? "sampling…" : "resample"}
          </Btn>
        }
      >
        Every Generations Friend belongs to one of nine families, and the on-chain families
        registry will tell you which for any token id. Friendstune maps each family to a musical
        mode, so a family is something you can hear. Open a tile to listen to live members of it.
      </PageHead>

      <Panel
        title="live sample"
        right={
          <span className="data text-[10px] text-ink-dim">
            {census.isLoading
              ? "reading familyOf() …"
              : `${total} token ids resolved · ${FAMILY_NAMES.length} families`}
          </span>
        }
        bodyClass="p-0"
      >
        <p className="border-b border-line px-4 py-3 text-xs leading-relaxed text-ink-dim">
          There is no indexer behind this page. Friendstune picks random token ids up to the live{" "}
          <span className="data text-ink">totalMinted()</span> and calls{" "}
          <span className="data text-ink">familyOf(tokenId)</span> on the registry contract for
          each, a single cheap read. Ids that were never minted revert and are dropped, so the
          counts below are a fresh random sample, not a full census.
        </p>

        {census.isLoading ? (
          <Spinner label="sampling the chain" />
        ) : census.isError ? (
          <div className="px-4 py-8 text-center text-sm text-orange">
            The RPC refused that sample. Try resampling.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
            {FAMILY_NAMES.map((name, index) => {
              const ids = census.data?.[index] ?? [];
              const mode = FAMILY_MODE[name] ?? "minor";
              const wave = FAMILY_WAVE[name] ?? "triangle";
              const share = total ? Math.round((ids.length / total) * 100) : 0;
              const isOpen = open === index;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setOpen(isOpen ? null : index)}
                  className={cn(
                    "group relative flex min-h-[168px] flex-col bg-panel px-4 py-4 text-left transition-colors hover:bg-panel-2",
                    isOpen && "bg-panel-2",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-display text-base font-semibold text-ink">{name}</div>
                      <div className="micro mt-1 truncate">
                        idx {index} · {ids.length} found
                      </div>
                    </div>
                    <Tag tone={isOpen ? "teal" : "dim"}>{mode}</Tag>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg">
                      <div
                        className="h-full rounded-full bg-teal/70"
                        style={{ width: `${Math.max(share * 3, ids.length ? 6 : 0)}%` }}
                      />
                    </div>
                    <span className="data text-[10px] text-ink-dim">{share}%</span>
                  </div>

                  <div className="data mt-3 space-y-1 text-[10px] text-ink-dim">
                    <div className="truncate">{modeBlurb(mode)}</div>
                    <div className="truncate text-violet/80">osc {wave}</div>
                  </div>

                  <div className="micro mt-auto pt-3 text-teal opacity-0 transition-opacity group-hover:opacity-100">
                    {isOpen ? "hide members" : "hear members"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Panel>

      {open !== null && (
        <div className="ft-rise mt-6">
          <Panel
            title={`${FAMILY_NAMES[open]} · live members`}
            right={
              <div className="flex items-center gap-2">
                <Tag tone="teal">{FAMILY_MODE[FAMILY_NAMES[open]]}</Tag>
                <Btn size="sm" onClick={() => setOpen(null)}>
                  close
                </Btn>
              </div>
            }
          >
            {(census.data?.[open] ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-dim">
                This sample turned up no {FAMILY_NAMES[open]} members. Resample to look again, because
                family distribution is uneven across the population.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {(census.data?.[open] ?? []).slice(0, 12).map((id) => (
                  <FriendTile key={id} collection="generations" tokenId={id} compact />
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      <Panel title="the mapping" className="mt-6" bodyClass="p-0">
        <div className="no-scrollbar overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="micro px-4 py-2.5">family</th>
                <th className="micro px-4 py-2.5">mode</th>
                <th className="micro px-4 py-2.5">scale degrees</th>
                <th className="micro px-4 py-2.5">lead oscillator</th>
              </tr>
            </thead>
            <tbody>
              {FAMILY_NAMES.map((name) => {
                const mode = FAMILY_MODE[name] ?? "minor";
                return (
                  <tr key={name} className="border-b border-line/60 last:border-0">
                    <td className="data px-4 py-2.5 text-xs text-ink">{name}</td>
                    <td className="data px-4 py-2.5 text-xs text-teal">{mode}</td>
                    <td className="data px-4 py-2.5 text-xs text-ink-dim">
                      {(SCALES[mode] ?? []).join(" · ")}
                    </td>
                    <td className="data px-4 py-2.5 text-xs text-violet">
                      {FAMILY_WAVE[name] ?? "triangle"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-3 text-[11px] text-ink-dim">
          Degrees are semitones above the root. The root itself is not fixed by family, it comes
          from the token's own <span className="data text-ink">Seed</span>, so two Friends in the
          same family share a mode but rarely a key. Intervals read as {INTERVALS.join(" / ")}.
        </p>
      </Panel>
    </Shell>
  );
}
