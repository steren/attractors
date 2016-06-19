# Attractors


## Configuration

These describe the attributes of the  `config` object that is expected from the library.

### Setup 
`id`: ID of the DOM canvas on which to paint

### Particles

`background_color`: Color to be used as background color. Expects a Canvas compatible color (example: `#57A3BD`)

`line_width`: Width of the particle strokes, in pixel.

`color1`: Color to be used for particle trails (example: '#DBCEC1')

`color2`: Secondary color to be used for particle trails (example: '#F7F6F5')

`shadow_scale`: Scale of the shadow, defaults to `1`. 

`nb_attractors`: Number of attractors in the piece

`particule_density`: Density of particle to create, for a square of 1000 * 1000.

`init_scale`:  The scale at which particles are initialized. 
1 means they will spread on an area the size of the screen. 
2 twice the size of the screen.
0.5 half the size of the screen.
 

### Text

`text`: String of text to display that will interact with particles

`text_position_x`

`text_position_y`

`text_width_ratio`

### Advanced rendering parameters 

`pixelratio`: Number of points in a screen pixel (example: Set to 2 on Retina screens). Defaults to `window.devicePixelRatio`


### No Go zones

`nogo_zone`: Boolean, if set to true, will instanciate areas without particles.

`nogoCircles` : Array of objects contaning data for empty circles.


### SVG Export

`svg`: If set to true, will keep an SVG version of the render in memory

`one_path`: If set to true, the created SVG will be stored into one single path.
