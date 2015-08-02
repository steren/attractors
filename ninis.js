var camera, scene, renderer;

var geometry;

var mouseX = 0, mouseY = 0;

var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;

var lines = [];

init();
animate();

function init() {
    camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 10000 );
    camera.position.set( 0, 0, 2000 );

    scene = new THREE.Scene();

    geometry = new THREE.Geometry();
    for ( var i = 0; i < 2000; i ++ ) {
        var vertex = new THREE.Vector3();
        vertex.x = Math.random() * 4000 - 2000;
        vertex.y = Math.random() * 4000 - 2000;
        vertex.z = Math.random() * 4000 - 2000;
        geometry.vertices.push( vertex );
        geometry.colors.push( new THREE.Color( 0xF7F6F5 ) );
    }

    var material = new THREE.PointCloudMaterial({ 
      size: 1, 
      vertexColors: THREE.VertexColors, 
      //depthTest: false, 
      //opacity: 0.5, 
      sizeAttenuation: false, 
      //transparent: true 
    });


    var mesh = new THREE.PointCloud( geometry, material );
    scene.add( mesh );

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

  
  for ( var i = 0; i < geometry.vertices.length; i ++ ) {
    geometry.vertices[i].x += mouseX * .005;
    geometry.vertices[i].y += mouseY * .005;
  }
  geometry.verticesNeedUpdate = true;

  //camera.position.x += ( mouseX - camera.position.x ) * .05;
  //camera.position.y += ( - mouseY - camera.position.y ) * .05;

  camera.lookAt( scene.position );

  renderer.render( scene, camera );
}