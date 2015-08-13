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
var STEP_DISTANCE = 1.5;
var COLORS = ['#DBCEC1', '#F7F6F5'];
var BACKGROUND_COLOR = '#57A3BD';
var MESSAGE_APPEARANCE_DELAY = 8 * 1000;
var TEXT = '13 . 8 . 2016';
var TEXT_FONT_SIZE_SCREEN_WIDTH_RATIO = 12;
var TEXT_X_POSITION_PERCENT = 50;
var TEXT_Y_POSITION_PERCENT = 33;
var TEXT_ATTRACTOR_RADIUS = 1;
var DEBUG_FLAG = false;

var FONT = 'CamBam/1CamBam_Stick_2.ttf';
//var FONT = 'Codystar/Codystar-Regular.ttf';
//var FONT = 'Fredoka_One/FredokaOne-Regular.ttf';

var canvas, ctx;
var shadow;
var pixelRatio;
var colorSize;

var pointsX, pointsY;
var canvasScreenWidth, canvasScreenHeight;
var canvasRealWidth, canvasRealHeight;

var attractors;
var textAttractors;

var loadedFont;

opentype.load('fonts/' + FONT, function(err, font) {
  console.log(font);
  loadedFont = font;
  init();
  animate();
});

window.setTimeout(displayMessage, MESSAGE_APPEARANCE_DELAY);

window.addEventListener( 'resize', init, false );
document.body.addEventListener('click', init, true);

function init() {
  // initialize globals
  pointsX = [];
  pointsY = [];
  attractors = [];
  textAttractors = [];

  pixelRatio = window.devicePixelRatio || 1;

  canvas = document.getElementById("paint-canvas");
  ctx = canvas.getContext("2d", {alpha : false});

  shadow = new Image();
  shadow.src = SHADOW_IMAGE + SIZE_SHADOW + 'px.png';

  resizeCanvasToWindow();

  paintCanvasWithBackground();

  initAttractors();
  initTextAttractors(TEXT);
  initPoints();

  colorSize = Math.ceil(pointsX.length / COLORS.length);
  ctx.lineWidth = STROKE_LINE_WIDTH * pixelRatio;
}

function displayMessage() {
  var message = document.getElementById('message');
  message.className = 'visible'; 
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

function paintCanvasWithBackground() {
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, canvasRealWidth, canvasRealHeight);
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
        var newSeed = getPositionOutsideOfTextAttractorGaussian();
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

  // Text contribution for segmentTextAttractor
  var closestTextPoint = findClosestTextPoint(x,y);

  var textUx = (x - closestTextPoint.originX);
  var textUy = (y - closestTextPoint.originY);

  norm = Math.sqrt(textUx*textUx + textUy*textUy);
  textUx = textUx / norm;
  textUy = textUy / norm;

  // Combine fields
  var D = Math.max(canvas.width, canvas.height);
  textWeight = Math.exp( -1 * Math.pow(closestTextPoint.distance,1) /  (0.25*D) );
//     textWeight = Math.exp( -1 * Math.pow(closestTextPoint.distance,2) /  (4*D) );

  ux = (1-textWeight)*ux + textWeight * textUx;
  uy = (1-textWeight)*uy + textWeight * textUy;

  norm = Math.sqrt(ux*ux + uy*uy);
  ux = ux / norm;
  uy = uy / norm;

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
    if(DEBUG_FLAG) {
      if(attractor.weight>0) {
        drawHelperCircle(attractor.x, attractor.y, 100*attractor.weight, 'green');
      }
      else {
        drawHelperCircle(attractor.x, attractor.y, -100*attractor.weight, 'red');
      }
    }
  }
}

