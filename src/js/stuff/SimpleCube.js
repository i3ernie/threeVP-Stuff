/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define(["module", "three", "lodash"], function( module, THREE, _ )
{ 
    var textureLoader = new THREE.TextureLoader();

    var defaults = {
        name : "brick",
        size : 1,
        castShadow : true,
        texturesPath : module.uri.substring(0, module.uri.lastIndexOf("/")+1 ) + "textures/",
        textureRepeat : [1,1],
        textureAnisotropy : 4,
        roughness : .7,
        bumpScale: 0.002
    };

    let Cube = function( opt ){
        this.options = _.extend({}, defaults, opt);
        let o = this.options;
        
        var mat = new THREE.MeshStandardMaterial( {
            roughness: o.roughness,
            color: 0xffffff,
            bumpScale: o.bumpScale,
            metalness: 0.2
        });
        
        textureLoader.load( o.texturesPath + o.name + "_diffuse.jpg", function( map ) {
                map.wrapS = THREE.RepeatWrapping;
                map.wrapT = THREE.RepeatWrapping;
                map.anisotropy = o.textureAnisotropy;
                map.repeat.set( o.textureRepeat[0], o.textureRepeat[1] );
                mat.map = map;
                mat.needsUpdate = true;
        });
        textureLoader.load( o.texturesPath + o.name + "_bump.jpg", function( map ) {
                map.wrapS = THREE.RepeatWrapping;
                map.wrapT = THREE.RepeatWrapping;
                map.anisotropy = o.textureAnisotropy;
                map.repeat.set( o.textureRepeat[0], o.textureRepeat[1] );
                mat.bumpMap = map;
                mat.needsUpdate = true;
        });
    
        var geo = new THREE.BoxGeometry( o.size, o.size, o.size );
        THREE.Mesh.call( this, geo, mat );
        
        this.castShadow = o.castShadow;
    };

    //inherits from Mesh
    Cube.prototype = Object.create( THREE.Mesh.prototype );
    Cube.prototype.constructor = Cube;
    
    return Cube;
});

