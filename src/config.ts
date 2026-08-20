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
    // a small canvas is crossed far too quickly at desktop speeds, so the
    // whole field scales with the viewport: half speed on a phone, full on
    // a desktop, smoothly in between
    scaleRefVmin: 900,
    scaleMin: 0.5,
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

  // the cursor gathers susceptible free blocks into a moving Saturn glyph:
  // a round planet outline crossed by a tilted, gently layered ring
  cursor: {
    susceptible: 0.16, // preserve block density on the doubled contours
    radiusVmin: 12, // invisible capture reach, as a percentage of vmin
    radiusMin: 90, // px; independent from the glyph's visual size
    radiusMax: 120,
    planetRadiusPx: 19,
    ringMajorPx: 42,
    ringMinorPx: 15,
    ringSpreadPx: 2, // half-width of the layered ring band
    ringTilt: -0.32, // radians in screen coordinates
    ringShare: 0.64, // remaining members trace the round planet
    approach: 3, // contour correction relative to orbital motion
    settlePx: 2, // keep the compact contours crisp
    steer: 9, // 1/s; quickly turns blocks onto the tight orbital paths
    orbitSpeedMin: 10, // px/s; doubled to preserve the orbital period
    orbitSpeedMax: 28,
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
