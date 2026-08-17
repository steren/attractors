/**
 * Compares the two ways of painting what a frame of the piece draws: the canvas 2D
 * context the library uses today, and WebGL 2.
 *
 * A frame draws one short line per particle, and one shadow sprite for most of them.
 * Both are painted on top of the previous frames: the canvas is never cleared.
 */

const params = new URLSearchParams(location.search);
const num = (name, fallback) => (params.has(name) ? Number(params.get(name)) : fallback);

const PIXEL_RATIO = 2;
const WIDTH = 1440 * PIXEL_RATIO;
const HEIGHT = 900 * PIXEL_RATIO;
const PARTICLES = num('particles', 2435);
const SHADOWS = Math.round(PARTICLES * 0.855);
const SHADOW_SIZE = num('size', 16 * PIXEL_RATIO);
const SHADOW_OPACITY = 0.03;
const LINE_WIDTH = 0.35 * PIXEL_RATIO;
const FRAMES = num('frames', 60);

let seed = 1234567;
function random() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  seed |= 0;
  return (seed >>> 0) / 4294967296;
}

/** Particle positions and the segment each of them draws this frame. */
const xs = new Float32Array(PARTICLES);
const ys = new Float32Array(PARTICLES);
const dxs = new Float32Array(PARTICLES);
const dys = new Float32Array(PARTICLES);
for (let i = 0; i < PARTICLES; i++) {
  xs[i] = random() * WIDTH;
  ys[i] = random() * HEIGHT;
  const angle = random() * 2 * Math.PI;
  dxs[i] = Math.cos(angle) * 2;
  dys[i] = Math.sin(angle) * 2;
}

/** Advances the particles, so that every frame paints somewhere else. */
function move() {
  for (let i = 0; i < PARTICLES; i++) {
    xs[i] += dxs[i];
    ys[i] += dys[i];
    if (xs[i] < 0 || xs[i] > WIDTH) dxs[i] = -dxs[i];
    if (ys[i] < 0 || ys[i] > HEIGHT) dys[i] = -dys[i];
  }
}

const shadow = new Image();
shadow.src = '../shadow-o30-ellipse-16px.png';
await shadow.decode();

// --- Canvas 2D ------------------------------------------------------------------------

const canvas2d = document.getElementById('canvas2d');
canvas2d.width = WIDTH;
canvas2d.height = HEIGHT;
const ctx = canvas2d.getContext('2d', { alpha: false });
ctx.fillStyle = '#57A3BD';
ctx.fillRect(0, 0, WIDTH, HEIGHT);
ctx.lineWidth = LINE_WIDTH;

function canvas2dLines() {
  for (const [c, color] of ['#DBCEC1', '#F7F6F5'].entries()) {
    const from = c === 0 ? 0 : PARTICLES >> 1;
    const to = c === 0 ? PARTICLES >> 1 : PARTICLES;
    ctx.beginPath();
    ctx.strokeStyle = color;
    for (let i = from; i < to; i++) {
      ctx.moveTo(xs[i], ys[i]);
      ctx.lineTo(xs[i] + dxs[i], ys[i] + dys[i]);
    }
    ctx.stroke();
  }
}

function canvas2dShadows() {
  ctx.globalAlpha = SHADOW_OPACITY;
  for (let i = 0; i < SHADOWS; i++) {
    ctx.drawImage(shadow, xs[i], ys[i], SHADOW_SIZE, SHADOW_SIZE);
  }
  ctx.globalAlpha = 1;
}

/** Same shadows, drawn at the natural size of the sprite: no resampling. */
function canvas2dShadowsNatural() {
  ctx.globalAlpha = SHADOW_OPACITY;
  for (let i = 0; i < SHADOWS; i++) {
    ctx.drawImage(shadow, xs[i], ys[i]);
  }
  ctx.globalAlpha = 1;
}

/**
 * Shadows painted as one path holding every ellipse, filled once. The sprite is a black
 * radial blob, so a filled ellipse draws the same thing, without an image and without one
 * call per particle. The alpha is the one that lays down as much ink as the sprite:
 * its mean alpha (8.9 / 255) over its area, times the opacity the library draws it with.
 */
const SPRITE_INK = (8.9 / 255) * SHADOW_OPACITY * SHADOW_SIZE * SHADOW_SIZE;

