// Every tunable in one place. Units are CSS px and seconds unless noted.
export const CONFIG = {
  capacity: 400_000, // allocation ceiling; buffers never resize
  initialCount: 200_000, // adaptive governor moves between min/max
  minCount: 100_000,
  maxCount: 400_000,
  staticReserve: 4096, // indices [0, staticReserve) belong to the timezone label
  summonPoolMax: 90_000, // summon candidates come from below this index, so
  // governor trims (floor 100k) can never cut a digit holder

  dprMax: 2,

  wander: {
    speedMin: 2, // px/s, log-uniform
    speedMax: 14,
    stopChance: 0.25,
    stopDurMin: 3,
    stopDurMax: 20,
    moveDurMin: 2,
    moveDurMax: 12,
    edgeMargin: 8, // toroidal wrap happens this far offscreen
  },

  summon: {
    deadlineMin: 10,
    deadlineMax: 15,
    firstLoadMin: 2.5, // the very first clock forms faster
    firstLoadMax: 6,
    candidateK: 8, // best-of-K nearest candidate picking
    noiseAmp: 12, // px of meander, decays as (1-u)^2 along the journey
    resizeGlide: 0.8, // s, locked holders glide to re-laid-out targets
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
    gap: 0.18, // between glyphs, fraction of digit width
    strokeFrac: 0.09, // stroke width as a fraction of glyph height
    cellUnits: 0.024, // sampling cell in glyph units (~950 points per digit)
  },

  label: {
    marginVmin: 4.5,
    fontPx: 12, // target text height in CSS px
    spacing: 1.2, // px between sampled label squares
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
