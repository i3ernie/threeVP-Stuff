define(["three", "lodash"], function( THREE, _ ){
    
    const defaults = {
        color		: 0x4444aa
    };

    let LaserBeam	= function( opts )
    {
	let scope	= this;
        
        this.options = _.extend({}, defaults, opts);
        let o = this.options;
        
	THREE.Object3D.call( this );
	// generate the texture
	var canvas	= generateLaserBodyCanvas();
	var texture	= new THREE.Texture( canvas );
	texture.needsUpdate	= true;
	// do the material	

        let material = new THREE.MeshBasicMaterial({
		map		: texture,
		blending	: THREE.AdditiveBlending,
		color		: o.color,
		side		: THREE.DoubleSide,
		depthWrite	: false,
		transparent	: true
	});
        
	let geometry	= new THREE.PlaneGeometry(1, 0.1);
	let nPlanes	= 16;

        for( let i = 0; i < nPlanes; i++ ){
		let mesh = new THREE.Mesh( geometry, material );
		mesh.position.x	= 1/2;
		mesh.rotation.x	= i/nPlanes * Math.PI;
		scope.add( mesh );
	}
	
	function generateLaserBodyCanvas( options ){
            // init canvas
            let canvas	= document.createElement( 'canvas' );
            let context	= canvas.getContext( '2d' );
		
            canvas.width	= 1;
            canvas.height	= 64;
            
            // set gradient
            let gradient	= context.createLinearGradient(0, 0, canvas.width, canvas.height);		
            gradient.addColorStop( 0  , 'rgba(  0,  0,  0,0.1)' );
            gradient.addColorStop( 0.1, 'rgba(160,160,160,0.3)' );
            gradient.addColorStop( 0.5, 'rgba(255,255,255,0.5)' );
            gradient.addColorStop( 0.9, 'rgba(160,160,160,0.3)' );
            gradient.addColorStop( 1.0, 'rgba(  0,  0,  0,0.1)' );
            
            // fill the rectangle
            context.fillStyle	= gradient;
            context.fillRect(0,0, canvas.width, canvas.height);
            
            // return the just built canvas 
            return canvas;	
	}
    };
    
    //inherit from THREE.Object3D
    LaserBeam.prototype = Object.assign( Object.create( THREE.Object3D.prototype ),
    {
        constructor : LaserBeam
    });
    
    return LaserBeam;

});
