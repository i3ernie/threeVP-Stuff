/**
 * Created by bernie on 27.10.15.
 */
define(["three", "lodash", "globals", "cmd", "Viewport", "extras/Animated",
    "SkyBox", "lights/Sunlight", "stuff/Outbox", "stuff/lights/VolumetricSpotlight",
     "stuff/RandomObject"],
function (THREE, _, GLOBALS, CMD, Viewport, Animated,
              SkyBox, Sunlight, Outbox, VolumetricSpotlight, RandomObject)
{
    var VP;
    var options;
    
    let terrainMaxHeight = 10;
   
    let catapult;
    
    let defaults = {
        "conf" : "conf_break",
        
        "imagePath" : "../src/textures/",
        "shadow" : true,

        "objectSize"    : 3,
        "maxNumObjects" : 30,
        
        "terrainWidth" : 100,
        "terrainDepth" : 100
    };
 
    
    let hemiLight;
 
    var APP = function( opt )
    { 
        options = _.extend( {}, defaults, opt );

        this.init = function( done )
        {
            VP = GLOBALS.VP = new Viewport();
            
            Animated.init(VP);
          
           if ( typeof done === "function" ) done( null, this );
        };

        this.start = function( done )
        {  
            //camera
            VP.camera.position.set( -60, 50, -60 );
            VP.camera.lookAt( new THREE.Vector3( 0, 1, 0 ) );


            //SkyBox
            VP.scene.add( new SkyBox( options ) );


            // directional light
            let dir_light = new Sunlight( {size : 15 , debug:false} );
            dir_light.position.set( 30, 40, -5 );
            dir_light.target.position.copy( VP.scene.position );
            VP.scene.add( dir_light );

            hemiLight = new THREE.HemisphereLight( 0xddeeff, 0x0f0e0d, 0.02 );
            VP.scene.add( hemiLight );
         			
				
            //floor
            let floorMesh = new Outbox( {} );
            floorMesh.position.set( 0, -1, 0 );
            
            let spot = new VolumetricSpotlight ({});
            spot.position.set( 0, 3, 0 );
            VP.scene.add( spot );
            
          
            VP.scene.add( floorMesh );            

           
            VP.start();
            if ( typeof done === "function" ) done( null, this );
        };

    };
    
    return APP;
});