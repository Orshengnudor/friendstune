import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { base } from "../__core/app.js";
import { db } from "../database/index.js";
import { friendDownloads, friendLikes, friendStats } from "../database/schema.js";

/**
 * The charts API. Shared, public counters for every Friend: likes, plays,
 * saves, tune downloads and the simulated RF that landed in the Friend's own
 * wallet. This is the only state in Friendstune that is not per-browser.
 *
 * Simulated RF is play money minted by the client store, never the real
 * $RAREFRIENDS token, and no amount here is ever settled on chain.
 */

const keySchema = z
  .string()
  .regex(/^(genesis|generations):\d{1,7}$/, "key must be genesis:<id> or generations:<id>");

/** Trait snapshot the client sends so a chart row can render without a chain read. */
const metaSchema = z
  .object({
    name: z.string().max(120).optional(),
    generation: z.number().int().min(0).max(12).nullable().optional(),
    tier: z.number().int().min(0).max(8).nullable().optional(),
  })
  .optional();

type Meta = z.infer<typeof metaSchema>;

const listener = z.string().min(3).max(80);

const parseKey = (key: string) => {
  const [collection, tokenId] = key.split(":");
  return { collection, tokenId: Number(tokenId) };
};

/** Creates the row on first touch, then applies the deltas. */
async function bump(
  key: string,
  delta: Partial<
    Record<"likes" | "plays" | "saves" | "downloads" | "tipsRf" | "salesRf", number>
  >,
  meta?: Meta,
) {
  const { collection, tokenId } = parseKey(key);
  const earned = (delta.tipsRf ?? 0) + (delta.salesRf ?? 0);
  const inc = (column: string, by: number | undefined) =>
    by ? sql.raw(`${column} + ${Math.trunc(by)}`) : undefined;

  await db
    .insert(friendStats)
    .values({
      key,
      collection,
      tokenId,
      name: meta?.name ?? null,
      generation: meta?.generation ?? null,
      tier: meta?.tier ?? null,
      likes: Math.max(0, delta.likes ?? 0),
      plays: Math.max(0, delta.plays ?? 0),
      saves: Math.max(0, delta.saves ?? 0),
      downloads: Math.max(0, delta.downloads ?? 0),
      tipsRf: Math.max(0, delta.tipsRf ?? 0),
      salesRf: Math.max(0, delta.salesRf ?? 0),
      earnedRf: Math.max(0, earned),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: friendStats.key,
      set: {
        likes: inc("likes", delta.likes),
        plays: inc("plays", delta.plays),
        saves: inc("saves", delta.saves),
        downloads: inc("downloads", delta.downloads),
        tipsRf: inc("tips_rf", delta.tipsRf),
        salesRf: inc("sales_rf", delta.salesRf),
        earnedRf: inc("earned_rf", earned),
        name: meta?.name ?? sql`name`,
        generation: meta?.generation === undefined ? sql`generation` : (meta.generation ?? null),
        tier: meta?.tier === undefined ? sql`tier` : (meta.tier ?? null),
        updatedAt: new Date(),
      },
    });

  // Counters are never allowed below zero (an un-save on a fresh row).
  await db
    .update(friendStats)
    .set({ saves: 0 })
    .where(and(eq(friendStats.key, key), sql`saves < 0`));
  await db
    .update(friendStats)
    .set({ likes: 0 })
    .where(and(eq(friendStats.key, key), sql`likes < 0`));

  const [row] = await db.select().from(friendStats).where(eq(friendStats.key, key));
  return row;
}

const SORTS = {
  likes: friendStats.likes,
  plays: friendStats.plays,
  saves: friendStats.saves,
  downloads: friendStats.downloads,
  earned: friendStats.earnedRf,
} as const;

