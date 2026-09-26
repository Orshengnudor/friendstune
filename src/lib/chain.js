import { http, createConfig } from 'wagmi';
import { getDefaultConfig } from 'connectkit';

// Robinhood Chain mainnet
export const robinhoodChain = {
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.chain.robinhood.com'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' },
  },
};

export const GENESIS_ADDRESS = '0x116EaA62241751E0c98dA43d458600c6C17cD361';
export const GENERATIONS_ADDRESS = '0x14C49e6118F46525dE9ab41a51cBAA3c6EBF181D';

// Minimal ERC-721 surface every compliant contract exposes. These two calls
// are the ones we depend on for correctness (ownership + enumeration
// fallback); everything else below is read speculatively and allowed to fail.
export const ERC721_CORE_ABI = [
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'tokenURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
];

// Proven live in FastFinger against the Generations contract. Genesis is
// untested against these same names; friends.js tries each independently
// and never assumes one implies another.
export const TRAIT_ABI = [
  {
    name: 'generation',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'family',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'activationTier',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'state',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint8' }],
  },
];

export const FULL_ABI = [...ERC721_CORE_ABI, ...TRAIT_ABI];

export const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: [robinhoodChain],
    transports: {
      [robinhoodChain.id]: http('https://rpc.mainnet.chain.robinhood.com'),
    },
    walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
    appName: 'Friendstune',
    appDescription: 'Hear your Rare Friend',
    appUrl: 'https://friendstune.xyz',
    appIcon: 'https://friendstune.xyz/icon-512.png',
  })
);
