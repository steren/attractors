/**
 * This code is ugly, but made with love by
 * @author annemenini
 * @author steren
 */

var DEBUG_FLAG = false;

var SIZE_SHADOW = 16;
var SHADOW_IMAGE = 'shadow-o30-ellipse-'
var SHADOW_OPACITY = 0.03;
var DELTA_SHADOW_X = 1;
var DELTA_SHADOW_Y = 1;
var NEW_SEED_CREATION_PROBABILITY = 0;
/** Distance to move the points at each frame. */
// Note: We prefer using a constant distance per frame rather than defining a speed.
// The speed would result in bad results on low framerate.
var STEP_DISTANCE = 1;
var TEXT_ATTRACTOR_RADIUS = 1;
/** under this width, do not subdivise the quadratic and cubic bezier curves in the text's path */
var TEXT_MIN_WIDTH_TO_SUBDIVISE = 500;
var PROBABILITY_POINT_APPEARS_NEAR_TEXT = 0.2;
var RANDOMBACKGROUND = 0.05;
var GAUSSIAN_PARAM_TEXT = 1/200;
var ATTRACTOR_RADIUS_MIN = 1/50;
var ATTRACTOR_RADIUS_MAX = 16 * ATTRACTOR_RADIUS_MIN;
var SUBDIVISE_NOGO = 16; // decrease to subdivise more

var FONT = 'CamBam/1CamBam_Stick_2.ttf';
//var FONT = 'Codystar/Codystar-Regular.ttf';
//var FONT = 'Fredoka_One/FredokaOne-Regular.ttf';

var canvas, ctx;
var shadow;
var pixelRatio;
var colorSize;

var colors;

var pointsX, pointsY;
var canvasScreenWidth, canvasScreenHeight;
var canvasRealWidth, canvasRealHeight;
/** Array containing the info if the shadow of a given particule should be drawn */
var drawShadowAtPoint;

var attractors;
/** 
 * Special attractors are used for text and NoGo zones 
 * This is an array of segments
 */
var specialAttractors;

var hasNogoZone;

var loadedFont;

/** Stores strings of SVG paths (when config.svg is true)n*/
var svgPathArray;

/** characteristic distance of the image */
var D;

/** bounding box of the main text */
var textTopLeft, textBottomRight;

/** Bounding boxes of the no go zones */
var noGoBBoxes;
var noGoTopLeft, noGoBottomRight;

/** Array of bounding boxes aroung the special attractors **/
var specialAttractorsBoundingBoxes;

var typedText = '';

if(config.text) {
  var folder = config.root || '';
  opentype.load(folder + 'fonts/' + FONT, function(err, font) {
    console.log(font);
    loadedFont = font;
    init();
    animate();
  });
} else {
  init();
  animate();
}

window.addEventListener( 'resize', init, false );

function init() {
  initialize(config);
}

function initialize(config) {
  colors = []
  colors.push(config.color1);
  colors.push(config.color2);

  specialAttractorsBoundingBoxes = [];

  // if text string is empty, do not consider text attractors at all
  if(config.text) {
    var text = config.text;
    var cleanPath = false;
    // set cleanPath to true is the text corresponds to the clean specialAttractor
    if(text == '13   8   2016') {
      cleanPath = true;
    }
    textTopLeft = {};
    textBottomRight = {};
    specialAttractorsBoundingBoxes.push({
      topLeft: textTopLeft,
      bottomRight: textBottomRight
    });
  }

  // initialize globals
  pointsX = [];
  pointsY = [];
  drawShadowAtPoint = [];

  hasNogoZone = config.nogo_zone;
  if(hasNogoZone) {
    noGoBBoxes = [];
  }

  pixelRatio = config.pixelratio || window.devicePixelRatio || 1;

  canvas = document.getElementById(config.id);
  ctx = canvas.getContext("2d", {alpha : false});
  resizeCanvas();
  D = Math.max(canvas.width, canvas.height);

  shadow = new Image();
  var folder = config.root || '';
  shadow.src = folder + SHADOW_IMAGE + SIZE_SHADOW + 'px.png';

  paintCanvasWithBackground();

  initAttractors(config.nb_attractors, ATTRACTOR_RADIUS_MIN, ATTRACTOR_RADIUS_MAX);
  specialAttractors = [];
  if(config.text) {
    initTextSpecialAttractors(text, {x: config.text_position_x, y: config.text_position_y}, config.text_width_ratio, cleanPath, PROBABILITY_POINT_APPEARS_NEAR_TEXT);
  }
  if(hasNogoZone) {
    initNoGoZoneSpecialAttractors();
    initNoGoCirclesSpecialAttractors();
  }
  initPoints(config.particule_density);
  initDrawShadow();

  colorSize = Math.ceil(pointsX.length / colors.length);
  ctx.lineWidth = config.line_width * pixelRatio;

  if(config.svg) {
    // generate empty strings for SVG paths
    svgPathArray = [];
    for(var p = 0; p < pointsX.length; p++) {
      svgPathArray.push('');
    }
  }
}


