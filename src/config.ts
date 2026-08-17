// Every tunable in one place. Units are CSS px and seconds unless noted.
export const CONFIG = {
  capacity: 120_000, // allocation ceiling; buffers never resize
  initialCount: 30_000, // adaptive governor moves between min/max
  minCount: 12_000,
  maxCount: 60_000,
  staticReserve: 4096, // indices [0, staticReserve) belong to the timezone label
  summonPoolMax: 11_000, // summon candidates come from below this index, so
  // governor trims (floor 12k) can never cut a digit holder

  dprMax: 2,

  block: {
    minPx: 2, // CSS px, square edge on small screens
    maxPx: 4, // and on very large ones
    vminPer: 280, // edge = vmin / this, clamped
  },

  wander: {
    baseSpeedMin: 10, // px/s; every block draws its own speed at creation
    baseSpeedMax: 60, // (log-uniform) and keeps it for life
    speedJitter: 0.25, // a block may only run within ±25% of its own speed
    restFraction: 0.05, // only this share of blocks is even allowed to stop
    restChance: 0.4, // ...and they rest at this rate when deciding
    restDurMin: 2,
    restDurMax: 6,
    moveDurMin: 4,
    moveDurMax: 15,
  },

  summon: {
    candidateK: 8, // best-of-K by travel time (distance / block speed)
    firstLoadK: 16, // the very first clock picks from a wider pool
    meanderFrac: 0.35, // lateral drift as a fraction of cruise, fades on approach
  },

  // the cursor carries a light gravity: free blocks that happen to be
  // susceptible curve toward it and mill around in a loose swarm
  cursor: {
    susceptible: 0.34, // share of blocks that feel it (by stable seed)
    radiusVmin: 30, // reach, as a percentage of vmin
    radiusMin: 190, // px
    radiusMax: 420,
    pull: 120, // px/s^2 at the center of the well, easing to 0 at the rim
    swirl: 0.9, // tangential share, so they orbit instead of spearing through
    core: 62, // px; inside this the pull releases so they don't collapse
    fadeIn: 4, // 1/s
    fadeOut: 1.6,
  },

  makeWay: {
    cell: 3, // px, occupancy grid resolution
    burstMin: 10, // px/s local slide-off speed
    burstMax: 18,
    settleDelay: 0.6, // s until the evicted star resumes normal wandering
  },

  digits: {
    heightMinPx: 120,
    heightVmin: 26,
    heightMaxPx: 420,
    centerYFrac: 0.46,
    gap: 0.28, // between glyphs, glyph units
    maxWidthFrac: 0.94, // shrink digits rather than overflow narrow screens
    cellUnits: 0.036, // sampling cell in glyph units (~420 blocks per digit)
  },

  label: {
    marginVmin: 4.5,
    fontPx: 26, // target text height in CSS px
    weight: 700, // stroke must stay wider than the block spacing below
    spacing: 2.9, // px between sampled label squares (~ one block apart)
  },

  quality: {
    ring: 90, // frames of dt history
    p75Down: 17.5, // ms
    p75Up: 14,
    downHoldS: 3,
    upHoldS: 10,
    cooldownS: 5,
    settleS: 2, // ignore frames right after load/resize/visibility
    countStepDown: 0.85,
    countStepUp: 1.1,
    cutDelayS: 1.6, // draw-count reduction waits for the death fade
  },
} as const;
