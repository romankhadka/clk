import { CONFIG } from '../config';
import { GLYPHS } from './glyphs';
import { hashString, mulberry32 } from '../sim/rng';

// Rasterize a glyph once at a fixed, screen-independent resolution and
// stratified-sample it into a constellation. Deterministic and index-stable
// per glyph — resize remapping relies on point k meaning the same spot.
export interface GlyphPoints {
  xy: Float32Array; // interleaved, glyph units (advance x 1.6, y down)
  weight: Float32Array; // 0..1 brightness weight, soft core-to-edge falloff
  count: number;
}

const RASTER = 160; // px per glyph unit
const cache = new Map<string, GlyphPoints>();

export function glyphPoints(ch: string): GlyphPoints {
  const hit = cache.get(ch);
  if (hit) return hit;

  const glyph = GLYPHS[ch];
  const hU = 1.6;
  const pad = Math.ceil(RASTER * 0.12);
  const wPx = Math.ceil(glyph.advance * RASTER) + pad * 2;
  const hPx = Math.ceil(hU * RASTER) + pad * 2;

  const cv = document.createElement('canvas');
  cv.width = wPx;
  cv.height = hPx;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.translate(pad, pad);
  ctx.scale(RASTER, RASTER);
  ctx.lineWidth = CONFIG.digits.strokeFrac * hU;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#fff';
  ctx.stroke(new Path2D(glyph.d));
  const img = ctx.getImageData(0, 0, wPx, hPx).data;

  // one candidate point per grid cell, jittered, kept by dithered threshold —
  // even coverage without clumps, organic rather than pixel-grid
  const cell = CONFIG.digits.cellUnits * RASTER;
  const rand = mulberry32(hashString('glyph:' + ch));
  const xs: number[] = [];
  const ws: number[] = [];
  const cols = Math.ceil(wPx / cell);
  const rows = Math.ceil(hPx / cell);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const jx = (rand() - 0.5) * 0.9;
      const jy = (rand() - 0.5) * 0.9;
      const th = 0.15 + rand() * 0.55;
      const px = Math.min(wPx - 1, Math.max(0, Math.round((c + 0.5 + jx) * cell)));
      const py = Math.min(hPx - 1, Math.max(0, Math.round((r + 0.5 + jy) * cell)));
      const alpha = img[(py * wPx + px) * 4 + 3] / 255;
      if (alpha <= th) continue;
      xs.push(((c + 0.5 + jx) * cell - pad) / RASTER, ((r + 0.5 + jy) * cell - pad) / RASTER);
      ws.push(0.55 + 0.45 * alpha);
    }
  }

  const out: GlyphPoints = {
    xy: new Float32Array(xs),
    weight: new Float32Array(ws),
    count: ws.length,
  };
  cache.set(ch, out);
  return out;
}
