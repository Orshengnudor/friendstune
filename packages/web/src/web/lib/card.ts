import type { PixelGrid } from "./friends";
import type { Composition } from "./music";
import { computeVibeScore } from "./music";

/**
 * THE TUNE CARD
 * -------------
 * A share image drawn entirely in the browser from the same two sources the
 * player uses: the on-chain artwork bitmap and the composition derived from the
 * token's traits. No screenshot, no server, no external asset except the site
 * mark. 1080x1350 so it posts cleanly on X and Instagram.
 */

const W = 1080;
const H = 1350;

const C = {
  bg: "#0a0e14",
  panel: "#101722",
  panel2: "#161f2c",
  line: "#22303f",
  ink: "#e8f1f6",
  dim: "#8ca3b4",
  teal: "#5eead4",
  orange: "#ff8a4c",
  amber: "#ffc857",
  violet: "#a78bfa",
};

const display = (size: number, weight = 700) =>
  `${weight} ${size}px "Chakra Petch", ui-sans-serif, system-ui, sans-serif`;
const mono = (size: number, weight = 500) =>
  `${weight} ${size}px "JetBrains Mono", ui-monospace, monospace`;

export interface CardInput {
  name: string;
  collection: string;
  tokenId: string;
  grid: PixelGrid;
  comp: Composition;
  tags: string[];
  /** Live chart counters, drawn only when the Friend actually has some. */
  counters?: { likes?: number; plays?: number; downloads?: number; earnedRf?: number } | null;
  priceLabel?: string;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = C.dim) {
  ctx.font = mono(17, 500);
  ctx.fillStyle = color;
  ctx.letterSpacing = "2.4px";
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.letterSpacing = "0px";
}

/**
 * Trims to what actually fits, measured in the font already set on the
 * context. Character counts lie: "Garden warmth" and "Cellar damp" are the
 * same length and nowhere near the same width.
 */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

