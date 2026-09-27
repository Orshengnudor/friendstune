import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * FRIENDSTUNE CHARTS
 * ------------------
 * The only server-side state in the app. It holds the public counters behind
 * the charts: likes, plays, saves, tune downloads and the simulated RF that
 * landed in each Friend's own wallet.
 *
 * Nothing in here is a token balance. Simulated RF is the app's play money
 * (see src/web/lib/store.ts). The real $RAREFRIENDS contract is never called.
 *
 * A Friend is keyed by "collection:tokenId", e.g. "genesis:512".
 */
export const friendStats = sqliteTable(
  "friend_stats",
  {
    key: text("key").primaryKey(),
    collection: text("collection").notNull(),
    tokenId: integer("token_id").notNull(),
    /** Denormalised so the charts can render a row without a chain read. */
    name: text("name"),
    generation: integer("generation"),
    tier: integer("tier"),
    likes: integer("likes").notNull().default(0),
    plays: integer("plays").notNull().default(0),
    saves: integer("saves").notNull().default(0),
    downloads: integer("downloads").notNull().default(0),
    /** Simulated RF tipped into this Friend's own wallet. */
    tipsRf: integer("tips_rf").notNull().default(0),
    /** Simulated RF paid to this Friend for paid tune downloads. */
    salesRf: integer("sales_rf").notNull().default(0),
    /** tipsRf + salesRf, kept materialised so the charts can sort on it. */
    earnedRf: integer("earned_rf").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("friend_stats_likes").on(t.likes),
    index("friend_stats_earned").on(t.earnedRf),
    index("friend_stats_collection").on(t.collection),
  ],
);

/** One row per listener per Friend, so a like can be taken back but not doubled. */
export const friendLikes = sqliteTable(
  "friend_likes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull(),
    /** Wallet address when connected, otherwise the browser's guest id. */
    listener: text("listener").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("friend_likes_unique").on(t.key, t.listener), index("friend_likes_listener").on(t.listener)],
);

/** Receipts for tune downloads: free for the holder, priced in simulated RF for everyone else. */
export const friendDownloads = sqliteTable(
  "friend_downloads",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull(),
    listener: text("listener").notNull(),
    /** "holder" (free, wallet holds the NFT) or "paid" (simulated RF). */
    kind: text("kind").notNull(),
    priceRf: integer("price_rf").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("friend_downloads_key").on(t.key), index("friend_downloads_listener").on(t.listener)],
);
