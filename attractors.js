/**
 * Attractors — animated attractor fields painted on a <canvas>.
 *
 * @author annemenini
 * @author steren
 */

/*
 * Shadows are drawn as plain filled circles: every shadow of a frame goes into a single
 * path, filled in one call, rather than one image per particle. The sprite they replace
 * was a black radial blob, so a circle paints the same thing, without the thousands of
 * `drawImage` calls that used to be the most expensive part of a frame.
 */

/** Size of the area a shadow covers, in CSS pixels. */
const SHADOW_SIZE = 16;

/**
 * Radius of a shadow, as a fraction of the area it covers.
 *
 * The sprite this replaces looked like a soft blob as wide as `SHADOW_SIZE`, but only its
 * core ever registered: see `SHADOW_OPACITY`. This is the radius that darkens the canvas
 * at the rate the sprite did, measured against renders of the same piece.
 *
 * This is the knob to turn to make the shadows heavier or lighter. `SHADOW_OPACITY` is
 * not: it only moves the render when it crosses a rounding step, and then it moves it a
 * lot.
 */
const SHADOW_RADIUS_RATIO = 0.196;

/**
 * Opacity of a shadow. The sprite peaked at an alpha of 29/255 and was drawn at an opacity
 * of 0.03, so this is the strongest stamp it ever laid down.
 *
 * It cannot go much below this: the canvas holds 8 bit colors, so a stamp fainter than
 * about `0.5 / 255` of the color underneath it rounds back to that color and paints
 * nothing at all. That threshold rises as an area darkens, which is what stops the
 * shadows from ever piling up to black.
 *
 * The same rounding makes this a staircase rather than a dial: every value from 0.0034 to
 * 0.0058 renders the very same image, and 0.006 — where a third channel of the background
 * starts to darken as well — renders one 64% heavier. Use `SHADOW_RADIUS_RATIO` to tune
 * the weight of the shadows.
 */
const SHADOW_OPACITY = 0.0034;

const SHADOW_COLOR = '#000000';

/** Offset of the area a shadow covers from its particle, in CSS pixels. */
const SHADOW_OFFSET_X = 1;
const SHADOW_OFFSET_Y = 1;

/** Probability, per particle and per reference frame, that a particle is re-seeded elsewhere. */
const NEW_SEED_CREATION_PROBABILITY = 0;

/** Framerate the animation is tuned for. Every "per frame" constant refers to it. */
const REFERENCE_FRAMERATE = 60;

/** Duration of a frame at the reference framerate, in milliseconds. */
const REFERENCE_FRAME_DURATION = 1000 / REFERENCE_FRAMERATE;

/**
 * Speed of the particles at `config.speed` 1, in CSS pixels per second.
 * At the reference framerate, this moves a particle by one pixel per frame.
 */
const SPEED = REFERENCE_FRAMERATE;

/**
 * Longest frame duration taken into account, in milliseconds.
 * Longer frames, on a slow device or when coming back to a background tab, are
 * clamped: moving the particles by the whole elapsed distance at once would draw
 * long straight segments instead of curves.
 */
const MAX_FRAME_DURATION = 3 * REFERENCE_FRAME_DURATION;

/** Under this width, do not subdivise the quadratic and cubic bezier curves of the text's path. */
const TEXT_MIN_WIDTH_TO_SUBDIVISE = 500;
const PROBABILITY_POINT_APPEARS_NEAR_TEXT = 0.2;

const DEFAULT_IMPACT_DISTANCE = 1 / 400;
const ATTRACTOR_RADIUS_MIN = 1 / 50;
const ATTRACTOR_RADIUS_MAX = 16 * ATTRACTOR_RADIUS_MIN;
/** Length of the segments a no go zone is subdivised into. Decrease to subdivise more. */
const SUBDIVISE_NOGO = 16;

const FONT = 'fonts/CamBam/1CamBam_Stick_2.ttf';

/** Draws a closed outline through the given `[x, y]` points. */
function polygon(path, points) {
  path.moveTo(...points[0]);
  for (const point of points.slice(1)) {
    path.lineTo(...point);
  }
  // Come back to the first point explicitly: a closing "Z" command creates no attractor,
  // so without this line the last side would attract nothing.
  path.lineTo(...points[0]);
  path.close();
}

/**
 * Width of a fallback glyph, in font units. Both the triangle and the hexagon are
 * regular polygons fitting in the cap height, hence `2 / sqrt(3)` as wide as they are tall.
 */
function polygonWidth(capHeight) {
  return (2 / Math.sqrt(3)) * capHeight;
}

