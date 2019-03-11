/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

define(["module", "lodash", "backbone", "three", "modifiers/SubdivisionModifier"], function( module, _, Backbone, THREE, SubdivisionModifier ){
    
    const Model = Backbone.Model.extend({
        defaults : {
            size : 1,
            color : "rgb(255, 0, 0)",
            texturePath : module.uri.substring(0, module.uri.lastIndexOf("/")+1 ) + "textures/",
            repeat : 4,
            anisotropy : 16,
            bumpScale : .01,

            "shadow" : true
        },
        
        initialize : function( opts ){
            
        },

        validate : function( attr, opts ){
            console.log( attr, opts );
        }
    });
    
    let Domino = function( opts )
    {    
        this.model = new Model( opts, {validate: true} );
        let o = this.model.attributes;
        
        let geometry	= new THREE.CubeGeometry( .5 * o.size, o.size, .2 * o.size, 3,3,3 );
        geometry.translate( 0, .5*o.size, 0 );
	let modifier = new SubdivisionModifier(2);
        let geoDomino = modifier.modify( geometry );
        
        let texture	= THREE.ImageUtils.loadTexture(o.texturePath + 'rocks.jpg');
	texture.wrapS	= texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set( o.repeat, o.repeat );
	texture.anisotropy = o.anisotropy;

        
        let material = new THREE.MeshPhongMaterial({
                map	: texture,
                bumpMap	: texture,
                bumpScale: o.bumpScale
	});
        material.color =  new THREE.Color( o.color );
                        
        THREE.Mesh.call( this, geoDomino, material );
    };
    
    Domino.prototype = Object.create( THREE.Mesh.prototype );
    Object.assign( Domino.prototype, {
        constructor : Domino.prototype
    });
    
    return Domino;
});
