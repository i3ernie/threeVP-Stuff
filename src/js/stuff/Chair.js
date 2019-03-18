/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


define(["module", "three", "backbone"], function( module, THREE, Backbone ){
        
    const buildLegs = function( options ) {
        let leg, _leg;
        let o = options;

        // back left
        leg = new THREE.Mesh(
                new THREE.BoxGeometry( .5, 4, .5 ),
                o.chair_material
        );
        leg.position.x = 2.25;
        leg.position.z = -2.25;
        leg.position.y = -2.5;
        leg.castShadow = o.shadow;
        leg.receiveShadow = o.shadow;

        // back right - relative to back left leg
        _leg = new THREE.Mesh(
                new THREE.BoxGeometry( .5, 4, .5 ),
                o.chair_material
        );
        _leg.position.x = -4.5;
        _leg.castShadow = o.shadow;
        _leg.receiveShadow = o.shadow;
        leg.add( _leg );

        // front left - relative to back left leg
        _leg = new THREE.Mesh(
                new THREE.BoxGeometry( .5, 4, .5 ),
                o.chair_material
        );
        _leg.position.z = 4.5;
        _leg.castShadow = o.shadow;
        _leg.receiveShadow = o.shadow;
        leg.add( _leg );

        // front right - relative to back left leg
        _leg = new THREE.Mesh(
                new THREE.BoxGeometry( .5, 4, .5 ),
                o.chair_material
        );
        _leg.position.x = -4.5;
        _leg.position.z = 4.5;
        _leg.castShadow = o.shadow;
        _leg.receiveShadow = o.shadow;
        leg.add( _leg );

        return leg;
    };
    
    const buildBack = function( options ) 
    {
        let o = options;
        let back, _object;

            back = new THREE.Mesh(
                    new THREE.BoxGeometry( 5, 1, .5 ),
                    o.chair_material
            );
            back.position.y = 5;
            back.position.z = -2.5;
            back.castShadow = o.shadow;
            back.receiveShadow = o.shadow;

            // rungs - relative to back
            _object = new THREE.Mesh(
                    new THREE.BoxGeometry( 1, 5, .5 ),
                    o.chair_material
            );
            _object.position.y = -3;
            _object.position.x = -2;
            _object.castShadow = o.shadow;
            _object.receiveShadow = o.shadow;
            back.add( _object );

            _object = new THREE.Mesh(
                    new THREE.BoxGeometry( 1, 5, .5 ),
                    o.chair_material
            );
            _object.position.y = -3;
            _object.castShadow = o.shadow;
            _object.receiveShadow = o.shadow;
            back.add( _object );

            _object = new THREE.Mesh(
                    new THREE.BoxGeometry( 1, 5, .5 ),
                    o.chair_material
            );
            _object.position.y = -3;
            _object.position.x = 2;
            _object.castShadow = o.shadow;
            _object.receiveShadow = o.shadow;
            back.add( _object );

            return back;
    };
    
    const Model = Backbone.Model.extend({
        defaults : {
            size : 1,

            color : "rgb(128, 128, 128)",
            texturePath : module.uri.substring(0, module.uri.lastIndexOf("/")+1 ) + "textures/",
            texture : "wood.jpg",
            repeat : 4,
            anisotropy : 16,
            bumpScale : .01,

            "shadow" : true
        },
        
        initialize : function( opts ){
            
        },

        validate : function( attr, opts ){
           
        }
    });


    let Chair = function( options ) 
    {			
        let back, legs;
        
        this.model = new Model( options, {validate: true} );
        let o = this.model.attributes;
        
        let texture	= THREE.ImageUtils.loadTexture(o.texturePath + o.texture);
        
        o.chair_material =  new THREE.MeshPhongMaterial({
            map	: texture
        });
        o.chair_material.color =  new THREE.Color( o.color );
        
        // seat of the chair
        THREE.Mesh.call( this, 
            new THREE.BoxGeometry( 5, 1, 5 ),
            o.chair_material
        );

        this.castShadow = o.shadow;
        this.receiveShadow = o.shadow;

        // back - relative to chair ( seat )
        back = buildBack( o );
        this.add( back );

         //legs - relative to chair ( seat )
        legs = buildLegs( o );
        this.add( legs );
        
    };
    
    Chair.prototype = Object.assign( Object.create( THREE.Mesh.prototype ),
    {
        constructor : Chair.prototype
    });
	    
    return Chair;
});