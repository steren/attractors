var camera, scene, renderer;

//var geometry;

var mouseX = 0, mouseY = 0;

var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;

var lineGeometries = [];

init();
animate();

function init() {
    camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 10000 );
    camera.position.set( 0, 0, 2000 );

    scene = new THREE.Scene();

    var material = new THREE.LineBasicMaterial({color: 0xF7F6F5, linewidth: 1});

    for ( var i = 0; i < 2000; i ++ ) {
      var geometry = new THREE.Geometry();
      var vertex = new THREE.Vector3();
      vertex.x = Math.random() * 4000 - 2000;
      vertex.y = Math.random() * 4000 - 2000;
      vertex.z = Math.random() * 4000 - 2000;
      geometry.vertices.push(
          vertex,
          new THREE.Vector3( vertex.x, vertex.y, vertex.z )
      );
      lineGeometries.push( geometry );

      var line = new THREE.Line( geometry, material );
      scene.add( line );
      
    }

    camera.lookAt( scene.position );

    renderer = new THREE.WebGLRenderer( { preserveDrawingBuffer: true, alpha: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.sortObjects = false;
    renderer.autoClearColor = false;

    document.body.appendChild( renderer.domElement );
   

    document.addEventListener( 'mousemove', onDocumentMouseMove, false );

    window.addEventListener( 'resize', onWindowResize, false );

}

function onWindowResize() {
    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
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
  for (var i = 0; i < lineGeometries.length; i++ ) {
    lineGeometries[i].vertices[0].x = lineGeometries[i].vertices[1].x;
    lineGeometries[i].vertices[0].y = lineGeometries[i].vertices[1].y;
    lineGeometries[i].vertices[0].z = lineGeometries[i].vertices[1].z;

    lineGeometries[i].vertices[1].x += mouseX * .05;
    lineGeometries[i].vertices[1].y += mouseY * .05;

    lineGeometries[i].verticesNeedUpdate = true;
  }
  renderer.render( scene, camera );
}