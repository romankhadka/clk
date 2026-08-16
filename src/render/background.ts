import { mulberry32 } from '../sim/rng';

// 256x256 tiling value-noise texture for the ultra-faint nebula. Amplitude is
// applied in the composite shader; this just provides smooth structure.
export function makeNebulaTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const N = 256;
  const LAT = 32; // lattice cells; wraps for seamless tiling
  const rand = mulberry32(0x2b7e1516);
  const lattice = new Float32Array(LAT * LAT);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand();

  const sample = (x: number, y: number): number => {
    const gx = Math.floor(x);
    const gy = Math.floor(y);
    const fx = x - gx;
    const fy = y - gy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const v00 = lattice[(gy % LAT) * LAT + (gx % LAT)];
    const v10 = lattice[(gy % LAT) * LAT + ((gx + 1) % LAT)];
    const v01 = lattice[((gy + 1) % LAT) * LAT + (gx % LAT)];
    const v11 = lattice[((gy + 1) % LAT) * LAT + ((gx + 1) % LAT)];
    return v00 + (v10 - v00) * sx + (v01 - v00) * sy + (v00 - v10 - v01 + v11) * sx * sy;
  };

  const data = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x / N) * LAT;
      const v = (y / N) * LAT;
      const n = sample(u, v) * 0.65 + sample((u * 2) % LAT, (v * 2) % LAT) * 0.35;
      data[y * N + x] = n * 255;
    }
  }

  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, N, N, 0, gl.RED, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  return tex;
}
