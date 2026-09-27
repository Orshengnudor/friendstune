import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useConnection } from "wagmi";
import type { Collection } from "./chain";
import {
  collectionCeiling,
  discoverOwned,
  fetchFriend,
  fetchGenerationsMinted,
  fetchOwner,
  friendKey,
  randomIds,
  type Friend,
} from "./friends";
import { deriveComposition } from "./music";
import { engine, type EngineState } from "./audio";
import { store } from "./store";

/** One Friend, read live from chain, plus its derived composition. */
export function useFriend(collection: Collection, tokenId: string | undefined) {
  const q = useQuery({
    queryKey: ["friend", collection, tokenId],
    queryFn: () => fetchFriend(collection, tokenId as string),
    enabled: !!tokenId,
  });
  const comp = useMemo(() => (q.data ? deriveComposition(q.data) : null), [q.data]);
  return { ...q, friend: q.data ?? null, comp };
}

export function useOwner(collection: Collection, tokenId: string | undefined) {
  return useQuery({
    queryKey: ["owner", collection, tokenId],
    queryFn: () => fetchOwner(collection, tokenId as string),
    enabled: !!tokenId,
  });
}

export function useGenerationsMinted() {
  return useQuery({ queryKey: ["minted"], queryFn: fetchGenerationsMinted });
}

export function useCeiling(collection: Collection) {
  return useQuery({
    queryKey: ["ceiling", collection],
    queryFn: () => collectionCeiling(collection),
  });
}

/** A batch of real, live token ids that exist. */
export function useRandomIds(collection: Collection, count: number, salt = 0) {
  return useQuery({
    queryKey: ["random", collection, count, salt],
    queryFn: () => randomIds(collection, count),
    staleTime: Infinity,
  });
}

export function useOwned(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["owned", address],
    queryFn: () => discoverOwned(address as `0x${string}`),
    enabled: !!address,
    staleTime: 60_000,
  });
}

/** Playback engine state, shared app-wide. */
export function useEngine(): EngineState {
  return useSyncExternalStore(
    (fn) => engine.subscribe(() => fn()),
    () => engine.getState(),
    () => engine.getState(),
  );
}

/** Keeps the simulated-RF ledger pointed at the connected wallet (or "guest"). */
export function useIdentitySync() {
  const { address } = useConnection();
  useEffect(() => {
    store.setIdentity(address ?? null);
  }, [address]);
}

export const keyOf = (f: Friend) => friendKey(f);

/** requestAnimationFrame ticker for audio-reactive visuals. */
export function useRaf(active: boolean, fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const loop = () => {
      ref.current();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatch(mq.matches);
    const on = () => setMatch(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}