export const charts = {
  /** Counters for a specific set of Friends, for the Friend page and tiles. */
  stats: base
    .input(z.object({ keys: z.array(keySchema).max(60) }))
    .handler(async ({ input }) => {
      if (input.keys.length === 0) return [];
      return db.select().from(friendStats).where(inArray(friendStats.key, input.keys));
    }),

  /** The chart itself. */
  top: base
    .input(
      z.object({
        sort: z.enum(["likes", "plays", "saves", "downloads", "earned"]).default("likes"),
        collection: z.enum(["all", "genesis", "generations"]).default("all"),
        limit: z.number().int().min(1).max(100).default(25),
      }),
    )
    .handler(async ({ input }) => {
      const column = SORTS[input.sort];
      const rows = await db
        .select()
        .from(friendStats)
        .where(
          input.collection === "all"
            ? sql`1 = 1`
            : eq(friendStats.collection, input.collection),
        )
        .orderBy(desc(column), desc(friendStats.updatedAt))
        .limit(input.limit);
      return rows.filter((r) => Number(r[input.sort === "earned" ? "earnedRf" : input.sort]) > 0);
    }),

  /** Scoreboard header: how much of the economy each collection holds. */
  totals: base.handler(async () => {
    const rows = await db
      .select({
        collection: friendStats.collection,
        friends: sql<number>`count(*)`,
        likes: sql<number>`coalesce(sum(likes), 0)`,
        plays: sql<number>`coalesce(sum(plays), 0)`,
        downloads: sql<number>`coalesce(sum(downloads), 0)`,
        earnedRf: sql<number>`coalesce(sum(earned_rf), 0)`,
      })
      .from(friendStats)
      .groupBy(friendStats.collection);
    return rows;
  }),

  /** What this listener has liked, so hearts render filled on return visits. */
  mine: base.input(z.object({ listener })).handler(async ({ input }) => {
    const rows = await db
      .select({ key: friendLikes.key })
      .from(friendLikes)
      .where(eq(friendLikes.listener, input.listener));
    return rows.map((r) => r.key);
  }),

  like: base
    .input(z.object({ key: keySchema, listener, on: z.boolean(), meta: metaSchema }))
    .handler(async ({ input }) => {
      const existing = await db
        .select({ id: friendLikes.id })
        .from(friendLikes)
        .where(and(eq(friendLikes.key, input.key), eq(friendLikes.listener, input.listener)));

      if (input.on) {
        if (existing.length > 0) {
          const [row] = await db.select().from(friendStats).where(eq(friendStats.key, input.key));
          return row;
        }
        await db.insert(friendLikes).values({ key: input.key, listener: input.listener });
        return bump(input.key, { likes: 1 }, input.meta);
      }

      if (existing.length === 0) {
        const [row] = await db.select().from(friendStats).where(eq(friendStats.key, input.key));
        return row;
      }
      await db
        .delete(friendLikes)
        .where(and(eq(friendLikes.key, input.key), eq(friendLikes.listener, input.listener)));
      return bump(input.key, { likes: -1 }, input.meta);
    }),

  play: base
    .input(z.object({ key: keySchema, meta: metaSchema }))
    .handler(({ input }) => bump(input.key, { plays: 1 }, input.meta)),

  save: base
    .input(z.object({ key: keySchema, on: z.boolean(), meta: metaSchema }))
    .handler(({ input }) => bump(input.key, { saves: input.on ? 1 : -1 }, input.meta)),

  /** A tip paid in simulated RF into the Friend's own wallet. */
  tip: base
    .input(
      z.object({
        key: keySchema,
        listener,
        amount: z.number().int().min(1).max(100_000),
        meta: metaSchema,
      }),
    )
    .handler(({ input }) => bump(input.key, { tipsRf: input.amount }, input.meta)),

  /**
   * A tune download. "holder" is free because the wallet holds the NFT, "paid"
   * sends its simulated RF price into the Friend's own wallet.
   */
  download: base
    .input(
      z.object({
        key: keySchema,
        listener,
        kind: z.enum(["holder", "paid"]),
        priceRf: z.number().int().min(0).max(1_000_000),
        meta: metaSchema,
      }),
    )
    .handler(async ({ input }) => {
      if (input.kind === "holder" && input.priceRf !== 0) {
        throw new ORPCError("BAD_REQUEST", { message: "A holder download is free" });
      }
      await db.insert(friendDownloads).values({
        key: input.key,
        listener: input.listener,
        kind: input.kind,
        priceRf: input.priceRf,
      });
      return bump(
        input.key,
        { downloads: 1, salesRf: input.kind === "paid" ? input.priceRf : 0 },
        input.meta,
      );
    }),

  /** Keys this listener already paid for, so a second download is not charged twice. */
  purchases: base.input(z.object({ listener })).handler(async ({ input }) => {
    const rows = await db
      .select({ key: friendDownloads.key })
      .from(friendDownloads)
      .where(and(eq(friendDownloads.listener, input.listener), eq(friendDownloads.kind, "paid")));
    return [...new Set(rows.map((r) => r.key))];
  }),
};
