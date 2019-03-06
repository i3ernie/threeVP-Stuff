/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

define(["module", "lodash", "three"], function( module, _, THREE )
{
    let textureLoader = new THREE.TextureLoader();
    
    const defaults = {
        radius : .5,
        castShadow : true,
        rotationSpeed : 0.005,
        texturesPath : module.uri.substring(0, module.uri.lastIndexOf("/")+1 ) + "textures/",
        
        roughness : .5,
        metalness : 1.0
    };
    

    let Earth = function( VP, opts )
    {
        let scope = this;
        this.VP = VP;
        
        this.options = _.extend( {}, defaults, opts );
        let o = this.options;
        
        let geometry = new THREE.SphereGeometry( o.radius, 32, 32 );
        
        let ballMat = new THREE.MeshStandardMaterial( {
            color: 0xffffff,
            roughness: o.roughness,
            metalness: o.metalness
        });

        textureLoader.load( defaults.texturesPath + "earth_atmos_2048.jpg", function( map ) {
                map.anisotropy = 4;
                ballMat.map = map;
                ballMat.needsUpdate = true;
        } );

        textureLoader.load( defaults.texturesPath + "earth_specular_2048.jpg", function( map ) {
                map.anisotropy = 4;
                ballMat.metalnessMap = map;
                ballMat.needsUpdate = true;
        } );

        THREE.Mesh.call( this, geometry, ballMat );
        
        //update-loop for animation
        this.update = function(){
            scope.rotation.y -= o.rotationSpeed;
        };
        
        this.registerEvents();
        
        this.castShadow = o.castShadow;
    };
    
    //inherits from Mesh
    Earth.prototype = Object.create( THREE.Mesh.prototype );
    Object.assign( Earth.prototype, {
        constructor : Earth,
        
        /**
         * 
         * @returns {undefined}
         */
        registerEvents : function(){
            let scope = this;
            
            this.addEventListener( "added", function() {
                scope.VP.loop.add( scope.update );
            });
            this.addEventListener( "removed", function() {
                scope.VP.loop.remove( scope.update );
            });
        }
    });
    
    return Earth;
});
