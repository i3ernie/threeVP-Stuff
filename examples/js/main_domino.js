require.config({
    baseUrl:"../src/js",
    "paths": {
       
        "examples"      : "../../examples",
        "conf"          : "../conf",
       
        "img"           : "../img",
      
        "Mirror"      :"vendor/threejs/extras/Mirror",

        "plugin"        :"plugins/plugin"
    }
});

require(["examples/js/app_domino", "async"], function ( APP, async ) {

    let myApp = new APP();
    
    async.series([
        myApp.init,
        myApp.start
    ], function( err, res ){
        if ( err ) { console.log( err ); }
    }); 

});