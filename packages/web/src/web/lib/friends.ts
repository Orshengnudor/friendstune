import {
  addressFor,
  type Collection,
  ERC721_ABI,
  FAMILIES_REGISTRY_ABI,
  FAMILIES_REGISTRY_ADDRESS,
  FAMILY_NAMES,
  GENERATIONS_ABI,
  GENERATIONS_ADDRESS,
  GENESIS_ADDRESS,
  GENESIS_MAX_ID,
  publicClient,
  TRANSFER_EVENT,
} from "./chain";

export interface PixelGrid {
  /** Grid is always square: 8 for Genesis, 16 for Generations. */
  size: number;
  /** Row-major ink mask, true where the figure is drawn on chain. */
  cells: boolean[];
  inkCount: number;
}

export interface Friend {
  collection: Collection;
  tokenId: string;
  name: string;
  description: string;
  imageDataUri: string;
  grid: PixelGrid;
  traits: { type: string; value: string | number }[];
  /** Generations traits (null on Genesis, not present in its metadata). */
  generation: number | null;
  state: string | null;
  tier: number | null;
  character: string | null;
  scenery: string | null;
  floor: string | null;
  registryFamily: number | null;
  registryFamilyName: string | null;
  /** Genesis-only metadata. */
  dna: string | null;
  artVersion: string | null;
  lineage: string | null;
}

export const friendKey = (f: { collection: Collection; tokenId: string }) =>
  `${f.collection}:${f.tokenId}`;

function decodeDataUriJson(uri: string): Record<string, unknown> {
  if (uri.startsWith("data:application/json;base64,")) {
    const b64 = uri.slice(uri.indexOf(",") + 1);
    return JSON.parse(atob(b64)) as Record<string, unknown>;
  }
  if (uri.startsWith("data:application/json")) {
    return JSON.parse(decodeURIComponent(uri.slice(uri.indexOf(",") + 1))) as Record<
      string,
      unknown
    >;
  }
  throw new Error("Unexpected tokenURI format (expected an on-chain data URI)");
}

/**
 * Both collections render their artwork fully on chain as a single <path> of
 * 1x1 rects over a solid background, so the path cells ARE the figure:
 * Genesis draws black ink on white in an 8x8 viewBox, Generations draws white
 * ink on black in a 512 viewBox with `scale(32)` (= 16x16). Parsing it gives
 * the exact bitmap the contract drew, which is what Friendstune sequences.
 */
export function parseArtworkGrid(svg: string): PixelGrid {
  const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  const scale = /scale\((\d+(?:\.\d+)?)\)/.exec(svg);
  const viewW = viewBox ? Number(viewBox[1]) : 8;
  const size = Math.max(1, Math.round(viewW / (scale ? Number(scale[1]) : 1)));

  const cells = new Array<boolean>(size * size).fill(false);
  const pathMatch = /<path[^>]*\sd="([^"]+)"/.exec(svg);
  let inkCount = 0;
  if (pathMatch) {
    const re = /M(-?\d+)[ ,](-?\d+)h(\d+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(pathMatch[1])) !== null) {
      const x = Number(m[1]);
      const y = Number(m[2]);
      const w = Number(m[3]);
      for (let i = 0; i < w; i++) {
        const px = x + i;
        if (px < 0 || px >= size || y < 0 || y >= size) continue;
        const idx = y * size + px;
        if (!cells[idx]) inkCount++;
        cells[idx] = true;
      }
    }
  }
  return { size, cells, inkCount };
}

const attr = (
  list: { trait_type?: string; value?: unknown }[] | undefined,
  ...names: string[]
): string | number | null => {
  if (!list) return null;
  for (const name of names) {
    const hit = list.find((a) => a?.trait_type?.toLowerCase() === name.toLowerCase());
    if (hit && hit.value !== undefined && hit.value !== null) {
      return hit.value as string | number;
    }
  }
  return null;
};

