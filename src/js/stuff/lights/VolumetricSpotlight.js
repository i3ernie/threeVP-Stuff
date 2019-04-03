/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define(["three", "lodash", "backbone", "./Volumetricspotlightmaterial", "extras/Animated"], function( THREE, _, Backbone, VolumetricSpotLightMaterial, Animated )
{
    let Model = Backbone.Model.extend({
        
        defaults : {
            color      : "white",
            exponent   : 30,
            angle      : Math.PI/4,
            intensity  : 1,
            penumbra   : 0.5,
            decay      : 2,
            distance   : 150,
            
            shadow : true
        },
        
        initialize : function(){}
    });
    
    let targetPos = new THREE.Vector3();
    
    let VolumetricSpotlight = function( opts )
    {        
        this.model = new Model( opts );
        let o = this.model.attributes;
        
        let geometry	= new THREE.CylinderGeometry( 0.1, 2.5, 10, 32*2, 20, true);
	//let geometry	= new THREE.CylinderGeometry( 0.1, 5*Math.cos(Math.PI/3)/1.5, 5, 32*2, 20, true);
	geometry.applyMatrix( new THREE.Matrix4().makeTranslation( 0, -geometry.parameters.height/2, 0 ) );
	geometry.applyMatrix( new THREE.Matrix4().makeRotationX( -Math.PI / 2 ) );
        
	// geometry.computeVertexNormals()
	// var geometry	= new THREE.BoxGeometry( 3, 1, 3 );
	// var material	= new THREE.MeshNormalMaterial({
	// 	side	: THREE.DoubleSide
	// });
	// var material	= new THREE.MeshPhongMaterial({
	// 	color		: 0x000000,
	// 	wireframe	: true,
	// })
	let material	= new VolumetricSpotLightMaterial();
	let mesh	= new THREE.Mesh( geometry, material );
        
        
	
	material.uniforms.lightColor.value.set( o.color );
	material.uniforms.spotPosition.value	= mesh.position;
	
        
        THREE.SpotLight.call( this );
        let scope = this;
        
        this.add( mesh );
        mesh.lookAt( this.target.getWorldPosition(targetPos) );
        
        this.color	= mesh.material.uniforms.lightColor.value;
	this.exponent	= o.exponent;
	this.angle	= o.angle;
	this.intensity	= o.intensity;
        this.penumbra   = o.penumbra;
        this.decay      = o.decay;
	this.distance   = o.distance;
        
        this.add( this.target );
        
        this.initAnimation();
        
        this.addEventListener( "added", this.onAdded );
        this.addEventListener( "removed", this.onRemoved );
    };
   
    
    VolumetricSpotlight.prototype = Object.assign( Object.create( THREE.SpotLight.prototype ), Animated.prototype, {
        constructor : VolumetricSpotlight,
        
        onAdded : function() {
        },
        
        onRemoved : function() {
        },
        
        animation : function( delta, now ){
            let angle	= 0.1 * Math.PI*2*now;
           
            this.target.position.set( 2.9*Math.cos(angle), -10, 1.9*Math.sin(angle) );
            this.children[0].lookAt( this.target.getWorldPosition(targetPos) );
	}
    });
    
    
    return VolumetricSpotlight;
});

