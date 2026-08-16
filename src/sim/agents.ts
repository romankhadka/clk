import { CONFIG } from '../config';
import { mulberry32 } from './rng';

export const enum AgentState {
  Free = 0,
  Summoned = 1,
  Locked = 2,
  Static = 3,
}

// Sentinel "never dies" timestamp for the death-fade channel.
export const DEATH_NEVER = 1e9;

const TAU = Math.PI * 2;

// Structure-of-Arrays agent pool, allocated once at full capacity.
// The sim loop and render uploads only touch [0, drawCount).
export class Agents {
  readonly capacity = CONFIG.capacity;

  // CPU simulation state
  readonly pos: Float32Array; // xy interleaved, CSS px
  readonly vel: Float32Array; // xy interleaved, px/s
  readonly baseSpeed: Float32Array; // px/s, the block's lifelong speed property
  readonly rng: Uint32Array; // per-agent xorshift32 state
  readonly nextEventAt: Float32Array; // sim time of the next wander decision
  readonly state: Uint8Array;

  // Travel plan — meaningful while Summoned
  readonly tgt: Float32Array; // xy interleaved, constellation point
  readonly cruise: Float32Array; // px/s chosen for this journey (±25% of base)
  readonly dist0: Float32Array; // journey length at summon time, for glow ramp
  readonly weight: Float32Array; // constellation brightness weight, 0..1
  readonly glowFrom: Float32Array; // glow at journey start (0 fresh, ~weight on re-glide)
  readonly noiseSeed: Float32Array;

  // GPU-visible per-agent data
  readonly props: Uint8Array; // 4/agent: baseBright, twinkleFreq, twinkleAmp, colorTemp
  readonly seed: Float32Array; // 1/agent, 0..1 phase seed
  readonly glow: Uint8Array; // 0 wanderer … 254 locked digit, 255 label
  readonly fade: Float32Array; // 2/agent: birthTime, deathTime (sim seconds)

  glowDirty = true;
  fadeDirty = true;

  drawCount: number = CONFIG.initialCount;

  constructor() {
    const n = this.capacity;
    this.pos = new Float32Array(n * 2);
    this.vel = new Float32Array(n * 2);
    this.baseSpeed = new Float32Array(n);
    this.rng = new Uint32Array(n);
    this.nextEventAt = new Float32Array(n);
    this.state = new Uint8Array(n);
    this.tgt = new Float32Array(n * 2);
    this.cruise = new Float32Array(n);
    this.dist0 = new Float32Array(n);
    this.weight = new Float32Array(n);
    this.glowFrom = new Float32Array(n);
    this.noiseSeed = new Float32Array(n);
    this.props = new Uint8Array(n * 4);
    this.seed = new Float32Array(n);
    this.glow = new Uint8Array(n);
    this.fade = new Float32Array(n * 2);
  }

  // Scatter the field and give every star its persistent personality.
  init(w: number, h: number, now: number): void {
    const rand = mulberry32(0x9e3779b9);
    const c = CONFIG.wander;
    const m = c.edgeMargin;
    for (let i = 0; i < this.capacity; i++) {
      this.rng[i] = (rand() * 4294967296) >>> 0 || 1;
      const j = i * 2;
      this.pos[j] = -m + rand() * (w + m * 2);
      this.pos[j + 1] = -m + rand() * (h + m * 2);
      // lifelong speed property, log-uniform
      this.baseSpeed[i] =
        c.baseSpeedMin * Math.exp(Math.log(c.baseSpeedMax / c.baseSpeedMin) * rand());
      if (rand() < c.stopChance) {
        this.vel[j] = 0;
        this.vel[j + 1] = 0;
      } else {
        const ang = rand() * TAU;
        const speed = this.baseSpeed[i] * (1 - c.speedJitter + 2 * c.speedJitter * rand());
        this.vel[j] = Math.cos(ang) * speed;
        this.vel[j + 1] = Math.sin(ang) * speed;
      }
      this.nextEventAt[i] = now + rand() * c.moveDurMax;
      this.state[i] = AgentState.Free;

      // personality: stellar-magnitude-ish brightness (a dim shimmering grain
      // floor, ~10% clearly visible, ~2% prominent), varied twinkle, color
      // temperature biased near white
      const b = rand();
      this.props[i * 4] = 14 + 241 * b * b * b * b * b;
      this.props[i * 4 + 1] = rand() * 255;
      const a = rand();
      this.props[i * 4 + 2] = a * a * 255;
      this.props[i * 4 + 3] = (0.5 + (rand() - 0.5) * 0.9) * 255;
      this.seed[i] = rand();
      this.glow[i] = 0;
      this.fade[i * 2] = -10;
      this.fade[i * 2 + 1] = DEATH_NEVER;
      this.noiseSeed[i] = rand() * 1000;
    }

    // reserve region: the timezone label's static squares, parked offscreen
    // until the label layout claims them
    for (let i = 0; i < CONFIG.staticReserve; i++) {
      this.state[i] = AgentState.Static;
      this.pos[i * 2] = -100;
      this.pos[i * 2 + 1] = -100;
      this.vel[i * 2] = 0;
      this.vel[i * 2 + 1] = 0;
      this.glow[i] = 255;
    }
    this.glowDirty = true;
    this.fadeDirty = true;
  }
}
