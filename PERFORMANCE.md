# Performance evaluation

Where the time of a frame goes, and what a drastic improvement — WebGL among others —
would actually buy.

Every number below is measured, on a headless Chromium at 1440 x 900 with a pixel ratio of
2. The benchmarks themselves are not checked in: they patch the render loop to drive it by
hand and stub parts of the canvas, which is throwaway code, not something to maintain
alongside the library.

## Summary

Painting the shadows and evaluating the field are the whole cost of a frame. Both can be
made much cheaper **without leaving the canvas 2D context**:

- **Done.** The shadows used to be painted as 2083 images a frame. They are a black blob,
  so they are filled circles now — every one of them in a single path, filled once. On the
  real piece the frame went from 22.7 ms to 5.4 ms, for a render that is hard to tell
  apart from the old one.
- The field is evaluated for every particle of every frame, though it never changes after
  initialization. Baking it into a grid once is a **20x win** on the JavaScript side, for
  about sixty lines.

Switching to WebGL is worth it for one reason only: it is the only way to go far past
today's particle count, because it removes the per-particle JavaScript loop altogether. It
is not the way to make the current piece cheaper — the current piece is not GPU bound.

Suggested order: bake the field, then cut the number of shadow draws, then re-measure on
real hardware. Consider WebGL only if the goal is ten times more particles.

## How this was measured

A frame is driven by hand rather than by `requestAnimationFrame`, so that the timings
cover the work of the library and not the compositing of the page. Parts of the render are
turned off one at a time; the difference is the cost of the part.

Default configuration, text `A T T R A C T O R S`, a 1440 x 900 screen at a pixel ratio of
2 — a 2880 x 1800 canvas, 2435 particles, 2083 shadows and 25 attractors per frame.

**The machine these numbers come from has no GPU.** Chromium runs on SwiftShader, which
rasterizes on the CPU. What transfers to a real machine is the CPU side: the JavaScript,
the number of draw calls and the cost of submitting them. What does not transfer is
rasterization — filling pixels costs the CPU here what a GPU does essentially for free.
Every rasterization-bound number below is called out as such.

## Where a frame goes

Before the shadow change, which is what made the case for it:

| Part of the frame | ms / frame | Share |
| --- | ---: | ---: |
| Shadows — 2083 `drawImage` calls | 30.9 | 80% |
| Field math — 2435 evaluations | 5.1 | 13% |
| Canvas call overhead, rest of the loop | 2.1 | 5% |
| Trails — 2435 segments in 2 batched paths | 0.6 | 2% |
| **Total** | **38.7** | 26 fps |

Batching the trails into one path per color, as the render loop already does, works: the
trails are the cheapest part of the frame. The two costly parts are the shadows and the
field.

### The field: the text dominates

Timing the JavaScript alone, with the canvas replaced by a stub:

| Scenario | ms / frame |
| --- | ---: |
| Everything | 5.06 |
| Without the text | 1.80 |
| Without the text and the attractors | 0.24 |

So the 25 gaussian attractors cost 1.6 ms, and the text costs 3.3 ms — 64% of the field
math. The reason is in `#findClosestPointOnSpecialAttractor`: every particle near the text
projects itself onto **every** segment of the text outline, and this text has over a
hundred of them. The cost is `particles x segments` per frame, and it grows with the
length of the text.

### The shadows: bound by the number of calls, not by their size

Shrinking the sprite, keeping the same 2083 calls per frame:

| Shadow size | ms / frame |
| --- | ---: |
| 32 px (the default at a pixel ratio of 2) | 32.5 |
| 16 px | 18.8 |
| 8 px | 12.4 |
| 2 px | 9.2 |

The curve flattens at 9.2 ms, which is what 2083 `drawImage` calls cost when they fill
almost nothing: **4.4 microseconds per call, spent before a single pixel is touched.** The
rest is fill, and fill is the part a real GPU does for free.

Drawing the sprite at its natural size instead of scaling it changes nothing (18.6 ms
against 18.8 ms at an equal output size), so there is no free win in the asset. What costs
is the call count and the covered area.

## Option A — bake the field into a grid

**The field never changes.** `#fieldAt` reads the attractors and the text segments, and
neither ever moves after `#initialize`. Yet it is re-evaluated from scratch for every
particle of every frame — today, 2435 times a frame, forever, for a function whose answer
is fixed.

