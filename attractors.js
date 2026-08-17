/**
 * Attractors — animated attractor fields painted on a <canvas>.
 *
 * This module is the public API, and all it does is glue: it reads the canvas from the
 * document, hands it over to a worker through `transferControlToOffscreen()`, and sends
 * it the configuration to render. Every computation — seeding the particles, building
 * the field, painting the frames — then happens off the main thread, in
 * `attractors-engine.js`, leaving the page free to answer clicks and keystrokes.
 *
 * Browsers that cannot transfer a canvas to a worker run the very same engine on the
 * main thread instead.
 *
 * @author annemenini
 * @author steren
 */

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
  /** Prefix to prepend to the asset URLs (fonts, shadow sprite). */
  root: '',
};

/**
 * Workers painting the pieces, one per canvas. A canvas can only be handed over to a
 * worker once, so every render of a given canvas goes through the same one.
 */
const workers = new WeakMap();

/** Whether this browser can hand the canvas over to a worker. */
function canUseWorker(canvas) {
  return typeof Worker === 'function' && typeof canvas.transferControlToOffscreen === 'function';
}

/**
 * URL of the opentype.js module, resolved through the import map of the page, if any.
 * Workers do not inherit that import map, so the module is resolved here, and its URL
 * passed to the worker. Without an import map, there is nothing to resolve: the worker
 * imports the bare specifier, which is what a bundler expects.
 */
function resolveOpentypeUrl() {
  try {
    return import.meta.resolve?.('opentype.js');
  } catch {
    return undefined;
  }
}

/** Starts the worker painting a given canvas, or returns the one already painting it. */
function getWorker(canvas) {
  const existing = workers.get(canvas);
  if (existing) {
    return existing;
  }

  const worker = new Worker(new URL('./attractors-worker.js', import.meta.url), {
    type: 'module',
  });
  const host = {
    worker,
    /** Canvas to transfer with the first render, `null` once it has been handed over. */
    offscreen: null,
    /** Messages waiting for an answer, by id. */
    pending: new Map(),
    lastId: 0,
  };

  worker.addEventListener('message', ({ data }) => {
    const request = host.pending.get(data.id);
    if (!request) {
      return;
    }
    host.pending.delete(data.id);
    if (data.error) {
      request.reject(new Error(data.error));
    } else {
      request.resolve(data.result);
    }
  });

  worker.addEventListener('error', (event) => {
    for (const request of host.pending.values()) {
      request.reject(new Error(event.message || 'The attractors worker failed'));
    }
    host.pending.clear();
  });

  // Transferring the canvas is what makes the worker able to paint it. Once transferred,
  // the main thread cannot draw on it anymore.
  host.offscreen = canvas.transferControlToOffscreen();
  workers.set(canvas, host);
  return host;
}

/** Sends a message to a worker, and resolves with the answer it sends back. */
function send(host, id, message, transfer = []) {
  return new Promise((resolve, reject) => {
    host.pending.set(id, { resolve, reject });
    host.worker.postMessage({ ...message, id }, transfer);
  });
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
  /** Worker painting the canvas, `null` when the piece runs on the main thread. */
  #host = null;

  /** Renderer, when the piece runs on the main thread rather than in a worker. */
  #renderer = null;

  /** Id of the message that started this render. */
  #startId = 0;

  #stopped = false;

  /** @param {Partial<typeof DEFAULT_CONFIG>} config */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Loads the assets, seeds the particles and starts animating. */
  async start() {
    this.#stopped = false;

    const canvas = document.getElementById(this.config.id);
    if (!canvas) {
      throw new Error(`No canvas with id "${this.config.id}" in the document`);
    }

    // Everything the engine needs to know about the page: it has no DOM to read it from.
    const options = {
      config: this.config,
      screenWidth: canvas.clientWidth,
      screenHeight: canvas.clientHeight,
      baseUrl: new URL(this.config.root, document.baseURI).href,
      opentypeUrl: resolveOpentypeUrl(),
    };

    if (canUseWorker(canvas)) {
      const host = getWorker(canvas);
      this.#host = host;
      // The canvas travels with the first render only: it cannot be transferred twice.
      const offscreen = host.offscreen;
      host.offscreen = null;
      this.#startId = ++host.lastId;
      await send(
        host,
        this.#startId,
        { type: 'start', canvas: offscreen, ...options },
        offscreen ? [offscreen] : [],
      );
    } else {
      const { Renderer } = await import('./attractors-engine.js');
      // Another render may have been started while the module was loading.
      if (this.#stopped) {
        return this;
      }
      this.#renderer = new Renderer({ canvas, ...options });
      await this.#renderer.start();
    }

    return this;
  }

  /** Stops animating. */
  stop() {
    this.#stopped = true;
    this.#renderer?.stop();
    // The worker keeps animating if another render has replaced this one since.
    this.#host?.worker.postMessage({ type: 'stop', startId: this.#startId });
  }

  /**
   * Serializes what has been rendered so far as an SVG document.
   * Requires `config.svg` to be true.
   * @returns {Promise<string>} The document, read back from the worker.
   */
  async toSVG() {
    if (this.#renderer) {
      return this.#renderer.toSVG();
    }
    if (!this.#host) {
      throw new Error('Nothing has been rendered yet, call start() first');
    }
    return send(this.#host, ++this.#host.lastId, { type: 'svg' });
  }

  /** Downloads what has been rendered so far as an SVG file. */
  async saveSVG(fileName = 'attractors.svg') {
    download(await this.toSVG(), fileName, 'image/svg+xml');
  }
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
  return current?.saveSVG();
}
