var SIZE_SHADOW = 16;
var SHADOW_IMAGE = 'shadow-o30-ellipse-'
var SHADOW_OPACITY = 0.04;
var DELTA_SHADOW_X = 1;
var DELTA_SHADOW_Y = 1;
var NB_ATTRACTORS = 25;
var NEW_SEED_CREATION_PROBABILITY = 0;
/** number of particule for a square of 1000 * 1000 pixels */
var PARTICULE_DENSITY = 900;
var STROKE_LINE_WIDTH = 0.35;
/** Distance to move the points at each frame. */
// Note: We prefer using a constant distance per frame rather than defining a speed.
// The speed would result in bad results on low framerate.
var STEP_DISTANCE = 1;
var COLORS = ['#DBCEC1', '#F7F6F5'];
var BACKGROUND_COLOR = '#57A3BD';
var MESSAGE_APPEARANCE_DELAY = 8 * 1000;
var TEXT = '13   8   2016';
var TEXT_FONT_SIZE_SCREEN_WIDTH_RATIO = 12;
var TEXT_X_POSITION_PERCENT = 50;
var TEXT_Y_POSITION_PERCENT = 33;
var TEXT_ATTRACTOR_RADIUS = 1;
/** under this width, do not subdivise the quadratic and cubic bezier curves in the text's path */
var TEXT_MIN_WIDTH_TO_SUBDIVISE = 500;
var PROBABILITY_POINT_APPEARS_NEAR_TEXT = 0.05;
var RANDOMBACKGROUND = 0.05;
var GAUSSIAN_PARAM_TEXT = 1/200;
var ATTRACTOR_RADIUS_MIN = 1/50;
var ATTRACTOR_RADIUS_MAX = 16 * ATTRACTOR_RADIUS_MIN;
/** Should ther text path be cleaned by duplicate vertices */
var CLEAN_PATH = true;
var SUBDIVISE_NOGO = 16; // decrease to subdivise more
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
var noGoZone;

var loadedFont;

// characteristic distance of the image
var D;

/** bounding box of the main text */
var textTopLeft, textBottomRight;
/** bounding box of the no GO Zone */
var noGoTopLeft, noGoBottomRight;

var boundingBoxes;

var typedText = '';

/** Shoud shadows be drawn at next render (alternates every frame) */
var drawShadow = true;

opentype.load('fonts/' + FONT, function(err, font) {
  console.log(font);
  loadedFont = font;
  init();
  animate();
});

window.setTimeout(displayMessage, MESSAGE_APPEARANCE_DELAY);

window.addEventListener( 'resize', init, false );
document.body.addEventListener('click', init, true);
document.body.addEventListener('keyup', onKeyUp);
document.body.addEventListener('keydown', onKeyDown);


function init() {
  var text = TEXT;
  var cleanPath = CLEAN_PATH;
  if(typedText) {
     text = typedText;
     cleanPath = false;
  }

  // initialize globals
  pointsX = [];
  pointsY = [];

  textTopLeft = {};
  textBottomRight = {};

  noGoTopLeft = {};
  noGoBottomRight = {};

  boundingBoxes = [];
  boundingBoxes.push({
    topleft: textTopLeft,
    bottomright: textBottomRight
  });
  boundingBoxes.push({
    topleft: noGoTopLeft,
    bottomright: noGoBottomRight
  });

  pixelRatio = window.devicePixelRatio || 1;

  canvas = document.getElementById("paint-canvas");
  ctx = canvas.getContext("2d", {alpha : false});
  resizeCanvasToWindow();
  D = Math.max(canvas.width, canvas.height);

  shadow = new Image();
  shadow.src = SHADOW_IMAGE + SIZE_SHADOW + 'px.png';



  paintCanvasWithBackground();

  initAttractors(ATTRACTOR_RADIUS_MIN, ATTRACTOR_RADIUS_MAX);
  initTextAttractors(text, cleanPath);
  initNoGoZoneTextAttractors();
  initPoints();

  colorSize = Math.ceil(pointsX.length / COLORS.length);
  ctx.lineWidth = STROKE_LINE_WIDTH * pixelRatio;
}

function onKeyUp(e) {
  if (e.which == 8) {
    return;
  } else if (e.which == 13) {
    typedText = '';
  } else {
     typedText += String.fromCharCode(e.which); 
  }
  init();
}

