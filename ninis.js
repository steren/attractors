var SIZE_SHADOW = 16;
var SHADOW_IMAGE = 'shadow-o02-ellipse-'
var DELTA_SHADOW_X = 1;
var DELTA_SHADOW_Y = 1;
var NB_ATTRACTORS = 25;
var NB_PARTICULES = 800;

var STROKE_LINE_WIDTH = 0.4;

var SPEED = 100 /* pixels per millisecond */ / 1000;

var colors = ['#DBCEC1', '#F7F6F5']

var canvas, ctx;
var shadow;
var pixelRatio;
var colorSize;

var G = 100;
var mCursor = 100

var speed = 1000 / (100 * 1000 * 1000);

var mouseX = 0, mouseY = 0;

var pointsX = [];
var pointsY = [];

var attractors = [];

var lastTime;

init();
animate();

function init() {

  pixelRatio = window.devicePixelRatio || 1;
  canvas = document.getElementById("paint-canvas");
  ctx = canvas.getContext("2d");

  shadow = new Image();
  shadow.src = SHADOW_IMAGE + SIZE_SHADOW + 'px.png';
  // TODO: use data:url?

  resizeCanvasesToWindow();

  initAttractors();

  for(var i = 0; i < NB_PARTICULES; i++) {
    pointsX.push(Math.random() * canvas.width);
    pointsY.push(Math.random() * canvas.height);
  }

  colorSize = Math.floor(pointsX.length / colors.length);

  ctx.lineWidth = STROKE_LINE_WIDTH * pixelRatio;

  document.addEventListener( 'mousemove', onDocumentMouseMove, false );
  window.addEventListener( 'resize', onWindowResize, false );
}

function resizeCanvasesToWindow() { 
  canvas.width = window.innerWidth * pixelRatio;
  canvas.height = window.innerHeight * pixelRatio;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
}

function onWindowResize() {
  resizeCanvasesToWindow();
}

function onDocumentMouseMove(event) {
  mouseX = event.clientX
  mouseY = event.clientY;
}


function animate(timestamp) {
  requestAnimationFrame( animate );
  render(timestamp);
}

function render(timestamp) {
  if (!lastTime) { lastTime = timestamp; }
  var delta = timestamp - lastTime;
  lastTime = timestamp;

  // cut the number of points per number of color, and paint all of the same color at once:
  // start a path and add each segment to it, and only then, paint it. 
  // This increases performances instead of painting each segment after the other.
  for(var c = 0; c < colors.length; c++) {
    ctx.beginPath();
    ctx.strokeStyle = colors[c];
    for (var i = c * colorSize; i < (c+1) * colorSize; i++ ) {
      var oldX = pointsX[i];
      var oldY = pointsY[i];
      var newPosition = getNewPosition(oldX, oldY, delta);
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

/**
 * delta: number of microsecond since last frame
 */
function getNewPosition(x, y, delta) {
  var fieldXY = field(x,y); 

  var distance = 0;
  if(delta) {
    distance = SPEED * delta;
  }

  var ux = -1 * distance * pixelRatio * fieldXY[1];
  var uy =      distance * pixelRatio * fieldXY[0];

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




function initAttractors() {
  var dimX = canvas.width;
  var dimY = canvas.height;

  var minW = -1;
  var maxW =  1;

  var D = Math.max(dimX, dimY);
  var minD = 8 * D * pixelRatio;
  var maxD = 128 * D * pixelRatio;

  for( var a = 0; a < NB_ATTRACTORS; a++) {
    var attractor = {};  
    attractor.x = Math.random() * (dimX - 1);
    attractor.y = Math.random() * (dimY - 1);
    attractor.weight = Math.random() * (maxW - minW) + minW;
    attractor.radius = Math.random() * (maxD - minD) + minD;
    attractors.push(attractor);
  }
}
