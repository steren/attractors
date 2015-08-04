var SIZE_SHADOW = 16;
var SHADOW_IMAGE = 'shadow-o02-ellipse-'
var DELTA_SHADOW_X = 1;
var DELTA_SHADOW_Y = 1;
var NB_ATTRACTORS = 25;
/** number of particule for a square of 1000 * 1000 pixels */ 
var PARTICULE_DENSITY = 800;

var STROKE_LINE_WIDTH = 0.4;
/** Distance to move the points at each frame. */
// Note: We prefer using a constant distance per frame rather than defining a speed.
// The speed would result in bad results on low framerate. 
var STEP_DISTANCE = 1.5
var COLORS = ['#DBCEC1', '#F7F6F5']


var canvas, ctx;
var shadow;
var pixelRatio;
var colorSize;

var pointsX, pointsY;
var canvasScreenWidth, canvasScreenHeight;
var canvasRealWidth, canvasRealHeight;

var attractors;

init();
animate();
window.addEventListener( 'resize', init, false );

function init() {
  // initialize globals
  pointsX = [];
  pointsY = [];
  attractors = [];

  pixelRatio = window.devicePixelRatio || 1;

  canvas = document.getElementById("paint-canvas");
  ctx = canvas.getContext("2d");

  shadow = new Image();
  shadow.src = SHADOW_IMAGE + SIZE_SHADOW + 'px.png';
  
  resizeCanvasToWindow();

  initPoints();
  initAttractors();

  colorSize = Math.ceil(pointsX.length / COLORS.length);
  ctx.lineWidth = STROKE_LINE_WIDTH * pixelRatio;
}

function resizeCanvasToWindow() { 
  canvasScreenWidth = window.innerWidth;
  canvasScreenHeight = window.innerHeight;
  canvasRealWidth = canvasScreenWidth * pixelRatio;
  canvasRealHeight = canvasScreenHeight * pixelRatio;

  canvas.width = canvasRealWidth;
  canvas.height = canvasRealHeight;
  canvas.style.width = canvasScreenWidth + 'px';
  canvas.style.height = canvasScreenHeight + 'px';
}

function animate(timestamp) {
  requestAnimationFrame( animate );
  render(timestamp);
}

function render(timestamp) {
  // cut the number of points per number of color, and paint all of the same color at once:
  // start a path and add each segment to it, and only then, paint it. 
  // This increases performances instead of painting each segment after the other.
  for(var c = 0; c < COLORS.length; c++) {
    ctx.beginPath();
    ctx.strokeStyle = COLORS[c];
    var range = Math.min((c+1) * colorSize, pointsX.length);
    for (var i = c * colorSize; i < range; i++ ) {
      var oldX = pointsX[i];
      var oldY = pointsY[i];
      var newPosition = getNewPosition(oldX, oldY);
      ctx.moveTo(oldX,oldY);
      ctx.lineTo(newPosition[0], newPosition[1]);
      pointsX[i] = newPosition[0];
      pointsY[i] = newPosition[1];
    }
    ctx.stroke();
  }

  for (var i = 0; i < pointsX.length; i++ ) {
  ctx.drawImage(shadow, pointsX[i] - DELTA_SHADOW_X * pixelRatio, pointsY[i] - DELTA_SHADOW_Y * pixelRatio, SIZE_SHADOW * pixelRatio, SIZE_SHADOW * pixelRatio);
  }

}

function getNewPosition(x, y) {
  var fieldXY = field(x,y); 

  var ux = -1 * STEP_DISTANCE * pixelRatio * fieldXY[1];
  var uy =      STEP_DISTANCE * pixelRatio * fieldXY[0];

  var newX = x + ux;
  var newY = y + uy;

  return [newX, newY];
}


/**
 * Value of the field at a given point 
 */
function field(x, y) {
  var ux = 0;
  var uy = 0;
  for(var a = 0; a < attractors.length; a++) {
    var attractor = attractors[a];

    var d2 =  Math.pow(x - attractor.x, 2) + Math.pow(y - attractor.y, 2);
    var d = Math.sqrt(d2);

    var weight = attractor.weight * Math.exp( -1 * d2 / attractor.radius );

    ux += weight * (x - attractor.x) / d;
    uy += weight * (y - attractor.y) / d;
  }

  var norm = Math.sqrt(ux*ux + uy * uy);
  ux = ux / norm;
  uy = uy / norm;

  return [ux, uy];
}

function initPoints() {
  var nbParticules = PARTICULE_DENSITY * canvasScreenWidth * canvasScreenHeight / 1000000
  for(var i = 0; i < nbParticules; i++) {
    pointsX.push(Math.random() * canvasRealWidth);
    pointsY.push(Math.random() * canvasRealHeight);
  }
}

function initAttractors() {
  var minW = -1;
  var maxW =  1;

  var D = Math.max(canvasRealWidth, canvasRealHeight);
  var minD = 8 * D * pixelRatio;
  var maxD = 128 * D * pixelRatio;

  for( var a = 0; a < NB_ATTRACTORS; a++) {
    var attractor = {};  
    attractor.x = Math.random() * (canvasRealWidth - 1);
    attractor.y = Math.random() * (canvasRealHeight - 1);
    attractor.weight = Math.random() * (maxW - minW) + minW;
    attractor.radius = Math.random() * (maxD - minD) + minD;
    attractors.push(attractor);
  }
}
