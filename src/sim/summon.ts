import { CONFIG } from '../config';
import { Agents, AgentState } from './agents';
import { mulberry32 } from './rng';
import type { Slot } from '../layout/clockLayout';

const TAU = Math.PI * 2;

// Owns the constellation: which agent holds which target point, the travel
// plans that get each one there by its own 10-15s deadline, and the glow
// ramps that let digits ignite and dim without a single pop.
export class Summoner {
  private slots: Slot[] = [];
  private holders: Int32Array[] = [];
  private decaying: number[] = []; // freed agents easing their glow back to 0
  private rand = mulberry32(0x51ed270b);

  currentSlots(): Slot[] {
    return this.slots;
  }

  // Full reconstellation: free everything, then summon the whole string.
  rebuild(slots: Slot[], a: Agents, now: number, dlMin: number, dlMax: number): void {
    for (let s = 0; s < this.holders.length; s++) this.freeSlot(s, a, now);
    this.slots = slots;
    this.holders = slots.map((slot) => this.summonSlot(slot, a, now, dlMin, dlMax));
  }

  // Minute tick with the same string length: only changed glyphs churn.
  diff(slots: Slot[], a: Agents, now: number): void {
    const c = CONFIG.summon;
    for (let s = 0; s < slots.length; s++) {
      if (this.slots[s]?.ch === slots[s].ch) {
        this.holders[s] = this.holders[s] ?? new Int32Array(0);
        continue;
      }
      if (this.holders[s]) this.freeSlot(s, a, now);
      this.holders[s] = this.summonSlot(slots[s], a, now, c.deadlineMin, c.deadlineMax);
    }
    this.slots = slots;
  }

  // Instant clock rebuild (tab was hidden across a minute change): correctness
  // beats theater — holders appear at their targets with a short fade-in.
  materialize(slots: Slot[], a: Agents, now: number): void {
    for (let s = 0; s < this.holders.length; s++) this.freeSlot(s, a, now);
    this.slots = slots;
    this.holders = slots.map((slot) => {
      const holders = new Int32Array(slot.count);
      for (let k = 0; k < slot.count; k++) {
        const i = this.pick(a, slot.targets[k * 2], slot.targets[k * 2 + 1]);
        holders[k] = i;
        if (i < 0) continue;
        a.state[i] = AgentState.Locked;
        a.pos[i * 2] = slot.targets[k * 2];
        a.pos[i * 2 + 1] = slot.targets[k * 2 + 1];
        a.tgt[i * 2] = slot.targets[k * 2];
        a.tgt[i * 2 + 1] = slot.targets[k * 2 + 1];
        a.weight[i] = slot.weights[k];
        a.glow[i] = slot.weights[k] * 254;
        a.fade[i * 2] = now; // 0.6s brightness fade-in
      }
      return holders;
    });
    a.glowDirty = true;
    a.fadeDirty = true;
  }

  // Viewport changed: same glyphs, new geometry. Holder k maps to new target k
  // (sampling is deterministic per glyph). Locked stars glide; travelers are
  // re-anchored so their position is continuous and their deadline still lands.
  remap(slots: Slot[], a: Agents, now: number): void {
    const glide = CONFIG.summon.resizeGlide;
    for (let s = 0; s < slots.length; s++) {
      const holders = this.holders[s];
      if (!holders) continue;
      const n = Math.min(holders.length, slots[s].count);
      for (let k = 0; k < n; k++) {
        const i = holders[k];
        if (i < 0) continue;
        const tx = slots[s].targets[k * 2];
        const ty = slots[s].targets[k * 2 + 1];
        if (a.state[i] === AgentState.Locked) {
          a.state[i] = AgentState.Summoned;
          a.p0[i * 2] = a.pos[i * 2];
          a.p0[i * 2 + 1] = a.pos[i * 2 + 1];
          a.t0[i] = now;
          a.tArrive[i] = now + glide;
          a.glowFrom[i] = a.glow[i] / 254;
        } else if (a.state[i] === AgentState.Summoned) {
          const u = clamp01((now - a.t0[i]) / (a.tArrive[i] - a.t0[i]));
          const s01 = smootherstep(u);
          if (s01 > 0.9) {
            a.p0[i * 2] = a.pos[i * 2];
            a.p0[i * 2 + 1] = a.pos[i * 2 + 1];
            a.t0[i] = now;
            a.tArrive[i] = now + glide;
            a.glowFrom[i] = a.glow[i] / 254;
          } else {
            // choose p0' so lerp(p0', tgt', u) equals the current position
            a.p0[i * 2] = (a.pos[i * 2] - tx * s01) / (1 - s01);
            a.p0[i * 2 + 1] = (a.pos[i * 2 + 1] - ty * s01) / (1 - s01);
          }
        }
        a.tgt[i * 2] = tx;
        a.tgt[i * 2 + 1] = ty;
      }
    }
    this.slots = slots;
  }

