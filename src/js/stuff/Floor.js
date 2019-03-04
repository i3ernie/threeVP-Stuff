/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define(["three", "lodash", "module"], function( THREE, _, module ){

    let textureLoader = new THREE.TextureLoader();

    var options = {
        texturePath : module.uri.substring(0, module.uri.lastIndexOf("/")+1 ) + "textures/"
    };
    
    let defaults = {
        shadow : true,
        width : 20,
        depth : 20
    };
    
    let floorMat = new THREE.MeshStandardMaterial({
                roughness: 0.8,
                color: 0xffffff,
                metalness: 0.2,
                bumpScale: 0.0005
    });
    
    textureLoader.load( options.texturePath + "hardwood2_diffuse.jpg", function( map ) {
            map.wrapS = THREE.RepeatWrapping;
            map.wrapT = THREE.RepeatWrapping;
            map.anisotropy = 4;
            map.repeat.set( 10, 24 );
            floorMat.map = map;
            floorMat.needsUpdate = true;
    } );
    textureLoader.load( options.texturePath + "hardwood2_bump.jpg", function( map ) {
            map.wrapS = THREE.RepeatWrapping;
            map.wrapT = THREE.RepeatWrapping;
            map.anisotropy = 4;
            map.repeat.set( 10, 24 );
            floorMat.bumpMap = map;
            floorMat.needsUpdate = true;
    } );
    
    textureLoader.load( options.texturePath + "hardwood2_roughness.jpg", function( map ) {
            map.wrapS = THREE.RepeatWrapping;
            map.wrapT = THREE.RepeatWrapping;
            map.anisotropy = 4;
            map.repeat.set( 10, 24 );
            floorMat.roughnessMap = map;
            floorMat.needsUpdate = true;
    } );
                                
    var Floor = function( opt ){
        this.options = _.extend({}, defaults, opt);
        var geometry = new THREE.PlaneBufferGeometry( this.options.width, this.options.depth );
        THREE.Mesh.call(this, geometry, floorMat );
        this.rotation.x = -Math.PI / 2.0;
        
        if ( this.options.shadow ) this.receiveShadow = true;
        
    };
    
    //inherits from Mesh
    Floor.prototype = Object.create( THREE.Mesh.prototype );
    Floor.prototype.constructor = Floor;
    Floor.prototype.super = THREE.Mesh;
    
    return Floor;
});

