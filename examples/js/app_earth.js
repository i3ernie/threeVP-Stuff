/**
 * Created by bernie on 27.10.15.
 */
define(["three", "lodash", "globals", "cmd", "Viewport", 
    "SkyBox", "lights/Sunlight", "stuff/Terrain", 
     "stuff/Earth"],
function (THREE, _, GLOBALS, CMD, Viewport, 
              SkyBox, Sunlight, Terrain, Earth)
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
         			
            
            let floor = new THREE.Mesh( new THREE.BoxGeometry(35, 1, 35) ); // new Floor({width:35, depth:30});
            floor.position.set( 0, 4, 0 );
            //floor.userData.breakable = true;
            
            let ball = new Earth( VP, {radius:30} );
            VP.scene.add( ball );

           
            VP.start();
            if ( typeof done === "function" ) done( null, this );
        };

        
    };
    
    return APP;
});