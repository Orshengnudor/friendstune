import * as Tone from "tone";
import type { Composition, LayerName } from "./music";

export interface RemixSettings {
  /** Semitones, -12..+12 */
  transpose: number;
  /** Multiplier on the derived BPM, 0.6..1.6 */
  tempoScale: number;
  /** 0..1 scaling of the derived filter cutoff */
  tone: number;
  /** null = use the tune's own derived swing */
  swing: number | null;
  /** null = use the tune's own derived oscillator */
  waveform: string | null;
  /** null = use the Scenery-derived reverb amount */
  reverb: number | null;
  mutes: Partial<Record<LayerName, boolean>>;
}

export const DEFAULT_REMIX: RemixSettings = {
  transpose: 0,
  tempoScale: 1,
  tone: 1,
  swing: null,
  waveform: null,
  reverb: null,
  mutes: {},
};

export const isDefaultRemix = (s: RemixSettings) =>
  s.transpose === 0 &&
  s.tempoScale === 1 &&
  s.tone === 1 &&
  s.swing === null &&
  s.waveform === null &&
  s.reverb === null &&
  Object.values(s.mutes).every((v) => !v);

const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

const WAVE_SAFE = new Set([
  "sine",
  "triangle",
  "square",
  "sawtooth",
  "fatsawtooth",
  "fatsquare",
  "fmsine",
  "amtriangle",
  "pulse",
]);

interface Graph {
  dispose: () => void;
  trigger: (step: number, time: number) => void;
  setTone: (v: number) => void;
  setReverb: (v: number) => void;
  setMutes: (m: Partial<Record<LayerName, boolean>>) => void;
}

function buildGraph(comp: Composition, settings: RemixSettings, out: Tone.ToneAudioNode): Graph {
  let mutes = { ...settings.mutes };
  const waveform = settings.waveform && WAVE_SAFE.has(settings.waveform)
    ? settings.waveform
    : WAVE_SAFE.has(comp.waveform)
      ? comp.waveform
      : "triangle";

  const reverb = new Tone.Freeverb({
    roomSize: comp.room.roomSize,
    dampening: comp.room.dampening,
    wet: settings.reverb ?? comp.room.wet,
  }).connect(out);

  const delay = new Tone.FeedbackDelay({
    delayTime: comp.room.delayTime,
    feedback: comp.room.feedback,
    wet: comp.room.delayWet,
  }).connect(out);

  const filter = new Tone.Filter({
    frequency: Math.max(220, comp.brightness * settings.tone),
    type: "lowpass",
    rolloff: -24,
    Q: comp.unstable ? 2.2 : 0.8,
  });
  filter.connect(out);
  filter.connect(reverb);
  filter.connect(delay);

  // A Temporary Friend is not permanent on chain, so it does not sound
  // permanent either: slow pitch wobble + drifting filter.
  const vibrato = comp.unstable
    ? new Tone.Vibrato({ frequency: 3.6, depth: 0.22 }).connect(filter)
    : null;
  const leadIn = vibrato ?? filter;

  const lead = new Tone.Synth({
    oscillator: { type: waveform as Tone.ToneOscillatorType },
    envelope: { attack: 0.006, decay: 0.16, sustain: 0.22, release: 0.35 },
    detune: comp.unstable ? 26 : 0,
  }).connect(leadIn);
  lead.volume.value = -9;

  const pad = new Tone.PolySynth(Tone.AMSynth, {
    harmonicity: 1.5,
    envelope: { attack: 0.9, decay: 0.6, sustain: 0.6, release: 2.4 },
    modulationEnvelope: { attack: 1.2, decay: 0.4, sustain: 0.5, release: 2 },
  }).connect(filter);
  pad.volume.value = -22;

  const bass = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.02, decay: 0.28, sustain: 0.35, release: 0.4 },
  }).connect(filter);
  bass.volume.value = -11;

  const arp = new Tone.Synth({
    oscillator: { type: "fmsine" },
    envelope: { attack: 0.004, decay: 0.09, sustain: 0.06, release: 0.16 },
  }).connect(filter);
  arp.volume.value = -19;

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.03,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.32, sustain: 0 },
  }).connect(out);
  kick.volume.value = -7;

  const hat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.045, sustain: 0 },
  }).connect(filter);
  hat.volume.value = -27;

  const shimmer = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 1.4, sustain: 0.1, release: 2.6 },
  }).connect(reverb);
  shimmer.volume.value = -24;

  const on = (layer: LayerName) => comp.layers[layer] && !mutes[layer];
  const t = settings.transpose;

  const trigger = (step: number, time: number) => {
    const i = step % comp.steps;
    const velocity = Math.min(1, 0.45 + (comp.density[i] ?? 0) / (comp.gridSize * 1.4));

    const leadNote = comp.lead[i];
    if (on("lead") && leadNote !== null) {
      lead.triggerAttackRelease(midiToFreq(leadNote + t), comp.noteLength, time, velocity);
    }
    const bassNote = comp.bass[i];
    if (on("bass") && bassNote !== null) {
      bass.triggerAttackRelease(midiToFreq(bassNote + t), "8n", time, 0.9);
    }
    const arpNote = comp.arp[i];
    if (on("arp") && arpNote !== null && i % 2 === 1) {
      arp.triggerAttackRelease(midiToFreq(arpNote + t), "16n", time, 0.7);
    }
    const chord = comp.pad[i];
    if (on("pad") && chord) {
      pad.triggerAttackRelease(
        chord.map((n) => midiToFreq(n + t)),
        comp.steps === 8 ? "1n" : "2n",
        time,
        0.5,
      );
    }
    const shim = comp.shimmer[i];
    if (on("shimmer") && shim !== null) {
      shimmer.triggerAttackRelease([midiToFreq(shim + t + 12)], "2n", time, 0.35);
    }
    if (on("kick") && comp.kick[i]) {
      kick.triggerAttackRelease(midiToFreq(comp.rootMidi - 24 + t), "8n", time, 0.9);
    }
    if (on("hat") && comp.hat[i]) {
      hat.triggerAttackRelease("32n", time, 0.6);
    }
  };

  return {
    trigger,
    setTone: (v) => {
      filter.frequency.rampTo(Math.max(220, comp.brightness * v), 0.08);
    },
    setReverb: (v) => {
      reverb.wet.rampTo(v, 0.1);
    },
    setMutes: (m) => {
      mutes = { ...m };
    },
    dispose: () => {
      for (const node of [
        lead,
        pad,
        bass,
        arp,
        kick,
        hat,
        shimmer,
        filter,
        reverb,
        delay,
        vibrato,
      ]) {
        node?.dispose();
      }
    },
  };
}

