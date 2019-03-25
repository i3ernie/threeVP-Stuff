define(["module", "three", "lodash", "./Laserbeam"], function( module, THREE, _, LaserBeam ) 
{  
    let defaults = {
        texturesPath : module.uri.substring(0, module.uri.lastIndexOf("/")+1 ) + "textures/"
    };
    
    let LaserCooked	= function( VP, opts )
    {
        let scope = this;
        
        this.options = _.extend({}, defaults, opts);
        
        this.object3d	= new LaserBeam();

        // build THREE.Sprite for impact
        let texture	= new THREE.TextureLoader().load( this.options.texturesPath + 'blue_particle.jpg' );	
        let material	= new THREE.SpriteMaterial({
            map		: texture,
            blending	: THREE.AdditiveBlending
        });

        let sprite = new THREE.Sprite( material );
        sprite.scale.x = 0.5;
        sprite.scale.y = 2;

        sprite.position.x	= 1-0.01;
        scope.object3d.add( sprite );

        // add a point light
        let light = new THREE.PointLight( 0x4444ff);
        light.intensity	= 0.5;
        light.distance	= 4;
        light.position.x= -0.05;
        this.light	= light;
        sprite.add( light );

        // to exports last intersects
        this.lastIntersects	= [];

        var raycaster	= new THREE.Raycaster();
        // TODO assume object3d.position are worldPosition. works IFF attached to scene
        raycaster.ray.origin.copy( scope.object3d.position );
        
	this._animation = function(){
            // get laserBeam matrixWorld
            scope.object3d.updateMatrixWorld();
            var matrixWorld	= scope.object3d.matrixWorld.clone();
            // set the origin
            raycaster.ray.origin.setFromMatrixPosition(matrixWorld);
            // keep only the roation
            matrixWorld.setPosition( new THREE.Vector3(0, 0, 0) );		

            // set the direction
            raycaster.ray.direction.set(1,0,0)
                    .applyMatrix4( matrixWorld )
                    .normalize();

            let intersects		= raycaster.intersectObjects( VP.scene.children );
            if( intersects.length > 0 ){
                var position	= intersects[0].point;
                var distance	= position.distanceTo(raycaster.ray.origin);
                scope.object3d.scale.x	= distance;
            }else{
                scope.object3d.scale.x	= 10;	
            }
            // backup last intersects
            scope.lastIntersects = intersects;
	};
        
        scope.object3d.addEventListener("added", function(){
            VP.loop.add( scope._animation );
        });
        
        scope.object3d.addEventListener("removed", function(){
            VP.loop.remove( scope._animation );
        });
    };

    return LaserCooked;

});