/**
 * Characters that the fonts have no glyph for, drawn by the library instead.
 * `outline(path, capHeight, x)` draws the character starting at `x`, on the baseline and
 * as tall as a capital letter, so that it matches the letters around it. It returns the
 * width it drew, in font units.
 */
const FALLBACK_GLYPHS = [
  {
    /** ▲ BLACK UP-POINTING TRIANGLE: an equilateral triangle standing on the baseline. */
    unicode: 0x25b2,
    name: 'blackuptriangle',
    outline(path, capHeight, x) {
      const width = polygonWidth(capHeight);
      polygon(path, [
        [x + width / 2, capHeight],
        [x + width, 0],
        [x, 0],
      ]);
      return width;
    },
  },
  {
    /** ⬣ HORIZONTAL BLACK HEXAGON: a regular hexagon lying on a flat side. */
    unicode: 0x2b23,
    name: 'horizontalblackhexagon',
    outline(path, capHeight, x) {
      const width = polygonWidth(capHeight);
      polygon(path, [
        [x, capHeight / 2],
        [x + width / 4, capHeight],
        [x + (3 * width) / 4, capHeight],
        [x + width, capHeight / 2],
        [x + (3 * width) / 4, 0],
        [x + width / 4, 0],
      ]);
      return width;
    },
  },
];

/** Side bearing of the fallback glyphs, as a fraction of the em square. */
const FALLBACK_GLYPH_SIDE_BEARING = 0.04;

/**
 * The text that the `cleanPath` command table below was hand-tuned for.
 * When it is rendered, only the listed path commands become attractors.
 */
const CLEAN_PATH_TEXT = '13   8   2016';

/**
 * Default configuration. Every key can be overridden through the constructor.
 * Keys use snake_case for backwards compatibility with URLs sharing a config.
 */
export const DEFAULT_CONFIG = {
  /** ID of the DOM canvas on which to paint. */
  id: 'paint-canvas',
  /** Scale at which particles are initialized, 1 being the size of the screen. */
  init_scale: 1,
  /** Speed of the animation, 1 being the reference speed. Below 1 is slower, above is faster. */
  speed: 1,
  text: '',
  text_position_x: 50,
  text_position_y: 33,
  text_width_ratio: 12,
  background_color: '#57A3BD',
  nb_attractors: 25,
  /** Number of particles for a square of 1000 * 1000 pixels. */
  particule_density: 900,
  line_width: 0.35,
  color1: '#DBCEC1',
  color2: '#F7F6F5',
  shadow_scale: 1,
  nogo_zone: false,
  /** Array of `{x, y, radius, impactDistance?, type?, direction?}` circles without particles. */
  nogoCircles: [],
  /** Number of points in a screen pixel. Set to 2 on Retina screens. */
  pixelratio: globalThis.devicePixelRatio || 1,
  /** Keep an SVG version of the render in memory, so that it can be exported. */
  svg: false,
  /** Store the whole SVG render into a single <path>. */
  one_path: false,
  /** Draw helpers showing the attractors. */
  debug: false,
  /** Prefix to prepend to the asset URLs (fonts). */
  root: '',
};

/** Fonts are shared between renders, so that reloading a config does not refetch them. */
const fontCache = new Map();

/**
 * Evaluates a Bezier curve of any degree.
 * @param {number[]} ts Positions along the curve, between 0 and 1.
 * @param {number[]} points Coordinates of the control points.
 * @returns {number[]} The coordinate at each `t`.
 */
function bezier(ts, points) {
  const n = points.length;

  // Binomial coefficients C(n-1, k), i.e. the n-th row of Pascal's triangle.
  const weights = [1];
  for (let k = 1; k < n; k++) {
    weights.push((weights[k - 1] * (n - k)) / k);
  }

  return ts.map((t) => {
    let value = 0;
    for (let j = 0; j < n; j++) {
      value += weights[j] * (1 - t) ** (n - 1 - j) * t ** j * points[j];
    }
    return value;
  });
}

/** Random number between 0 and 1, following a gaussian-ish distribution. */
function normalRand() {
  for (;;) {
    const x = Math.random();
    if (Math.exp((-1 * (x - 0.5) ** 2) / 0.1) > Math.random()) {
      return x;
    }
  }
}

/** Height of a capital letter of a font, in font units. */
function getCapHeight(font) {
  const declared = font.tables.os2?.sCapHeight;
  if (declared > 0) {
    return declared;
  }
  const { y2 } = font.charToGlyph('A').getBoundingBox();
  return y2 > 0 && Number.isFinite(y2) ? y2 : 0.7 * font.unitsPerEm;
}

