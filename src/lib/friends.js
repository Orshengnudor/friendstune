import { createPublicClient, http, parseAbiItem } from 'viem';
import {
  robinhoodChain, GENESIS_ADDRESS, GENERATIONS_ADDRESS, FULL_ABI,
  FAMILIES_REGISTRY_ADDRESS, FAMILIES_REGISTRY_ABI, GENERATION_FAMILY_NAMES,
} from './chain';

const publicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http('https://rpc.mainnet.chain.robinhood.com'),
});

export const COLLECTIONS = {
  genesis: { label: 'Genesis', address: GENESIS_ADDRESS },
  generations: { label: 'Generations', address: GENERATIONS_ADDRESS },
};

function addressFor(collection) {
  const entry = COLLECTIONS[collection];
  if (!entry) throw new Error(`Unknown collection: ${collection}`);
  return entry.address;
}

// Confirms a wallet really owns a given token right now. This is the one
// check every path in the app funnels through before a tune plays.
export async function verifyOwnership(collection, tokenId, ownerAddress) {
  try {
    const owner = await publicClient.readContract({
      address: addressFor(collection),
      abi: FULL_ABI,
      functionName: 'ownerOf',
      args: [BigInt(tokenId)],
    });
    return owner.toLowerCase() === ownerAddress.toLowerCase();
  } catch (err) {
    return { error: 'not-found', detail: err.shortMessage || err.message };
  }
}

const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)');
const sameAddress = (a, b) => a.toLowerCase() === b.toLowerCase();

// Direct on-chain discovery, the same mechanism FriendSDK's own
// readOwnedFriends uses: two indexed Transfer queries (incoming and
// outgoing) replayed in order to find what's currently held, cross-checked
// against a live balanceOf so a reconciliation mismatch is a hard error
// rather than a silently wrong list, then a fresh ownerOf per token since
// the log query is a snapshot and something could move after it's read.
// No third-party indexer involved, so there's no response shape to guess at.
async function discoverOwnedTokenIds(contractAddress, account) {
  const blockNumber = await publicClient.getBlockNumber();
  const balance = await publicClient.readContract({
    address: contractAddress, abi: FULL_ABI, functionName: 'balanceOf', args: [account],
  });
  if (balance === 0n) return [];

  const query = { address: contractAddress, event: TRANSFER_EVENT, fromBlock: 0n, toBlock: blockNumber, strict: true };
  const [received, sent] = await Promise.all([
    publicClient.getLogs({ ...query, args: { to: account } }),
    publicClient.getLogs({ ...query, args: { from: account } }),
  ]);

  // A transfer to self would appear in both queries; dedupe by chain position.
  const events = new Map();
  for (const log of [...received, ...sent]) {
    events.set(`${log.blockNumber}:${log.logIndex}`, log);
  }
  const ordered = [...events.values()].sort((a, b) =>
    a.blockNumber === b.blockNumber
      ? Number(a.logIndex) - Number(b.logIndex)
      : (a.blockNumber < b.blockNumber ? -1 : 1)
  );
  const held = new Set();
  for (const log of ordered) {
    if (sameAddress(log.args.to, account)) held.add(log.args.tokenId);
    else held.delete(log.args.tokenId);
  }

  if (BigInt(held.size) !== balance) {
    throw new Error('Transfer history did not reconcile with current balance');
  }

  const verified = [];
  for (const id of held) {
    const owner = await publicClient.readContract({
      address: contractAddress, abi: FULL_ABI, functionName: 'ownerOf', args: [id],
    }).catch(() => null);
    if (owner && sameAddress(owner, account)) verified.push(id);
  }
  return verified;
}

