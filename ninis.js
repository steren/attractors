var canvas, ctx;

var N = 1000;

var G = 100;
var mCursor = 100

var speed = 1000 / (100 * 1000 * 1000);

var mouseX = 0, mouseY = 0;

var pointsX = [];
var pointsY = [];

var lastTime;

init();
animate();

function init() {
  canvas = document.getElementById("paint");
  ctx = canvas.getContext("2d");


  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;


  for(var i = 0; i < N; i++) {
    pointsX.push(Math.random() * canvas.width);
    pointsY.push(Math.random() * canvas.height);
  }

  document.addEventListener( 'mousemove', onDocumentMouseMove, false );
  window.addEventListener( 'resize', onWindowResize, false );
}

function onWindowResize() {
  // todo resize canvas
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
    drawline(oldX, oldY, newPosition[0], newPosition[1]);

    pointsX[i] = newPosition[0];
    pointsY[i] = newPosition[1];
  }
}

function drawline(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.strokeStyle = "#F7F6F5";
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.stroke();
}

function getNewPosition(x, y, delta) {
  if(delta > 0) {
    var r2 = (x - mouseX) * (x - mouseX) + (y - mouseY) * (y - mouseY); 

    var newX, newY;
    
    if(r2 > G) {
      newX = x - G * mCursor * (x - mouseX) / (r2 * Math.sqrt(r2));
      newY = y - G * mCursor * (y - mouseY) / (r2 * Math.sqrt(r2));
    } else {
      newX = x;
      newY = y;
    }
    return [newX, newY];
  } else {
    return [x, y];
  }
}