  // Advance travelers, settle arrivals, ease freed glows back down.
  step(a: Agents, now: number, dt: number): void {
    const noiseAmp = CONFIG.summon.noiseAmp;
    let dirty = false;
    for (let s = 0; s < this.holders.length; s++) {
      const holders = this.holders[s];
      for (let k = 0; k < holders.length; k++) {
        const i = holders[k];
        if (i < 0 || a.state[i] !== AgentState.Summoned) continue;
        const u = clamp01((now - a.t0[i]) / (a.tArrive[i] - a.t0[i]));
        const j = i * 2;
        if (u >= 1) {
          a.state[i] = AgentState.Locked;
          a.pos[j] = a.tgt[j];
          a.pos[j + 1] = a.tgt[j + 1];
          a.glow[i] = a.weight[i] * 254;
        } else {
          const e = smootherstep(u);
          const env = noiseAmp * (1 - u) * (1 - u);
          const ns = a.noiseSeed[i];
          a.pos[j] =
            a.p0[j] +
            (a.tgt[j] - a.p0[j]) * e +
            env * (Math.sin(now * 0.9 + ns) * 0.7 + Math.sin(now * 2.1 + ns * 2.3) * 0.3);
          a.pos[j + 1] =
            a.p0[j + 1] +
            (a.tgt[j + 1] - a.p0[j + 1]) * e +
            env * (Math.cos(now * 1.1 + ns * 1.7) * 0.7 + Math.cos(now * 2.4 + ns * 3.1) * 0.3);
          // glow ramps toward the constellation weight, back-loaded so the
          // digit visibly ignites as its stars settle
          a.glow[i] = 254 * (a.glowFrom[i] + (a.weight[i] - a.glowFrom[i]) * u * u);
        }
        dirty = true;
      }
    }

    for (let d = this.decaying.length - 1; d >= 0; d--) {
      const i = this.decaying[d];
      if (a.state[i] !== AgentState.Free) {
        // re-summoned mid-decay: its travel glow takes over from here
        this.decaying[d] = this.decaying[this.decaying.length - 1];
        this.decaying.pop();
        continue;
      }
      const g = a.glow[i] - dt * 170; // ~1.5s from full digit glow to plain star
      if (g <= 0) {
        a.glow[i] = 0;
        this.decaying[d] = this.decaying[this.decaying.length - 1];
        this.decaying.pop();
      } else {
        a.glow[i] = g;
      }
      dirty = true;
    }
    if (dirty) a.glowDirty = true;
  }

  private freeSlot(s: number, a: Agents, now: number): void {
    const holders = this.holders[s];
    if (!holders) return;
    for (let k = 0; k < holders.length; k++) {
      const i = holders[k];
      if (i < 0) continue;
      a.state[i] = AgentState.Free;
      const ang = this.rand() * TAU;
      const sp = 4 + this.rand() * 8;
      a.vel[i * 2] = Math.cos(ang) * sp;
      a.vel[i * 2 + 1] = Math.sin(ang) * sp;
      a.nextEventAt[i] = now + 1 + this.rand() * 3;
      if (a.glow[i] > 0) this.decaying.push(i);
    }
    this.holders[s] = new Int32Array(0);
  }

  private summonSlot(
    slot: Slot,
    a: Agents,
    now: number,
    dlMin: number,
    dlMax: number,
  ): Int32Array {
    const holders = new Int32Array(slot.count);
    for (let k = 0; k < slot.count; k++) {
      const tx = slot.targets[k * 2];
      const ty = slot.targets[k * 2 + 1];
      const i = this.pick(a, tx, ty);
      holders[k] = i;
      if (i < 0) continue;
      a.state[i] = AgentState.Summoned;
      a.p0[i * 2] = a.pos[i * 2];
      a.p0[i * 2 + 1] = a.pos[i * 2 + 1];
      a.tgt[i * 2] = tx;
      a.tgt[i * 2 + 1] = ty;
      a.t0[i] = now + this.rand() * 0.8; // slight stagger in departures
      a.tArrive[i] = a.t0[i] + dlMin + this.rand() * (dlMax - dlMin);
      a.weight[i] = slot.weights[k];
      a.glowFrom[i] = a.glow[i] / 254;
      a.vel[i * 2] = 0;
      a.vel[i * 2 + 1] = 0;
    }
    return holders;
  }

  // Best-of-K: sample K random free agents, take the nearest. Soft distance
  // bias with wide spatial spread, no spatial index needed.
  private pick(a: Agents, tx: number, ty: number): number {
    const lo = CONFIG.staticReserve;
    const span = Math.min(CONFIG.summonPoolMax, a.drawCount) - lo;
    let best = -1;
    let bestD = Infinity;
    for (let t = 0; t < CONFIG.summon.candidateK; t++) {
      let i = -1;
      for (let tries = 0; tries < 24; tries++) {
        const cand = lo + ((this.rand() * span) | 0);
        if (a.state[cand] === AgentState.Free) {
          i = cand;
          break;
        }
      }
      if (i < 0) continue;
      const dx = a.pos[i * 2] - tx;
      const dy = a.pos[i * 2 + 1] - ty;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) a.state[best] = AgentState.Summoned; // claim immediately
    return best;
  }
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function smootherstep(x: number): number {
  return x * x * x * (x * (x * 6 - 15) + 10);
}
