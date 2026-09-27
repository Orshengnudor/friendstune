import type { Collection } from "./chain";
import type { Friend } from "./friends";

/**
 * FRIENDSTUNE DERIVATION
 * ----------------------
 * Nothing here is random and nothing is invented. Every musical parameter is a
 * function of data the contract itself returned:
 *
 *   - the on-chain artwork bitmap (8x8 Genesis / 16x16 Generations) IS the note
 *     grid: columns are steps, rows are scale degrees, ink is a note, empty
 *     columns are rests. The picture you see is the score you hear.
 *   - the metadata traits pick key, mode, tempo, timbre, room and which layers
 *     are unlocked.
 *
 * Same token -> same tune, forever, for everyone.
 */

export const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  "minor pentatonic": [0, 3, 5, 7, 10],
  "major pentatonic": [0, 2, 4, 7, 9],
  "hirajoshi": [0, 2, 3, 7, 8],
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const midiToName = (midi: number) =>
  `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

export function hashString(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export interface Room {
  name: string;
  roomSize: number;
  dampening: number;
  wet: number;
  delayTime: number;
  feedback: number;
  delayWet: number;
}

/** Scenery is a real Generations trait; each one is a different acoustic space. */
export const ROOMS: Record<string, Room> = {
  Coastal: { name: "Coastal wash", roomSize: 0.82, dampening: 2600, wet: 0.42, delayTime: 0.375, feedback: 0.24, delayWet: 0.18 },
  Industrial: { name: "Industrial slap", roomSize: 0.52, dampening: 5200, wet: 0.24, delayTime: 0.1875, feedback: 0.34, delayWet: 0.3 },
  Rooftop: { name: "Rooftop air", roomSize: 0.74, dampening: 4200, wet: 0.36, delayTime: 0.5, feedback: 0.2, delayWet: 0.22 },
  Market: { name: "Market room", roomSize: 0.38, dampening: 3000, wet: 0.18, delayTime: 0.25, feedback: 0.16, delayWet: 0.12 },
  Orbital: { name: "Orbital hall", roomSize: 0.93, dampening: 1800, wet: 0.52, delayTime: 0.75, feedback: 0.38, delayWet: 0.26 },
  Garden: { name: "Garden warmth", roomSize: 0.6, dampening: 2200, wet: 0.3, delayTime: 0.333, feedback: 0.18, delayWet: 0.14 },
  Reading: { name: "Reading room", roomSize: 0.24, dampening: 1600, wet: 0.12, delayTime: 0.25, feedback: 0.1, delayWet: 0.06 },
  Mineral: { name: "Mineral plate", roomSize: 0.66, dampening: 6000, wet: 0.28, delayTime: 0.125, feedback: 0.28, delayWet: 0.2 },
};

const ROOM_KEYS = Object.keys(ROOMS);

/** Character / family -> mode. Nine families, nine modes. */
export const FAMILY_MODE: Record<string, string> = {
  Skeleton: "phrygian",
  Mask: "minor",
  Family: "major",
  Cellular: "dorian",
  Asymmetry: "lydian",
  Hoverer: "mixolydian",
  Colossus: "minor pentatonic",
  Sparkling: "major pentatonic",
  Hollow: "hirajoshi",
};

/** Genesis Lineage -> mode (Genesis carries no Character trait). */
export const LINEAGE_MODE: Record<string, string> = {
  Brick: "dorian",
  Layered: "minor",
  Shield: "major",
};

const CROWN_WAVE: Record<string, string> = {
  Flat: "triangle",
  Rounded: "sine",
  Stepped: "square",
  Clipped: "sawtooth",
};

export const FAMILY_WAVE: Record<string, string> = {
  Skeleton: "square",
  Mask: "sawtooth",
  Family: "triangle",
  Cellular: "fatsawtooth",
  Asymmetry: "pulse",
  Hoverer: "sine",
  Colossus: "fatsquare",
  Sparkling: "fmsine",
  Hollow: "amtriangle",
};

/** Floor is a real trait. It is literally the ground, so it drives the drums. */
export const FLOOR_DRUMS: Record<string, { kick: number[]; hat: number[]; label: string }> = {
  Plain: { kick: [0, 4, 8, 12], hat: [2, 6, 10, 14], label: "four on the floor" },
  Dither: { kick: [0, 7, 8, 14], hat: [1, 3, 5, 7, 9, 11, 13, 15], label: "dithered 16ths" },
  Hatch: { kick: [0, 6, 10], hat: [2, 4, 6, 8, 10, 12, 14], label: "offbeat hatch" },
  "Cross Grid": { kick: [0, 3, 8, 11], hat: [4, 6, 12, 14], label: "cross-grid syncopation" },
};

/** Genesis Jaw -> drum figure (Genesis has no Floor trait). */
export const JAW_DRUMS: Record<string, { kick: number[]; hat: number[]; label: string }> = {
  Square: { kick: [0, 4], hat: [2, 6], label: "square pulse" },
  Broad: { kick: [0, 3, 6], hat: [1, 5], label: "broad triplet feel" },
  Pointed: { kick: [0, 5], hat: [2, 3, 6, 7], label: "pointed accents" },
  Tapered: { kick: [0, 6], hat: [3, 7], label: "tapered half-time" },
  Flared: { kick: [0, 2, 4, 6], hat: [1, 3, 5, 7], label: "flared drive" },
};

export type LayerName = "lead" | "pad" | "bass" | "arp" | "kick" | "hat" | "shimmer";

export interface DerivationRow {
  source: string;
  value: string;
  effect: string;
}

export interface Composition {
  key: string;
  collection: Collection;
  tokenId: string;
  label: string;
  /** Steps per loop = artwork grid width (8 Genesis, 16 Generations). */
  steps: number;
  gridSize: number;
  bpm: number;
  swing: number;
  scaleName: string;
  scale: number[];
  rootMidi: number;
  rootName: string;
  waveform: string;
  noteLength: string;
  room: Room;
  unstable: boolean;
  brightness: number;
  layers: Record<LayerName, boolean>;
  lead: (number | null)[];
  pad: (number[] | null)[];
  bass: (number | null)[];
  arp: (number | null)[];
  kick: boolean[];
  hat: boolean[];
  shimmer: (number | null)[];
  /** Ink pixels per column. Drives note velocity and the grid visual. */
  density: number[];
  inkCount: number;
  stepSeconds: number;
  loopSeconds: number;
  derivation: DerivationRow[];
  hue: number;
}

const MOUTH_LENGTH: Record<string, string> = {
  None: "16n",
  Small: "8n",
  Close: "8n.",
  Wide: "4n",
};

function columnsOf(friend: Friend) {
  const { size, cells } = friend.grid;
  const cols: number[][] = [];
  for (let x = 0; x < size; x++) {
    const rows: number[] = [];
    for (let y = 0; y < size; y++) {
      if (cells[y * size + x]) rows.push(y);
    }
    cols.push(rows);
  }
  return cols;
}

export function deriveComposition(friend: Friend): Composition {
  const seed = hashString(`${friend.collection}:${friend.tokenId}`);
  const isGenesis = friend.collection === "genesis";
  const grid = friend.grid;
  const size = grid.size || 8;
  const cols = columnsOf(friend);
  const derivation: DerivationRow[] = [];

  derivation.push({
    source: "On-chain artwork",
    value: `${size}x${size} bitmap, ${grid.inkCount} ink pixels`,
    effect: `${size}-step sequence: columns are steps, rows are scale degrees, blank columns are rests`,
  });

  // --- key & mode -------------------------------------------------------
  const familyName = friend.character ?? friend.registryFamilyName ?? null;
  let scaleName: string;
  if (isGenesis) {
    scaleName = LINEAGE_MODE[friend.lineage ?? ""] ?? "minor";
    derivation.push({
      source: "Lineage",
      value: friend.lineage ?? "n/a",
      effect: `${scaleName} mode`,
    });
  } else {
    scaleName = FAMILY_MODE[familyName ?? ""] ?? "dorian";
    derivation.push({
      source: "Character",
      value: familyName ?? "n/a",
      effect: `${scaleName} mode + lead timbre`,
    });
  }
  const scale = SCALES[scaleName];

  // Root note comes from the token id itself (Generations put the id in `Seed`).
  const rootMidi = 45 + (Number(friend.tokenId) % 12);

  // --- tempo ------------------------------------------------------------
  let bpm: number;
  if (isGenesis) {
    const stature = friend.lineage ? friend.traits.find((t) => t.type === "Stature")?.value : null;
    const staturePace: Record<string, number> = { Compact: 106, Standard: 94, Tall: 82 };
    bpm = staturePace[String(stature ?? "")] ?? 94;
    derivation.push({ source: "Stature", value: String(stature ?? "n/a"), effect: `${bpm} BPM` });
  } else {
    const tier = friend.tier ?? 0;
    bpm = 82 + tier * 6 + (friend.state === "Temporary" ? -6 : 0);
    derivation.push({
      source: "Activation tier",
      value: String(tier),
      effect: `${bpm} BPM + ${tier + 3} of 7 layers unlocked`,
    });
  }

  // --- timbre -----------------------------------------------------------
  let waveform: string;
  if (isGenesis) {
    const crown = friend.traits.find((t) => t.type === "Crown")?.value;
    waveform = CROWN_WAVE[String(crown ?? "")] ?? "triangle";
    derivation.push({
      source: "Crown",
      value: String(crown ?? "n/a"),
      effect: `${waveform} lead oscillator`,
    });
  } else {
    waveform = FAMILY_WAVE[familyName ?? ""] ?? "triangle";
  }

  const mouth = friend.traits.find((t) => t.type === "Mouth")?.value;
  const noteLength = isGenesis ? (MOUTH_LENGTH[String(mouth ?? "")] ?? "8n") : "8n";
  if (isGenesis) {
    derivation.push({
      source: "Mouth",
      value: String(mouth ?? "n/a"),
      effect: `${noteLength} note length`,
    });
  }

  // --- register ---------------------------------------------------------
  const eyePlacement = friend.traits.find((t) => t.type === "Eye placement")?.value;
  const registerShift = isGenesis
    ? ({ High: 12, Centered: 0, Low: -12 } as Record<string, number>)[
        String(eyePlacement ?? "Centered")
      ] ?? 0
    : 0;
  if (isGenesis) {
    derivation.push({
      source: "Eye placement",
      value: String(eyePlacement ?? "n/a"),
      effect: registerShift === 0 ? "centre register" : `${registerShift > 0 ? "+" : ""}${registerShift} semitone register`,
    });
  }

  // --- room -------------------------------------------------------------
  let room: Room;
  if (!isGenesis && friend.scenery && ROOMS[friend.scenery]) {
    room = ROOMS[friend.scenery];
    derivation.push({
      source: "Scenery",
      value: friend.scenery,
      effect: `${room.name} (reverb ${Math.round(room.wet * 100)}%, ${Math.round(room.delayTime * 1000)}ms delay)`,
    });
  } else {
    const ears = friend.traits.find((t) => t.type === "Ears")?.value;
    const pick = ROOM_KEYS[hashString(String(ears ?? seed)) % ROOM_KEYS.length];
    room = ROOMS[pick];
    if (isGenesis) {
      derivation.push({ source: "Ears", value: String(ears ?? "n/a"), effect: `${room.name}` });
    }
  }

  // --- state / stability -------------------------------------------------
  const unstable = friend.state === "Temporary";
  const brightness = unstable
    ? 1400
    : friend.state === "Inactive"
      ? 2600
      : isGenesis
        ? 5200
        : 4600;
  if (!isGenesis) {
    derivation.push({
      source: "State",
      value: friend.state ?? "n/a",
      effect: unstable
        ? "detuned, wobbling, filter closed to 1.4kHz, because a Temporary Friend should sound unstable"
        : friend.state === "Active"
          ? "clean tuning, shimmer layer on, filter wide open"
          : "clean tuning, no shimmer, filter at 2.6kHz",
    });
  }

  // --- layers ------------------------------------------------------------
  const tier = friend.tier ?? 0;
  const generation = friend.generation ?? 0;
  const layers: Record<LayerName, boolean> = isGenesis
    ? { lead: true, pad: true, bass: true, arp: true, kick: true, hat: true, shimmer: true }
    : {
        lead: true,
        pad: true,
        bass: true,
        kick: tier >= 1 || generation >= 1,
        hat: tier >= 2 || generation >= 3,
        arp: tier >= 3 || generation >= 5,
        shimmer: tier >= 4 || friend.state === "Active",
      };
  if (isGenesis) {
    derivation.push({
      source: "Collection",
      value: "Genesis (1 of 1,024)",
      effect: "full seven-layer rig. Genesis metadata exposes no tier or state, so nothing is gated and nothing is guessed",
    });
  } else if (generation > 0) {
    derivation.push({
      source: "Generation",
      value: `G${generation}`,
      effect: `sub-octave weight and layer count follow the generation table (G1 heaviest)`,
    });
  }

  // --- the grid becomes the score ---------------------------------------
  const degreesToMidi = (degree: number, octave = 0) => {
    const oct = Math.floor(degree / scale.length) + octave;
    const step = scale[((degree % scale.length) + scale.length) % scale.length];
    return rootMidi + oct * 12 + step + registerShift;
  };

  const steps = size;
  const lead: (number | null)[] = [];
  const bass: (number | null)[] = [];
  const arp: (number | null)[] = [];
  const pad: (number[] | null)[] = [];
  const shimmer: (number | null)[] = [];
  const density: number[] = [];

  for (let x = 0; x < steps; x++) {
    const rows = cols[x] ?? [];
    density.push(rows.length);
    if (rows.length === 0) {
      lead.push(null);
      bass.push(null);
      arp.push(null);
      pad.push(null);
      shimmer.push(null);
      continue;
    }
    // Rows count downward in the image, so invert: the top of the drawing is
    // the top of the register.
    const top = size - 1 - rows[0];
    const bottom = size - 1 - rows[rows.length - 1];
    const mid = size - 1 - rows[Math.floor(rows.length / 2)];

    lead.push(degreesToMidi(top, 1));
    bass.push(x % 4 === 0 ? degreesToMidi(bottom % scale.length, -1) : null);
    arp.push(degreesToMidi(mid, 2));
    shimmer.push(x % (steps / 2) === 0 ? degreesToMidi(top, 2) : null);

    if (x % (steps / 2) === 0) {
      const chordRows = rows.slice(0, 3).map((r) => size - 1 - r);
      pad.push(chordRows.map((d, i) => degreesToMidi(d, i === 0 ? 0 : -1)));
    } else {
      pad.push(null);
    }
  }

  // --- drums -------------------------------------------------------------
  const drumTable = isGenesis
    ? JAW_DRUMS[String(friend.traits.find((t) => t.type === "Jaw")?.value ?? "")] ??
      JAW_DRUMS.Square
    : FLOOR_DRUMS[friend.floor ?? ""] ?? FLOOR_DRUMS.Plain;
  const kick = Array.from({ length: steps }, (_, i) =>
    drumTable.kick.some((k) => k % steps === i % steps),
  );
  const hat = Array.from({ length: steps }, (_, i) =>
    drumTable.hat.some((k) => k % steps === i % steps),
  );
  if (!isGenesis) {
    derivation.push({
      source: "Floor",
      value: friend.floor ?? "n/a",
      effect: `${drumTable.label} drum figure`,
    });
  } else {
    derivation.push({
      source: "Jaw",
      value: String(friend.traits.find((t) => t.type === "Jaw")?.value ?? "n/a"),
      effect: `${drumTable.label} drum figure`,
    });
  }

  const earRise = Number(friend.traits.find((t) => t.type === "Ear rise")?.value ?? 0);
  const swing = isGenesis ? Math.min(0.3, earRise * 0.08) : unstable ? 0.16 : tier >= 2 ? 0.08 : 0;

  const stepSeconds = 60 / bpm / 4;
  const loopSeconds = stepSeconds * steps;

  return {
    key: `${friend.collection}:${friend.tokenId}`,
    collection: friend.collection,
    tokenId: friend.tokenId,
    label: friend.name || `${friend.collection} #${friend.tokenId}`,
    steps,
    gridSize: size,
    bpm,
    swing,
    scaleName,
    scale,
    rootMidi,
    rootName: midiToName(rootMidi),
    waveform,
    noteLength,
    room,
    unstable,
    brightness,
    layers,
    lead,
    pad,
    bass,
    arp,
    kick,
    hat,
    shimmer,
    density,
    inkCount: grid.inkCount,
    stepSeconds,
    loopSeconds,
    derivation,
    hue: (hashString(`${friend.collection}${friend.tokenId}${scaleName}`) % 360),
  };
}

/**
 * The Vibe Score describes the ARRANGEMENT, not rarity. It says how much is
 * going on in a tune and how bright it is. It says nothing about market value.
 */
export function computeVibeScore(comp: Composition) {
  const activeLayers = Object.values(comp.layers).filter(Boolean).length;
  const notes = comp.lead.filter((n) => n !== null).length;
  const parts = [
    { label: "Layers", value: Math.round((activeLayers / 7) * 100) },
    { label: "Note density", value: Math.round((notes / comp.steps) * 100) },
    {
      label: "Ink coverage",
      value: Math.round((comp.inkCount / (comp.gridSize * comp.gridSize)) * 100),
    },
    { label: "Tempo energy", value: Math.round(Math.min(100, ((comp.bpm - 70) / 50) * 100)) },
    { label: "Brightness", value: Math.round((comp.brightness / 5200) * 100) },
  ];
  const total = Math.round(parts.reduce((sum, p) => sum + p.value, 0) / parts.length);
  return { total, parts };
}