export interface EngineState {
  status: "idle" | "starting" | "playing";
  comp: Composition | null;
  step: number;
  settings: RemixSettings;
  volume: number;
}

type Listener = (s: EngineState) => void;

class FriendstuneEngine {
  private state: EngineState = {
    status: "idle",
    comp: null,
    step: -1,
    settings: { ...DEFAULT_REMIX },
    volume: 0.8,
  };
  private listeners = new Set<Listener>();
  private graph: Graph | null = null;
  private seq: Tone.Sequence<number> | null = null;
  private analyser: Tone.Analyser | null = null;
  private meter: Tone.Meter | null = null;
  private volumeNode: Tone.Volume | null = null;
  private finishTimer: ReturnType<typeof setTimeout> | null = null;

  getState() {
    return this.state;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(patch: Partial<EngineState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }

  private ensureMaster() {
    if (!this.volumeNode) {
      const limiter = new Tone.Limiter(-1.5).toDestination();
      const volume = new Tone.Volume(Tone.gainToDb(this.state.volume)).connect(limiter);
      this.analyser = new Tone.Analyser("waveform", 512);
      this.meter = new Tone.Meter({ smoothing: 0.85 });
      volume.connect(this.analyser);
      volume.connect(this.meter);
      this.volumeNode = volume;
    }
    return this.volumeNode;
  }

  async play(
    comp: Composition,
    opts: { loops?: number; onFinish?: () => void; settings?: RemixSettings } = {},
  ) {
    this.emit({ status: "starting" });
    await Tone.start();
    this.teardown();

    const settings = opts.settings ?? this.state.settings;
    const master = this.ensureMaster();
    const graph = buildGraph(comp, settings, master);
    this.graph = graph;

    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    transport.position = 0;
    transport.bpm.value = comp.bpm * settings.tempoScale;
    transport.swing = settings.swing ?? comp.swing;
    transport.swingSubdivision = "16n";

    const seq = new Tone.Sequence(
      (time, step) => {
        graph.trigger(step, time);
        Tone.Draw.schedule(() => this.emit({ step }), time);
      },
      Array.from({ length: comp.steps }, (_, i) => i),
      "16n",
    );
    seq.loop = true;
    seq.start(0);
    this.seq = seq;

    transport.start();
    this.emit({ status: "playing", comp, step: -1, settings });

    if (opts.loops && opts.onFinish) {
      const ms = (comp.loopSeconds / settings.tempoScale) * opts.loops * 1000;
      this.finishTimer = setTimeout(() => opts.onFinish?.(), ms);
    }
  }

  private teardown() {
    if (this.finishTimer) {
      clearTimeout(this.finishTimer);
      this.finishTimer = null;
    }
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    this.seq?.dispose();
    this.seq = null;
    this.graph?.dispose();
    this.graph = null;
  }

  stop() {
    this.teardown();
    this.emit({ status: "idle", comp: null, step: -1 });
  }

  isPlaying(key?: string) {
    if (this.state.status === "idle") return false;
    return key ? this.state.comp?.key === key : true;
  }

  setVolume(v: number) {
    const clamped = Math.max(0, Math.min(1, v));
    if (this.volumeNode) this.volumeNode.volume.rampTo(Tone.gainToDb(clamped || 0.0001), 0.05);
    this.emit({ volume: clamped });
  }

  /** Live remix, applied to the running graph without restarting the tune. */
  updateSettings(patch: Partial<RemixSettings>) {
    const next = { ...this.state.settings, ...patch };
    const comp = this.state.comp;
    if (this.graph && comp) {
      if (patch.tone !== undefined) this.graph.setTone(next.tone);
      if (patch.reverb !== undefined) this.graph.setReverb(next.reverb ?? comp.room.wet);
      if (patch.mutes !== undefined) this.graph.setMutes(next.mutes);
      if (patch.tempoScale !== undefined) {
        Tone.getTransport().bpm.rampTo(comp.bpm * next.tempoScale, 0.2);
      }
      if (patch.swing !== undefined) {
        Tone.getTransport().swing = next.swing ?? comp.swing;
      }
    }
    this.emit({ settings: next });
    // Transpose and oscillator changes need a rebuilt voice.
    const needsRebuild = patch.transpose !== undefined || patch.waveform !== undefined;
    if (needsRebuild && comp && this.state.status === "playing") {
      void this.play(comp, { settings: next });
    }
  }

  resetSettings() {
    const comp = this.state.comp;
    this.emit({ settings: { ...DEFAULT_REMIX } });
    if (comp && this.state.status === "playing") {
      void this.play(comp, { settings: { ...DEFAULT_REMIX } });
    }
  }

  getWaveform(): Float32Array | null {
    if (!this.analyser) return null;
    return this.analyser.getValue() as Float32Array;
  }

  getLevel(): number {
    if (!this.meter) return -Infinity;
    const v = this.meter.getValue();
    return typeof v === "number" ? v : v[0];
  }
}

export const engine = new FriendstuneEngine();

/** Offline render of a tune (2 loops) as a downloadable WAV. */
export async function renderWav(comp: Composition, settings: RemixSettings, loops = 4) {
  const duration = (comp.loopSeconds / settings.tempoScale) * loops + 2.5;
  const buffer = await Tone.Offline(({ transport, destination }) => {
    const limiter = new Tone.Limiter(-1.5).connect(destination);
    const graph = buildGraph(comp, settings, limiter);
    transport.bpm.value = comp.bpm * settings.tempoScale;
    transport.swing = settings.swing ?? comp.swing;
    transport.swingSubdivision = "16n";
    const seq = new Tone.Sequence(
      (time, step) => graph.trigger(step, time),
      Array.from({ length: comp.steps }, (_, i) => i),
      "16n",
    );
    seq.loop = loops;
    seq.start(0);
    transport.start();
  }, duration, 2);
  return audioBufferToWav(buffer.get() as AudioBuffer);
}

function audioBufferToWav(audioBuffer: AudioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length * numChannels * 2 + 44;
  const out = new ArrayBuffer(length);
  const view = new DataView(out);
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, length - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, length - 44, true);
  let offset = 44;
  const channels = Array.from({ length: numChannels }, (_, ch) => audioBuffer.getChannelData(ch));
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([out], { type: "audio/wav" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