function onKeyDown(e) {
  if(e.which == 8) {
     typedText = typedText.slice(0, -1);
     init();
     e.preventDefault(); 
  }

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

  // draw shadow
  if(drawShadow) {
    ctx.globalAlpha = SHADOW_OPACITY;
    for (var i = 0; i < pointsX.length; i++ ) {
      ctx.drawImage(shadow, pointsX[i] - DELTA_SHADOW_X * pixelRatio, pointsY[i] - DELTA_SHADOW_Y * pixelRatio, SIZE_SHADOW * pixelRatio, SIZE_SHADOW * pixelRatio);
    }
    ctx.globalAlpha = 1.0;
  }
  drawShadow = !drawShadow;

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

    var d2 =  (x - attractor.x) * (x - attractor.x) + (y - attractor.y) * (y - attractor.y);
    var d = Math.sqrt(d2);

    var weight = attractor.weight * Math.exp( -1 * d2 / (attractor.radius * attractor.radius) );

    ux += weight * (x - attractor.x) / d;
    uy += weight * (y - attractor.y) / d;
  }

  var norm = Math.sqrt(ux * ux + uy * uy);
  ux = ux / norm;
  uy = uy / norm;

  // If we are nead the text, add the text contribution to the field
  if(isNearText(x,y)) {
    var closestTextPoint = findClosestTextPoint(x,y);
    var textUx = (x - closestTextPoint.originX);
    var textUy = (y - closestTextPoint.originY);
    var norm = Math.sqrt(textUx*textUx + textUy*textUy);
    textUx = textUx / norm;
    textUy = textUy / norm;

    // Combine fields
    textWeight = Math.exp( -1 * closestTextPoint.distance * closestTextPoint.distance /  (GAUSSIAN_PARAM_TEXT * D * D) );
    ux = (1-textWeight)*ux + textWeight * textUx;
    uy = (1-textWeight)*uy + textWeight * textUy;

  }

  return [ux, uy];
}

function isNearText(x,y) {
  var near = D/8;
  
  for(var b = 0; b < boundingBoxes.length; b++) {
    if( x - (boundingBoxes[b].topleft.x - near) > 0
      && x - (boundingBoxes[b].bottomright.x + near) < 0
      && y - (boundingBoxes[b].topleft.y - near) > 0
      && y - (boundingBoxes[b].bottomright.y + near) < 0) {
      return true;
    }
  }
  return false;
}

