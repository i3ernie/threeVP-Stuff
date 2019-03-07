/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

"use strict";

const gulp = require('gulp');
var plugins = require('gulp-load-plugins')(); // Load all gulp plugins
                                              // automatically and attach
                                              // them to the `plugins` object
const _ = require('lodash');
const fs = require('fs');

const pkg = require('./package.json');
const dirs = pkg.directories;


gulp.task('default', function () {
    // place code for your default task here
});


gulp.task('init:modules', ( done ) => {
    const fnc = function( src, dest, req, name, mod )
    {
        let end = '';
        fs.readFile( './node_modules/'+src, 'utf8', ( err, content ) => {
            if ( err ) { console.log( err ); done(); return; }
            if ( typeof mod === "string" ) { end = "\n return " + mod + ';';  }
            var ret = ( typeof req === "string" )? 'define('+req+', function('+name+'){\n' + content + end + "\n});" : content;
            fs.writeFile(dest, ret, 'utf8', ( err ) => {
                if ( err ) { console.log( err ); }
                else { console.info("copy: " + src + " to " + dest); }
            });
        });
    };
    
    
    let modules = require("./node_modules.json");
    
    _.each(modules, ( el ) =>{
        fnc(el.src, el.dest, el.req , el.name, el.mod);
    });    
    done();
});

gulp.task('init:folder', ( done ) => {
     let folders = [
        './src/js/vendor',
        './src/js/vendor/three',
        './src/js/vendor/three/extras'
    ];
    
    _.each( folders, function( folder )
    { 
        try {
            if ( !fs.existsSync( folder ) ) {
                fs.mkdirSync( folder );
            }
        }
        catch ( e ) {
            console.log( e );
            // ...
        }
    });
    done();
});

gulp.task('init', gulp.series ( 
        'init:folder',
        'init:modules',
       
        function ( done ){
            done();
        }    
));

gulp.task("build", gulp.series ( 
       
        function ( done ){
            done();
        }    
));