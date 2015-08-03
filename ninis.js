var SIZE_SHADOW = 16;
var SHADOW_IMAGE = 'shadow-o02-ellipse-'
var DELTA_SHADOW_X = 1;
var DELTA_SHADOW_Y = 1;
var NB_ATTRACTORS = 25;
var NB_PARTICULES = 800;

var STROKE_LINE_WIDTH = 0.4;

var STEP_DISTANCE = 1.5;

var colors = ['#DBCEC1', '#F7F6F5']

var canvas, ctx;
var shadow;
var pixelRatio;

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

  for (var i = 0; i < pointsX.length; i++ ) {
    var oldX = pointsX[i];
    var oldY = pointsY[i];
    var newPosition = getNewPosition(oldX, oldY, delta);
    drawline(oldX, oldY, newPosition[0], newPosition[1], colors[i % colors.length]);

    pointsX[i] = newPosition[0];
    pointsY[i] = newPosition[1];
  }
}

function drawline(x1, y1, x2, y2, color) {
  ctx.beginPath();
  // using shadowBlur has really bad performances.
  // ctx.shadowColor = "black";
  // ctx.shadowBlur = 10;
  ctx.strokeStyle = color;
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.lineWidth = STROKE_LINE_WIDTH * pixelRatio;
  ctx.stroke();
  ctx.drawImage(shadow, x2 - DELTA_SHADOW_X, y2 - DELTA_SHADOW_Y, SIZE_SHADOW * pixelRatio, SIZE_SHADOW * pixelRatio);
}

function getNewPosition(x, y, delta) {
  return getNewPosition(x,y);
}

function getNewPosition(x,y) {
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




function initAttractors() {
  var dimX = canvas.width;
  var dimY = canvas.height;

  var minW = 0;
  var maxW =  1;

  var D = Math.max(dimX, dimY);
  var minD = 8*D;
  var maxD = 128*D;

  for( var a = 0; a < NB_ATTRACTORS; a++) {
    var attractor = {};  
    attractor.x = Math.random() * (dimX - 1);
    attractor.y = Math.random() * (dimY - 1);
    attractor.weight = Math.random() * (maxW - minW) + minW;
    attractor.radius = Math.random() * (maxD - minD) + minD;
    attractors.push(attractor);
  }
}
