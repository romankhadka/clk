// Classic 5x7 dot-matrix glyphs (HD44780-style). Each lit cell rasterizes as
// a square dot and is filled with a cluster of blocks — a matrix clock made
// of wandering squares. Row pitch is 1.6/7 glyph units; advance is measured
// in the same units so digits are 5 columns wide, the colon 2.
export interface Glyph {
  rows: string[]; // 7 rows of '0'/'1', all the same width
  advance: number;
}

export const PITCH = 1.6 / 7;

const d = (rows: string[]): Glyph => ({ rows, advance: rows[0].length * PITCH });

export const GLYPHS: Record<string, Glyph> = {
  '0': d(['01110', '10001', '10011', '10101', '11001', '10001', '01110']),
  '1': d(['00100', '01100', '00100', '00100', '00100', '00100', '01110']),
  '2': d(['01110', '10001', '00001', '00010', '00100', '01000', '11111']),
  '3': d(['11111', '00010', '00100', '00010', '00001', '10001', '01110']),
  '4': d(['00010', '00110', '01010', '10010', '11111', '00010', '00010']),
  '5': d(['11111', '10000', '11110', '00001', '00001', '10001', '01110']),
  '6': d(['00110', '01000', '10000', '11110', '10001', '10001', '01110']),
  '7': d(['11111', '00001', '00010', '00100', '01000', '01000', '01000']),
  '8': d(['01110', '10001', '10001', '01110', '10001', '10001', '01110']),
  '9': d(['01110', '10001', '10001', '01111', '00001', '00010', '01100']),
  ':': d(['0', '0', '1', '0', '1', '0', '0']),
};
