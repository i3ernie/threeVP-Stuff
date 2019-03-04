/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define(["lodash", "three", "ammo"], function(_, THREE, Ammo){
    var defaults = {
        shadow : true,
        autoLoad : true
    };
    
    var catapult = function( VP, PW, opt)
    {
        if ( opt && opt.load ) this.load = opt.load;
        var scope = this;
        
        this.options = _.extend( {}, defaults, opt );
        
        this.bullet = this.load();
        
        VP.DomEvents.addEventListener( VP.scene, "click", function( obj ) 
        {
            var ray = VP.raycaster.getRay( obj.origDomEvent );
            var pos = new THREE.Vector3();
            var quat = new THREE.Quaternion();

            var ball = scope.bullet;

            pos.copy( ray.direction );
            pos.add( ray.origin );
            quat.set( 0, 0, 0, 1 );

            ball.position.copy( pos );
            ball.quaternion.copy( quat ); 

            pos.copy( ray.direction );
            pos.multiplyScalar( 24 );
            PW.primitivAddPhysic( ball, {mass : 35, velocity : pos} );
            //createRigidBody( ball, ballShape, ballMass, pos, quat );

            VP.scene.add( ball );
            if( scope.options.autoLoad ) scope.bullet = scope.load();
        });
    };
    
    catapult.prototype.load = function()
    {
        var ballMaterial = new THREE.MeshPhongMaterial( { color: 0x202020 } );
        var ballRadius = 0.4;
        var ball = new THREE.Mesh( new THREE.SphereGeometry( ballRadius, 14, 10 ), ballMaterial );
        
        ball.castShadow = this.options.shadow;
        ball.receiveShadow = this.options.shadow;
        
        return ball;
    };
    
    return catapult;
});

