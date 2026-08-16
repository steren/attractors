# Attractors

<img width="460" alt="large" src="https://user-images.githubusercontent.com/360895/35189698-a8d70dee-fe05-11e7-9886-3ba681b59be8.png">

Generative art: particles flowing through a field of attractors, painted on a `<canvas>`.

See this [playlist of examples on Youtube](https://www.youtube.com/watch?v=8Xckh9zVzU4&list=PL7Bq7_PxIAiCJ3yCgzGKgErZpBk7ipZ0I).

## Running the page

The site is made of static files, no build step required:

```sh
npm start
```

Then open http://localhost:3000. Click anywhere to render a new piece, type to change
the text, and use the gear in the bottom right corner to toggle the control panel.
The current configuration is stored in the URL, so any render can be shared as a link.

## Using as a library

Install with `npm install attractors`, then add a canvas to your page:

```html
<canvas id="paint-canvas"></canvas>
```

```js
import { Attractors } from 'attractors';

const attractors = new Attractors({
  id: 'paint-canvas',
  text: 'A T T R A C T O R S',
  background_color: '#57A3BD',
});

await attractors.start();
```

`start()` loads the assets, seeds the particles and animates until `stop()` is called.
Every option that is not provided falls back to the exported `DEFAULT_CONFIG`.

Fonts and the shadow sprite are loaded relative to the page. When the package is
installed in `node_modules`, point the library at it with the `root` option:

```js
new Attractors({ root: 'node_modules/attractors/' });
```

The text rendering uses [opentype.js](https://github.com/opentypejs/opentype.js), which is
imported dynamically, and only when the `text` option is set. Without a bundler, map the
import to a copy of the library:

```html
<script type="importmap">
{ "imports": { "opentype.js": "./lib/opentype.mjs" } }
</script>
```

## Configuration

### Setup

`id`: ID of the DOM canvas on which to paint

`root`: prefix to prepend to the asset URLs (fonts, shadow sprite)

### Particles

`background_color`: color to be used as background color. Expects a canvas compatible color (example: `#57A3BD`)

`line_width`: width of the particle strokes, in pixels

`color1`: color to be used for particle trails (example: `#DBCEC1`)

`color2`: secondary color to be used for particle trails (example: `#F7F6F5`)

`shadow_scale`: scale of the shadow, defaults to `1`

`nb_attractors`: number of attractors in the piece

`particule_density`: density of particles to create, for a square of 1000 * 1000 pixels

`init_scale`: the scale at which particles are initialized.
`1` means they spread over an area the size of the screen, `2` twice the size of the
screen, `0.5` half the size of the screen.

`speed`: speed of the animation, defaults to `1`. `2` plays the very same animation
twice as fast, `0.5` twice as slow, `0` freezes it. The animation is independent of the
framerate, so a given speed looks the same on any display.

### Text

`text`: string of text to display, that particles will flow around. The font has no glyph
for `▲` and `⬣`, so the library draws them itself, as a triangle and a hexagon as tall as
a capital letter

`text_position_x`, `text_position_y`: position of the text, in percent of the canvas

`text_width_ratio`: the text is `1 / text_width_ratio` as wide as the canvas

### Advanced rendering parameters

`pixelratio`: number of points in a screen pixel (example: set to `2` on Retina screens).
Defaults to `window.devicePixelRatio`.

`debug`: draws helpers showing where the attractors are

### No go zones

`nogo_zone`: boolean, if set to true, will instanciate areas without particles

`nogoParam`: `{x, y, width, height}` of a rectangular area without particles

`nogoCircles`: array of `{x, y, radius}` circles without particles

### SVG export

`svg`: if set to true, keeps an SVG version of the render in memory

`one_path`: if set to true, the created SVG is stored into one single path

Call `attractors.toSVG()` to get the document, or `attractors.saveSVG()` to download it.

## Development

`lib/` holds the browser builds of the dependencies, so that the page runs without a build
step. Refresh them with:

```sh
npm install
npm run vendor
```
