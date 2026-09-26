import * as Tone from 'tone';

// --- Deterministic helpers --------------------------------------------
// Every parameter below has a real-data path and a hash-based fallback, so
// a Friend always sounds the same, whether or not the richer trait reads
// succeeded against the live contract.

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Trait values can arrive as clean numbers (a direct contract read) or as
// human strings from a metadata attributes array (e.g. "Active", "Tier II").
// Either is safe to use: numbers pass through, strings get hashed into a
// deterministic number instead of producing NaN.
function numericOrHash(value, fallbackSeed) {
  if (value === null || value === undefined) return fallbackSeed;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? hashString(String(value)) : parsed;
}

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};
const SCALE_NAMES = Object.keys(SCALES);
const WAVEFORMS = ['sine', 'triangle', 'sawtooth', 'square', 'fatsawtooth'];

// --- Trait data -> composition spec ------------------------------------

export function deriveComposition(friend) {
  const seedBase = hashString(`${friend.collection}:${friend.tokenId}`);
  const rand = mulberry32(seedBase);

  const familyKey = friend.family ? hashString(String(friend.family)) : seedBase;
  const waveform = WAVEFORMS[familyKey % WAVEFORMS.length];

  const scaleName = friend.state !== null && friend.state !== undefined
    ? SCALE_NAMES[numericOrHash(friend.state, seedBase) % SCALE_NAMES.length]
    : SCALE_NAMES[seedBase % SCALE_NAMES.length];

  const tier = friend.tier !== null && friend.tier !== undefined
    ? numericOrHash(friend.tier, seedBase) % 5
    : seedBase % 5;
  const bpm = Math.max(70, Math.min(150, 72 + tier * 9));
  const percussion = tier >= 1 || (friend.tier === null && seedBase % 2 === 0);

  const generation = friend.generation !== null && friend.generation !== undefined
    ? numericOrHash(friend.generation, seedBase) % 8
    : 1 + (seedBase % 4);
  const layerCount = Math.max(1, Math.min(4, 1 + Math.floor(generation / 2)));

  const rootMidi = 48 + (hashString(friend.tokenId) % 12); // C3 .. B3
  const scale = SCALES[scaleName];
  const degreesToMidi = (degree, octaveShift = 0) => {
    const octave = Math.floor(degree / scale.length) + octaveShift;
    const step = scale[((degree % scale.length) + scale.length) % scale.length];
    return rootMidi + octave * 12 + step;
  };
  const midiToNote = (m) => Tone.Frequency(m, 'midi').toNote();

  const STEPS = 16;
  const melody = Array.from({ length: STEPS }, () => {
    if (rand() < 0.22) return null; // rest
    const degree = Math.floor(rand() * 8);
    return midiToNote(degreesToMidi(degree, 1));
  });

  const bass = layerCount >= 2
    ? Array.from({ length: STEPS }, (_, i) => (i % 4 === 0 ? midiToNote(degreesToMidi(0, 0)) : null))
    : null;

  const arpeggio = layerCount >= 3
    ? Array.from({ length: STEPS }, (_, i) => (i % 2 === 0 ? midiToNote(degreesToMidi([0, 2, 4][Math.floor(i / 2) % 3], 2)) : null))
    : null;

  const kickPattern = percussion
    ? Array.from({ length: STEPS }, (_, i) => i % 4 === 0)
    : null;
  const hatPattern = percussion && layerCount >= 4
    ? Array.from({ length: STEPS }, (_, i) => i % 2 === 1)
    : null;

  return {
    label: `${friend.collection} #${friend.tokenId}`,
    bpm,
    waveform,
    scaleName,
    melody,
    bass,
    arpeggio,
    kickPattern,
    hatPattern,
    stepSeconds: 60 / bpm / 4, // 16th notes
    loops: 2,
  };
}

