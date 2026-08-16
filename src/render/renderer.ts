import type { Agents } from '../sim/agents';
import { initGL, resizeGL, makeProgram, makeTarget, destroyTarget, type GlCtx, type Target } from './gl';
import { StarPass } from './starPass';
import { Bloom } from './bloom';
import { makeNebulaTexture } from './background';
import { QUAD_VS, COMPOSITE_FS } from './shaders';

// Facade over the whole pipeline: stars into an offscreen scene target,
// bloom chain, then one composite pass that also paints the night sky.
export class Renderer {
  readonly ctx: GlCtx;
  bloom: Bloom;
  private stars: StarPass;
  private composite: WebGLProgram;
  private nebula: WebGLTexture;
  private scene: Target | null = null;
  private encode: number;

  constructor(canvas: HTMLCanvasElement, agents: Agents) {
    const ctx = initGL(canvas);
    if (!ctx) throw new Error('webgl2 unavailable');
    this.ctx = ctx;
    this.encode = ctx.halfFloat ? 1.0 : 0.5;
    this.stars = new StarPass(ctx.gl, agents);
    this.bloom = new Bloom(ctx.gl, ctx.halfFloat);
    this.composite = makeProgram(ctx.gl, QUAD_VS, COMPOSITE_FS);
    this.nebula = makeNebulaTexture(ctx.gl);
    this.resize();
  }

  resize(): boolean {
    const changed = resizeGL(this.ctx);
    if (changed || !this.scene) {
      const { gl, pxW, pxH, halfFloat } = this.ctx;
      if (this.scene) destroyTarget(gl, this.scene);
      this.scene = makeTarget(gl, pxW, pxH, halfFloat);
      this.bloom.resize(pxW, pxH);
    }
    return changed;
  }

  render(agents: Agents, time: number): void {
    const { gl, cssW, cssH, pxW, pxH, dpr } = this.ctx;
    const scene = this.scene!;

    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
    gl.viewport(0, 0, pxW, pxH);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // hold perceived field brightness steady across governor steps and
    // viewport sizes: reference density is 200k stars on a 1440x900 window
    const density = agents.drawCount / Math.max(1, cssW * cssH);
    const fieldDim = Math.min(1.25, Math.max(0.6, Math.sqrt(0.154 / density)));
    this.stars.draw(
      agents,
      cssW,
      cssH,
      Math.max(1, Math.round(dpr)),
      time,
      this.encode,
      fieldDim,
    );

    const bloomTex = this.bloom.run(scene, 0.06 * this.encode, 0.2 * this.encode);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, pxW, pxH);
    gl.useProgram(this.composite);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bloomTex ?? scene.tex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.nebula);
    gl.uniform1i(gl.getUniformLocation(this.composite, 'uScene'), 0);
    gl.uniform1i(gl.getUniformLocation(this.composite, 'uBloom'), 1);
    gl.uniform1i(gl.getUniformLocation(this.composite, 'uNebula'), 2);
    gl.uniform2f(gl.getUniformLocation(this.composite, 'uRes'), pxW, pxH);
    gl.uniform1f(gl.getUniformLocation(this.composite, 'uTime'), time);
    gl.uniform1f(gl.getUniformLocation(this.composite, 'uDecode'), 1 / this.encode);
    gl.uniform1f(
      gl.getUniformLocation(this.composite, 'uBloomStrength'),
      bloomTex ? 1.15 : 0.0,
    );
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
