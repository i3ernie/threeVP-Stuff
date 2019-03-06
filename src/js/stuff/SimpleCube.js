/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define(["three", "module"], function( THREE, module )
{ 
    var textureLoader = new THREE.TextureLoader();

    var options = {
        size : .5,
        texturesPath : module.uri.substring(0, module.uri.lastIndexOf("/")+1 ) + "textures/"
    };

    var mat = new THREE.MeshStandardMaterial( {
            roughness: 0.7,
            color: 0xffffff,
            bumpScale: 0.002,
            metalness: 0.2
    });
    textureLoader.load( options.texturesPath + "brick_diffuse.jpg", function( map ) {
            map.wrapS = THREE.RepeatWrapping;
            map.wrapT = THREE.RepeatWrapping;
            map.anisotropy = 4;
            map.repeat.set( 1, 1 );
            mat.map = map;
            mat.needsUpdate = true;
    });
    textureLoader.load( options.texturesPath + "brick_bump.jpg", function( map ) {
            map.wrapS = THREE.RepeatWrapping;
            map.wrapT = THREE.RepeatWrapping;
            map.anisotropy = 4;
            map.repeat.set( 1, 1 );
            mat.bumpMap = map;
            mat.needsUpdate = true;
    });

    var Cube = function( opt ){
        this.options = _.extend({}, options, opt);
        var geo = new THREE.BoxGeometry( this.options.size, this.options.size, this.options.size );
        THREE.Mesh.call( this, geo, mat );
        this.castShadow = true;
    };

    //inherits from Mesh
    Cube.prototype = Object.create( THREE.Mesh.prototype );
    Cube.prototype.constructor = Cube;
    Cube.prototype.super = THREE.Mesh;
    
    return Cube;
});

