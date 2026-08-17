/**
 * Benchmark harness: drives the render loop synchronously and reports how long a frame
 * takes, with parts of the render turned off to isolate their cost.
 *
 * Frames are driven by hand rather than by `requestAnimationFrame`, so that the
 * measurement covers the work of the library only, and not the compositing of the page.
 *
 * Query parameters:
 *   frames      number of frames to render
 *   text        "0" renders without text (no special attractors)
 *   stroke      "0" skips the canvas path calls (particle trails are not painted)
 *   shadow      "0" skips the drawImage calls (shadows are not painted)
 *   canvas      "0" replaces the canvas context by a stub (nothing is painted at all)
 *   dpr, density, attractors, speed   override the matching config keys
 */
import { Attractors, DEFAULT_CONFIG } from '../attractors.js';

const params = new URLSearchParams(location.search);
const flag = (name) => params.get(name) !== '0';
const num = (name, fallback) => (params.has(name) ? Number(params.get(name)) : fallback);

const FRAME_DURATION = 1000 / 60;

// Deterministic randomness, so that every scenario lays out the very same piece.
let seed = 1234567;
Math.random = () => {
  // xorshift32: stays exact in 32 bit integer arithmetic, unlike a plain LCG on doubles.
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  seed |= 0;
  return (seed >>> 0) / 4294967296;
};

/** Counts of the canvas calls of one frame, to report what the render asks the canvas to do. */
const calls = { moveTo: 0, lineTo: 0, stroke: 0, drawImage: 0 };

/** A context recording the calls it gets, and painting nothing. */
function stubContext() {
  const stub = {
    canvas: { width: 0, height: 0 },
    save: () => {},
    restore: () => {},
    fillRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    arc: () => {},
    fill: () => {},
    moveTo: () => calls.moveTo++,
    lineTo: () => calls.lineTo++,
    stroke: () => calls.stroke++,
    drawImage: () => calls.drawImage++,
  };
  return stub;
}

const proto = CanvasRenderingContext2D.prototype;
const realGetContext = HTMLCanvasElement.prototype.getContext;
const realMoveTo = proto.moveTo;
const realLineTo = proto.lineTo;
const realStroke = proto.stroke;
const realDrawImage = proto.drawImage;

proto.moveTo = function (...args) {
  calls.moveTo++;
  if (flag('stroke')) realMoveTo.apply(this, args);
};
proto.lineTo = function (...args) {
  calls.lineTo++;
  if (flag('stroke')) realLineTo.apply(this, args);
};
proto.stroke = function (...args) {
  calls.stroke++;
  if (flag('stroke')) realStroke.apply(this, args);
};
proto.drawImage = function (...args) {
  calls.drawImage++;
  if (flag('shadow')) realDrawImage.apply(this, args);
};

if (!flag('canvas')) {
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    return type === '2d' ? stubContext() : realGetContext.call(this, type, ...rest);
  };
}

// Capture the loop the library registers, so that frames can be driven by hand.
let pending = null;
window.requestAnimationFrame = (callback) => {
  pending = callback;
  return 1;
};

const config = {
  ...DEFAULT_CONFIG,
  // The assets live one directory up, next to the library.
  root: '../',
  text: flag('text') ? 'A T T R A C T O R S' : '',
  pixelratio: num('dpr', 2),
  particule_density: num('density', DEFAULT_CONFIG.particule_density),
  nb_attractors: num('attractors', DEFAULT_CONFIG.nb_attractors),
  speed: num('speed', DEFAULT_CONFIG.speed),
};

const attractors = new Attractors(config);
const initStartedAt = performance.now();
await attractors.start();
const initMs = performance.now() - initStartedAt;

/** Renders one frame, and returns how long it took, in milliseconds. */
function renderFrame(timestamp) {
  const callback = pending;
  pending = null;
  const start = performance.now();
  callback(timestamp);
  return performance.now() - start;
}

/** Forces the canvas to execute the commands it has buffered. */
function flushCanvas() {
  const context = realGetContext.call(document.getElementById(config.id), '2d');
  context.getImageData(0, 0, 1, 1);
}

const frameCount = num('frames', 200);
let timestamp = 1000;

// Warm up: let the JIT compile the render loop before measuring.
for (let i = 0; i < 20; i++) {
  renderFrame((timestamp += FRAME_DURATION));
}
if (flag('canvas')) {
  flushCanvas();
}
Object.assign(calls, { moveTo: 0, lineTo: 0, stroke: 0, drawImage: 0 });

const durations = [];
const measureStartedAt = performance.now();
for (let i = 0; i < frameCount; i++) {
  durations.push(renderFrame((timestamp += FRAME_DURATION)));
}
const jsMs = performance.now() - measureStartedAt;

// Time the canvas takes to execute what the frames buffered, if it painted for real.
const flushStartedAt = performance.now();
if (flag('canvas')) {
  flushCanvas();
}
const flushMs = performance.now() - flushStartedAt;

attractors.stop();

const sorted = [...durations].sort((a, b) => a - b);
const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;

window.__benchResult = {
  particles: calls.moveTo / frameCount,
  shadowsPerFrame: calls.drawImage / frameCount,
  strokeCallsPerFrame: calls.stroke / frameCount,
  frames: frameCount,
  initMs,
  // Time spent in the render loop, per frame, and time the canvas then needed to
  // execute the commands it had buffered, spread over the same frames.
  jsMsPerFrame: jsMs / frameCount,
  flushMsPerFrame: flushMs / frameCount,
  totalMsPerFrame: (jsMs + flushMs) / frameCount,
  medianMs: percentile(0.5),
  p95Ms: percentile(0.95),
};