/**
 * Adds to a font the glyphs of `FALLBACK_GLYPHS` it does not have, so that the
 * characters they draw can be used in the text like any other.
 */
function addFallbackGlyphs(font, { Glyph, Path }) {
  const glyphIndexMap = font.tables.cmap?.glyphIndexMap;
  if (!glyphIndexMap) {
    return font;
  }

  const height = getCapHeight(font);
  const sideBearing = FALLBACK_GLYPH_SIDE_BEARING * font.unitsPerEm;

  for (const { unicode, name, outline } of FALLBACK_GLYPHS) {
    // The font draws this character itself, nothing to add.
    if (glyphIndexMap[unicode]) {
      continue;
    }

    const path = new Path();
    const advanceWidth = outline(path, height, sideBearing) + 2 * sideBearing;
    const index = font.glyphs.length;
    font.glyphs.push(index, new Glyph({ name, unicode, index, advanceWidth, path }));
    glyphIndexMap[unicode] = index;
  }

  return font;
}

/** Loads and parses a font, memoized by URL. */
async function loadFont(url) {
  if (!fontCache.has(url)) {
    const promise = (async () => {
      const opentype = await import('opentype.js');
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Could not load font ${url}: ${response.status}`);
      }
      return addFallbackGlyphs(opentype.parse(await response.arrayBuffer()), opentype);
    })();
    fontCache.set(url, promise);
  }
  return fontCache.get(url);
}

/** Triggers the download of a file holding the given content. */
function download(content, fileName, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * An animated attractor field, painted on a canvas.
 *
 * ```js
 * const attractors = new Attractors({ id: 'paint-canvas', text: 'HELLO' });
 * await attractors.start();
 * ```
 */
export class Attractors {
  /**
   * Array of attractors, each having:
   *   - x, y: position
   *   - weight: between -1 and 1
   *   - radius: impact distance of this attractor
   */
  #attractors = [];

  /**
   * Array of special attractors, used for text and no go zones.
   * A special attractor is a segment `{x1, y1, dx, dy, invLength2, impactDistance, type?,
   * direction?}`, going from `(x1, y1)` to `(x1 + dx, y1 + dy)`.
   */
  #specialAttractors = [];

  /** Bounding boxes `{topLeft, bottomRight}` around the special attractors. */
  #specialAttractorBoxes = [];

  /** Bounding boxes of the no go zones. */
  #noGoBoxes = [];

  /** Positions of the particles. */
  #pointsX = [];
  #pointsY = [];

  /** Whether the shadow of a given particle should be drawn. */
  #drawShadowAtPoint = [];

  /** Strings of SVG paths, one per particle. Only filled when `config.svg` is true. */
  #svgPaths = [];

  /** Characteristic distance of the image. */
  #d = 0;

  #canvas = null;
  #ctx = null;
  #colors = [];
  /** Number of consecutive particles sharing a color. */
  #colorSize = 0;
  #pixelRatio = 1;
  #screenWidth = 0;
  #screenHeight = 0;
  #width = 0;
  #height = 0;
  #font = null;
  #frameId = null;
  #stopped = false;
  /** Timestamp of the previously rendered frame, in milliseconds. */
  #lastTimestamp = null;

  /** Scratch vectors, reused on every particle to avoid allocating in the render loop. */
  #field = { x: 0, y: 0 };
  #closest = { distance: 0, attractor: null, originX: 0, originY: 0 };

  /** @param {Partial<typeof DEFAULT_CONFIG>} config */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Loads the assets, seeds the particles and starts animating. */
  async start() {
    this.#stopped = false;

    const { root, text } = this.config;
    const font = text ? await loadFont(root + FONT) : null;
    // Another render may have been started while the font was loading.
    if (this.#stopped) {
      return this;
    }
    this.#font = font;

    this.#initialize();

    if (this.#frameId === null) {
      this.#lastTimestamp = null;
      const loop = (timestamp) => {
        this.#frameId = requestAnimationFrame(loop);
        this.#render(timestamp);
      };
      this.#frameId = requestAnimationFrame(loop);
    }
    return this;
  }

  /** Stops animating. */
  stop() {
    this.#stopped = true;
    if (this.#frameId !== null) {
      cancelAnimationFrame(this.#frameId);
      this.#frameId = null;
    }
  }

  #initialize() {
    const config = this.config;

    this.#colors = [config.color1, config.color2];
    this.#specialAttractors = [];
    this.#specialAttractorBoxes = [];
    this.#noGoBoxes = [];
    this.#pointsX = [];
    this.#pointsY = [];

    config.noGoImpactDistance ??= DEFAULT_IMPACT_DISTANCE;
    config.textGaussianImpactDistance ??= DEFAULT_IMPACT_DISTANCE;

    this.#pixelRatio = config.pixelratio || globalThis.devicePixelRatio || 1;

    this.#canvas = document.getElementById(config.id);
    if (!this.#canvas) {
      throw new Error(`No canvas with id "${config.id}" in the document`);
    }
    this.#ctx = this.#canvas.getContext('2d', { alpha: false });
    this.#resizeCanvas();
    this.#d = Math.max(this.#width, this.#height);

    this.#paintBackground();

    this.#initAttractors(config.nb_attractors, ATTRACTOR_RADIUS_MIN, ATTRACTOR_RADIUS_MAX);
    if (config.text) {
      this.#initTextSpecialAttractors();
    }
    if (config.nogo_zone) {
      this.#initNoGoZoneSpecialAttractors();
      this.#initNoGoCirclesSpecialAttractors();
    }
    // Seeds the remaining particles. Runs last, as it needs the no go zones to avoid them.
    this.#initPoints(config.particule_density);

    this.#drawShadowAtPoint = new Array(this.#pointsX.length).fill(true);
    this.#colorSize = Math.ceil(this.#pointsX.length / this.#colors.length);
    this.#ctx.lineWidth = config.line_width * this.#pixelRatio;

    this.#svgPaths = config.svg ? new Array(this.#pointsX.length).fill('') : [];
  }

  #resizeCanvas() {
    this.#screenWidth = this.#canvas.clientWidth;
    this.#screenHeight = this.#canvas.clientHeight;
    this.#width = this.#screenWidth * this.#pixelRatio;
    this.#height = this.#screenHeight * this.#pixelRatio;

    this.#canvas.width = this.#width;
    this.#canvas.height = this.#height;
  }

  #paintBackground() {
    this.#ctx.fillStyle = this.config.background_color;
    this.#ctx.fillRect(0, 0, this.#width, this.#height);
  }

  /**
   * Paints one frame.
   * @param {number} timestamp Time of this frame, in milliseconds, as given by
   *   `requestAnimationFrame`. Distances and probabilities are scaled by the time
   *   elapsed since the previous frame, so that the animation runs at the same
   *   speed whatever the framerate of the display.
   */
  #render(timestamp) {
    const ctx = this.#ctx;
    const pointsX = this.#pointsX;
    const pointsY = this.#pointsY;
    const total = pointsX.length;

    // Time the piece advances by during this frame: how long the frame lasted,
    // scaled by the configured speed. Everything below is derived from it, so that
    // a speed of 2 plays the very same animation twice as fast.
    const frameDuration =
      this.#lastTimestamp === null
        ? REFERENCE_FRAME_DURATION
        : Math.min(timestamp - this.#lastTimestamp, MAX_FRAME_DURATION);
    this.#lastTimestamp = timestamp;
    const elapsed = frameDuration * this.config.speed;

    // Duration of this frame, expressed as a number of reference frames.
    const frames = elapsed / REFERENCE_FRAME_DURATION;

    // Distance travelled by a particle during this frame.
    const step = (SPEED * elapsed * this.#pixelRatio) / 1000;

    // Cut the particles into one group per color, and paint each group at once:
    // start a path, add every segment to it, and only then paint it. This performs
    // much better than painting each segment one after the other.
    for (const [c, color] of this.#colors.entries()) {
      const end = Math.min((c + 1) * this.#colorSize, total);
      ctx.beginPath();
      ctx.strokeStyle = color;
      for (let i = c * this.#colorSize; i < end; i++) {
        if (Math.random() < NEW_SEED_CREATION_PROBABILITY * frames) {
          [pointsX[i], pointsY[i]] = this.#getSeedPosition(normalRand);
          continue;
        }
        const oldX = pointsX[i];
        const oldY = pointsY[i];
        const field = this.#fieldAt(oldX, oldY);

        // The particle moves perpendicular to the field.
        const newX = oldX - step * field.y;
        const newY = oldY + step * field.x;

        // If the field is weak, reduce the probability to draw a shadow. Shadows are
        // drawn once per frame, so scale it by the time the frame covers, to keep the
        // same amount of shadows whatever the framerate and the speed.
        this.#drawShadowAtPoint[i] =
          Math.random() <= (field.x * field.x + field.y * field.y) * frames;

        ctx.moveTo(oldX, oldY);
        ctx.lineTo(newX, newY);
        pointsX[i] = newX;
        pointsY[i] = newY;
      }
      ctx.stroke();
    }

    if (this.config.svg) {
      for (let p = 0; p < total; p++) {
        this.#svgPaths[p] += `L${pointsX[p]} ${pointsY[p]} `;
      }
    }

    // Every shadow of this frame in one path, so that they are all filled in one call.
    const shadowSize = SHADOW_SIZE * this.#pixelRatio * this.config.shadow_scale;
    const shadowRadius = SHADOW_RADIUS_RATIO * shadowSize;
    // The shadow is centered where the sprite that it replaces used to be centered.
    const shadowOffsetX = shadowSize / 2 - SHADOW_OFFSET_X * this.#pixelRatio;
    const shadowOffsetY = shadowSize / 2 - SHADOW_OFFSET_Y * this.#pixelRatio;

    ctx.globalAlpha = SHADOW_OPACITY;
    ctx.fillStyle = SHADOW_COLOR;
    ctx.beginPath();
    for (let i = 0; i < total; i++) {
      if (this.#drawShadowAtPoint[i]) {
        const x = pointsX[i] + shadowOffsetX;
        const y = pointsY[i] + shadowOffsetY;
        // Start a new subpath: without it, "arc" joins this circle to the previous one.
        ctx.moveTo(x + shadowRadius, y);
        ctx.arc(x, y, shadowRadius, 0, 2 * Math.PI);
      }
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /**
   * Normalized vector of the field at a given point.
   * @returns {{x: number, y: number}} A vector reused across calls, do not keep a reference to it.
   */
  #fieldAt(x, y) {
    let ux = 0;
    let uy = 0;

    for (const attractor of this.#attractors) {
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

    // If we are near a special attractor, add its contribution to the field.
    if (this.#isNearSpecialAttractor(x, y)) {
      const closest = this.#findClosestPointOnSpecialAttractor(x, y);
      const { direction = 1, type, impactDistance } = closest.attractor;
      let textUx = direction * (x - closest.originX);
      let textUy = direction * (y - closest.originY);
      const textNorm = Math.sqrt(textUx * textUx + textUy * textUy);
      textUx /= textNorm;
      textUy /= textNorm;

      // Combine both fields.
      let textWeight;
      if (type === 'cos') {
        textWeight =
          closest.distance < impactDistance
            ? 0.5 * (1 + Math.cos((Math.PI * closest.distance) / impactDistance))
            : 0;
      } else {
        textWeight = Math.exp(
          (-1 * closest.distance * closest.distance) / (impactDistance * this.#d * this.#d),
        );
      }

      ux = (1 - textWeight) * ux + textWeight * textUx;
      uy = (1 - textWeight) * uy + textWeight * textUy;
    }

    this.#field.x = ux;
    this.#field.y = uy;
    return this.#field;
  }

  #isNearSpecialAttractor(x, y) {
    const near = this.#d / 8;

    return this.#specialAttractorBoxes.some(
      ({ topLeft, bottomRight }) =>
        x > topLeft.x - near &&
        x < bottomRight.x + near &&
        y > topLeft.y - near &&
        y < bottomRight.y + near,
    );
  }

  #isInNoGoZone(x, y) {
    return this.#noGoBoxes.some(
      ({ topLeft, bottomRight }) =>
        x > topLeft.x && x < bottomRight.x && y > topLeft.y && y < bottomRight.y,
    );
  }

  /**
   * Finds the point closest to `x, y` on any special attractor segment.
   * @returns {{distance: number, attractor: object, originX: number, originY: number}}
   *   An object reused across calls, do not keep a reference to it.
   */
  #findClosestPointOnSpecialAttractor(x, y) {
    const closest = this.#closest;
    closest.attractor = null;
    // Squared distance to the closest point found so far. Comparing squared distances
    // gives the same winner as comparing distances, for a single square root at the end
    // instead of one per segment.
    let closestDistance2 = Infinity;

    for (const attractor of this.#specialAttractors) {
      const { x1, y1, dx, dy } = attractor;

      // Position of the projection of (x, y) on the segment, clamped to its ends.
      let t = ((x - x1) * dx + (y - y1) * dy) * attractor.invLength2;
      if (t > 1) {
        t = 1;
      } else if (t < 0) {
        t = 0;
      }

      const originX = x1 + dx * t;
      const originY = y1 + dy * t;
      const errorX = originX - x;
      const errorY = originY - y;
      const distance2 = errorX * errorX + errorY * errorY;
      if (distance2 < closestDistance2) {
        closestDistance2 = distance2;
        closest.attractor = attractor;
        closest.originX = originX;
        closest.originY = originY;
      }
    }

    closest.distance = Math.sqrt(closestDistance2);
    return closest;
  }

  /**
   * Picks a position for a new particle, outside of the no go zones.
   * @param {() => number} random Function returning a number between 0 and 1.
   * @param {number} [sizeRatio] Scaling factor outside of which nothing will be used.
   */
  #getSeedPosition(random, sizeRatio = 1) {
    for (;;) {
      const x = random() * this.#width * sizeRatio + (this.#width * (1 - sizeRatio)) / 2;
      const y = random() * this.#height * sizeRatio + (this.#height * (1 - sizeRatio)) / 2;
      if (!this.#isInNoGoZone(x, y)) {
        return [x, y];
      }
    }
  }

  #addPoint(x, y) {
    this.#pointsX.push(x);
    this.#pointsY.push(y);
  }

  /** @param {number} particuleDensity Number of particles for a square of 1000 * 1000 pixels. */
  #initPoints(particuleDensity) {
    // For a device with a higher pixel ratio, put more particles, but not
    // pixelRatio * pixelRatio more of them, for performance reasons.
    const count =
      (this.#pixelRatio * particuleDensity * this.#screenWidth * this.#screenHeight) / 1000000;
    for (let i = 0; i < count; i++) {
      this.#addPoint(...this.#getSeedPosition(normalRand, this.config.init_scale));
    }
  }

  #initAttractors(count, min, max) {
    this.#attractors = [];

    const minRadius = min * this.#d;
    const maxRadius = max * this.#d;

    for (let a = 0; a < count; a++) {
      const attractor = {
        x: Math.random() * (this.#width - 1),
        y: Math.random() * (this.#height - 1),
        weight: Math.random() * 2 - 1,
        radius: Math.random() * (maxRadius - minRadius) + minRadius,
      };
      this.#attractors.push(attractor);

      if (this.config.debug) {
        this.#drawHelperCircle(
          attractor.x,
          attractor.y,
          Math.abs(100 * attractor.weight),
          attractor.weight > 0 ? 'green' : 'red',
        );
      }
    }
  }

  #addSpecialAttractor(x1, y1, x2, y2, impactDistance, type, direction) {
    // `dx`, `dy` and `invLength2` describe the segment as `(x1, y1) + t * (dx, dy)`, with
    // `t` between 0 and 1. They only depend on the segment, so they are computed once here
    // rather than for every particle of every frame, in the render loop.
    const dx = x2 - x1;
    const dy = y2 - y1;
    this.#specialAttractors.push({
      x1,
      y1,
      dx,
      dy,
      invLength2: 1 / (dx * dx + dy * dy),
      impactDistance,
      type,
      direction,
    });
    if (this.config.debug) {
      this.#drawHelperCircle(x1, y1, 1);
    }
  }

  /** Turns the text's outline into special attractors, and seeds particles along it. */
  #initTextSpecialAttractors() {
    const config = this.config;
    const impactDistance = config.textGaussianImpactDistance * this.#pixelRatio;
    const fontSize = this.#width / config.text_width_ratio;
    const path = this.#font.getPath(config.text, 0, 0, fontSize);
    const commands = path.commands;

    // Bounding box of the text path.
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
    const textX = (this.#width * config.text_position_x) / 100 - textWidth / 2;
    const textY = (this.#height * config.text_position_y) / 100 + textHeight / 2;

    this.#specialAttractorBoxes.push({
      topLeft: {
        x: (this.#width * config.text_position_x) / 100 - textWidth / 2,
        y: (this.#height * config.text_position_y) / 100 - textHeight / 2,
      },
      bottomRight: {
        x: (this.#width * config.text_position_x) / 100 + textWidth / 2,
        y: (this.#height * config.text_position_y) / 100 + textHeight / 2,
      },
    });

    if (config.debug) {
      this.#font.drawPoints(this.#ctx, config.text, textX, textY, fontSize);
    }

    const subdiviseBezier = textWidth > TEXT_MIN_WIDTH_TO_SUBDIVISE;
    let probabilityPointAppearsNearText = PROBABILITY_POINT_APPEARS_NEAR_TEXT;
    if (subdiviseBezier) {
      probabilityPointAppearsNearText /= 2;
    }

    const useCommand = config.text === CLEAN_PATH_TEXT ? cleanPathCommands() : null;

    for (let c = 0; c < commands.length - 1; c++) {
      if (useCommand && !(useCommand[c] && useCommand[c + 1])) {
        continue;
      }

      const from = commands[c];
      const to = commands[c + 1];
      let type = to.type;
      if (!subdiviseBezier && (type === 'C' || type === 'Q')) {
        type = 'L';
      }

      // Add points near the text.
      if (Math.random() < probabilityPointAppearsNearText) {
        this.#addPoint(
          textX + from.x + Math.random() - 0.5,
          textY + from.y + Math.random() - 0.5,
        );
      }

      switch (type) {
        case 'L': {
          this.#addSpecialAttractor(
            textX + from.x,
            textY + from.y,
            textX + to.x,
            textY + to.y,
            impactDistance,
          );
          // If this is a real line, and not a flattened curve, seed a particle on it.
          if (to.type === 'L') {
            this.#addPoint(
              textX + from.x + Math.random() - 0.5,
              textY + from.y + Math.random() - 0.5,
            );
          }
          break;
        }
        case 'Q': {
          const [midX] = bezier([1 / 2], [from.x, to.x1, to.x]);
          const [midY] = bezier([1 / 2], [from.y, to.y1, to.y]);
          this.#addSpecialAttractor(
            textX + from.x,
            textY + from.y,
            textX + midX,
            textY + midY,
            impactDistance,
          );
          this.#addSpecialAttractor(
            textX + midX,
            textY + midY,
            textX + to.x,
            textY + to.y,
            impactDistance,
          );
          break;
        }
        case 'C': {
          const ts = [1 / 3, 2 / 3];
          const xs = bezier(ts, [from.x, to.x1, to.x2, to.x]);
          const ys = bezier(ts, [from.y, to.y1, to.y2, to.y]);
          this.#addSpecialAttractor(
            textX + from.x,
            textY + from.y,
            textX + xs[0],
            textY + ys[0],
            impactDistance,
          );
          this.#addSpecialAttractor(
            textX + xs[0],
            textY + ys[0],
            textX + xs[1],
            textY + ys[1],
            impactDistance,
          );
          this.#addSpecialAttractor(
            textX + xs[1],
            textY + ys[1],
            textX + to.x,
            textY + to.y,
            impactDistance,
          );
          break;
        }
        default: // "M" and "Z" do not create attractors.
      }
    }
  }

  /** Creates a circular no go zone. */
  #createNoGoCircle(x, y, radius, impactDistance, type, direction) {
    const steps = (radius * SUBDIVISE_NOGO) / 20;
    const pixelRatio = this.#pixelRatio;
    const pointOnCircle = (i) => [
      (x + radius * Math.cos(((2 * Math.PI) / steps) * i)) * pixelRatio,
      (y + radius * Math.sin(((2 * Math.PI) / steps) * i)) * pixelRatio,
    ];

    for (let i = 0; i < steps; i++) {
      this.#addSpecialAttractor(
        ...pointOnCircle(i),
        ...pointOnCircle(i + 1),
        impactDistance * pixelRatio,
        type,
        direction,
      );
    }

    this.#addNoGoBox(
      { x: (x - radius) * pixelRatio, y: (y - radius) * pixelRatio },
      { x: (x + radius) * pixelRatio, y: (y + radius) * pixelRatio },
    );
  }

  #addNoGoBox(topLeft, bottomRight) {
    const box = { topLeft, bottomRight };
    this.#specialAttractorBoxes.push(box);
    this.#noGoBoxes.push(box);
  }

  #initNoGoCirclesSpecialAttractors() {
    for (const circle of this.config.nogoCircles ?? []) {
      this.#createNoGoCircle(
        circle.x,
        circle.y,
        circle.radius,
        circle.impactDistance || DEFAULT_IMPACT_DISTANCE,
        circle.type,
        circle.direction,
      );
    }
  }

  /** Creates a rounded rectangular no go zone from `config.nogoParam`. */
  #initNoGoZoneSpecialAttractors() {
    const { nogoParam } = this.config;
    if (!nogoParam) {
      return;
    }

    const pixelRatio = this.#pixelRatio;
    const left = nogoParam.x * pixelRatio;
    const top = nogoParam.y * pixelRatio;
    const right = (nogoParam.x + nogoParam.width) * pixelRatio;
    const bottom = (nogoParam.y + nogoParam.height) * pixelRatio;

    // Define the no go zone via its four corners.
    const corners = [
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
    ];
    const n = corners.length;

    // Compute the Bezier handles, so that the corners are rounded.
    for (let i = 0; i < n; i++) {
      const previous = corners[(i - 1 + n) % n];
      const corner = corners[i];
      const next = corners[(i + 1) % n];
      const l = Math.hypot(next.x - previous.x, next.y - previous.y);
      const l1 = Math.hypot(corner.x - previous.x, corner.y - previous.y);
      const l2 = Math.hypot(next.x - corner.x, next.y - corner.y);
      corner.x1 = corner.x + ((l1 / 3) * (previous.x - next.x)) / l;
      corner.x2 = corner.x + ((l2 / 3) * (next.x - previous.x)) / l;
      corner.y1 = corner.y + ((l1 / 3) * (previous.y - next.y)) / l;
      corner.y2 = corner.y + ((l2 / 3) * (next.y - previous.y)) / l;
    }

    const topLeft = { x: Infinity, y: Infinity };
    const bottomRight = { x: -Infinity, y: -Infinity };

    // Subdivise the Bezier curves to create the segments.
    for (let i = 0; i < n; i++) {
      const start = corners[i];
      const end = corners[(i + 1) % n];
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      const steps = Math.ceil(length / SUBDIVISE_NOGO);
      const ts = Array.from({ length: steps }, (_, k) => k / (steps - 1));
      const xs = bezier(ts, [start.x, start.x2, end.x1, end.x]);
      const ys = bezier(ts, [start.y, start.y2, end.y1, end.y]);

      for (let j = 0; j < steps - 1; j++) {
        this.#addSpecialAttractor(
          xs[j],
          ys[j],
          xs[j + 1],
          ys[j + 1],
          this.config.noGoImpactDistance * pixelRatio,
          this.config.nogoZoneType,
        );

        topLeft.x = Math.min(topLeft.x, xs[j]);
        topLeft.y = Math.min(topLeft.y, ys[j]);
        bottomRight.x = Math.max(bottomRight.x, xs[j]);
        bottomRight.y = Math.max(bottomRight.y, ys[j]);
      }
    }

    this.#addNoGoBox(topLeft, bottomRight);
  }

  #drawHelperCircle(centerX, centerY, radius, fillStyle = 'green') {
    const ctx = this.#ctx;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#003300';
    ctx.stroke();
  }

  /**
   * Serializes what has been rendered so far as an SVG document.
   * Requires `config.svg` to be true.
   * @returns {string}
   */
  toSVG() {
    const { one_path: onePath, line_width: lineWidth, background_color: background } = this.config;

    const pathStart = (particle = 0) => {
      const color = this.#colors[Math.floor(particle / this.#colorSize)];
      return `<path fill='none' stroke='${color}' stroke-width='${lineWidth * this.#pixelRatio}' d='`;
    };
    const pathEnd = "' />\n";

    let svg =
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${this.#width} ${this.#height}' ` +
      `width='${this.#width}' height='${this.#height}' style='background-color: ${background};'>\n`;

    if (onePath) {
      svg += pathStart();
    }
    for (let p = 0; p < this.#svgPaths.length - 1; p++) {
      if (!onePath) {
        svg += pathStart(p);
      }
      // Paths are stored as a list of "L" commands, the first one starts the path.
      svg += `M${this.#svgPaths[p].substring(1)}`;
      if (!onePath) {
        svg += pathEnd;
      }
    }
    if (onePath) {
      svg += pathEnd;
    }

    return `${svg}</svg>`;
  }

  /** Downloads what has been rendered so far as an SVG file. */
  saveSVG(fileName = 'attractors.svg') {
    download(this.toSVG(), fileName, 'image/svg+xml');
  }
}

/**
 * Commands of the text path to keep when rendering `CLEAN_PATH_TEXT`.
 * Each entry is the number of consecutive commands to keep, then to drop.
 */
function cleanPathCommands() {
  const runs = [
    [0, 1], [1, 3], [0, 2], // 1
    [1, 25], [0, 25], // 3
    [1, 34], [0, 35], // 8
    [0, 15], [1, 17], [0, 2], // 2
    [1, 18], // 0
    [0, 1], [1, 3], [0, 2], // 1
    [1, 21], [0, 21], // 6
  ];
  return runs.flatMap(([value, count]) => new Array(count).fill(value));
}

/** The instance created by the deprecated `start()` helper. */
let current = null;

/**
 * Starts a new render, stopping any previous one.
 * @deprecated Prefer `new Attractors(config).start()`.
 */
export function start(config) {
  current?.stop();
  current = new Attractors(config);
  return current.start();
}

/**
 * Downloads the render started by `start()` as an SVG file.
 * @deprecated Prefer `attractors.saveSVG()`.
 */
export function generateSVG() {
  current?.saveSVG();
}
