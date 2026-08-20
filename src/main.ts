import { CONFIG } from './config';
import { Agents, AgentState, DEATH_NEVER, speedScaleFor } from './sim/agents';
import { stepWander, type Gravity } from './sim/wander';
import { Summoner } from './sim/summon';
import { MakeWay } from './sim/makeway';
import { mulberry32 } from './sim/rng';
import { timeSlots, timeZoneName } from './time';
import { layoutClock } from './layout/clockLayout';
import { labelPoints } from './layout/tzLabel';
import { Renderer } from './render/renderer';
import { Quality } from './quality';

const canvas = document.getElementById('sky') as HTMLCanvasElement;

function textFallback(): void {
  const el = document.getElementById('fallback')!;
  el.style.display = 'flex';
  canvas.style.display = 'none';
  const tick = (): void => {
    el.querySelector('time')!.textContent = timeSlots(new Date());
    el.querySelector('small')!.textContent = timeZoneName().toUpperCase();
  };
  tick();
  setInterval(tick, 1000);
}

function boot(): void {
  // init before the renderer exists: StarPass uploads the static personality
  // buffers (props/seed) once, in its constructor
  const agents = new Agents();
  agents.init(window.innerWidth, window.innerHeight, performance.now() / 1000);

  let renderer: Renderer;
  try {
    renderer = new Renderer(canvas, agents);
  } catch {
    textFallback();
    return;
  }

  const summoner = new Summoner();
  const makeWay = new MakeWay();
  const quality = new Quality();
  const rand = mulberry32(0xc10cf0e1);
  const tNow = (): number => performance.now() / 1000;

  let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let curStr = '';
  let lastMs = performance.now();
  let pendingCut: { at: number; to: number } | null = null;
  let running = true;

  const now0 = tNow();
  // the field breathes in over the first moments
  for (let i = CONFIG.staticReserve; i < agents.capacity; i++) {
    agents.fade[i * 2] = now0 + rand() * 2.5;
  }
  for (let i = 0; i < CONFIG.staticReserve; i++) agents.fade[i * 2] = now0 + 0.5;
  agents.fadeDirty = true;

  const assignLabel = (): void => {
    const pts = labelPoints(timeZoneName().toUpperCase(), renderer.ctx.cssW, renderer.ctx.cssH);
    const n = pts.length / 2;
    for (let i = 0; i < CONFIG.staticReserve; i++) {
      if (i < n) {
        agents.pos[i * 2] = pts[i * 2];
        agents.pos[i * 2 + 1] = pts[i * 2 + 1];
      } else {
        agents.pos[i * 2] = -100;
        agents.pos[i * 2 + 1] = -100;
      }
    }
  };

  const buildClock = (
    mode: 'first' | 'minute' | 'materialize' | 'remap',
    now: number,
  ): void => {
    const s = timeSlots(new Date());
    if (mode === 'remap' && !reduced) {
      // re-aim current holders at the new geometry first; the minute may also
      // have changed while the resize was debouncing, handled below
      summoner.remap(layoutClock(curStr, renderer.ctx.cssW, renderer.ctx.cssH), agents);
    }
    const slots = layoutClock(s, renderer.ctx.cssW, renderer.ctx.cssH);
    if (mode === 'materialize' || reduced) {
      summoner.materialize(slots, agents, now);
    } else if (mode === 'first') {
      summoner.rebuild(slots, agents, now, true);
    } else if (s !== curStr) {
      if (s.length === curStr.length) summoner.diff(slots, agents, now);
      else summoner.rebuild(slots, agents, now);
    }
    makeWay.rebuild(slots);
    curStr = s;
  };

  assignLabel();
  buildClock('first', now0);

  const applyCount = (now: number): void => {
    const target = quality.targetCount;
    if (pendingCut) {
      // a step arrived before the previous cut landed: resurrect and restart
      for (let i = pendingCut.to; i < agents.drawCount; i++) {
        agents.fade[i * 2 + 1] = DEATH_NEVER;
      }
      pendingCut = null;
    }
    if (target > agents.drawCount) {
      for (let i = agents.drawCount; i < target; i++) {
        agents.fade[i * 2] = now + rand() * 0.8;
        agents.fade[i * 2 + 1] = DEATH_NEVER;
        agents.state[i] = AgentState.Free;
      }
      agents.drawCount = target;
    } else if (target < agents.drawCount) {
      for (let i = target; i < agents.drawCount; i++) {
        agents.fade[i * 2 + 1] = now + rand() * 0.3;
      }
      pendingCut = { at: now + CONFIG.quality.cutDelayS, to: target };
    }
    agents.fadeDirty = true;
  };
  quality.onChange = () => {
    renderer.bloom.levels = quality.bloomLevels;
    applyCount(tNow());
  };

  const doResize = (): void => {
    const oldW = renderer.ctx.cssW;
    const oldH = renderer.ctx.cssH;
    if (!renderer.resize()) return;
    const now = tNow();
    const sx = renderer.ctx.cssW / oldW;
    const sy = renderer.ctx.cssH / oldH;
    // rotating a phone changes how fast the field should run; retune the
    // velocities in flight instead of waiting for each block's next decision
    const prevScale = agents.speedScale;
    agents.speedScale = speedScaleFor(renderer.ctx.cssW, renderer.ctx.cssH);
    const vs = agents.speedScale / prevScale;
    for (let i = CONFIG.staticReserve; i < agents.capacity; i++) {
      if (agents.state[i] === AgentState.Free) {
        agents.pos[i * 2] *= sx;
        agents.pos[i * 2 + 1] *= sy;
        if (vs !== 1) {
          agents.vel[i * 2] *= vs;
          agents.vel[i * 2 + 1] *= vs;
        }
      } else if (vs !== 1 && agents.state[i] === AgentState.Summoned) {
        agents.cruise[i] *= vs; // blocks already in flight, too
      }
    }
    assignLabel();
    buildClock('remap', now);
    quality.disturb(now);
  };
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(doResize, 150);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const now = tNow();
    lastMs = performance.now();
    quality.disturb(now);
    // the clock must be correct the instant the user returns
    if (timeSlots(new Date()) !== curStr) buildClock('materialize', now);
  });

  // reduced motion calms digit transitions (instant materialize) but never
  // stops the field — the roaming blocks are the piece
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    reduced = e.matches;
  });

  // the cursor's gravity well: present while the pointer is over the canvas,
  // easing in and out so it never snaps on
  const gravity: Gravity = { x: 0, y: 0, strength: 0 };
  let gravityWanted = 0;
  const fadeGravity = (): void => {
    gravityWanted = 0;
  };
  const releaseGravity = (): void => {
    fadeGravity();
    gravity.strength = 0;
  };
  const track = (e: PointerEvent): void => {
    gravity.x = e.clientX;
    gravity.y = e.clientY;
    // Pointer moves can still be delivered to an unfocused window. Only a
    // direct press may activate the well while focus is changing hands.
    gravityWanted = e.type === 'pointerdown' || document.hasFocus() ? 1 : 0;
  };
  window.addEventListener('pointermove', track, { passive: true });
  window.addEventListener('pointerdown', track, { passive: true });
  window.addEventListener('blur', releaseGravity);
  window.addEventListener('pointerleave', fadeGravity);
  window.addEventListener('pointercancel', fadeGravity);
  // a lifted finger takes its gravity with it; a mouse keeps hovering
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'mouse') gravityWanted = 0;
  });

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    running = false;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    renderer = new Renderer(canvas, agents);
    renderer.bloom.levels = quality.bloomLevels;
    agents.glowDirty = true;
    agents.fadeDirty = true;
    lastMs = performance.now();
    running = true;
    requestAnimationFrame(frame);
  });

  // dev/debug pulse
  (window as unknown as Record<string, unknown>).__clk = {
    get count() {
      return agents.drawCount;
    },
    get p75() {
      return quality.p75();
    },
    get bloom() {
      return quality.bloomLevels;
    },
    get time() {
      return curStr;
    },
    get speedScale() {
      return agents.speedScale;
    },
    // mean speed of the roaming field, px/s as rendered
    get meanSpeed() {
      let sum = 0;
      let n = 0;
      for (let i = CONFIG.staticReserve; i < agents.drawCount; i++) {
        if (agents.state[i] !== AgentState.Free) continue;
        sum += Math.hypot(agents.vel[i * 2], agents.vel[i * 2 + 1]);
        n++;
      }
      return n ? sum / n : 0;
    },
  };

  const frame = (ms: number): void => {
    if (!running) return;
    const rawMs = Math.max(0, ms - lastMs);
    lastMs = ms;
    const now = tNow();
    const dt = Math.min(0.033, rawMs / 1000); // clamp for sim; throttled tabs stay harmless

    if (timeSlots(new Date()) !== curStr) buildClock('minute', now);

    if (pendingCut && now >= pendingCut.at) {
      agents.drawCount = pendingCut.to;
      pendingCut = null;
    }

    const rate = gravityWanted > gravity.strength ? CONFIG.cursor.fadeIn : CONFIG.cursor.fadeOut;
    gravity.strength += (gravityWanted - gravity.strength) * Math.min(1, rate * dt);
    stepWander(
      agents,
      makeWay,
      now,
      dt,
      renderer.ctx.cssW,
      renderer.ctx.cssH,
      gravity.strength > 0.001 ? gravity : null,
    );
    summoner.step(agents, now, dt);
    renderer.render(agents, now);

    quality.frame(rawMs, now); // the governor sees real frame cost, unclamped
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot();
