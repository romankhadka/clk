// Single-stroke centerline skeletons, hand-drawn in a 1.0 x 1.6 box (y down),
// rasterized with round caps/joins and sampled into constellation points.
// Thin geometric forms, not an LED matrix.
export interface Glyph {
  d: string;
  advance: number; // width in glyph units
}

export const GLYPHS: Record<string, Glyph> = {
  '0': { d: 'M 0.9 0.8 A 0.4 0.7 0 1 1 0.1 0.8 A 0.4 0.7 0 1 1 0.9 0.8', advance: 1 },
  '1': { d: 'M 0.3 0.36 L 0.58 0.1 L 0.58 1.5', advance: 1 },
  '2': {
    d: 'M 0.13 0.4 C 0.13 0.03 0.87 0.03 0.87 0.42 C 0.87 0.7 0.62 0.94 0.13 1.5 L 0.9 1.5',
    advance: 1,
  },
  '3': {
    d: 'M 0.14 0.32 C 0.22 0.04 0.86 0.05 0.86 0.4 C 0.86 0.68 0.6 0.78 0.47 0.78 C 0.62 0.78 0.9 0.9 0.9 1.16 C 0.9 1.56 0.18 1.58 0.1 1.26',
    advance: 1,
  },
  '4': { d: 'M 0.68 1.5 L 0.68 0.1 L 0.1 1.06 L 0.92 1.06', advance: 1 },
  '5': {
    d: 'M 0.82 0.1 L 0.24 0.1 L 0.17 0.72 C 0.4 0.6 0.88 0.66 0.88 1.06 C 0.88 1.5 0.22 1.58 0.12 1.24',
    advance: 1,
  },
  '6': {
    d: 'M 0.78 0.14 C 0.4 0.04 0.13 0.5 0.13 1.0 C 0.13 1.66 0.89 1.66 0.89 1.08 C 0.89 0.62 0.26 0.6 0.14 0.94',
    advance: 1,
  },
  '7': { d: 'M 0.1 0.1 L 0.9 0.1 L 0.4 1.5', advance: 1 },
  '8': {
    d: 'M 0.79 0.43 A 0.29 0.33 0 1 1 0.21 0.43 A 0.29 0.33 0 1 1 0.79 0.43 M 0.86 1.14 A 0.36 0.36 0 1 1 0.14 1.14 A 0.36 0.36 0 1 1 0.86 1.14',
    advance: 1,
  },
  '9': {
    d: 'M 0.22 1.46 C 0.6 1.56 0.87 1.1 0.87 0.6 C 0.87 -0.06 0.11 -0.06 0.11 0.52 C 0.11 0.98 0.74 1.0 0.86 0.66',
    advance: 1,
  },
  ':': { d: 'M 0.225 0.51 L 0.225 0.59 M 0.225 1.01 L 0.225 1.09', advance: 0.45 },
};