function initTextAttractors(text) {
  textAttractors = [];

  var textTopLeft = {x: Infinity, y: Infinity};
  var textBottomRight = {x: -Infinity, y: -Infinity};
  var fontSize = canvasRealWidth / TEXT_FONT_SIZE_SCREEN_WIDTH_RATIO;

  // measure the size of a single character
  var path = loadedFont.getPath(text, 0, 0, fontSize);

  // get the bounding box of the text path
  for( var c = 0; c < path.commands.length; c++) {
    if (path.commands[c].x < textTopLeft.x) {textTopLeft.x = path.commands[c].x};
    if (path.commands[c].y < textTopLeft.y) {textTopLeft.y = path.commands[c].y};
    if (path.commands[c].x > textBottomRight.x) {textBottomRight.x = path.commands[c].x};
    if (path.commands[c].y > textBottomRight.y) {textBottomRight.y = path.commands[c].y};
  }
  var textWidth = textBottomRight.x - textTopLeft.x;
  var textHeight = textBottomRight.y - textTopLeft.y;
  var textX = canvasRealWidth * TEXT_X_POSITION_PERCENT / 100 - textWidth / 2;
  var textY = canvasRealHeight * TEXT_Y_POSITION_PERCENT / 100 + textHeight / 2;

  for( var c = 0; c < (path.commands.length-1); c++) {
      var command2 = path.commands[c+1];
      switch(command2.type) {
        case "L":
          var command1 = path.commands[c];
          var textAttractor = {};
          textAttractor.x1 = textX + command1.x;
          textAttractor.y1 = textY + command1.y;
          textAttractor.x2 = textX + command2.x;
          textAttractor.y2 = textY + command2.y;
          textAttractor.radius = TEXT_ATTRACTOR_RADIUS;
          textAttractors.push(textAttractor);
          pointsX.push(textX + command1.x+Math.random()-0.5);
          pointsY.push(textY + command1.y+Math.random()-0.5);
          break;
        case "Q":
          if(Math.random()>0.75) {
            pointsX.push(textX + command1.x+Math.random()-0.5);
            pointsY.push(textY + command1.y+Math.random()-0.5);
          }
          var command1 = path.commands[c];
          var textAttractor = {};
          var t = 1/2;
          textAttractor.x1 = textX + command1.x;
          textAttractor.y1 = textY + command1.y;
          var x = bezier([t], [command1.x, command2.x1, command2.x]);
          var y = bezier([t], [command1.y, command2.y1, command2.y]);
          textAttractor.x2 = textX + x[0];
          textAttractor.y2 = textY + y[0];
          textAttractor.radius = TEXT_ATTRACTOR_RADIUS;
          textAttractors.push(textAttractor);
          var textAttractor2 = {};
          textAttractor2.x1 = textAttractor.x2;
          textAttractor2.y1 = textAttractor.y2;
          textAttractor2.x2 = textX + command2.x;
          textAttractor2.y2 = textY + command2.y;
          textAttractor2.radius = TEXT_ATTRACTOR_RADIUS;
          textAttractors.push(textAttractor2);
          break;
        case "C":
          if(Math.random()>0.5) {
            pointsX.push(textX + command1.x+Math.random()-0.5);
            pointsY.push(textY + command1.y+Math.random()-0.5);
          }
          var command1 = path.commands[c];
          var textAttractor = {};
          var x = bezier([1/3, 2/3], [command1.x, command2.x1, command2.x2, command2.x]);
          var y = bezier([1/3, 2/3], [command1.y, command2.y1, command2.y2, command2.y]);
          textAttractor.x1 = textX + command1.x;
          textAttractor.y1 = textY + command1.y;
          textAttractor.x2 = textX + x[0];
          textAttractor.y2 = textY + y[0];
          textAttractor.radius = TEXT_ATTRACTOR_RADIUS;
          textAttractors.push(textAttractor);
          var textAttractor2 = {};
          textAttractor2.x1 = textAttractor.x2;
          textAttractor2.y1 = textAttractor.y2;
          textAttractor2.x2 = textX + x[1];
          textAttractor2.y2 = textY + y[1];
          textAttractor2.radius = TEXT_ATTRACTOR_RADIUS;
          textAttractors.push(textAttractor2);
          var textAttractor3 = {};
          textAttractor3.x1 = textAttractor2.x2;
          textAttractor3.y1 = textAttractor2.y2;
          textAttractor3.x2 = textX + command2.x;
          textAttractor3.y2 = textY + command2.y;
          textAttractor3.radius = TEXT_ATTRACTOR_RADIUS;
          textAttractors.push(textAttractor3);
          break;
        default: // "M", "Z"
      }
      //drawHelperCircle(attractor.x, attractor.y, attractor.radius);
  }

  var textBox = [];
  var P = {x: 100, y:100, x1:0, y1:0, x2:0, y2:0};
  textBox.push(P);
  P = {x: 200, y:100, x1:0, y1:0, x2:0, y2:0};
  textBox.push(P);
  P = {x: 300, y:300, x1:0, y1:0, x2:0, y2:0};
  textBox.push(P);
  P = {x: 100, y:300, x1:0, y1:0, x2:0, y2:0};
  textBox.push(P);
  var n = textBox.length;
  for(var i=0; i<n; i++) {
    var P1 = textBox[(i-1+n)%n];
    var P0 = textBox[i];
    var P2 = textBox[(i+1)%n];
    var L  = Math.sqrt(Math.pow(P2.x - P1.x, 2) + Math.pow(P2.y - P1.y, 2));
    var l1 = Math.sqrt(Math.pow(P0.x - P1.x, 2) + Math.pow(P0.y - P1.y, 2));
    var l2 = Math.sqrt(Math.pow(P2.x - P0.x, 2) + Math.pow(P2.y - P0.y, 2));
    P0.x1 = P0.x + (l1/3) * (P1.x - P2.x) / L;
    P0.x2 = P0.x + (l2/3) * (P2.x - P1.x) / L;
    P0.y1 = P0.y + (l1/3) * (P1.y - P2.y) / L;
    P0.y2 = P0.y + (l2/3) * (P2.y - P1.y) / L;
    textBox[i] = P0;
  }
  for(var i=0; i<n; i++) {
    var PS = textBox[i];
    var PE = textBox[(i+1)%n];
    var L = Math.sqrt(Math.pow(PE.x - PS.x, 2) + Math.pow(PE.y - PS.y, 2));
    var T = [];
    var nT = Math.ceil(L/10);
    for(var k=0; k<nT; k++) {
      T.push(k/(nT-1));
    }
    var Bx = bezier(T, [PS.x, PS.x2, PE.x1, PE.x]);
    var By = bezier(T, [PS.y, PS.y2, PE.y1, PE.y]);
    for(var j=0; j<(nT-1); j++) {
      var textAttractor = {};
      textAttractor.x1 = Bx[j];
      textAttractor.y1 = By[j];
      textAttractor.x2 = Bx[j+1];
      textAttractor.y2 = By[j+1];
      textAttractor.radius = 2*TEXT_ATTRACTOR_RADIUS;
      textAttractors.push(textAttractor);
      drawHelperCircle(textAttractor.x1, textAttractor.y1, 1);
    }
  }

  //console.log(path);
  //loadedFont.drawPoints(ctx, text, textX, textY, fontSize * devicePixelRatio);
}



