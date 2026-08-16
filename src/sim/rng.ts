// Per-agent xorshift32; state lives in a Uint32Array so the sim loop stays
// allocation-free and each square owns an independent random stream.
export function xorshift32(state: Uint32Array, i: number): number {
  let x = state[i];
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  state[i] = x;
  return x;
}

// Uniform float in [0, 1) drawn from agent i's stream.
export function randF(state: Uint32Array, i: number): number {
  return xorshift32(state, i) / 4294967296;
}

// Standalone deterministic stream (glyph sampling, field init).
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
