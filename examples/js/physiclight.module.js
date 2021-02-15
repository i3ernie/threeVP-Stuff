import * as THREE from "../../node_modules/three/build/three.module.js";
import { Viewport } from "../../node_modules/three-viewport/dist/viewport.es.js";

import { Reflector } from '../../node_modules/three/examples/jsm/objects/Reflector.js';

import MovingLight from "../../src/js/stuff/lights/MovingLight.module.js";

var floorMat, VP, floorMesh, hemiLight;

const init = function(){
    VP = new Viewport();
    VP.init();
    VP.camera.position.set( 0, 10, 10 );

    hemiLight = new THREE.HemisphereLight( 0xddeeff, 0x0f0e0d, 0.1 );
	VP.scene.add( hemiLight );

    VP.scene.add( new MovingLight ( VP, {maxPosition : 2, minPosition: .1, size :.2}) );


    floorMat = new THREE.MeshStandardMaterial({
        roughness: 0.8,
        color: 0xffffff,
        metalness: 0.2,
        bumpScale: 0.0005
    });

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load( "textures/hardwood2_diffuse.jpg", function ( map ) {

        map.wrapS = THREE.RepeatWrapping;
        map.wrapT = THREE.RepeatWrapping;
        map.anisotropy = 4;
        map.repeat.set( 10, 24 );
        map.encoding = THREE.sRGBEncoding;
        floorMat.map = map;
        floorMat.needsUpdate = true;

    } );
    textureLoader.load( "textures/hardwood2_bump.jpg", function ( map ) {

        map.wrapS = THREE.RepeatWrapping;
        map.wrapT = THREE.RepeatWrapping;
        map.anisotropy = 4;
        map.repeat.set( 10, 24 );
        floorMat.bumpMap = map;
        floorMat.needsUpdate = true;

    } );
    textureLoader.load( "textures/hardwood2_roughness.jpg", function ( map ) {

        map.wrapS = THREE.RepeatWrapping;
        map.wrapT = THREE.RepeatWrapping;
        map.anisotropy = 4;
        map.repeat.set( 10, 24 );
        floorMat.roughnessMap = map;
        floorMat.needsUpdate = true;

    } );


    floorMesh = new THREE.Mesh( new THREE.PlaneGeometry( 20, 20 ), floorMat );
    floorMesh.receiveShadow = true;
    floorMesh.material.transparent = true;
    floorMesh.material.opacity = .8;
    floorMesh.rotation.x = - Math.PI / 2.0;
    VP.scene.add( floorMesh );

    const WIDTH = window.innerWidth;
	const HEIGHT = window.innerHeight;

    const groundMirror = new Reflector( new THREE.PlaneGeometry( 20, 20 ), {
        clipBias: 0.003,
        textureWidth: WIDTH * window.devicePixelRatio,
        textureHeight: HEIGHT * window.devicePixelRatio,
        color: 0x888888
    } );
    
    groundMirror.position.set(0, -.01, 0);
    groundMirror.rotateX( - Math.PI / 2.0 );
    VP.scene.add( groundMirror );

    const mirror = new Reflector( new THREE.PlaneGeometry( 8, 5 ), {
        clipBias: 0.003,
        textureWidth: WIDTH * window.devicePixelRatio,
        textureHeight: HEIGHT * window.devicePixelRatio,
        color: 0x777777
    } );
    mirror.position.set(2.0, 2.8, -5.5);
    mirror.castShadow = true;
    VP.scene.add( mirror );

    const mirror2 = new Reflector( new THREE.PlaneGeometry( 8, 5 ), {
        clipBias: 0.003,
        textureWidth: WIDTH * window.devicePixelRatio,
        textureHeight: HEIGHT * window.devicePixelRatio,
        color: 0x777777
    } );
    mirror2.rotateY( - Math.PI / 2.0 );
    mirror2.position.set(7.0, 2.8, -0.5);
    mirror2.castShadow = true;
    VP.scene.add( mirror2 );

    let ballMat = new THREE.MeshStandardMaterial( {
        color: 0xffffff,
        roughness: 0.5,
        metalness: 1.0
    } );
    textureLoader.load( "textures/planets/earth_atmos_2048.jpg", function ( map ) {

        map.anisotropy = 4;
        map.encoding = THREE.sRGBEncoding;
        ballMat.map = map;
        ballMat.needsUpdate = true;

    } );
    textureLoader.load( "textures/planets/earth_specular_2048.jpg", function ( map ) {

        map.anisotropy = 4;
        map.encoding = THREE.sRGBEncoding;
        ballMat.metalnessMap = map;
        ballMat.needsUpdate = true;

    } );

    const ballGeometry = new THREE.SphereGeometry( 0.35, 32, 32 );
    const ballMesh = new THREE.Mesh( ballGeometry, ballMat );
    ballMesh.position.set( 1, 0.35, 1 );
    ballMesh.rotation.y = Math.PI;
    ballMesh.castShadow = true;
    VP.scene.add( ballMesh );

    VP.loop.add(function(){
        ballMesh.rotation.y += .01;
    });

    VP.start();
};

init();