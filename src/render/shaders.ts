// All GLSL lives here as template strings — no loader plumbing.

export const STAR_VS = `#version 300 es
precision highp float;
uniform vec2 uRes;        // CSS px
uniform float uTime;      // s
uniform float uPointSize; // physical px
uniform float uEncode;    // 0.5 when the scene target is RGBA8, else 1.0
uniform float uFieldDim;  // keeps field/digit contrast constant as the
                          // governor changes the star count
in vec2 aPos;
in vec4 aProps;  // baseBright, twinkleFreq, twinkleAmp, colorTemp
in float aSeed;  // 0..1 phase seed
in float aGlow;  // 0..1; 1.0 exactly = timezone label
in vec2 aFade;   // birthTime, deathTime
out vec3 vColor;

const float TAU = 6.2831853;
const vec3 WARM = vec3(1.0, 0.913, 0.816);
const vec3 COOL = vec3(0.804, 0.847, 1.0);

void main() {
  float phase = aSeed * TAU * 8.0;
  float freq = mix(0.12, 2.4, aProps.y * aProps.y);
  float amp  = aProps.z * 0.85;

  float gN = aGlow * 255.0;
  float isLabel = step(254.5, gN);
  float lock = min(gN, 254.0) / 254.0;

  // the star's own personality: a twinkle around its base brightness.
  // wanderers cap well below the constellation hold so digits always read
  float tw = 0.5 + 0.5 * sin(uTime * freq * TAU + phase);
  float bright = aProps.x * mix(1.0 - amp, 1.0, tw) * 0.55 * uFieldDim;

  // constellation hold: steady and luminous (above 1.0 so bloom catches it),
  // gradually outshining the natural twinkle as the star locks in
  float hold = lock * (1.35 + 0.12 * sin(uTime * 0.8 + phase * 1.7));
  bright = max(bright, hold);

  // timezone label: quiet, dim, nearly still
  bright = mix(bright, 0.62 + 0.04 * sin(uTime * 0.5 + phase), isLabel);

  // birth / death fades (death sentinel is far in the future)
  float fade = smoothstep(0.0, 0.6, uTime - aFade.x) * (1.0 - smoothstep(0.0, 1.0, uTime - aFade.y));
  bright *= fade;

  // locked squares hold position with a sub-pixel lissajous drift
  vec2 shimmer = lock * (1.0 - isLabel) * 0.4 *
    vec2(sin(uTime * 0.9 + phase * 3.0), cos(uTime * 1.13 + phase * 5.0));
  vec2 p = aPos + shimmer;

  vColor = mix(WARM, COOL, aProps.w) * bright * uEncode;

  vec2 clip = (p / uRes) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = uPointSize;
}`;

export const STAR_FS = `#version 300 es
precision mediump float;
in vec3 vColor;
out vec4 o;
void main() { o = vec4(vColor, 1.0); }`;

// Fullscreen triangle; uv covers [0,1] over the viewport.
export const QUAD_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Dual-Kawase downsample; uBright enables the soft-knee bright pass on the
// first hop from the scene into the bloom chain.
export const DOWN_FS = `#version 300 es
precision mediump float;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uBright;    // 1.0 on the first downsample, else 0.0
uniform float uThreshold;
uniform float uKnee;
in vec2 vUv;
out vec4 o;
void main() {
  vec3 c = texture(uTex, vUv).rgb * 4.0;
  c += texture(uTex, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture(uTex, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  c += texture(uTex, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  c += texture(uTex, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  c /= 8.0;
  if (uBright > 0.5) {
    float l = max(c.r, max(c.g, c.b));
    float t = max(l - uThreshold, 0.0);
    c *= t / (t + uKnee + 1e-5);
  }
  o = vec4(c, 1.0);
}`;

export const UP_FS = `#version 300 es
precision mediump float;
uniform sampler2D uTex;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 o;
void main() {
  vec2 t = uTexel;
  vec3 c = texture(uTex, vUv + vec2(-t.x * 2.0, 0.0)).rgb;
  c += texture(uTex, vUv + vec2(-t.x,  t.y)).rgb * 2.0;
  c += texture(uTex, vUv + vec2(0.0,  t.y * 2.0)).rgb;
  c += texture(uTex, vUv + vec2( t.x,  t.y)).rgb * 2.0;
  c += texture(uTex, vUv + vec2( t.x * 2.0, 0.0)).rgb;
  c += texture(uTex, vUv + vec2( t.x, -t.y)).rgb * 2.0;
  c += texture(uTex, vUv + vec2(0.0, -t.y * 2.0)).rgb;
  c += texture(uTex, vUv + vec2(-t.x, -t.y)).rgb * 2.0;
  o = vec4(c / 12.0, 1.0);
}`;

// Final pass: night-sky ground (gradient + vignette + drifting nebula whisper),
// stars, bloom, a gentle highlight shoulder, and gradient-noise dither.
export const COMPOSITE_FS = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform sampler2D uNebula;
uniform vec2 uRes;        // physical px
uniform float uTime;
uniform float uDecode;    // 2.0 for the RGBA8 scene path
uniform float uBloomStrength;
in vec2 vUv;
out vec4 o;

void main() {
  vec3 top = vec3(0.016, 0.024, 0.047);
  vec3 bot = vec3(0.039, 0.059, 0.110);
  vec3 bg = mix(bot, top, vUv.y);

  float aspect = uRes.x / uRes.y;
  float neb  = texture(uNebula, vUv * vec2(aspect, 1.0) * 1.15 + uTime * vec2(0.0009, 0.0004)).r;
  float neb2 = texture(uNebula, vUv * vec2(aspect, 1.0) * 2.6 - uTime * vec2(0.0005, 0.0008)).r;
  bg += vec3(0.5, 0.7, 1.0) * ((neb * 0.65 + neb2 * 0.35) * 0.012);

  vec2 d = vUv - 0.5;
  bg *= 1.0 - 0.22 * smoothstep(0.25, 1.0, dot(d, d) * 2.0);

  vec3 stars = texture(uScene, vUv).rgb * uDecode;
  vec3 bloom = texture(uBloom, vUv).rgb * uDecode * uBloomStrength;
  vec3 s = stars + bloom;
  s = s * (1.0 + 0.6 * s) / (1.0 + s); // gentle shoulder, dim stars stay linear

  vec3 c = bg + s;
  float ign = fract(52.9829189 * fract(0.06711056 * gl_FragCoord.x + 0.00583715 * gl_FragCoord.y));
  c += (ign - 0.5) * (2.0 / 255.0);
  o = vec4(c, 1.0);
}`;
