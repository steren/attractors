/**
 * Renders the piece with the shadows painted in different ways, so that they can be
 * compared side by side. Every mode paints the very same piece, from the same seed.
 *
 * Query parameters:
 *   mode     "sprite" (what the library does today), "ellipse" (one filled path for the
 *            whole frame), "layers" (three concentric filled paths), "none"
 *   frames   number of frames to render
 *   radius   radius of the ellipses, as a fraction of the size of the sprite
 *   alpha    opacity of the ellipses. Below about 0.003 nothing is painted at all: the
 *            canvas holds 8 bit colors, and a fainter stamp rounds back to the color
 *            underneath it
 */
import { Attractors, DEFAULT_CONFIG } from '../attractors.js';

const params = new URLSearchParams(location.search);
const mode = params.get('mode') ?? 'sprite';
const frameCount = Number(params.get('frames') ?? 600);
const radiusRatio = Number(params.get('radius') ?? 0.5);
const alpha = Number(params.get('alpha') ?? 0.0034);

const PIXEL_RATIO = 2;
const SHADOW_OPACITY = 0.03;
/** Mean alpha of the shadow sprite, out of 255, measured on the file itself. */

let seed = 1234567;
Math.random = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  seed |= 0;
  return (seed >>> 0) / 4294967296;
};

// Collect the shadows of the frame instead of painting them one by one.
const shadowXs = [];
const shadowYs = [];
let shadowSize = 32;
const realDrawImage = CanvasRenderingContext2D.prototype.drawImage;
if (mode !== 'sprite') {
  CanvasRenderingContext2D.prototype.drawImage = function (image, x, y, width) {
    shadowXs.push(x);
    shadowYs.push(y);
    shadowSize = width;
  };
}

let pending = null;
window.requestAnimationFrame = (callback) => {
  pending = callback;
  return 1;
};

const attractors = new Attractors({
  ...DEFAULT_CONFIG,
  root: '../',
  text: 'A T T R A C T O R S',
  pixelratio: PIXEL_RATIO,
  particule_density: Number(params.get('density') ?? DEFAULT_CONFIG.particule_density),
});
await attractors.start();

const ctx = document.getElementById('paint-canvas').getContext('2d');

/** Adds every collected shadow to the current path, as a circle of the given radius. */
function circlePath(radius) {
  ctx.beginPath();
  for (let i = 0; i < shadowXs.length; i++) {
    // The sprite is drawn from its corner, a circle from its centre.
    const x = shadowXs[i] + shadowSize / 2;
    const y = shadowYs[i] + shadowSize / 2;
    ctx.moveTo(x + radius, y);
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
  }
}

/** Paints the shadows collected during the frame, in one fill. */
function fillEllipses() {
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = alpha;
  circlePath(shadowSize * radiusRatio);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * Paints them as two fills: a wide faint one and a narrow stronger one, so that the blob
 * fades out from its centre the way the sprite does instead of being flat.
 */
function fillLayers() {
  ctx.fillStyle = '#000000';
  for (const [ratio, opacity] of [[1, alpha], [0.5, alpha]]) {
    ctx.globalAlpha = opacity;
    circlePath(shadowSize * radiusRatio * ratio);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const paintShadows = { ellipse: fillEllipses, layers: fillLayers }[mode];

let timestamp = 1000;
const renderStartedAt = performance.now();
for (let frame = 0; frame < frameCount; frame++) {
  shadowXs.length = 0;
  shadowYs.length = 0;
  const callback = pending;
  pending = null;
  callback((timestamp += 1000 / 60));
  paintShadows?.();
}
const renderMs = performance.now() - renderStartedAt;
attractors.stop();
CanvasRenderingContext2D.prototype.drawImage = realDrawImage;

// Mean brightness of the render, to check that the shadows landed at all.
const pixels = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
let sum = 0;
for (let i = 0; i < pixels.length; i += 4) {
  sum += pixels[i] + pixels[i + 1] + pixels[i + 2];
}

window.__benchResult = {
  mode,
  frames: frameCount,
  msPerFrame: +(renderMs / frameCount).toFixed(2),
  shadowsPerFrame: shadowXs.length,
  shadowSize,
  radius: shadowSize * radiusRatio,
  alpha,
  meanBrightness: +(sum / (pixels.length / 4) / 3).toFixed(3),
};