function resizeCanvas() {
  canvasScreenWidth = canvas.clientWidth;
  canvasScreenHeight = canvas.clientHeight;
  canvasRealWidth = canvasScreenWidth * pixelRatio;
  canvasRealHeight = canvasScreenHeight * pixelRatio;

  canvas.width = canvasRealWidth;
  canvas.height = canvasRealHeight;
  //canvas.style.width = canvasScreenWidth + 'px';
  //canvas.style.height = canvasScreenHeight + 'px';
}

function paintCanvasWithBackground() {
  ctx.fillStyle = config.background_color;
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
  for(var c = 0; c < colors.length; c++) {
    ctx.beginPath();
    ctx.strokeStyle = colors[c];
    for (var i = c * colorSize; i < (c+1) * colorSize; i++ ) {
      if( Math.random() < NEW_SEED_CREATION_PROBABILITY ) {
        var newSeed = getPositionOutsideOfSpecialAttractorGaussian();
        pointsX[i] = newSeed[0];
        pointsY[i] = newSeed[1];
      }
      else {
        var oldX = pointsX[i];
        var oldY = pointsY[i];
        var newPosition = getNewPosition(oldX, oldY, i);
        ctx.moveTo(oldX,oldY);
        ctx.lineTo(newPosition[0], newPosition[1]);
        pointsX[i] = newPosition[0];
        pointsY[i] = newPosition[1];
      }
    }
    ctx.stroke();
  }

  if(config.svg) {
    for(var p = 0; p < pointsX.length; p++) {
      svgPathArray[p] += ['L', pointsX[p], ' ', pointsY[p], ' '].join('');
    }
  }

  // draw shadow
  ctx.globalAlpha = SHADOW_OPACITY;
  for (var i = 0; i < pointsX.length; i++ ) {
    if(drawShadowAtPoint[i]) {
      ctx.drawImage(shadow, pointsX[i] - DELTA_SHADOW_X * pixelRatio, pointsY[i] - DELTA_SHADOW_Y * pixelRatio, SIZE_SHADOW * pixelRatio * config.shadow_scale, SIZE_SHADOW * pixelRatio * config.shadow_scale);
    }
  }
  ctx.globalAlpha = 1.0;

}

