// Seven-segment glyphs: every digit is a subset of the blocked figure-8.
// Segments are continuous rectangular bars (verticals run through the
// horizontals, so lit paths connect) in a 1.0 x 1.6 box, y down.
export interface Glyph {
  rects: [number, number, number, number][]; // x, y, w, h in glyph units
  advance: number;
}

const T = 0.2; // segment thickness
const L = 0.05; // left inset
const R = 0.95; // right edge
const W = R - L;

// the seven segments of the "8"
const SEG: Record<string, [number, number, number, number]> = {
  A: [L, 0.05, W, T], // top bar
  G: [L, 0.7, W, T], // middle bar
  D: [L, 1.35, W, T], // bottom bar
  F: [L, 0.05, T, 0.85], // top-left
  B: [R - T, 0.05, T, 0.85], // top-right
  E: [L, 0.7, T, 0.85], // bottom-left
  C: [R - T, 0.7, T, 0.85], // bottom-right
};

const seg = (letters: string): Glyph => ({
  rects: [...letters].map((ch) => SEG[ch]),
  advance: 1,
});

export const GLYPHS: Record<string, Glyph> = {
  '0': seg('ABCDEF'),
  '1': seg('BC'),
  '2': seg('ABGED'),
  '3': seg('ABGCD'),
  '4': seg('FGBC'),
  '5': seg('AFGCD'),
  '6': seg('AFGECD'),
  '7': seg('ABC'),
  '8': seg('ABCDEFG'),
  '9': seg('ABCDFG'),
  ':': {
    rects: [
      [0.1, 0.48, T, T],
      [0.1, 0.96, T, T],
    ],
    advance: 0.4,
  },
};
