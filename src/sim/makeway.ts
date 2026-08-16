import { CONFIG } from '../config';
import type { Slot } from '../layout/clockLayout';

// Occupancy bitmap over the digit block's bounding box only. Wanderers test
// two compares to know they're outside; the grid lookup happens for the tiny
// fraction that drifts in.
export class MakeWay {
  private grid = new Uint8Array(0);
  private x0 = 0;
  private y0 = 0;
  private x1 = -1; // exclusive; empty grid rejects everything
  private y1 = -1;
  private cols = 0;
  // center of the lit cell of the most recent hit — lets the evicted star
  // slide off locally instead of fleeing the whole digit block
  hitCX = 0;
  hitCY = 0;

  rebuild(slots: Slot[]): void {
    const cell = CONFIG.makeWay.cell;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    let total = 0;
    for (const s of slots) {
      for (let k = 0; k < s.count; k++) {
        const x = s.targets[k * 2];
        const y = s.targets[k * 2 + 1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      total += s.count;
    }
    if (total === 0) {
      this.x1 = this.x0 - 1;
      return;
    }
    const pad = cell * 2;
    this.x0 = minX - pad;
    this.y0 = minY - pad;
    this.x1 = maxX + pad;
    this.y1 = maxY + pad;
    this.cols = Math.ceil((this.x1 - this.x0) / cell);
    const rows = Math.ceil((this.y1 - this.y0) / cell);
    this.grid = new Uint8Array(this.cols * rows);
    for (const s of slots) {
      for (let k = 0; k < s.count; k++) {
        const c = ((s.targets[k * 2] - this.x0) / cell) | 0;
        const r = ((s.targets[k * 2 + 1] - this.y0) / cell) | 0;
        this.grid[r * this.cols + c] = 1;
      }
    }
  }

  hits(x: number, y: number): boolean {
    if (x < this.x0 || x >= this.x1 || y < this.y0 || y >= this.y1) return false;
    const cell = CONFIG.makeWay.cell;
    const c = ((x - this.x0) / cell) | 0;
    const r = ((y - this.y0) / cell) | 0;
    if (this.grid[r * this.cols + c] !== 1) return false;
    this.hitCX = this.x0 + (c + 0.5) * cell;
    this.hitCY = this.y0 + (r + 0.5) * cell;
    return true;
  }
}
