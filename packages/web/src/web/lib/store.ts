import { useSyncExternalStore } from "react";

/**
 * SIMULATED RF. Read this before touching anything below.
 *
 * Friendstune never moves a real token. The $RAREFRIENDS contract is never
 * called, nothing is transferred, nothing is burned, no approval is ever
 * requested. Every wallet that connects (and every guest that doesn't) gets
 * 100,000 SIMULATED RF held in this browser's localStorage, refillable at any
 * time, purely so the tipping and Remix Studio economy can be played with
 * safely. Every surface that shows it is labelled SIMULATED.
 */
export const SIM_RF_GRANT = 100_000;

export interface LedgerEntry {
  id: string;
  ts: number;
  kind: "grant" | "refill" | "tip" | "unlock" | "download";
  amount: number;
  label: string;
  friendKey?: string;
}

export interface Persisted {
  balance: number;
  ledger: LedgerEntry[];
  /** friendKey -> total simulated RF tipped into that Friend's own wallet */
  tips: Record<string, number>;
  /** friendKeys with the Remix Studio unlocked */
  unlocked: string[];
  /** friendKeys whose tune file has already been paid for, so it never charges twice */
  purchased: string[];
  favourites: string[];
  /** friendKey -> play count */
  plays: Record<string, number>;
  history: string[];
  streak: { days: number; lastDay: string | null };
  firstSeen: number;
}

const empty = (): Persisted => ({
  balance: 0,
  ledger: [],
  tips: {},
  unlocked: [],
  purchased: [],
  favourites: [],
  plays: {},
  history: [],
  streak: { days: 0, lastDay: null },
  firstSeen: Date.now(),
});

const IDENTITY_KEY = "friendstune:identity";
const dataKey = (identity: string) => `friendstune:v1:${identity.toLowerCase()}`;

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

function read(identity: string): Persisted {
  try {
    const raw = localStorage.getItem(dataKey(identity));
    if (!raw) return empty();
    return { ...empty(), ...(JSON.parse(raw) as Persisted) };
  } catch {
    return empty();
  }
}

function write(identity: string, data: Persisted) {
  try {
    localStorage.setItem(dataKey(identity), JSON.stringify(data));
  } catch {
    /* storage full or blocked. The app still works, it just won't remember */
  }
}

class Store {
  identity: string;
  data: Persisted;
  private listeners = new Set<() => void>();
  private snapshot: { identity: string; data: Persisted };

