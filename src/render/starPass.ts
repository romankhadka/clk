import type { Agents } from '../sim/agents';
import { makeProgram } from './gl';
import { STAR_VS, STAR_FS } from './shaders';

// One instanceless gl.POINTS draw for every square. Positions upload each
// frame (orphaned); glow and fade upload only when the sim marks them dirty.
export class StarPass {
  private prog: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private posBuf: WebGLBuffer;
  private glowBuf: WebGLBuffer;
  private fadeBuf: WebGLBuffer;
  private uRes: WebGLUniformLocation;
  private uTime: WebGLUniformLocation;
  private uPointSize: WebGLUniformLocation;
  private uEncode: WebGLUniformLocation;
  private uFieldDim: WebGLUniformLocation;

  constructor(
    private gl: WebGL2RenderingContext,
    agents: Agents,
  ) {
    this.prog = makeProgram(gl, STAR_VS, STAR_FS);
    this.uRes = gl.getUniformLocation(this.prog, 'uRes')!;
    this.uTime = gl.getUniformLocation(this.prog, 'uTime')!;
    this.uPointSize = gl.getUniformLocation(this.prog, 'uPointSize')!;
    this.uEncode = gl.getUniformLocation(this.prog, 'uEncode')!;
    this.uFieldDim = gl.getUniformLocation(this.prog, 'uFieldDim')!;

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    const loc = (name: string): number => gl.getAttribLocation(this.prog, name);

    this.posBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, agents.capacity * 8, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc('aPos'));
    gl.vertexAttribPointer(loc('aPos'), 2, gl.FLOAT, false, 0, 0);

    const propsBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, propsBuf);
    gl.bufferData(gl.ARRAY_BUFFER, agents.props, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc('aProps'));
    gl.vertexAttribPointer(loc('aProps'), 4, gl.UNSIGNED_BYTE, true, 0, 0);

    const seedBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
    gl.bufferData(gl.ARRAY_BUFFER, agents.seed, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc('aSeed'));
    gl.vertexAttribPointer(loc('aSeed'), 1, gl.FLOAT, false, 0, 0);

    this.glowBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glowBuf);
    gl.bufferData(gl.ARRAY_BUFFER, agents.glow, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc('aGlow'));
    gl.vertexAttribPointer(loc('aGlow'), 1, gl.UNSIGNED_BYTE, true, 0, 0);

    this.fadeBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fadeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, agents.fade, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc('aFade'));
    gl.vertexAttribPointer(loc('aFade'), 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  draw(
    agents: Agents,
    cssW: number,
    cssH: number,
    pointSize: number,
    time: number,
    encode: number,
    fieldDim: number,
  ): void {
    const gl = this.gl;
    const n = agents.drawCount;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, agents.capacity * 8, gl.DYNAMIC_DRAW); // orphan
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, agents.pos.subarray(0, n * 2));
    if (agents.glowDirty) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glowBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, agents.glow.subarray(0, n));
      agents.glowDirty = false;
    }
    if (agents.fadeDirty) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.fadeBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, agents.fade.subarray(0, n * 2));
      agents.fadeDirty = false;
    }

    gl.useProgram(this.prog);
    gl.uniform2f(this.uRes, cssW, cssH);
    gl.uniform1f(this.uTime, time);
    gl.uniform1f(this.uPointSize, pointSize);
    gl.uniform1f(this.uEncode, encode);
    gl.uniform1f(this.uFieldDim, fieldDim);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }
}