const asNumber = (v: string | number | null): number | null => {
  if (v === null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function fetchFriend(collection: Collection, tokenId: string): Promise<Friend> {
  const address = addressFor(collection);
  const id = BigInt(tokenId);

  const uri = await publicClient.readContract({
    address,
    abi: ERC721_ABI,
    functionName: "tokenURI",
    args: [id],
  });

  const meta = decodeDataUriJson(uri);
  const image = String(meta.image ?? "");
  const svg = image.startsWith("data:image/svg+xml;base64,")
    ? atob(image.slice(image.indexOf(",") + 1))
    : "";
  const grid = svg ? parseArtworkGrid(svg) : { size: 8, cells: [], inkCount: 0 };

  const attrs = (meta.attributes ?? []) as { trait_type?: string; value?: unknown }[];
  const properties = (meta.properties ?? {}) as Record<string, unknown>;

  let registryFamily: number | null = null;
  let generation: number | null = null;
  if (collection === "generations") {
    const [fam, gen] = await Promise.all([
      publicClient
        .readContract({
          address: FAMILIES_REGISTRY_ADDRESS,
          abi: FAMILIES_REGISTRY_ABI,
          functionName: "familyOf",
          args: [id],
        })
        .catch(() => null),
      publicClient
        .readContract({
          address: GENERATIONS_ADDRESS,
          abi: GENERATIONS_ABI,
          functionName: "generation",
          args: [id],
        })
        .catch(() => null),
    ]);
    registryFamily = fam === null ? null : Number(fam);
    generation = gen === null ? asNumber(attr(attrs, "Generation")) : Number(gen);
  }

  return {
    collection,
    tokenId,
    name: String(meta.name ?? `${collection} #${tokenId}`),
    description: String(meta.description ?? ""),
    imageDataUri: image,
    grid,
    traits: attrs
      .filter((a) => a?.trait_type)
      .map((a) => ({ type: String(a.trait_type), value: a.value as string | number })),
    generation,
    state: (attr(attrs, "State") as string | null) ?? null,
    tier: asNumber(attr(attrs, "Activation tier", "Activation Tier", "Tier")),
    character: (attr(attrs, "Character") as string | null) ?? null,
    scenery: (attr(attrs, "Scenery") as string | null) ?? null,
    floor: (attr(attrs, "Floor") as string | null) ?? null,
    registryFamily,
    registryFamilyName:
      registryFamily !== null && registryFamily >= 0 && registryFamily < FAMILY_NAMES.length
        ? FAMILY_NAMES[registryFamily]
        : null,
    dna: properties.dna ? String(properties.dna) : null,
    artVersion: meta.art_version ? String(meta.art_version) : null,
    lineage: (attr(attrs, "Lineage") as string | null) ?? null,
  };
}

/** Family label for either collection: Generations use Character, Genesis use Lineage. */
export const familyLabel = (f: Friend) =>
  f.character ?? f.registryFamilyName ?? f.lineage ?? "n/a";

let mintedCache: number | null = null;

export async function fetchGenerationsMinted(): Promise<number> {
  if (mintedCache !== null) return mintedCache;
  const total = await publicClient.readContract({
    address: GENERATIONS_ADDRESS,
    abi: GENERATIONS_ABI,
    functionName: "totalMinted",
  });
  mintedCache = Number(total);
  return mintedCache;
}

export async function fetchOwner(collection: Collection, tokenId: string) {
  try {
    return await publicClient.readContract({
      address: addressFor(collection),
      abi: ERC721_ABI,
      functionName: "ownerOf",
      args: [BigInt(tokenId)],
    });
  } catch {
    return null;
  }
}

export async function collectionCeiling(collection: Collection) {
  return collection === "genesis" ? GENESIS_MAX_ID : await fetchGenerationsMinted();
}

/** Deterministic-ish random page of live token ids for a collection. */
export async function randomIds(collection: Collection, count: number): Promise<string[]> {
  const ceiling = await collectionCeiling(collection);
  const out = new Set<string>();
  while (out.size < count) {
    out.add(String(1 + Math.floor(Math.random() * ceiling)));
  }
  return [...out];
}

export interface OwnedTokens {
  genesis: string[];
  generations: string[];
}

/**
 * Ownership discovery straight off the chain: pull every Transfer that ever
 * landed on the wallet (the RPC serves a full-range eth_getLogs in ~200ms for
 * both contracts) then re-check ownerOf so tokens later sold or burned drop out.
 * No third-party indexer involved.
 */
export async function discoverOwned(owner: `0x${string}`): Promise<OwnedTokens> {
  const scan = async (collection: Collection, address: `0x${string}`) => {
    const logs = await publicClient.getLogs({
      address,
      event: TRANSFER_EVENT,
      args: { to: owner },
      fromBlock: 0n,
      toBlock: "latest",
    });
    const candidates = [...new Set(logs.map((l) => (l.args.tokenId as bigint).toString()))];
    const held: string[] = [];
    await mapChunked(candidates, 24, async (id) => {
      const current = await fetchOwner(collection, id);
      if (current && current.toLowerCase() === owner.toLowerCase()) held.push(id);
    });
    return held.sort((a, b) => Number(a) - Number(b));
  };

  const [genesis, generations] = await Promise.all([
    scan("genesis", GENESIS_ADDRESS).catch(() => []),
    scan("generations", GENERATIONS_ADDRESS).catch(() => []),
  ]);
  return { genesis, generations };
}

/**
 * Family census. `familyOf(id)` on the registry is a single cheap uint8 read, so
 * sampling ids and grouping them gives live representatives per family without
 * pulling metadata for any of them. Unminted ids simply throw and are skipped.
 */
/** Runs an async map in fixed-size waves so the RPC is never flooded. */
export async function mapChunked<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

export async function sampleFamilies(perRequest = 144): Promise<Record<number, string[]>> {
  const ceiling = await fetchGenerationsMinted();
  const ids = new Set<string>();
  while (ids.size < perRequest) ids.add(String(1 + Math.floor(Math.random() * ceiling)));

  const readFamily = async (id: string) => {
    const fam = await publicClient.readContract({
      address: FAMILIES_REGISTRY_ADDRESS,
      abi: FAMILIES_REGISTRY_ABI,
      functionName: "familyOf",
      args: [BigInt(id)],
    });
    return Number(fam);
  };

  const out: Record<number, string[]> = {};
  // Chunked, not all at once: past roughly 40 calls in flight the RPC starts
  // dropping them, and a dropped call looks exactly like an unminted id.
  await mapChunked([...ids], 24, async (id) => {
    let index: number | null = null;
    for (let attempt = 0; attempt < 2 && index === null; attempt++) {
      try {
        index = await readFamily(id);
      } catch {
        index = null;
      }
    }
    if (index === null || !Number.isFinite(index) || index < 0 || index >= FAMILY_NAMES.length) {
      return;
    }
    (out[index] ??= []).push(id);
  });
  return out;
}