export async function getOwnedFriends(ownerAddress) {
  try {
    const [genesisIds, generationsIds] = await Promise.all([
      discoverOwnedTokenIds(GENESIS_ADDRESS, ownerAddress),
      discoverOwnedTokenIds(GENERATIONS_ADDRESS, ownerAddress),
    ]);
    const friends = [
      ...genesisIds.map((id) => ({ collection: 'genesis', tokenId: id.toString() })),
      ...generationsIds.map((id) => ({ collection: 'generations', tokenId: id.toString() })),
    ];
    return { ok: true, friends };
  } catch (err) {
    // The RPC didn't give us complete or reconcilable transfer history.
    // Fall back to a plain balance check so the picker can at least be
    // honest about what's there, rather than claim the wallet owns nothing.
    const counts = {};
    for (const key of Object.keys(COLLECTIONS)) {
      try {
        const balance = await publicClient.readContract({
          address: addressFor(key), abi: FULL_ABI, functionName: 'balanceOf', args: [ownerAddress],
        });
        counts[key] = Number(balance);
      } catch {
        counts[key] = null;
      }
    }
    return { ok: false, counts, reason: err.message };
  }
}

function decodeTokenURI(uri) {
  if (uri.startsWith('data:application/json;base64,')) {
    const b64 = uri.slice('data:application/json;base64,'.length);
    return JSON.parse(atob(b64));
  }
  if (uri.startsWith('data:application/json,')) {
    return JSON.parse(decodeURIComponent(uri.slice('data:application/json,'.length)));
  }
  return null; // caller falls back to fetching it as a URL
}

function normalizeImage(image) {
  if (!image) return null;
  if (image.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${image.slice('ipfs://'.length)}`;
  }
  return image; // data: URI or already-http URL, used as-is
}

// Pulls together everything we can find for one token: the on-chain image,
// the standard attributes array from its metadata (if present), and a
// direct attempt at the richer trait functions. Every source is optional;
// generation and tokenId are the only values the music engine can always
// count on.
// Family lives on a separate registry, and only exists for Generations,
// confirmed against FriendSDK's own source. Returns a real name, a null
// (no data available), never a guess.
async function readFamily(collection, id) {
  if (collection !== 'generations') return null;
  try {
    const familyId = await publicClient.readContract({
      address: FAMILIES_REGISTRY_ADDRESS, abi: FAMILIES_REGISTRY_ABI, functionName: 'familyOf', args: [id],
    });
    return GENERATION_FAMILY_NAMES[Number(familyId)] ?? null;
  } catch {
    return null;
  }
}

export async function getFriendData(collection, tokenId) {
  const address = addressFor(collection);
  const id = BigInt(tokenId);

  const [tokenURI, generation, family, activationTier, state] = await Promise.all([
    publicClient.readContract({ address, abi: FULL_ABI, functionName: 'tokenURI', args: [id] }).catch(() => null),
    publicClient.readContract({ address, abi: FULL_ABI, functionName: 'generation', args: [id] }).catch(() => null),
    readFamily(collection, id),
    publicClient.readContract({ address, abi: FULL_ABI, functionName: 'activationTier', args: [id] }).catch(() => null),
    publicClient.readContract({ address, abi: FULL_ABI, functionName: 'state', args: [id] }).catch(() => null),
  ]);

  let metadata = null;
  if (tokenURI) {
    metadata = decodeTokenURI(tokenURI);
    if (!metadata) {
      try {
        const res = await fetch(tokenURI.startsWith('ipfs://')
          ? `https://ipfs.io/ipfs/${tokenURI.slice(7)}`
          : tokenURI);
        metadata = await res.json();
      } catch {
        metadata = null;
      }
    }
  }

  const attributes = metadata?.attributes || [];
  const attr = (name) => attributes.find(
    (a) => (a.trait_type || '').toLowerCase() === name.toLowerCase()
  )?.value;

  return {
    collection,
    tokenId: String(tokenId),
    name: metadata?.name || `${COLLECTIONS[collection].label} #${tokenId}`,
    image: normalizeImage(metadata?.image),
    generation: generation !== null ? Number(generation) : (attr('Generation') ?? null),
    family: family || attr('Family') || null,
    tier: activationTier !== null ? Number(activationTier) : (attr('Activation Tier') ?? attr('Tier') ?? null),
    state: state !== null ? Number(state) : (attr('State') ?? null),
    attributes,
  };
}
