/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

define(["three", "lodash", "backbone", "extras/Animated"], function( THREE, _, Backbone, Animated ){
    
    const Model = Backbone.Model.extend({
            defaults : {
            color	: 0xffffff,
            specular: 0xffffff,
            shininess: 200,
            radius : .5,
            tube : .15
        }
    });
    
    
    let MovingTorus = function( VP, opts )
    {
        this.VP = VP;
        this.model = new Model( opts );

        let o = this.model.attributes;

        let geometry = new THREE.TorusGeometry( o.radius-o.tube, o.tube, 32, 32 );
        let material	= new THREE.MeshPhongMaterial({
            color	: o.color,
            specular    : o.specular,
            shininess   : o.shininess
        });

        THREE.Mesh.call(this, geometry, material );
        this.scale.set(1, 1, 1).multiplyScalar( 5 );

        this.initAnimation();

        this.addEventListener( "added", this.onAdded );
        this.addEventListener( "removed", this.onRemoved );
    };

    //inherits from Mesh
    MovingTorus.prototype = Object.assign( Object.create( THREE.Mesh.prototype ), Animated.prototype,
    {
        constructor : MovingTorus,

        animation : function( delta, now ){ 
            let angle	= 0.1*Math.PI*2*now;
            angle	= Math.cos( angle )*Math.PI/15 + 3*Math.PI/2;
            let radius	= 30;
            this.position.x	= Math.cos(angle)*radius;
            this.position.y	= (radius-1)+Math.sin(angle)*radius;
            this.position.z	= 0.1;	// Couch	
        }
    });

    MovingTorus.prototype.onAdded = function() {        
    };

    MovingTorus.prototype.onRemoved = function() {
    };

    return MovingTorus;
});
