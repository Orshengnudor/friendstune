import { COLLECTIONS } from '../lib/friends';
import { downloadBlob } from '../lib/download';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function downloadShareCard(friend, composition) {
  const W = 1000;
  const H = 1250;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0A0E14');
  bg.addColorStop(1, '#131826');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#EDEEF2';
  ctx.font = '600 34px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('FRIENDS', 60, 90);
  ctx.fillStyle = '#FF9F1C';
  ctx.fillText('TUNE', 60 + ctx.measureText('FRIENDS').width, 90);

  const bayX = 220, bayY = 150, bayW = 560, bayH = 560;
  ctx.strokeStyle = '#2A3244';
  ctx.lineWidth = 3;
  ctx.strokeRect(bayX, bayY, bayW, bayH);

  if (friend.image) {
    try {
      const img = await loadImage(friend.image);
      ctx.imageSmoothingEnabled = false;
      const scale = Math.min(bayW / img.width, bayH / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, bayX + (bayW - w) / 2, bayY + (bayH - h) / 2, w, h);
    } catch {
      // Falls through with an empty bay if the image can't be loaded cross-origin.
    }
  }

  const waveY = bayY + bayH + 60;
  ctx.strokeStyle = '#5EEAD4';
  ctx.lineWidth = 3;
  ctx.beginPath();
  const notes = composition.melody;
  const stepW = bayW / notes.length;
  notes.forEach((note, i) => {
    const x = bayX + i * stepW + stepW / 2;
    const amplitude = note ? 40 + (i % 5) * 8 : 6;
    const y1 = waveY - amplitude, y2 = waveY + amplitude;
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
  });
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#7C8699';
  ctx.font = '500 22px Inter, sans-serif';
  const labelX = 220, valueX = 520;
  let ty = waveY + 90;
  const row = (label, value) => {
    ctx.fillStyle = '#7C8699';
    ctx.fillText(label, labelX, ty);
    ctx.fillStyle = '#EDEEF2';
    ctx.font = '600 22px Inter, sans-serif';
    ctx.fillText(String(value), valueX, ty);
    ctx.font = '500 22px Inter, sans-serif';
    ty += 42;
  };
  row('Collection', COLLECTIONS[friend.collection].label);
  row('Token', `#${friend.tokenId}`);
  if (friend.family) row('Family', friend.family);
  if (friend.generation !== null && friend.generation !== undefined) row('Generation', friend.generation);
  if (friend.tier !== null && friend.tier !== undefined) row('Activation tier', friend.tier);

  ctx.fillStyle = '#4A5468';
  ctx.font = '400 18px Inter, sans-serif';
  ctx.fillText('friendstune.xyz', labelX, H - 50);

  canvas.toBlob((blob) => {
    downloadBlob(blob, `${friend.collection}-${friend.tokenId}-friendstune-card.png`);
  }, 'image/png');
}