function initPoints() {
  // for a device with higher pixel ratio, put more particules.
  // but do not put pixelRatio * pixelRatio more particules for performances reasons
  var nbParticules = pixelRatio * PARTICULE_DENSITY * canvasScreenWidth * canvasScreenHeight / 1000000
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



function initAttractors(min, max) {
  attractors = [];

  var minW = -1;
  var maxW =  1;
  var minD = min * D;
  var maxD = max * D;

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

function initTextAttractors(text, cleanPath) {
  textAttractors = [];

  var textPathTopLeft = {x: Infinity, y: Infinity};
  var textPathBottomRight = {x: -Infinity, y: -Infinity};
  var fontSize = canvasRealWidth / TEXT_FONT_SIZE_SCREEN_WIDTH_RATIO;

  // measure the size of a single character
  var path = loadedFont.getPath(text, 0, 0, fontSize);
  console.log(path);


  // get the bounding box of the text path
  for( var c = 0; c < path.commands.length; c++) {
    if (path.commands[c].x < textPathTopLeft.x) {textPathTopLeft.x = path.commands[c].x};
    if (path.commands[c].y < textPathTopLeft.y) {textPathTopLeft.y = path.commands[c].y};
    if (path.commands[c].x > textPathBottomRight.x) {textPathBottomRight.x = path.commands[c].x};
    if (path.commands[c].y > textPathBottomRight.y) {textPathBottomRight.y = path.commands[c].y};
  }
  var textWidth = textPathBottomRight.x - textPathTopLeft.x;
  var textHeight = textPathBottomRight.y - textPathTopLeft.y;
  var textX = canvasRealWidth * TEXT_X_POSITION_PERCENT / 100 - textWidth / 2;
  var textY = canvasRealHeight * TEXT_Y_POSITION_PERCENT / 100 + textHeight / 2;

  textTopLeft.x = canvasRealWidth * TEXT_X_POSITION_PERCENT / 100 - textWidth / 2;
  textTopLeft.y = canvasRealHeight * TEXT_Y_POSITION_PERCENT / 100 - textHeight / 2;
  textBottomRight.x = textTopLeft.x + textWidth;
  textBottomRight.y = textTopLeft.y + textHeight;

  if(DEBUG_FLAG) {
    loadedFont.drawPoints(ctx, text, textX, textY, fontSize * pixelRatio);
  }
  var subdiviseBezier = false;
  if(textWidth > TEXT_MIN_WIDTH_TO_SUBDIVISE) {
    subdiviseBezier = true;
  }

  if(cleanPath) {
    var useThisCommand = [];
    // 1
    useThisCommand.push(0);
    for(var i=0; i<3; i++) {useThisCommand.push(1);}
    for(var i=0; i<2; i++) {useThisCommand.push(0);}
    // 3
    for(var i=0; i<25; i++) {useThisCommand.push(1);}
    for(var i=0; i<25; i++) {useThisCommand.push(0);}
    // 8
    for(var i=0; i<34; i++) {useThisCommand.push(1);}
    for(var i=0; i<35; i++) {useThisCommand.push(0);}
    // 2
    for(var i=0; i<15; i++) {useThisCommand.push(0);}
    for(var i=0; i<17; i++) {useThisCommand.push(1);}
    for(var i=0; i<2; i++) {useThisCommand.push(0);}
    // 0
    for(var i=0; i<18; i++) {useThisCommand.push(1);}
    // 1
    useThisCommand.push(0);
    for(var i=0; i<3; i++) {useThisCommand.push(1);}
    for(var i=0; i<2; i++) {useThisCommand.push(0);}
    // 6
    for(var i=0; i<21; i++) {useThisCommand.push(1);}
    for(var i=0; i<21; i++) {useThisCommand.push(0);}
  }

  for( var c = 0; c < (path.commands.length-1); c++) {
    if(!cleanPath || (useThisCommand[c]==1 && useThisCommand[c+1]==1)) {
      var command2 = path.commands[c+1];
      var commandToExecute = command2.type;
      if(!subdiviseBezier && (command2.type=="C" || command2.type=="Q")) {
        commandToExecute = "L";
      }

      var command1 = path.commands[c];
      // add points near text
      if( Math.random() < PROBABILITY_POINT_APPEARS_NEAR_TEXT ) {
        pointsX.push(textX + command1.x+Math.random()-0.5);
        pointsY.push(textY + command1.y+Math.random()-0.5);
      }

      switch(commandToExecute) {
        case "L":
          var textAttractor = {};
          textAttractor.x1 = textX + command1.x;
          textAttractor.y1 = textY + command1.y;
          textAttractor.x2 = textX + command2.x;
          textAttractor.y2 = textY + command2.y;
          textAttractor.radius = TEXT_ATTRACTOR_RADIUS;
          textAttractors.push(textAttractor);

          // if a real L (line)
          if(command2.type == "L") {
            if( Math.random() < 1 ) {
              pointsX.push(textX + command1.x+Math.random()-0.5);
              pointsY.push(textY + command1.y+Math.random()-0.5);
            }
          }
          break;
        case "Q":
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
  }
}


function initNoGoZoneTextAttractors() {  

  noGoTopLeft.x = Infinity;
  noGoTopLeft.y = Infinity;
  noGoBottomRight.x = -Infinity;
  noGoBottomRight.y = -Infinity;

  var message = document.getElementById('message');
  var mainMessage = document.getElementById('main-message');

  noGoZone = [];

  // define no go zone via a few points
  var textBox = [];
  textBox.push({
    x: (canvasRealWidth / 2 - mainMessage.offsetWidth * pixelRatio / 2) * (1 - Math.random() * 2 * RANDOMBACKGROUND), 
    y: (canvasRealHeight - message.offsetHeight * pixelRatio) * (1 - Math.random() * RANDOMBACKGROUND), 
    x1:0, y1:0, x2:0, y2:0});

  textBox.push({
    x: (canvasRealWidth / 2 ) * (1 - Math.random() * RANDOMBACKGROUND), 
    y: (canvasRealHeight - message.offsetHeight * pixelRatio), 
    x1:0, y1:0, x2:0, y2:0});

  textBox.push({
    x: (canvasRealWidth / 2 + mainMessage.offsetWidth * pixelRatio / 2) * (1 + Math.random() * 2 * RANDOMBACKGROUND), 
    y: (canvasRealHeight - message.offsetHeight * pixelRatio) * (1 - Math.random() * RANDOMBACKGROUND), 
    x1:0, y1:0, x2:0, y2:0});

  textBox.push({
    x: randomIntFromInterval(canvasRealWidth / 2 + mainMessage.offsetWidth * pixelRatio / 4, 3 * canvasRealWidth / 4), 
    y: canvasRealHeight, 
    x1:0, y1:0, x2:0, y2:0});
    
  textBox.push({
    x: randomIntFromInterval(canvasRealWidth / 4, canvasRealWidth / 2 - mainMessage.offsetWidth * pixelRatio / 4), 
    y: canvasRealHeight, 
    x1:0, y1:0, x2:0, y2:0});
  var n = textBox.length;

  // compute the Bezier handle
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

  // subdivise Bezier curve to create segments
  for(var i=0; i<n; i++) {
    var PS = textBox[i];
    var PE = textBox[(i+1)%n];
    var L = Math.sqrt(Math.pow(PE.x - PS.x, 2) + Math.pow(PE.y - PS.y, 2));
    var T = [];
    var nT = Math.ceil(L/SUBDIVISE_NOGO);
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
      noGoZone.push(textAttractor);

      if (textAttractor.x1 > noGoBottomRight.x) {noGoBottomRight.x = textAttractor.x1};
      if (textAttractor.y1 > noGoBottomRight.y) {noGoBottomRight.y = textAttractor.y1};
      if (textAttractor.x1 < noGoTopLeft.x) {noGoTopLeft.x = textAttractor.x1};
      if (textAttractor.y1 < noGoTopLeft.y) {noGoTopLeft.y = textAttractor.y1};

      if(DEBUG_FLAG) {
        drawHelperCircle(textAttractor.x1, textAttractor.y1, 1);
      }
    }
  }


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
    var closestSegmentPoint = distanceToSegment(textAttractor.x1, textAttractor.y1, textAttractor.x2, textAttractor.y2, x, y);
    if(a == 0) {
      deltaMin = closestSegmentPoint.distance - textAttractor.radius;
      ox = closestSegmentPoint.originX;
      oy = closestSegmentPoint.originY;
    }
    else {
      if((closestSegmentPoint.distance - textAttractor.radius) < deltaMin) {
        deltaMin = closestSegmentPoint.distance - textAttractor.radius;
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



function isInNoGoZone(x,y) {
  if( x - noGoTopLeft.x > 0
  && x - noGoBottomRight.x < 0
  && y - noGoTopLeft.y > 0
  && y - noGoBottomRight.y < 0) {
    return true;
  }
  return false;
}



function getPositionOutsideOfTextAttractorSquare(sizeRatio) {
  while(true) {
    var x = push(Math.random() * canvasRealWidth * sizeRatio + canvasRealWidth * ( 1 - sizeRatio) / 2 );
    var y = push(Math.random() * canvasRealHeight * sizeRatio + canvasRealHeight * ( 1 - sizeRatio) / 2);
    if(!isInNoGoZone(x,y)) {
      return [x, y];
    }
  }
}

function getPositionOutsideOfTextAttractorGaussian() {
  while(true) {
    var x = normalRand() * canvasRealWidth;
    var y = normalRand() * canvasRealHeight;
    if(!isInNoGoZone(x,y)) {
      return [x, y];
    }
  }
}


function distanceToSegment(x1, y1, x2, y2, x, y) {
  var l = (x2-x1)*(x2-x1) + (y2-y1)*(y2-y1);
  var d = (x-x1)*(x2-x1) + (y-y1)*(y2-y1);
  if(d>l) {
    return {
      distance: Math.sqrt((x2-x) * (x2-x) + (y2-y) * (y2-y)),
      originX: x2,
      originY: y2
    }
  }
  else {
    if(d<0) {
      return {
        distance: Math.sqrt((x1-x) * (x1-x) + (y1-y) * (y1-y)),
        originX: x1,
        originY: y1
      }
    }
    else {
      var ox = x1 + (x2-x1)*d/l;
      var oy = y1 + (y2-y1)*d/l;
      return {
        distance: Math.sqrt( (ox-x) * (ox-x) + (oy-y) * (oy-y)),
        originX: ox,
        originY: oy
      }
    }
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


function randomIntFromInterval(min,max)
{
    return Math.floor(Math.random()*(max-min+1)+min);
}