// --- Playback ------------------------------------------------------------
// Builds the full instrument rig and schedules it on whichever Tone context
// is currently active. Called directly for live playback, and again inside
// Tone.Offline's callback for rendering a downloadable file, the offline
// context becomes the active one automatically for the duration of that
// callback, so this same function targets it without any special-casing.
function buildAndSchedule(spec, onStep) {
  const transport = Tone.getTransport();
  transport.bpm.value = spec.bpm;

  const lead = new Tone.Synth({
    oscillator: { type: spec.waveform },
    envelope: { attack: 0.01, decay: 0.15, sustain: 0.25, release: 0.4 },
  }).toDestination();
  lead.volume.value = -6;

  const bassSynth = spec.bass ? new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.3 },
  }).toDestination() : null;
  if (bassSynth) bassSynth.volume.value = -10;

  const arpSynth = spec.arpeggio ? new Tone.Synth({
    oscillator: { type: 'fmsine' },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.1, release: 0.2 },
  }).toDestination() : null;
  if (arpSynth) arpSynth.volume.value = -14;

  const kick = spec.kickPattern ? new Tone.MembraneSynth().toDestination() : null;
  if (kick) kick.volume.value = -8;
  const hat = spec.hatPattern ? new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
  }).toDestination() : null;
  if (hat) hat.volume.value = -20;

  const seq = new Tone.Sequence((time, i) => {
    const note = spec.melody[i];
    if (note) lead.triggerAttackRelease(note, '16n', time);
    if (spec.bass && spec.bass[i]) bassSynth.triggerAttackRelease(spec.bass[i], '8n', time);
    if (spec.arpeggio && spec.arpeggio[i]) arpSynth.triggerAttackRelease(spec.arpeggio[i], '16n', time);
    if (spec.kickPattern && spec.kickPattern[i]) kick.triggerAttackRelease('C1', '8n', time);
    if (spec.hatPattern && spec.hatPattern[i]) hat.triggerAttackRelease('16n', time);
    if (onStep) Tone.Draw.schedule(() => onStep(i), time);
  }, Array.from({ length: 16 }, (_, i) => i), '16n');

  seq.loop = spec.loops;
  seq.start(0);

  const totalSeconds = spec.stepSeconds * 16 * spec.loops;
  transport.scheduleOnce(() => {
    seq.dispose();
    lead.dispose();
    bassSynth?.dispose();
    arpSynth?.dispose();
    kick?.dispose();
    hat?.dispose();
  }, totalSeconds + 0.5);

  return totalSeconds;
}

let activeHandle = null;

export async function playComposition(spec, onStep) {
  await Tone.start();
  stopComposition();
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
  transport.position = 0;
  const duration = buildAndSchedule(spec, onStep);
  transport.start();
  activeHandle = { duration };
  return duration;
}

export function stopComposition() {
  if (!activeHandle) return;
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
  activeHandle = null;
}

// Renders the composition offline and returns a downloadable WAV blob.
export async function renderCompositionToWav(spec) {
  const duration = spec.stepSeconds * 16 * spec.loops + 0.5;
  const buffer = await Tone.Offline(() => {
    // Reset first, same as the live path. Without this, an explicit start
    // time can conflict with transport state left over from an earlier
    // live play, which throws instead of rendering (the "rendering... then
    // nothing" failure). A bare start() with no argument avoids asserting
    // an absolute time at all.
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    transport.position = 0;
    buildAndSchedule(spec, null);
    transport.start();
  }, duration);
  const rendered = buffer.get();
  // A plain loop, not Math.max(...array): spreading a real audio buffer's
  // worth of samples (hundreds of thousands at 44.1kHz) into function
  // arguments blows the call stack.
  const channel = rendered.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < channel.length; i++) {
    const abs = Math.abs(channel[i]);
    if (abs > peak) peak = abs;
  }
  if (peak < 0.001) {
    console.warn('Rendered offline buffer looks silent (peak amplitude', peak, '), the offline render likely did not capture the scheduled notes.');
  }
  return audioBufferToWavBlob(rendered);
}

function audioBufferToWavBlob(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length * numChannels * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, length - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length - 44, true);

  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