Evaluating it once per cell of a grid and interpolating it afterwards, on the attractors
and text segments of a real render:

| Grid spacing | Build | Memory | ms / frame | Speedup | Angle error (median) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Evaluated per particle (today) | — | — | 2.67 | — | — |
| 4 px | 315 ms | 2.49 MB | 0.132 | 20x | 0.17° |
| 8 px | 76 ms | 0.63 MB | 0.119 | 22x | 0.37° |
| 16 px | 20 ms | 0.16 MB | 0.115 | 23x | 0.74° |
| 32 px | 5 ms | 0.04 MB | 0.114 | 23x | 1.56° |

Read the speedup, not the absolute times: this runs in Node against a rebuilt copy of the
field, slightly cheaper than the real one. In the browser it turns 5.1 ms of field math
into roughly 0.25 ms.

The lookup is flat across spacings — it is four array reads and a lerp either way — so the
grid should be as fine as the build time allows. At 16 px the build costs 20 ms, which
matters because the page re-initializes on every click, resize and keystroke.

On accuracy: the median error is a fraction of a degree, but 1% of the canvas is off by
more. Those points sit where the exact field is genuinely discontinuous — on the axis
equidistant from two text strokes, and at the centre of an attractor, where the direction
flips. Interpolation smooths that flip over one cell instead of making it instant. The
piece is chaotic and seeded randomly, so no change is pixel-identical anyway; this one is
a one-cell-wide smoothing at the places where the field tears.

Cost: about sixty lines, no API change, no new asset. It also subsumes the text problem —
the segment scan disappears into the build — and the grid is exactly the texture a GPU
implementation would need later.

## Option B — draw the shadows without an image (done)

This one is implemented: `#render` fills circles, and the sprite is gone.

The shadow sprite was a black radial blob: no color, no detail, a peak alpha of 29/255 and
a mean of 8.9/255. A filled circle draws the same thing — and every circle of the frame
can go into **one path, filled once**, instead of 2083 `drawImage` calls.

Measured on the real piece, 600 frames, the same seed in every mode:

| Shadows | ms / frame | The shadow pass | Darkening |
| --- | ---: | ---: | ---: |
| 2083 `drawImage` (before) | 22.65 | 18.26 | 16.2 |
| One filled path, radius 6 px, alpha 0.0034 | 5.36 | 0.97 | 15.3 |
| Two concentric filled paths | 6.69 | 2.30 | 11.1 |
| No shadows at all | 4.39 | — | — |

**The shadow pass gets 19x cheaper, and the whole frame 4.2x.** At three times the
density — 7300 particles — the frame goes from 75.7 ms to 16.6 ms. Unlike the sprite
sizes above, this is not a software-rasterizer artifact: it removes 2082 draw calls, which
is CPU work on every machine.

### The catch: 8 bit rounding decides everything

The first attempt drew **nothing at all** — a render pixel for pixel identical to no
shadows — while looking 19x faster in the timings.

The canvas holds 8 bit colors. A stamp of alpha `a` over a destination `d` leaves
`d * (1 - a)`, which rounds back to `d` unless `a` is larger than about `0.5 / d` — near
0.003 on this background. Sizing the circle to lay down as much ink as the sprite gives an
alpha of 0.0013, and every single stamp rounds away.

The sprite escapes this by a hair: its peak alpha, 29/255 at an opacity of 0.03, is 0.0034
— just over the line. Its faint outer ring is under it and contributes nothing. So **the
sprite behaves like a small hard disc**, not like the soft 32 px blob it looks like, and
the piece darkens by one unit per stamp wherever the sprite's core lands.

Two things follow. Matching the *ink* of the sprite is the wrong calibration; matching the
*area above the rounding threshold* is the right one — a circle of radius 6 px at alpha
0.0034, five times smaller than the sprite's footprint. And the accumulation is
self-limiting: as an area darkens, `0.5 / d` rises, and stamps stop registering. That is
where the soft look comes from, and a filled circle keeps it, because it is a property of
the blending and not of the sprite.

### How close it looks

Against the sprite render, the single filled path differs by a mean of 5.2/255 per
channel; no shadows at all differs by 16.2. Side by side the two are hard to tell apart —
the relief the shadows give the piece is fully there. The two-layer version is both
further off (6.7) and more expensive, so the flat disc wins.

