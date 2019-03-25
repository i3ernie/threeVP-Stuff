/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define(["three", "lodash"], function( THREE, _ )
{
    let defaults = {
        shadow : true,
        size : 0.02,
        
        maxPosition : 1,
        minPosition : 1.25,
        
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

              
    let MovingLight = function( VP, opt )
    {
        this.options = _.extend({}, defaults, opt);
        this.VP = VP;
        
        var scope = this;
        
        let geometry = new THREE.SphereGeometry( this.options.size, 16, 8 );
        
        let bulbMat = new THREE.MeshStandardMaterial( {
            emissive : this.options.color,
            emissiveIntensity : 1,
            color : 0x000000
        });	
        
        THREE.PointLight.call( this, 0xffee88, 1, 100, 2 );
        
        this.add( new THREE.Mesh( geometry, bulbMat ) );
        this.position.set( 0, 2, 0 );
        
        if ( this.options.shadow ) this.castShadow = true;
        
        this.addEventListener( "added", this.onAdded.bind(this) );
    };

    //inherits from PointLight
    MovingLight.prototype = Object.create( THREE.PointLight.prototype );
    MovingLight.prototype.constructor = MovingLight;
    
    MovingLight.prototype.onAdded = function()
    {
        let scope = this;
        const min = this.options.minPosition + this.options.maxPosition;
        const max = this.options.maxPosition - this.options.minPosition;
        
        this.VP.loop.add( function(){
          let time = Date.now() * .0005;
          scope.position.y = Math.cos( time ) * max + min;  
        });
    };
    
    return MovingLight;
});

