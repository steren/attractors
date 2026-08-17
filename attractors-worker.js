/**
 * Worker running the attractors engine off the main thread.
 *
 * It owns the `OffscreenCanvas` transferred by `attractors.js` on the first render, and
 * from then on every render happens here: seeding the particles, computing the field and
 * painting the frames. The main thread only sends configurations and reads the SVG back.
 *
 * Messages it understands, all sent by `attractors.js`:
 *   - `{type: 'start', id, canvas?, config, screenWidth, screenHeight, baseUrl, opentypeUrl}`
 *     renders a new piece, replacing the one being animated. The canvas comes with the
 *     first message only, as it can only be transferred once.
 *   - `{type: 'stop', startId}` stops animating, if the render `startId` started is the
 *     one currently animating.
 *   - `{type: 'svg', id}` answers with the SVG of what has been rendered so far.
 *
 * Every message carrying an `id` is answered with `{id, result}` or `{id, error}`.
 */
import { Renderer } from './attractors-engine.js';

/** Canvas transferred by the main thread, painted by every render. */
let canvas = null;

/** Renderer of the piece being animated. */
let renderer = null;

/** `id` of the message that started the current render. */
let startId = 0;

const handlers = {
  async start(message) {
    canvas = message.canvas ?? canvas;
    if (!canvas) {
      throw new Error('No canvas was transferred to the worker');
    }

    // Stop the previous render before starting a new one: both paint the same canvas.
    renderer?.stop();
    startId = message.id;
    renderer = new Renderer({ ...message, canvas });
    await renderer.start();
  },

  stop(message) {
    // A render that has already been replaced by another one has nothing to stop.
    if (message.startId === startId) {
      renderer?.stop();
    }
  },

  svg() {
    return renderer?.toSVG();
  },
};

self.addEventListener('message', async ({ data }) => {
  const handler = handlers[data.type];
  if (!handler) {
    return;
  }
  try {
    const result = await handler(data);
    if (data.id) {
      self.postMessage({ id: data.id, result });
    }
  } catch (error) {
    if (data.id) {
      self.postMessage({ id: data.id, error: error.message });
    } else {
      throw error;
    }
  }
});
