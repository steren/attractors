var canvas, ctx;

var N = 2000;

var mouseX = 0, mouseY = 0;

var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;

var pointsX = [];
var pointsY = [];

init();
animate();

function init() {
  canvas = document.getElementById("paint");
  ctx = canvas.getContext("2d");


  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;


  for(var i = 0; i < N; i++) {
    pointsX.push(Math.random() * canvas.width - canvas.width / 2);
    pointsY.push(Math.random() * canvas.height - canvas.height / 2);
  }

  document.addEventListener( 'mousemove', onDocumentMouseMove, false );
  window.addEventListener( 'resize', onWindowResize, false );
}

function onWindowResize() {
  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;
    // todo resize canvas
}

function onDocumentMouseMove(event) {
  mouseX = ( event.clientX - windowHalfX );
  mouseY = ( event.clientY - windowHalfY );
}


function animate() {
  requestAnimationFrame( animate );
  render();
}

function render() {
  for (var i = 0; i < pointsX.length; i++ ) {
    var oldX = pointsX[i];
    var oldY = pointsY[i];
    var newX = oldX + mouseX * .05;
    var newY = oldY + mouseY * .05;
    drawline(oldX, oldY, newX, newY);

    pointsX[i] = newX;
    pointsY[i] = newY;
  }
}

function drawline(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.strokeStyle = "#F7F6F5";
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.stroke();
}