function canvas2dShadowsEllipses() {
  const radius = SHADOW_SIZE / 2;
  ctx.globalAlpha = SPRITE_INK / (Math.PI * radius * radius);
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  for (let i = 0; i < SHADOWS; i++) {
    ctx.moveTo(xs[i] + radius, ys[i]);
    ctx.arc(xs[i], ys[i], radius, 0, 2 * Math.PI);
  }
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * Same, in three concentric layers, so that the blob fades out from its centre the way
 * the sprite does instead of being flat. Three fills for every shadow of the frame.
 */
function canvas2dShadowsLayers() {
  ctx.fillStyle = '#000000';
  for (const ratio of [1, 0.66, 0.33]) {
    const radius = (SHADOW_SIZE / 2) * ratio;
    ctx.globalAlpha = SPRITE_INK / 3 / (Math.PI * radius * radius);
    ctx.beginPath();
    for (let i = 0; i < SHADOWS; i++) {
      ctx.moveTo(xs[i] + radius, ys[i]);
      ctx.arc(xs[i], ys[i], radius, 0, 2 * Math.PI);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Shadows painted as one batched path instead of one sprite per particle: a wide,
 * translucent stroke under the trails, in the single path the trails already use.
 */
function canvas2dShadowsAsPath() {
  ctx.globalAlpha = SHADOW_OPACITY;
  ctx.beginPath();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = SHADOW_SIZE;
  ctx.lineCap = 'round';
  for (let i = 0; i < SHADOWS; i++) {
    ctx.moveTo(xs[i], ys[i]);
    ctx.lineTo(xs[i] + dxs[i], ys[i] + dys[i]);
  }
  ctx.stroke();
  ctx.lineWidth = LINE_WIDTH;
  ctx.lineCap = 'butt';
  ctx.globalAlpha = 1;
}

/** Forces the canvas to execute the commands it buffered. */
function flush2d() {
  ctx.getImageData(0, 0, 1, 1);
}

// --- WebGL 2 --------------------------------------------------------------------------

const glCanvas = document.getElementById('webgl');
glCanvas.width = WIDTH;
glCanvas.height = HEIGHT;
const gl = glCanvas.getContext('webgl2', {
  alpha: false,
  antialias: true,
  // The piece paints on top of the previous frames, so the buffer must be kept.
  preserveDrawingBuffer: true,
  desynchronized: false,
});

function compile(vertexSource, fragmentSource) {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertexSource],
    [gl.FRAGMENT_SHADER, fragmentSource],
  ]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  return program;
}

/** Trails: one quad per particle, as wide as the stroke, painted with the trail color. */
const lineProgram = compile(
  `#version 300 es
  in vec2 position;
  in vec2 direction;
  in float side;
  in float color;
  uniform vec2 resolution;
  uniform float halfWidth;
  out float vColor;
  void main() {
    vec2 normal = normalize(vec2(-direction.y, direction.x)) * halfWidth * side;
    vec2 clip = ((position + normal) / resolution) * 2.0 - 1.0;
    gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
    vColor = color;
  }`,
  `#version 300 es
  precision highp float;
  in float vColor;
  uniform vec3 color1;
  uniform vec3 color2;
  out vec4 fragColor;
  void main() {
    fragColor = vec4(mix(color1, color2, vColor), 1.0);
  }`,
);

/** Shadows: one point sprite per particle, sampling the same texture as the canvas. */
const shadowProgram = compile(
  `#version 300 es
  in vec2 position;
  uniform vec2 resolution;
  uniform float size;
  void main() {
    vec2 clip = (position / resolution) * 2.0 - 1.0;
    gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
    gl_PointSize = size;
  }`,
  `#version 300 es
  precision highp float;
  uniform sampler2D sprite;
  uniform float opacity;
  out vec4 fragColor;
  void main() {
    vec4 texel = texture(sprite, gl_PointCoord);
    fragColor = vec4(texel.rgb, texel.a * opacity);
  }`,
);

const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, shadow);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

// Two triangles per particle: the quad of its trail.
const VERTICES = PARTICLES * 6;
const linePositions = new Float32Array(VERTICES * 2);
const lineDirections = new Float32Array(VERTICES * 2);
const lineSides = new Float32Array(VERTICES);
const lineColors = new Float32Array(VERTICES);
const shadowPositions = new Float32Array(SHADOWS * 2);

function fillLineBuffers() {
  // The quad of a trail: (from, -1), (from, 1), (to, -1), (to, 1), as two triangles.
  const corners = [
    [0, -1], [0, 1], [1, -1],
    [0, 1], [1, 1], [1, -1],
  ];
  for (let i = 0; i < PARTICLES; i++) {
    const color = i < PARTICLES >> 1 ? 0 : 1;
    for (let v = 0; v < 6; v++) {
      const [along, side] = corners[v];
      const index = i * 6 + v;
      linePositions[index * 2] = xs[i] + along * dxs[i];
      linePositions[index * 2 + 1] = ys[i] + along * dys[i];
      lineDirections[index * 2] = dxs[i];
      lineDirections[index * 2 + 1] = dys[i];
      lineSides[index] = side;
      lineColors[index] = color;
    }
  }
  for (let i = 0; i < SHADOWS; i++) {
    shadowPositions[i * 2] = xs[i];
    shadowPositions[i * 2 + 1] = ys[i];
  }
}

function buffer(data, program, name, size) {
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  const location = gl.getAttribLocation(program, name);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  return vbo;
}

fillLineBuffers();

const lineVao = gl.createVertexArray();
gl.bindVertexArray(lineVao);
const linePositionBuffer = buffer(linePositions, lineProgram, 'position', 2);
buffer(lineDirections, lineProgram, 'direction', 2);
buffer(lineSides, lineProgram, 'side', 1);
buffer(lineColors, lineProgram, 'color', 1);

const shadowVao = gl.createVertexArray();
gl.bindVertexArray(shadowVao);
const shadowPositionBuffer = buffer(shadowPositions, shadowProgram, 'position', 2);

gl.viewport(0, 0, WIDTH, HEIGHT);
gl.clearColor(0x57 / 255, 0xa3 / 255, 0xbd / 255, 1);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

function webglLines() {
  gl.useProgram(lineProgram);
  gl.bindVertexArray(lineVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, linePositionBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, linePositions);
  gl.uniform2f(gl.getUniformLocation(lineProgram, 'resolution'), WIDTH, HEIGHT);
  gl.uniform1f(gl.getUniformLocation(lineProgram, 'halfWidth'), LINE_WIDTH / 2);
  gl.uniform3f(gl.getUniformLocation(lineProgram, 'color1'), 0.859, 0.808, 0.757);
  gl.uniform3f(gl.getUniformLocation(lineProgram, 'color2'), 0.969, 0.965, 0.961);
  gl.drawArrays(gl.TRIANGLES, 0, VERTICES);
}

function webglShadows() {
  gl.useProgram(shadowProgram);
  gl.bindVertexArray(shadowVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, shadowPositionBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, shadowPositions);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(gl.getUniformLocation(shadowProgram, 'sprite'), 0);
  gl.uniform2f(gl.getUniformLocation(shadowProgram, 'resolution'), WIDTH, HEIGHT);
  gl.uniform1f(gl.getUniformLocation(shadowProgram, 'size'), SHADOW_SIZE);
  gl.uniform1f(gl.getUniformLocation(shadowProgram, 'opacity'), SHADOW_OPACITY);
  gl.drawArrays(gl.POINTS, 0, SHADOWS);
}

/** Forces WebGL to execute the commands it buffered. */
const pixel = new Uint8Array(4);
function flushGl() {
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
}

// --- Measurements ---------------------------------------------------------------------

/** Runs a frame a number of times, and returns how long it took per frame. */
function measure(frame, flush, frames = FRAMES) {
  // Warm up.
  for (let i = 0; i < 5; i++) {
    move();
    frame();
  }
  flush();
  const start = performance.now();
  for (let i = 0; i < frames; i++) {
    move();
    frame();
  }
  flush();
  return (performance.now() - start) / frames;
}

const results = {
  renderer: gl.getParameter(gl.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
  canvas2dTrails: measure(canvas2dLines, flush2d),
  canvas2dShadows: measure(canvas2dShadows, flush2d),
  canvas2dShadowsNatural: measure(canvas2dShadowsNatural, flush2d),
  canvas2dShadowsAsPath: measure(canvas2dShadowsAsPath, flush2d),
  canvas2dShadowsEllipses: measure(canvas2dShadowsEllipses, flush2d),
  canvas2dShadowsLayers: measure(canvas2dShadowsLayers, flush2d),
  canvas2dBoth: measure(() => { canvas2dLines(); canvas2dShadows(); }, flush2d),
  webglTrails: measure(() => { fillLineBuffers(); webglLines(); }, flushGl),
  webglShadows: measure(() => { fillLineBuffers(); webglShadows(); }, flushGl),
  webglBoth: measure(() => { fillLineBuffers(); webglLines(); webglShadows(); }, flushGl),
  size: SHADOW_SIZE,
  particles: PARTICLES,
  shadows: SHADOWS,
};
const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
if (debugInfo) {
  results.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
}
window.__benchResult = results;
