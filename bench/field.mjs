/**
 * Compares the ways of evaluating the field, on the data of a real render:
 * evaluating it for every particle of every frame, as the library does today, against
 * baking it into a grid once and interpolating it afterwards.
 *
 * Run with `node bench/field.mjs`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as opentype from '../lib/opentype.mjs';

const root = new URL('..', import.meta.url);

// Same piece as the default page, on a 1440 x 900 screen with a pixel ratio of 2.
const PIXEL_RATIO = 2;
const WIDTH = 1440 * PIXEL_RATIO;
const HEIGHT = 900 * PIXEL_RATIO;
const D = Math.max(WIDTH, HEIGHT);
const NB_ATTRACTORS = 25;
const PARTICLES = 2435;
const FRAMES = 200;
const TEXT = 'A T T R A C T O R S';
const TEXT_WIDTH_RATIO = 12;
const TEXT_POSITION_X = 50;
const TEXT_POSITION_Y = 33;
const IMPACT_DISTANCE = (1 / 400) * PIXEL_RATIO;
const ATTRACTOR_RADIUS_MIN = D / 50;
const ATTRACTOR_RADIUS_MAX = 16 * ATTRACTOR_RADIUS_MIN;

let seed = 1234567;
function random() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  seed |= 0;
  return (seed >>> 0) / 4294967296;
}

// --- The field of a real render -------------------------------------------------------

const attractors = Array.from({ length: NB_ATTRACTORS }, () => ({
  x: random() * (WIDTH - 1),
  y: random() * (HEIGHT - 1),
  weight: random() * 2 - 1,
  radius: random() * (ATTRACTOR_RADIUS_MAX - ATTRACTOR_RADIUS_MIN) + ATTRACTOR_RADIUS_MIN,
}));

const fontFile = readFileSync(fileURLToPath(new URL('fonts/CamBam/1CamBam_Stick_2.ttf', root)));
const font = opentype.parse(
  fontFile.buffer.slice(fontFile.byteOffset, fontFile.byteOffset + fontFile.byteLength),
);
const commands = font.getPath(TEXT, 0, 0, WIDTH / TEXT_WIDTH_RATIO).commands;

const topLeft = { x: Infinity, y: Infinity };
const bottomRight = { x: -Infinity, y: -Infinity };
for (const command of commands) {
  topLeft.x = Math.min(topLeft.x, command.x);
  topLeft.y = Math.min(topLeft.y, command.y);
  bottomRight.x = Math.max(bottomRight.x, command.x);
  bottomRight.y = Math.max(bottomRight.y, command.y);
}
const textWidth = bottomRight.x - topLeft.x;
const textHeight = bottomRight.y - topLeft.y;
const textX = (WIDTH * TEXT_POSITION_X) / 100 - textWidth / 2;
const textY = (HEIGHT * TEXT_POSITION_Y) / 100 + textHeight / 2;

const specialAttractors = [];
for (let c = 0; c < commands.length - 1; c++) {
  const from = commands[c];
  const to = commands[c + 1];
  if (to.type !== 'L') {
    continue;
  }
  const x1 = textX + from.x;
  const y1 = textY + from.y;
  const dx = textX + to.x - x1;
  const dy = textY + to.y - y1;
  specialAttractors.push({
    x1, y1, dx, dy,
    invLength2: 1 / (dx * dx + dy * dy),
    impactDistance: IMPACT_DISTANCE,
  });
}

const specialBox = {
  left: (WIDTH * TEXT_POSITION_X) / 100 - textWidth / 2,
  right: (WIDTH * TEXT_POSITION_X) / 100 + textWidth / 2,
  top: (HEIGHT * TEXT_POSITION_Y) / 100 - textHeight / 2,
  bottom: (HEIGHT * TEXT_POSITION_Y) / 100 + textHeight / 2,
};

// --- Evaluating the field, as the library does today ----------------------------------

const closest = { distance: 0, originX: 0, originY: 0, impactDistance: 0 };
const field = { x: 0, y: 0 };

function isNearSpecialAttractor(x, y) {
  const near = D / 8;
  return (
    x > specialBox.left - near &&
    x < specialBox.right + near &&
    y > specialBox.top - near &&
    y < specialBox.bottom + near
  );
}

function findClosestPointOnSpecialAttractor(x, y) {
  let closestDistance2 = Infinity;
  for (const attractor of specialAttractors) {
    const { x1, y1, dx, dy } = attractor;
    let t = ((x - x1) * dx + (y - y1) * dy) * attractor.invLength2;
    if (t > 1) t = 1;
    else if (t < 0) t = 0;
    const originX = x1 + dx * t;
    const originY = y1 + dy * t;
    const errorX = originX - x;
    const errorY = originY - y;
    const distance2 = errorX * errorX + errorY * errorY;
    if (distance2 < closestDistance2) {
      closestDistance2 = distance2;
      closest.originX = originX;
      closest.originY = originY;
      closest.impactDistance = attractor.impactDistance;
    }
  }
  closest.distance = Math.sqrt(closestDistance2);
  return closest;
}

function fieldAt(x, y) {
  let ux = 0;
  let uy = 0;
  for (const attractor of attractors) {
    const dx = x - attractor.x;
    const dy = y - attractor.y;
    const d2 = dx * dx + dy * dy;
    const d = Math.sqrt(d2);
    const weight = attractor.weight * Math.exp((-1 * d2) / (attractor.radius * attractor.radius));
    ux += (weight * dx) / d;
    uy += (weight * dy) / d;
  }
  const norm = Math.sqrt(ux * ux + uy * uy);
  ux /= norm;
  uy /= norm;

  if (isNearSpecialAttractor(x, y)) {
    const c = findClosestPointOnSpecialAttractor(x, y);
    let textUx = x - c.originX;
    let textUy = y - c.originY;
    const textNorm = Math.sqrt(textUx * textUx + textUy * textUy);
    textUx /= textNorm;
    textUy /= textNorm;
    const textWeight = Math.exp((-1 * c.distance * c.distance) / (c.impactDistance * D * D));
    ux = (1 - textWeight) * ux + textWeight * textUx;
    uy = (1 - textWeight) * uy + textWeight * textUy;
  }

  field.x = ux;
  field.y = uy;
  return field;
}

// --- Baking the field into a grid -----------------------------------------------------

/**
 * The field only depends on the position: the attractors never move. It can be
 * evaluated once per cell of a grid, then interpolated for every particle.
 */
