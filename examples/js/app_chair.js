/**
 * Created by bernie on 27.10.15.
 */
define(["three", "lodash", "globals", "cmd", "Viewport", 
    "SkyBox", "lights/Sunlight", 
     "stuff/Chair"],
function (THREE, _, GLOBALS, CMD, Viewport, 
              SkyBox, Sunlight, Chair)
{
    let VP;
    let options;  
    
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
            let floor = new THREE.Mesh( new THREE.BoxGeometry(25, 1, 25) ); // new Floor({width:35, depth:30});
            floor.position.set( 0, -4, 0 );
            VP.scene.add(floor);
            
            let box = new Chair({name:"hardwood2", size:5});
            box.position.set( -3, 1, -3 );
            VP.scene.add( box );
            
            let box2 = new Chair({name:"brick", size:5});
            box2.position.set( 5, 1, 5 );
            VP.scene.add( box2 );
            
            
            /*
            chair.position.y = 20;
            chair.position.x = Math.random() * 50 - 25;
            chair.position.z = Math.random() * 50 - 25;

            chair.rotation.set(
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2
            );	
       */
           
         
            VP.start();
            if ( typeof done === "function" ) done( null, this );
        };

        
    };
    
    return APP;
});