function drawHelperCircle(centerX, centerY, radius, fillStyle) {
  fillStyle = fillStyle || 'green';
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
  ctx.fillStyle = fillStyle ;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#003300';
  ctx.stroke();
}


function findClosestTextPoint(x,y) {
  var nTextAttractor = textAttractors.length;
  var deltaMin = 0;
  var dMin = 0;
  var ox = 0;
  var oy = 0;
  for(var a=0; a<nTextAttractor; a++) {
    var textAttractor = textAttractors[a];
    var closestSegmentPoint = distanceToSegment(textAttractor, x, y);
    if(a==0) {
      deltaMin = closestSegmentPoint.distance-textAttractor.radius;
      ox = closestSegmentPoint.originX;
      oy = closestSegmentPoint.originY;
    }
    else {
      if((closestSegmentPoint.distance-textAttractor.radius)<deltaMin) {
        deltaMin = closestSegmentPoint.distance-textAttractor.radius;
        ox = closestSegmentPoint.originX;
        oy = closestSegmentPoint.originY;
      }
    }
  }
  return {
    distance: deltaMin,
    originX: ox,
    originY: oy
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


function distanceToSegment(segment, x, y) {
  var x1 = segment.x1;
  var x2 = segment.x2;
  var y1 = segment.y1;
  var y2 = segment.y2;
  var l = Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2));
  var d = ((x-x1)*(x2-x1) + (y-y1)*(y2-y1)) / l;
  var distanceToSegment = 0;
  var ox = 0;
  var oy = 0;
  if(d>l) {
    distanceToSegment = Math.sqrt(Math.pow(x2-x, 2) + Math.pow(y2-y, 2));
    ox = x2;
    oy = y2;
  }
  else {
    if(d<0) {
      distanceToSegment = Math.sqrt(Math.pow(x1-x, 2) + Math.pow(y1-y, 2));
      ox = x1;
      oy = y1;
    }
    else {
      ox = x1 + (x2-x1)*d/l;
      oy = y1 + (y2-y1)*d/l;
      distanceToSegment = Math.sqrt(Math.pow(ox-x, 2) + Math.pow(oy-y, 2));
    }
  }
  return {
    distance: distanceToSegment,
    originX: ox,
    originY: oy
  }
}


function bezier(T, X) {
  var n = X.length;

  var w = [0,1,0];
  for(var i=1; i<n; i++) {
    var wNew = [0];
    for(var j=0; j<i+1; j++) {
      wNew.push(w[j] + w[j+1]);
    }
    wNew.push(0);
    w = wNew;
  }

  var res = [];
  var nT = T.length;
  for(var i=0; i<nT; i++) {
    var x = 0;
    var t = T[i];
    for(var j=0; j<n; j++) {
      x += w[j+1]*Math.pow(1-t,n-1-j)*Math.pow(t,j)*X[j]; 
    }
    res.push(x);
  }

  return res;
}