function bakeField(spacing) {
  const columns = Math.ceil(WIDTH / spacing) + 2;
  const rows = Math.ceil(HEIGHT / spacing) + 2;
  const values = new Float32Array(columns * rows * 2);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const f = fieldAt(column * spacing, row * spacing);
      const i = 2 * (row * columns + column);
      values[i] = f.x;
      values[i + 1] = f.y;
    }
  }
  return { values, columns, rows, spacing };
}

function sampleField(grid, x, y) {
  const { values, columns, spacing } = grid;
  const gx = x / spacing;
  const gy = y / spacing;
  const column = gx | 0;
  const row = gy | 0;
  const fx = gx - column;
  const fy = gy - row;
  const i = 2 * (row * columns + column);
  const j = i + 2 * columns;

  const ux =
    (values[i] * (1 - fx) + values[i + 2] * fx) * (1 - fy) +
    (values[j] * (1 - fx) + values[j + 2] * fx) * fy;
  const uy =
    (values[i + 1] * (1 - fx) + values[i + 3] * fx) * (1 - fy) +
    (values[j + 1] * (1 - fx) + values[j + 3] * fx) * fy;

  const norm = Math.sqrt(ux * ux + uy * uy);
  field.x = ux / norm;
  field.y = uy / norm;
  return field;
}

// --- Measurements ---------------------------------------------------------------------

/** Particles spread over the canvas, as they are at the start of a render. */
function makePoints() {
  const xs = new Float64Array(PARTICLES);
  const ys = new Float64Array(PARTICLES);
  for (let i = 0; i < PARTICLES; i++) {
    xs[i] = random() * WIDTH;
    ys[i] = random() * HEIGHT;
  }
  return [xs, ys];
}

/** Moves every particle for a number of frames, and returns the time it took per frame. */
function run(evaluate, frames = FRAMES) {
  const [xs, ys] = makePoints();
  const step = 2;
  const start = performance.now();
  for (let frame = 0; frame < frames; frame++) {
    for (let i = 0; i < PARTICLES; i++) {
      const f = evaluate(xs[i], ys[i]);
      const x = xs[i] - step * f.y;
      const y = ys[i] + step * f.x;
      // Keep the particles on the canvas, so that every frame does the same work.
      xs[i] = x < 0 || x >= WIDTH - 1 ? WIDTH / 2 : x;
      ys[i] = y < 0 || y >= HEIGHT - 1 ? HEIGHT / 2 : y;
    }
  }
  return (performance.now() - start) / frames;
}

/** Angle between the baked field and the real one, in degrees, over a sample of points. */
function accuracy(grid, samples = 200000) {
  let worst = 0;
  const errors = [];
  for (let i = 0; i < samples; i++) {
    const x = random() * (WIDTH - 1);
    const y = random() * (HEIGHT - 1);
    const exact = fieldAt(x, y);
    const ex = exact.x;
    const ey = exact.y;
    const baked = sampleField(grid, x, y);
    const dot = Math.min(1, Math.max(-1, ex * baked.x + ey * baked.y));
    const error = (Math.acos(dot) * 180) / Math.PI;
    errors.push(error);
    worst = Math.max(worst, error);
  }
  errors.sort((a, b) => a - b);
  return {
    median: errors[errors.length >> 1],
    p99: errors[Math.floor(errors.length * 0.99)],
    worst,
  };
}

console.log(`${specialAttractors.length} segments, ${attractors.length} attractors, ` +
  `${PARTICLES} particles, canvas ${WIDTH} x ${HEIGHT}`);

run(fieldAt, 20); // warm up
const direct = run(fieldAt);
console.log(`\nevaluated per particle (today) ${direct.toFixed(2)} ms/frame`);

console.log('\nbaked into a grid:');
console.log('spacing   build     memory    per frame   speedup   angle error (median / p99 / worst)');
for (const spacing of [4, 8, 16, 32]) {
  const buildStart = performance.now();
  const grid = bakeField(spacing);
  const buildMs = performance.now() - buildStart;
  run((x, y) => sampleField(grid, x, y), 20); // warm up
  const baked = run((x, y) => sampleField(grid, x, y));
  const error = accuracy(grid, 100000);
  console.log(
    `${String(spacing).padEnd(9)} ${(buildMs.toFixed(0) + ' ms').padEnd(9)} ` +
    `${((grid.values.byteLength / 1048576).toFixed(2) + ' MB').padEnd(9)} ` +
    `${(baked.toFixed(3) + ' ms').padEnd(11)} ` +
    `${('x' + (direct / baked).toFixed(0)).padEnd(9)} ` +
    `${error.median.toFixed(2)}° / ${error.p99.toFixed(2)}° / ${error.worst.toFixed(1)}°`,
  );
}
