import { CONFIG } from '../config';
import { Agents, AgentState } from './agents';
import { mulberry32 } from './rng';
import type { Slot } from '../layout/clockLayout';

const TAU = Math.PI * 2;

// Owns the constellation: which block holds which target point, the journeys
// that carry each one there at its own speed, and the glow ramps that let
// digits ignite and dim without a single pop.
//
// Travel is physical: a summoned block cruises toward its target at a speed
// chosen within ±25% of its lifelong speed property, so a slow block picked
// far away genuinely takes its time crossing the canvas.
export class Summoner {
  private slots: Slot[] = [];
  private holders: Int32Array[] = [];
  private decaying: number[] = []; // freed blocks easing their glow back to 0
  private rand = mulberry32(0x51ed270b);

  currentSlots(): Slot[] {
    return this.slots;
  }

  // Full reconstellation: free everything, then summon the whole string.
  rebuild(slots: Slot[], a: Agents, now: number, firstLoad = false): void {
    for (let s = 0; s < this.holders.length; s++) this.freeSlot(s, a, now);
    this.slots = slots;
    this.holders = slots.map((slot) => this.summonSlot(slot, a, firstLoad));
  }

  // Minute tick with the same string length: only changed glyphs churn.
  diff(slots: Slot[], a: Agents, now: number): void {
    for (let s = 0; s < slots.length; s++) {
      if (this.slots[s]?.ch === slots[s].ch) {
        this.holders[s] = this.holders[s] ?? new Int32Array(0);
        continue;
      }
      if (this.holders[s]) this.freeSlot(s, a, now);
      this.holders[s] = this.summonSlot(slots[s], a, false);
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
        const i = this.pick(a, slot.targets[k * 2], slot.targets[k * 2 + 1], CONFIG.summon.candidateK);
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
  // (sampling is deterministic per glyph). Locked blocks travel to the new
  // spot at their best pace; in-flight blocks simply re-aim.
  remap(slots: Slot[], a: Agents): void {
    const jit = CONFIG.wander.speedJitter;
    for (let s = 0; s < slots.length; s++) {
      const holders = this.holders[s];
      if (!holders) continue;
      const n = Math.min(holders.length, slots[s].count);
      for (let k = 0; k < n; k++) {
        const i = holders[k];
        if (i < 0) continue;
        const tx = slots[s].targets[k * 2];
        const ty = slots[s].targets[k * 2 + 1];
        a.tgt[i * 2] = tx;
        a.tgt[i * 2 + 1] = ty;
        const d = Math.hypot(tx - a.pos[i * 2], ty - a.pos[i * 2 + 1]);
        if (a.state[i] === AgentState.Locked) {
          a.state[i] = AgentState.Summoned;
          a.cruise[i] = a.baseSpeed[i] * a.speedScale * (1 + jit); // hurry, it was settled
          a.glowFrom[i] = a.glow[i] / 254;
        }
        a.dist0[i] = Math.max(d, 1);
      }
    }
    this.slots = slots;
  }

  // Advance journeys, settle arrivals, ease freed glows back down.
  step(a: Agents, now: number, dt: number): void {
    const meander = CONFIG.summon.meanderFrac;
    let dirty = false;
    for (let s = 0; s < this.holders.length; s++) {
      const holders = this.holders[s];
      for (let k = 0; k < holders.length; k++) {
        const i = holders[k];
        if (i < 0 || a.state[i] !== AgentState.Summoned) continue;
        const j = i * 2;
        const dx = a.tgt[j] - a.pos[j];
        const dy = a.tgt[j + 1] - a.pos[j + 1];
        const dist = Math.hypot(dx, dy);
        const step = a.cruise[i] * dt;
        if (dist <= Math.max(step, 1.2)) {
          a.state[i] = AgentState.Locked;
          a.pos[j] = a.tgt[j];
          a.pos[j + 1] = a.tgt[j + 1];
          a.glow[i] = a.weight[i] * 254;
        } else {
          // cruise toward the target with a lateral drift that fades in the
          // final approach — a roaming path, not a laser line
          const nx = dx / dist;
          const ny = dy / dist;
          const ns = a.noiseSeed[i];
          const lat =
            a.cruise[i] *
            meander *
            Math.min(1, dist / 220) *
            Math.sin(now * (0.6 + (ns % 1)) + ns);
          a.pos[j] += (nx * a.cruise[i] - ny * lat) * dt;
          a.pos[j + 1] += (ny * a.cruise[i] + nx * lat) * dt;
          // glow ramps with progress so the digit visibly ignites as its
          // blocks close in
          const u = Math.max(0, Math.min(1, 1 - dist / a.dist0[i]));
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
      const g = a.glow[i] - dt * 170; // ~1.5s from full digit glow to plain block
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
    const jit = CONFIG.wander.speedJitter;
    for (let k = 0; k < holders.length; k++) {
      const i = holders[k];
      if (i < 0) continue;
      a.state[i] = AgentState.Free;
      const ang = this.rand() * TAU;
      const sp = a.baseSpeed[i] * a.speedScale * (1 - jit + 2 * jit * this.rand());
      a.vel[i * 2] = Math.cos(ang) * sp;
      a.vel[i * 2 + 1] = Math.sin(ang) * sp;
      a.nextEventAt[i] = now + 1 + this.rand() * 3;
      if (a.glow[i] > 0) this.decaying.push(i);
    }
    this.holders[s] = new Int32Array(0);
  }

  private summonSlot(slot: Slot, a: Agents, firstLoad: boolean): Int32Array {
    const jit = CONFIG.wander.speedJitter;
    const K = firstLoad ? CONFIG.summon.firstLoadK : CONFIG.summon.candidateK;
    const holders = new Int32Array(slot.count);
    for (let k = 0; k < slot.count; k++) {
      const tx = slot.targets[k * 2];
      const ty = slot.targets[k * 2 + 1];
      const i = this.pick(a, tx, ty, K);
      holders[k] = i;
      if (i < 0) continue;
      a.state[i] = AgentState.Summoned;
      a.tgt[i * 2] = tx;
      a.tgt[i * 2 + 1] = ty;
      // the block sets its own pace for this journey, within its ±25% band
      // (the very first clock hurries at the top of the band)
      a.cruise[i] =
        a.baseSpeed[i] * a.speedScale * (firstLoad ? 1 + jit : 1 - jit + 2 * jit * this.rand());
      a.dist0[i] = Math.max(1, Math.hypot(tx - a.pos[i * 2], ty - a.pos[i * 2 + 1]));
      a.weight[i] = slot.weights[k];
      a.glowFrom[i] = a.glow[i] / 254;
      a.vel[i * 2] = 0;
      a.vel[i * 2 + 1] = 0;
    }
    return holders;
  }

  // Best-of-K by travel time: sample K random free blocks and take the one
  // whose speed gets it there soonest. Slow far blocks still get picked
  // sometimes; fast far blocks compete with slow near ones.
  private pick(a: Agents, tx: number, ty: number, K: number): number {
    const lo = CONFIG.staticReserve;
    const span = Math.min(CONFIG.summonPoolMax, a.drawCount) - lo;
    let best = -1;
    let bestT = Infinity;
    for (let t = 0; t < K; t++) {
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
      const travel = Math.hypot(dx, dy) / a.baseSpeed[i];
      if (travel < bestT) {
        bestT = travel;
        best = i;
      }
    }
    if (best >= 0) a.state[best] = AgentState.Summoned; // claim immediately
    return best;
  }
}
