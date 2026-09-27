import { useEffect, useRef } from "react";
import { cn } from "../lib/utils";
import type { PixelGrid } from "../lib/friends";
import type { Composition } from "../lib/music";
import { engine } from "../lib/audio";
import { useRaf } from "../lib/hooks";

/**
 * The sequencer IS the artwork: every column of the on-chain bitmap is one 16th
 * step, every row is a scale degree, every ink pixel is a note. The playhead
 * sweeps the same grid the contract drew.
 */
export function Sequencer({
  grid,
  comp,
  step,
  playing,
  className,
}: {
  grid: PixelGrid;
  comp: Composition;
  step: number;
  playing: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const box = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(box.width));
    const h = Math.max(1, Math.floor(box.height));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const size = grid.size;
    const cw = w / size;
    const ch = h / size;
    const hue = comp.hue;

    // grid lines
    ctx.strokeStyle = "rgba(94,234,212,0.07)";
    ctx.lineWidth = 1;
    for (let i = 1; i < size; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.round(i * cw) + 0.5, 0);
      ctx.lineTo(Math.round(i * cw) + 0.5, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, Math.round(i * ch) + 0.5);
      ctx.lineTo(w, Math.round(i * ch) + 0.5);
      ctx.stroke();
    }

    // playhead column
    if (playing && step >= 0) {
      const col = step % size;
      ctx.fillStyle = "rgba(94,234,212,0.12)";
      ctx.fillRect(col * cw, 0, cw, h);
      ctx.strokeStyle = "rgba(94,234,212,0.55)";
      ctx.strokeRect(Math.round(col * cw) + 0.5, 0.5, Math.round(cw) - 1, h - 1);
    }

    // ink cells = notes
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!grid.cells[y * size + x]) continue;
        const active = playing && step >= 0 && x === step % size;
        const pad = active ? 0.5 : 1.5;
        if (active) {
          ctx.fillStyle = `hsl(${hue} 90% 72%)`;
          ctx.shadowColor = `hsl(${hue} 90% 60%)`;
          ctx.shadowBlur = 14;
        } else {
          ctx.fillStyle = `hsl(${hue} 42% ${38 + ((size - y) / size) * 22}%)`;
          ctx.shadowBlur = 0;
        }
        ctx.fillRect(x * cw + pad, y * ch + pad, cw - pad * 2, ch - pad * 2);
      }
    }
    ctx.shadowBlur = 0;
  }, [grid, comp, step, playing]);

  return (
    <canvas
      ref={ref}
      className={cn("block h-full w-full", className)}
      aria-label={`${grid.size}-step sequencer derived from the on-chain artwork`}
    />
  );
}

/** Live oscilloscope off the master bus. */
export function Scope({ active, className, height = 44 }: { active: boolean; className?: string; height?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useRaf(active, () => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const box = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(box.width));
    const h = Math.max(1, Math.floor(box.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const data = engine.getWaveform();
    ctx.strokeStyle = "rgba(94,234,212,0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (!data) {
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
    } else {
      for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * w;
        const y = h / 2 - data[i] * (h / 2) * 0.92;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  });

  useEffect(() => {
    if (active) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const box = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, box.width, box.height);
    ctx.strokeStyle = "rgba(140,163,180,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, box.height / 2);
    ctx.lineTo(box.width, box.height / 2);
    ctx.stroke();
  }, [active]);

  return <canvas ref={ref} style={{ height }} className={cn("block w-full", className)} />;
}

/** 12-segment VU, fed by the master meter. */
export function Vu({ active, segments = 12 }: { active: boolean; segments?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useRaf(active, () => {
    const el = ref.current;
    if (!el) return;
    const db = engine.getLevel();
    const norm = Math.max(0, Math.min(1, (db + 48) / 48));
    const lit = Math.round(norm * segments);
    const kids = el.children;
    for (let i = 0; i < kids.length; i++) {
      const on = i < lit;
      const node = kids[i] as HTMLElement;
      node.style.background = on
        ? i > segments - 3
          ? "#FF8A4C"
          : i > segments - 6
            ? "#FFC857"
            : "#5EEAD4"
        : "#1a2432";
    }
  });

  useEffect(() => {
    if (active) return;
    const el = ref.current;
    if (!el) return;
    for (let i = 0; i < el.children.length; i++) {
      (el.children[i] as HTMLElement).style.background = "#1a2432";
    }
  }, [active]);

  return (
    <div ref={ref} className="flex h-3 items-end gap-[2px]">
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className="block h-full w-[3px] rounded-[1px] bg-[#1a2432]" />
      ))}
    </div>
  );
}

/** Step lamps for the rhythm lanes. */
export function StepLamps({
  values,
  step,
  playing,
  tone = "teal",
}: {
  values: boolean[];
  step: number;
  playing: boolean;
  tone?: "teal" | "orange" | "amber";
}) {
  const colors: Record<string, string> = { teal: "#5EEAD4", orange: "#FF8A4C", amber: "#FFC857" };
  return (
    <div className="flex gap-[3px]">
      {values.map((on, i) => {
        const here = playing && i === step % values.length;
        return (
          <span
            key={i}
            className="h-2.5 flex-1 rounded-[1px] transition-colors duration-75"
            style={{
              background: on ? (here ? colors[tone] : `${colors[tone]}55`) : here ? "#2b3a4b" : "#151d29",
            }}
          />
        );
      })}
    </div>
  );
}