  constructor() {
    const saved =
      (typeof localStorage !== "undefined" && localStorage.getItem(IDENTITY_KEY)) || "guest";
    this.identity = saved;
    this.data = typeof localStorage !== "undefined" ? read(saved) : empty();
    this.ensureGrant();
    this.touchStreak();
    this.snapshot = { identity: this.identity, data: this.data };
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.snapshot;

  private commit() {
    write(this.identity, this.data);
    this.snapshot = { identity: this.identity, data: this.data };
    for (const fn of this.listeners) fn();
  }

  private mutate(fn: (d: Persisted) => void) {
    const next = { ...this.data };
    fn(next);
    this.data = next;
    this.commit();
  }

  private ensureGrant() {
    if (this.data.ledger.some((e) => e.kind === "grant")) return;
    this.data = {
      ...this.data,
      balance: SIM_RF_GRANT,
      firstSeen: Date.now(),
      ledger: [
        {
          id: uid(),
          ts: Date.now(),
          kind: "grant",
          amount: SIM_RF_GRANT,
          label: "Welcome grant of simulated RF",
        },
        ...this.data.ledger,
      ],
    };
  }

  private touchStreak() {
    const day = today();
    const last = this.data.streak.lastDay;
    if (last === day) return;
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    this.data = {
      ...this.data,
      streak: { days: last === yesterday ? this.data.streak.days + 1 : 1, lastDay: day },
    };
  }

  /** Called when a wallet connects/disconnects. Each identity has its own grant. */
  setIdentity(identity: string | null) {
    const next = identity ?? "guest";
    if (next.toLowerCase() === this.identity.toLowerCase()) return;
    this.identity = next;
    try {
      localStorage.setItem(IDENTITY_KEY, next);
    } catch {
      /* ignore */
    }
    this.data = read(next);
    this.ensureGrant();
    this.touchStreak();
    this.commit();
  }

  refill() {
    this.mutate((d) => {
      d.balance = Math.max(d.balance, 0) + SIM_RF_GRANT;
      d.ledger = [
        {
          id: uid(),
          ts: Date.now(),
          kind: "refill",
          amount: SIM_RF_GRANT,
          label: "Refilled simulated RF",
        },
        ...d.ledger,
      ].slice(0, 200);
    });
  }

  spend(
    amount: number,
    kind: "tip" | "unlock" | "download",
    label: string,
    friendKey?: string,
  ) {
    if (this.data.balance < amount) return false;
    this.mutate((d) => {
      d.balance -= amount;
      if (kind === "tip" && friendKey) {
        d.tips = { ...d.tips, [friendKey]: (d.tips[friendKey] ?? 0) + amount };
      }
      if (kind === "unlock" && friendKey && !d.unlocked.includes(friendKey)) {
        d.unlocked = [...d.unlocked, friendKey];
      }
      if (kind === "download" && friendKey && !d.purchased.includes(friendKey)) {
        d.purchased = [...d.purchased, friendKey];
      }
      d.ledger = [
        { id: uid(), ts: Date.now(), kind, amount, label, friendKey },
        ...d.ledger,
      ].slice(0, 200);
    });
    return true;
  }

  toggleFavourite(friendKey: string) {
    this.mutate((d) => {
      d.favourites = d.favourites.includes(friendKey)
        ? d.favourites.filter((k) => k !== friendKey)
        : [...d.favourites, friendKey];
    });
  }

  /** Returns false when the same Friend is already the most recent play. */
  registerPlay(friendKey: string) {
    if (this.data.history[0] === friendKey) return false;
    this.mutate((d) => {
      d.plays = { ...d.plays, [friendKey]: (d.plays[friendKey] ?? 0) + 1 };
      d.history = [friendKey, ...d.history.filter((k) => k !== friendKey)].slice(0, 40);
    });
    return true;
  }
}

export const store = new Store();

export function useStore() {
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return snap;
}

export function useSimRf() {
  const { identity, data } = useStore();
  return {
    identity,
    balance: data.balance,
    ledger: data.ledger,
    tips: data.tips,
    unlocked: data.unlocked,
    purchased: data.purchased,
    favourites: data.favourites,
    plays: data.plays,
    history: data.history,
    streak: data.streak,
  };
}

export const formatRf = (n: number) =>
  n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 0 }) : String(n);

export interface Badge {
  id: string;
  label: string;
  detail: string;
  earned: boolean;
}

export function computeBadges(data: Persisted): Badge[] {
  const totalPlays = Object.values(data.plays).reduce((a, b) => a + b, 0);
  const distinct = Object.keys(data.plays).length;
  const tipped = Object.keys(data.tips).length;
  const tipTotal = Object.values(data.tips).reduce((a, b) => a + b, 0);
  return [
    {
      id: "first-listen",
      label: "First Listen",
      detail: "Played a Friend's tune",
      earned: totalPlays >= 1,
    },
    {
      id: "crate-digger",
      label: "Crate Digger",
      detail: "Heard 10 different Friends",
      earned: distinct >= 10,
    },
    {
      id: "archivist",
      label: "Archivist",
      detail: "Heard 50 different Friends",
      earned: distinct >= 50,
    },
    {
      id: "patron",
      label: "Patron",
      detail: "Tipped 3 Friends (simulated)",
      earned: tipped >= 3,
    },
    {
      id: "benefactor",
      label: "Benefactor",
      detail: "Tipped 25,000 simulated RF",
      earned: tipTotal >= 25_000,
    },
    {
      id: "producer",
      label: "Producer",
      detail: "Unlocked a Remix Studio",
      earned: data.unlocked.length >= 1,
    },
    {
      id: "regular",
      label: "Regular",
      detail: "3-day listening streak",
      earned: data.streak.days >= 3,
    },
    {
      id: "resident",
      label: "Resident",
      detail: "7-day listening streak",
      earned: data.streak.days >= 7,
    },
  ];
}
