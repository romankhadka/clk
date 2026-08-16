import { makeProgram, makeTarget, destroyTarget, type Target } from './gl';
import { QUAD_VS, DOWN_FS, UP_FS } from './shaders';

// Dual-filter Kawase bloom: bright-pass into 1/2 res, down to 1/8, additive
// upsample back to 1/2. `levels` trades quality for time (0 disables).
export class Bloom {
  levels = 3;
  private down: WebGLProgram;
  private up: WebGLProgram;
  private mips: Target[] = [];

  constructor(
    private gl: WebGL2RenderingContext,
    private halfFloat: boolean,
  ) {
    this.down = makeProgram(gl, QUAD_VS, DOWN_FS);
    this.up = makeProgram(gl, QUAD_VS, UP_FS);
  }

  resize(pxW: number, pxH: number): void {
    for (const m of this.mips) destroyTarget(this.gl, m);
    this.mips = [];
    for (let l = 0; l < 3; l++) {
      const s = 2 << l;
      this.mips.push(
        makeTarget(
          this.gl,
          Math.max(1, Math.round(pxW / s)),
          Math.max(1, Math.round(pxH / s)),
          this.halfFloat,
        ),
      );
    }
  }

  // Returns the bloom texture, or null when disabled.
  run(scene: Target, threshold: number, knee: number): WebGLTexture | null {
    const n = Math.min(this.levels, this.mips.length);
    if (n === 0) return null;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);

    gl.useProgram(this.down);
    gl.uniform1i(gl.getUniformLocation(this.down, 'uTex'), 0);
    const uTexelD = gl.getUniformLocation(this.down, 'uTexel');
    const uBright = gl.getUniformLocation(this.down, 'uBright');
    gl.uniform1f(gl.getUniformLocation(this.down, 'uThreshold'), threshold);
    gl.uniform1f(gl.getUniformLocation(this.down, 'uKnee'), knee);
    let src: Target = scene;
    for (let l = 0; l < n; l++) {
      const dst = this.mips[l];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform2f(uTexelD, 1 / src.w, 1 / src.h);
      gl.uniform1f(uBright, l === 0 ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = dst;
    }

    gl.useProgram(this.up);
    gl.uniform1i(gl.getUniformLocation(this.up, 'uTex'), 0);
    const uTexelU = gl.getUniformLocation(this.up, 'uTexel');
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let l = n - 1; l > 0; l--) {
      const from = this.mips[l];
      const to = this.mips[l - 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, to.fbo);
      gl.viewport(0, 0, to.w, to.h);
      gl.bindTexture(gl.TEXTURE_2D, from.tex);
      gl.uniform2f(uTexelU, 1 / from.w, 1 / from.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return this.mips[0].tex;
  }
}