One behavioral difference worth knowing: circles that overlap inside a single path are
filled once, not stacked, so a dense cluster of particles darkens less than it does with
2083 independent stamps. That is what the remaining 6% of darkening is. It can be
compensated with a slightly larger radius, and it is arguably the better behavior.

Two smaller variants, for the record: halving the number of shadows and doubling
`SHADOW_OPACITY` halves the cost of the sprite version on any machine, and shrinking the
sprite saves fill that a real GPU gives away for free (32 px to 16 px is 14 ms here, and
close to nothing on a GPU-rasterized canvas).

## Option C — WebGL

What it would change, in one line: **2085 draw calls per frame become 3**, and the
per-particle JavaScript loop disappears.

A faithful port looks like this. The baked field of option A becomes an `RG16F` texture. A
transform-feedback pass advances every particle in a vertex shader, sampling that texture —
no JavaScript touches a particle. A second pass draws one quad per particle as a trail,
and a third draws the shadows as point sprites, both into a framebuffer that is never
cleared, which is what already happens with the canvas today.

What it buys:

- The particle count stops being bound by JavaScript. Today a particle costs 2.1 µs of
  JavaScript per frame, so 10k particles alone would spend 21 ms a frame before painting
  anything. On the GPU, 50k particles is not meaningfully harder than 2.4k.
- Fill becomes free, which matters for the shadows.
- The field could even be sampled analytically in the shader rather than baked, removing
  the build cost.

What it costs:

- **The line width is the risk.** `line_width` defaults to 0.35 CSS pixels — 0.7 device
  pixels at a pixel ratio of 2. The look of this piece is sub-pixel antialiased strokes
  laid down thousands of times. WebGL line primitives are one pixel wide and aliased, so
  trails have to be quads with coverage-based alpha, tuned to match what Skia does. This is
  where a port succeeds or fails visually.
- **Accumulation in 8 bits.** Shadows land at an alpha of 0.03, or about 7.6 of 255. Skia
  and a GL blend do not round that identically, and the piece stacks thousands of those.
  An `RGBA16F` framebuffer avoids the drift, at twice the memory.
- **The SVG export needs positions on the CPU.** `config.svg` records every particle every
  frame. A GPU simulation would have to read them back — a stall — so that path keeps a CPU
  copy, or keeps the CPU simulation when `svg` is on.
- Debug helpers, the opentype text path and the no-go zones stay on the CPU.
- Context loss has to be handled; a canvas 2D context never dies.
- Realistically 400 to 600 lines of new code, and either two render paths to maintain or a
  hard break for anyone using the library today.

**This machine cannot decide it.** For the record, the same primitives through WebGL 2
here: 57 ms for the shadows against 32 ms for the canvas, and 6 ms for the trails against
1 ms. That is SwiftShader rasterizing on the CPU with no GPU behind it, and it says nothing
about a real machine — it does show that WebGL is not a free win when there is no GPU, which
includes machines that blocklist it and fall back to software.

The one number that does transfer: at 10000 particles with fill removed, one WebGL draw
call costs 17 ms against 39 ms for 8550 `drawImage` calls — and the WebGL figure still
includes packing the vertices in JavaScript every frame, which a transform-feedback
implementation would not pay. The advantage is in the call count, and it grows with the
particle count.

## Option D — WebGPU

Same reasoning as WebGL, with a compute shader for the particle pass instead of transform
feedback, which is cleaner. Not worth it today: it drops Safari before 26 and every browser
on older hardware, for a piece whose particle pass is not the bottleneck once option A
lands.

## Recommendation

1. ~~**Fill circles instead of drawing the shadow sprite**~~ (option B). Done: 19x on the
   largest cost of the frame, 2082 fewer draw calls, and the look holds up. Watch the 8 bit
   rounding if the constants are ever retuned — calibrate the radius against the render,
   not against the ink of the sprite.
2. **Bake the field** (option A). 20x on the field math, no API change, no visual risk
   beyond a one-cell smoothing, and it is the prerequisite for any GPU version later.
   After step 1 the field is what is left: at three times the density, 13.8 ms of the
   16.6 ms frame.
3. **Re-measure on real hardware.** The split between the two remaining costs —
   JavaScript and draw calls — decides whether anything else is needed.
4. **WebGL only for scale.** If the goal is 50k particles rather than 2.4k, it is the right
   tool and the baked field is already the input it needs. If the goal is a smoother 60 fps
   at today's density, steps 1 and 2 get there for a fraction of the work and none of the
   fidelity risk.
