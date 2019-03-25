/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


define(["three", "lodash"], function( THREE, _ ){
    
    const defaults = {
        color	: 0xaa8888,
        specular: 0xffffff,
        shininess: 100
    };
    
    let Outbox = function( opts ){
        this.options = _.extend( {}, defaults, opts );
        let geometry	= new THREE.CubeGeometry( 1, 1, 1 );
        let material	= new THREE.MeshPhongMaterial({
                color	: 0xaa8888,
                specular: 0xffffff,
                shininess: 100,
                side	: THREE.BackSide
        });
        THREE.Mesh.call(this, geometry, material );
        this.scale.set(10,8,10);
    };
    
    //inherits from Mesh
    Outbox.prototype = Object.create( THREE.Mesh.prototype );
    Outbox.prototype.constructor = Outbox;
    
    return Outbox;
});