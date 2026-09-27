# Friendstune

A generative music player for Rare Friends on Robinhood Chain (chain id 4663).

Every Friend already carries its own tune. Friendstune reads the token straight off chain and plays
what is there: the on-chain artwork bitmap becomes the note grid, and the traits pick the key, the
mode, the instruments, the tempo and the room. Same token, same tune, every time, on any device,
because the score is derived from chain data and nothing is stored.

## What it does

- **Radio** at `/` shuffles the whole population and plays it hands free.
- **Explore** at `/explore` samples real token ids live, with filters and sort.
- **Atlas** at `/atlas` runs a live family census and shows how each of the 9 families sounds.
- **My Friends** at `/mine` holds owned, saved and recently played shelves, plus badges and streaks.
- **Friend pages** at `/f/:collection/:id` are deep linkable, with the full derivation table, the
  Remix Studio and offline WAV export.

## Simulated RF only

Tipping and the Remix Studio run on **simulated RF**. Every identity, wallet or guest, is granted
100,000 simulated RF held in `localStorage`, refillable for free from My Friends. The app never
touches the real `$RAREFRIENDS` token, never builds a transaction and never asks for a signature.
Connecting a wallet is read only and entirely optional.

## Data sources

All reads are direct browser JSON-RPC calls. There is no indexer, no backend and no API key.

| Contract | Address |
| --- | --- |
| Rare Friends Genesis | `0x116EaA62241751E0c98dA43d458600c6C17cD361` |
| Rare Friends Generations | `0x14C49e6118F46525dE9ab41a51cBAA3c6EBF181D` |
| Families registry | `0x246E3E9730A7Eade94c79be0Fd78d210f89AEb8D` |
| RPC | `https://rpc.mainnet.chain.robinhood.com` |

## Local development

```bash
bun install
bun run dev        # http://localhost:4200
```

## Build

```bash
bun run build:web  # client bundle into packages/web/dist
```

`bun run typecheck` validates the workspace.

## Deploy

`vercel.json` in the repo root already sets the install command, the build command, the output
directory and the SPA rewrite, so a push to the connected branch is all that is needed.

## Stack

Bun, Vite, React 19, wouter, TanStack Query, Tailwind v4, Tone.js, viem and wagmi, Hono and Drizzle
for the server side, Turborepo for the workspace.
