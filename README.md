# clockwork

A clock made of a few hundred thousand wandering stars.

Every square is a 1px autonomous agent with its own speed, direction, pauses,
brightness, and twinkle. When the minute changes, a handful of free stars are
summoned — each plots its own course to arrive at its constellation point
within 10–15 seconds. Stars already sitting on a summoned position politely
move out of the way. The timezone at the bottom never moves.

Vanilla TypeScript + WebGL2, zero runtime dependencies. All squares render in
a single `gl.POINTS` draw call; an adaptive governor scales the field between
100k and 400k stars to hold 60fps on whatever hardware it lands on.

## Run

```
npm install
npm run dev
```

## How it works

- `src/sim/` — structure-of-arrays agent pool (400k capacity), per-agent
  xorshift32 streams, wander decision events, summoning with time-parameterized
  easing and decaying meander noise, an occupancy grid for the make-way rule.
- `src/layout/` — hand-drawn single-stroke glyph skeletons, rasterized once and
  stratified-sampled into deterministic constellations; timezone text sampled
  into static squares.
- `src/render/` — one instanceless point pass into an offscreen target, GPU-side
  twinkle, dual-Kawase bloom, gradient/vignette/nebula composite with dither.
- `src/quality.ts` — p75 frame-time governor with hysteresis; degrades bloom
  first, then star count, and recovers the same way.
