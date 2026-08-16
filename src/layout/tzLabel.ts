import { CONFIG } from '../config';
import { mulberry32, hashString } from '../sim/rng';

// Rasterize the timezone name small and sharp, then sample lit pixels into
// static square positions — a quiet dotted-text anchor at the bottom.
export function labelPoints(text: string, w: number, h: number): Float32Array {
  const c = CONFIG.label;
  const ss = 3; // supersample factor for a clean raster
  const fontPx = c.fontPx * ss;

  const cv = document.createElement('canvas');
  const font = `${c.weight} ${fontPx}px system-ui, -apple-system, sans-serif`;
  const setType = (ctx2: CanvasRenderingContext2D): void => {
    ctx2.font = font;
    if ('letterSpacing' in ctx2) {
      (ctx2 as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0.3em';
    }
  };
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  setType(ctx);
  cv.width = Math.ceil(ctx.measureText(text).width) + fontPx * 3;
  cv.height = Math.ceil(fontPx * 1.6);
  setType(ctx); // resizing the canvas resets context state
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, fontPx, cv.height / 2);
  const img = ctx.getImageData(0, 0, cv.width, cv.height).data;

  // find lit extent so the block centers on actual ink
  let minX = cv.width,
    maxX = 0;
  for (let y = 0; y < cv.height; y++) {
    for (let x = 0; x < cv.width; x++) {
      if (img[(y * cv.width + x) * 4 + 3] > 100) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  if (maxX <= minX) return new Float32Array(0);

  const step = c.spacing * ss;
  const rand = mulberry32(hashString('tz:' + text));
  const pts: number[] = [];
  for (let y = 0; y < cv.height; y += step) {
    for (let x = 0; x < cv.width; x += step) {
      const jx = x + (rand() - 0.5) * step * 0.5;
      const jy = y + (rand() - 0.5) * step * 0.5;
      const px = Math.min(cv.width - 1, Math.max(0, Math.round(jx)));
      const py = Math.min(cv.height - 1, Math.max(0, Math.round(jy)));
      if (img[(py * cv.width + px) * 4 + 3] > 100) pts.push(jx, jy);
    }
  }

  // place bottom-center in CSS px: ink horizontally centered, text midline
  // sitting margin-vmin above the bottom edge
  const vmin = Math.min(w, h);
  const inkW = (maxX - minX) / ss;
  const centerY = h - (c.marginVmin / 100) * vmin;
  const n = Math.min(pts.length / 2, CONFIG.staticReserve);
  const out = new Float32Array(n * 2);
  for (let k = 0; k < n; k++) {
    out[k * 2] = (w - inkW) / 2 + (pts[k * 2] - minX) / ss;
    out[k * 2 + 1] = centerY + (pts[k * 2 + 1] - cv.height / 2) / ss;
  }
  return out;
}
