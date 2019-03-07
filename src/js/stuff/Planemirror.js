/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

define(["three", "lodash", "vendor/three/extras/Reflector"], function( THREE, _, Reflector ){
    
    let defaults = {
        width : 100,
        heigth : 100,
        radius : 40,
        shape : "plane",
        
        clipBias : 0.003,
        color: 0x777777,
        recursion : 1
    };
    
    let Planemirror = function( opts ){
        
        this.options = _.extend( {}, defaults, opts );
        let o = this.options;
        let geo;
        
        switch ( o.shape ) {
            case "plane" : 
                geo = new THREE.PlaneBufferGeometry( o.width, o.heigth );
                break;
            case "circle" :
                geo = new THREE.CircleBufferGeometry( o.radius, 64 );
                break;
            default :
                geo = new THREE.PlaneBufferGeometry( o.width, o.heigth );
        }
       
        
        let WIDTH = window.innerWidth;
	let HEIGHT = window.innerHeight;
        
        Reflector.call( this, geo, {
                clipBias: o.clipBias,
                textureWidth: WIDTH * window.devicePixelRatio,
                textureHeight: HEIGHT * window.devicePixelRatio,
                color: o.color,
                recursion: o.recursion
        } );
    };
    
    Planemirror.prototype = Object.create( Reflector.prototype );
    
    Object.assign( Planemirror.prototype, {
        constructor : Planemirror
    });
    
    return Planemirror;
});
