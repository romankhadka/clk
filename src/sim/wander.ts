import { CONFIG } from '../config';
import { Agents, AgentState } from './agents';
import { randF } from './rng';
import type { MakeWay } from './makeway';

const TAU = Math.PI * 2;

// One flat pass over the live pool: free-block integration, decision events,
// edge bounces, and the make-way rule. Summoned blocks are advanced in
// summon.ts; locked and static blocks cost one byte-compare here.
//
// Blocks never stop: only a small rester minority (seed < restFraction) may
// pause at a decision. Everyone else travels perpetually at a speed within
// ±25% of their lifelong speed property, bouncing off the canvas edges.
// (prefers-reduced-motion calms the digit transitions in summon.ts; the
// field itself always roams — it is the whole point of the piece.)
export interface Gravity {
  x: number;
  y: number;
  strength: number; // 0..1, fades as the pointer arrives and leaves
}

export function stepWander(
  a: Agents,
  mw: MakeWay,
  now: number,
  dt: number,
  w: number,
  h: number,
  grav: Gravity | null,
): void {
  const c = CONFIG.wander;
  const g = CONFIG.cursor;
  const scale = a.speedScale; // smaller canvas, slower field
  const pos = a.pos,
    vel = a.vel,
    state = a.state,
    next = a.nextEventAt,
    rng = a.rng;

  // cursor gravity, precomputed per frame
  const gOn = grav !== null && grav.strength > 0.001;
  const gR = gOn
    ? Math.min(g.radiusMax, Math.max(g.radiusMin, (g.radiusVmin / 100) * Math.min(w, h)))
    : 0;
  const gR2 = gR * gR;
  const gThresh = 1 - g.susceptible; // blocks above this seed feel the pull
  const gX = grav?.x ?? 0;
  const gY = grav?.y ?? 0;
  // scaled too, so the well pulls in proportion to how fast the field runs
  const gAccel = (grav?.strength ?? 0) * g.pull * scale * dt;
  for (let i = CONFIG.staticReserve; i < a.drawCount; i++) {
    if (state[i] !== AgentState.Free) continue;
    const j = i * 2;

    // light gravity: curve susceptible blocks toward the cursor without
    // letting them exceed their own speed band — the pull steers, it never
    // makes a block faster than it is
    if (gOn && a.seed[i] > gThresh) {
      const dx = gX - pos[j];
      const dy = gY - pos[j + 1];
      const d2 = dx * dx + dy * dy;
      if (d2 < gR2) {
        const d = Math.sqrt(d2) || 1;
        // full strength at the middle of the well, releasing at the rim and
        // again at the core so blocks settle into a swarm, not a point
        const rim = 1 - d / gR;
        const core = Math.min(1, d / g.core);
        const k = (gAccel * rim * rim * core) / d;
        vel[j] += (dx - dy * g.swirl) * k;
        vel[j + 1] += (dy + dx * g.swirl) * k;
        const sp = Math.hypot(vel[j], vel[j + 1]);
        const lo = a.baseSpeed[i] * scale * (1 - c.speedJitter);
        const hi = a.baseSpeed[i] * scale * (1 + c.speedJitter);
        if (sp > hi) {
          vel[j] = (vel[j] / sp) * hi;
          vel[j + 1] = (vel[j + 1] / sp) * hi;
        } else if (sp < lo && sp > 0) {
          vel[j] = (vel[j] / sp) * lo;
          vel[j + 1] = (vel[j + 1] / sp) * lo;
        }
        // keep it in the swarm rather than snapping back to a random heading
        if (next[i] < now + 0.5) next[i] = now + 0.5;
      }
    }

    let x = pos[j] + vel[j] * dt;
    let y = pos[j + 1] + vel[j + 1] * dt;
    // bounce off the canvas edges, speed unchanged
    if (x < 0) {
      x = -x;
      vel[j] = Math.abs(vel[j]);
    } else if (x > w) {
      x = 2 * w - x;
      vel[j] = -Math.abs(vel[j]);
    }
    if (y < 0) {
      y = -y;
      vel[j + 1] = Math.abs(vel[j + 1]);
    } else if (y > h) {
      y = 2 * h - y;
      vel[j + 1] = -Math.abs(vel[j + 1]);
    }

    if (mw.hits(x, y)) {
      // sitting on a constellation point: slide off locally (away from the
      // occupied cell, with a little sideways wobble) at its own pace.
      // blocks mid-segment re-trigger next frame and keep sliding until clear.
      let dx = x - mw.hitCX;
      let dy = y - mw.hitCY;
      let len = Math.hypot(dx, dy);
      if (len < 0.3) {
        const ra = randF(rng, i) * TAU;
        dx = Math.cos(ra);
        dy = Math.sin(ra);
        len = 1;
      }
      const sp = a.baseSpeed[i] * scale * (1 - c.speedJitter + 2 * c.speedJitter * randF(rng, i));
      const ang = (randF(rng, i) - 0.5) * 0.8;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      vel[j] = ((dx * ca - dy * sa) / len) * sp;
      vel[j + 1] = ((dx * sa + dy * ca) / len) * sp;
      next[i] = now + 0.6;
    } else if (now >= next[i]) {
      const rester = a.seed[i] < c.restFraction;
      if (rester && randF(rng, i) < c.restChance) {
        vel[j] = 0;
        vel[j + 1] = 0;
        next[i] = now + c.restDurMin + randF(rng, i) * (c.restDurMax - c.restDurMin);
      } else {
        // new heading at the block's own speed, within its ±25% band
        const ang = randF(rng, i) * TAU;
        const speed =
          a.baseSpeed[i] * scale * (1 - c.speedJitter + 2 * c.speedJitter * randF(rng, i));
        vel[j] = Math.cos(ang) * speed;
        vel[j + 1] = Math.sin(ang) * speed;
        next[i] = now + c.moveDurMin + randF(rng, i) * (c.moveDurMax - c.moveDurMin);
      }
    }
    pos[j] = x;
    pos[j + 1] = y;
  }
}
