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

  // Cursor Saturn field, precomputed per frame. Susceptible blocks split by
  // stable seed between a circular planet outline and a tilted ring band.
  const gOn = grav !== null && grav.strength > 0.001;
  const gR = gOn
    ? Math.min(g.radiusMax, Math.max(g.radiusMin, (g.radiusVmin / 100) * Math.min(w, h)))
    : 0;
  const gR2 = gR * gR;
  const gThresh = 1 - g.susceptible; // blocks above this seed feel the pull
  const gX = grav?.x ?? 0;
  const gY = grav?.y ?? 0;
  const gStrength = grav?.strength ?? 0;
  const ringCos = Math.cos(g.ringTilt);
  const ringSin = Math.sin(g.ringTilt);
  const planetR = g.planetRadiusPx;
  const ringMajor = g.ringMajorPx;
  const ringMinor = g.ringMinorPx;
  const ringSpread = g.ringSpreadPx;
  for (let i = CONFIG.staticReserve; i < a.drawCount; i++) {
    if (state[i] !== AgentState.Free) continue;
    const j = i * 2;

    // Follow the nearest point on the assigned contour. A tangential component
    // keeps every block orbiting while the normal component gradually draws
    // the swarm into a recognizable Saturn silhouette.
    if (gOn && a.seed[i] > gThresh) {
      const dx = pos[j] - gX;
      const dy = pos[j + 1] - gY;
      const d2 = dx * dx + dy * dy;
      if (d2 < gR2) {
        const member = (a.seed[i] - gThresh) / g.susceptible;
        let correctionX: number;
        let correctionY: number;
        let tangentX: number;
        let tangentY: number;
        const contourSpeedScale = member < g.ringShare ? 1 : 0.8;

        if (member < g.ringShare) {
          // Rotate into the ring's local axes, then project radially onto one
          // of many nearby ellipses so the ring reads as a fine layered band.
          const lane = member / g.ringShare;
          const major = ringMajor + (lane * 2 - 1) * ringSpread;
          const minor = ringMinor + (lane * 2 - 1) * ringSpread;
          const localX = dx * ringCos + dy * ringSin;
          const localY = -dx * ringSin + dy * ringCos;
          const q = Math.hypot(localX / major, localY / minor);
          let targetX: number;
          let targetY: number;
          if (q < 0.001) {
            const angle = lane * TAU * 13.0;
            targetX = Math.cos(angle) * major;
            targetY = Math.sin(angle) * minor;
          } else {
            targetX = localX / q;
            targetY = localY / q;
          }

          const localCorrectionX = targetX - localX;
          const localCorrectionY = targetY - localY;
          correctionX = localCorrectionX * ringCos - localCorrectionY * ringSin;
          correctionY = localCorrectionX * ringSin + localCorrectionY * ringCos;

          // The ellipse gradient is normal to the contour; rotate it by 90°
          // for a constant-direction orbital tangent.
          let localTangentX = -targetY / (minor * minor);
          let localTangentY = targetX / (major * major);
          const tangentLength = Math.hypot(localTangentX, localTangentY) || 1;
          localTangentX /= tangentLength;
          localTangentY /= tangentLength;
          tangentX = localTangentX * ringCos - localTangentY * ringSin;
          tangentY = localTangentX * ringSin + localTangentY * ringCos;
        } else {
          const d = Math.sqrt(d2);
          let radialX: number;
          let radialY: number;
          if (d < 0.001) {
            const angle = member * TAU * 13.0;
            radialX = Math.cos(angle);
            radialY = Math.sin(angle);
          } else {
            radialX = dx / d;
            radialY = dy / d;
          }
          correctionX = radialX * planetR - dx;
          correctionY = radialY * planetR - dy;
          tangentX = -radialY;
          tangentY = radialX;
        }

        const correctionLength = Math.hypot(correctionX, correctionY);
        const correctionWeight = Math.min(g.approach, correctionLength / g.settlePx);
        let desiredX = tangentX;
        let desiredY = tangentY;
        if (correctionLength > 0.001) {
          desiredX += (correctionX / correctionLength) * correctionWeight;
          desiredY += (correctionY / correctionLength) * correctionWeight;
        }
        const desiredLength = Math.hypot(desiredX, desiredY) || 1;
        const naturalSpeed =
          a.baseSpeed[i] * scale * (1 - c.speedJitter + 2 * c.speedJitter * a.seed[i]);
        const lo = g.orbitSpeedMin * contourSpeedScale;
        const hi = g.orbitSpeedMax * contourSpeedScale;
        const desiredSpeed = Math.min(hi, Math.max(lo, naturalSpeed));
        desiredX = (desiredX / desiredLength) * desiredSpeed;
        desiredY = (desiredY / desiredLength) * desiredSpeed;

        const rim = 1 - Math.sqrt(d2) / gR;
        const steer = Math.min(1, g.steer * gStrength * (0.7 + 0.3 * rim) * dt);
        vel[j] += (desiredX - vel[j]) * steer;
        vel[j + 1] += (desiredY - vel[j + 1]) * steer;
        const sp = Math.hypot(vel[j], vel[j + 1]);
        if (sp > hi) {
          vel[j] = (vel[j] / sp) * hi;
          vel[j + 1] = (vel[j + 1] / sp) * hi;
        } else if (sp < lo && sp > 0) {
          vel[j] = (vel[j] / sp) * lo;
          vel[j + 1] = (vel[j + 1] / sp) * lo;
        }
        // Keep it on the Saturn flow instead of accepting a wander decision.
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