function getNewPosition(x, y, index) {
  var fieldXY = field(x,y);

  // if distance is small, reduce probability to draw shadow
  drawShadowAtPoint[index] = true;
  if( Math.random() > (fieldXY[0]*fieldXY[0] + fieldXY[1]*fieldXY[1]) ) {
      drawShadowAtPoint[index] = false;
  }

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

  // If we are near the text, add the text contribution to the field
  if(isNearSpecialAttractor(x,y)) {
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

function isNearSpecialAttractor(x,y) {
  var near = D/8;

  for(var b = 0; b < specialAttractorsBoundingBoxes.length; b++) {
    if( x - (specialAttractorsBoundingBoxes[b].topLeft.x - near) > 0
      && x - (specialAttractorsBoundingBoxes[b].bottomRight.x + near) < 0
      && y - (specialAttractorsBoundingBoxes[b].topLeft.y - near) > 0
      && y - (specialAttractorsBoundingBoxes[b].bottomRight.y + near) < 0) {
      return true;
    }
  }
  return false;
}

/** @param particuleDensity: number of particule for a square of 1000 * 1000 pixels */
function initPoints(particuleDensity) {
  // for a device with higher pixel ratio, put more particules.
  // but do not put pixelRatio * pixelRatio more particules for performances reasons
  var nbParticules = pixelRatio * particuleDensity * canvasScreenWidth * canvasScreenHeight / 1000000
  for(var i = 0; i < nbParticules; i++) {
    //var newSeed = getPositionOutsideOfSpecialAttractorSquare(4/5);
    //var newSeed = getPositionOutsideOfSpecialAttractorGaussian();
    var newSeed = getPositionOutsideOfSpecialAttractorGaussian(config.init_scale);
    pointsX.push(newSeed[0]);
    pointsY.push(newSeed[1]);
  }
}

function initDrawShadow() {
  for(var p = 0; p < pointsX.length; p++) {
    drawShadowAtPoint.push(true);
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



function initAttractors(nbAtractors, min, max) {
  attractors = [];

  var minW = -1;
  var maxW =  1;
  var minD = min * D;
  var maxD = max * D;

  for( var a = 0; a < nbAtractors; a++) {
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

function initTextSpecialAttractors(text, textPositionPercent, textWidthRatio, cleanPath, probabilityPointAppearsNearText) {

  var textPathTopLeft = {x: Infinity, y: Infinity};
  var textPathBottomRight = {x: -Infinity, y: -Infinity};
  var fontSize = canvasRealWidth / textWidthRatio;

  // measure the size of a single character
  var path = loadedFont.getPath(text, 0, 0, fontSize);

  // get the bounding box of the text path
  for( var c = 0; c < path.commands.length; c++) {
    if (path.commands[c].x < textPathTopLeft.x) {textPathTopLeft.x = path.commands[c].x};
    if (path.commands[c].y < textPathTopLeft.y) {textPathTopLeft.y = path.commands[c].y};
    if (path.commands[c].x > textPathBottomRight.x) {textPathBottomRight.x = path.commands[c].x};
    if (path.commands[c].y > textPathBottomRight.y) {textPathBottomRight.y = path.commands[c].y};
  }
  var textWidth = textPathBottomRight.x - textPathTopLeft.x;
  var textHeight = textPathBottomRight.y - textPathTopLeft.y;
  var textX = canvasRealWidth * textPositionPercent.x / 100 - textWidth / 2;
  var textY = canvasRealHeight * textPositionPercent.y / 100 + textHeight / 2;

  textTopLeft.x = canvasRealWidth * textPositionPercent.x / 100 - textWidth / 2;
  textTopLeft.y = canvasRealHeight * textPositionPercent.y / 100 - textHeight / 2;
  textBottomRight.x = textTopLeft.x + textWidth;
  textBottomRight.y = textTopLeft.y + textHeight;

  if(DEBUG_FLAG) {
    loadedFont.drawPoints(ctx, text, textX, textY, fontSize);
  }
  var subdiviseBezier = false;
  if(textWidth > TEXT_MIN_WIDTH_TO_SUBDIVISE) {
    subdiviseBezier = true;
    probabilityPointAppearsNearText = probabilityPointAppearsNearText / 2;
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
      if( Math.random() < probabilityPointAppearsNearText ) {
        pointsX.push(textX + command1.x+Math.random()-0.5);
        pointsY.push(textY + command1.y+Math.random()-0.5);
      }

      switch(commandToExecute) {
        case "L":
          var specialAttractor = {};
          specialAttractor.x1 = textX + command1.x;
          specialAttractor.y1 = textY + command1.y;
          specialAttractor.x2 = textX + command2.x;
          specialAttractor.y2 = textY + command2.y;
          specialAttractor.radius = TEXT_ATTRACTOR_RADIUS;
          specialAttractors.push(specialAttractor);

          // if a real L (line)
          if(command2.type == "L") {
            if( Math.random() < 1 ) {
              pointsX.push(textX + command1.x+Math.random()-0.5);
              pointsY.push(textY + command1.y+Math.random()-0.5);
            }
          }
          break;
        case "Q":
          var specialAttractor = {};
          var t = 1/2;
          specialAttractor.x1 = textX + command1.x;
          specialAttractor.y1 = textY + command1.y;
          var x = bezier([t], [command1.x, command2.x1, command2.x]);
          var y = bezier([t], [command1.y, command2.y1, command2.y]);
          specialAttractor.x2 = textX + x[0];
          specialAttractor.y2 = textY + y[0];
          specialAttractor.radius = TEXT_ATTRACTOR_RADIUS;
          specialAttractors.push(specialAttractor);
          var specialAttractor2 = {};
          specialAttractor2.x1 = specialAttractor.x2;
          specialAttractor2.y1 = specialAttractor.y2;
          specialAttractor2.x2 = textX + command2.x;
          specialAttractor2.y2 = textY + command2.y;
          specialAttractor2.radius = TEXT_ATTRACTOR_RADIUS;
          specialAttractors.push(specialAttractor2);
          break;
        case "C":
          var specialAttractor = {};
          var x = bezier([1/3, 2/3], [command1.x, command2.x1, command2.x2, command2.x]);
          var y = bezier([1/3, 2/3], [command1.y, command2.y1, command2.y2, command2.y]);
          specialAttractor.x1 = textX + command1.x;
          specialAttractor.y1 = textY + command1.y;
          specialAttractor.x2 = textX + x[0];
          specialAttractor.y2 = textY + y[0];
          specialAttractor.radius = TEXT_ATTRACTOR_RADIUS;
          specialAttractors.push(specialAttractor);
          var specialAttractor2 = {};
          specialAttractor2.x1 = specialAttractor.x2;
          specialAttractor2.y1 = specialAttractor.y2;
          specialAttractor2.x2 = textX + x[1];
          specialAttractor2.y2 = textY + y[1];
          specialAttractor2.radius = TEXT_ATTRACTOR_RADIUS;
          specialAttractors.push(specialAttractor2);
          var specialAttractor3 = {};
          specialAttractor3.x1 = specialAttractor2.x2;
          specialAttractor3.y1 = specialAttractor2.y2;
          specialAttractor3.x2 = textX + command2.x;
          specialAttractor3.y2 = textY + command2.y;
          specialAttractor3.radius = TEXT_ATTRACTOR_RADIUS;
          specialAttractors.push(specialAttractor3);
          break;
        default: // "M", "Z"
      }
    }
  }
}

/** Creates a circular no go zone */
function createNoGoCircleSpecialAttractors(x, y, radius) {
  var circleSubDiv = radius * SUBDIVISE_NOGO / 20;
  for( var i = 0; i < circleSubDiv; i++ ) {
    var specialAttractor = {};
    specialAttractor.x1 = (x + radius * Math.cos(2*Math.PI / circleSubDiv * i)) * pixelRatio;
    specialAttractor.y1 = (y + radius * Math.sin(2*Math.PI / circleSubDiv * i)) * pixelRatio;
    specialAttractor.x2 = (x + radius * Math.cos(2*Math.PI / circleSubDiv * (i+1))) * pixelRatio;
    specialAttractor.y2 = (y + radius * Math.sin(2*Math.PI / circleSubDiv * (i+1))) * pixelRatio;
    specialAttractor.radius = 2 * TEXT_ATTRACTOR_RADIUS;
    specialAttractors.push(specialAttractor);
    if(DEBUG_FLAG) {
      drawHelperCircle(specialAttractor.x1, specialAttractor.y1, 1);
    }
  }

  var bbox = {
    topLeft: {
      x: (x - radius) * pixelRatio,
      y: (y - radius) * pixelRatio,
    },
    bottomRight: {
      x: (x + radius) * pixelRatio,
      y: (y + radius) * pixelRatio,
    },
  };

  specialAttractorsBoundingBoxes.push(bbox);
  noGoBBoxes.push(bbox);
}

function initNoGoCirclesSpecialAttractors() {
  if(!config.nogoCircles) {return};

  for( circle of config.nogoCircles ) {
    createNoGoCircleSpecialAttractors(circle.x, circle.y, circle.radius);
  }
}

/** creates a nogo zone from the given parameters: consig.nogoParam */
function initNoGoZoneSpecialAttractors() {
  if(!config.nogoParam) {return};

  var noGoTopLeft = {};
  var noGoBottomRight = {};
  noGoTopLeft.x = Infinity;
  noGoTopLeft.y = Infinity;
  noGoBottomRight.x = -Infinity;
  noGoBottomRight.y = -Infinity;


  // define no go zone via a few points
  var noGoZoneBox = [];
  noGoZoneBox.push({
    x: config.nogoParam.x * pixelRatio,
    y: config.nogoParam.y * pixelRatio,
    x1:0, y1:0, x2:0, y2:0});

  noGoZoneBox.push({
    x: (config.nogoParam.x + config.nogoParam.width) * pixelRatio,
    y: config.nogoParam.y * pixelRatio,
    x1:0, y1:0, x2:0, y2:0});

  noGoZoneBox.push({
    x: (config.nogoParam.x + config.nogoParam.width) * pixelRatio,
    y: (config.nogoParam.y + config.nogoParam.height) * pixelRatio,
    x1:0, y1:0, x2:0, y2:0});

  noGoZoneBox.push({
    x: config.nogoParam.x * pixelRatio,
    y: (config.nogoParam.y + config.nogoParam.height) * pixelRatio,
    x1:0, y1:0, x2:0, y2:0});

  var n = noGoZoneBox.length;

  // compute the Bezier handle
  for(var i=0; i<n; i++) {
    var P1 = noGoZoneBox[(i-1+n)%n];
    var P0 = noGoZoneBox[i];
    var P2 = noGoZoneBox[(i+1)%n];
    var L  = Math.sqrt(Math.pow(P2.x - P1.x, 2) + Math.pow(P2.y - P1.y, 2));
    var l1 = Math.sqrt(Math.pow(P0.x - P1.x, 2) + Math.pow(P0.y - P1.y, 2));
    var l2 = Math.sqrt(Math.pow(P2.x - P0.x, 2) + Math.pow(P2.y - P0.y, 2));
    P0.x1 = P0.x + (l1/3) * (P1.x - P2.x) / L;
    P0.x2 = P0.x + (l2/3) * (P2.x - P1.x) / L;
    P0.y1 = P0.y + (l1/3) * (P1.y - P2.y) / L;
    P0.y2 = P0.y + (l2/3) * (P2.y - P1.y) / L;
    noGoZoneBox[i] = P0;
  }

  // subdivise Bezier curve to create segments
  for(var i=0; i<n; i++) {
    var PS = noGoZoneBox[i];
    var PE = noGoZoneBox[(i+1)%n];
    var L = Math.sqrt(Math.pow(PE.x - PS.x, 2) + Math.pow(PE.y - PS.y, 2));
    var T = [];
    var nT = Math.ceil(L/SUBDIVISE_NOGO);
    for(var k=0; k<nT; k++) {
      T.push(k/(nT-1));
    }
    var Bx = bezier(T, [PS.x, PS.x2, PE.x1, PE.x]);
    var By = bezier(T, [PS.y, PS.y2, PE.y1, PE.y]);
    for(var j=0; j<(nT-1); j++) {
      var specialAttractor = {};
      specialAttractor.x1 = Bx[j];
      specialAttractor.y1 = By[j];
      specialAttractor.x2 = Bx[j+1];
      specialAttractor.y2 = By[j+1];
      specialAttractor.radius = 2*TEXT_ATTRACTOR_RADIUS;
      specialAttractors.push(specialAttractor);

      if (specialAttractor.x1 > noGoBottomRight.x) {noGoBottomRight.x = specialAttractor.x1};
      if (specialAttractor.y1 > noGoBottomRight.y) {noGoBottomRight.y = specialAttractor.y1};
      if (specialAttractor.x1 < noGoTopLeft.x) {noGoTopLeft.x = specialAttractor.x1};
      if (specialAttractor.y1 < noGoTopLeft.y) {noGoTopLeft.y = specialAttractor.y1};

      specialAttractorsBoundingBoxes.push({
        topLeft: noGoTopLeft,
        bottomRight: noGoBottomRight
      });
      noGoBBoxes.push({
        topLeft: noGoTopLeft,
        bottomRight: noGoBottomRight
      });

      if(DEBUG_FLAG) {
        drawHelperCircle(specialAttractor.x1, specialAttractor.y1, 1);
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
  var nSpecialAttractor = specialAttractors.length;
  var deltaMin = 0;
  var dMin = 0;
  var ox = 0;
  var oy = 0;
  for(var a=0; a<nSpecialAttractor; a++) {
    var specialAttractor = specialAttractors[a];
    var closestSegmentPoint = distanceToSegment(specialAttractor.x1, specialAttractor.y1, specialAttractor.x2, specialAttractor.y2, x, y);
    if(a == 0) {
      deltaMin = closestSegmentPoint.distance - specialAttractor.radius;
      ox = closestSegmentPoint.originX;
      oy = closestSegmentPoint.originY;
    }
    else {
      if((closestSegmentPoint.distance - specialAttractor.radius) < deltaMin) {
        deltaMin = closestSegmentPoint.distance - specialAttractor.radius;
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
  if(hasNogoZone) {
    for( let bb of noGoBBoxes ) {
      if( x - bb.topLeft.x > 0
        && x - bb.bottomRight.x < 0
        && y - bb.topLeft.y > 0
        && y - bb.bottomRight.y < 0) {
          return true;
      }
    }
  }
  else{
    return false;
  }
  return false;
}



function getPositionOutsideOfSpecialAttractorSquare(sizeRatio) {
  if(!sizeRatio) {sizeRatio = 1;}
  return getPositionOutsideOfSpecialAttractor(Math.random, sizeRatio);
}

function getPositionOutsideOfSpecialAttractorGaussian(sizeRatio) {
  if(!sizeRatio) {sizeRatio = 1;}
  return getPositionOutsideOfSpecialAttractor(normalRand, sizeRatio);
}

/**
 * @param f: function to use to return point between 0 and 1
 * @param sizeRatio: scaling factor outside out which nothing will be used
 */
function getPositionOutsideOfSpecialAttractor(f, sizeRatio) {
  if(!sizeRatio) {sizeRatio = 1;}
  while(true) {
    var x = f() * canvasRealWidth * sizeRatio + canvasRealWidth * ( 1 - sizeRatio) / 2;
    var y = f() * canvasRealHeight * sizeRatio + canvasRealHeight * ( 1 - sizeRatio) / 2;
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

/**
 * @param config.one_path: if true, will create ne <path> per line, default to false
 */
function generateSVG() {

  var getPathBegin = function(p) {
    p = p || 0;
    var c = Math.floor(p  /  colorSize);
    return ["<path fill='none' stroke='", colors[c], "' stroke-width='", config.line_width * pixelRatio, "' d='"].join('');
  }
  var pathEnd = "' />\n";

  var svgcontent = ["<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ", canvasRealWidth , " ", canvasRealHeight, "' width='", canvasRealWidth, "' height='", canvasRealHeight, "' style='background-color: ", config.background_color,";'>\n"].join('');

  if(config.one_path) {
    svgcontent += getPathBegin();
  }

  for(var s = 0; s < svgPathArray.length - 1; s++) {
    if(!config.one_path) {
      svgcontent += getPathBegin(s);
    }
    svgcontent += ["M", svgPathArray[s].substring(1)].join('');
    if(!config.one_path) {
      svgcontent += pathEnd;
    }
  }

  if(config.one_path) {
    svgcontent += pathEnd;
  }
  svgcontent += "</svg>";

  saveSVG(svgcontent, 'ninis.svg');
}

var saveSVG = (function () {
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    return function (data, fileName) {
        var blob = new Blob([data], {type: "image/svg+xml"}),
            url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
    };
}());

