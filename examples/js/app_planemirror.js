/**
 * Created by bernie on 27.10.15.
 */
define(["three", "lodash", "globals", "cmd", "Viewport", 
    "SkyBox", "lights/Sunlight", "stuff/Terrain", 
     "stuff/Planemirror"],
function (THREE, _, GLOBALS, CMD, Viewport, 
              SkyBox, Sunlight, Terrain, Planemirror)
{
    var VP;
    var options;
    
    
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
            VP.camera.position.set( 60, 50, 60 );
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
            
            VP.scene.add( floorMesh );
            
            let mirror1 = new Planemirror();
            mirror1.position.set(0, 0, -65);
            VP.scene.add( mirror1 );
            
            
            let mirror2 = new Planemirror({shape:"circle"});
            mirror2.position.set(65, 0, 0);
            mirror2.rotateY( - Math.PI / 2 );
            VP.scene.add( mirror2 );
            
           
            let floor = new THREE.Mesh( new THREE.BoxGeometry(35, 1, 35) ); // new Floor({width:35, depth:30});
            floor.position.set( 0, 4, 0 );
            //floor.userData.breakable = true;
         
           
            VP.start();
            if ( typeof done === "function" ) done( null, this );
        };

        
    };
    
    return APP;
});