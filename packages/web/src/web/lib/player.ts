// Who is on the deck right now. Kept outside React so playback and the transport
// survive navigation between pages.
import { useSyncExternalStore } from "react";
import type { Friend } from "./friends";
import type { Composition } from "./music";
import { DEFAULT_REMIX, engine, type RemixSettings } from "./audio";
import { store } from "./store";
import { recordPlay } from "../queries/charts";

export interface Queue {
  label: string;
  next?: () => void;
  prev?: () => void;
}

export interface NowPlaying {
  friend: Friend | null;
  comp: Composition | null;
  queue: Queue | null;
}

const empty: NowPlaying = { friend: null, comp: null, queue: null };

class Player {
  private state: NowPlaying = empty;
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.state;

  private emit(next: NowPlaying) {
    this.state = next;
    for (const fn of this.listeners) fn();
  }

  setQueue(queue: Queue | null) {
    this.emit({ ...this.state, queue });
  }

  async start(
    friend: Friend,
    comp: Composition,
    opts: { settings?: RemixSettings; queue?: Queue | null; onFinish?: () => void } = {},
  ) {
    this.emit({
      friend,
      comp,
      queue: opts.queue !== undefined ? opts.queue : this.state.queue,
    });
    if (store.registerPlay(comp.key)) {
      recordPlay(comp.key, { name: friend.name, generation: friend.generation, tier: friend.tier });
    }
    await engine.play(comp, {
      settings: opts.settings ?? { ...DEFAULT_REMIX },
      onFinish: opts.onFinish,
      loops: opts.onFinish ? 2 : undefined,
    });
  }

  stop() {
    engine.stop();
  }

  clearQueue() {
    this.emit({ ...this.state, queue: null });
  }
}

export const player = new Player();

export function useNowPlaying() {
  return useSyncExternalStore(player.subscribe, player.getSnapshot, player.getSnapshot);
}
