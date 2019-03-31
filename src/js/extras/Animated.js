/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

define(["lodash"], function( _ ){
    
    let Animated = function(){};
    
    Animated.prototype.animation = function(){};
    Animated.prototype.setAnimation = function( fnc )
    {
        let scope = this;

        if ( typeof fnc !== "function") {return;}
        this.animation = fnc;
        Animated.VP.loop.remove( this._animation );

        this._animation = function(){ scope.animation.apply( scope, arguments ); };
        this.VP.loop.add( this._animation );
    };
    
    Animated.prototype.initAnimation = function(){
        let scope = this;
        if ( !Animated.VP ) {
            return;
        }
        this._animation = function(){ scope.animation.apply( scope, arguments ); };
        this.addEventListener( "added", function(){ Animated.VP.loop.add(scope._animation); } );
        this.addEventListener( "removed", function(){ Animated.VP.loop.add(scope._animation); } );
    };
    
    Animated.makeAnimated = function( object3D ){
        Object.assign( object3D.prototype, Object.create(Animated.prototype ) );
    };
    
    Animated.init = function( VP ){
        Animated.VP = VP;
    };
    
    return Animated;
});
