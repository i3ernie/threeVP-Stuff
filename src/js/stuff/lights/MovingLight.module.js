/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
import * as THREE from "../../../../node_modules/three/build/three.module.js";
import Animated from "../../extras/Animated.module.js";

const defaults = {
    shadow : true,
    size : 0.02,

    maxPosition : 1,
    minPosition : 1.25,
    
    power : 20,

    color : 0xffffee
};
    
    // ref for lumens: http://www.power-sure.com/lumens.htm
    const luminousPowers = {
            "110000 lm (1000W)" : 110000,
            "3500 lm (300W)"    : 3500,
            "1700 lm (100W)"    : 1700,
            "800 lm (60W)"      : 800,
            "400 lm (40W)"      : 400,
            "180 lm (25W)"      : 180,
            "20 lm (4W)"        : 20,
            "Off"               : 0
    };	

              
const MovingLight = function( VP, opt )
{
    this.options = Object.assign({}, defaults, opt);
    let o = this.options;

    Animated.init( VP );
    
    let geometry = new THREE.SphereGeometry( o.size, 16, 8 );
    
    let bulbMat = new THREE.MeshStandardMaterial( {
        emissive : o.color,
        emissiveIntensity : 1,
        color : 0x000000
    });	
    
    THREE.PointLight.call( this, 0xffee88, 1, 100, 2 );
    this.power = o.power;
    
    this.add( new THREE.Mesh( geometry, bulbMat ) );
    this.position.set( 0, 2, 0 );
    
    if ( o.shadow ) this.castShadow = true;
    
    this.initAnimation();
};

    //inherits from PointLight
    MovingLight.prototype = Object.assign( Object.create( THREE.PointLight.prototype ), Animated.prototype );
    MovingLight.prototype.constructor = MovingLight;
    
    MovingLight.prototype.animation = function( delta, now )
    {
        let o = this.options;
        const min = o.minPosition + o.maxPosition;
        const max = o.maxPosition - o.minPosition;
        
        this.position.y = Math.cos( Date.now() * .0005 ) * max + min;  
    };

export default MovingLight;