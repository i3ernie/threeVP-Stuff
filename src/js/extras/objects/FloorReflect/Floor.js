/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define(["three", "module", "lodash", "extras/Planemirror", "objects/Floor/Floor"], function( THREE, module, _, Planemirror, Floor )
{ 
    var options = {
            size : [ 20, 20 ],
            biasMirror : .5,
            reflection : .1
    };
        
    var FloorR = function( VP, opt )
    {
        Floor.call( this, _.extend({}, options, opt) );

        this.material.transparent = true;
        this.material.opacity = 1 - this.options.reflection;

        // MIRROR planes
        this.mirrorMesh = new Planemirror( VP, { size:this.options.size, type : "group" } );
        this.mirrorMesh.position.z = -this.options.biasMirror;
        //this.mirrorMesh.rotateX( - Math.PI / 2 );
        this.add( this.mirrorMesh );
    };

    //inherits from Mesh
    FloorR.prototype = Object.create( Floor.prototype );
    FloorR.prototype.constructor = FloorR;
    FloorR.prototype.super = THREE.Floor;

    return FloorR;
});

