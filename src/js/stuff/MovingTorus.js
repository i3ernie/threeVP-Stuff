/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

define(["three", "lodash"], function( THREE, _ ){
    
    let defaults = {
        color	: 0xffffff,
        specular: 0xffffff,
        shininess: 200
    };
    
    let MovingTorus = function( VP, opts )
    {
        this.VP = VP;
        this.options = _.extend({}, defaults, opts);
        
        let geometry = new THREE.TorusGeometry(0.5-0.15, 0.15, 32, 32);
        let material	= new THREE.MeshPhongMaterial({
            color	: this.options.color,
            specular    : this.options.specular,
            shininess   : this.options.shininess
        });
        let scope = this;

        THREE.Mesh.call(this, geometry, material );
        this.scale.set(1, 1, 1).multiplyScalar( 5 );
        
        this._animation = function( delta, now ){ 
            let angle	= 0.1*Math.PI*2*now;
            angle	= Math.cos( angle )*Math.PI/15 + 3*Math.PI/2;
            let radius	= 30;
            scope.position.x	= Math.cos(angle)*radius;
            scope.position.y	= (radius-1)+Math.sin(angle)*radius;
            scope.position.z	= 0.1;	// Couch	
        };
        
        this.addEventListener( "added", this.onAdded.bind(this) );
        this.addEventListener( "removed", this.onRemoved.bind(this) );
    };
    
    //inherits from Mesh
    MovingTorus.prototype = Object.create( THREE.Mesh.prototype );
    MovingTorus.prototype.constructor = MovingTorus;
    
    MovingTorus.prototype.onAdded = function()
    {        
        this.VP.loop.add( this._animation );
    };
    
    MovingTorus.prototype.onRemoved = function()
    {
        this.VP.loop.remove( this._animation );
    };
    
    return MovingTorus;
});

