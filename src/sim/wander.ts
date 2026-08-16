import { CONFIG } from '../config';
import { Agents, AgentState } from './agents';
import { randF } from './rng';
import type { MakeWay } from './makeway';

const TAU = Math.PI * 2;

// One flat pass over the live pool: free-agent integration, decision events,
// and the make-way rule. Summoned agents are advanced in summon.ts; locked
// and static agents cost one byte-compare here.
export function stepWander(
  a: Agents,
  mw: MakeWay,
  now: number,
  dt: number,
  w: number,
  h: number,
  reduced: boolean,
): void {
  const c = CONFIG.wander;
  const mwc = CONFIG.makeWay;
  const m = c.edgeMargin;
  const wrapW = w + m * 2;
  const wrapH = h + m * 2;
  const pos = a.pos,
    vel = a.vel,
    state = a.state,
    next = a.nextEventAt,
    rng = a.rng;
  for (let i = CONFIG.staticReserve; i < a.drawCount; i++) {
    if (state[i] !== AgentState.Free) continue;
    const j = i * 2;
    let x = pos[j] + vel[j] * dt;
    let y = pos[j + 1] + vel[j + 1] * dt;
    if (x < -m) x += wrapW;
    else if (x > w + m) x -= wrapW;
    if (y < -m) y += wrapH;
    else if (y > h + m) y -= wrapH;

    if (mw.hits(x, y)) {
      // sitting on a constellation point: slide off locally (away from the
      // occupied cell, with a little sideways wobble), keep wandering nearby.
      // stars mid-stroke re-trigger next frame and keep sliding until clear.
      let dx = x - mw.hitCX;
      let dy = y - mw.hitCY;
      let len = Math.hypot(dx, dy);
      if (len < 0.3) {
        const a = randF(rng, i) * TAU;
        dx = Math.cos(a);
        dy = Math.sin(a);
        len = 1;
      }
      const sp = mwc.burstMin + randF(rng, i) * (mwc.burstMax - mwc.burstMin);
      const ang = (randF(rng, i) - 0.5) * 0.8;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      vel[j] = ((dx * ca - dy * sa) / len) * sp;
      vel[j + 1] = ((dx * sa + dy * ca) / len) * sp;
      next[i] = now + mwc.settleDelay;
    } else if (now >= next[i]) {
      if (reduced || randF(rng, i) < c.stopChance) {
        vel[j] = 0;
        vel[j + 1] = 0;
        next[i] = now + c.stopDurMin + randF(rng, i) * (c.stopDurMax - c.stopDurMin);
      } else {
        const ang = randF(rng, i) * TAU;
        const speed = c.speedMin * Math.exp(Math.log(c.speedMax / c.speedMin) * randF(rng, i));
        vel[j] = Math.cos(ang) * speed;
        vel[j + 1] = Math.sin(ang) * speed;
        next[i] = now + c.moveDurMin + randF(rng, i) * (c.moveDurMax - c.moveDurMin);
      }
    }
    pos[j] = x;
    pos[j + 1] = y;
  }
}
