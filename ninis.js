var SIZE_SHADOW = 16;
var SHADOW_IMAGE = 'shadow-o02-ellipse-'
var DELTA_SHADOW_X = 1;
var DELTA_SHADOW_Y = 1;
var NB_ATTRACTORS = 25;
var NB_PARTICULES = 800;
var NEW_SEED_CREATION_PROBABILITY = 0;

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
var textAttractors = [];

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
  initTextAttractors();

  var nParticuleAdded = 0;
  for(var i = 0; i < NB_PARTICULES; i++) {
    var newSeed = getPositionOutsideOfTextAttract();
    pointsX.push(newSeed[0]);
    pointsY.push(newSeed[1]);
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
      if( Math.random() < NEW_SEED_CREATION_PROBABILITY ) {
        var newSeed = getPositionOutsideOfTextAttract();
        pointsX[i] = newSeed[0];
        pointsY[i] = newSeed[1];
      }
      else {
        var oldX = pointsX[i];
        var oldY = pointsY[i];
        var newPosition = getNewPosition(oldX, oldY, delta);
        ctx.moveTo(oldX,oldY);
        ctx.lineTo(newPosition[0], newPosition[1]);
        pointsX[i] = newPosition[0];
        pointsY[i] = newPosition[1];
      }
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
 * Vector of the field at a given point 
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

  // Text contribution
  var closestAttractorInfo = findClosestTextAttractor(x,y);
  var index = closestAttractorInfo.index;

  var textAttractor = textAttractors[index];

  var textUx = (x - textAttractor.x);
  var textUy = (y - textAttractor.y);

  var norm = Math.sqrt(textUx*textUx + textUy*textUy);
  textUx = textUx / norm;
  textUy = textUy / norm;

  // Combine fields
  var D = Math.max(canvas.width, canvas.height);
  textWeight = Math.exp( -1 * Math.pow(closestAttractorInfo.distance,2) /  (4*D) );

  ux = (1-textWeight)*ux + textWeight * textUx;
  uy = (1-textWeight)*uy + textWeight * textUy;

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



function initTextAttractors() {
  var dimX = canvas.width;
  var dimY = canvas.height;

  var D = Math.max(dimX, dimY);
  var minD = 8 * D * pixelRatio;
  var maxD = 128 * D * pixelRatio;

  var minW = -1;
  var maxW =  1;

  for( var a = 0; a < 2; a++) {
      var attractor = {};  
      attractor.x = dimX/2 + 100*a;
      attractor.y = dimY/2 + 100*a;
      attractor.radius = (a+1)*100;
      attractor.weight = 1;
      textAttractors.push(attractor);
      //drawHelperCircle(attractor.x, attractor.y, attractor.radius);
  }
      attractor = {};  
      attractor.x = dimX/2 - 100;
      attractor.y = dimY/2 -300;
      attractor.radius = 50;
      attractor.weight = 1;
      textAttractors.push(attractor);
      //drawHelperCircle(attractor.x, attractor.y, attractor.radius);
}



function drawHelperCircle(centerX, centerY, radius) {
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
  ctx.fillStyle = 'green';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#003300';
  ctx.stroke();
} 


function findClosestTextAttractor(x,y) {
  var nTextAttractor = textAttractors.length;
  var deltaMin = 0;
  var dMin = 0;
  var closerAttractor = 0;
  for(var a=0; a<nTextAttractor; a++) {
    var textAttractor = textAttractors[a];
    var d2 = Math.pow(x-textAttractor.x, 2) + Math.pow(y-textAttractor.y, 2); 
    var d = Math.sqrt(d2);
    if(a==0) {
      deltaMin = d-textAttractor.radius;
      closerAttractor = a;
    }
    else {
      if((d-textAttractor.radius)<deltaMin) {
        deltaMin = d-textAttractor.radius;
        closerAttractor = a;
      }
    }
  }
  return {
    distance: deltaMin,
    index: closerAttractor
  }
}



function isInTextAttractor(x,y) {
  var nTextAttractor = textAttractors.length;
  for(var a=0; a<nTextAttractor; a++) {
    var textAttractor = textAttractors[a];
    var d2 = Math.pow(x-textAttractor.x, 2) + Math.pow(y-textAttractor.y, 2); 
    var d = Math.sqrt(d2);
    if(d<textAttractor.radius) {
      return true;
    }
  }
  return false;
}



function getPositionOutsideOfTextAttract() {
  while(true) {
    var x = Math.random() * canvas.width;
    var y = Math.random() * canvas.height;
    if(!isInTextAttractor(x,y)) {
      return [x, y];
    }
  }
}