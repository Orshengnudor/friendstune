import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "../lib/api";
import { useSimRf } from "../lib/store";

/**
 * The charts are the app's only shared data: every listener's likes, plays,
 * saves, downloads and simulated tips land in one table so Genesis and
 * Generations can actually be compared. Identity is the connected wallet when
 * there is one, otherwise this browser's guest id.
 */

export type ChartSort = "likes" | "plays" | "saves" | "downloads" | "earned";
export type ChartScope = "all" | "genesis" | "generations";

export interface FriendMeta {
  name?: string;
  generation?: number | null;
  tier?: number | null;
}

export function useChartTop(sort: ChartSort, collection: ChartScope, limit = 25) {
  return useQuery({
    ...orpc.charts.top.queryOptions({ input: { sort, collection, limit } }),
    staleTime: 15_000,
  });
}

export function useChartTotals() {
  return useQuery({ ...orpc.charts.totals.queryOptions(), staleTime: 15_000 });
}

/** Counters for one Friend. */
export function useFriendStats(key: string | undefined) {
  const q = useQuery({
    ...orpc.charts.stats.queryOptions({ input: { keys: key ? [key] : [] } }),
    enabled: !!key,
    staleTime: 5_000,
  });
  return { ...q, stats: q.data?.[0] ?? null };
}

export function useMyLikes() {
  const { identity } = useSimRf();
  return useQuery({
    ...orpc.charts.mine.queryOptions({ input: { listener: identity } }),
    staleTime: 30_000,
  });
}

export function useMyPurchases() {
  const { identity } = useSimRf();
  return useQuery({
    ...orpc.charts.purchases.queryOptions({ input: { listener: identity } }),
    staleTime: 30_000,
  });
}

function useChartRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: orpc.charts.key() });
  };
}

export function useToggleLike() {
  const { identity } = useSimRf();
  const refresh = useChartRefresh();
  return useMutation({
    mutationFn: (vars: { key: string; on: boolean; meta?: FriendMeta }) =>
      client.charts.like({ key: vars.key, listener: identity, on: vars.on, meta: vars.meta }),
    onSuccess: refresh,
  });
}

export function useRecordSave() {
  const refresh = useChartRefresh();
  return useMutation({
    mutationFn: (vars: { key: string; on: boolean; meta?: FriendMeta }) =>
      client.charts.save(vars),
    onSuccess: refresh,
  });
}

export function useRecordTip() {
  const { identity } = useSimRf();
  const refresh = useChartRefresh();
  return useMutation({
    mutationFn: (vars: { key: string; amount: number; meta?: FriendMeta }) =>
      client.charts.tip({ ...vars, listener: identity }),
    onSuccess: refresh,
  });
}

export function useRecordDownload() {
  const { identity } = useSimRf();
  const refresh = useChartRefresh();
  return useMutation({
    mutationFn: (vars: {
      key: string;
      kind: "holder" | "paid";
      priceRf: number;
      meta?: FriendMeta;
    }) => client.charts.download({ ...vars, listener: identity }),
    onSuccess: refresh,
  });
}

/** Plays are fire-and-forget: a failed count must never interrupt playback. */
export function recordPlay(key: string, meta?: FriendMeta) {
  void client.charts.play({ key, meta }).catch(() => {});
}
