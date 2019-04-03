/**
 * Created by bernie on 27.10.15.
 */
define(["three", "lodash", "globals", "cmd", "Viewport", "extras/Animated",
     "stuff/Outbox", "stuff/MovingTorus",
     "stuff/lights/Lasercooked"],
function (THREE, _, GLOBALS, CMD, Viewport, Animated,
              Outbox, MovingTorus, LaserCooked )
{
    var VP;
    var options;
    
    let defaults = {
        "conf" : "conf_break",
        
        "imagePath" : "../src/img/",
        "shadow" : true,

        "objectSize"    : 3,
        "numLasers" : 14,
        
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
            
            Animated.init( VP );
          
           if ( typeof done === "function" ) done( null, this );
        };

        this.start = function( done )
        {  
            //camera
            VP.camera.position.set( 0, 1, 10 );
            VP.camera.lookAt( new THREE.Vector3( 0, 1, 0 ) );
           
            //scenelight
            hemiLight = new THREE.HemisphereLight( 0xfffff0, 0x101020, 0.2 );
            hemiLight.position.set(0.75, 1, 0.25);
            VP.scene.add( hemiLight );
            
            //laser
            for( let i = 0; i < options.numLasers; i++ ){
                (function(){
                        
                    let laserCooked	= new LaserCooked( VP, {} );
                    let object3d	= laserCooked.object3d;

                    VP.scene.add( object3d );
                    object3d.position.x	= (i-options.numLasers/2)/2;			
                    object3d.position.y	= 4;
                    object3d.rotation.z	= -Math.PI/2;			
                })();
            }
				
            //floor
            let floorMesh = new Outbox( {} );
            floorMesh.position.set( 0, 0, 0 );
            VP.scene.add( floorMesh );
               
            //MovingTorus
            VP.scene.add( new MovingTorus (VP, {}) );
         
            VP.start();
            if ( typeof done === "function" ) done( null, this );
        };

      
    };
    
    return APP;
});