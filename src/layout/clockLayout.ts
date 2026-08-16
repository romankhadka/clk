import { CONFIG } from '../config';
import { GLYPHS } from './glyphs';
import { glyphPoints } from './digitSampler';

// A slot is one glyph of the time string placed on screen.
export interface Slot {
  ch: string;
  targets: Float32Array; // xy interleaved, CSS px
  weights: Float32Array;
  count: number;
}

export function layoutClock(slots: string, w: number, h: number): Slot[] {
  const d = CONFIG.digits;
  const vmin = Math.min(w, h);
  const glyphH = Math.min(d.heightMaxPx, Math.max(d.heightMinPx, (d.heightVmin / 100) * vmin));
  const scale = glyphH / 1.6; // px per glyph unit
  const gap = d.gap * scale;

  let totalW = -gap;
  for (const ch of slots) totalW += GLYPHS[ch].advance * scale + gap;

  let x = (w - totalW) / 2;
  const y = h * d.centerYFrac - glyphH / 2;
  const out: Slot[] = [];
  for (const ch of slots) {
    const gp = glyphPoints(ch);
    const targets = new Float32Array(gp.count * 2);
    for (let k = 0; k < gp.count; k++) {
      targets[k * 2] = x + gp.xy[k * 2] * scale;
      targets[k * 2 + 1] = y + gp.xy[k * 2 + 1] * scale;
    }
    out.push({ ch, targets, weights: gp.weight, count: gp.count });
    x += GLYPHS[ch].advance * scale + gap;
  }
  return out;
}
