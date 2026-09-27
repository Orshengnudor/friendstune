import { createPublicClient, defineChain, http, parseAbi, parseAbiItem } from "viem";

/**
 * Robinhood Chain mainnet. Every read in this app is a live browser -> RPC call
 * (the RPC sends `access-control-allow-origin: *` and supports JSON-RPC batching),
 * so Friendstune needs no indexer, no server and no database.
 */
export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" },
  },
});

export const EXPLORER = "https://robinhoodchain.blockscout.com";

export const GENESIS_ADDRESS = "0x116EaA62241751E0c98dA43d458600c6C17cD361" as const;
export const GENERATIONS_ADDRESS = "0x14C49e6118F46525dE9ab41a51cBAA3c6EBF181D" as const;
export const FAMILIES_REGISTRY_ADDRESS = "0x246E3E9730A7Eade94c79be0Fd78d210f89AEb8D" as const;

/** Genesis is capped at 1,024 originals (protocol docs + verified: id 1024 exists, 1025 does not). */
export const GENESIS_MAX_ID = 1024;

/** Registry family index -> name. Verified against the `Character` metadata trait. */
export const FAMILY_NAMES = [
  "Skeleton",
  "Mask",
  "Family",
  "Cellular",
  "Asymmetry",
  "Hoverer",
  "Colossus",
  "Sparkling",
  "Hollow",
] as const;

export type Collection = "genesis" | "generations";

export const COLLECTION_LABEL: Record<Collection, string> = {
  genesis: "Genesis",
  generations: "Generations",
};

export const addressFor = (collection: Collection) =>
  collection === "genesis" ? GENESIS_ADDRESS : GENERATIONS_ADDRESS;

/**
 * Only functions verified to exist against the live contracts are listed here.
 * Verified present: ownerOf, tokenURI, balanceOf, generation (Generations only),
 * totalMinted (Generations only), familyOf (registry).
 * Verified ABSENT (they revert): totalSupply, nextTokenId, tokenOfOwnerByIndex,
 * and `generation` on Genesis. Do not guess extra functions onto these ABIs.
 */
export const ERC721_ABI = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
  "function name() view returns (string)",
]);

export const GENERATIONS_ABI = parseAbi([
  "function generation(uint256 tokenId) view returns (uint256)",
  "function totalMinted() view returns (uint256)",
]);

export const FAMILIES_REGISTRY_ABI = parseAbi([
  "function familyOf(uint256 tokenId) pure returns (uint8)",
]);

export const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
);

export const publicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(undefined, {
    batch: { wait: 16, batchSize: 40 },
    retryCount: 2,
    timeout: 25_000,
  }),
});

export const shortAddress = (addr?: string | null) =>
  addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "n/a";

export const tokenUrl = (collection: Collection, tokenId: string | number) =>
  `${EXPLORER}/token/${addressFor(collection)}/instance/${tokenId}`;
