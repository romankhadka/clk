import { CONFIG } from '../config';

export interface GlCtx {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  dpr: number;
  cssW: number;
  cssH: number;
  pxW: number;
  pxH: number;
  halfFloat: boolean; // can we render to RGBA16F?
}

export function initGL(canvas: HTMLCanvasElement): GlCtx | null {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
  if (!gl) return null;
  const halfFloat =
    gl.getExtension('EXT_color_buffer_float') !== null ||
    gl.getExtension('EXT_color_buffer_half_float') !== null;
  return { gl, canvas, dpr: 1, cssW: 0, cssH: 0, pxW: 0, pxH: 0, halfFloat };
}

// Returns true when the backing store actually changed.
export function resizeGL(ctx: GlCtx): boolean {
  const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.dprMax);
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  const pxW = Math.round(cssW * dpr);
  const pxH = Math.round(cssH * dpr);
  if (pxW === ctx.pxW && pxH === ctx.pxH && dpr === ctx.dpr) return false;
  ctx.dpr = dpr;
  ctx.cssW = cssW;
  ctx.cssH = cssH;
  ctx.pxW = pxW;
  ctx.pxH = pxH;
  ctx.canvas.width = pxW;
  ctx.canvas.height = pxH;
  return true;
}

export function makeProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const compile = (type: number, src: string): WebGLShader => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(`shader compile: ${gl.getShaderInfoLog(sh)}\n${src}`);
    }
    return sh;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`program link: ${gl.getProgramInfoLog(prog)}`);
  }
  return prog;
}

export interface Target {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

export function makeTarget(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  halfFloat: boolean,
): Target {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, halfFloat ? gl.RGBA16F : gl.RGBA8, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex, w, h };
}

export function destroyTarget(gl: WebGL2RenderingContext, t: Target): void {
  gl.deleteFramebuffer(t.fbo);
  gl.deleteTexture(t.tex);
}
