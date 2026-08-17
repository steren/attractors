# Benchmarks

Measurements behind `PERFORMANCE.md`. Serve the repository, then open the pages or run
the script:

```sh
npx http-server -p 4173 -c-1 .   # `npm start` also works, but drops the query strings
```

## `bench.html` — where a frame goes

Renders the default piece and drives the render loop by hand, so that the measurement
covers the work of the library and not the compositing of the page. The result lands in
`window.__benchResult`.

Query parameters: `frames`, `text=0` (no special attractors), `stroke=0` (no trails),
`shadow=0` (no shadows), `canvas=0` (stub context, nothing is painted at all),
`dpr`, `density`, `attractors`, `speed`.

Turning one part off at a time gives its cost:

| Scenario | Query |
| --- | --- |
| everything | `?frames=60` |
| without the shadows | `?frames=60&shadow=0` |
| without the trails | `?frames=60&stroke=0` |
| the JavaScript alone | `?frames=200&canvas=0` |
| the JavaScript, without the text | `?frames=200&canvas=0&text=0` |

## `render.html` — canvas 2D against WebGL 2

Paints what a frame paints — one short line per particle, one shadow sprite for most of
them — through the canvas 2D context and through WebGL 2, and times both. Also times two
other ways of painting the shadows: at the natural size of the sprite, and as one batched
path instead of one sprite per particle.

Query parameters: `particles`, `size` (shadow size, in device pixels), `frames`.

## `field.mjs` — evaluating the field against baking it

```sh
node bench/field.mjs
```

Rebuilds the attractors and the text segments of a real render, then compares evaluating
the field for every particle of every frame, as the library does today, against baking it
into a grid once and interpolating it. Reports the build time, the memory, the time per
frame and how far the baked field is from the real one.
