var SIZE_SHADOW = 16;
var SHADOW_IMAGE = 'shadow-o02-ellipse-'
var DELTA_SHADOW_X = 1;
var DELTA_SHADOW_Y = 1;
var NB_ATTRACTORS = 25;
var NEW_SEED_CREATION_PROBABILITY = 0;
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
var textAttractors = [];

// scroll to get rid of address bar on mobile
window.scrollTo(0,1);

init();
animate();

window.addEventListener( 'resize', init, false );
document.body.addEventListener('click', init, true); 

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

  initAttractors();
  initTextAttractors();
  initPoints();

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
    for (var i = c * colorSize; i < (c+1) * colorSize; i++ ) {
      if( Math.random() < NEW_SEED_CREATION_PROBABILITY ) {
        var newSeed = getPositionOutsideOfTextAttractor();
        pointsX[i] = newSeed[0];
        pointsY[i] = newSeed[1];
      }
      else {
        var oldX = pointsX[i];
        var oldY = pointsY[i];
        var newPosition = getNewPosition(oldX, oldY);
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

function getNewPosition(x, y) {
  var fieldXY = field(x,y); 

  var ux = -1 * STEP_DISTANCE * pixelRatio * fieldXY[1];
  var uy =      STEP_DISTANCE * pixelRatio * fieldXY[0];

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

function initPoints() {
  var nbParticules = PARTICULE_DENSITY * canvasScreenWidth * canvasScreenHeight / 1000000
  for(var i = 0; i < nbParticules; i++) {
    //var newSeed = getPositionOutsideOfTextAttractorSquare(4/5);
    var newSeed = getPositionOutsideOfTextAttractorGaussian();
    pointsX.push(newSeed[0]);
    pointsY.push(newSeed[1]);
  }
}


function normalRand() {
  while(true) {
    var x = Math.random();
    var y = Math.exp(-1*Math.pow(x-0.5, 2)/0.1);
    if(y>Math.random()) {
      return x;
    }
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



function initTextAttractors() {
  textAttractors = [];
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



function getPositionOutsideOfTextAttractorSquare(sizeRatio) {
  while(true) {
    var x = push(Math.random() * canvasRealWidth * sizeRatio + canvasRealWidth * ( 1 - sizeRatio) / 2 );
    var y = push(Math.random() * canvasRealHeight * sizeRatio + canvasRealHeight * ( 1 - sizeRatio) / 2);
    if(!isInTextAttractor(x,y)) {
      return [x, y];
    }
  }
}

function getPositionOutsideOfTextAttractorGaussian() {
  while(true) {
    var x = normalRand() * canvasRealWidth;
    var y = normalRand() * canvasRealHeight;
    if(!isInTextAttractor(x,y)) {
      return [x, y];
    }
  }
}