/** Waits for the webfonts so the card never renders in a fallback face. */
async function ensureFonts() {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all([
      document.fonts.load('700 64px "Chakra Petch"'),
      document.fonts.load('500 20px "JetBrains Mono"'),
      document.fonts.ready,
    ]);
  } catch {
    /* fallback faces are fine */
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function renderTuneCard(input: CardInput): Promise<Blob> {
  const { comp, grid } = input;
  await ensureFonts();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser");

  const accent = input.collection === "genesis" ? C.orange : C.teal;

  // ---- background: flat dark, faint console grid, accent glow behind the art
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 520, 40, W / 2, 520, 760);
  glow.addColorStop(0, `${accent}22`);
  glow.addColorStop(1, "#0a0e1400");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#ffffff07";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 45) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 45) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }

  // ---- header
  const logo = await loadImage("/logo.png");
  if (logo) ctx.drawImage(logo, 64, 58, 56, 56);
  ctx.font = display(30, 700);
  ctx.fillStyle = C.ink;
  ctx.letterSpacing = "4px";
  ctx.fillText("FRIENDSTUNE", 136, 98);
  ctx.letterSpacing = "0px";
  ctx.textAlign = "right";
  label(ctx, `${input.collection} #${input.tokenId}`, W - 64, 96, accent);
  ctx.textAlign = "left";

  ctx.strokeStyle = C.line;
  ctx.beginPath();
  ctx.moveTo(64, 140);
  ctx.lineTo(W - 64, 140);
  ctx.stroke();

  // ---- artwork, drawn from the on-chain bitmap so it stays pixel sharp
  const artSize = 560;
  const artX = (W - artSize) / 2;
  const artY = 196;
  ctx.fillStyle = "#070a0f";
  roundRect(ctx, artX, artY, artSize, artSize, 6);
  ctx.fill();
  ctx.strokeStyle = `${accent}55`;
  ctx.lineWidth = 2;
  ctx.stroke();

  const cell = artSize / grid.size;
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) {
      if (!grid.cells[y * grid.size + x]) continue;
      const shade = 0.55 + 0.45 * (1 - y / grid.size);
      ctx.globalAlpha = shade;
      ctx.fillStyle = accent;
      ctx.fillRect(
        Math.floor(artX + x * cell),
        Math.floor(artY + y * cell),
        Math.ceil(cell),
        Math.ceil(cell),
      );
    }
  }
  ctx.globalAlpha = 1;

  // scanlines over the art, same as the console UI
  ctx.fillStyle = "#00000022";
  for (let y = artY; y < artY + artSize; y += 4) ctx.fillRect(artX, y, artSize, 2);

  label(ctx, `${grid.size}x${grid.size} on-chain bitmap · ${grid.inkCount} ink`, artX, artY - 18);
  ctx.textAlign = "right";
  label(ctx, `${comp.steps} steps`, artX + artSize, artY - 18);
  ctx.textAlign = "left";

  // ---- name + tags
  let y = artY + artSize + 78;
  ctx.font = display(64, 700);
  ctx.fillStyle = C.ink;
  ctx.fillText(fit(ctx, input.name, W - 128), 64, y);

  y += 44;
  let tagX = 64;
  ctx.font = mono(19, 500);
  for (const tag of input.tags.slice(0, 5)) {
    const text = tag.toUpperCase();
    const w = ctx.measureText(text).width + 28;
    if (tagX + w > W - 64) break;
    ctx.fillStyle = `${accent}14`;
    roundRect(ctx, tagX, y - 24, w, 36, 4);
    ctx.fill();
    ctx.strokeStyle = `${accent}44`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.letterSpacing = "2px";
    ctx.fillText(text, tagX + 14, y);
    ctx.letterSpacing = "0px";
    tagX += w + 10;
  }

  // ---- the tune, four figures
  y += 74;
  ctx.fillStyle = C.panel;
  roundRect(ctx, 64, y - 40, W - 128, 150, 6);
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  ctx.stroke();

  const vibe = computeVibeScore(comp);
  const figures: { k: string; v: string; tone: string }[] = [
    { k: "key", v: `${comp.rootName} ${comp.scaleName}`, tone: C.teal },
    { k: "tempo", v: `${comp.bpm} BPM`, tone: C.ink },
    { k: "room", v: comp.room.name, tone: C.ink },
    { k: "vibe", v: String(vibe.total), tone: C.amber },
  ];
  const colW = (W - 128) / figures.length;
  figures.forEach((f, i) => {
    const x = 64 + i * colW + 26;
    label(ctx, f.k, x, y);
    ctx.font = display(34, 600);
    ctx.fillStyle = f.tone;
    ctx.fillText(fit(ctx, f.v, colW - 44), x, y + 44);
  });

  // ---- step lamps: the kick and hat pattern, the tune's signature
  y += 140;
  const lampsW = W - 128;
  const drawLamps = (values: boolean[], rowY: number, tone: string) => {
    const n = values.length;
    const gap = 6;
    const w = (lampsW - gap * (n - 1)) / n;
    values.forEach((on, i) => {
      const x = 64 + i * (w + gap);
      ctx.fillStyle = on ? tone : C.panel2;
      roundRect(ctx, x, rowY, w, 16, 3);
      ctx.fill();
    });
  };
  label(ctx, "kick", 64, y - 8);
  drawLamps(comp.kick, y, accent);
  label(ctx, "hat", 64, y + 56);
  drawLamps(comp.hat, y + 64, C.amber);

  // ---- chart counters, only when the Friend has any
  y += 118;
  const counters = input.counters;
  const chart: { k: string; v: string }[] = [];
  if (counters?.likes) chart.push({ k: "likes", v: counters.likes.toLocaleString() });
  if (counters?.plays) chart.push({ k: "listens", v: counters.plays.toLocaleString() });
  if (counters?.downloads) chart.push({ k: "downloads", v: counters.downloads.toLocaleString() });
  if (counters?.earnedRf) {
    chart.push({ k: "earned · sim rf", v: counters.earnedRf.toLocaleString() });
  }
  if (chart.length > 0) {
    // same four column grid as the tune figures above, so the two rows line up
    const chartColW = (W - 128) / 4;
    chart.slice(0, 4).forEach((item, i) => {
      const cx = 64 + i * chartColW;
      label(ctx, item.k, cx, y);
      ctx.font = display(30, 600);
      ctx.fillStyle = C.violet;
      ctx.fillText(fit(ctx, item.v, chartColW - 20), cx, y + 36);
    });
  }

  // ---- footer
  ctx.strokeStyle = C.line;
  ctx.beginPath();
  ctx.moveTo(64, H - 88);
  ctx.lineTo(W - 64, H - 88);
  ctx.stroke();

  label(ctx, "every rare friend already had a tune", 64, H - 42, C.dim);
  ctx.textAlign = "right";
  label(ctx, input.priceLabel ?? "friendstune", W - 64, H - 42, accent);
  ctx.textAlign = "left";

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The card could not be encoded"));
    }, "image/png");
  });
}
