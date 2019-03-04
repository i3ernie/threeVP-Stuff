/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define(["lodash", "three"], function(_, THREE){
    
    var defaults = {
        numTypes : 4,
        objectSize : 3
    };
    
    var RandomObject = function( opt ){
        this.options = _.extend( {}, defaults, opt );
        
        var objectType = Math.ceil( Math.random() * this.options.numTypes );
        var geo = null;
        var type = "";
        switch ( objectType ) 
        {
            case 1:
                // Sphere
                type = "sphere";
                var radius = 1 + Math.random() * this.options.objectSize;
                geo = new THREE.SphereGeometry( radius, 20, 20 );
                break;
            case 2:
                // Box
                type = "box";
                var sx = 1 + Math.random() * this.options.objectSize;
                var sy = 1 + Math.random() * this.options.objectSize;
                var sz = 1 + Math.random() * this.options.objectSize;
                geo = new THREE.BoxGeometry( sx, sy, sz, 1, 1, 1 );
                break;
            case 3:
                // Cylinder
                type = "cylinder";
                var radius = 1 + Math.random() * this.options.objectSize;
                var height = 1 + Math.random() * this.options.objectSize;
                geo = new THREE.CylinderGeometry( radius, radius, height, 20, 1 );
                break;
            default:
                // Cone
                type = "cone";
                var radius = 1 + Math.random() * this.options.objectSize;
                var height = 2 + Math.random() * this.options.objectSize;
                geo = new THREE.CylinderGeometry( 0, radius, height, 20, 2 );
                break;
        }
        
        THREE.Mesh.call( this, geo, createObjectMaterial() );
        this.userData.type = type;
        
        function createObjectMaterial() {
            var c = Math.floor( Math.random() * ( 1 << 24 ) );
            return new THREE.MeshPhongMaterial( { color: c } );
        }
    };
    
    RandomObject.prototype = _.create( THREE.Mesh.prototype, {
        constructor : RandomObject
    });
    
    return RandomObject;
});

