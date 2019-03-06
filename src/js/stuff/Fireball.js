/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


define(["module", "three", "lodash", "text!./shader/fireball_fragment.shader", "text!./shader/fireball_vertex.shader"], 
function( module, THREE, _, fragment, vertexShader )
{
    let defaults = {
        texturePath : module.uri.substring(0, module.uri.lastIndexOf("/")+1 ) + "textures/",
        radius : 60,
        
        baseSpeed : 0.02, // multiplier for distortion speed 	
        noiseScale : 0.5, // magnitude of noise effect
	blendSpeed : 0.01, // multiplier for distortion speed 
	blendOffset : 0.25 // adjust lightness/darkness of blended texture
    };
    
    let Fireball = function( VP, opt )
    {
        let scope = this;
        let clock = new THREE.Clock();
        
        this.VP = VP;
        this.options = _.extend( {}, defaults, opt );
        let o = this.options;
        
        let textureLoader = new THREE.TextureLoader();
        
        // base image texture for mesh
	let lavaTexture = textureLoader.load( o.texturePath+'lava.jpg');
	lavaTexture.wrapS = lavaTexture.wrapT = THREE.RepeatWrapping; 
        	
	// number of times to repeat texture in each direction
	let repeatS = repeatT = 4.0;
	
	// texture used to generate "randomness", distort all other textures
	let noiseTexture = textureLoader.load( o.texturePath+'cloud.png' );
	noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping; 
	
	// texture to additively blend with base image texture
	var blendTexture = textureLoader.load( o.texturePath+'lava.jpg' );
	blendTexture.wrapS = blendTexture.wrapT = THREE.RepeatWrapping; 
	

	// texture to determine normal displacement
	var bumpTexture = noiseTexture;
	bumpTexture.wrapS = bumpTexture.wrapT = THREE.RepeatWrapping; 
	
        // multiplier for distortion speed 		
	var bumpSpeed   = 0.15;
	// magnitude of normal displacement
	var bumpScale   = 40.0;

	this.customUniforms = {
		baseTexture: 	{ type: "t", value: lavaTexture },
		baseSpeed:	{ type: "f", value: o.baseSpeed },
		repeatS:	{ type: "f", value: repeatS },
		repeatT:	{ type: "f", value: repeatT },
		noiseTexture:	{ type: "t", value: noiseTexture },
		noiseScale:	{ type: "f", value: o.noiseScale },
		blendTexture:	{ type: "t", value: blendTexture },
		blendSpeed: 	{ type: "f", value: o.blendSpeed },
		blendOffset: 	{ type: "f", value: o.blendOffset },
		bumpTexture:	{ type: "t", value: bumpTexture },
		bumpSpeed: 	{ type: "f", value: bumpSpeed },
		bumpScale: 	{ type: "f", value: bumpScale },
		alpha: 		{ type: "f", value: 1.0 },
		time: 		{ type: "f", value: 1.0 }
	};
	
	// create custom material from the shader code above
	//   that is within specially labeled script tags
	let customMaterial = new THREE.ShaderMaterial( 
	{
	    uniforms: this.customUniforms,
		vertexShader:   vertexShader,
		fragmentShader: fragment
	} );
		
	var ballGeometry = new THREE.SphereGeometry( this.options.radius, 64, 64 );
	THREE.Mesh.call(this, ballGeometry, customMaterial );
        
        
        this.update = function(){
            let delta = clock.getDelta();
            scope.customUniforms.time.value += delta;
        };
        
        this.registerEvents();
    };
    
    Fireball.prototype = _.create( THREE.Mesh.prototype, {
        constructor : Fireball,
        registerEvents : function(){
            let scope = this;
            
            this.addEventListener("added", function( obj ){
                console.log( obj );
                scope.VP.loop.add( scope.update );
                //add update
            });
            
            this.addEventListener("removed", function(){
                //remove update
                scope.VP.loop.remove( scope.update );
            });
        }
    });
    
    return Fireball;
});