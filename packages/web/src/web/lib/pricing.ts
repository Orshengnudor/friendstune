import type { Friend } from "./friends";

/**
 * WHAT A TUNE COSTS
 * -----------------
 * A Friend's tune is free to the wallet that holds the NFT. Everyone else pays
 * for the file in SIMULATED RF, and that payment lands in the Friend's own
 * wallet, mirroring how the real protocol keeps rewards with the Friend rather
 * than the holder.
 *
 * The floor price follows the protocol's own ladder. Hardwiring a Generation
 * costs ten times the one below it (Gen 6 = 1 RF, Gen 1 = 100,000 RF) and
 * Genesis sits above all of it, so the ladder here doubles per generation and
 * adds a small step per activation tier, with Genesis priced above the top of
 * the Generations ladder:
 *
 *   Gen 6 t0    50 RF        Gen 3 t0   400 RF
 *   Gen 5 t0   100 RF        Gen 2 t0   800 RF
 *   Gen 4 t0   200 RF        Gen 1 t0 1,600 RF   (t4 = 1,920 RF)
 *   Genesis  2,000 RF
 *
 * On top of the floor sits demand: the listens, likes, saves and tips the
 * charts have recorded for that Friend. A Friend nobody has heard sells at its
 * floor. A charting Friend costs up to three times that.
 */

export const GENESIS_FLOOR = 2000;
export const GENERATIONS_BASE = 50;
/** Tier adds 5% each, so the top of Gen 1 (1,920) still sits under Genesis. */
export const TIER_STEP = 0.05;
export const MAX_DEMAND_MULTIPLIER = 3;

export interface ChartCounters {
  likes?: number;
  plays?: number;
  saves?: number;
  downloads?: number;
  tipsRf?: number;
  earnedRf?: number;
}

export interface Price {
  /** What the ladder alone asks for. */
  floor: number;
  /** floor x demand, rounded to a clean number. */
  total: number;
  /** 1 = nobody has touched it yet. */
  demand: number;
  /** Human readable reasons the price moved off the floor. */
  drivers: { label: string; value: number }[];
  generationLabel: string;
}

const round = (n: number) => {
  if (n < 100) return Math.round(n / 5) * 5;
  if (n < 1000) return Math.round(n / 10) * 10;
  return Math.round(n / 50) * 50;
};

/** Generation 1 is the top of the ladder, 6 the entry. */
export function floorPrice(friend: {
  collection: string;
  generation: number | null;
  tier: number | null;
}) {
  if (friend.collection === "genesis") return GENESIS_FLOOR;
  const gen = Math.min(6, Math.max(1, friend.generation ?? 6));
  const tier = Math.min(4, Math.max(0, friend.tier ?? 0));
  const base = GENERATIONS_BASE * 2 ** (6 - gen);
  return round(base * (1 + TIER_STEP * tier));
}

export function priceFor(friend: Friend, counters: ChartCounters | undefined): Price {
  const floor = floorPrice(friend);
  const likes = counters?.likes ?? 0;
  const plays = counters?.plays ?? 0;
  const saves = counters?.saves ?? 0;
  const downloads = counters?.downloads ?? 0;
  const tips = counters?.tipsRf ?? 0;

  const drivers = [
    { label: "likes", value: likes * 0.04 },
    { label: "listens", value: plays * 0.01 },
    { label: "saves", value: saves * 0.03 },
    { label: "downloads", value: downloads * 0.05 },
    { label: "tips", value: Math.min(0.8, tips / 25_000) },
  ];
  const raw = drivers.reduce((sum, d) => sum + d.value, 0);
  const demand = Math.min(MAX_DEMAND_MULTIPLIER, 1 + raw);

  return {
    floor,
    total: round(floor * demand),
    demand,
    drivers: drivers.filter((d) => d.value > 0),
    generationLabel:
      friend.collection === "genesis"
        ? "Genesis"
        : `Gen ${friend.generation ?? 6} · tier ${friend.tier ?? 0}`,
  };
}
