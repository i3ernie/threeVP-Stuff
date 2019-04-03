/**
 * Created by bernie on 27.10.15.
 */
define(["three", "lodash", "globals", "cmd", "Viewport", "extras/Animated",
    "SkyBox", "lights/Sunlight", "stuff/Terrain", "stuff/lights/MovingLight",
     "stuff/RandomObject"],
function (THREE, _, GLOBALS, CMD, Viewport, Animated,
              SkyBox, Sunlight, Terrain, MovingLight, RandomObject)
{
    var VP;
    var options;
    
    let terrainMaxHeight = 10;
   
    let catapult;
    
    let defaults = {
        "conf" : "conf_break",
        
        "imagePath" : "../src/img/",
        "shadow" : true,

        "objectSize"    : 3,
        "maxNumObjects" : 30,
        
        "terrainWidth" : 100,
        "terrainDepth" : 100
    };
   
    let time = 0;
    let objectTimePeriod = 2;
    let timeNextSpawn = time + objectTimePeriod;
    
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
            let floorMesh = new Terrain( {width : options.terrainWidth, depth : options.terrainDepth} );
            floorMesh.position.set( 0, -5, 0 );
            
            VP.scene.add( new MovingLight ( {maxPosition : 10, size :1}) );
            
          
            VP.scene.add( floorMesh );
            
            let floor = new THREE.Mesh( new THREE.BoxGeometry(35, 1, 35) ); // new Floor({width:35, depth:30});
            floor.position.set( 0, 4, 0 );
            //floor.userData.breakable = true;
         

           
            VP.start();
            if ( typeof done === "function" ) done( null, this );
        };

        function generateObject() 
        {            		
            let threeObject = new RandomObject({ objectSize : options.objectSize });             
            threeObject.position.set( ( Math.random() - 0.5 ) * options.terrainWidth * 0.6, terrainMaxHeight + options.objectSize + 2, ( Math.random() - 0.5 ) * options.terrainDepth * 0.6 );

        
            VP.scene.add( threeObject );
        }
    };
    
    return APP;
});