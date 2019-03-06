define('shaders/CopyShader',["three"], function(THREE){
/**
 * @author alteredq / http://alteredqualia.com/
 *
 * Full-screen textured quad shader
 */

THREE.CopyShader = {

	uniforms: {

		"tDiffuse": { value: null },
		"opacity":  { value: 1.0 }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"uniform float opacity;",

		"uniform sampler2D tDiffuse;",

		"varying vec2 vUv;",

		"void main() {",

			"vec4 texel = texture2D( tDiffuse, vUv );",
			"gl_FragColor = opacity * texel;",

		"}"

	].join( "\n" )

};

 return THREE.CopyShader;
});
/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define('libs/Pass',["three"], function( THREE ){   

    THREE.Pass = function () {

            // if set to true, the pass is processed by the composer
            this.enabled = true;

            // if set to true, the pass indicates to swap read and write buffer after rendering
            this.needsSwap = true;

            // if set to true, the pass clears its buffer before rendering
            this.clear = false;

            // if set to true, the result of the pass is rendered to screen
            this.renderToScreen = false;

    };

    Object.assign( THREE.Pass.prototype, {

            setSize: function ( width, height ) {},

            render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {

                    console.error( 'THREE.Pass: .render() must be implemented in derived pass.' );

            }

    } );
    
    return THREE.Pass;

} );



define('postprocessing/ShaderPass',["three", "libs/Pass"], function(THREE, Pass){
/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.ShaderPass = function ( shader, textureID ) {

	THREE.Pass.call( this );

	this.textureID = ( textureID !== undefined ) ? textureID : "tDiffuse";

	if ( shader instanceof THREE.ShaderMaterial ) {

		this.uniforms = shader.uniforms;

		this.material = shader;

	} else if ( shader ) {

		this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );

		this.material = new THREE.ShaderMaterial( {

			defines: Object.assign( {}, shader.defines ),
			uniforms: this.uniforms,
			vertexShader: shader.vertexShader,
			fragmentShader: shader.fragmentShader

		} );

	}

	this.camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
	this.scene = new THREE.Scene();

	this.quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), null );
	this.quad.frustumCulled = false; // Avoid getting clipped
	this.scene.add( this.quad );

};

THREE.ShaderPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.ShaderPass,

	render: function ( renderer, writeBuffer, readBuffer, deltaTime, maskActive ) {

		if ( this.uniforms[ this.textureID ] ) {

			this.uniforms[ this.textureID ].value = readBuffer.texture;

		}

		this.quad.material = this.material;

		if ( this.renderToScreen ) {

			renderer.setRenderTarget( null );
			renderer.render( this.scene, this.camera );

		} else {

			renderer.setRenderTarget( writeBuffer );
			// TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600
			if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
			renderer.render( this.scene, this.camera );

		}

	}

} );

 return THREE.ShaderPass;
});
define('postprocessing/EffectComposer',["three", "shaders/CopyShader", "postprocessing/ShaderPass"], function(THREE){
/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.EffectComposer = function ( renderer, renderTarget ) {

	this.renderer = renderer;

	if ( renderTarget === undefined ) {

		var parameters = {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			format: THREE.RGBAFormat,
			stencilBuffer: false
		};

		var size = renderer.getDrawingBufferSize( new THREE.Vector2() );
		renderTarget = new THREE.WebGLRenderTarget( size.width, size.height, parameters );
		renderTarget.texture.name = 'EffectComposer.rt1';

	}

	this.renderTarget1 = renderTarget;
	this.renderTarget2 = renderTarget.clone();
	this.renderTarget2.texture.name = 'EffectComposer.rt2';

	this.writeBuffer = this.renderTarget1;
	this.readBuffer = this.renderTarget2;

	this.passes = [];

	// dependencies

	if ( THREE.CopyShader === undefined ) {

		console.error( 'THREE.EffectComposer relies on THREE.CopyShader' );

	}

	if ( THREE.ShaderPass === undefined ) {

		console.error( 'THREE.EffectComposer relies on THREE.ShaderPass' );

	}

	this.copyPass = new THREE.ShaderPass( THREE.CopyShader );

	this._previousFrameTime = Date.now();

};

Object.assign( THREE.EffectComposer.prototype, {

	swapBuffers: function () {

		var tmp = this.readBuffer;
		this.readBuffer = this.writeBuffer;
		this.writeBuffer = tmp;

	},

	addPass: function ( pass ) {

		this.passes.push( pass );

		var size = this.renderer.getDrawingBufferSize( new THREE.Vector2() );
		pass.setSize( size.width, size.height );

	},

	insertPass: function ( pass, index ) {

		this.passes.splice( index, 0, pass );

	},

	render: function ( deltaTime ) {

		// deltaTime value is in seconds

		if ( deltaTime === undefined ) {

			deltaTime = ( Date.now() - this._previousFrameTime ) * 0.001;

		}

		this._previousFrameTime = Date.now();

		var currentRenderTarget = this.renderer.getRenderTarget();

		var maskActive = false;

		var pass, i, il = this.passes.length;

		for ( i = 0; i < il; i ++ ) {

			pass = this.passes[ i ];

			if ( pass.enabled === false ) continue;

			pass.render( this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive );

			if ( pass.needsSwap ) {

				if ( maskActive ) {

					var context = this.renderer.context;

					context.stencilFunc( context.NOTEQUAL, 1, 0xffffffff );

					this.copyPass.render( this.renderer, this.writeBuffer, this.readBuffer, deltaTime );

					context.stencilFunc( context.EQUAL, 1, 0xffffffff );

				}

				this.swapBuffers();

			}

			if ( THREE.MaskPass !== undefined ) {

				if ( pass instanceof THREE.MaskPass ) {

					maskActive = true;

				} else if ( pass instanceof THREE.ClearMaskPass ) {

					maskActive = false;

				}

			}

		}

		this.renderer.setRenderTarget( currentRenderTarget );

	},

	reset: function ( renderTarget ) {

		if ( renderTarget === undefined ) {

			var size = this.renderer.getDrawingBufferSize( new THREE.Vector2() );

			renderTarget = this.renderTarget1.clone();
			renderTarget.setSize( size.width, size.height );

		}

		this.renderTarget1.dispose();
		this.renderTarget2.dispose();
		this.renderTarget1 = renderTarget;
		this.renderTarget2 = renderTarget.clone();

		this.writeBuffer = this.renderTarget1;
		this.readBuffer = this.renderTarget2;

	},

	setSize: function ( width, height ) {

		this.renderTarget1.setSize( width, height );
		this.renderTarget2.setSize( width, height );

		for ( var i = 0; i < this.passes.length; i ++ ) {

			this.passes[ i ].setSize( width, height );

		}

	}

} );


THREE.Pass = function () {

	// if set to true, the pass is processed by the composer
	this.enabled = true;

	// if set to true, the pass indicates to swap read and write buffer after rendering
	this.needsSwap = true;

	// if set to true, the pass clears its buffer before rendering
	this.clear = false;

	// if set to true, the result of the pass is rendered to screen
	this.renderToScreen = false;

};

Object.assign( THREE.Pass.prototype, {

	setSize: function ( width, height ) {},

	render: function ( renderer, writeBuffer, readBuffer, deltaTime, maskActive ) {

		console.error( 'THREE.Pass: .render() must be implemented in derived pass.' );

	}

} );

 return THREE.EffectComposer;
});
define('postprocessing/RenderPass',["three", "libs/Pass"], function(THREE, Pass){
/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.RenderPass = function ( scene, camera, overrideMaterial, clearColor, clearAlpha ) {

	THREE.Pass.call( this );

	this.scene = scene;
	this.camera = camera;

	this.overrideMaterial = overrideMaterial;

	this.clearColor = clearColor;
	this.clearAlpha = ( clearAlpha !== undefined ) ? clearAlpha : 0;

	this.clear = true;
	this.clearDepth = false;
	this.needsSwap = false;

};

THREE.RenderPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.RenderPass,

	render: function ( renderer, writeBuffer, readBuffer, deltaTime, maskActive ) {

		var oldAutoClear = renderer.autoClear;
		renderer.autoClear = false;

		this.scene.overrideMaterial = this.overrideMaterial;

		var oldClearColor, oldClearAlpha;

		if ( this.clearColor ) {

			oldClearColor = renderer.getClearColor().getHex();
			oldClearAlpha = renderer.getClearAlpha();

			renderer.setClearColor( this.clearColor, this.clearAlpha );

		}

		if ( this.clearDepth ) {

			renderer.clearDepth();

		}

		renderer.setRenderTarget( this.renderToScreen ? null : readBuffer );

		// TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600
		if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
		renderer.render( this.scene, this.camera );

		if ( this.clearColor ) {

			renderer.setClearColor( oldClearColor, oldClearAlpha );

		}

		this.scene.overrideMaterial = null;
		renderer.autoClear = oldAutoClear;

	}

} );

 return THREE.RenderPass;
});
define('postprocessing/OutlinePass',["three"], function(THREE){
/**
 * @author spidersharma / http://eduperiment.com/
 */

THREE.OutlinePass = function ( resolution, scene, camera, selectedObjects ) {

	this.renderScene = scene;
	this.renderCamera = camera;
	this.selectedObjects = selectedObjects !== undefined ? selectedObjects : [];
	this.visibleEdgeColor = new THREE.Color( 1, 1, 1 );
	this.hiddenEdgeColor = new THREE.Color( 0.1, 0.04, 0.02 );
	this.edgeGlow = 0.0;
	this.usePatternTexture = false;
	this.edgeThickness = 1.0;
	this.edgeStrength = 3.0;
	this.downSampleRatio = 2;
	this.pulsePeriod = 0;

	THREE.Pass.call( this );

	this.resolution = ( resolution !== undefined ) ? new THREE.Vector2( resolution.x, resolution.y ) : new THREE.Vector2( 256, 256 );

	var pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };

	var resx = Math.round( this.resolution.x / this.downSampleRatio );
	var resy = Math.round( this.resolution.y / this.downSampleRatio );

	this.maskBufferMaterial = new THREE.MeshBasicMaterial( { color: 0xffffff } );
	this.maskBufferMaterial.side = THREE.DoubleSide;
	this.renderTargetMaskBuffer = new THREE.WebGLRenderTarget( this.resolution.x, this.resolution.y, pars );
	this.renderTargetMaskBuffer.texture.name = "OutlinePass.mask";
	this.renderTargetMaskBuffer.texture.generateMipmaps = false;

	this.depthMaterial = new THREE.MeshDepthMaterial();
	this.depthMaterial.side = THREE.DoubleSide;
	this.depthMaterial.depthPacking = THREE.RGBADepthPacking;
	this.depthMaterial.blending = THREE.NoBlending;

	this.prepareMaskMaterial = this.getPrepareMaskMaterial();
	this.prepareMaskMaterial.side = THREE.DoubleSide;
	this.prepareMaskMaterial.fragmentShader = replaceDepthToViewZ( this.prepareMaskMaterial.fragmentShader, this.renderCamera );

	this.renderTargetDepthBuffer = new THREE.WebGLRenderTarget( this.resolution.x, this.resolution.y, pars );
	this.renderTargetDepthBuffer.texture.name = "OutlinePass.depth";
	this.renderTargetDepthBuffer.texture.generateMipmaps = false;

	this.renderTargetMaskDownSampleBuffer = new THREE.WebGLRenderTarget( resx, resy, pars );
	this.renderTargetMaskDownSampleBuffer.texture.name = "OutlinePass.depthDownSample";
	this.renderTargetMaskDownSampleBuffer.texture.generateMipmaps = false;

	this.renderTargetBlurBuffer1 = new THREE.WebGLRenderTarget( resx, resy, pars );
	this.renderTargetBlurBuffer1.texture.name = "OutlinePass.blur1";
	this.renderTargetBlurBuffer1.texture.generateMipmaps = false;
	this.renderTargetBlurBuffer2 = new THREE.WebGLRenderTarget( Math.round( resx / 2 ), Math.round( resy / 2 ), pars );
	this.renderTargetBlurBuffer2.texture.name = "OutlinePass.blur2";
	this.renderTargetBlurBuffer2.texture.generateMipmaps = false;

	this.edgeDetectionMaterial = this.getEdgeDetectionMaterial();
	this.renderTargetEdgeBuffer1 = new THREE.WebGLRenderTarget( resx, resy, pars );
	this.renderTargetEdgeBuffer1.texture.name = "OutlinePass.edge1";
	this.renderTargetEdgeBuffer1.texture.generateMipmaps = false;
	this.renderTargetEdgeBuffer2 = new THREE.WebGLRenderTarget( Math.round( resx / 2 ), Math.round( resy / 2 ), pars );
	this.renderTargetEdgeBuffer2.texture.name = "OutlinePass.edge2";
	this.renderTargetEdgeBuffer2.texture.generateMipmaps = false;

	var MAX_EDGE_THICKNESS = 4;
	var MAX_EDGE_GLOW = 4;

	this.separableBlurMaterial1 = this.getSeperableBlurMaterial( MAX_EDGE_THICKNESS );
	this.separableBlurMaterial1.uniforms[ "texSize" ].value = new THREE.Vector2( resx, resy );
	this.separableBlurMaterial1.uniforms[ "kernelRadius" ].value = 1;
	this.separableBlurMaterial2 = this.getSeperableBlurMaterial( MAX_EDGE_GLOW );
	this.separableBlurMaterial2.uniforms[ "texSize" ].value = new THREE.Vector2( Math.round( resx / 2 ), Math.round( resy / 2 ) );
	this.separableBlurMaterial2.uniforms[ "kernelRadius" ].value = MAX_EDGE_GLOW;

	// Overlay material
	this.overlayMaterial = this.getOverlayMaterial();

	// copy material
	if ( THREE.CopyShader === undefined )
		console.error( "THREE.OutlinePass relies on THREE.CopyShader" );

	var copyShader = THREE.CopyShader;

	this.copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );
	this.copyUniforms[ "opacity" ].value = 1.0;

	this.materialCopy = new THREE.ShaderMaterial( {
		uniforms: this.copyUniforms,
		vertexShader: copyShader.vertexShader,
		fragmentShader: copyShader.fragmentShader,
		blending: THREE.NoBlending,
		depthTest: false,
		depthWrite: false,
		transparent: true
	} );

	this.enabled = true;
	this.needsSwap = false;

	this.oldClearColor = new THREE.Color();
	this.oldClearAlpha = 1;

	this.camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 );
	this.scene = new THREE.Scene();

	this.quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), null );
	this.quad.frustumCulled = false; // Avoid getting clipped
	this.scene.add( this.quad );

	this.tempPulseColor1 = new THREE.Color();
	this.tempPulseColor2 = new THREE.Color();
	this.textureMatrix = new THREE.Matrix4();

	function replaceDepthToViewZ( string, camera ) {

		var type = camera.isPerspectiveCamera ? 'perspective' : 'orthographic';

		return string.replace( /DEPTH_TO_VIEW_Z/g, type + 'DepthToViewZ' );

	}

};

THREE.OutlinePass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.OutlinePass,

	dispose: function () {

		this.renderTargetMaskBuffer.dispose();
		this.renderTargetDepthBuffer.dispose();
		this.renderTargetMaskDownSampleBuffer.dispose();
		this.renderTargetBlurBuffer1.dispose();
		this.renderTargetBlurBuffer2.dispose();
		this.renderTargetEdgeBuffer1.dispose();
		this.renderTargetEdgeBuffer2.dispose();

	},

	setSize: function ( width, height ) {

		this.renderTargetMaskBuffer.setSize( width, height );

		var resx = Math.round( width / this.downSampleRatio );
		var resy = Math.round( height / this.downSampleRatio );
		this.renderTargetMaskDownSampleBuffer.setSize( resx, resy );
		this.renderTargetBlurBuffer1.setSize( resx, resy );
		this.renderTargetEdgeBuffer1.setSize( resx, resy );
		this.separableBlurMaterial1.uniforms[ "texSize" ].value = new THREE.Vector2( resx, resy );

		resx = Math.round( resx / 2 );
		resy = Math.round( resy / 2 );

		this.renderTargetBlurBuffer2.setSize( resx, resy );
		this.renderTargetEdgeBuffer2.setSize( resx, resy );

		this.separableBlurMaterial2.uniforms[ "texSize" ].value = new THREE.Vector2( resx, resy );

	},

	changeVisibilityOfSelectedObjects: function ( bVisible ) {

		function gatherSelectedMeshesCallBack( object ) {

			if ( object.isMesh ) {

				if ( bVisible ) {

					object.visible = object.userData.oldVisible;
					delete object.userData.oldVisible;

				} else {

					object.userData.oldVisible = object.visible;
					object.visible = bVisible;

				}

			}

		}

		for ( var i = 0; i < this.selectedObjects.length; i ++ ) {

			var selectedObject = this.selectedObjects[ i ];
			selectedObject.traverse( gatherSelectedMeshesCallBack );

		}

	},

	changeVisibilityOfNonSelectedObjects: function ( bVisible ) {

		var selectedMeshes = [];

		function gatherSelectedMeshesCallBack( object ) {

			if ( object.isMesh ) selectedMeshes.push( object );

		}

		for ( var i = 0; i < this.selectedObjects.length; i ++ ) {

			var selectedObject = this.selectedObjects[ i ];
			selectedObject.traverse( gatherSelectedMeshesCallBack );

		}

		function VisibilityChangeCallBack( object ) {

			if ( object.isMesh || object.isLine || object.isSprite ) {

				var bFound = false;

				for ( var i = 0; i < selectedMeshes.length; i ++ ) {

					var selectedObjectId = selectedMeshes[ i ].id;

					if ( selectedObjectId === object.id ) {

						bFound = true;
						break;

					}

				}

				if ( ! bFound ) {

					var visibility = object.visible;

					if ( ! bVisible || object.bVisible ) object.visible = bVisible;

					object.bVisible = visibility;

				}

			}

		}

		this.renderScene.traverse( VisibilityChangeCallBack );

	},

	updateTextureMatrix: function () {

		this.textureMatrix.set( 0.5, 0.0, 0.0, 0.5,
			0.0, 0.5, 0.0, 0.5,
			0.0, 0.0, 0.5, 0.5,
			0.0, 0.0, 0.0, 1.0 );
		this.textureMatrix.multiply( this.renderCamera.projectionMatrix );
		this.textureMatrix.multiply( this.renderCamera.matrixWorldInverse );

	},

	render: function ( renderer, writeBuffer, readBuffer, deltaTime, maskActive ) {

		if ( this.selectedObjects.length > 0 ) {

			this.oldClearColor.copy( renderer.getClearColor() );
			this.oldClearAlpha = renderer.getClearAlpha();
			var oldAutoClear = renderer.autoClear;

			renderer.autoClear = false;

			if ( maskActive ) renderer.context.disable( renderer.context.STENCIL_TEST );

			renderer.setClearColor( 0xffffff, 1 );

			// Make selected objects invisible
			this.changeVisibilityOfSelectedObjects( false );

			var currentBackground = this.renderScene.background;
			this.renderScene.background = null;

			// 1. Draw Non Selected objects in the depth buffer
			this.renderScene.overrideMaterial = this.depthMaterial;
			renderer.setRenderTarget( this.renderTargetDepthBuffer );
			renderer.clear();
			renderer.render( this.renderScene, this.renderCamera );

			// Make selected objects visible
			this.changeVisibilityOfSelectedObjects( true );

			// Update Texture Matrix for Depth compare
			this.updateTextureMatrix();

			// Make non selected objects invisible, and draw only the selected objects, by comparing the depth buffer of non selected objects
			this.changeVisibilityOfNonSelectedObjects( false );
			this.renderScene.overrideMaterial = this.prepareMaskMaterial;
			this.prepareMaskMaterial.uniforms[ "cameraNearFar" ].value = new THREE.Vector2( this.renderCamera.near, this.renderCamera.far );
			this.prepareMaskMaterial.uniforms[ "depthTexture" ].value = this.renderTargetDepthBuffer.texture;
			this.prepareMaskMaterial.uniforms[ "textureMatrix" ].value = this.textureMatrix;
			renderer.setRenderTarget( this.renderTargetMaskBuffer );
			renderer.clear();
			renderer.render( this.renderScene, this.renderCamera );
			this.renderScene.overrideMaterial = null;
			this.changeVisibilityOfNonSelectedObjects( true );

			this.renderScene.background = currentBackground;

			// 2. Downsample to Half resolution
			this.quad.material = this.materialCopy;
			this.copyUniforms[ "tDiffuse" ].value = this.renderTargetMaskBuffer.texture;
			renderer.setRenderTarget( this.renderTargetMaskDownSampleBuffer );
			renderer.clear();
			renderer.render( this.scene, this.camera );

			this.tempPulseColor1.copy( this.visibleEdgeColor );
			this.tempPulseColor2.copy( this.hiddenEdgeColor );

			if ( this.pulsePeriod > 0 ) {

				var scalar = ( 1 + 0.25 ) / 2 + Math.cos( performance.now() * 0.01 / this.pulsePeriod ) * ( 1.0 - 0.25 ) / 2;
				this.tempPulseColor1.multiplyScalar( scalar );
				this.tempPulseColor2.multiplyScalar( scalar );

			}

			// 3. Apply Edge Detection Pass
			this.quad.material = this.edgeDetectionMaterial;
			this.edgeDetectionMaterial.uniforms[ "maskTexture" ].value = this.renderTargetMaskDownSampleBuffer.texture;
			this.edgeDetectionMaterial.uniforms[ "texSize" ].value = new THREE.Vector2( this.renderTargetMaskDownSampleBuffer.width, this.renderTargetMaskDownSampleBuffer.height );
			this.edgeDetectionMaterial.uniforms[ "visibleEdgeColor" ].value = this.tempPulseColor1;
			this.edgeDetectionMaterial.uniforms[ "hiddenEdgeColor" ].value = this.tempPulseColor2;
			renderer.setRenderTarget( this.renderTargetEdgeBuffer1 );
			renderer.clear();
			renderer.render( this.scene, this.camera );

			// 4. Apply Blur on Half res
			this.quad.material = this.separableBlurMaterial1;
			this.separableBlurMaterial1.uniforms[ "colorTexture" ].value = this.renderTargetEdgeBuffer1.texture;
			this.separableBlurMaterial1.uniforms[ "direction" ].value = THREE.OutlinePass.BlurDirectionX;
			this.separableBlurMaterial1.uniforms[ "kernelRadius" ].value = this.edgeThickness;
			renderer.setRenderTarget( this.renderTargetBlurBuffer1 );
			renderer.clear();
			renderer.render( this.scene, this.camera );
			this.separableBlurMaterial1.uniforms[ "colorTexture" ].value = this.renderTargetBlurBuffer1.texture;
			this.separableBlurMaterial1.uniforms[ "direction" ].value = THREE.OutlinePass.BlurDirectionY;
			renderer.setRenderTarget( this.renderTargetEdgeBuffer1 );
			renderer.clear();
			renderer.render( this.scene, this.camera );

			// Apply Blur on quarter res
			this.quad.material = this.separableBlurMaterial2;
			this.separableBlurMaterial2.uniforms[ "colorTexture" ].value = this.renderTargetEdgeBuffer1.texture;
			this.separableBlurMaterial2.uniforms[ "direction" ].value = THREE.OutlinePass.BlurDirectionX;
			renderer.setRenderTarget( this.renderTargetBlurBuffer2 );
			renderer.clear();
			renderer.render( this.scene, this.camera );
			this.separableBlurMaterial2.uniforms[ "colorTexture" ].value = this.renderTargetBlurBuffer2.texture;
			this.separableBlurMaterial2.uniforms[ "direction" ].value = THREE.OutlinePass.BlurDirectionY;
			renderer.setRenderTarget( this.renderTargetEdgeBuffer2 );
			renderer.clear();
			renderer.render( this.scene, this.camera );

			// Blend it additively over the input texture
			this.quad.material = this.overlayMaterial;
			this.overlayMaterial.uniforms[ "maskTexture" ].value = this.renderTargetMaskBuffer.texture;
			this.overlayMaterial.uniforms[ "edgeTexture1" ].value = this.renderTargetEdgeBuffer1.texture;
			this.overlayMaterial.uniforms[ "edgeTexture2" ].value = this.renderTargetEdgeBuffer2.texture;
			this.overlayMaterial.uniforms[ "patternTexture" ].value = this.patternTexture;
			this.overlayMaterial.uniforms[ "edgeStrength" ].value = this.edgeStrength;
			this.overlayMaterial.uniforms[ "edgeGlow" ].value = this.edgeGlow;
			this.overlayMaterial.uniforms[ "usePatternTexture" ].value = this.usePatternTexture;


			if ( maskActive ) renderer.context.enable( renderer.context.STENCIL_TEST );

			renderer.setRenderTarget( readBuffer );
			renderer.render( this.scene, this.camera );

			renderer.setClearColor( this.oldClearColor, this.oldClearAlpha );
			renderer.autoClear = oldAutoClear;

		}

		if ( this.renderToScreen ) {

			this.quad.material = this.materialCopy;
			this.copyUniforms[ "tDiffuse" ].value = readBuffer.texture;
			renderer.setRenderTarget( null );
			renderer.render( this.scene, this.camera );

		}

	},

	getPrepareMaskMaterial: function () {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"depthTexture": { value: null },
				"cameraNearFar": { value: new THREE.Vector2( 0.5, 0.5 ) },
				"textureMatrix": { value: new THREE.Matrix4() }
			},

			vertexShader: [
				'varying vec4 projTexCoord;',
				'varying vec4 vPosition;',
				'uniform mat4 textureMatrix;',

				'void main() {',

				'	vPosition = modelViewMatrix * vec4( position, 1.0 );',
				'	vec4 worldPosition = modelMatrix * vec4( position, 1.0 );',
				'	projTexCoord = textureMatrix * worldPosition;',
				'	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

				'}'
			].join( '\n' ),

			fragmentShader: [
				'#include <packing>',
				'varying vec4 vPosition;',
				'varying vec4 projTexCoord;',
				'uniform sampler2D depthTexture;',
				'uniform vec2 cameraNearFar;',

				'void main() {',

				'	float depth = unpackRGBAToDepth(texture2DProj( depthTexture, projTexCoord ));',
				'	float viewZ = - DEPTH_TO_VIEW_Z( depth, cameraNearFar.x, cameraNearFar.y );',
				'	float depthTest = (-vPosition.z > viewZ) ? 1.0 : 0.0;',
				'	gl_FragColor = vec4(0.0, depthTest, 1.0, 1.0);',

				'}'
			].join( '\n' )

		} );

	},

	getEdgeDetectionMaterial: function () {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"maskTexture": { value: null },
				"texSize": { value: new THREE.Vector2( 0.5, 0.5 ) },
				"visibleEdgeColor": { value: new THREE.Vector3( 1.0, 1.0, 1.0 ) },
				"hiddenEdgeColor": { value: new THREE.Vector3( 1.0, 1.0, 1.0 ) },
			},

			vertexShader:
				"varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

			fragmentShader:
				"varying vec2 vUv;\
				uniform sampler2D maskTexture;\
				uniform vec2 texSize;\
				uniform vec3 visibleEdgeColor;\
				uniform vec3 hiddenEdgeColor;\
				\
				void main() {\n\
					vec2 invSize = 1.0 / texSize;\
					vec4 uvOffset = vec4(1.0, 0.0, 0.0, 1.0) * vec4(invSize, invSize);\
					vec4 c1 = texture2D( maskTexture, vUv + uvOffset.xy);\
					vec4 c2 = texture2D( maskTexture, vUv - uvOffset.xy);\
					vec4 c3 = texture2D( maskTexture, vUv + uvOffset.yw);\
					vec4 c4 = texture2D( maskTexture, vUv - uvOffset.yw);\
					float diff1 = (c1.r - c2.r)*0.5;\
					float diff2 = (c3.r - c4.r)*0.5;\
					float d = length( vec2(diff1, diff2) );\
					float a1 = min(c1.g, c2.g);\
					float a2 = min(c3.g, c4.g);\
					float visibilityFactor = min(a1, a2);\
					vec3 edgeColor = 1.0 - visibilityFactor > 0.001 ? visibleEdgeColor : hiddenEdgeColor;\
					gl_FragColor = vec4(edgeColor, 1.0) * vec4(d);\
				}"
		} );

	},

	getSeperableBlurMaterial: function ( maxRadius ) {

		return new THREE.ShaderMaterial( {

			defines: {
				"MAX_RADIUS": maxRadius,
			},

			uniforms: {
				"colorTexture": { value: null },
				"texSize": { value: new THREE.Vector2( 0.5, 0.5 ) },
				"direction": { value: new THREE.Vector2( 0.5, 0.5 ) },
				"kernelRadius": { value: 1.0 }
			},

			vertexShader:
				"varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

			fragmentShader:
				"#include <common>\
				varying vec2 vUv;\
				uniform sampler2D colorTexture;\
				uniform vec2 texSize;\
				uniform vec2 direction;\
				uniform float kernelRadius;\
				\
				float gaussianPdf(in float x, in float sigma) {\
					return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;\
				}\
				void main() {\
					vec2 invSize = 1.0 / texSize;\
					float weightSum = gaussianPdf(0.0, kernelRadius);\
					vec3 diffuseSum = texture2D( colorTexture, vUv).rgb * weightSum;\
					vec2 delta = direction * invSize * kernelRadius/float(MAX_RADIUS);\
					vec2 uvOffset = delta;\
					for( int i = 1; i <= MAX_RADIUS; i ++ ) {\
						float w = gaussianPdf(uvOffset.x, kernelRadius);\
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset).rgb;\
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset).rgb;\
						diffuseSum += ((sample1 + sample2) * w);\
						weightSum += (2.0 * w);\
						uvOffset += delta;\
					}\
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);\
				}"
		} );

	},

	getOverlayMaterial: function () {

		return new THREE.ShaderMaterial( {

			uniforms: {
				"maskTexture": { value: null },
				"edgeTexture1": { value: null },
				"edgeTexture2": { value: null },
				"patternTexture": { value: null },
				"edgeStrength": { value: 1.0 },
				"edgeGlow": { value: 1.0 },
				"usePatternTexture": { value: 0.0 }
			},

			vertexShader:
				"varying vec2 vUv;\n\
				void main() {\n\
					vUv = uv;\n\
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
				}",

			fragmentShader:
				"varying vec2 vUv;\
				uniform sampler2D maskTexture;\
				uniform sampler2D edgeTexture1;\
				uniform sampler2D edgeTexture2;\
				uniform sampler2D patternTexture;\
				uniform float edgeStrength;\
				uniform float edgeGlow;\
				uniform bool usePatternTexture;\
				\
				void main() {\
					vec4 edgeValue1 = texture2D(edgeTexture1, vUv);\
					vec4 edgeValue2 = texture2D(edgeTexture2, vUv);\
					vec4 maskColor = texture2D(maskTexture, vUv);\
					vec4 patternColor = texture2D(patternTexture, 6.0 * vUv);\
					float visibilityFactor = 1.0 - maskColor.g > 0.0 ? 1.0 : 0.5;\
					vec4 edgeValue = edgeValue1 + edgeValue2 * edgeGlow;\
					vec4 finalColor = edgeStrength * maskColor.r * edgeValue;\
					if(usePatternTexture)\
						finalColor += + visibilityFactor * (1.0 - maskColor.r) * (1.0 - patternColor.r);\
					gl_FragColor = finalColor;\
				}",
			blending: THREE.AdditiveBlending,
			depthTest: false,
			depthWrite: false,
			transparent: true
		} );

	}

} );

THREE.OutlinePass.BlurDirectionX = new THREE.Vector2( 1.0, 0.0 );
THREE.OutlinePass.BlurDirectionY = new THREE.Vector2( 0.0, 1.0 );

 return THREE.OutlinePass;
});
/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define('pack-postprocessing',["postprocessing/EffectComposer", "postprocessing/RenderPass", "postprocessing/OutlinePass"], function( EffectComposer, RenderPass, OutlinePass ){
    return {
        EffectComposer   : EffectComposer,
        RenderPass       : RenderPass,
        OutlinePass      : OutlinePass
    };
});
define('shaders/FXAAShader',["three"], function(THREE){
/**
 * @author alteredq / http://alteredqualia.com/
 * @author davidedc / http://www.sketchpatch.net/
 *
 * NVIDIA FXAA by Timothy Lottes
 * http://timothylottes.blogspot.com/2011/06/fxaa3-source-released.html
 * - WebGL port by @supereggbert
 * http://www.glge.org/demos/fxaa/
 */

THREE.FXAAShader = {

	uniforms: {

		"tDiffuse":   { value: null },
		"resolution": { value: new THREE.Vector2( 1 / 1024, 1 / 512 ) }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [
        "precision highp float;",
        "",
        "uniform sampler2D tDiffuse;",
        "",
        "uniform vec2 resolution;",
        "",
        "varying vec2 vUv;",
        "",
        "// FXAA 3.11 implementation by NVIDIA, ported to WebGL by Agost Biro (biro@archilogic.com)",
        "",
        "//----------------------------------------------------------------------------------",
        "// File:        es3-kepler\FXAA\assets\shaders/FXAA_DefaultES.frag",
        "// SDK Version: v3.00",
        "// Email:       gameworks@nvidia.com",
        "// Site:        http://developer.nvidia.com/",
        "//",
        "// Copyright (c) 2014-2015, NVIDIA CORPORATION. All rights reserved.",
        "//",
        "// Redistribution and use in source and binary forms, with or without",
        "// modification, are permitted provided that the following conditions",
        "// are met:",
        "//  * Redistributions of source code must retain the above copyright",
        "//    notice, this list of conditions and the following disclaimer.",
        "//  * Redistributions in binary form must reproduce the above copyright",
        "//    notice, this list of conditions and the following disclaimer in the",
        "//    documentation and/or other materials provided with the distribution.",
        "//  * Neither the name of NVIDIA CORPORATION nor the names of its",
        "//    contributors may be used to endorse or promote products derived",
        "//    from this software without specific prior written permission.",
        "//",
        "// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS ``AS IS'' AND ANY",
        "// EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE",
        "// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR",
        "// PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR",
        "// CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,",
        "// EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,",
        "// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR",
        "// PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY",
        "// OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT",
        "// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE",
        "// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.",
        "//",
        "//----------------------------------------------------------------------------------",
        "",
        "#define FXAA_PC 1",
        "#define FXAA_GLSL_100 1",
        "#define FXAA_QUALITY_PRESET 12",
        "",
        "#define FXAA_GREEN_AS_LUMA 1",
        "",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_PC_CONSOLE",
        "    //",
        "    // The console algorithm for PC is included",
        "    // for developers targeting really low spec machines.",
        "    // Likely better to just run FXAA_PC, and use a really low preset.",
        "    //",
        "    #define FXAA_PC_CONSOLE 0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_GLSL_120",
        "    #define FXAA_GLSL_120 0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_GLSL_130",
        "    #define FXAA_GLSL_130 0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_HLSL_3",
        "    #define FXAA_HLSL_3 0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_HLSL_4",
        "    #define FXAA_HLSL_4 0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_HLSL_5",
        "    #define FXAA_HLSL_5 0",
        "#endif",
        "/*==========================================================================*/",
        "#ifndef FXAA_GREEN_AS_LUMA",
        "    //",
        "    // For those using non-linear color,",
        "    // and either not able to get luma in alpha, or not wanting to,",
        "    // this enables FXAA to run using green as a proxy for luma.",
        "    // So with this enabled, no need to pack luma in alpha.",
        "    //",
        "    // This will turn off AA on anything which lacks some amount of green.",
        "    // Pure red and blue or combination of only R and B, will get no AA.",
        "    //",
        "    // Might want to lower the settings for both,",
        "    //    fxaaConsoleEdgeThresholdMin",
        "    //    fxaaQualityEdgeThresholdMin",
        "    // In order to insure AA does not get turned off on colors",
        "    // which contain a minor amount of green.",
        "    //",
        "    // 1 = On.",
        "    // 0 = Off.",
        "    //",
        "    #define FXAA_GREEN_AS_LUMA 0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_EARLY_EXIT",
        "    //",
        "    // Controls algorithm's early exit path.",
        "    // On PS3 turning this ON adds 2 cycles to the shader.",
        "    // On 360 turning this OFF adds 10ths of a millisecond to the shader.",
        "    // Turning this off on console will result in a more blurry image.",
        "    // So this defaults to on.",
        "    //",
        "    // 1 = On.",
        "    // 0 = Off.",
        "    //",
        "    #define FXAA_EARLY_EXIT 1",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_DISCARD",
        "    //",
        "    // Only valid for PC OpenGL currently.",
        "    // Probably will not work when FXAA_GREEN_AS_LUMA = 1.",
        "    //",
        "    // 1 = Use discard on pixels which don't need AA.",
        "    //     For APIs which enable concurrent TEX+ROP from same surface.",
        "    // 0 = Return unchanged color on pixels which don't need AA.",
        "    //",
        "    #define FXAA_DISCARD 0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_FAST_PIXEL_OFFSET",
        "    //",
        "    // Used for GLSL 120 only.",
        "    //",
        "    // 1 = GL API supports fast pixel offsets",
        "    // 0 = do not use fast pixel offsets",
        "    //",
        "    #ifdef GL_EXT_gpu_shader4",
        "        #define FXAA_FAST_PIXEL_OFFSET 1",
        "    #endif",
        "    #ifdef GL_NV_gpu_shader5",
        "        #define FXAA_FAST_PIXEL_OFFSET 1",
        "    #endif",
        "    #ifdef GL_ARB_gpu_shader5",
        "        #define FXAA_FAST_PIXEL_OFFSET 1",
        "    #endif",
        "    #ifndef FXAA_FAST_PIXEL_OFFSET",
        "        #define FXAA_FAST_PIXEL_OFFSET 0",
        "    #endif",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#ifndef FXAA_GATHER4_ALPHA",
        "    //",
        "    // 1 = API supports gather4 on alpha channel.",
        "    // 0 = API does not support gather4 on alpha channel.",
        "    //",
        "    #if (FXAA_HLSL_5 == 1)",
        "        #define FXAA_GATHER4_ALPHA 1",
        "    #endif",
        "    #ifdef GL_ARB_gpu_shader5",
        "        #define FXAA_GATHER4_ALPHA 1",
        "    #endif",
        "    #ifdef GL_NV_gpu_shader5",
        "        #define FXAA_GATHER4_ALPHA 1",
        "    #endif",
        "    #ifndef FXAA_GATHER4_ALPHA",
        "        #define FXAA_GATHER4_ALPHA 0",
        "    #endif",
        "#endif",
        "",
        "",
        "/*============================================================================",
        "                        FXAA QUALITY - TUNING KNOBS",
        "------------------------------------------------------------------------------",
        "NOTE the other tuning knobs are now in the shader function inputs!",
        "============================================================================*/",
        "#ifndef FXAA_QUALITY_PRESET",
        "    //",
        "    // Choose the quality preset.",
        "    // This needs to be compiled into the shader as it effects code.",
        "    // Best option to include multiple presets is to",
        "    // in each shader define the preset, then include this file.",
        "    //",
        "    // OPTIONS",
        "    // -----------------------------------------------------------------------",
        "    // 10 to 15 - default medium dither (10=fastest, 15=highest quality)",
        "    // 20 to 29 - less dither, more expensive (20=fastest, 29=highest quality)",
        "    // 39       - no dither, very expensive",
        "    //",
        "    // NOTES",
        "    // -----------------------------------------------------------------------",
        "    // 12 = slightly faster then FXAA 3.9 and higher edge quality (default)",
        "    // 13 = about same speed as FXAA 3.9 and better than 12",
        "    // 23 = closest to FXAA 3.9 visually and performance wise",
        "    //  _ = the lowest digit is directly related to performance",
        "    // _  = the highest digit is directly related to style",
        "    //",
        "    #define FXAA_QUALITY_PRESET 12",
        "#endif",
        "",
        "",
        "/*============================================================================",
        "",
        "                           FXAA QUALITY - PRESETS",
        "",
        "============================================================================*/",
        "",
        "/*============================================================================",
        "                     FXAA QUALITY - MEDIUM DITHER PRESETS",
        "============================================================================*/",
        "#if (FXAA_QUALITY_PRESET == 10)",
        "    #define FXAA_QUALITY_PS 3",
        "    #define FXAA_QUALITY_P0 1.5",
        "    #define FXAA_QUALITY_P1 3.0",
        "    #define FXAA_QUALITY_P2 12.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 11)",
        "    #define FXAA_QUALITY_PS 4",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 3.0",
        "    #define FXAA_QUALITY_P3 12.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 12)",
        "    #define FXAA_QUALITY_PS 5",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 4.0",
        "    #define FXAA_QUALITY_P4 12.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 13)",
        "    #define FXAA_QUALITY_PS 6",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 4.0",
        "    #define FXAA_QUALITY_P5 12.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 14)",
        "    #define FXAA_QUALITY_PS 7",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 2.0",
        "    #define FXAA_QUALITY_P5 4.0",
        "    #define FXAA_QUALITY_P6 12.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 15)",
        "    #define FXAA_QUALITY_PS 8",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 2.0",
        "    #define FXAA_QUALITY_P5 2.0",
        "    #define FXAA_QUALITY_P6 4.0",
        "    #define FXAA_QUALITY_P7 12.0",
        "#endif",
        "",
        "/*============================================================================",
        "                     FXAA QUALITY - LOW DITHER PRESETS",
        "============================================================================*/",
        "#if (FXAA_QUALITY_PRESET == 20)",
        "    #define FXAA_QUALITY_PS 3",
        "    #define FXAA_QUALITY_P0 1.5",
        "    #define FXAA_QUALITY_P1 2.0",
        "    #define FXAA_QUALITY_P2 8.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 21)",
        "    #define FXAA_QUALITY_PS 4",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 8.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 22)",
        "    #define FXAA_QUALITY_PS 5",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 8.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 23)",
        "    #define FXAA_QUALITY_PS 6",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 2.0",
        "    #define FXAA_QUALITY_P5 8.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 24)",
        "    #define FXAA_QUALITY_PS 7",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 2.0",
        "    #define FXAA_QUALITY_P5 3.0",
        "    #define FXAA_QUALITY_P6 8.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 25)",
        "    #define FXAA_QUALITY_PS 8",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 2.0",
        "    #define FXAA_QUALITY_P5 2.0",
        "    #define FXAA_QUALITY_P6 4.0",
        "    #define FXAA_QUALITY_P7 8.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 26)",
        "    #define FXAA_QUALITY_PS 9",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 2.0",
        "    #define FXAA_QUALITY_P5 2.0",
        "    #define FXAA_QUALITY_P6 2.0",
        "    #define FXAA_QUALITY_P7 4.0",
        "    #define FXAA_QUALITY_P8 8.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 27)",
        "    #define FXAA_QUALITY_PS 10",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 2.0",
        "    #define FXAA_QUALITY_P5 2.0",
        "    #define FXAA_QUALITY_P6 2.0",
        "    #define FXAA_QUALITY_P7 2.0",
        "    #define FXAA_QUALITY_P8 4.0",
        "    #define FXAA_QUALITY_P9 8.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 28)",
        "    #define FXAA_QUALITY_PS 11",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 2.0",
        "    #define FXAA_QUALITY_P5 2.0",
        "    #define FXAA_QUALITY_P6 2.0",
        "    #define FXAA_QUALITY_P7 2.0",
        "    #define FXAA_QUALITY_P8 2.0",
        "    #define FXAA_QUALITY_P9 4.0",
        "    #define FXAA_QUALITY_P10 8.0",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_QUALITY_PRESET == 29)",
        "    #define FXAA_QUALITY_PS 12",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.5",
        "    #define FXAA_QUALITY_P2 2.0",
        "    #define FXAA_QUALITY_P3 2.0",
        "    #define FXAA_QUALITY_P4 2.0",
        "    #define FXAA_QUALITY_P5 2.0",
        "    #define FXAA_QUALITY_P6 2.0",
        "    #define FXAA_QUALITY_P7 2.0",
        "    #define FXAA_QUALITY_P8 2.0",
        "    #define FXAA_QUALITY_P9 2.0",
        "    #define FXAA_QUALITY_P10 4.0",
        "    #define FXAA_QUALITY_P11 8.0",
        "#endif",
        "",
        "/*============================================================================",
        "                     FXAA QUALITY - EXTREME QUALITY",
        "============================================================================*/",
        "#if (FXAA_QUALITY_PRESET == 39)",
        "    #define FXAA_QUALITY_PS 12",
        "    #define FXAA_QUALITY_P0 1.0",
        "    #define FXAA_QUALITY_P1 1.0",
        "    #define FXAA_QUALITY_P2 1.0",
        "    #define FXAA_QUALITY_P3 1.0",
        "    #define FXAA_QUALITY_P4 1.0",
        "    #define FXAA_QUALITY_P5 1.5",
        "    #define FXAA_QUALITY_P6 2.0",
        "    #define FXAA_QUALITY_P7 2.0",
        "    #define FXAA_QUALITY_P8 2.0",
        "    #define FXAA_QUALITY_P9 2.0",
        "    #define FXAA_QUALITY_P10 4.0",
        "    #define FXAA_QUALITY_P11 8.0",
        "#endif",
        "",
        "",
        "",
        "/*============================================================================",
        "",
        "                                API PORTING",
        "",
        "============================================================================*/",
        "#if (FXAA_GLSL_100 == 1) || (FXAA_GLSL_120 == 1) || (FXAA_GLSL_130 == 1)",
        "    #define FxaaBool bool",
        "    #define FxaaDiscard discard",
        "    #define FxaaFloat float",
        "    #define FxaaFloat2 vec2",
        "    #define FxaaFloat3 vec3",
        "    #define FxaaFloat4 vec4",
        "    #define FxaaHalf float",
        "    #define FxaaHalf2 vec2",
        "    #define FxaaHalf3 vec3",
        "    #define FxaaHalf4 vec4",
        "    #define FxaaInt2 ivec2",
        "    #define FxaaSat(x) clamp(x, 0.0, 1.0)",
        "    #define FxaaTex sampler2D",
        "#else",
        "    #define FxaaBool bool",
        "    #define FxaaDiscard clip(-1)",
        "    #define FxaaFloat float",
        "    #define FxaaFloat2 float2",
        "    #define FxaaFloat3 float3",
        "    #define FxaaFloat4 float4",
        "    #define FxaaHalf half",
        "    #define FxaaHalf2 half2",
        "    #define FxaaHalf3 half3",
        "    #define FxaaHalf4 half4",
        "    #define FxaaSat(x) saturate(x)",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_GLSL_100 == 1)",
        "  #define FxaaTexTop(t, p) texture2D(t, p, 0.0)",
        "  #define FxaaTexOff(t, p, o, r) texture2D(t, p + (o * r), 0.0)",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_GLSL_120 == 1)",
        "    // Requires,",
        "    //  #version 120",
        "    // And at least,",
        "    //  #extension GL_EXT_gpu_shader4 : enable",
        "    //  (or set FXAA_FAST_PIXEL_OFFSET 1 to work like DX9)",
        "    #define FxaaTexTop(t, p) texture2DLod(t, p, 0.0)",
        "    #if (FXAA_FAST_PIXEL_OFFSET == 1)",
        "        #define FxaaTexOff(t, p, o, r) texture2DLodOffset(t, p, 0.0, o)",
        "    #else",
        "        #define FxaaTexOff(t, p, o, r) texture2DLod(t, p + (o * r), 0.0)",
        "    #endif",
        "    #if (FXAA_GATHER4_ALPHA == 1)",
        "        // use #extension GL_ARB_gpu_shader5 : enable",
        "        #define FxaaTexAlpha4(t, p) textureGather(t, p, 3)",
        "        #define FxaaTexOffAlpha4(t, p, o) textureGatherOffset(t, p, o, 3)",
        "        #define FxaaTexGreen4(t, p) textureGather(t, p, 1)",
        "        #define FxaaTexOffGreen4(t, p, o) textureGatherOffset(t, p, o, 1)",
        "    #endif",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_GLSL_130 == 1)",
        "    // Requires \"#version 130\" or better",
        "    #define FxaaTexTop(t, p) textureLod(t, p, 0.0)",
        "    #define FxaaTexOff(t, p, o, r) textureLodOffset(t, p, 0.0, o)",
        "    #if (FXAA_GATHER4_ALPHA == 1)",
        "        // use #extension GL_ARB_gpu_shader5 : enable",
        "        #define FxaaTexAlpha4(t, p) textureGather(t, p, 3)",
        "        #define FxaaTexOffAlpha4(t, p, o) textureGatherOffset(t, p, o, 3)",
        "        #define FxaaTexGreen4(t, p) textureGather(t, p, 1)",
        "        #define FxaaTexOffGreen4(t, p, o) textureGatherOffset(t, p, o, 1)",
        "    #endif",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_HLSL_3 == 1)",
        "    #define FxaaInt2 float2",
        "    #define FxaaTex sampler2D",
        "    #define FxaaTexTop(t, p) tex2Dlod(t, float4(p, 0.0, 0.0))",
        "    #define FxaaTexOff(t, p, o, r) tex2Dlod(t, float4(p + (o * r), 0, 0))",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_HLSL_4 == 1)",
        "    #define FxaaInt2 int2",
        "    struct FxaaTex { SamplerState smpl; Texture2D tex; };",
        "    #define FxaaTexTop(t, p) t.tex.SampleLevel(t.smpl, p, 0.0)",
        "    #define FxaaTexOff(t, p, o, r) t.tex.SampleLevel(t.smpl, p, 0.0, o)",
        "#endif",
        "/*--------------------------------------------------------------------------*/",
        "#if (FXAA_HLSL_5 == 1)",
        "    #define FxaaInt2 int2",
        "    struct FxaaTex { SamplerState smpl; Texture2D tex; };",
        "    #define FxaaTexTop(t, p) t.tex.SampleLevel(t.smpl, p, 0.0)",
        "    #define FxaaTexOff(t, p, o, r) t.tex.SampleLevel(t.smpl, p, 0.0, o)",
        "    #define FxaaTexAlpha4(t, p) t.tex.GatherAlpha(t.smpl, p)",
        "    #define FxaaTexOffAlpha4(t, p, o) t.tex.GatherAlpha(t.smpl, p, o)",
        "    #define FxaaTexGreen4(t, p) t.tex.GatherGreen(t.smpl, p)",
        "    #define FxaaTexOffGreen4(t, p, o) t.tex.GatherGreen(t.smpl, p, o)",
        "#endif",
        "",
        "",
        "/*============================================================================",
        "                   GREEN AS LUMA OPTION SUPPORT FUNCTION",
        "============================================================================*/",
        "#if (FXAA_GREEN_AS_LUMA == 0)",
        "    FxaaFloat FxaaLuma(FxaaFloat4 rgba) { return rgba.w; }",
        "#else",
        "    FxaaFloat FxaaLuma(FxaaFloat4 rgba) { return rgba.y; }",
        "#endif",
        "",
        "",
        "",
        "",
        "/*============================================================================",
        "",
        "                             FXAA3 QUALITY - PC",
        "",
        "============================================================================*/",
        "#if (FXAA_PC == 1)",
        "/*--------------------------------------------------------------------------*/",
        "FxaaFloat4 FxaaPixelShader(",
        "    //",
        "    // Use noperspective interpolation here (turn off perspective interpolation).",
        "    // {xy} = center of pixel",
        "    FxaaFloat2 pos,",
        "    //",
        "    // Used only for FXAA Console, and not used on the 360 version.",
        "    // Use noperspective interpolation here (turn off perspective interpolation).",
        "    // {xy_} = upper left of pixel",
        "    // {_zw} = lower right of pixel",
        "    FxaaFloat4 fxaaConsolePosPos,",
        "    //",
        "    // Input color texture.",
        "    // {rgb_} = color in linear or perceptual color space",
        "    // if (FXAA_GREEN_AS_LUMA == 0)",
        "    //     {__a} = luma in perceptual color space (not linear)",
        "    FxaaTex tex,",
        "    //",
        "    // Only used on the optimized 360 version of FXAA Console.",
        "    // For everything but 360, just use the same input here as for \"tex\".",
        "    // For 360, same texture, just alias with a 2nd sampler.",
        "    // This sampler needs to have an exponent bias of -1.",
        "    FxaaTex fxaaConsole360TexExpBiasNegOne,",
        "    //",
        "    // Only used on the optimized 360 version of FXAA Console.",
        "    // For everything but 360, just use the same input here as for \"tex\".",
        "    // For 360, same texture, just alias with a 3nd sampler.",
        "    // This sampler needs to have an exponent bias of -2.",
        "    FxaaTex fxaaConsole360TexExpBiasNegTwo,",
        "    //",
        "    // Only used on FXAA Quality.",
        "    // This must be from a constant/uniform.",
        "    // {x_} = 1.0/screenWidthInPixels",
        "    // {_y} = 1.0/screenHeightInPixels",
        "    FxaaFloat2 fxaaQualityRcpFrame,",
        "    //",
        "    // Only used on FXAA Console.",
        "    // This must be from a constant/uniform.",
        "    // This effects sub-pixel AA quality and inversely sharpness.",
        "    //   Where N ranges between,",
        "    //     N = 0.50 (default)",
        "    //     N = 0.33 (sharper)",
        "    // {x__} = -N/screenWidthInPixels",
        "    // {_y_} = -N/screenHeightInPixels",
        "    // {_z_} =  N/screenWidthInPixels",
        "    // {__w} =  N/screenHeightInPixels",
        "    FxaaFloat4 fxaaConsoleRcpFrameOpt,",
        "    //",
        "    // Only used on FXAA Console.",
        "    // Not used on 360, but used on PS3 and PC.",
        "    // This must be from a constant/uniform.",
        "    // {x__} = -2.0/screenWidthInPixels",
        "    // {_y_} = -2.0/screenHeightInPixels",
        "    // {_z_} =  2.0/screenWidthInPixels",
        "    // {__w} =  2.0/screenHeightInPixels",
        "    FxaaFloat4 fxaaConsoleRcpFrameOpt2,",
        "    //",
        "    // Only used on FXAA Console.",
        "    // Only used on 360 in place of fxaaConsoleRcpFrameOpt2.",
        "    // This must be from a constant/uniform.",
        "    // {x__} =  8.0/screenWidthInPixels",
        "    // {_y_} =  8.0/screenHeightInPixels",
        "    // {_z_} = -4.0/screenWidthInPixels",
        "    // {__w} = -4.0/screenHeightInPixels",
        "    FxaaFloat4 fxaaConsole360RcpFrameOpt2,",
        "    //",
        "    // Only used on FXAA Quality.",
        "    // This used to be the FXAA_QUALITY_SUBPIX define.",
        "    // It is here now to allow easier tuning.",
        "    // Choose the amount of sub-pixel aliasing removal.",
        "    // This can effect sharpness.",
        "    //   1.00 - upper limit (softer)",
        "    //   0.75 - default amount of filtering",
        "    //   0.50 - lower limit (sharper, less sub-pixel aliasing removal)",
        "    //   0.25 - almost off",
        "    //   0.00 - completely off",
        "    FxaaFloat fxaaQualitySubpix,",
        "    //",
        "    // Only used on FXAA Quality.",
        "    // This used to be the FXAA_QUALITY_EDGE_THRESHOLD define.",
        "    // It is here now to allow easier tuning.",
        "    // The minimum amount of local contrast required to apply algorithm.",
        "    //   0.333 - too little (faster)",
        "    //   0.250 - low quality",
        "    //   0.166 - default",
        "    //   0.125 - high quality",
        "    //   0.063 - overkill (slower)",
        "    FxaaFloat fxaaQualityEdgeThreshold,",
        "    //",
        "    // Only used on FXAA Quality.",
        "    // This used to be the FXAA_QUALITY_EDGE_THRESHOLD_MIN define.",
        "    // It is here now to allow easier tuning.",
        "    // Trims the algorithm from processing darks.",
        "    //   0.0833 - upper limit (default, the start of visible unfiltered edges)",
        "    //   0.0625 - high quality (faster)",
        "    //   0.0312 - visible limit (slower)",
        "    // Special notes when using FXAA_GREEN_AS_LUMA,",
        "    //   Likely want to set this to zero.",
        "    //   As colors that are mostly not-green",
        "    //   will appear very dark in the green channel!",
        "    //   Tune by looking at mostly non-green content,",
        "    //   then start at zero and increase until aliasing is a problem.",
        "    FxaaFloat fxaaQualityEdgeThresholdMin,",
        "    //",
        "    // Only used on FXAA Console.",
        "    // This used to be the FXAA_CONSOLE_EDGE_SHARPNESS define.",
        "    // It is here now to allow easier tuning.",
        "    // This does not effect PS3, as this needs to be compiled in.",
        "    //   Use FXAA_CONSOLE_PS3_EDGE_SHARPNESS for PS3.",
        "    //   Due to the PS3 being ALU bound,",
        "    //   there are only three safe values here: 2 and 4 and 8.",
        "    //   These options use the shaders ability to a free *|/ by 2|4|8.",
        "    // For all other platforms can be a non-power of two.",
        "    //   8.0 is sharper (default!!!)",
        "    //   4.0 is softer",
        "    //   2.0 is really soft (good only for vector graphics inputs)",
        "    FxaaFloat fxaaConsoleEdgeSharpness,",
        "    //",
        "    // Only used on FXAA Console.",
        "    // This used to be the FXAA_CONSOLE_EDGE_THRESHOLD define.",
        "    // It is here now to allow easier tuning.",
        "    // This does not effect PS3, as this needs to be compiled in.",
        "    //   Use FXAA_CONSOLE_PS3_EDGE_THRESHOLD for PS3.",
        "    //   Due to the PS3 being ALU bound,",
        "    //   there are only two safe values here: 1/4 and 1/8.",
        "    //   These options use the shaders ability to a free *|/ by 2|4|8.",
        "    // The console setting has a different mapping than the quality setting.",
        "    // Other platforms can use other values.",
        "    //   0.125 leaves less aliasing, but is softer (default!!!)",
        "    //   0.25 leaves more aliasing, and is sharper",
        "    FxaaFloat fxaaConsoleEdgeThreshold,",
        "    //",
        "    // Only used on FXAA Console.",
        "    // This used to be the FXAA_CONSOLE_EDGE_THRESHOLD_MIN define.",
        "    // It is here now to allow easier tuning.",
        "    // Trims the algorithm from processing darks.",
        "    // The console setting has a different mapping than the quality setting.",
        "    // This only applies when FXAA_EARLY_EXIT is 1.",
        "    // This does not apply to PS3,",
        "    // PS3 was simplified to avoid more shader instructions.",
        "    //   0.06 - faster but more aliasing in darks",
        "    //   0.05 - default",
        "    //   0.04 - slower and less aliasing in darks",
        "    // Special notes when using FXAA_GREEN_AS_LUMA,",
        "    //   Likely want to set this to zero.",
        "    //   As colors that are mostly not-green",
        "    //   will appear very dark in the green channel!",
        "    //   Tune by looking at mostly non-green content,",
        "    //   then start at zero and increase until aliasing is a problem.",
        "    FxaaFloat fxaaConsoleEdgeThresholdMin,",
        "    //",
        "    // Extra constants for 360 FXAA Console only.",
        "    // Use zeros or anything else for other platforms.",
        "    // These must be in physical constant registers and NOT immediates.",
        "    // Immediates will result in compiler un-optimizing.",
        "    // {xyzw} = float4(1.0, -1.0, 0.25, -0.25)",
        "    FxaaFloat4 fxaaConsole360ConstDir",
        ") {",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat2 posM;",
        "    posM.x = pos.x;",
        "    posM.y = pos.y;",
        "    #if (FXAA_GATHER4_ALPHA == 1)",
        "        #if (FXAA_DISCARD == 0)",
        "            FxaaFloat4 rgbyM = FxaaTexTop(tex, posM);",
        "            #if (FXAA_GREEN_AS_LUMA == 0)",
        "                #define lumaM rgbyM.w",
        "            #else",
        "                #define lumaM rgbyM.y",
        "            #endif",
        "        #endif",
        "        #if (FXAA_GREEN_AS_LUMA == 0)",
        "            FxaaFloat4 luma4A = FxaaTexAlpha4(tex, posM);",
        "            FxaaFloat4 luma4B = FxaaTexOffAlpha4(tex, posM, FxaaInt2(-1, -1));",
        "        #else",
        "            FxaaFloat4 luma4A = FxaaTexGreen4(tex, posM);",
        "            FxaaFloat4 luma4B = FxaaTexOffGreen4(tex, posM, FxaaInt2(-1, -1));",
        "        #endif",
        "        #if (FXAA_DISCARD == 1)",
        "            #define lumaM luma4A.w",
        "        #endif",
        "        #define lumaE luma4A.z",
        "        #define lumaS luma4A.x",
        "        #define lumaSE luma4A.y",
        "        #define lumaNW luma4B.w",
        "        #define lumaN luma4B.z",
        "        #define lumaW luma4B.x",
        "    #else",
        "        FxaaFloat4 rgbyM = FxaaTexTop(tex, posM);",
        "        #if (FXAA_GREEN_AS_LUMA == 0)",
        "            #define lumaM rgbyM.w",
        "        #else",
        "            #define lumaM rgbyM.y",
        "        #endif",
        "        #if (FXAA_GLSL_100 == 1)",
        "          FxaaFloat lumaS = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 0.0, 1.0), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaE = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 1.0, 0.0), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaN = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 0.0,-1.0), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaW = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2(-1.0, 0.0), fxaaQualityRcpFrame.xy));",
        "        #else",
        "          FxaaFloat lumaS = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 0, 1), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 1, 0), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaN = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 0,-1), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1, 0), fxaaQualityRcpFrame.xy));",
        "        #endif",
        "    #endif",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat maxSM = max(lumaS, lumaM);",
        "    FxaaFloat minSM = min(lumaS, lumaM);",
        "    FxaaFloat maxESM = max(lumaE, maxSM);",
        "    FxaaFloat minESM = min(lumaE, minSM);",
        "    FxaaFloat maxWN = max(lumaN, lumaW);",
        "    FxaaFloat minWN = min(lumaN, lumaW);",
        "    FxaaFloat rangeMax = max(maxWN, maxESM);",
        "    FxaaFloat rangeMin = min(minWN, minESM);",
        "    FxaaFloat rangeMaxScaled = rangeMax * fxaaQualityEdgeThreshold;",
        "    FxaaFloat range = rangeMax - rangeMin;",
        "    FxaaFloat rangeMaxClamped = max(fxaaQualityEdgeThresholdMin, rangeMaxScaled);",
        "    FxaaBool earlyExit = range < rangeMaxClamped;",
        "/*--------------------------------------------------------------------------*/",
        "    if(earlyExit)",
        "        #if (FXAA_DISCARD == 1)",
        "            FxaaDiscard;",
        "        #else",
        "            return rgbyM;",
        "        #endif",
        "/*--------------------------------------------------------------------------*/",
        "    #if (FXAA_GATHER4_ALPHA == 0)",
        "        #if (FXAA_GLSL_100 == 1)",
        "          FxaaFloat lumaNW = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2(-1.0,-1.0), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaSE = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 1.0, 1.0), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaNE = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 1.0,-1.0), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaSW = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2(-1.0, 1.0), fxaaQualityRcpFrame.xy));",
        "        #else",
        "          FxaaFloat lumaNW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1,-1), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaSE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 1, 1), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaNE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 1,-1), fxaaQualityRcpFrame.xy));",
        "          FxaaFloat lumaSW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1, 1), fxaaQualityRcpFrame.xy));",
        "        #endif",
        "    #else",
        "        FxaaFloat lumaNE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(1, -1), fxaaQualityRcpFrame.xy));",
        "        FxaaFloat lumaSW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1, 1), fxaaQualityRcpFrame.xy));",
        "    #endif",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat lumaNS = lumaN + lumaS;",
        "    FxaaFloat lumaWE = lumaW + lumaE;",
        "    FxaaFloat subpixRcpRange = 1.0/range;",
        "    FxaaFloat subpixNSWE = lumaNS + lumaWE;",
        "    FxaaFloat edgeHorz1 = (-2.0 * lumaM) + lumaNS;",
        "    FxaaFloat edgeVert1 = (-2.0 * lumaM) + lumaWE;",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat lumaNESE = lumaNE + lumaSE;",
        "    FxaaFloat lumaNWNE = lumaNW + lumaNE;",
        "    FxaaFloat edgeHorz2 = (-2.0 * lumaE) + lumaNESE;",
        "    FxaaFloat edgeVert2 = (-2.0 * lumaN) + lumaNWNE;",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat lumaNWSW = lumaNW + lumaSW;",
        "    FxaaFloat lumaSWSE = lumaSW + lumaSE;",
        "    FxaaFloat edgeHorz4 = (abs(edgeHorz1) * 2.0) + abs(edgeHorz2);",
        "    FxaaFloat edgeVert4 = (abs(edgeVert1) * 2.0) + abs(edgeVert2);",
        "    FxaaFloat edgeHorz3 = (-2.0 * lumaW) + lumaNWSW;",
        "    FxaaFloat edgeVert3 = (-2.0 * lumaS) + lumaSWSE;",
        "    FxaaFloat edgeHorz = abs(edgeHorz3) + edgeHorz4;",
        "    FxaaFloat edgeVert = abs(edgeVert3) + edgeVert4;",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat subpixNWSWNESE = lumaNWSW + lumaNESE;",
        "    FxaaFloat lengthSign = fxaaQualityRcpFrame.x;",
        "    FxaaBool horzSpan = edgeHorz >= edgeVert;",
        "    FxaaFloat subpixA = subpixNSWE * 2.0 + subpixNWSWNESE;",
        "/*--------------------------------------------------------------------------*/",
        "    if(!horzSpan) lumaN = lumaW;",
        "    if(!horzSpan) lumaS = lumaE;",
        "    if(horzSpan) lengthSign = fxaaQualityRcpFrame.y;",
        "    FxaaFloat subpixB = (subpixA * (1.0/12.0)) - lumaM;",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat gradientN = lumaN - lumaM;",
        "    FxaaFloat gradientS = lumaS - lumaM;",
        "    FxaaFloat lumaNN = lumaN + lumaM;",
        "    FxaaFloat lumaSS = lumaS + lumaM;",
        "    FxaaBool pairN = abs(gradientN) >= abs(gradientS);",
        "    FxaaFloat gradient = max(abs(gradientN), abs(gradientS));",
        "    if(pairN) lengthSign = -lengthSign;",
        "    FxaaFloat subpixC = FxaaSat(abs(subpixB) * subpixRcpRange);",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat2 posB;",
        "    posB.x = posM.x;",
        "    posB.y = posM.y;",
        "    FxaaFloat2 offNP;",
        "    offNP.x = (!horzSpan) ? 0.0 : fxaaQualityRcpFrame.x;",
        "    offNP.y = ( horzSpan) ? 0.0 : fxaaQualityRcpFrame.y;",
        "    if(!horzSpan) posB.x += lengthSign * 0.5;",
        "    if( horzSpan) posB.y += lengthSign * 0.5;",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat2 posN;",
        "    posN.x = posB.x - offNP.x * FXAA_QUALITY_P0;",
        "    posN.y = posB.y - offNP.y * FXAA_QUALITY_P0;",
        "    FxaaFloat2 posP;",
        "    posP.x = posB.x + offNP.x * FXAA_QUALITY_P0;",
        "    posP.y = posB.y + offNP.y * FXAA_QUALITY_P0;",
        "    FxaaFloat subpixD = ((-2.0)*subpixC) + 3.0;",
        "    FxaaFloat lumaEndN = FxaaLuma(FxaaTexTop(tex, posN));",
        "    FxaaFloat subpixE = subpixC * subpixC;",
        "    FxaaFloat lumaEndP = FxaaLuma(FxaaTexTop(tex, posP));",
        "/*--------------------------------------------------------------------------*/",
        "    if(!pairN) lumaNN = lumaSS;",
        "    FxaaFloat gradientScaled = gradient * 1.0/4.0;",
        "    FxaaFloat lumaMM = lumaM - lumaNN * 0.5;",
        "    FxaaFloat subpixF = subpixD * subpixE;",
        "    FxaaBool lumaMLTZero = lumaMM < 0.0;",
        "/*--------------------------------------------------------------------------*/",
        "    lumaEndN -= lumaNN * 0.5;",
        "    lumaEndP -= lumaNN * 0.5;",
        "    FxaaBool doneN = abs(lumaEndN) >= gradientScaled;",
        "    FxaaBool doneP = abs(lumaEndP) >= gradientScaled;",
        "    if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P1;",
        "    if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P1;",
        "    FxaaBool doneNP = (!doneN) || (!doneP);",
        "    if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P1;",
        "    if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P1;",
        "/*--------------------------------------------------------------------------*/",
        "    if(doneNP) {",
        "        if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "        if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "        if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "        if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "        doneN = abs(lumaEndN) >= gradientScaled;",
        "        doneP = abs(lumaEndP) >= gradientScaled;",
        "        if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P2;",
        "        if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P2;",
        "        doneNP = (!doneN) || (!doneP);",
        "        if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P2;",
        "        if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P2;",
        "/*--------------------------------------------------------------------------*/",
        "        #if (FXAA_QUALITY_PS > 3)",
        "        if(doneNP) {",
        "            if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "            if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "            if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "            if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "            doneN = abs(lumaEndN) >= gradientScaled;",
        "            doneP = abs(lumaEndP) >= gradientScaled;",
        "            if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P3;",
        "            if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P3;",
        "            doneNP = (!doneN) || (!doneP);",
        "            if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P3;",
        "            if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P3;",
        "/*--------------------------------------------------------------------------*/",
        "            #if (FXAA_QUALITY_PS > 4)",
        "            if(doneNP) {",
        "                if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "                if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "                if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "                if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "                doneN = abs(lumaEndN) >= gradientScaled;",
        "                doneP = abs(lumaEndP) >= gradientScaled;",
        "                if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P4;",
        "                if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P4;",
        "                doneNP = (!doneN) || (!doneP);",
        "                if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P4;",
        "                if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P4;",
        "/*--------------------------------------------------------------------------*/",
        "                #if (FXAA_QUALITY_PS > 5)",
        "                if(doneNP) {",
        "                    if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "                    if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "                    if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "                    if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "                    doneN = abs(lumaEndN) >= gradientScaled;",
        "                    doneP = abs(lumaEndP) >= gradientScaled;",
        "                    if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P5;",
        "                    if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P5;",
        "                    doneNP = (!doneN) || (!doneP);",
        "                    if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P5;",
        "                    if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P5;",
        "/*--------------------------------------------------------------------------*/",
        "                    #if (FXAA_QUALITY_PS > 6)",
        "                    if(doneNP) {",
        "                        if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "                        if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "                        if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "                        if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "                        doneN = abs(lumaEndN) >= gradientScaled;",
        "                        doneP = abs(lumaEndP) >= gradientScaled;",
        "                        if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P6;",
        "                        if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P6;",
        "                        doneNP = (!doneN) || (!doneP);",
        "                        if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P6;",
        "                        if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P6;",
        "/*--------------------------------------------------------------------------*/",
        "                        #if (FXAA_QUALITY_PS > 7)",
        "                        if(doneNP) {",
        "                            if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "                            if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "                            if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "                            if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "                            doneN = abs(lumaEndN) >= gradientScaled;",
        "                            doneP = abs(lumaEndP) >= gradientScaled;",
        "                            if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P7;",
        "                            if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P7;",
        "                            doneNP = (!doneN) || (!doneP);",
        "                            if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P7;",
        "                            if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P7;",
        "/*--------------------------------------------------------------------------*/",
        "    #if (FXAA_QUALITY_PS > 8)",
        "    if(doneNP) {",
        "        if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "        if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "        if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "        if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "        doneN = abs(lumaEndN) >= gradientScaled;",
        "        doneP = abs(lumaEndP) >= gradientScaled;",
        "        if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P8;",
        "        if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P8;",
        "        doneNP = (!doneN) || (!doneP);",
        "        if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P8;",
        "        if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P8;",
        "/*--------------------------------------------------------------------------*/",
        "        #if (FXAA_QUALITY_PS > 9)",
        "        if(doneNP) {",
        "            if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "            if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "            if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "            if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "            doneN = abs(lumaEndN) >= gradientScaled;",
        "            doneP = abs(lumaEndP) >= gradientScaled;",
        "            if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P9;",
        "            if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P9;",
        "            doneNP = (!doneN) || (!doneP);",
        "            if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P9;",
        "            if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P9;",
        "/*--------------------------------------------------------------------------*/",
        "            #if (FXAA_QUALITY_PS > 10)",
        "            if(doneNP) {",
        "                if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "                if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "                if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "                if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "                doneN = abs(lumaEndN) >= gradientScaled;",
        "                doneP = abs(lumaEndP) >= gradientScaled;",
        "                if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P10;",
        "                if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P10;",
        "                doneNP = (!doneN) || (!doneP);",
        "                if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P10;",
        "                if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P10;",
        "/*--------------------------------------------------------------------------*/",
        "                #if (FXAA_QUALITY_PS > 11)",
        "                if(doneNP) {",
        "                    if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "                    if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "                    if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "                    if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "                    doneN = abs(lumaEndN) >= gradientScaled;",
        "                    doneP = abs(lumaEndP) >= gradientScaled;",
        "                    if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P11;",
        "                    if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P11;",
        "                    doneNP = (!doneN) || (!doneP);",
        "                    if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P11;",
        "                    if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P11;",
        "/*--------------------------------------------------------------------------*/",
        "                    #if (FXAA_QUALITY_PS > 12)",
        "                    if(doneNP) {",
        "                        if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));",
        "                        if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));",
        "                        if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;",
        "                        if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;",
        "                        doneN = abs(lumaEndN) >= gradientScaled;",
        "                        doneP = abs(lumaEndP) >= gradientScaled;",
        "                        if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P12;",
        "                        if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P12;",
        "                        doneNP = (!doneN) || (!doneP);",
        "                        if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P12;",
        "                        if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P12;",
        "/*--------------------------------------------------------------------------*/",
        "                    }",
        "                    #endif",
        "/*--------------------------------------------------------------------------*/",
        "                }",
        "                #endif",
        "/*--------------------------------------------------------------------------*/",
        "            }",
        "            #endif",
        "/*--------------------------------------------------------------------------*/",
        "        }",
        "        #endif",
        "/*--------------------------------------------------------------------------*/",
        "    }",
        "    #endif",
        "/*--------------------------------------------------------------------------*/",
        "                        }",
        "                        #endif",
        "/*--------------------------------------------------------------------------*/",
        "                    }",
        "                    #endif",
        "/*--------------------------------------------------------------------------*/",
        "                }",
        "                #endif",
        "/*--------------------------------------------------------------------------*/",
        "            }",
        "            #endif",
        "/*--------------------------------------------------------------------------*/",
        "        }",
        "        #endif",
        "/*--------------------------------------------------------------------------*/",
        "    }",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat dstN = posM.x - posN.x;",
        "    FxaaFloat dstP = posP.x - posM.x;",
        "    if(!horzSpan) dstN = posM.y - posN.y;",
        "    if(!horzSpan) dstP = posP.y - posM.y;",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaBool goodSpanN = (lumaEndN < 0.0) != lumaMLTZero;",
        "    FxaaFloat spanLength = (dstP + dstN);",
        "    FxaaBool goodSpanP = (lumaEndP < 0.0) != lumaMLTZero;",
        "    FxaaFloat spanLengthRcp = 1.0/spanLength;",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaBool directionN = dstN < dstP;",
        "    FxaaFloat dst = min(dstN, dstP);",
        "    FxaaBool goodSpan = directionN ? goodSpanN : goodSpanP;",
        "    FxaaFloat subpixG = subpixF * subpixF;",
        "    FxaaFloat pixelOffset = (dst * (-spanLengthRcp)) + 0.5;",
        "    FxaaFloat subpixH = subpixG * fxaaQualitySubpix;",
        "/*--------------------------------------------------------------------------*/",
        "    FxaaFloat pixelOffsetGood = goodSpan ? pixelOffset : 0.0;",
        "    FxaaFloat pixelOffsetSubpix = max(pixelOffsetGood, subpixH);",
        "    if(!horzSpan) posM.x += pixelOffsetSubpix * lengthSign;",
        "    if( horzSpan) posM.y += pixelOffsetSubpix * lengthSign;",
        "    #if (FXAA_DISCARD == 1)",
        "        return FxaaTexTop(tex, posM);",
        "    #else",
        "        return FxaaFloat4(FxaaTexTop(tex, posM).xyz, lumaM);",
        "    #endif",
        "}",
        "/*==========================================================================*/",
        "#endif",
        "",
        "void main() {",
        "  gl_FragColor = FxaaPixelShader(",
        "    vUv,",
        "    vec4(0.0),",
        "    tDiffuse,",
        "    tDiffuse,",
        "    tDiffuse,",
        "    resolution,",
        "    vec4(0.0),",
        "    vec4(0.0),",
        "    vec4(0.0),",
        "    0.75,",
        "    0.166,",
        "    0.0833,",
        "    0.0,",
        "    0.0,",
        "    0.0,",
        "    vec4(0.0)",
        "  );",
        "",
        "  // TODO avoid querying texture twice for same texel",
        "  gl_FragColor.a = texture2D(tDiffuse, vUv).a;",
        "}"
	].join("\n")

};

 return THREE.FXAAShader;
});
define('shaders/SSAOShader',["three"], function(THREE){
/**
 * @author Mugen87 / https://github.com/Mugen87
 *
 * References:
 * http://john-chapman-graphics.blogspot.com/2013/01/ssao-tutorial.html
 * https://learnopengl.com/Advanced-Lighting/SSAO
 * https://github.com/McNopper/OpenGL/blob/master/Example28/shader/ssao.frag.glsl
 */

THREE.SSAOShader = {

	defines: {
		"PERSPECTIVE_CAMERA": 1,
		"KERNEL_SIZE": 32
	},

	uniforms: {

		"tDiffuse": { value: null },
		"tNormal": { value: null },
		"tDepth": { value: null },
		"tNoise": { value: null },
		"kernel": { value: null },
		"cameraNear": { value: null },
		"cameraFar": { value: null },
		"resolution": { value: new THREE.Vector2() },
		"cameraProjectionMatrix": { value: new THREE.Matrix4() },
		"cameraInverseProjectionMatrix": { value: new THREE.Matrix4() },
		"kernelRadius": { value: 8 },
		"minDistance": { value: 0.005 },
		"maxDistance": { value: 0.05 },

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

		"	vUv = uv;",

		"	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"uniform sampler2D tDiffuse;",
		"uniform sampler2D tNormal;",
		"uniform sampler2D tDepth;",
		"uniform sampler2D tNoise;",

		"uniform vec3 kernel[ KERNEL_SIZE ];",

		"uniform vec2 resolution;",

		"uniform float cameraNear;",
		"uniform float cameraFar;",
		"uniform mat4 cameraProjectionMatrix;",
		"uniform mat4 cameraInverseProjectionMatrix;",

		"uniform float kernelRadius;",
		"uniform float minDistance;", // avoid artifacts caused by neighbour fragments with minimal depth difference
		"uniform float maxDistance;", // avoid the influence of fragments which are too far away

		"varying vec2 vUv;",

		"#include <packing>",

		"float getDepth( const in vec2 screenPosition ) {",

		"	return texture2D( tDepth, screenPosition ).x;",

		"}",

		"float getLinearDepth( const in vec2 screenPosition ) {",

		"	#if PERSPECTIVE_CAMERA == 1",

		"		float fragCoordZ = texture2D( tDepth, screenPosition ).x;",
		"		float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );",
		"		return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );",

		"	#else",

		"		return texture2D( depthSampler, coord ).x;",

		"	#endif",

		"}",

		"float getViewZ( const in float depth ) {",

		"	#if PERSPECTIVE_CAMERA == 1",

		"		return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );",

		"	#else",

		"		return orthographicDepthToViewZ( depth, cameraNear, cameraFar );",

		"	#endif",

		"}",

		"vec3 getViewPosition( const in vec2 screenPosition, const in float depth, const in float viewZ ) {",

		"	float clipW = cameraProjectionMatrix[2][3] * viewZ + cameraProjectionMatrix[3][3];",

		"	vec4 clipPosition = vec4( ( vec3( screenPosition, depth ) - 0.5 ) * 2.0, 1.0 );",

		"	clipPosition *= clipW; // unprojection.",

		"	return ( cameraInverseProjectionMatrix * clipPosition ).xyz;",

		"}",

		"vec3 getViewNormal( const in vec2 screenPosition ) {",

		"	return unpackRGBToNormal( texture2D( tNormal, screenPosition ).xyz );",

		"}",

		"void main() {",

		"	float depth = getDepth( vUv );",
		"	float viewZ = getViewZ( depth );",

		"	vec3 viewPosition = getViewPosition( vUv, depth, viewZ );",
		"	vec3 viewNormal = getViewNormal( vUv );",

		" vec2 noiseScale = vec2( resolution.x / 4.0, resolution.y / 4.0 );",
		"	vec3 random = texture2D( tNoise, vUv * noiseScale ).xyz;",

		// compute matrix used to reorient a kernel vector

		"	vec3 tangent = normalize( random - viewNormal * dot( random, viewNormal ) );",
		"	vec3 bitangent = cross( viewNormal, tangent );",
		"	mat3 kernelMatrix = mat3( tangent, bitangent, viewNormal );",

		" float occlusion = 0.0;",

		" for ( int i = 0; i < KERNEL_SIZE; i ++ ) {",

		"		vec3 sampleVector = kernelMatrix * kernel[ i ];", // reorient sample vector in view space
		"		vec3 samplePoint = viewPosition + ( sampleVector * kernelRadius );", // calculate sample point

		"		vec4 samplePointNDC = cameraProjectionMatrix * vec4( samplePoint, 1.0 );", // project point and calculate NDC
		"		samplePointNDC /= samplePointNDC.w;",

		"		vec2 samplePointUv = samplePointNDC.xy * 0.5 + 0.5;", // compute uv coordinates

		"		float realDepth = getLinearDepth( samplePointUv );", // get linear depth from depth texture
		"		float sampleDepth = viewZToOrthographicDepth( samplePoint.z, cameraNear, cameraFar );", // compute linear depth of the sample view Z value
		"		float delta = sampleDepth - realDepth;",

		"		if ( delta > minDistance && delta < maxDistance ) {", // if fragment is before sample point, increase occlusion

		"			occlusion += 1.0;",

		"		}",

		"	}",

		"	occlusion = clamp( occlusion / float( KERNEL_SIZE ), 0.0, 1.0 );",

		"	gl_FragColor = vec4( vec3( 1.0 - occlusion ), 1.0 );",

		"}"

	].join( "\n" )

};

THREE.SSAODepthShader = {

	defines: {
		"PERSPECTIVE_CAMERA": 1
	},

	uniforms: {

		"tDepth": { value: null },
		"cameraNear": { value: null },
		"cameraFar": { value: null },

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

		"	vUv = uv;",
		"	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"uniform sampler2D tDepth;",

		"uniform float cameraNear;",
		"uniform float cameraFar;",

		"varying vec2 vUv;",

		"#include <packing>",

		"float getLinearDepth( const in vec2 screenPosition ) {",

		"	#if PERSPECTIVE_CAMERA == 1",

		"		float fragCoordZ = texture2D( tDepth, screenPosition ).x;",
		"		float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );",
		"		return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );",

		"	#else",

		"		return texture2D( depthSampler, coord ).x;",

		"	#endif",

		"}",

		"void main() {",

		"	float depth = getLinearDepth( vUv );",
		"	gl_FragColor = vec4( vec3( 1.0 - depth ), 1.0 );",

		"}"

	].join( "\n" )

};

THREE.SSAOBlurShader = {

	uniforms: {

		"tDiffuse": { value: null },
		"resolution": { value: new THREE.Vector2() }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

		"	vUv = uv;",
		"	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"uniform sampler2D tDiffuse;",

		"uniform vec2 resolution;",

		"varying vec2 vUv;",

		"void main() {",

		"	vec2 texelSize = ( 1.0 / resolution );",
		"	float result = 0.0;",

		"	for ( int i = - 2; i <= 2; i ++ ) {",

		"		for ( int j = - 2; j <= 2; j ++ ) {",

		"			vec2 offset = ( vec2( float( i ), float( j ) ) ) * texelSize;",
		"			result += texture2D( tDiffuse, vUv + offset ).r;",

		"		}",

		"	}",

		"	gl_FragColor = vec4( vec3( result / ( 5.0 * 5.0 ) ), 1.0 );",

		"}"

	].join( "\n" )

};

 return THREE.SSAOShader;
});
/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

define('pack-shaders',["shaders/FXAAShader", "shaders/SSAOShader", "shaders/CopyShader"], function( FXAAShader, SSAOShader, CopyShader ){
    return {
        FXAAShader   : FXAAShader,
        SSAOShader   : SSAOShader,
        CopyShader : CopyShader
    };
});


/**
 * Created by bernie on 05.12.15.
 */
define('Draggable',["lodash", "cmd"], function ( _, CMD )
{
    var events = ["mousedown", "mouseup"];
    
    var mouseDown = function( ev ){ 
        CMD.trigger("startTracking", ev); 
    };
    var mouseUp = function( ev ){ 
        CMD.trigger("stopTracking", ev); 
    };
    
    
    var Draggable = {
        
        DomEvents : null,
        
        userEvents : events,
        
        init : function( VP ){
            this.DomEvents = VP.DomEvents;
        },
        
        makeDraggable : function( el, opt ) {
            if ( this.DomEvents === null ) {
                console.log( "Draggable.VP is null, you must set aktive VP" );
                return;
            }
            var scope = el || this;
            
            el.track = function( pos ){
                //scope.position.addVectors( pos );
                //console.log( pos );
                scope.position.x = pos.x;
                scope.position.z = pos.z;
            };
            
            this.DomEvents.addEventListener( scope, events[0], mouseDown );
            this.DomEvents.addEventListener( scope, events[1], mouseUp );
        },

        onMouseDown : CMD.startTracking
    };

    return Draggable;
});
/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

define('Interactive',["three", "lodash"], function( THREE, _ ){
    
    var events = ["mousedown", "mouseup", "click"];
    
    var Interactive = {
        
        DomEvents : null,
        
        init : function( VP ){
            this.DomEvents = VP.DomEvents;
        },
        
        makeInteractive : function( el ) {
            var _eventsMap = {
                mousedown : el._onMousedown,
                mouseup : el._onMouseup,
                dblclick : el._onDblclick,
                click : el._onClick
            };
            var scope = this;
            
            
            scope.DomEvents.on( el, "click", this.onClick );
            _.each( events, function( ev ){
                scope.DomEvents.addEventListener( el, ev, el._eventsMap[ev] );
            });
            this.DomActive = true;
        },
        
        onClick : function(){},
        onMousedown : function(){}
    };
    
    return Interactive;
});

/**
 * Created by bernie on 08.11.15.
 */
define('utilities/IntersectPlane',["three", "lodash"], function ( THREE, _ ) {
    
    var pointer_position = new THREE.Vector3( 0,0,0 );
    
    var options = {
         width      : 100, 
         height     : 100,
         opacity    : 0.0,
         dir        : "xz"
    };

    var IPlane = function( VP, opt )
    {
        var scope = this;
        
        this.options = {};
        _.extend( this.options, options, opt );

        this.camera = VP.camera;
        this.enabled = false;
        this.visible = false;
        
        var side = /*this.options.opacity < .01 ? THREE.BackSide :*/ THREE.FrontSide;

        THREE.Mesh.call( this,
            new THREE.PlaneGeometry( this.options.width, this.options.height ),
            new THREE.MeshBasicMaterial({ opacity: this.options.opacity, transparent: true, side : side })
        );

        this._handleMouseMove = function(){ scope.handleMouseMove.apply(scope, arguments); };

        this.DomEvents = VP.DomEvents;

        if (this.options.dir === "xz") this.rotation.x = Math.PI * -.5;
        if (this.options.dir === "yz") this.rotation.y = Math.PI * -.5;
    };

    IPlane.prototype = _.create( THREE.Mesh.prototype, {
        constructor : IPlane,

        startTracking : function( mouse_position ){
            this.enabled = true;
            this.DomEvents.addEventListener( this, 'mousemove', this._handleMouseMove );
            this.position.set( mouse_position.x, mouse_position.y, mouse_position.z );
        },

        handleMouseMove : function( ev )
        {
            if ( this.enabled )
            {
                pointer_position.copy( ev.intersect.point );
                this.dispatchEvent({ type: "tracking", origDomEvent : ev, pointer_position : pointer_position });
                this.position.copy( pointer_position );
            }
        },
        
        stopTracking : function() 
        {
            if ( this.enabled )
            {
                this.enabled = false;
                this.DomEvents.removeEventListener( this, 'mousemove', this._handleMouseMove );
                this.position.y = -10;
            }
        }
    });

    return IPlane;
});
/**
 * Created by bernie on 01.11.15.
 */
define('plugins/plg.Tracking',["plugin", "three", "cmd", "utilities/IntersectPlane"], function( Plugin, THREE, CMD, IntersectPlane )
{
    var selected_block; 
    var intersect_plane;
    var mouse_position= new THREE.Vector3(0, 0, 0), 
        block_offset = new THREE.Vector3(0, 0, 0),
        track = new THREE.Vector3(0, 0, 0);

    var Tracking = function( opt )
    {
        Plugin.call( this, opt );
    };
    
    Tracking.prototype = Object.create( Plugin.prototype );
    Tracking.prototype.constructor = Tracking;
    //Tracking.prototype.super = Plugin.prototype;
    
    Tracking.prototype.registerEvents = function()
    {
        CMD.on( "viewportInitalized", function( VP )
        {    
            intersect_plane = new IntersectPlane( VP );
            VP.scene.add( intersect_plane );    
            
            intersect_plane.addEventListener( "tracking", this.onTrack );
            VP.DomEvents.addEventListener( VP.scene, "mouseup", this.stopTracking );
        }, this );

        CMD.on( "startTracking", this.startTracking, this );
        CMD.on( "stopTracking", this.stopTracking, this );
    };
    
    Tracking.prototype.removeEvents = function(){
        CMD.off( "startTracking", this.startTracking );
        CMD.off( "stopTracking", this.stopTracking);
    };
    
    Tracking.prototype.startTracking = function( ev )
    {
        CMD.VP.trigger( "disableControl" );

        ev.stopPropagation();
        
        selected_block = ev.target;

        mouse_position.copy( ev.intersect.point );
        block_offset.subVectors( selected_block.position, mouse_position );
        block_offset.y = selected_block.position.y;

        intersect_plane.startTracking( mouse_position );
    };
    
    Tracking.prototype.stopTracking = function()
    {
        CMD.VP.trigger( "enableControl" );
        intersect_plane.stopTracking();

        if ( selected_block !== null ) {
            selected_block = null;
            intersect_plane.position.y = 0;
        }
    };

    Tracking.prototype.onTrack = function( evt )
    {
        var ev = evt.origDomEvent;
        ev.stopPropagation();
       
        if ( selected_block !== null && intersect_plane === evt.target) {

            mouse_position.copy( ev.intersect.point );
            
            //set position
            selected_block.track( track.addVectors( mouse_position, block_offset) );
        }
    };

    return Tracking;
});

/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

define('plugins/plg.Draggable',["plugin", "Draggable", "cmd"], function( Plugin, Draggable, CMD ){
    var PlgDraggable = function(){
        this.super.constructor.call( this );
    };
    
    PlgDraggable.prototype = Object.create( Plugin.prototype );
    PlgDraggable.prototype.constructor = PlgDraggable;
    Draggable.prototype.super = Plugin.prototype;
    
    PlgDraggable.prototype.registerEvents = function()
    {
        CMD.Scene.on("added", function( el ){
            if ( el.userData && el.userData.draggable === true ) {
                Draggable.makeDraggable( el );
            }
        });
    };
    
    return PlgDraggable;
});

/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

define('pack-Interactive',["Draggable", "Interactive", "plugins/plg.Tracking", "plugins/plg.Draggable"], function( Draggable, Interactive, PlgTracking, PlgDraggable ){
    return {
        Draggable       : Draggable,
        Interactive     : Interactive,
        PlgTracking     : PlgTracking,
        PlgDraggable    : PlgDraggable
    };
});
define('vendor/three/loaders/ColladaLoader',["three"], function(THREE){
/**
 * @author mrdoob / http://mrdoob.com/
 * @author Mugen87 / https://github.com/Mugen87
 */

THREE.ColladaLoader = function ( manager ) {

	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

};

THREE.ColladaLoader.prototype = {

	constructor: THREE.ColladaLoader,

	crossOrigin: 'anonymous',

	load: function ( url, onLoad, onProgress, onError ) {

		var scope = this;

		var path = ( scope.path === undefined ) ? THREE.LoaderUtils.extractUrlBase( url ) : scope.path;

		var loader = new THREE.FileLoader( scope.manager );
		loader.setPath( scope.path );
		loader.load( url, function ( text ) {

			onLoad( scope.parse( text, path ) );

		}, onProgress, onError );

	},

	setPath: function ( value ) {

		this.path = value;
		return this;

	},

	setResourcePath: function ( value ) {

		this.resourcePath = value;
		return this;

	},

	options: {

		set convertUpAxis( value ) {

			console.warn( 'THREE.ColladaLoader: options.convertUpAxis() has been removed. Up axis is converted automatically.' );

		}

	},

	setCrossOrigin: function ( value ) {

		this.crossOrigin = value;
		return this;

	},

	parse: function ( text, path ) {

		function getElementsByTagName( xml, name ) {

			// Non recursive xml.getElementsByTagName() ...

			var array = [];
			var childNodes = xml.childNodes;

			for ( var i = 0, l = childNodes.length; i < l; i ++ ) {

				var child = childNodes[ i ];

				if ( child.nodeName === name ) {

					array.push( child );

				}

			}

			return array;

		}

		function parseStrings( text ) {

			if ( text.length === 0 ) return [];

			var parts = text.trim().split( /\s+/ );
			var array = new Array( parts.length );

			for ( var i = 0, l = parts.length; i < l; i ++ ) {

				array[ i ] = parts[ i ];

			}

			return array;

		}

		function parseFloats( text ) {

			if ( text.length === 0 ) return [];

			var parts = text.trim().split( /\s+/ );
			var array = new Array( parts.length );

			for ( var i = 0, l = parts.length; i < l; i ++ ) {

				array[ i ] = parseFloat( parts[ i ] );

			}

			return array;

		}

		function parseInts( text ) {

			if ( text.length === 0 ) return [];

			var parts = text.trim().split( /\s+/ );
			var array = new Array( parts.length );

			for ( var i = 0, l = parts.length; i < l; i ++ ) {

				array[ i ] = parseInt( parts[ i ] );

			}

			return array;

		}

		function parseId( text ) {

			return text.substring( 1 );

		}

		function generateId() {

			return 'three_default_' + ( count ++ );

		}

		function isEmpty( object ) {

			return Object.keys( object ).length === 0;

		}

		// asset

		function parseAsset( xml ) {

			return {
				unit: parseAssetUnit( getElementsByTagName( xml, 'unit' )[ 0 ] ),
				upAxis: parseAssetUpAxis( getElementsByTagName( xml, 'up_axis' )[ 0 ] )
			};

		}

		function parseAssetUnit( xml ) {

			if ( ( xml !== undefined ) && ( xml.hasAttribute( 'meter' ) === true ) ) {

				return parseFloat( xml.getAttribute( 'meter' ) );

			} else {

				return 1; // default 1 meter

			}

		}

		function parseAssetUpAxis( xml ) {

			return xml !== undefined ? xml.textContent : 'Y_UP';

		}

		// library

		function parseLibrary( xml, libraryName, nodeName, parser ) {

			var library = getElementsByTagName( xml, libraryName )[ 0 ];

			if ( library !== undefined ) {

				var elements = getElementsByTagName( library, nodeName );

				for ( var i = 0; i < elements.length; i ++ ) {

					parser( elements[ i ] );

				}

			}

		}

		function buildLibrary( data, builder ) {

			for ( var name in data ) {

				var object = data[ name ];
				object.build = builder( data[ name ] );

			}

		}

		// get

		function getBuild( data, builder ) {

			if ( data.build !== undefined ) return data.build;

			data.build = builder( data );

			return data.build;

		}

		// animation

		function parseAnimation( xml ) {

			var data = {
				sources: {},
				samplers: {},
				channels: {}
			};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				var id;

				switch ( child.nodeName ) {

					case 'source':
						id = child.getAttribute( 'id' );
						data.sources[ id ] = parseSource( child );
						break;

					case 'sampler':
						id = child.getAttribute( 'id' );
						data.samplers[ id ] = parseAnimationSampler( child );
						break;

					case 'channel':
						id = child.getAttribute( 'target' );
						data.channels[ id ] = parseAnimationChannel( child );
						break;

					default:
						console.log( child );

				}

			}

			library.animations[ xml.getAttribute( 'id' ) ] = data;

		}

		function parseAnimationSampler( xml ) {

			var data = {
				inputs: {},
			};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'input':
						var id = parseId( child.getAttribute( 'source' ) );
						var semantic = child.getAttribute( 'semantic' );
						data.inputs[ semantic ] = id;
						break;

				}

			}

			return data;

		}

		function parseAnimationChannel( xml ) {

			var data = {};

			var target = xml.getAttribute( 'target' );

			// parsing SID Addressing Syntax

			var parts = target.split( '/' );

			var id = parts.shift();
			var sid = parts.shift();

			// check selection syntax

			var arraySyntax = ( sid.indexOf( '(' ) !== - 1 );
			var memberSyntax = ( sid.indexOf( '.' ) !== - 1 );

			if ( memberSyntax ) {

				//  member selection access

				parts = sid.split( '.' );
				sid = parts.shift();
				data.member = parts.shift();

			} else if ( arraySyntax ) {

				// array-access syntax. can be used to express fields in one-dimensional vectors or two-dimensional matrices.

				var indices = sid.split( '(' );
				sid = indices.shift();

				for ( var i = 0; i < indices.length; i ++ ) {

					indices[ i ] = parseInt( indices[ i ].replace( /\)/, '' ) );

				}

				data.indices = indices;

			}

			data.id = id;
			data.sid = sid;

			data.arraySyntax = arraySyntax;
			data.memberSyntax = memberSyntax;

			data.sampler = parseId( xml.getAttribute( 'source' ) );

			return data;

		}

		function buildAnimation( data ) {

			var tracks = [];

			var channels = data.channels;
			var samplers = data.samplers;
			var sources = data.sources;

			for ( var target in channels ) {

				if ( channels.hasOwnProperty( target ) ) {

					var channel = channels[ target ];
					var sampler = samplers[ channel.sampler ];

					var inputId = sampler.inputs.INPUT;
					var outputId = sampler.inputs.OUTPUT;

					var inputSource = sources[ inputId ];
					var outputSource = sources[ outputId ];

					var animation = buildAnimationChannel( channel, inputSource, outputSource );

					createKeyframeTracks( animation, tracks );

				}

			}

			return tracks;

		}

		function getAnimation( id ) {

			return getBuild( library.animations[ id ], buildAnimation );

		}

		function buildAnimationChannel( channel, inputSource, outputSource ) {

			var node = library.nodes[ channel.id ];
			var object3D = getNode( node.id );

			var transform = node.transforms[ channel.sid ];
			var defaultMatrix = node.matrix.clone().transpose();

			var time, stride;
			var i, il, j, jl;

			var data = {};

			// the collada spec allows the animation of data in various ways.
			// depending on the transform type (matrix, translate, rotate, scale), we execute different logic

			switch ( transform ) {

				case 'matrix':

					for ( i = 0, il = inputSource.array.length; i < il; i ++ ) {

						time = inputSource.array[ i ];
						stride = i * outputSource.stride;

						if ( data[ time ] === undefined ) data[ time ] = {};

						if ( channel.arraySyntax === true ) {

							var value = outputSource.array[ stride ];
							var index = channel.indices[ 0 ] + 4 * channel.indices[ 1 ];

							data[ time ][ index ] = value;

						} else {

							for ( j = 0, jl = outputSource.stride; j < jl; j ++ ) {

								data[ time ][ j ] = outputSource.array[ stride + j ];

							}

						}

					}

					break;

				case 'translate':
					console.warn( 'THREE.ColladaLoader: Animation transform type "%s" not yet implemented.', transform );
					break;

				case 'rotate':
					console.warn( 'THREE.ColladaLoader: Animation transform type "%s" not yet implemented.', transform );
					break;

				case 'scale':
					console.warn( 'THREE.ColladaLoader: Animation transform type "%s" not yet implemented.', transform );
					break;

			}

			var keyframes = prepareAnimationData( data, defaultMatrix );

			var animation = {
				name: object3D.uuid,
				keyframes: keyframes
			};

			return animation;

		}

		function prepareAnimationData( data, defaultMatrix ) {

			var keyframes = [];

			// transfer data into a sortable array

			for ( var time in data ) {

				keyframes.push( { time: parseFloat( time ), value: data[ time ] } );

			}

			// ensure keyframes are sorted by time

			keyframes.sort( ascending );

			// now we clean up all animation data, so we can use them for keyframe tracks

			for ( var i = 0; i < 16; i ++ ) {

				transformAnimationData( keyframes, i, defaultMatrix.elements[ i ] );

			}

			return keyframes;

			// array sort function

			function ascending( a, b ) {

				return a.time - b.time;

			}

		}

		var position = new THREE.Vector3();
		var scale = new THREE.Vector3();
		var quaternion = new THREE.Quaternion();

		function createKeyframeTracks( animation, tracks ) {

			var keyframes = animation.keyframes;
			var name = animation.name;

			var times = [];
			var positionData = [];
			var quaternionData = [];
			var scaleData = [];

			for ( var i = 0, l = keyframes.length; i < l; i ++ ) {

				var keyframe = keyframes[ i ];

				var time = keyframe.time;
				var value = keyframe.value;

				matrix.fromArray( value ).transpose();
				matrix.decompose( position, quaternion, scale );

				times.push( time );
				positionData.push( position.x, position.y, position.z );
				quaternionData.push( quaternion.x, quaternion.y, quaternion.z, quaternion.w );
				scaleData.push( scale.x, scale.y, scale.z );

			}

			if ( positionData.length > 0 ) tracks.push( new THREE.VectorKeyframeTrack( name + '.position', times, positionData ) );
			if ( quaternionData.length > 0 ) tracks.push( new THREE.QuaternionKeyframeTrack( name + '.quaternion', times, quaternionData ) );
			if ( scaleData.length > 0 ) tracks.push( new THREE.VectorKeyframeTrack( name + '.scale', times, scaleData ) );

			return tracks;

		}

		function transformAnimationData( keyframes, property, defaultValue ) {

			var keyframe;

			var empty = true;
			var i, l;

			// check, if values of a property are missing in our keyframes

			for ( i = 0, l = keyframes.length; i < l; i ++ ) {

				keyframe = keyframes[ i ];

				if ( keyframe.value[ property ] === undefined ) {

					keyframe.value[ property ] = null; // mark as missing

				} else {

					empty = false;

				}

			}

			if ( empty === true ) {

				// no values at all, so we set a default value

				for ( i = 0, l = keyframes.length; i < l; i ++ ) {

					keyframe = keyframes[ i ];

					keyframe.value[ property ] = defaultValue;

				}

			} else {

				// filling gaps

				createMissingKeyframes( keyframes, property );

			}

		}

		function createMissingKeyframes( keyframes, property ) {

			var prev, next;

			for ( var i = 0, l = keyframes.length; i < l; i ++ ) {

				var keyframe = keyframes[ i ];

				if ( keyframe.value[ property ] === null ) {

					prev = getPrev( keyframes, i, property );
					next = getNext( keyframes, i, property );

					if ( prev === null ) {

						keyframe.value[ property ] = next.value[ property ];
						continue;

					}

					if ( next === null ) {

						keyframe.value[ property ] = prev.value[ property ];
						continue;

					}

					interpolate( keyframe, prev, next, property );

				}

			}

		}

		function getPrev( keyframes, i, property ) {

			while ( i >= 0 ) {

				var keyframe = keyframes[ i ];

				if ( keyframe.value[ property ] !== null ) return keyframe;

				i --;

			}

			return null;

		}

		function getNext( keyframes, i, property ) {

			while ( i < keyframes.length ) {

				var keyframe = keyframes[ i ];

				if ( keyframe.value[ property ] !== null ) return keyframe;

				i ++;

			}

			return null;

		}

		function interpolate( key, prev, next, property ) {

			if ( ( next.time - prev.time ) === 0 ) {

				key.value[ property ] = prev.value[ property ];
				return;

			}

			key.value[ property ] = ( ( key.time - prev.time ) * ( next.value[ property ] - prev.value[ property ] ) / ( next.time - prev.time ) ) + prev.value[ property ];

		}

		// animation clips

		function parseAnimationClip( xml ) {

			var data = {
				name: xml.getAttribute( 'id' ) || 'default',
				start: parseFloat( xml.getAttribute( 'start' ) || 0 ),
				end: parseFloat( xml.getAttribute( 'end' ) || 0 ),
				animations: []
			};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'instance_animation':
						data.animations.push( parseId( child.getAttribute( 'url' ) ) );
						break;

				}

			}

			library.clips[ xml.getAttribute( 'id' ) ] = data;

		}

		function buildAnimationClip( data ) {

			var tracks = [];

			var name = data.name;
			var duration = ( data.end - data.start ) || - 1;
			var animations = data.animations;

			for ( var i = 0, il = animations.length; i < il; i ++ ) {

				var animationTracks = getAnimation( animations[ i ] );

				for ( var j = 0, jl = animationTracks.length; j < jl; j ++ ) {

					tracks.push( animationTracks[ j ] );

				}

			}

			return new THREE.AnimationClip( name, duration, tracks );

		}

		function getAnimationClip( id ) {

			return getBuild( library.clips[ id ], buildAnimationClip );

		}

		// controller

		function parseController( xml ) {

			var data = {};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'skin':
						// there is exactly one skin per controller
						data.id = parseId( child.getAttribute( 'source' ) );
						data.skin = parseSkin( child );
						break;

					case 'morph':
						data.id = parseId( child.getAttribute( 'source' ) );
						console.warn( 'THREE.ColladaLoader: Morph target animation not supported yet.' );
						break;

				}

			}

			library.controllers[ xml.getAttribute( 'id' ) ] = data;

		}

		function parseSkin( xml ) {

			var data = {
				sources: {}
			};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'bind_shape_matrix':
						data.bindShapeMatrix = parseFloats( child.textContent );
						break;

					case 'source':
						var id = child.getAttribute( 'id' );
						data.sources[ id ] = parseSource( child );
						break;

					case 'joints':
						data.joints = parseJoints( child );
						break;

					case 'vertex_weights':
						data.vertexWeights = parseVertexWeights( child );
						break;

				}

			}

			return data;

		}

		function parseJoints( xml ) {

			var data = {
				inputs: {}
			};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'input':
						var semantic = child.getAttribute( 'semantic' );
						var id = parseId( child.getAttribute( 'source' ) );
						data.inputs[ semantic ] = id;
						break;

				}

			}

			return data;

		}

		function parseVertexWeights( xml ) {

			var data = {
				inputs: {}
			};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'input':
						var semantic = child.getAttribute( 'semantic' );
						var id = parseId( child.getAttribute( 'source' ) );
						var offset = parseInt( child.getAttribute( 'offset' ) );
						data.inputs[ semantic ] = { id: id, offset: offset };
						break;

					case 'vcount':
						data.vcount = parseInts( child.textContent );
						break;

					case 'v':
						data.v = parseInts( child.textContent );
						break;

				}

			}

			return data;

		}

		function buildController( data ) {

			var build = {
				id: data.id
			};

			var geometry = library.geometries[ build.id ];

			if ( data.skin !== undefined ) {

				build.skin = buildSkin( data.skin );

				// we enhance the 'sources' property of the corresponding geometry with our skin data

				geometry.sources.skinIndices = build.skin.indices;
				geometry.sources.skinWeights = build.skin.weights;

			}

			return build;

		}

		function buildSkin( data ) {

			var BONE_LIMIT = 4;

			var build = {
				joints: [], // this must be an array to preserve the joint order
				indices: {
					array: [],
					stride: BONE_LIMIT
				},
				weights: {
					array: [],
					stride: BONE_LIMIT
				}
			};

			var sources = data.sources;
			var vertexWeights = data.vertexWeights;

			var vcount = vertexWeights.vcount;
			var v = vertexWeights.v;
			var jointOffset = vertexWeights.inputs.JOINT.offset;
			var weightOffset = vertexWeights.inputs.WEIGHT.offset;

			var jointSource = data.sources[ data.joints.inputs.JOINT ];
			var inverseSource = data.sources[ data.joints.inputs.INV_BIND_MATRIX ];

			var weights = sources[ vertexWeights.inputs.WEIGHT.id ].array;
			var stride = 0;

			var i, j, l;

			// procces skin data for each vertex

			for ( i = 0, l = vcount.length; i < l; i ++ ) {

				var jointCount = vcount[ i ]; // this is the amount of joints that affect a single vertex
				var vertexSkinData = [];

				for ( j = 0; j < jointCount; j ++ ) {

					var skinIndex = v[ stride + jointOffset ];
					var weightId = v[ stride + weightOffset ];
					var skinWeight = weights[ weightId ];

					vertexSkinData.push( { index: skinIndex, weight: skinWeight } );

					stride += 2;

				}

				// we sort the joints in descending order based on the weights.
				// this ensures, we only procced the most important joints of the vertex

				vertexSkinData.sort( descending );

				// now we provide for each vertex a set of four index and weight values.
				// the order of the skin data matches the order of vertices

				for ( j = 0; j < BONE_LIMIT; j ++ ) {

					var d = vertexSkinData[ j ];

					if ( d !== undefined ) {

						build.indices.array.push( d.index );
						build.weights.array.push( d.weight );

					} else {

						build.indices.array.push( 0 );
						build.weights.array.push( 0 );

					}

				}

			}

			// setup bind matrix

			if ( data.bindShapeMatrix ) {

				build.bindMatrix = new THREE.Matrix4().fromArray( data.bindShapeMatrix ).transpose();

			} else {

				build.bindMatrix = new THREE.Matrix4().identity();

			}

			// process bones and inverse bind matrix data

			for ( i = 0, l = jointSource.array.length; i < l; i ++ ) {

				var name = jointSource.array[ i ];
				var boneInverse = new THREE.Matrix4().fromArray( inverseSource.array, i * inverseSource.stride ).transpose();

				build.joints.push( { name: name, boneInverse: boneInverse } );

			}

			return build;

			// array sort function

			function descending( a, b ) {

				return b.weight - a.weight;

			}

		}

		function getController( id ) {

			return getBuild( library.controllers[ id ], buildController );

		}

		// image

		function parseImage( xml ) {

			var data = {
				init_from: getElementsByTagName( xml, 'init_from' )[ 0 ].textContent
			};

			library.images[ xml.getAttribute( 'id' ) ] = data;

		}

		function buildImage( data ) {

			if ( data.build !== undefined ) return data.build;

			return data.init_from;

		}

		function getImage( id ) {

			var data = library.images[ id ];

			if ( data !== undefined ) {

				return getBuild( data, buildImage );

			}

			console.warn( 'THREE.ColladaLoader: Couldn\'t find image with ID:', id );

			return null;

		}

		// effect

		function parseEffect( xml ) {

			var data = {};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'profile_COMMON':
						data.profile = parseEffectProfileCOMMON( child );
						break;

				}

			}

			library.effects[ xml.getAttribute( 'id' ) ] = data;

		}

		function parseEffectProfileCOMMON( xml ) {

			var data = {
				surfaces: {},
				samplers: {}
			};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'newparam':
						parseEffectNewparam( child, data );
						break;

					case 'technique':
						data.technique = parseEffectTechnique( child );
						break;

					case 'extra':
						data.extra = parseEffectExtra( child );
						break;

				}

			}

			return data;

		}

		function parseEffectNewparam( xml, data ) {

			var sid = xml.getAttribute( 'sid' );

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'surface':
						data.surfaces[ sid ] = parseEffectSurface( child );
						break;

					case 'sampler2D':
						data.samplers[ sid ] = parseEffectSampler( child );
						break;

				}

			}

		}

		function parseEffectSurface( xml ) {

			var data = {};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'init_from':
						data.init_from = child.textContent;
						break;

				}

			}

			return data;

		}

		function parseEffectSampler( xml ) {

			var data = {};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'source':
						data.source = child.textContent;
						break;

				}

			}

			return data;

		}

		function parseEffectTechnique( xml ) {

			var data = {};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'constant':
					case 'lambert':
					case 'blinn':
					case 'phong':
						data.type = child.nodeName;
						data.parameters = parseEffectParameters( child );
						break;

				}

			}

			return data;

		}

		function parseEffectParameters( xml ) {

			var data = {};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'emission':
					case 'diffuse':
					case 'specular':
					case 'bump':
					case 'ambient':
					case 'shininess':
					case 'transparency':
						data[ child.nodeName ] = parseEffectParameter( child );
						break;
					case 'transparent':
						data[ child.nodeName ] = {
							opaque: child.getAttribute( 'opaque' ),
							data: parseEffectParameter( child )
						};
						break;

				}

			}

			return data;

		}

		function parseEffectParameter( xml ) {

			var data = {};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'color':
						data[ child.nodeName ] = parseFloats( child.textContent );
						break;

					case 'float':
						data[ child.nodeName ] = parseFloat( child.textContent );
						break;

					case 'texture':
						data[ child.nodeName ] = { id: child.getAttribute( 'texture' ), extra: parseEffectParameterTexture( child ) };
						break;

				}

			}

			return data;

		}

		function parseEffectParameterTexture( xml ) {

			var data = {
				technique: {}
			};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'extra':
						parseEffectParameterTextureExtra( child, data );
						break;

				}

			}

			return data;

		}

		function parseEffectParameterTextureExtra( xml, data ) {

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'technique':
						parseEffectParameterTextureExtraTechnique( child, data );
						break;

				}

			}

		}

		function parseEffectParameterTextureExtraTechnique( xml, data ) {

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'repeatU':
					case 'repeatV':
					case 'offsetU':
					case 'offsetV':
						data.technique[ child.nodeName ] = parseFloat( child.textContent );
						break;

					case 'wrapU':
					case 'wrapV':

						// some files have values for wrapU/wrapV which become NaN via parseInt

						if ( child.textContent.toUpperCase() === 'TRUE' ) {

							data.technique[ child.nodeName ] = 1;

						} else if ( child.textContent.toUpperCase() === 'FALSE' ) {

							data.technique[ child.nodeName ] = 0;

						} else {

							data.technique[ child.nodeName ] = parseInt( child.textContent );

						}

						break;

				}

			}

		}

		function parseEffectExtra( xml ) {

			var data = {};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'technique':
						data.technique = parseEffectExtraTechnique( child );
						break;

				}

			}

			return data;

		}

		function parseEffectExtraTechnique( xml ) {

			var data = {};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'double_sided':
						data[ child.nodeName ] = parseInt( child.textContent );
						break;

				}

			}

			return data;

		}

		function buildEffect( data ) {

			return data;

		}

		function getEffect( id ) {

			return getBuild( library.effects[ id ], buildEffect );

		}

		// material

		function parseMaterial( xml ) {

			var data = {
				name: xml.getAttribute( 'name' )
			};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'instance_effect':
						data.url = parseId( child.getAttribute( 'url' ) );
						break;

				}

			}

			library.materials[ xml.getAttribute( 'id' ) ] = data;

		}

		function getTextureLoader( image ) {

			var loader;

			var extension = image.slice( ( image.lastIndexOf( '.' ) - 1 >>> 0 ) + 2 ); // http://www.jstips.co/en/javascript/get-file-extension/
			extension = extension.toLowerCase();

			switch ( extension ) {

				case 'tga':
					loader = tgaLoader;
					break;

				default:
					loader = textureLoader;

			}

			return loader;

		}

		function buildMaterial( data ) {

			var effect = getEffect( data.url );
			var technique = effect.profile.technique;
			var extra = effect.profile.extra;

			var material;

			switch ( technique.type ) {

				case 'phong':
				case 'blinn':
					material = new THREE.MeshPhongMaterial();
					break;

				case 'lambert':
					material = new THREE.MeshLambertMaterial();
					break;

				default:
					material = new THREE.MeshBasicMaterial();
					break;

			}

			material.name = data.name || '';

			function getTexture( textureObject ) {

				var sampler = effect.profile.samplers[ textureObject.id ];
				var image = null;

				// get image

				if ( sampler !== undefined ) {

					var surface = effect.profile.surfaces[ sampler.source ];
					image = getImage( surface.init_from );

				} else {

					console.warn( 'THREE.ColladaLoader: Undefined sampler. Access image directly (see #12530).' );
					image = getImage( textureObject.id );

				}

				// create texture if image is avaiable

				if ( image !== null ) {

					var loader = getTextureLoader( image );

					if ( loader !== undefined ) {

						var texture = loader.load( image );

						var extra = textureObject.extra;

						if ( extra !== undefined && extra.technique !== undefined && isEmpty( extra.technique ) === false ) {

							var technique = extra.technique;

							texture.wrapS = technique.wrapU ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
							texture.wrapT = technique.wrapV ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;

							texture.offset.set( technique.offsetU || 0, technique.offsetV || 0 );
							texture.repeat.set( technique.repeatU || 1, technique.repeatV || 1 );

						} else {

							texture.wrapS = THREE.RepeatWrapping;
							texture.wrapT = THREE.RepeatWrapping;

						}

						return texture;

					} else {

						console.warn( 'THREE.ColladaLoader: Loader for texture %s not found.', image );

						return null;

					}

				} else {

					console.warn( 'THREE.ColladaLoader: Couldn\'t create texture with ID:', textureObject.id );

					return null;

				}

			}

			var parameters = technique.parameters;

			for ( var key in parameters ) {

				var parameter = parameters[ key ];

				switch ( key ) {

					case 'diffuse':
						if ( parameter.color ) material.color.fromArray( parameter.color );
						if ( parameter.texture ) material.map = getTexture( parameter.texture );
						break;
					case 'specular':
						if ( parameter.color && material.specular ) material.specular.fromArray( parameter.color );
						if ( parameter.texture ) material.specularMap = getTexture( parameter.texture );
						break;
					case 'bump':
						if ( parameter.texture ) material.normalMap = getTexture( parameter.texture );
						break;
					case 'ambient':
						if ( parameter.texture ) material.lightMap = getTexture( parameter.texture );
						break;
					case 'shininess':
						if ( parameter.float && material.shininess ) material.shininess = parameter.float;
						break;
					case 'emission':
						if ( parameter.color && material.emissive ) material.emissive.fromArray( parameter.color );
						if ( parameter.texture ) material.emissiveMap = getTexture( parameter.texture );
						break;

				}

			}

			//

			var transparent = parameters[ 'transparent' ];
			var transparency = parameters[ 'transparency' ];

			// <transparency> does not exist but <transparent>

			if ( transparency === undefined && transparent ) {

				transparency = {
					float: 1
				};

			}

			// <transparent> does not exist but <transparency>

			if ( transparent === undefined && transparency ) {

				transparent = {
					opaque: 'A_ONE',
					data: {
						color: [ 1, 1, 1, 1 ]
					} };

			}

			if ( transparent && transparency ) {

				// handle case if a texture exists but no color

				if ( transparent.data.texture ) {

					// we do not set an alpha map (see #13792)

					material.transparent = true;

				} else {

					var color = transparent.data.color;

					switch ( transparent.opaque ) {

						case 'A_ONE':
							material.opacity = color[ 3 ] * transparency.float;
							break;
						case 'RGB_ZERO':
							material.opacity = 1 - ( color[ 0 ] * transparency.float );
							break;
						case 'A_ZERO':
							material.opacity = 1 - ( color[ 3 ] * transparency.float );
							break;
						case 'RGB_ONE':
							material.opacity = color[ 0 ] * transparency.float;
							break;
						default:
							console.warn( 'THREE.ColladaLoader: Invalid opaque type "%s" of transparent tag.', transparent.opaque );

					}

					if ( material.opacity < 1 ) material.transparent = true;

				}

			}

			//

			if ( extra !== undefined && extra.technique !== undefined && extra.technique.double_sided === 1 ) {

				material.side = THREE.DoubleSide;

			}

			return material;

		}

		function getMaterial( id ) {

			return getBuild( library.materials[ id ], buildMaterial );

		}

		// camera

		function parseCamera( xml ) {

			var data = {
				name: xml.getAttribute( 'name' )
			};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'optics':
						data.optics = parseCameraOptics( child );
						break;

				}

			}

			library.cameras[ xml.getAttribute( 'id' ) ] = data;

		}

		function parseCameraOptics( xml ) {

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				switch ( child.nodeName ) {

					case 'technique_common':
						return parseCameraTechnique( child );

				}

			}

			return {};

		}

		function parseCameraTechnique( xml ) {

			var data = {};

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				switch ( child.nodeName ) {

					case 'perspective':
					case 'orthographic':

						data.technique = child.nodeName;
						data.parameters = parseCameraParameters( child );

						break;

				}

			}

			return data;

		}

		function parseCameraParameters( xml ) {

			var data = {};

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				switch ( child.nodeName ) {

					case 'xfov':
					case 'yfov':
					case 'xmag':
					case 'ymag':
					case 'znear':
					case 'zfar':
					case 'aspect_ratio':
						data[ child.nodeName ] = parseFloat( child.textContent );
						break;

				}

			}

			return data;

		}

		function buildCamera( data ) {

			var camera;

			switch ( data.optics.technique ) {

				case 'perspective':
					camera = new THREE.PerspectiveCamera(
						data.optics.parameters.yfov,
						data.optics.parameters.aspect_ratio,
						data.optics.parameters.znear,
						data.optics.parameters.zfar
					);
					break;

				case 'orthographic':
					var ymag = data.optics.parameters.ymag;
					var xmag = data.optics.parameters.xmag;
					var aspectRatio = data.optics.parameters.aspect_ratio;

					xmag = ( xmag === undefined ) ? ( ymag * aspectRatio ) : xmag;
					ymag = ( ymag === undefined ) ? ( xmag / aspectRatio ) : ymag;

					xmag *= 0.5;
					ymag *= 0.5;

					camera = new THREE.OrthographicCamera(
						- xmag, xmag, ymag, - ymag, // left, right, top, bottom
						data.optics.parameters.znear,
						data.optics.parameters.zfar
					);
					break;

				default:
					camera = new THREE.PerspectiveCamera();
					break;

			}

			camera.name = data.name || '';

			return camera;

		}

		function getCamera( id ) {

			var data = library.cameras[ id ];

			if ( data !== undefined ) {

				return getBuild( data, buildCamera );

			}

			console.warn( 'THREE.ColladaLoader: Couldn\'t find camera with ID:', id );

			return null;

		}

		// light

		function parseLight( xml ) {

			var data = {};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'technique_common':
						data = parseLightTechnique( child );
						break;

				}

			}

			library.lights[ xml.getAttribute( 'id' ) ] = data;

		}

		function parseLightTechnique( xml ) {

			var data = {};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'directional':
					case 'point':
					case 'spot':
					case 'ambient':

						data.technique = child.nodeName;
						data.parameters = parseLightParameters( child );

				}

			}

			return data;

		}

		function parseLightParameters( xml ) {

			var data = {};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'color':
						var array = parseFloats( child.textContent );
						data.color = new THREE.Color().fromArray( array );
						break;

					case 'falloff_angle':
						data.falloffAngle = parseFloat( child.textContent );
						break;

					case 'quadratic_attenuation':
						var f = parseFloat( child.textContent );
						data.distance = f ? Math.sqrt( 1 / f ) : 0;
						break;

				}

			}

			return data;

		}

		function buildLight( data ) {

			var light;

			switch ( data.technique ) {

				case 'directional':
					light = new THREE.DirectionalLight();
					break;

				case 'point':
					light = new THREE.PointLight();
					break;

				case 'spot':
					light = new THREE.SpotLight();
					break;

				case 'ambient':
					light = new THREE.AmbientLight();
					break;

			}

			if ( data.parameters.color ) light.color.copy( data.parameters.color );
			if ( data.parameters.distance ) light.distance = data.parameters.distance;

			return light;

		}

		function getLight( id ) {

			var data = library.lights[ id ];

			if ( data !== undefined ) {

				return getBuild( data, buildLight );

			}

			console.warn( 'THREE.ColladaLoader: Couldn\'t find light with ID:', id );

			return null;

		}

		// geometry

		function parseGeometry( xml ) {

			var data = {
				name: xml.getAttribute( 'name' ),
				sources: {},
				vertices: {},
				primitives: []
			};

			var mesh = getElementsByTagName( xml, 'mesh' )[ 0 ];

			// the following tags inside geometry are not supported yet (see https://github.com/mrdoob/three.js/pull/12606): convex_mesh, spline, brep
			if ( mesh === undefined ) return;

			for ( var i = 0; i < mesh.childNodes.length; i ++ ) {

				var child = mesh.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				var id = child.getAttribute( 'id' );

				switch ( child.nodeName ) {

					case 'source':
						data.sources[ id ] = parseSource( child );
						break;

					case 'vertices':
						// data.sources[ id ] = data.sources[ parseId( getElementsByTagName( child, 'input' )[ 0 ].getAttribute( 'source' ) ) ];
						data.vertices = parseGeometryVertices( child );
						break;

					case 'polygons':
						console.warn( 'THREE.ColladaLoader: Unsupported primitive type: ', child.nodeName );
						break;

					case 'lines':
					case 'linestrips':
					case 'polylist':
					case 'triangles':
						data.primitives.push( parseGeometryPrimitive( child ) );
						break;

					default:
						console.log( child );

				}

			}

			library.geometries[ xml.getAttribute( 'id' ) ] = data;

		}

		function parseSource( xml ) {

			var data = {
				array: [],
				stride: 3
			};

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'float_array':
						data.array = parseFloats( child.textContent );
						break;

					case 'Name_array':
						data.array = parseStrings( child.textContent );
						break;

					case 'technique_common':
						var accessor = getElementsByTagName( child, 'accessor' )[ 0 ];

						if ( accessor !== undefined ) {

							data.stride = parseInt( accessor.getAttribute( 'stride' ) );

						}
						break;

				}

			}

			return data;

		}

		function parseGeometryVertices( xml ) {

			var data = {};

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				data[ child.getAttribute( 'semantic' ) ] = parseId( child.getAttribute( 'source' ) );

			}

			return data;

		}

		function parseGeometryPrimitive( xml ) {

			var primitive = {
				type: xml.nodeName,
				material: xml.getAttribute( 'material' ),
				count: parseInt( xml.getAttribute( 'count' ) ),
				inputs: {},
				stride: 0,
				hasUV: false
			};

			for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'input':
						var id = parseId( child.getAttribute( 'source' ) );
						var semantic = child.getAttribute( 'semantic' );
						var offset = parseInt( child.getAttribute( 'offset' ) );
						var set = parseInt( child.getAttribute( 'set' ) );
						var inputname = ( set > 0 ? semantic + set : semantic );
						primitive.inputs[ inputname ] = { id: id, offset: offset };
						primitive.stride = Math.max( primitive.stride, offset + 1 );
						if ( semantic === 'TEXCOORD' ) primitive.hasUV = true;
						break;

					case 'vcount':
						primitive.vcount = parseInts( child.textContent );
						break;

					case 'p':
						primitive.p = parseInts( child.textContent );
						break;

				}

			}

			return primitive;

		}

		function groupPrimitives( primitives ) {

			var build = {};

			for ( var i = 0; i < primitives.length; i ++ ) {

				var primitive = primitives[ i ];

				if ( build[ primitive.type ] === undefined ) build[ primitive.type ] = [];

				build[ primitive.type ].push( primitive );

			}

			return build;

		}

		function checkUVCoordinates( primitives ) {

			var count = 0;

			for ( var i = 0, l = primitives.length; i < l; i ++ ) {

				var primitive = primitives[ i ];

				if ( primitive.hasUV === true ) {

					count ++;

				}

			}

			if ( count > 0 && count < primitives.length ) {

				primitives.uvsNeedsFix = true;

			}

		}

		function buildGeometry( data ) {

			var build = {};

			var sources = data.sources;
			var vertices = data.vertices;
			var primitives = data.primitives;

			if ( primitives.length === 0 ) return {};

			// our goal is to create one buffer geometry for a single type of primitives
			// first, we group all primitives by their type

			var groupedPrimitives = groupPrimitives( primitives );

			for ( var type in groupedPrimitives ) {

				var primitiveType = groupedPrimitives[ type ];

				// second, ensure consistent uv coordinates for each type of primitives (polylist,triangles or lines)

				checkUVCoordinates( primitiveType );

				// third, create a buffer geometry for each type of primitives

				build[ type ] = buildGeometryType( primitiveType, sources, vertices );

			}

			return build;

		}

		function buildGeometryType( primitives, sources, vertices ) {

			var build = {};

			var position = { array: [], stride: 0 };
			var normal = { array: [], stride: 0 };
			var uv = { array: [], stride: 0 };
			var uv2 = { array: [], stride: 0 };
			var color = { array: [], stride: 0 };

			var skinIndex = { array: [], stride: 4 };
			var skinWeight = { array: [], stride: 4 };

			var geometry = new THREE.BufferGeometry();

			var materialKeys = [];

			var start = 0;

			for ( var p = 0; p < primitives.length; p ++ ) {

				var primitive = primitives[ p ];
				var inputs = primitive.inputs;

				// groups

				var count = 0;

				switch ( primitive.type ) {

					case 'lines':
					case 'linestrips':
						count = primitive.count * 2;
						break;

					case 'triangles':
						count = primitive.count * 3;
						break;

					case 'polylist':

						for ( var g = 0; g < primitive.count; g ++ ) {

							var vc = primitive.vcount[ g ];

							switch ( vc ) {

								case 3:
									count += 3; // single triangle
									break;

								case 4:
									count += 6; // quad, subdivided into two triangles
									break;

								default:
									count += ( vc - 2 ) * 3; // polylist with more than four vertices
									break;

							}

						}

						break;

					default:
						console.warn( 'THREE.ColladaLoader: Unknow primitive type:', primitive.type );

				}

				geometry.addGroup( start, count, p );
				start += count;

				// material

				if ( primitive.material ) {

					materialKeys.push( primitive.material );

				}

				// geometry data

				for ( var name in inputs ) {

					var input = inputs[ name ];

					switch ( name )	{

						case 'VERTEX':
							for ( var key in vertices ) {

								var id = vertices[ key ];

								switch ( key ) {

									case 'POSITION':
										var prevLength = position.array.length;
										buildGeometryData( primitive, sources[ id ], input.offset, position.array );
										position.stride = sources[ id ].stride;

										if ( sources.skinWeights && sources.skinIndices ) {

											buildGeometryData( primitive, sources.skinIndices, input.offset, skinIndex.array );
											buildGeometryData( primitive, sources.skinWeights, input.offset, skinWeight.array );

										}

										// see #3803

										if ( primitive.hasUV === false && primitives.uvsNeedsFix === true ) {

											var count = ( position.array.length - prevLength ) / position.stride;

											for ( var i = 0; i < count; i ++ ) {

												// fill missing uv coordinates

												uv.array.push( 0, 0 );

											}

										}
										break;

									case 'NORMAL':
										buildGeometryData( primitive, sources[ id ], input.offset, normal.array );
										normal.stride = sources[ id ].stride;
										break;

									case 'COLOR':
										buildGeometryData( primitive, sources[ id ], input.offset, color.array );
										color.stride = sources[ id ].stride;
										break;

									case 'TEXCOORD':
										buildGeometryData( primitive, sources[ id ], input.offset, uv.array );
										uv.stride = sources[ id ].stride;
										break;

									case 'TEXCOORD1':
										buildGeometryData( primitive, sources[ id ], input.offset, uv2.array );
										uv.stride = sources[ id ].stride;
										break;

									default:
										console.warn( 'THREE.ColladaLoader: Semantic "%s" not handled in geometry build process.', key );

								}

							}
							break;

						case 'NORMAL':
							buildGeometryData( primitive, sources[ input.id ], input.offset, normal.array );
							normal.stride = sources[ input.id ].stride;
							break;

						case 'COLOR':
							buildGeometryData( primitive, sources[ input.id ], input.offset, color.array );
							color.stride = sources[ input.id ].stride;
							break;

						case 'TEXCOORD':
							buildGeometryData( primitive, sources[ input.id ], input.offset, uv.array );
							uv.stride = sources[ input.id ].stride;
							break;

						case 'TEXCOORD1':
							buildGeometryData( primitive, sources[ input.id ], input.offset, uv2.array );
							uv2.stride = sources[ input.id ].stride;
							break;

					}

				}

			}

			// build geometry

			if ( position.array.length > 0 ) geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( position.array, position.stride ) );
			if ( normal.array.length > 0 ) geometry.addAttribute( 'normal', new THREE.Float32BufferAttribute( normal.array, normal.stride ) );
			if ( color.array.length > 0 ) geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( color.array, color.stride ) );
			if ( uv.array.length > 0 ) geometry.addAttribute( 'uv', new THREE.Float32BufferAttribute( uv.array, uv.stride ) );
			if ( uv2.array.length > 0 ) geometry.addAttribute( 'uv2', new THREE.Float32BufferAttribute( uv2.array, uv2.stride ) );

			if ( skinIndex.array.length > 0 ) geometry.addAttribute( 'skinIndex', new THREE.Float32BufferAttribute( skinIndex.array, skinIndex.stride ) );
			if ( skinWeight.array.length > 0 ) geometry.addAttribute( 'skinWeight', new THREE.Float32BufferAttribute( skinWeight.array, skinWeight.stride ) );

			build.data = geometry;
			build.type = primitives[ 0 ].type;
			build.materialKeys = materialKeys;

			return build;

		}

		function buildGeometryData( primitive, source, offset, array ) {

			var indices = primitive.p;
			var stride = primitive.stride;
			var vcount = primitive.vcount;

			function pushVector( i ) {

				var index = indices[ i + offset ] * sourceStride;
				var length = index + sourceStride;

				for ( ; index < length; index ++ ) {

					array.push( sourceArray[ index ] );

				}

			}

			var sourceArray = source.array;
			var sourceStride = source.stride;

			if ( primitive.vcount !== undefined ) {

				var index = 0;

				for ( var i = 0, l = vcount.length; i < l; i ++ ) {

					var count = vcount[ i ];

					if ( count === 4 ) {

						var a = index + stride * 0;
						var b = index + stride * 1;
						var c = index + stride * 2;
						var d = index + stride * 3;

						pushVector( a ); pushVector( b ); pushVector( d );
						pushVector( b ); pushVector( c ); pushVector( d );

					} else if ( count === 3 ) {

						var a = index + stride * 0;
						var b = index + stride * 1;
						var c = index + stride * 2;

						pushVector( a ); pushVector( b ); pushVector( c );

					} else if ( count > 4 ) {

						for ( var k = 1, kl = ( count - 2 ); k <= kl; k ++ ) {

							var a = index + stride * 0;
							var b = index + stride * k;
							var c = index + stride * ( k + 1 );

							pushVector( a ); pushVector( b ); pushVector( c );

						}

					}

					index += stride * count;

				}

			} else {

				for ( var i = 0, l = indices.length; i < l; i += stride ) {

					pushVector( i );

				}

			}

		}

		function getGeometry( id ) {

			return getBuild( library.geometries[ id ], buildGeometry );

		}

		// kinematics

		function parseKinematicsModel( xml ) {

			var data = {
				name: xml.getAttribute( 'name' ) || '',
				joints: {},
				links: []
			};

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'technique_common':
						parseKinematicsTechniqueCommon( child, data );
						break;

				}

			}

			library.kinematicsModels[ xml.getAttribute( 'id' ) ] = data;

		}

		function buildKinematicsModel( data ) {

			if ( data.build !== undefined ) return data.build;

			return data;

		}

		function getKinematicsModel( id ) {

			return getBuild( library.kinematicsModels[ id ], buildKinematicsModel );

		}

		function parseKinematicsTechniqueCommon( xml, data ) {

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'joint':
						data.joints[ child.getAttribute( 'sid' ) ] = parseKinematicsJoint( child );
						break;

					case 'link':
						data.links.push( parseKinematicsLink( child ) );
						break;

				}

			}

		}

		function parseKinematicsJoint( xml ) {

			var data;

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'prismatic':
					case 'revolute':
						data = parseKinematicsJointParameter( child );
						break;

				}

			}

			return data;

		}

		function parseKinematicsJointParameter( xml, data ) {

			var data = {
				sid: xml.getAttribute( 'sid' ),
				name: xml.getAttribute( 'name' ) || '',
				axis: new THREE.Vector3(),
				limits: {
					min: 0,
					max: 0
				},
				type: xml.nodeName,
				static: false,
				zeroPosition: 0,
				middlePosition: 0
			};

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'axis':
						var array = parseFloats( child.textContent );
						data.axis.fromArray( array );
						break;
					case 'limits':
						var max = child.getElementsByTagName( 'max' )[ 0 ];
						var min = child.getElementsByTagName( 'min' )[ 0 ];

						data.limits.max = parseFloat( max.textContent );
						data.limits.min = parseFloat( min.textContent );
						break;

				}

			}

			// if min is equal to or greater than max, consider the joint static

			if ( data.limits.min >= data.limits.max ) {

				data.static = true;

			}

			// calculate middle position

			data.middlePosition = ( data.limits.min + data.limits.max ) / 2.0;

			return data;

		}

		function parseKinematicsLink( xml ) {

			var data = {
				sid: xml.getAttribute( 'sid' ),
				name: xml.getAttribute( 'name' ) || '',
				attachments: [],
				transforms: []
			};

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'attachment_full':
						data.attachments.push( parseKinematicsAttachment( child ) );
						break;

					case 'matrix':
					case 'translate':
					case 'rotate':
						data.transforms.push( parseKinematicsTransform( child ) );
						break;

				}

			}

			return data;

		}

		function parseKinematicsAttachment( xml ) {

			var data = {
				joint: xml.getAttribute( 'joint' ).split( '/' ).pop(),
				transforms: [],
				links: []
			};

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'link':
						data.links.push( parseKinematicsLink( child ) );
						break;

					case 'matrix':
					case 'translate':
					case 'rotate':
						data.transforms.push( parseKinematicsTransform( child ) );
						break;

				}

			}

			return data;

		}

		function parseKinematicsTransform( xml ) {

			var data = {
				type: xml.nodeName
			};

			var array = parseFloats( xml.textContent );

			switch ( data.type ) {

				case 'matrix':
					data.obj = new THREE.Matrix4();
					data.obj.fromArray( array ).transpose();
					break;

				case 'translate':
					data.obj = new THREE.Vector3();
					data.obj.fromArray( array );
					break;

				case 'rotate':
					data.obj = new THREE.Vector3();
					data.obj.fromArray( array );
					data.angle = THREE.Math.degToRad( array[ 3 ] );
					break;

			}

			return data;

		}

		// physics

		function parsePhysicsModel( xml ) {

			var data = {
				name: xml.getAttribute( 'name' ) || '',
				rigidBodies: {}
			};

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'rigid_body':
						data.rigidBodies[ child.getAttribute( 'name' ) ] = {};
						parsePhysicsRigidBody( child, data.rigidBodies[ child.getAttribute( 'name' ) ] );
						break;

				}

			}

			library.physicsModels[ xml.getAttribute( 'id' ) ] = data;

		}

		function parsePhysicsRigidBody( xml, data ) {

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'technique_common':
						parsePhysicsTechniqueCommon( child, data );
						break;

				}

			}

		}

		function parsePhysicsTechniqueCommon( xml, data ) {

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'inertia':
						data.inertia = parseFloats( child.textContent );
						break;

					case 'mass':
						data.mass = parseFloats( child.textContent )[ 0 ];
						break;

				}

			}

		}

		// scene

		function parseKinematicsScene( xml ) {

			var data = {
				bindJointAxis: []
			};

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'bind_joint_axis':
						data.bindJointAxis.push( parseKinematicsBindJointAxis( child ) );
						break;

				}

			}

			library.kinematicsScenes[ parseId( xml.getAttribute( 'url' ) ) ] = data;

		}

		function parseKinematicsBindJointAxis( xml ) {

			var data = {
				target: xml.getAttribute( 'target' ).split( '/' ).pop()
			};

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'axis':
						var param = child.getElementsByTagName( 'param' )[ 0 ];
						data.axis = param.textContent;
						var tmpJointIndex = data.axis.split( 'inst_' ).pop().split( 'axis' )[ 0 ];
						data.jointIndex = tmpJointIndex.substr( 0, tmpJointIndex.length - 1 );
						break;

				}

			}

			return data;

		}

		function buildKinematicsScene( data ) {

			if ( data.build !== undefined ) return data.build;

			return data;

		}

		function getKinematicsScene( id ) {

			return getBuild( library.kinematicsScenes[ id ], buildKinematicsScene );

		}

		function setupKinematics() {

			var kinematicsModelId = Object.keys( library.kinematicsModels )[ 0 ];
			var kinematicsSceneId = Object.keys( library.kinematicsScenes )[ 0 ];
			var visualSceneId = Object.keys( library.visualScenes )[ 0 ];

			if ( kinematicsModelId === undefined || kinematicsSceneId === undefined ) return;

			var kinematicsModel = getKinematicsModel( kinematicsModelId );
			var kinematicsScene = getKinematicsScene( kinematicsSceneId );
			var visualScene = getVisualScene( visualSceneId );

			var bindJointAxis = kinematicsScene.bindJointAxis;
			var jointMap = {};

			for ( var i = 0, l = bindJointAxis.length; i < l; i ++ ) {

				var axis = bindJointAxis[ i ];

				// the result of the following query is an element of type 'translate', 'rotate','scale' or 'matrix'

				var targetElement = collada.querySelector( '[sid="' + axis.target + '"]' );

				if ( targetElement ) {

					// get the parent of the transfrom element

					var parentVisualElement = targetElement.parentElement;

					// connect the joint of the kinematics model with the element in the visual scene

					connect( axis.jointIndex, parentVisualElement );

				}

			}

			function connect( jointIndex, visualElement ) {

				var visualElementName = visualElement.getAttribute( 'name' );
				var joint = kinematicsModel.joints[ jointIndex ];

				visualScene.traverse( function ( object ) {

					if ( object.name === visualElementName ) {

						jointMap[ jointIndex ] = {
							object: object,
							transforms: buildTransformList( visualElement ),
							joint: joint,
							position: joint.zeroPosition
						};

					}

				} );

			}

			var m0 = new THREE.Matrix4();

			kinematics = {

				joints: kinematicsModel && kinematicsModel.joints,

				getJointValue: function ( jointIndex ) {

					var jointData = jointMap[ jointIndex ];

					if ( jointData ) {

						return jointData.position;

					} else {

						console.warn( 'THREE.ColladaLoader: Joint ' + jointIndex + ' doesn\'t exist.' );

					}

				},

				setJointValue: function ( jointIndex, value ) {

					var jointData = jointMap[ jointIndex ];

					if ( jointData ) {

						var joint = jointData.joint;

						if ( value > joint.limits.max || value < joint.limits.min ) {

							console.warn( 'THREE.ColladaLoader: Joint ' + jointIndex + ' value ' + value + ' outside of limits (min: ' + joint.limits.min + ', max: ' + joint.limits.max + ').' );

						} else if ( joint.static ) {

							console.warn( 'THREE.ColladaLoader: Joint ' + jointIndex + ' is static.' );

						} else {

							var object = jointData.object;
							var axis = joint.axis;
							var transforms = jointData.transforms;

							matrix.identity();

							// each update, we have to apply all transforms in the correct order

							for ( var i = 0; i < transforms.length; i ++ ) {

								var transform = transforms[ i ];

								// if there is a connection of the transform node with a joint, apply the joint value

								if ( transform.sid && transform.sid.indexOf( jointIndex ) !== - 1 ) {

									switch ( joint.type ) {

										case 'revolute':
											matrix.multiply( m0.makeRotationAxis( axis, THREE.Math.degToRad( value ) ) );
											break;

										case 'prismatic':
											matrix.multiply( m0.makeTranslation( axis.x * value, axis.y * value, axis.z * value ) );
											break;

										default:
											console.warn( 'THREE.ColladaLoader: Unknown joint type: ' + joint.type );
											break;

									}

								} else {

									switch ( transform.type ) {

										case 'matrix':
											matrix.multiply( transform.obj );
											break;

										case 'translate':
											matrix.multiply( m0.makeTranslation( transform.obj.x, transform.obj.y, transform.obj.z ) );
											break;

										case 'scale':
											matrix.scale( transform.obj );
											break;

										case 'rotate':
											matrix.multiply( m0.makeRotationAxis( transform.obj, transform.angle ) );
											break;

									}

								}

							}

							object.matrix.copy( matrix );
							object.matrix.decompose( object.position, object.quaternion, object.scale );

							jointMap[ jointIndex ].position = value;

						}

					} else {

						console.log( 'THREE.ColladaLoader: ' + jointIndex + ' does not exist.' );

					}

				}

			};

		}

		function buildTransformList( node ) {

			var transforms = [];

			var xml = collada.querySelector( '[id="' + node.id + '"]' );

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'matrix':
						var array = parseFloats( child.textContent );
						var matrix = new THREE.Matrix4().fromArray( array ).transpose();
						transforms.push( {
							sid: child.getAttribute( 'sid' ),
							type: child.nodeName,
							obj: matrix
						} );
						break;

					case 'translate':
					case 'scale':
						var array = parseFloats( child.textContent );
						var vector = new THREE.Vector3().fromArray( array );
						transforms.push( {
							sid: child.getAttribute( 'sid' ),
							type: child.nodeName,
							obj: vector
						} );
						break;

					case 'rotate':
						var array = parseFloats( child.textContent );
						var vector = new THREE.Vector3().fromArray( array );
						var angle = THREE.Math.degToRad( array[ 3 ] );
						transforms.push( {
							sid: child.getAttribute( 'sid' ),
							type: child.nodeName,
							obj: vector,
							angle: angle
						} );
						break;

				}

			}

			return transforms;

		}

		// nodes

		function prepareNodes( xml ) {

			var elements = xml.getElementsByTagName( 'node' );

			// ensure all node elements have id attributes

			for ( var i = 0; i < elements.length; i ++ ) {

				var element = elements[ i ];

				if ( element.hasAttribute( 'id' ) === false ) {

					element.setAttribute( 'id', generateId() );

				}

			}

		}

		var matrix = new THREE.Matrix4();
		var vector = new THREE.Vector3();

		function parseNode( xml ) {

			var data = {
				name: xml.getAttribute( 'name' ) || '',
				type: xml.getAttribute( 'type' ),
				id: xml.getAttribute( 'id' ),
				sid: xml.getAttribute( 'sid' ),
				matrix: new THREE.Matrix4(),
				nodes: [],
				instanceCameras: [],
				instanceControllers: [],
				instanceLights: [],
				instanceGeometries: [],
				instanceNodes: [],
				transforms: {}
			};

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				if ( child.nodeType !== 1 ) continue;

				switch ( child.nodeName ) {

					case 'node':
						data.nodes.push( child.getAttribute( 'id' ) );
						parseNode( child );
						break;

					case 'instance_camera':
						data.instanceCameras.push( parseId( child.getAttribute( 'url' ) ) );
						break;

					case 'instance_controller':
						data.instanceControllers.push( parseNodeInstance( child ) );
						break;

					case 'instance_light':
						data.instanceLights.push( parseId( child.getAttribute( 'url' ) ) );
						break;

					case 'instance_geometry':
						data.instanceGeometries.push( parseNodeInstance( child ) );
						break;

					case 'instance_node':
						data.instanceNodes.push( parseId( child.getAttribute( 'url' ) ) );
						break;

					case 'matrix':
						var array = parseFloats( child.textContent );
						data.matrix.multiply( matrix.fromArray( array ).transpose() );
						data.transforms[ child.getAttribute( 'sid' ) ] = child.nodeName;
						break;

					case 'translate':
						var array = parseFloats( child.textContent );
						vector.fromArray( array );
						data.matrix.multiply( matrix.makeTranslation( vector.x, vector.y, vector.z ) );
						data.transforms[ child.getAttribute( 'sid' ) ] = child.nodeName;
						break;

					case 'rotate':
						var array = parseFloats( child.textContent );
						var angle = THREE.Math.degToRad( array[ 3 ] );
						data.matrix.multiply( matrix.makeRotationAxis( vector.fromArray( array ), angle ) );
						data.transforms[ child.getAttribute( 'sid' ) ] = child.nodeName;
						break;

					case 'scale':
						var array = parseFloats( child.textContent );
						data.matrix.scale( vector.fromArray( array ) );
						data.transforms[ child.getAttribute( 'sid' ) ] = child.nodeName;
						break;

					case 'extra':
						break;

					default:
						console.log( child );

				}

			}

			if ( hasNode( data.id ) ) {

				console.warn( 'THREE.ColladaLoader: There is already a node with ID %s. Exclude current node from further processing.', data.id );

			} else {

				library.nodes[ data.id ] = data;

			}

			return data;

		}

		function parseNodeInstance( xml ) {

			var data = {
				id: parseId( xml.getAttribute( 'url' ) ),
				materials: {},
				skeletons: []
			};

			for ( var i = 0; i < xml.childNodes.length; i ++ ) {

				var child = xml.childNodes[ i ];

				switch ( child.nodeName ) {

					case 'bind_material':
						var instances = child.getElementsByTagName( 'instance_material' );

						for ( var j = 0; j < instances.length; j ++ ) {

							var instance = instances[ j ];
							var symbol = instance.getAttribute( 'symbol' );
							var target = instance.getAttribute( 'target' );

							data.materials[ symbol ] = parseId( target );

						}

						break;

					case 'skeleton':
						data.skeletons.push( parseId( child.textContent ) );
						break;

					default:
						break;

				}

			}

			return data;

		}

		function buildSkeleton( skeletons, joints ) {

			var boneData = [];
			var sortedBoneData = [];

			var i, j, data;

			// a skeleton can have multiple root bones. collada expresses this
			// situtation with multiple "skeleton" tags per controller instance

			for ( i = 0; i < skeletons.length; i ++ ) {

				var skeleton = skeletons[ i ];

				var root;

				if ( hasNode( skeleton ) ) {

					root = getNode( skeleton );
					buildBoneHierarchy( root, joints, boneData );

				} else if ( hasVisualScene( skeleton ) ) {

					// handle case where the skeleton refers to the visual scene (#13335)

					var visualScene = library.visualScenes[ skeleton ];
					var children = visualScene.children;

					for ( var j = 0; j < children.length; j ++ ) {

						var child = children[ j ];

						if ( child.type === 'JOINT' ) {

							var root = getNode( child.id );
							buildBoneHierarchy( root, joints, boneData );

						}

					}

				} else {

					console.error( 'THREE.ColladaLoader: Unable to find root bone of skeleton with ID:', skeleton );

				}

			}

			// sort bone data (the order is defined in the corresponding controller)

			for ( i = 0; i < joints.length; i ++ ) {

				for ( j = 0; j < boneData.length; j ++ ) {

					data = boneData[ j ];

					if ( data.bone.name === joints[ i ].name ) {

						sortedBoneData[ i ] = data;
						data.processed = true;
						break;

					}

				}

			}

			// add unprocessed bone data at the end of the list

			for ( i = 0; i < boneData.length; i ++ ) {

				data = boneData[ i ];

				if ( data.processed === false ) {

					sortedBoneData.push( data );
					data.processed = true;

				}

			}

			// setup arrays for skeleton creation

			var bones = [];
			var boneInverses = [];

			for ( i = 0; i < sortedBoneData.length; i ++ ) {

				data = sortedBoneData[ i ];

				bones.push( data.bone );
				boneInverses.push( data.boneInverse );

			}

			return new THREE.Skeleton( bones, boneInverses );

		}

		function buildBoneHierarchy( root, joints, boneData ) {

			// setup bone data from visual scene

			root.traverse( function ( object ) {

				if ( object.isBone === true ) {

					var boneInverse;

					// retrieve the boneInverse from the controller data

					for ( var i = 0; i < joints.length; i ++ ) {

						var joint = joints[ i ];

						if ( joint.name === object.name ) {

							boneInverse = joint.boneInverse;
							break;

						}

					}

					if ( boneInverse === undefined ) {

						// Unfortunately, there can be joints in the visual scene that are not part of the
						// corresponding controller. In this case, we have to create a dummy boneInverse matrix
						// for the respective bone. This bone won't affect any vertices, because there are no skin indices
						// and weights defined for it. But we still have to add the bone to the sorted bone list in order to
						// ensure a correct animation of the model.

						boneInverse = new THREE.Matrix4();

					}

					boneData.push( { bone: object, boneInverse: boneInverse, processed: false } );

				}

			} );

		}

		function buildNode( data ) {

			var objects = [];

			var matrix = data.matrix;
			var nodes = data.nodes;
			var type = data.type;
			var instanceCameras = data.instanceCameras;
			var instanceControllers = data.instanceControllers;
			var instanceLights = data.instanceLights;
			var instanceGeometries = data.instanceGeometries;
			var instanceNodes = data.instanceNodes;

			// nodes

			for ( var i = 0, l = nodes.length; i < l; i ++ ) {

				objects.push( getNode( nodes[ i ] ) );

			}

			// instance cameras

			for ( var i = 0, l = instanceCameras.length; i < l; i ++ ) {

				var instanceCamera = getCamera( instanceCameras[ i ] );

				if ( instanceCamera !== null ) {

					objects.push( instanceCamera.clone() );

				}

			}

			// instance controllers

			for ( var i = 0, l = instanceControllers.length; i < l; i ++ ) {

				var instance = instanceControllers[ i ];
				var controller = getController( instance.id );
				var geometries = getGeometry( controller.id );
				var newObjects = buildObjects( geometries, instance.materials );

				var skeletons = instance.skeletons;
				var joints = controller.skin.joints;

				var skeleton = buildSkeleton( skeletons, joints );

				for ( var j = 0, jl = newObjects.length; j < jl; j ++ ) {

					var object = newObjects[ j ];

					if ( object.isSkinnedMesh ) {

						object.bind( skeleton, controller.skin.bindMatrix );
						object.normalizeSkinWeights();

					}

					objects.push( object );

				}

			}

			// instance lights

			for ( var i = 0, l = instanceLights.length; i < l; i ++ ) {

				var instanceLight = getLight( instanceLights[ i ] );

				if ( instanceLight !== null ) {

					objects.push( instanceLight.clone() );

				}

			}

			// instance geometries

			for ( var i = 0, l = instanceGeometries.length; i < l; i ++ ) {

				var instance = instanceGeometries[ i ];

				// a single geometry instance in collada can lead to multiple object3Ds.
				// this is the case when primitives are combined like triangles and lines

				var geometries = getGeometry( instance.id );
				var newObjects = buildObjects( geometries, instance.materials );

				for ( var j = 0, jl = newObjects.length; j < jl; j ++ ) {

					objects.push( newObjects[ j ] );

				}

			}

			// instance nodes

			for ( var i = 0, l = instanceNodes.length; i < l; i ++ ) {

				objects.push( getNode( instanceNodes[ i ] ).clone() );

			}

			var object;

			if ( nodes.length === 0 && objects.length === 1 ) {

				object = objects[ 0 ];

			} else {

				object = ( type === 'JOINT' ) ? new THREE.Bone() : new THREE.Group();

				for ( var i = 0; i < objects.length; i ++ ) {

					object.add( objects[ i ] );

				}

			}

			if ( object.name === '' ) {

				object.name = ( type === 'JOINT' ) ? data.sid : data.name;

			}

			object.matrix.copy( matrix );
			object.matrix.decompose( object.position, object.quaternion, object.scale );

			return object;

		}

		var fallbackMaterial = new THREE.MeshBasicMaterial( { color: 0xff00ff } );

		function resolveMaterialBinding( keys, instanceMaterials ) {

			var materials = [];

			for ( var i = 0, l = keys.length; i < l; i ++ ) {

				var id = instanceMaterials[ keys[ i ] ];

				if ( id === undefined ) {

					console.warn( 'THREE.ColladaLoader: Material with key %s not found. Apply fallback material.', keys[ i ] );
					materials.push( fallbackMaterial );

				} else {

					materials.push( getMaterial( id ) );

				}

			}

			return materials;

		}

		function buildObjects( geometries, instanceMaterials ) {

			var objects = [];

			for ( var type in geometries ) {

				var geometry = geometries[ type ];

				var materials = resolveMaterialBinding( geometry.materialKeys, instanceMaterials );

				// handle case if no materials are defined

				if ( materials.length === 0 ) {

					if ( type === 'lines' || type === 'linestrips' ) {

						materials.push( new THREE.LineBasicMaterial() );

					} else {

						materials.push( new THREE.MeshPhongMaterial() );

					}

				}

				// regard skinning

				var skinning = ( geometry.data.attributes.skinIndex !== undefined );

				if ( skinning ) {

					for ( var i = 0, l = materials.length; i < l; i ++ ) {

						materials[ i ].skinning = true;

					}

				}

				// choose between a single or multi materials (material array)

				var material = ( materials.length === 1 ) ? materials[ 0 ] : materials;

				// now create a specific 3D object

				var object;

				switch ( type ) {

					case 'lines':
						object = new THREE.LineSegments( geometry.data, material );
						break;

					case 'linestrips':
						object = new THREE.Line( geometry.data, material );
						break;

					case 'triangles':
					case 'polylist':
						if ( skinning ) {

							object = new THREE.SkinnedMesh( geometry.data, material );

						} else {

							object = new THREE.Mesh( geometry.data, material );

						}
						break;

				}

				objects.push( object );

			}

			return objects;

		}

		function hasNode( id ) {

			return library.nodes[ id ] !== undefined;

		}

		function getNode( id ) {

			return getBuild( library.nodes[ id ], buildNode );

		}

		// visual scenes

		function parseVisualScene( xml ) {

			var data = {
				name: xml.getAttribute( 'name' ),
				children: []
			};

			prepareNodes( xml );

			var elements = getElementsByTagName( xml, 'node' );

			for ( var i = 0; i < elements.length; i ++ ) {

				data.children.push( parseNode( elements[ i ] ) );

			}

			library.visualScenes[ xml.getAttribute( 'id' ) ] = data;

		}

		function buildVisualScene( data ) {

			var group = new THREE.Group();
			group.name = data.name;

			var children = data.children;

			for ( var i = 0; i < children.length; i ++ ) {

				var child = children[ i ];

				group.add( getNode( child.id ) );

			}

			return group;

		}

		function hasVisualScene( id ) {

			return library.visualScenes[ id ] !== undefined;

		}

		function getVisualScene( id ) {

			return getBuild( library.visualScenes[ id ], buildVisualScene );

		}

		// scenes

		function parseScene( xml ) {

			var instance = getElementsByTagName( xml, 'instance_visual_scene' )[ 0 ];
			return getVisualScene( parseId( instance.getAttribute( 'url' ) ) );

		}

		function setupAnimations() {

			var clips = library.clips;

			if ( isEmpty( clips ) === true ) {

				if ( isEmpty( library.animations ) === false ) {

					// if there are animations but no clips, we create a default clip for playback

					var tracks = [];

					for ( var id in library.animations ) {

						var animationTracks = getAnimation( id );

						for ( var i = 0, l = animationTracks.length; i < l; i ++ ) {

							tracks.push( animationTracks[ i ] );

						}

					}

					animations.push( new THREE.AnimationClip( 'default', - 1, tracks ) );

				}

			} else {

				for ( var id in clips ) {

					animations.push( getAnimationClip( id ) );

				}

			}

		}

		if ( text.length === 0 ) {

			return { scene: new THREE.Scene() };

		}

		var xml = new DOMParser().parseFromString( text, 'application/xml' );

		var collada = getElementsByTagName( xml, 'COLLADA' )[ 0 ];

		// metadata

		var version = collada.getAttribute( 'version' );
		console.log( 'THREE.ColladaLoader: File version', version );

		var asset = parseAsset( getElementsByTagName( collada, 'asset' )[ 0 ] );
		var textureLoader = new THREE.TextureLoader( this.manager );
		textureLoader.setPath( this.resourcePath || path ).setCrossOrigin( this.crossOrigin );

		var tgaLoader;

		if ( THREE.TGALoader ) {

			tgaLoader = new THREE.TGALoader( this.manager );
			tgaLoader.setPath( this.resourcePath || path );

		}

		//

		var animations = [];
		var kinematics = {};
		var count = 0;

		//

		var library = {
			animations: {},
			clips: {},
			controllers: {},
			images: {},
			effects: {},
			materials: {},
			cameras: {},
			lights: {},
			geometries: {},
			nodes: {},
			visualScenes: {},
			kinematicsModels: {},
			physicsModels: {},
			kinematicsScenes: {}
		};

		parseLibrary( collada, 'library_animations', 'animation', parseAnimation );
		parseLibrary( collada, 'library_animation_clips', 'animation_clip', parseAnimationClip );
		parseLibrary( collada, 'library_controllers', 'controller', parseController );
		parseLibrary( collada, 'library_images', 'image', parseImage );
		parseLibrary( collada, 'library_effects', 'effect', parseEffect );
		parseLibrary( collada, 'library_materials', 'material', parseMaterial );
		parseLibrary( collada, 'library_cameras', 'camera', parseCamera );
		parseLibrary( collada, 'library_lights', 'light', parseLight );
		parseLibrary( collada, 'library_geometries', 'geometry', parseGeometry );
		parseLibrary( collada, 'library_nodes', 'node', parseNode );
		parseLibrary( collada, 'library_visual_scenes', 'visual_scene', parseVisualScene );
		parseLibrary( collada, 'library_kinematics_models', 'kinematics_model', parseKinematicsModel );
		parseLibrary( collada, 'library_physics_models', 'physics_model', parsePhysicsModel );
		parseLibrary( collada, 'scene', 'instance_kinematics_scene', parseKinematicsScene );

		buildLibrary( library.animations, buildAnimation );
		buildLibrary( library.clips, buildAnimationClip );
		buildLibrary( library.controllers, buildController );
		buildLibrary( library.images, buildImage );
		buildLibrary( library.effects, buildEffect );
		buildLibrary( library.materials, buildMaterial );
		buildLibrary( library.cameras, buildCamera );
		buildLibrary( library.lights, buildLight );
		buildLibrary( library.geometries, buildGeometry );
		buildLibrary( library.visualScenes, buildVisualScene );

		setupAnimations();
		setupKinematics();

		var scene = parseScene( getElementsByTagName( collada, 'scene' )[ 0 ] );

		if ( asset.upAxis === 'Z_UP' ) {

			scene.quaternion.setFromEuler( new THREE.Euler( - Math.PI / 2, 0, 0 ) );

		}

		scene.scale.multiplyScalar( asset.unit );

		return {
			animations: animations,
			kinematics: kinematics,
			library: library,
			scene: scene
		};

	}

};

 return THREE.ColladaLoader;
});
/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define('ColladaLoader',["three", "vendor/three/loaders/ColladaLoader", "lodash"], function( THREE, ThreeColladaLoader, _ ){
    var ColladaLoader = function ()
    {
        ThreeColladaLoader.call( this );
    };

    ColladaLoader.prototype = _.create( ThreeColladaLoader.prototype, {
        constructor : ColladaLoader,
        
        load : function(url, onLoad, onProgress, onError)
        {
            var scope = this;
            var path = scope.path === undefined ? THREE.LoaderUtils.extractUrlBase( url ) : scope.path;
            
            onLoad = onLoad || function(){};
            
            if( url === null || url === undefined || url === "" ) {
                onLoad( null );
            };

            require(["text!" + url], function ( responseText ) {
                
                var fnc = onLoad || function(){};
                fnc ( scope.parse( responseText, path ) );
                
            }, onError);
        }
        
    });

    return ColladaLoader;
});


define('LoaderSupport',["three"], function(THREE){
/**
  * @author Kai Salmen / https://kaisalmen.de
  * Development repository: https://github.com/kaisalmen/WWOBJLoader
  */



if ( THREE.LoaderSupport === undefined ) { THREE.LoaderSupport = {} }

/**
 * Validation functions.
 * @class
 */
THREE.LoaderSupport.Validator = {
	/**
	 * If given input is null or undefined, false is returned otherwise true.
	 *
	 * @param input Can be anything
	 * @returns {boolean}
	 */
	isValid: function( input ) {
		return ( input !== null && input !== undefined );
	},
	/**
	 * If given input is null or undefined, the defaultValue is returned otherwise the given input.
	 *
	 * @param input Can be anything
	 * @param defaultValue Can be anything
	 * @returns {*}
	 */
	verifyInput: function( input, defaultValue ) {
		return ( input === null || input === undefined ) ? defaultValue : input;
	}
};


/**
 * Callbacks utilized by loaders and builders.
 * @class
 */
THREE.LoaderSupport.Callbacks = function () {
	this.onProgress = null;
	this.onReportError = null;
	this.onMeshAlter = null;
	this.onLoad = null;
	this.onLoadMaterials = null;
};

THREE.LoaderSupport.Callbacks.prototype = {

	constructor: THREE.LoaderSupport.Callbacks,

	/**
	 * Register callback function that is invoked by internal function "announceProgress" to print feedback.
	 *
	 * @param {callback} callbackOnProgress Callback function for described functionality
	 */
	setCallbackOnProgress: function ( callbackOnProgress ) {
		this.onProgress = THREE.LoaderSupport.Validator.verifyInput( callbackOnProgress, this.onProgress );
	},

	/**
	 * Register callback function that is invoked when an error is reported.
	 *
	 * @param {callback} callbackOnReportError Callback function for described functionality
	 */
	setCallbackOnReportError: function ( callbackOnReportError ) {
		this.onReportError = THREE.LoaderSupport.Validator.verifyInput( callbackOnReportError, this.onReportError );
	},

	/**
	 * Register callback function that is called every time a mesh was loaded.
	 * Use {@link THREE.LoaderSupport.LoadedMeshUserOverride} for alteration instructions (geometry, material or disregard mesh).
	 *
	 * @param {callback} callbackOnMeshAlter Callback function for described functionality
	 */
	setCallbackOnMeshAlter: function ( callbackOnMeshAlter ) {
		this.onMeshAlter = THREE.LoaderSupport.Validator.verifyInput( callbackOnMeshAlter, this.onMeshAlter );
	},

	/**
	 * Register callback function that is called once loading of the complete OBJ file is completed.
	 *
	 * @param {callback} callbackOnLoad Callback function for described functionality
	 */
	setCallbackOnLoad: function ( callbackOnLoad ) {
		this.onLoad = THREE.LoaderSupport.Validator.verifyInput( callbackOnLoad, this.onLoad );
	},

	/**
	 * Register callback function that is called when materials have been loaded.
	 *
	 * @param {callback} callbackOnLoadMaterials Callback function for described functionality
	 */
	setCallbackOnLoadMaterials: function ( callbackOnLoadMaterials ) {
		this.onLoadMaterials = THREE.LoaderSupport.Validator.verifyInput( callbackOnLoadMaterials, this.onLoadMaterials );
	}

};


/**
 * Object to return by callback onMeshAlter. Used to disregard a certain mesh or to return one to many meshes.
 * @class
 *
 * @param {boolean} disregardMesh=false Tell implementation to completely disregard this mesh
 * @param {boolean} disregardMesh=false Tell implementation that mesh(es) have been altered or added
 */
THREE.LoaderSupport.LoadedMeshUserOverride = function( disregardMesh, alteredMesh ) {
	this.disregardMesh = disregardMesh === true;
	this.alteredMesh = alteredMesh === true;
	this.meshes = [];
};

THREE.LoaderSupport.LoadedMeshUserOverride.prototype = {

	constructor: THREE.LoaderSupport.LoadedMeshUserOverride,

	/**
	 * Add a mesh created within callback.
	 *
	 * @param {THREE.Mesh} mesh
	 */
	addMesh: function ( mesh ) {
		this.meshes.push( mesh );
		this.alteredMesh = true;
	},

	/**
	 * Answers if mesh shall be disregarded completely.
	 *
	 * @returns {boolean}
	 */
	isDisregardMesh: function () {
		return this.disregardMesh;
	},

	/**
	 * Answers if new mesh(es) were created.
	 *
	 * @returns {boolean}
	 */
	providesAlteredMeshes: function () {
		return this.alteredMesh;
	}

};


/**
 * A resource description used by {@link THREE.LoaderSupport.PrepData} and others.
 * @class
 *
 * @param {string} url URL to the file
 * @param {string} extension The file extension (type)
 */
THREE.LoaderSupport.ResourceDescriptor = function ( url, extension ) {
	var urlParts = url.split( '/' );

	this.path;
	this.resourcePath;
	this.name = url;
	this.url = url;
	if ( urlParts.length >= 2 ) {

		this.path = THREE.LoaderSupport.Validator.verifyInput( urlParts.slice( 0, urlParts.length - 1).join( '/' ) + '/', this.path );
		this.name = urlParts[ urlParts.length - 1 ];
		this.url = url;

	}
	this.name = THREE.LoaderSupport.Validator.verifyInput( this.name, 'Unnamed_Resource' );
	this.extension = THREE.LoaderSupport.Validator.verifyInput( extension, 'default' );
	this.extension = this.extension.trim();
	this.content = null;
};

THREE.LoaderSupport.ResourceDescriptor.prototype = {

	constructor: THREE.LoaderSupport.ResourceDescriptor,

	/**
	 * Set the content of this resource
	 *
	 * @param {Object} content The file content as arraybuffer or text
	 */
	setContent: function ( content ) {
		this.content = THREE.LoaderSupport.Validator.verifyInput( content, null );
	},

	/**
	 * Allows to specify resourcePath for dependencies of specified resource.
	 * @param {string} resourcePath
	 */
	setResourcePath: function ( resourcePath ) {
		this.resourcePath = THREE.LoaderSupport.Validator.verifyInput( resourcePath, this.resourcePath );
	}
};


/**
 * Configuration instructions to be used by run method.
 * @class
 */
THREE.LoaderSupport.PrepData = function ( modelName ) {
	this.logging = {
		enabled: true,
		debug: false
	};
	this.modelName = THREE.LoaderSupport.Validator.verifyInput( modelName, '' );
	this.resources = [];
	this.callbacks = new THREE.LoaderSupport.Callbacks();
};

THREE.LoaderSupport.PrepData.prototype = {

	constructor: THREE.LoaderSupport.PrepData,

	/**
	 * Enable or disable logging in general (except warn and error), plus enable or disable debug logging.
	 *
	 * @param {boolean} enabled True or false.
	 * @param {boolean} debug True or false.
	 */
	setLogging: function ( enabled, debug ) {
		this.logging.enabled = enabled === true;
		this.logging.debug = debug === true;
	},

	/**
	 * Returns all callbacks as {@link THREE.LoaderSupport.Callbacks}
	 *
	 * @returns {THREE.LoaderSupport.Callbacks}
	 */
	getCallbacks: function () {
		return this.callbacks;
	},

	/**
	 * Add a resource description.
	 *
	 * @param {THREE.LoaderSupport.ResourceDescriptor} Adds a {@link THREE.LoaderSupport.ResourceDescriptor}
	 */
	addResource: function ( resource ) {
		this.resources.push( resource );
	},

	/**
	 * Clones this object and returns it afterwards. Callbacks and resources are not cloned deep (references!).
	 *
	 * @returns {@link THREE.LoaderSupport.PrepData}
	 */
	clone: function () {
		var clone = new THREE.LoaderSupport.PrepData( this.modelName );
		clone.logging.enabled = this.logging.enabled;
		clone.logging.debug = this.logging.debug;
		clone.resources = this.resources;
		clone.callbacks = this.callbacks;

		var property, value;
		for ( property in this ) {

			value = this[ property ];
			if ( ! clone.hasOwnProperty( property ) && typeof this[ property ] !== 'function' ) {

				clone[ property ] = value;

			}
		}

		return clone;
	},

	/**
	 * Identify files or content of interest from an Array of {@link THREE.LoaderSupport.ResourceDescriptor}.
	 *
	 * @param {THREE.LoaderSupport.ResourceDescriptor[]} resources Array of {@link THREE.LoaderSupport.ResourceDescriptor}
	 * @param Object fileDesc Object describing which resources are of interest (ext, type (string or UInt8Array) and ignore (boolean))
	 * @returns {{}} Object with each "ext" and the corresponding {@link THREE.LoaderSupport.ResourceDescriptor}
	 */
	checkResourceDescriptorFiles: function ( resources, fileDesc ) {
		var resource, triple, i, found;
		var result = {};

		for ( var index in resources ) {

			resource = resources[ index ];
			found = false;
			if ( ! THREE.LoaderSupport.Validator.isValid( resource.name ) ) continue;
			if ( THREE.LoaderSupport.Validator.isValid( resource.content ) ) {

				for ( i = 0; i < fileDesc.length && !found; i++ ) {

					triple = fileDesc[ i ];
					if ( resource.extension.toLowerCase() === triple.ext.toLowerCase() ) {

						if ( triple.ignore ) {

							found = true;

						} else if ( triple.type === "ArrayBuffer" ) {

							// fast-fail on bad type
							if ( ! ( resource.content instanceof ArrayBuffer || resource.content instanceof Uint8Array ) ) throw 'Provided content is not of type ArrayBuffer! Aborting...';
							result[ triple.ext ] = resource;
							found = true;

						} else if ( triple.type === "String" ) {

							if ( ! ( typeof( resource.content ) === 'string' || resource.content instanceof String) ) throw 'Provided  content is not of type String! Aborting...';
							result[ triple.ext ] = resource;
							found = true;

						}

					}

				}
				if ( !found ) throw 'Unidentified resource "' + resource.name + '": ' + resource.url;

			} else {

				// fast-fail on bad type
				if ( ! ( typeof( resource.name ) === 'string' || resource.name instanceof String ) ) throw 'Provided file is not properly defined! Aborting...';
				for ( i = 0; i < fileDesc.length && !found; i++ ) {

					triple = fileDesc[ i ];
					if ( resource.extension.toLowerCase() === triple.ext.toLowerCase() ) {

						if ( ! triple.ignore ) result[ triple.ext ] = resource;
						found = true;

					}

				}
				if ( !found ) throw 'Unidentified resource "' + resource.name + '": ' + resource.url;

			}
		}

		return result;
	}
};

/**
 * Builds one or many THREE.Mesh from one raw set of Arraybuffers, materialGroup descriptions and further parameters.
 * Supports vertex, vertexColor, normal, uv and index buffers.
 * @class
 */
THREE.LoaderSupport.MeshBuilder = function() {
	console.info( 'Using THREE.LoaderSupport.MeshBuilder version: ' + THREE.LoaderSupport.MeshBuilder.LOADER_MESH_BUILDER_VERSION );
	this.validator = THREE.LoaderSupport.Validator;

	this.logging = {
		enabled: true,
		debug: false
	};

	this.callbacks = new THREE.LoaderSupport.Callbacks();
	this.materials = [];
};
THREE.LoaderSupport.MeshBuilder.LOADER_MESH_BUILDER_VERSION = '1.3.0';

THREE.LoaderSupport.MeshBuilder.prototype = {

	constructor: THREE.LoaderSupport.MeshBuilder,

	/**
	 * Enable or disable logging in general (except warn and error), plus enable or disable debug logging.
	 *
	 * @param {boolean} enabled True or false.
	 * @param {boolean} debug True or false.
	 */
	setLogging: function ( enabled, debug ) {
		this.logging.enabled = enabled === true;
		this.logging.debug = debug === true;
	},

	/**
	 * Initializes the MeshBuilder (currently only default material initialisation).
	 *
	 */
	init: function () {
		var defaultMaterial = new THREE.MeshStandardMaterial( { color: 0xDCF1FF } );
		defaultMaterial.name = 'defaultMaterial';

		var defaultVertexColorMaterial = new THREE.MeshStandardMaterial( { color: 0xDCF1FF } );
		defaultVertexColorMaterial.name = 'defaultVertexColorMaterial';
		defaultVertexColorMaterial.vertexColors = THREE.VertexColors;

		var defaultLineMaterial = new THREE.LineBasicMaterial();
		defaultLineMaterial.name = 'defaultLineMaterial';

		var defaultPointMaterial = new THREE.PointsMaterial( { size: 1 } );
		defaultPointMaterial.name = 'defaultPointMaterial';

		var runtimeMaterials = {};
		runtimeMaterials[ defaultMaterial.name ] = defaultMaterial;
		runtimeMaterials[ defaultVertexColorMaterial.name ] = defaultVertexColorMaterial;
		runtimeMaterials[ defaultLineMaterial.name ] = defaultLineMaterial;
		runtimeMaterials[ defaultPointMaterial.name ] = defaultPointMaterial;

		this.updateMaterials(
			{
				cmd: 'materialData',
				materials: {
					materialCloneInstructions: null,
					serializedMaterials: null,
					runtimeMaterials: runtimeMaterials
				}
			}
		);
	},

	/**
	 * Set materials loaded by any supplier of an Array of {@link THREE.Material}.
	 *
	 * @param {THREE.Material[]} materials Array of {@link THREE.Material}
	 */
	setMaterials: function ( materials ) {
		var payload = {
			cmd: 'materialData',
			materials: {
				materialCloneInstructions: null,
				serializedMaterials: null,
				runtimeMaterials: this.validator.isValid( this.callbacks.onLoadMaterials ) ? this.callbacks.onLoadMaterials( materials ) : materials
			}
		};
		this.updateMaterials( payload );
	},

	_setCallbacks: function ( callbacks ) {
		if ( this.validator.isValid( callbacks.onProgress ) ) this.callbacks.setCallbackOnProgress( callbacks.onProgress );
		if ( this.validator.isValid( callbacks.onReportError ) ) this.callbacks.setCallbackOnReportError( callbacks.onReportError );
		if ( this.validator.isValid( callbacks.onMeshAlter ) ) this.callbacks.setCallbackOnMeshAlter( callbacks.onMeshAlter );
		if ( this.validator.isValid( callbacks.onLoad ) ) this.callbacks.setCallbackOnLoad( callbacks.onLoad );
		if ( this.validator.isValid( callbacks.onLoadMaterials ) ) this.callbacks.setCallbackOnLoadMaterials( callbacks.onLoadMaterials );
	},

	/**
	 * Delegates processing of the payload (mesh building or material update) to the corresponding functions (BW-compatibility).
	 *
	 * @param {Object} payload Raw Mesh or Material descriptions.
	 * @returns {THREE.Mesh[]} mesh Array of {@link THREE.Mesh} or null in case of material update
	 */
	processPayload: function ( payload ) {
		if ( payload.cmd === 'meshData' ) {

			return this.buildMeshes( payload );

		} else if ( payload.cmd === 'materialData' ) {

			this.updateMaterials( payload );
			return null;

		}
	},

	/**
	 * Builds one or multiple meshes from the data described in the payload (buffers, params, material info).
	 *
	 * @param {Object} meshPayload Raw mesh description (buffers, params, materials) used to build one to many meshes.
	 * @returns {THREE.Mesh[]} mesh Array of {@link THREE.Mesh}
	 */
	buildMeshes: function ( meshPayload ) {
		var meshName = meshPayload.params.meshName;

		var bufferGeometry = new THREE.BufferGeometry();
		bufferGeometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( meshPayload.buffers.vertices ), 3 ) );
		if ( this.validator.isValid( meshPayload.buffers.indices ) ) {

			bufferGeometry.setIndex( new THREE.BufferAttribute( new Uint32Array( meshPayload.buffers.indices ), 1 ));

		}
		var haveVertexColors = this.validator.isValid( meshPayload.buffers.colors );
		if ( haveVertexColors ) {

			bufferGeometry.addAttribute( 'color', new THREE.BufferAttribute( new Float32Array( meshPayload.buffers.colors ), 3 ) );

		}
		if ( this.validator.isValid( meshPayload.buffers.normals ) ) {

			bufferGeometry.addAttribute( 'normal', new THREE.BufferAttribute( new Float32Array( meshPayload.buffers.normals ), 3 ) );

		} else {

			bufferGeometry.computeVertexNormals();

		}
		if ( this.validator.isValid( meshPayload.buffers.uvs ) ) {

			bufferGeometry.addAttribute( 'uv', new THREE.BufferAttribute( new Float32Array( meshPayload.buffers.uvs ), 2 ) );

		}

		var material, materialName, key;
		var materialNames = meshPayload.materials.materialNames;
		var createMultiMaterial = meshPayload.materials.multiMaterial;
		var multiMaterials = [];
		for ( key in materialNames ) {

			materialName = materialNames[ key ];
			material = this.materials[ materialName ];
			if ( createMultiMaterial ) multiMaterials.push( material );

		}
		if ( createMultiMaterial ) {

			material = multiMaterials;
			var materialGroups = meshPayload.materials.materialGroups;
			var materialGroup;
			for ( key in materialGroups ) {

				materialGroup = materialGroups[ key ];
				bufferGeometry.addGroup( materialGroup.start, materialGroup.count, materialGroup.index );

			}

		}

		var meshes = [];
		var mesh;
		var callbackOnMeshAlter = this.callbacks.onMeshAlter;
		var callbackOnMeshAlterResult;
		var useOrgMesh = true;
		var geometryType = this.validator.verifyInput( meshPayload.geometryType, 0 );
		if ( this.validator.isValid( callbackOnMeshAlter ) ) {

			callbackOnMeshAlterResult = callbackOnMeshAlter(
				{
					detail: {
						meshName: meshName,
						bufferGeometry: bufferGeometry,
						material: material,
						geometryType: geometryType
					}
				}
			);
			if ( this.validator.isValid( callbackOnMeshAlterResult ) ) {

				if ( callbackOnMeshAlterResult.isDisregardMesh() ) {

					useOrgMesh = false;

				} else if ( callbackOnMeshAlterResult.providesAlteredMeshes() ) {

					for ( var i in callbackOnMeshAlterResult.meshes ) {

						meshes.push( callbackOnMeshAlterResult.meshes[ i ] );

					}
					useOrgMesh = false;

				}

			}

		}
		if ( useOrgMesh ) {

			if ( meshPayload.computeBoundingSphere ) bufferGeometry.computeBoundingSphere();
			if ( geometryType === 0 ) {

				mesh = new THREE.Mesh( bufferGeometry, material );

			} else if ( geometryType === 1) {

				mesh = new THREE.LineSegments( bufferGeometry, material );

			} else {

				mesh = new THREE.Points( bufferGeometry, material );

			}
			mesh.name = meshName;
			meshes.push( mesh );

		}

		var progressMessage;
		if ( this.validator.isValid( meshes ) && meshes.length > 0 ) {

			var meshNames = [];
			for ( var i in meshes ) {

				mesh = meshes[ i ];
				meshNames[ i ] = mesh.name;

			}
			progressMessage = 'Adding mesh(es) (' + meshNames.length + ': ' + meshNames + ') from input mesh: ' + meshName;
			progressMessage += ' (' + ( meshPayload.progress.numericalValue * 100 ).toFixed( 2 ) + '%)';

		} else {

			progressMessage = 'Not adding mesh: ' + meshName;
			progressMessage += ' (' + ( meshPayload.progress.numericalValue * 100 ).toFixed( 2 ) + '%)';

		}
		var callbackOnProgress = this.callbacks.onProgress;
		if ( this.validator.isValid( callbackOnProgress ) ) {

			var event = new CustomEvent( 'MeshBuilderEvent', {
				detail: {
					type: 'progress',
					modelName: meshPayload.params.meshName,
					text: progressMessage,
					numericalValue: meshPayload.progress.numericalValue
				}
			} );
			callbackOnProgress( event );

		}

		return meshes;
	},

	/**
	 * Updates the materials with contained material objects (sync) or from alteration instructions (async).
	 *
	 * @param {Object} materialPayload Material update instructions
	 */
	updateMaterials: function ( materialPayload ) {
		var material, materialName;
		var materialCloneInstructions = materialPayload.materials.materialCloneInstructions;
		if ( this.validator.isValid( materialCloneInstructions ) ) {

			var materialNameOrg = materialCloneInstructions.materialNameOrg;
			var materialOrg = this.materials[ materialNameOrg ];

			if ( this.validator.isValid( materialNameOrg ) ) {

				material = materialOrg.clone();

				materialName = materialCloneInstructions.materialName;
				material.name = materialName;

				var materialProperties = materialCloneInstructions.materialProperties;
				for ( var key in materialProperties ) {

					if ( material.hasOwnProperty( key ) && materialProperties.hasOwnProperty( key ) ) material[ key ] = materialProperties[ key ];

				}
				this.materials[ materialName ] = material;

			} else {

				console.warn( 'Requested material "' + materialNameOrg + '" is not available!' );

			}
		}

		var materials = materialPayload.materials.serializedMaterials;
		if ( this.validator.isValid( materials ) && Object.keys( materials ).length > 0 ) {

			var loader = new THREE.MaterialLoader();
			var materialJson;
			for ( materialName in materials ) {

				materialJson = materials[ materialName ];
				if ( this.validator.isValid( materialJson ) ) {

					material = loader.parse( materialJson );
					if ( this.logging.enabled ) console.info( 'De-serialized material with name "' + materialName + '" will be added.' );
					this.materials[ materialName ] = material;
				}

			}

		}

		materials = materialPayload.materials.runtimeMaterials;
		if ( this.validator.isValid( materials ) && Object.keys( materials ).length > 0 ) {

			for ( materialName in materials ) {

				material = materials[ materialName ];
				if ( this.logging.enabled ) console.info( 'Material with name "' + materialName + '" will be added.' );
				this.materials[ materialName ] = material;

			}

		}
	},

	/**
	 * Returns the mapping object of material name and corresponding jsonified material.
	 *
	 * @returns {Object} Map of Materials in JSON representation
	 */
	getMaterialsJSON: function () {
		var materialsJSON = {};
		var material;
		for ( var materialName in this.materials ) {

			material = this.materials[ materialName ];
			materialsJSON[ materialName ] = material.toJSON();
		}

		return materialsJSON;
	},

	/**
	 * Returns the mapping object of material name and corresponding material.
	 *
	 * @returns {Object} Map of {@link THREE.Material}
	 */
	getMaterials: function () {
		return this.materials;
	}

};

/**
 * This class provides means to transform existing parser code into a web worker. It defines a simple communication protocol
 * which allows to configure the worker and receive raw mesh data during execution.
 * @class
 */
THREE.LoaderSupport.WorkerSupport = function () {
	console.info( 'Using THREE.LoaderSupport.WorkerSupport version: ' + THREE.LoaderSupport.WorkerSupport.WORKER_SUPPORT_VERSION );
	this.logging = {
		enabled: true,
		debug: false
	};

	//Choose implementation of worker based on environment
	this.loaderWorker = typeof window !== "undefined" ? new THREE.LoaderSupport.WorkerSupport.LoaderWorker() : new THREE.LoaderSupport.WorkerSupport.NodeLoaderWorker();
};

THREE.LoaderSupport.WorkerSupport.WORKER_SUPPORT_VERSION = '2.3.0';

THREE.LoaderSupport.WorkerSupport.prototype = {

	constructor: THREE.LoaderSupport.WorkerSupport,

	/**
	 * Enable or disable logging in general (except warn and error), plus enable or disable debug logging.
	 *
	 * @param {boolean} enabled True or false.
	 * @param {boolean} debug True or false.
	 */
	setLogging: function ( enabled, debug ) {
		this.logging.enabled = enabled === true;
		this.logging.debug = debug === true;
		this.loaderWorker.setLogging( this.logging.enabled, this.logging.debug );
	},

	/**
	 * Forces all ArrayBuffers to be transferred to worker to be copied.
	 *
	 * @param {boolean} forceWorkerDataCopy True or false.
	 */
	setForceWorkerDataCopy: function ( forceWorkerDataCopy ) {
		this.loaderWorker.setForceCopy( forceWorkerDataCopy );
	},

	/**
	 * Validate the status of worker code and the derived worker.
	 *
	 * @param {Function} functionCodeBuilder Function that is invoked with funcBuildObject and funcBuildSingleton that allows stringification of objects and singletons.
	 * @param {String} parserName Name of the Parser object
	 * @param {String[]} libLocations URL of libraries that shall be added to worker code relative to libPath
	 * @param {String} libPath Base path used for loading libraries
	 * @param {THREE.LoaderSupport.WorkerRunnerRefImpl} runnerImpl The default worker parser wrapper implementation (communication and execution). An extended class could be passed here.
	 */
	validate: function ( functionCodeBuilder, parserName, libLocations, libPath, runnerImpl ) {
		if ( THREE.LoaderSupport.Validator.isValid( this.loaderWorker.worker ) ) return;

		if ( this.logging.enabled ) {

			console.info( 'WorkerSupport: Building worker code...' );
			console.time( 'buildWebWorkerCode' );

		}
		if ( THREE.LoaderSupport.Validator.isValid( runnerImpl ) ) {

			if ( this.logging.enabled ) console.info( 'WorkerSupport: Using "' + runnerImpl.runnerName + '" as Runner class for worker.' );

		// Browser implementation
		} else if ( typeof window !== "undefined" ) {

			runnerImpl = THREE.LoaderSupport.WorkerRunnerRefImpl;
			if ( this.logging.enabled ) console.info( 'WorkerSupport: Using DEFAULT "THREE.LoaderSupport.WorkerRunnerRefImpl" as Runner class for worker.' );

		// NodeJS implementation
		} else {

			runnerImpl = THREE.LoaderSupport.NodeWorkerRunnerRefImpl;
			if ( this.logging.enabled ) console.info( 'WorkerSupport: Using DEFAULT "THREE.LoaderSupport.NodeWorkerRunnerRefImpl" as Runner class for worker.' );

		}
		var userWorkerCode = functionCodeBuilder( THREE.LoaderSupport.WorkerSupport.CodeSerializer );
		userWorkerCode += 'var Parser = '+ parserName +  ';\n\n';
		userWorkerCode += THREE.LoaderSupport.WorkerSupport.CodeSerializer.serializeClass( runnerImpl.runnerName, runnerImpl );
		userWorkerCode += 'new ' + runnerImpl.runnerName + '();\n\n';

		var scope = this;
		if ( THREE.LoaderSupport.Validator.isValid( libLocations ) && libLocations.length > 0 ) {

			var libsContent = '';
			var loadAllLibraries = function ( path, locations ) {
				if ( locations.length === 0 ) {

					scope.loaderWorker.initWorker( libsContent + userWorkerCode, runnerImpl.runnerName );
					if ( scope.logging.enabled ) console.timeEnd( 'buildWebWorkerCode' );

				} else {

					var loadedLib = function ( contentAsString ) {
						libsContent += contentAsString;
						loadAllLibraries( path, locations );
					};

					var fileLoader = new THREE.FileLoader();
					fileLoader.setPath( path );
					fileLoader.setResponseType( 'text' );
					fileLoader.load( locations[ 0 ], loadedLib );
					locations.shift();

				}
			};
			loadAllLibraries( libPath, libLocations );

		} else {

			this.loaderWorker.initWorker( userWorkerCode, runnerImpl.runnerName );
			if ( this.logging.enabled ) console.timeEnd( 'buildWebWorkerCode' );

		}
	},

	/**
	 * Specify functions that should be build when new raw mesh data becomes available and when the parser is finished.
	 *
	 * @param {Function} meshBuilder The mesh builder function. Default is {@link THREE.LoaderSupport.MeshBuilder}.
	 * @param {Function} onLoad The function that is called when parsing is complete.
	 */
	setCallbacks: function ( meshBuilder, onLoad ) {
		this.loaderWorker.setCallbacks( meshBuilder, onLoad );
	},

	/**
	 * Runs the parser with the provided configuration.
	 *
	 * @param {Object} payload Raw mesh description (buffers, params, materials) used to build one to many meshes.
	 */
	run: function ( payload ) {
		this.loaderWorker.run( payload );
	},

	/**
	 * Request termination of worker once parser is finished.
	 *
	 * @param {boolean} terminateRequested True or false.
	 */
	setTerminateRequested: function ( terminateRequested ) {
		this.loaderWorker.setTerminateRequested( terminateRequested );
	}

};


THREE.LoaderSupport.WorkerSupport.LoaderWorker = function () {
	this._reset();
};

THREE.LoaderSupport.WorkerSupport.LoaderWorker.prototype = {

	constructor: THREE.LoaderSupport.WorkerSupport.LoaderWorker,

	_reset: function () {
		this.logging = {
			enabled: true,
			debug: false
		};
		this.worker = null;
		this.runnerImplName = null;
		this.callbacks = {
			meshBuilder: null,
			onLoad: null
		};
		this.terminateRequested = false;
		this.queuedMessage = null;
		this.started = false;
		this.forceCopy = false;
	},

	/**
	 * Check support for Workers and other necessary features returning
	 * reason if the environment is unsupported
	 *
	 * @returns {string|undefined} Returns undefined if supported, or
	 * string with error if not supported
	 */
	checkSupport: function() {
		if ( window.Worker === undefined ) return "This browser does not support web workers!";
		if ( window.Blob === undefined  ) return "This browser does not support Blob!";
		if ( typeof window.URL.createObjectURL !== 'function'  ) return "This browser does not support Object creation from URL!";
	},

	setLogging: function ( enabled, debug ) {
		this.logging.enabled = enabled === true;
		this.logging.debug = debug === true;
	},

	setForceCopy: function ( forceCopy ) {
		this.forceCopy = forceCopy === true;
	},

	initWorker: function ( code, runnerImplName ) {
		var supportError = this.checkSupport();
		if ( supportError ) {

			throw supportError;

		}
		this.runnerImplName = runnerImplName;

		var blob = new Blob( [ code ], { type: 'application/javascript' } );
		this.worker = new Worker( window.URL.createObjectURL( blob ) );

		this.worker.onmessage = this._receiveWorkerMessage;

		// set referemce to this, then processing in worker scope within "_receiveWorkerMessage" can access members
		this.worker.runtimeRef = this;

		// process stored queuedMessage
		this._postMessage();
	},

	/**
	 * Executed in worker scope
	 */
	_receiveWorkerMessage: function ( e ) {
		var payload = e.data;
		switch ( payload.cmd ) {
			case 'meshData':
			case 'materialData':
			case 'imageData':
				this.runtimeRef.callbacks.meshBuilder( payload );
				break;

			case 'complete':
				this.runtimeRef.queuedMessage = null;
				this.started = false;
				this.runtimeRef.callbacks.onLoad( payload.msg );

				if ( this.runtimeRef.terminateRequested ) {

					if ( this.runtimeRef.logging.enabled ) console.info( 'WorkerSupport [' + this.runtimeRef.runnerImplName + ']: Run is complete. Terminating application on request!' );
					this.runtimeRef._terminate();

				}
				break;

			case 'error':
				console.error( 'WorkerSupport [' + this.runtimeRef.runnerImplName + ']: Reported error: ' + payload.msg );
				this.runtimeRef.queuedMessage = null;
				this.started = false;
				this.runtimeRef.callbacks.onLoad( payload.msg );

				if ( this.runtimeRef.terminateRequested ) {

					if ( this.runtimeRef.logging.enabled ) console.info( 'WorkerSupport [' + this.runtimeRef.runnerImplName + ']: Run reported error. Terminating application on request!' );
					this.runtimeRef._terminate();

				}
				break;

			default:
				console.error( 'WorkerSupport [' + this.runtimeRef.runnerImplName + ']: Received unknown command: ' + payload.cmd );
				break;

		}
	},

	setCallbacks: function ( meshBuilder, onLoad ) {
		this.callbacks.meshBuilder = THREE.LoaderSupport.Validator.verifyInput( meshBuilder, this.callbacks.meshBuilder );
		this.callbacks.onLoad = THREE.LoaderSupport.Validator.verifyInput( onLoad, this.callbacks.onLoad );
	},

	run: function( payload ) {
		if ( THREE.LoaderSupport.Validator.isValid( this.queuedMessage ) ) {

			console.warn( 'Already processing message. Rejecting new run instruction' );
			return;

		} else {

			this.queuedMessage = payload;
			this.started = true;

		}
		if ( ! THREE.LoaderSupport.Validator.isValid( this.callbacks.meshBuilder ) ) throw 'Unable to run as no "MeshBuilder" callback is set.';
		if ( ! THREE.LoaderSupport.Validator.isValid( this.callbacks.onLoad ) ) throw 'Unable to run as no "onLoad" callback is set.';
		if ( payload.cmd !== 'run' ) payload.cmd = 'run';
		if ( THREE.LoaderSupport.Validator.isValid( payload.logging ) ) {

			payload.logging.enabled = payload.logging.enabled === true;
			payload.logging.debug = payload.logging.debug === true;

		} else {

			payload.logging = {
				enabled: true,
				debug: false
			}

		}
		this._postMessage();
	},

	_postMessage: function () {
		if ( THREE.LoaderSupport.Validator.isValid( this.queuedMessage ) && THREE.LoaderSupport.Validator.isValid( this.worker ) ) {

			if ( this.queuedMessage.data.input instanceof ArrayBuffer ) {

				var content;
				if ( this.forceCopy ) {

					content = this.queuedMessage.data.input.slice( 0 );

				} else {

					content = this.queuedMessage.data.input;

				}
				this.worker.postMessage( this.queuedMessage, [ content ] );

			} else {

				this.worker.postMessage( this.queuedMessage );

			}

		}
	},

	setTerminateRequested: function ( terminateRequested ) {
		this.terminateRequested = terminateRequested === true;
		if ( this.terminateRequested && THREE.LoaderSupport.Validator.isValid( this.worker ) && ! THREE.LoaderSupport.Validator.isValid( this.queuedMessage ) && this.started ) {

			if ( this.logging.enabled ) console.info( 'Worker is terminated immediately as it is not running!' );
			this._terminate();

		}
	},

	_terminate: function () {
		this.worker.terminate();
		this._reset();
	}
};


THREE.LoaderSupport.WorkerSupport.CodeSerializer = {

	/**
	 *
	 * @param fullName
	 * @param object
	 * @returns {string}
	 */
	serializeObject: function ( fullName, object ) {
		var objectString = fullName + ' = {\n\n';
		var part;
		for ( var name in object ) {

			part = object[ name ];
			if ( typeof( part ) === 'string' || part instanceof String ) {

				part = part.replace( '\n', '\\n' );
				part = part.replace( '\r', '\\r' );
				objectString += '\t' + name + ': "' + part + '",\n';

			} else if ( part instanceof Array ) {

				objectString += '\t' + name + ': [' + part + '],\n';

			} else if ( typeof part === 'object' ) {

				// TODO: Short-cut for now. Recursion required?
				objectString += '\t' + name + ': {},\n';

			} else {

				objectString += '\t' + name + ': ' + part + ',\n';

			}

		}
		objectString += '}\n\n';

		return objectString;
	},

	/**
	 *
	 * @param fullName
	 * @param object
	 * @param basePrototypeName
	 * @param ignoreFunctions
	 * @returns {string}
	 */
	serializeClass: function ( fullName, object, constructorName, basePrototypeName, ignoreFunctions, includeFunctions, overrideFunctions ) {
		var valueString, objectPart, constructorString, i, funcOverride;
		var prototypeFunctions = [];
		var objectProperties = [];
		var objectFunctions = [];
		var isExtended = ( basePrototypeName !== null && basePrototypeName !== undefined );

		if ( ! Array.isArray( ignoreFunctions ) ) ignoreFunctions = [];
		if ( ! Array.isArray( includeFunctions ) ) includeFunctions = null;
		if ( ! Array.isArray( overrideFunctions ) ) overrideFunctions = [];

		for ( var name in object.prototype ) {

			objectPart = object.prototype[ name ];
			valueString = objectPart.toString();
			if ( name === 'constructor' ) {

				constructorString = fullName + ' = ' + valueString + ';\n\n';

			} else if ( typeof objectPart === 'function' ) {

				if ( ignoreFunctions.indexOf( name ) < 0 && ( includeFunctions === null || includeFunctions.indexOf( name ) >= 0 ) ) {

					funcOverride = overrideFunctions[ name ];
					if ( funcOverride && funcOverride.fullName === fullName + '.prototype.' + name ) {

						valueString = funcOverride.code;

					}
					if ( isExtended ) {

						prototypeFunctions.push( fullName + '.prototype.' + name + ' = ' + valueString + ';\n\n' );

					} else {

						prototypeFunctions.push( '\t' + name + ': ' + valueString + ',\n\n' );

					}
				}

			}

		}
		for ( var name in object ) {

			objectPart = object[ name ];

			if ( typeof objectPart === 'function' ) {

				if ( ignoreFunctions.indexOf( name ) < 0 && ( includeFunctions === null || includeFunctions.indexOf( name ) >= 0 ) ) {

					funcOverride = overrideFunctions[ name ];
					if ( funcOverride && funcOverride.fullName === fullName + '.' + name ) {

						valueString = funcOverride.code;

					} else {

						valueString = objectPart.toString();

					}
					objectFunctions.push( fullName + '.' + name + ' = ' + valueString + ';\n\n' );

				}

			} else {

				if ( typeof( objectPart ) === 'string' || objectPart instanceof String) {

					valueString = '\"' + objectPart.toString() + '\"';

				} else if ( typeof objectPart === 'object' ) {

					// TODO: Short-cut for now. Recursion required?
					valueString = "{}";

				} else {

					valueString = objectPart;

				}
				objectProperties.push( fullName + '.' + name + ' = ' + valueString + ';\n' );

			}

		}
		if ( ( constructorString === undefined || constructorString === null ) && typeof object.prototype.constructor === 'function' ) {

			constructorString = fullName + ' = ' + object.prototype.constructor.toString().replace( constructorName, '' );

		}
		var objectString = constructorString + '\n\n';
		if ( isExtended ) {

			objectString += fullName + '.prototype = Object.create( ' + basePrototypeName + '.prototype );\n';

		}
		objectString += fullName + '.prototype.constructor = ' + fullName + ';\n';
		objectString += '\n\n';

		for ( i = 0; i < objectProperties.length; i ++ ) objectString += objectProperties[ i ];
		objectString += '\n\n';

		for ( i = 0; i < objectFunctions.length; i ++ ) objectString += objectFunctions[ i ];
		objectString += '\n\n';

		if ( isExtended ) {

			for ( i = 0; i < prototypeFunctions.length; i ++ ) objectString += prototypeFunctions[ i ];

		} else {

			objectString += fullName + '.prototype = {\n\n';
			for ( i = 0; i < prototypeFunctions.length; i ++ ) objectString += prototypeFunctions[ i ];
			objectString += '\n};';

		}
		objectString += '\n\n';

		return objectString;
	},
};

/**
 * Default implementation of the WorkerRunner responsible for creation and configuration of the parser within the worker.
 *
 * @class
 */
THREE.LoaderSupport.WorkerRunnerRefImpl = function () {
	var scopedRunner = function( event ) {
		this.processMessage( event.data );
	};
	this.getParentScope().addEventListener( 'message', scopedRunner.bind( this ) );
};

THREE.LoaderSupport.WorkerRunnerRefImpl.runnerName = 'THREE.LoaderSupport.WorkerRunnerRefImpl';

THREE.LoaderSupport.WorkerRunnerRefImpl.prototype = {

	constructor: THREE.LoaderSupport.WorkerRunnerRefImpl,

	/**
	 * Returns the parent scope that this worker was spawned in.
	 *
	 * @returns {WorkerGlobalScope|Object} Returns a references
	 * to the parent global scope or compatible type.
	 */
	getParentScope: function () {
		return self;
	},

	/**
	 * Applies values from parameter object via set functions or via direct assignment.
	 *
	 * @param {Object} parser The parser instance
	 * @param {Object} params The parameter object
	 */
	applyProperties: function ( parser, params ) {
		var property, funcName, values;
		for ( property in params ) {
			funcName = 'set' + property.substring( 0, 1 ).toLocaleUpperCase() + property.substring( 1 );
			values = params[ property ];

			if ( typeof parser[ funcName ] === 'function' ) {

				parser[ funcName ]( values );

			} else if ( parser.hasOwnProperty( property ) ) {

				parser[ property ] = values;

			}
		}
	},

	/**
	 * Configures the Parser implementation according the supplied configuration object.
	 *
	 * @param {Object} payload Raw mesh description (buffers, params, materials) used to build one to many meshes.
	 */
	processMessage: function ( payload ) {
		if ( payload.cmd === 'run' ) {

			var self = this.getParentScope();
			var callbacks = {
				callbackMeshBuilder: function ( payload ) {
					self.postMessage( payload );
				},
				callbackProgress: function ( text ) {
					if ( payload.logging.enabled && payload.logging.debug ) console.debug( 'WorkerRunner: progress: ' + text );
				}
			};

			// Parser is expected to be named as such
			var parser = new Parser();
			if ( typeof parser[ 'setLogging' ] === 'function' ) parser.setLogging( payload.logging.enabled, payload.logging.debug );
			this.applyProperties( parser, payload.params );
			this.applyProperties( parser, payload.materials );
			this.applyProperties( parser, callbacks );
			parser.workerScope = self;
			parser.parse( payload.data.input, payload.data.options );

			if ( payload.logging.enabled ) console.log( 'WorkerRunner: Run complete!' );

			callbacks.callbackMeshBuilder( {
				cmd: 'complete',
				msg: 'WorkerRunner completed run.'
			} );

		} else {

			console.error( 'WorkerRunner: Received unknown command: ' + payload.cmd );

		}
	}
};


/**
 * This class provides the NodeJS implementation of the WorkerRunnerRefImpl
 * @class
 * @extends THREE.LoaderSupport.WorkerRunnerRefImpl
 */
THREE.LoaderSupport.NodeWorkerRunnerRefImpl = function () {
	this.runnerName = 'THREE.LoaderSupport.NodeWorkerRunnerRefImpl';
	// No call to super because super class only binds to processMessage
	// In NodeJS, there is no addEventListener so use onmessage.
	// Also, the message object can be passed directly to
	// processMessage() as it isn't an `Event`, but a plain object
	// with the data
	this.getParentScope().onmessage = this.processMessage.bind( this );
};

THREE.LoaderSupport.NodeWorkerRunnerRefImpl.prototype = Object.create( THREE.LoaderSupport.WorkerRunnerRefImpl.prototype );
THREE.LoaderSupport.NodeWorkerRunnerRefImpl.prototype.constructor = THREE.LoaderSupport.NodeWorkerRunnerRefImpl;
THREE.LoaderSupport.NodeWorkerRunnerRefImpl.runnerName = 'THREE.LoaderSupport.NodeWorkerRunnerRefImpl';

THREE.LoaderSupport.NodeWorkerRunnerRefImpl.prototype = {

	getParentScope: function(){
		// Work around webpack builds failing with NodeJS requires
		// (placing it outside this function will fail because
		// this class is passed to the worker as a string!)
		var _require = eval( 'require' );
		return _require( 'worker_threads' ).parentPort;
	}
};


/**
 * This class provides the NodeJS implementation of LoaderWorker
 * @class
 * @extends LoaderWorker
 */
THREE.LoaderSupport.WorkerSupport.NodeLoaderWorker = function (){
	THREE.LoaderSupport.WorkerSupport.LoaderWorker.call( this );
};

THREE.LoaderSupport.WorkerSupport.NodeLoaderWorker.prototype = Object.create( THREE.LoaderSupport.WorkerSupport.LoaderWorker.prototype );
THREE.LoaderSupport.WorkerSupport.NodeLoaderWorker.prototype.constructor = THREE.LoaderSupport.WorkerSupport.NodeLoaderWorker;

/**
 * @inheritdoc
  */
THREE.LoaderSupport.WorkerSupport.NodeLoaderWorker.checkSupport = function() {
	try {
		// Work around webpack builds failing with NodeJS requires
		var _require = eval( 'require' );
		_require.resolve( 'worker_threads' );
	}
	catch(e) {
		return 'This version of Node does not support web workers!';
	}
};

/**
 * @inheritdoc
 */
THREE.LoaderSupport.WorkerSupport.NodeLoaderWorker.prototype.initWorker = function ( code, runnerImplName ) {
	var supportError = this.checkSupport();
	if( supportError ) {

		throw supportError;

	}
	this.runnerImplName = runnerImplName;

	// Work around webpack builds failing with NodeJS requires
	var _require = eval( 'require' );
	var Worker = _require( 'worker_threads' ).Worker;
	this.worker = new Worker( code, { eval: true } );

	this.worker.onmessage = this._receiveWorkerMessage;

	// set referemce to this, then processing in worker scope within "_receiveWorkerMessage" can access members
	this.worker.runtimeRef = this;

	// process stored queuedMessage
	this._postMessage();
};

/**
 * Orchestrate loading of multiple OBJ files/data from an instruction queue with a configurable amount of workers (1-16).
 * Workflow:
 *   prepareWorkers
 *   enqueueForRun
 *   processQueue
 *   tearDown (to force stop)
 *
 * @class
 *
 * @param {string} classDef Class definition to be used for construction
 */
THREE.LoaderSupport.WorkerDirector = function ( classDef ) {
	console.info( 'Using THREE.LoaderSupport.WorkerDirector version: ' + THREE.LoaderSupport.WorkerDirector.LOADER_WORKER_DIRECTOR_VERSION );
	this.logging = {
		enabled: true,
		debug: false
	};

	this.maxQueueSize = THREE.LoaderSupport.WorkerDirector.MAX_QUEUE_SIZE ;
	this.maxWebWorkers = THREE.LoaderSupport.WorkerDirector.MAX_WEB_WORKER;
	this.crossOrigin = null;

	if ( ! THREE.LoaderSupport.Validator.isValid( classDef ) ) throw 'Provided invalid classDef: ' + classDef;

	this.workerDescription = {
		classDef: classDef,
		globalCallbacks: {},
		workerSupports: {},
		forceWorkerDataCopy: true
	};
	this.objectsCompleted = 0;
	this.instructionQueue = [];
	this.instructionQueuePointer = 0;

	this.callbackOnFinishedProcessing = null;
}


THREE.LoaderSupport.WorkerDirector.LOADER_WORKER_DIRECTOR_VERSION = '2.3.0';
THREE.LoaderSupport.WorkerDirector.MAX_WEB_WORKER = 16;
THREE.LoaderSupport.WorkerDirector.MAX_QUEUE_SIZE = 2048;

THREE.LoaderSupport.WorkerDirector.prototype = {

	constructor: THREE.LoaderSupport.WorkerDirector,
	/**
	 * Enable or disable logging in general (except warn and error), plus enable or disable debug logging.
	 *
	 * @param {boolean} enabled True or false.
	 * @param {boolean} debug True or false.
	 */
	setLogging: function ( enabled, debug ) {
		this.logging.enabled = enabled === true;
		this.logging.debug = debug === true;
	},

	/**
	 * Returns the maximum length of the instruction queue.
	 *
	 * @returns {number}
	 */
	getMaxQueueSize: function () {
		return this.maxQueueSize;
	},

	/**
	 * Returns the maximum number of workers.
	 *
	 * @returns {number}
	 */
	getMaxWebWorkers: function () {
		return this.maxWebWorkers;
	},

	/**
	 * Sets the CORS string to be used.
	 *
	 * @param {string} crossOrigin CORS value
	 */
	setCrossOrigin: function ( crossOrigin ) {
		this.crossOrigin = crossOrigin;
	},

	/**
	 * Forces all ArrayBuffers to be transferred to worker to be copied.
	 *
	 * @param {boolean} forceWorkerDataCopy True or false.
	 */
	setForceWorkerDataCopy: function ( forceWorkerDataCopy ) {
		this.workerDescription.forceWorkerDataCopy = forceWorkerDataCopy === true;
	},

	/**
	 * Create or destroy workers according limits. Set the name and register callbacks for dynamically created web workers.
	 *
	 * @param {THREE.OBJLoader2.WWOBJLoader2.PrepDataCallbacks} globalCallbacks  Register global callbacks used by all web workers
	 * @param {number} maxQueueSize Set the maximum size of the instruction queue (1-1024)
	 * @param {number} maxWebWorkers Set the maximum amount of workers (1-16)
	 */
	prepareWorkers: function ( globalCallbacks, maxQueueSize, maxWebWorkers ) {
		if ( THREE.LoaderSupport.Validator.isValid( globalCallbacks ) ) this.workerDescription.globalCallbacks = globalCallbacks;
		this.maxQueueSize = Math.min( maxQueueSize, THREE.LoaderSupport.WorkerDirector.MAX_QUEUE_SIZE );
		this.maxWebWorkers = Math.min( maxWebWorkers, THREE.LoaderSupport.WorkerDirector.MAX_WEB_WORKER );
		this.maxWebWorkers = Math.min( this.maxWebWorkers, this.maxQueueSize );
		this.objectsCompleted = 0;
		this.instructionQueue = [];
		this.instructionQueuePointer = 0;

		for ( var instanceNo = 0; instanceNo < this.maxWebWorkers; instanceNo++ ) {

			var workerSupport = new THREE.LoaderSupport.WorkerSupport();
			workerSupport.setLogging( this.logging.enabled, this.logging.debug );
			workerSupport.setForceWorkerDataCopy( this.workerDescription.forceWorkerDataCopy );
			this.workerDescription.workerSupports[ instanceNo ] = {
				instanceNo: instanceNo,
				inUse: false,
				terminateRequested: false,
				workerSupport: workerSupport,
				loader: null
			};

		}
	},

	/**
	 * Store run instructions in internal instructionQueue.
	 *
	 * @param {THREE.LoaderSupport.PrepData} prepData
	 */
	enqueueForRun: function ( prepData ) {
		if ( this.instructionQueue.length < this.maxQueueSize ) {
			this.instructionQueue.push( prepData );
		}
	},

	/**
	 * Returns if any workers are running.
	 *
	 * @returns {boolean}
	 */
	isRunning: function () {
		var wsKeys = Object.keys( this.workerDescription.workerSupports );
		return ( ( this.instructionQueue.length > 0 && this.instructionQueuePointer < this.instructionQueue.length ) || wsKeys.length > 0 );
	},

	/**
	 * Process the instructionQueue until it is depleted.
	 */
	processQueue: function () {
		var prepData, supportDesc;
		for ( var instanceNo in this.workerDescription.workerSupports ) {

			supportDesc = this.workerDescription.workerSupports[ instanceNo ];
			if ( ! supportDesc.inUse ) {

				if ( this.instructionQueuePointer < this.instructionQueue.length ) {

					prepData = this.instructionQueue[ this.instructionQueuePointer ];
					this._kickWorkerRun( prepData, supportDesc );
					this.instructionQueuePointer++;

				} else {

					this._deregister( supportDesc );

				}

			}

		}

		if ( ! this.isRunning() && this.callbackOnFinishedProcessing !== null ) {

			this.callbackOnFinishedProcessing();
			this.callbackOnFinishedProcessing = null;

		}
	},

	_kickWorkerRun: function( prepData, supportDesc ) {
		supportDesc.inUse = true;
		supportDesc.workerSupport.setTerminateRequested( supportDesc.terminateRequested );

		if ( this.logging.enabled ) console.info( '\nAssigning next item from queue to worker (queue length: ' + this.instructionQueue.length + ')\n\n' );

		var validator = THREE.LoaderSupport.Validator;
		var scope = this;
		var prepDataCallbacks = prepData.getCallbacks();
		var globalCallbacks = this.workerDescription.globalCallbacks;
		var wrapperOnLoad = function ( event ) {
			if ( validator.isValid( globalCallbacks.onLoad ) ) globalCallbacks.onLoad( event );
			if ( validator.isValid( prepDataCallbacks.onLoad ) ) prepDataCallbacks.onLoad( event );
			scope.objectsCompleted++;
			supportDesc.inUse = false;

			scope.processQueue();
		};

		var wrapperOnProgress = function ( event ) {
			if ( validator.isValid( globalCallbacks.onProgress ) ) globalCallbacks.onProgress( event );
			if ( validator.isValid( prepDataCallbacks.onProgress ) ) prepDataCallbacks.onProgress( event );
		};

		var wrapperOnMeshAlter = function ( event, override ) {
			if ( validator.isValid( globalCallbacks.onMeshAlter ) ) override = globalCallbacks.onMeshAlter( event, override );
			if ( validator.isValid( prepDataCallbacks.onMeshAlter ) ) override = globalCallbacks.onMeshAlter( event, override );
			return override;
		};

		var wrapperOnLoadMaterials = function ( materials ) {
			if ( validator.isValid( globalCallbacks.onLoadMaterials ) ) materials = globalCallbacks.onLoadMaterials( materials );
			if ( validator.isValid( prepDataCallbacks.onLoadMaterials ) ) materials = prepDataCallbacks.onLoadMaterials( materials );
			return materials;
		};

		var wrapperOnReportError = function ( errorMessage ) {
			var continueProcessing = true;
			if ( validator.isValid( globalCallbacks.onReportError ) ) continueProcessing = globalCallbacks.onReportError( supportDesc, errorMessage );
			if ( validator.isValid( prepDataCallbacks.onReportError ) )	continueProcessing = prepDataCallbacks.onReportError( supportDesc, errorMessage );

			if ( ! validator.isValid( globalCallbacks.onReportError ) && ! validator.isValid( prepDataCallbacks.onReportError ) ) {

				console.error( 'Loader reported an error: ' );
				console.error( errorMessage );

			}
			if ( continueProcessing ) {

				supportDesc.inUse = false;
				scope.processQueue();

			}
		};

		supportDesc.loader = this._buildLoader( supportDesc.instanceNo );

		var updatedCallbacks = new THREE.LoaderSupport.Callbacks();
		updatedCallbacks.setCallbackOnLoad( wrapperOnLoad );
		updatedCallbacks.setCallbackOnProgress( wrapperOnProgress );
		updatedCallbacks.setCallbackOnReportError( wrapperOnReportError );
		updatedCallbacks.setCallbackOnMeshAlter( wrapperOnMeshAlter );
		updatedCallbacks.setCallbackOnLoadMaterials( wrapperOnLoadMaterials );
		prepData.callbacks = updatedCallbacks;

		supportDesc.loader.run( prepData, supportDesc.workerSupport );
	},

	_buildLoader: function ( instanceNo ) {
		var classDef = this.workerDescription.classDef;
		var loader = Object.create( classDef.prototype );
		classDef.call( loader, THREE.DefaultLoadingManager );

		// verify that all required functions are implemented
		if ( ! loader.hasOwnProperty( 'instanceNo' ) ) throw classDef.name + ' has no property "instanceNo".';
		loader.instanceNo = instanceNo;

		if ( ! loader.hasOwnProperty( 'workerSupport' ) ) {

			throw classDef.name + ' has no property "workerSupport".';

		}
		if ( typeof loader.run !== 'function'  ) throw classDef.name + ' has no function "run".';
		if ( ! loader.hasOwnProperty( 'callbacks' ) || ! THREE.LoaderSupport.Validator.isValid( loader.callbacks ) ) {

			console.warn( classDef.name + ' has an invalid property "callbacks". Will change to "THREE.LoaderSupport.Callbacks"' );
			loader.callbacks = new THREE.LoaderSupport.Callbacks();

		}

		return loader;
	},

	_deregister: function ( supportDesc ) {
		if ( THREE.LoaderSupport.Validator.isValid( supportDesc ) ) {

			supportDesc.workerSupport.setTerminateRequested( true );
			if ( this.logging.enabled ) console.info( 'Requested termination of worker #' + supportDesc.instanceNo + '.' );

			var loaderCallbacks = supportDesc.loader.callbacks;
			if ( THREE.LoaderSupport.Validator.isValid( loaderCallbacks.onProgress ) ) loaderCallbacks.onProgress( { detail: { text: '' } } );
			delete this.workerDescription.workerSupports[ supportDesc.instanceNo ];

		}
	},

	/**
	 * Terminate all workers.
	 *
	 * @param {callback} callbackOnFinishedProcessing Function called once all workers finished processing.
	 */
	tearDown: function ( callbackOnFinishedProcessing ) {
		if ( this.logging.enabled ) console.info( 'WorkerDirector received the deregister call. Terminating all workers!' );

		this.instructionQueuePointer = this.instructionQueue.length;
		this.callbackOnFinishedProcessing = THREE.LoaderSupport.Validator.verifyInput( callbackOnFinishedProcessing, null );

		for ( var name in this.workerDescription.workerSupports ) {

			this.workerDescription.workerSupports[ name ].terminateRequested = true;

		}
	}

};

 return THREE.LoaderSupport;
});
define('vendor/three/loaders/OBJLoader2',["three", "LoaderSupport"], function(THREE, LoaderSupport){
/**
  * @author Kai Salmen / https://kaisalmen.de
  * Development repository: https://github.com/kaisalmen/WWOBJLoader
  */



if ( THREE.OBJLoader2 === undefined ) { THREE.OBJLoader2 = {} }

if ( THREE.LoaderSupport === undefined ) console.error( '"THREE.LoaderSupport" is not available. "THREE.OBJLoader2" requires it. Please include "LoaderSupport.js" in your HTML.' );

/**
 * Use this class to load OBJ data from files or to parse OBJ data from an arraybuffer
 * @class
 *
 * @param {THREE.DefaultLoadingManager} [manager] The loadingManager for the loader to use. Default is {@link THREE.DefaultLoadingManager}
 */

THREE.OBJLoader2 = function ( manager ) {
	console.info( 'Using THREE.OBJLoader2 version: ' + THREE.OBJLoader2.OBJLOADER2_VERSION );

	this.manager = THREE.LoaderSupport.Validator.verifyInput( manager, THREE.DefaultLoadingManager );
	this.logging = {
		enabled: true,
		debug: false
	};

	this.modelName = '';
	this.instanceNo = 0;
	this.path;
	this.resourcePath;
	this.useIndices = false;
	this.disregardNormals = false;
	this.materialPerSmoothingGroup = false;
	this.useOAsMesh = false;
	this.loaderRootNode = new THREE.Group();

	this.meshBuilder = new THREE.LoaderSupport.MeshBuilder();
	this.callbacks = new THREE.LoaderSupport.Callbacks();
	this.workerSupport = new THREE.LoaderSupport.WorkerSupport();
	this.terminateWorkerOnLoad = true;
};

THREE.OBJLoader2.OBJLOADER2_VERSION = '2.5.0';

THREE.OBJLoader2.prototype = {

	constructor: THREE.OBJLoader2,

	/**
	 * Enable or disable logging in general (except warn and error), plus enable or disable debug logging.
	 *
	 * @param {boolean} enabled True or false.
	 * @param {boolean} debug True or false.
	 */
	setLogging: function ( enabled, debug ) {
		this.logging.enabled = enabled === true;
		this.logging.debug = debug === true;
		this.meshBuilder.setLogging( this.logging.enabled, this.logging.debug );
	},

	/**
	 * Set the name of the model.
	 *
	 * @param {string} modelName
	 */
	setModelName: function ( modelName ) {
		this.modelName = THREE.LoaderSupport.Validator.verifyInput( modelName, this.modelName );
	},

	/**
	 * The URL of the base path.
	 *
	 * @param {string} path URL
	 */
	setPath: function ( path ) {
		this.path = THREE.LoaderSupport.Validator.verifyInput( path, this.path );
	},

	/**
	 * Allows to specify resourcePath for dependencies of specified resource.
	 * @param {string} resourcePath
	 */
	setResourcePath: function ( resourcePath ) {
		this.resourcePath = THREE.LoaderSupport.Validator.verifyInput( resourcePath, this.resourcePath );
	},

	/**
	 * Set the node where the loaded objects will be attached directly.
	 *
	 * @param {THREE.Object3D} streamMeshesTo Object already attached to scenegraph where new meshes will be attached to
	 */
	setStreamMeshesTo: function ( streamMeshesTo ) {
		this.loaderRootNode = THREE.LoaderSupport.Validator.verifyInput( streamMeshesTo, this.loaderRootNode );
	},

	/**
	 * Set materials loaded by MTLLoader or any other supplier of an Array of {@link THREE.Material}.
	 *
	 * @param {THREE.Material[]} materials Array of {@link THREE.Material}
	 */
	setMaterials: function ( materials ) {
		this.meshBuilder.setMaterials( materials );
	},

	/**
	 * Instructs loaders to create indexed {@link THREE.BufferGeometry}.
	 *
	 * @param {boolean} useIndices=false
	 */
	setUseIndices: function ( useIndices ) {
		this.useIndices = useIndices === true;
	},

	/**
	 * Tells whether normals should be completely disregarded and regenerated.
	 *
	 * @param {boolean} disregardNormals=false
	 */
	setDisregardNormals: function ( disregardNormals ) {
		this.disregardNormals = disregardNormals === true;
	},

	/**
	 * Tells whether a material shall be created per smoothing group.
	 *
	 * @param {boolean} materialPerSmoothingGroup=false
	 */
	setMaterialPerSmoothingGroup: function ( materialPerSmoothingGroup ) {
		this.materialPerSmoothingGroup = materialPerSmoothingGroup === true;
	},

	/**
	 * Usually 'o' is meta-information and does not result in creation of new meshes, but mesh creation on occurrence of "o" can be enforced.
	 *
	 * @param {boolean} useOAsMesh=false
	 */
	setUseOAsMesh: function ( useOAsMesh ) {
		this.useOAsMesh = useOAsMesh === true;
	},

	_setCallbacks: function ( callbacks ) {
		if ( THREE.LoaderSupport.Validator.isValid( callbacks.onProgress ) ) this.callbacks.setCallbackOnProgress( callbacks.onProgress );
		if ( THREE.LoaderSupport.Validator.isValid( callbacks.onReportError ) ) this.callbacks.setCallbackOnReportError( callbacks.onReportError );
		if ( THREE.LoaderSupport.Validator.isValid( callbacks.onMeshAlter ) ) this.callbacks.setCallbackOnMeshAlter( callbacks.onMeshAlter );
		if ( THREE.LoaderSupport.Validator.isValid( callbacks.onLoad ) ) this.callbacks.setCallbackOnLoad( callbacks.onLoad );
		if ( THREE.LoaderSupport.Validator.isValid( callbacks.onLoadMaterials ) ) this.callbacks.setCallbackOnLoadMaterials( callbacks.onLoadMaterials );

		this.meshBuilder._setCallbacks( this.callbacks );
	},

	/**
	 * Announce feedback which is give to the registered callbacks.
	 * @private
	 *
	 * @param {string} type The type of event
	 * @param {string} text Textual description of the event
	 * @param {number} numericalValue Numerical value describing the progress
	 */
	onProgress: function ( type, text, numericalValue ) {
		var content = THREE.LoaderSupport.Validator.isValid( text ) ? text: '';
		var event = {
			detail: {
				type: type,
				modelName: this.modelName,
				instanceNo: this.instanceNo,
				text: content,
				numericalValue: numericalValue
			}
		};

		if ( THREE.LoaderSupport.Validator.isValid( this.callbacks.onProgress ) ) this.callbacks.onProgress( event );

		if ( this.logging.enabled && this.logging.debug ) console.debug( content );
	},

	_onError: function ( event ) {
		var output = 'Error occurred while downloading!';

		if ( event.currentTarget && event.currentTarget.statusText !== null ) {

			output += '\nurl: ' + event.currentTarget.responseURL + '\nstatus: ' + event.currentTarget.statusText;

		}
		this.onProgress( 'error', output, -1 );
		this._throwError( output );
	},

	_throwError: function ( errorMessage ) {
		if ( THREE.LoaderSupport.Validator.isValid( this.callbacks.onReportError ) )  {

			this.callbacks.onReportError( errorMessage );

		} else {

			throw errorMessage;

		}
	},

	/**
	 * Use this convenient method to load a file at the given URL. By default the fileLoader uses an ArrayBuffer.
	 *
	 * @param {string} url A string containing the path/URL of the file to be loaded.
	 * @param {callback} onLoad A function to be called after loading is successfully completed. The function receives loaded Object3D as an argument.
	 * @param {callback} [onProgress] A function to be called while the loading is in progress. The argument will be the XMLHttpRequest instance, which contains total and Integer bytes.
	 * @param {callback} [onError] A function to be called if an error occurs during loading. The function receives the error as an argument.
	 * @param {callback} [onMeshAlter] A function to be called after a new mesh raw data becomes available for alteration.
	 * @param {boolean} [useAsync] If true, uses async loading with worker, if false loads data synchronously.
	 */
	load: function ( url, onLoad, onProgress, onError, onMeshAlter, useAsync ) {
		var resource = new THREE.LoaderSupport.ResourceDescriptor( url, 'OBJ' );
		this._loadObj( resource, onLoad, onProgress, onError, onMeshAlter, useAsync );
	},

	_loadObj: function ( resource, onLoad, onProgress, onError, onMeshAlter, useAsync ) {
		var scope = this;
		if ( ! THREE.LoaderSupport.Validator.isValid( onError ) ) {
			onError = function ( event ) {
				scope._onError( event );
			}
		}

		// fast-fail
		if ( ! THREE.LoaderSupport.Validator.isValid( resource ) ) onError( 'An invalid ResourceDescriptor was provided. Unable to continue!' );
		var fileLoaderOnLoad = function ( content ) {

			resource.content = content;
			if ( useAsync ) {

				scope.parseAsync( content, onLoad );

			} else {

				var callbacks = new THREE.LoaderSupport.Callbacks();
				callbacks.setCallbackOnMeshAlter( onMeshAlter );
				scope._setCallbacks( callbacks );
				onLoad(
					{
						detail: {
							loaderRootNode: scope.parse( content ),
							modelName: scope.modelName,
							instanceNo: scope.instanceNo
						}
					}
				);

			}
		};
		this.setPath( resource.path );
		this.setResourcePath( resource.resourcePath );

		// fast-fail
		if ( ! THREE.LoaderSupport.Validator.isValid( resource.url ) || THREE.LoaderSupport.Validator.isValid( resource.content ) ) {

			fileLoaderOnLoad( THREE.LoaderSupport.Validator.isValid( resource.content ) ? resource.content : null );

		} else {

			if ( ! THREE.LoaderSupport.Validator.isValid( onProgress ) ) {
				var numericalValueRef = 0;
				var numericalValue = 0;
				onProgress = function ( event ) {
					if ( ! event.lengthComputable ) return;

					numericalValue = event.loaded / event.total;
					if ( numericalValue > numericalValueRef ) {

						numericalValueRef = numericalValue;
						var output = 'Download of "' + resource.url + '": ' + ( numericalValue * 100 ).toFixed( 2 ) + '%';
						scope.onProgress( 'progressLoad', output, numericalValue );

					}
				};
			}


			var fileLoader = new THREE.FileLoader( this.manager );
			fileLoader.setPath( this.path || this.resourcePath );
			fileLoader.setResponseType( 'arraybuffer' );
			fileLoader.load( resource.name, fileLoaderOnLoad, onProgress, onError );

		}
	},

	/**
	 * Run the loader according the provided instructions.
	 *
	 * @param {THREE.LoaderSupport.PrepData} prepData All parameters and resources required for execution
	 * @param {THREE.LoaderSupport.WorkerSupport} [workerSupportExternal] Use pre-existing WorkerSupport
	 */
	run: function ( prepData, workerSupportExternal ) {
		this._applyPrepData( prepData );
		var available = prepData.checkResourceDescriptorFiles( prepData.resources,
			[
				{ ext: "obj", type: "ArrayBuffer", ignore: false },
				{ ext: "mtl", type: "String", ignore: false },
				{ ext: "zip", type: "String", ignore: true }
			]
		);
		if ( THREE.LoaderSupport.Validator.isValid( workerSupportExternal ) ) {

			this.terminateWorkerOnLoad = false;
			this.workerSupport = workerSupportExternal;
			this.logging.enabled = this.workerSupport.logging.enabled;
			this.logging.debug = this.workerSupport.logging.debug;

		}
		var scope = this;
		var onMaterialsLoaded = function ( materials ) {
			if ( materials !== null ) scope.meshBuilder.setMaterials( materials );
			scope._loadObj( available.obj, scope.callbacks.onLoad, null, null, scope.callbacks.onMeshAlter, prepData.useAsync );

		};
		this._loadMtl( available.mtl, onMaterialsLoaded, null, null, prepData.crossOrigin, prepData.materialOptions );
	},

	_applyPrepData: function ( prepData ) {
		if ( THREE.LoaderSupport.Validator.isValid( prepData ) ) {

			this.setLogging( prepData.logging.enabled, prepData.logging.debug );
			this.setModelName( prepData.modelName );
			this.setStreamMeshesTo( prepData.streamMeshesTo );
			this.meshBuilder.setMaterials( prepData.materials );
			this.setUseIndices( prepData.useIndices );
			this.setDisregardNormals( prepData.disregardNormals );
			this.setMaterialPerSmoothingGroup( prepData.materialPerSmoothingGroup );
			this.setUseOAsMesh( prepData.useOAsMesh );

			this._setCallbacks( prepData.getCallbacks() );

		}
	},

	/**
	 * Parses OBJ data synchronously from arraybuffer or string.
	 *
	 * @param {arraybuffer|string} content OBJ data as Uint8Array or String
	 */
	parse: function ( content ) {
		// fast-fail in case of illegal data
		if ( ! THREE.LoaderSupport.Validator.isValid( content ) ) {

			console.warn( 'Provided content is not a valid ArrayBuffer or String.' );
			return this.loaderRootNode;

		}
		if ( this.logging.enabled ) console.time( 'OBJLoader2 parse: ' + this.modelName );
		this.meshBuilder.init();

		var parser = new THREE.OBJLoader2.Parser();
		parser.setLogging( this.logging.enabled, this.logging.debug );
		parser.setMaterialPerSmoothingGroup( this.materialPerSmoothingGroup );
		parser.setUseOAsMesh( this.useOAsMesh );
		parser.setUseIndices( this.useIndices );
		parser.setDisregardNormals( this.disregardNormals );
		// sync code works directly on the material references
		parser.setMaterials( this.meshBuilder.getMaterials() );

		var scope = this;
		var onMeshLoaded = function ( payload ) {
			var meshes = scope.meshBuilder.processPayload( payload );
			var mesh;
			for ( var i in meshes ) {
				mesh = meshes[ i ];
				scope.loaderRootNode.add( mesh );
			}
		};
		parser.setCallbackMeshBuilder( onMeshLoaded );
		var onProgressScoped = function ( text, numericalValue ) {
			scope.onProgress( 'progressParse', text, numericalValue );
		};
		parser.setCallbackProgress( onProgressScoped );

		if ( content instanceof ArrayBuffer || content instanceof Uint8Array ) {

			if ( this.logging.enabled ) console.info( 'Parsing arrayBuffer...' );
			parser.parse( content );

		} else if ( typeof( content ) === 'string' || content instanceof String ) {

			if ( this.logging.enabled ) console.info( 'Parsing text...' );
			parser.parseText( content );

		} else {

			this._throwError( 'Provided content was neither of type String nor Uint8Array! Aborting...' );

		}
		if ( this.logging.enabled ) console.timeEnd( 'OBJLoader2 parse: ' + this.modelName );

		return this.loaderRootNode;
	},

	/**
	 * Parses OBJ content asynchronously from arraybuffer.
	 *
	 * @param {arraybuffer} content OBJ data as Uint8Array
	 * @param {callback} onLoad Called after worker successfully completed loading
	 */
	parseAsync: function ( content, onLoad ) {
		var scope = this;
		var measureTime = false;
		var scopedOnLoad = function () {
			onLoad(
				{
					detail: {
						loaderRootNode: scope.loaderRootNode,
						modelName: scope.modelName,
						instanceNo: scope.instanceNo
					}
				}
			);
			if ( measureTime && scope.logging.enabled ) console.timeEnd( 'OBJLoader2 parseAsync: ' + scope.modelName );
		};
		// fast-fail in case of illegal data
		if ( ! THREE.LoaderSupport.Validator.isValid( content ) ) {

			console.warn( 'Provided content is not a valid ArrayBuffer.' );
			scopedOnLoad()

		} else {

			measureTime = true;

		}
		if ( measureTime && this.logging.enabled ) console.time( 'OBJLoader2 parseAsync: ' + this.modelName );
		this.meshBuilder.init();

		var scopedOnMeshLoaded = function ( payload ) {
			var meshes = scope.meshBuilder.processPayload( payload );
			var mesh;
			for ( var i in meshes ) {
				mesh = meshes[ i ];
				scope.loaderRootNode.add( mesh );
			}
		};
		var buildCode = function ( codeSerializer ) {
			var workerCode = '';
			workerCode += '/**\n';
			workerCode += '  * This code was constructed by OBJLoader2 buildCode.\n';
			workerCode += '  */\n\n';
			workerCode += 'THREE = { LoaderSupport: {}, OBJLoader2: {} };\n\n';
			workerCode += codeSerializer.serializeObject( 'THREE.LoaderSupport.Validator', THREE.LoaderSupport.Validator );
			workerCode += codeSerializer.serializeClass( 'THREE.OBJLoader2.Parser', THREE.OBJLoader2.Parser );

			return workerCode;
		};
		this.workerSupport.validate( buildCode, 'THREE.OBJLoader2.Parser' );
		this.workerSupport.setCallbacks( scopedOnMeshLoaded, scopedOnLoad );
		if ( scope.terminateWorkerOnLoad ) this.workerSupport.setTerminateRequested( true );

		var materialNames = {};
		var materials = this.meshBuilder.getMaterials();
		for ( var materialName in materials ) {

			materialNames[ materialName ] = materialName;

		}
		this.workerSupport.run(
			{
				params: {
					useAsync: true,
					materialPerSmoothingGroup: this.materialPerSmoothingGroup,
					useOAsMesh: this.useOAsMesh,
					useIndices: this.useIndices,
					disregardNormals: this.disregardNormals
				},
				logging: {
					enabled: this.logging.enabled,
					debug: this.logging.debug
				},
				materials: {
					// in async case only material names are supplied to parser
					materials: materialNames
				},
				data: {
					input: content,
					options: null
				}
			}
		);
	},

	/**
	 * Utility method for loading an mtl file according resource description. Provide url or content.
	 *
	 * @param {string} url URL to the file
	 * @param {Object} content The file content as arraybuffer or text
	 * @param {function} onLoad Callback to be called after successful load
	 * @param {callback} [onProgress] A function to be called while the loading is in progress. The argument will be the XMLHttpRequest instance, which contains total and Integer bytes.
	 * @param {callback} [onError] A function to be called if an error occurs during loading. The function receives the error as an argument.
	 * @param {string} [crossOrigin] CORS value
 	 * @param {Object} [materialOptions] Set material loading options for MTLLoader
	 */
	loadMtl: function ( url, content, onLoad, onProgress, onError, crossOrigin, materialOptions ) {
		var resource = new THREE.LoaderSupport.ResourceDescriptor( url, 'MTL' );
		resource.setContent( content );
		this._loadMtl( resource, onLoad, onProgress, onError, crossOrigin, materialOptions );
	},

	_loadMtl: function ( resource, onLoad, onProgress, onError, crossOrigin, materialOptions ) {
		if ( THREE.MTLLoader === undefined ) console.error( '"THREE.MTLLoader" is not available. "THREE.OBJLoader2" requires it for loading MTL files.' );
		if ( THREE.LoaderSupport.Validator.isValid( resource ) && this.logging.enabled ) console.time( 'Loading MTL: ' + resource.name );

		var materials = [];
		var scope = this;
		var processMaterials = function ( materialCreator ) {
			var materialCreatorMaterials = [];
			if ( THREE.LoaderSupport.Validator.isValid( materialCreator ) ) {

				materialCreator.preload();
				materialCreatorMaterials = materialCreator.materials;
				for ( var materialName in materialCreatorMaterials ) {

					if ( materialCreatorMaterials.hasOwnProperty( materialName ) ) {

						materials[ materialName ] = materialCreatorMaterials[ materialName ];

					}
				}
			}

			if ( THREE.LoaderSupport.Validator.isValid( resource ) && scope.logging.enabled ) console.timeEnd( 'Loading MTL: ' + resource.name );
			onLoad( materials, materialCreator );
		};

		// fast-fail
		if ( ! THREE.LoaderSupport.Validator.isValid( resource ) || ( ! THREE.LoaderSupport.Validator.isValid( resource.content ) && ! THREE.LoaderSupport.Validator.isValid( resource.url ) ) ) {

			processMaterials();

		} else {

			var mtlLoader = new THREE.MTLLoader( this.manager );
			crossOrigin = THREE.LoaderSupport.Validator.verifyInput( crossOrigin, 'anonymous' );
			mtlLoader.setCrossOrigin( crossOrigin );
			mtlLoader.setResourcePath( resource.resourcePath || resource.path );
			if ( THREE.LoaderSupport.Validator.isValid( materialOptions ) ) mtlLoader.setMaterialOptions( materialOptions );

			var parseTextWithMtlLoader = function ( content ) {
				var contentAsText = content;
				if ( typeof( content ) !== 'string' && ! ( content instanceof String ) ) {

					if ( content.length > 0 || content.byteLength > 0 ) {

						contentAsText = THREE.LoaderUtils.decodeText( content );

					} else {

						this._throwError( 'Unable to parse mtl as it it seems to be neither a String, an Array or an ArrayBuffer!' );
					}

				}
				processMaterials( mtlLoader.parse( contentAsText ) );
			};

			if ( THREE.LoaderSupport.Validator.isValid( resource.content ) ) {

				parseTextWithMtlLoader( resource.content );

			} else if ( THREE.LoaderSupport.Validator.isValid( resource.url ) ) {

				var fileLoader = new THREE.FileLoader( this.manager );
				if ( ! THREE.LoaderSupport.Validator.isValid( onError ) ) {
					onError = function ( event ) {
						scope._onError( event );
					}
				}
				if ( ! THREE.LoaderSupport.Validator.isValid( onProgress ) ) {
					var numericalValueRef = 0;
					var numericalValue = 0;
					onProgress = function ( event ) {
						if ( ! event.lengthComputable ) return;

						numericalValue = event.loaded / event.total;
						if ( numericalValue > numericalValueRef ) {

							numericalValueRef = numericalValue;
							var output = 'Download of "' + resource.url + '": ' + ( numericalValue * 100 ).toFixed( 2 ) + '%';
							scope.onProgress( 'progressLoad', output, numericalValue );

						}
					};
				}

				fileLoader.load( resource.url, parseTextWithMtlLoader, onProgress, onError );

			}
		}
	}
};


/**
 * Parse OBJ data either from ArrayBuffer or string
 * @class
 */
THREE.OBJLoader2.Parser = function () {
	this.callbackProgress = null;
	this.callbackMeshBuilder = null;
	this.contentRef = null;
	this.legacyMode = false;

	this.materials = {};
	this.useAsync = false;
	this.materialPerSmoothingGroup = false;
	this.useOAsMesh = false;
	this.useIndices = false;
	this.disregardNormals = false;

	this.vertices = [];
	this.colors = [];
	this.normals = [];
	this.uvs = [];

	this.rawMesh = {
		objectName: '',
		groupName: '',
		activeMtlName: '',
		mtllibName: '',

		// reset with new mesh
		faceType: -1,
		subGroups: [],
		subGroupInUse: null,
		smoothingGroup: {
			splitMaterials: false,
			normalized: -1,
			real: -1
		},
		counts: {
			doubleIndicesCount: 0,
			faceCount: 0,
			mtlCount: 0,
			smoothingGroupCount: 0
		}
	};

	this.inputObjectCount = 1;
	this.outputObjectCount = 1;
	this.globalCounts = {
		vertices: 0,
		faces: 0,
		doubleIndicesCount: 0,
		lineByte: 0,
		currentByte: 0,
		totalBytes: 0
	};

	this.logging = {
		enabled: true,
		debug: false
	};
};


THREE.OBJLoader2.Parser.prototype = {

	constructor: THREE.OBJLoader2.Parser,

	resetRawMesh: function () {
		// faces are stored according combined index of group, material and smoothingGroup (0 or not)
		this.rawMesh.subGroups = [];
		this.rawMesh.subGroupInUse = null;
		this.rawMesh.smoothingGroup.normalized = -1;
		this.rawMesh.smoothingGroup.real = -1;

		// this default index is required as it is possible to define faces without 'g' or 'usemtl'
		this.pushSmoothingGroup( 1 );

		this.rawMesh.counts.doubleIndicesCount = 0;
		this.rawMesh.counts.faceCount = 0;
		this.rawMesh.counts.mtlCount = 0;
		this.rawMesh.counts.smoothingGroupCount = 0;
	},

	setUseAsync: function ( useAsync ) {
		this.useAsync = useAsync;
	},

	setMaterialPerSmoothingGroup: function ( materialPerSmoothingGroup ) {
		this.materialPerSmoothingGroup = materialPerSmoothingGroup;
	},

	setUseOAsMesh: function ( useOAsMesh ) {
		this.useOAsMesh = useOAsMesh;
	},

	setUseIndices: function ( useIndices ) {
		this.useIndices = useIndices;
	},

	setDisregardNormals: function ( disregardNormals ) {
		this.disregardNormals = disregardNormals;
	},

	setMaterials: function ( materials ) {
		this.materials = THREE.LoaderSupport.Validator.verifyInput( materials, this.materials );
		this.materials = THREE.LoaderSupport.Validator.verifyInput( this.materials, {} );
	},

	setCallbackMeshBuilder: function ( callbackMeshBuilder ) {
		if ( ! THREE.LoaderSupport.Validator.isValid( callbackMeshBuilder ) ) {

			this._throwError( 'Unable to run as no "MeshBuilder" callback is set.' );

		}
		this.callbackMeshBuilder = callbackMeshBuilder;
	},

	setCallbackProgress: function ( callbackProgress ) {
		this.callbackProgress = callbackProgress;
	},

	setLogging: function ( enabled, debug ) {
		this.logging.enabled = enabled === true;
		this.logging.debug = debug === true;
	},

	configure: function () {
		this.pushSmoothingGroup( 1 );

		if ( this.logging.enabled ) {

			var matKeys = Object.keys( this.materials );
			var matNames = ( matKeys.length > 0 ) ? '\n\tmaterialNames:\n\t\t- ' + matKeys.join( '\n\t\t- ' ) : '\n\tmaterialNames: None';
			var printedConfig = 'OBJLoader2.Parser configuration:'
				+ matNames
				+ '\n\tuseAsync: ' + this.useAsync
				+ '\n\tmaterialPerSmoothingGroup: ' + this.materialPerSmoothingGroup
				+ '\n\tuseOAsMesh: ' + this.useOAsMesh
				+ '\n\tuseIndices: ' + this.useIndices
				+ '\n\tdisregardNormals: ' + this.disregardNormals
				+ '\n\tcallbackMeshBuilderName: ' + this.callbackMeshBuilder.name
				+ '\n\tcallbackProgressName: ' + this.callbackProgress.name;
			console.info( printedConfig );
		}
	},

	/**
	 * Parse the provided arraybuffer
	 *
	 * @param {Uint8Array} arrayBuffer OBJ data as Uint8Array
	 */
	parse: function ( arrayBuffer ) {
		if ( this.logging.enabled ) console.time( 'OBJLoader2.Parser.parse' );
		this.configure();

		var arrayBufferView = new Uint8Array( arrayBuffer );
		this.contentRef = arrayBufferView;
		var length = arrayBufferView.byteLength;
		this.globalCounts.totalBytes = length;
		var buffer = new Array( 128 );

		for ( var code, word = '', bufferPointer = 0, slashesCount = 0, i = 0; i < length; i++ ) {

			code = arrayBufferView[ i ];
			switch ( code ) {
				// space
				case 32:
					if ( word.length > 0 ) buffer[ bufferPointer++ ] = word;
					word = '';
					break;
				// slash
				case 47:
					if ( word.length > 0 ) buffer[ bufferPointer++ ] = word;
					slashesCount++;
					word = '';
					break;

				// LF
				case 10:
					if ( word.length > 0 ) buffer[ bufferPointer++ ] = word;
					word = '';
					this.globalCounts.lineByte = this.globalCounts.currentByte;
					this.globalCounts.currentByte = i;
					this.processLine( buffer, bufferPointer, slashesCount );
					bufferPointer = 0;
					slashesCount = 0;
					break;

				// CR
				case 13:
					break;

				default:
					word += String.fromCharCode( code );
					break;
			}
		}
		this.finalizeParsing();
		if ( this.logging.enabled ) console.timeEnd(  'OBJLoader2.Parser.parse' );
	},

	/**
	 * Parse the provided text
	 *
	 * @param {string} text OBJ data as string
	 */
	parseText: function ( text ) {
		if ( this.logging.enabled ) console.time(  'OBJLoader2.Parser.parseText' );
		this.configure();
		this.legacyMode = true;
		this.contentRef = text;
		var length = text.length;
		this.globalCounts.totalBytes = length;
		var buffer = new Array( 128 );

		for ( var char, word = '', bufferPointer = 0, slashesCount = 0, i = 0; i < length; i++ ) {

			char = text[ i ];
			switch ( char ) {
				case ' ':
					if ( word.length > 0 ) buffer[ bufferPointer++ ] = word;
					word = '';
					break;

				case '/':
					if ( word.length > 0 ) buffer[ bufferPointer++ ] = word;
					slashesCount++;
					word = '';
					break;

				case '\n':
					if ( word.length > 0 ) buffer[ bufferPointer++ ] = word;
					word = '';
					this.globalCounts.lineByte = this.globalCounts.currentByte;
					this.globalCounts.currentByte = i;
					this.processLine( buffer, bufferPointer, slashesCount );
					bufferPointer = 0;
					slashesCount = 0;
					break;

				case '\r':
					break;

				default:
					word += char;
			}
		}
		this.finalizeParsing();
		if ( this.logging.enabled ) console.timeEnd( 'OBJLoader2.Parser.parseText' );
	},

	processLine: function ( buffer, bufferPointer, slashesCount ) {
		if ( bufferPointer < 1 ) return;

		var reconstructString = function ( content, legacyMode, start, stop ) {
			var line = '';
			if ( stop > start ) {

				var i;
				if ( legacyMode ) {

					for ( i = start; i < stop; i++ ) line += content[ i ];

				} else {


					for ( i = start; i < stop; i++ ) line += String.fromCharCode( content[ i ] );

				}
				line = line.trim();

			}
			return line;
		};

		var bufferLength, length, i, lineDesignation;
		lineDesignation = buffer [ 0 ];
		switch ( lineDesignation ) {
			case 'v':
				this.vertices.push( parseFloat( buffer[ 1 ] ) );
				this.vertices.push( parseFloat( buffer[ 2 ] ) );
				this.vertices.push( parseFloat( buffer[ 3 ] ) );
				if ( bufferPointer > 4 ) {

					this.colors.push( parseFloat( buffer[ 4 ] ) );
					this.colors.push( parseFloat( buffer[ 5 ] ) );
					this.colors.push( parseFloat( buffer[ 6 ] ) );

				}
				break;

			case 'vt':
				this.uvs.push( parseFloat( buffer[ 1 ] ) );
				this.uvs.push( parseFloat( buffer[ 2 ] ) );
				break;

			case 'vn':
				this.normals.push( parseFloat( buffer[ 1 ] ) );
				this.normals.push( parseFloat( buffer[ 2 ] ) );
				this.normals.push( parseFloat( buffer[ 3 ] ) );
				break;

			case 'f':
				bufferLength = bufferPointer - 1;

				// "f vertex ..."
				if ( slashesCount === 0 ) {

					this.checkFaceType( 0 );
					for ( i = 2, length = bufferLength; i < length; i ++ ) {

						this.buildFace( buffer[ 1 ] );
						this.buildFace( buffer[ i ] );
						this.buildFace( buffer[ i + 1 ] );

					}

					// "f vertex/uv ..."
				} else if  ( bufferLength === slashesCount * 2 ) {

					this.checkFaceType( 1 );
					for ( i = 3, length = bufferLength - 2; i < length; i += 2 ) {

						this.buildFace( buffer[ 1 ], buffer[ 2 ] );
						this.buildFace( buffer[ i ], buffer[ i + 1 ] );
						this.buildFace( buffer[ i + 2 ], buffer[ i + 3 ] );

					}

					// "f vertex/uv/normal ..."
				} else if  ( bufferLength * 2 === slashesCount * 3 ) {

					this.checkFaceType( 2 );
					for ( i = 4, length = bufferLength - 3; i < length; i += 3 ) {

						this.buildFace( buffer[ 1 ], buffer[ 2 ], buffer[ 3 ] );
						this.buildFace( buffer[ i ], buffer[ i + 1 ], buffer[ i + 2 ] );
						this.buildFace( buffer[ i + 3 ], buffer[ i + 4 ], buffer[ i + 5 ] );

					}

					// "f vertex//normal ..."
				} else {

					this.checkFaceType( 3 );
					for ( i = 3, length = bufferLength - 2; i < length; i += 2 ) {

						this.buildFace( buffer[ 1 ], undefined, buffer[ 2 ] );
						this.buildFace( buffer[ i ], undefined, buffer[ i + 1 ] );
						this.buildFace( buffer[ i + 2 ], undefined, buffer[ i + 3 ] );

					}

				}
				break;

			case 'l':
			case 'p':
				bufferLength = bufferPointer - 1;
				if ( bufferLength === slashesCount * 2 )  {

					this.checkFaceType( 4 );
					for ( i = 1, length = bufferLength + 1; i < length; i += 2 ) this.buildFace( buffer[ i ], buffer[ i + 1 ] );

				} else {

					this.checkFaceType( ( lineDesignation === 'l' ) ? 5 : 6  );
					for ( i = 1, length = bufferLength + 1; i < length; i ++ ) this.buildFace( buffer[ i ] );

				}
				break;

			case 's':
				this.pushSmoothingGroup( buffer[ 1 ] );
				break;

			case 'g':
				// 'g' leads to creation of mesh if valid data (faces declaration was done before), otherwise only groupName gets set
				this.processCompletedMesh();
				this.rawMesh.groupName = reconstructString( this.contentRef, this.legacyMode, this.globalCounts.lineByte + 2, this.globalCounts.currentByte );
				break;

			case 'o':
				// 'o' is meta-information and usually does not result in creation of new meshes, but can be enforced with "useOAsMesh"
				if ( this.useOAsMesh ) this.processCompletedMesh();
				this.rawMesh.objectName = reconstructString( this.contentRef, this.legacyMode, this.globalCounts.lineByte + 2, this.globalCounts.currentByte );
				break;

			case 'mtllib':
				this.rawMesh.mtllibName = reconstructString( this.contentRef, this.legacyMode, this.globalCounts.lineByte + 7, this.globalCounts.currentByte );
				break;

			case 'usemtl':
				var mtlName = reconstructString( this.contentRef, this.legacyMode, this.globalCounts.lineByte + 7, this.globalCounts.currentByte );
				if ( mtlName !== '' && this.rawMesh.activeMtlName !== mtlName ) {

					this.rawMesh.activeMtlName = mtlName;
					this.rawMesh.counts.mtlCount++;
					this.checkSubGroup();

				}
				break;

			default:
				break;
		}
	},

	pushSmoothingGroup: function ( smoothingGroup ) {
		var smoothingGroupInt = parseInt( smoothingGroup );
		if ( isNaN( smoothingGroupInt ) ) {
			smoothingGroupInt = smoothingGroup === "off" ? 0 : 1;
		}

		var smoothCheck = this.rawMesh.smoothingGroup.normalized;
		this.rawMesh.smoothingGroup.normalized = this.rawMesh.smoothingGroup.splitMaterials ? smoothingGroupInt : ( smoothingGroupInt === 0 ) ? 0 : 1;
		this.rawMesh.smoothingGroup.real = smoothingGroupInt;

		if ( smoothCheck !== smoothingGroupInt ) {

			this.rawMesh.counts.smoothingGroupCount++;
			this.checkSubGroup();

		}
	},

	/**
	 * Expanded faceTypes include all four face types, both line types and the point type
	 * faceType = 0: "f vertex ..."
	 * faceType = 1: "f vertex/uv ..."
	 * faceType = 2: "f vertex/uv/normal ..."
	 * faceType = 3: "f vertex//normal ..."
	 * faceType = 4: "l vertex/uv ..." or "l vertex ..."
	 * faceType = 5: "l vertex ..."
	 * faceType = 6: "p vertex ..."
	 */
	checkFaceType: function ( faceType ) {
		if ( this.rawMesh.faceType !== faceType ) {

			this.processCompletedMesh();
			this.rawMesh.faceType = faceType;
			this.checkSubGroup();

		}
	},

	checkSubGroup: function () {
		var index = this.rawMesh.activeMtlName + '|' + this.rawMesh.smoothingGroup.normalized;
		this.rawMesh.subGroupInUse = this.rawMesh.subGroups[ index ];

		if ( ! THREE.LoaderSupport.Validator.isValid( this.rawMesh.subGroupInUse ) ) {

			this.rawMesh.subGroupInUse = {
				index: index,
				objectName: this.rawMesh.objectName,
				groupName: this.rawMesh.groupName,
				materialName: this.rawMesh.activeMtlName,
				smoothingGroup: this.rawMesh.smoothingGroup.normalized,
				vertices: [],
				indexMappingsCount: 0,
				indexMappings: [],
				indices: [],
				colors: [],
				uvs: [],
				normals: []
			};
			this.rawMesh.subGroups[ index ] = this.rawMesh.subGroupInUse;

		}
	},

	buildFace: function ( faceIndexV, faceIndexU, faceIndexN ) {
		if ( this.disregardNormals ) faceIndexN = undefined;
		var scope = this;
		var updateSubGroupInUse = function () {

			var faceIndexVi = parseInt( faceIndexV );
			var indexPointerV = 3 * ( faceIndexVi > 0 ? faceIndexVi - 1 : faceIndexVi + scope.vertices.length / 3 );
			var indexPointerC = scope.colors.length > 0 ? indexPointerV : null;

			var vertices = scope.rawMesh.subGroupInUse.vertices;
			vertices.push( scope.vertices[ indexPointerV++ ] );
			vertices.push( scope.vertices[ indexPointerV++ ] );
			vertices.push( scope.vertices[ indexPointerV ] );

			if ( indexPointerC !== null ) {

				var colors = scope.rawMesh.subGroupInUse.colors;
				colors.push( scope.colors[ indexPointerC++ ] );
				colors.push( scope.colors[ indexPointerC++ ] );
				colors.push( scope.colors[ indexPointerC ] );

			}
			if ( faceIndexU ) {

				var faceIndexUi = parseInt( faceIndexU );
				var indexPointerU = 2 * ( faceIndexUi > 0 ? faceIndexUi - 1 : faceIndexUi + scope.uvs.length / 2 );
				var uvs = scope.rawMesh.subGroupInUse.uvs;
				uvs.push( scope.uvs[ indexPointerU++ ] );
				uvs.push( scope.uvs[ indexPointerU ] );

			}
			if ( faceIndexN ) {

				var faceIndexNi = parseInt( faceIndexN );
				var indexPointerN = 3 * ( faceIndexNi > 0 ? faceIndexNi - 1 : faceIndexNi + scope.normals.length / 3 );
				var normals = scope.rawMesh.subGroupInUse.normals;
				normals.push( scope.normals[ indexPointerN++ ] );
				normals.push( scope.normals[ indexPointerN++ ] );
				normals.push( scope.normals[ indexPointerN ] );

			}
		};

		if ( this.useIndices ) {

			var mappingName = faceIndexV + ( faceIndexU ? '_' + faceIndexU : '_n' ) + ( faceIndexN ? '_' + faceIndexN : '_n' );
			var indicesPointer = this.rawMesh.subGroupInUse.indexMappings[ mappingName ];
			if ( THREE.LoaderSupport.Validator.isValid( indicesPointer ) ) {

				this.rawMesh.counts.doubleIndicesCount++;

			} else {

				indicesPointer = this.rawMesh.subGroupInUse.vertices.length / 3;
				updateSubGroupInUse();
				this.rawMesh.subGroupInUse.indexMappings[ mappingName ] = indicesPointer;
				this.rawMesh.subGroupInUse.indexMappingsCount++;

			}
			this.rawMesh.subGroupInUse.indices.push( indicesPointer );

		} else {

			updateSubGroupInUse();

		}
		this.rawMesh.counts.faceCount++;
	},

	createRawMeshReport: function ( inputObjectCount ) {
		return 'Input Object number: ' + inputObjectCount +
			'\n\tObject name: ' + this.rawMesh.objectName +
			'\n\tGroup name: ' + this.rawMesh.groupName +
			'\n\tMtllib name: ' + this.rawMesh.mtllibName +
			'\n\tVertex count: ' + this.vertices.length / 3 +
			'\n\tNormal count: ' + this.normals.length / 3 +
			'\n\tUV count: ' + this.uvs.length / 2 +
			'\n\tSmoothingGroup count: ' + this.rawMesh.counts.smoothingGroupCount +
			'\n\tMaterial count: ' + this.rawMesh.counts.mtlCount +
			'\n\tReal MeshOutputGroup count: ' + this.rawMesh.subGroups.length;
	},

	/**
	 * Clear any empty subGroup and calculate absolute vertex, normal and uv counts
	 */
	finalizeRawMesh: function () {
		var meshOutputGroupTemp = [];
		var meshOutputGroup;
		var absoluteVertexCount = 0;
		var absoluteIndexMappingsCount = 0;
		var absoluteIndexCount = 0;
		var absoluteColorCount = 0;
		var absoluteNormalCount = 0;
		var absoluteUvCount = 0;
		var indices;
		for ( var name in this.rawMesh.subGroups ) {

			meshOutputGroup = this.rawMesh.subGroups[ name ];
			if ( meshOutputGroup.vertices.length > 0 ) {

				indices = meshOutputGroup.indices;
				if ( indices.length > 0 && absoluteIndexMappingsCount > 0 ) {

					for ( var i in indices ) indices[ i ] = indices[ i ] + absoluteIndexMappingsCount;

				}
				meshOutputGroupTemp.push( meshOutputGroup );
				absoluteVertexCount += meshOutputGroup.vertices.length;
				absoluteIndexMappingsCount += meshOutputGroup.indexMappingsCount;
				absoluteIndexCount += meshOutputGroup.indices.length;
				absoluteColorCount += meshOutputGroup.colors.length;
				absoluteUvCount += meshOutputGroup.uvs.length;
				absoluteNormalCount += meshOutputGroup.normals.length;

			}
		}

		// do not continue if no result
		var result = null;
		if ( meshOutputGroupTemp.length > 0 ) {

			result = {
				name: this.rawMesh.groupName !== '' ? this.rawMesh.groupName : this.rawMesh.objectName,
				subGroups: meshOutputGroupTemp,
				absoluteVertexCount: absoluteVertexCount,
				absoluteIndexCount: absoluteIndexCount,
				absoluteColorCount: absoluteColorCount,
				absoluteNormalCount: absoluteNormalCount,
				absoluteUvCount: absoluteUvCount,
				faceCount: this.rawMesh.counts.faceCount,
				doubleIndicesCount: this.rawMesh.counts.doubleIndicesCount
			};

		}
		return result;
	},

	processCompletedMesh: function () {
		var result = this.finalizeRawMesh();
		if ( THREE.LoaderSupport.Validator.isValid( result ) ) {

			if ( this.colors.length > 0 && this.colors.length !== this.vertices.length ) {

				this._throwError( 'Vertex Colors were detected, but vertex count and color count do not match!' );

			}
			if ( this.logging.enabled && this.logging.debug ) console.debug( this.createRawMeshReport( this.inputObjectCount ) );
			this.inputObjectCount++;

			this.buildMesh( result );
			var progressBytesPercent = this.globalCounts.currentByte / this.globalCounts.totalBytes;
			this.callbackProgress( 'Completed [o: ' + this.rawMesh.objectName + ' g:' + this.rawMesh.groupName + '] Total progress: ' + ( progressBytesPercent * 100 ).toFixed( 2 ) + '%', progressBytesPercent );
			this.resetRawMesh();
			return true;

		} else {

			return false;
		}
	},

	/**
	 * SubGroups are transformed to too intermediate format that is forwarded to the MeshBuilder.
	 * It is ensured that SubGroups only contain objects with vertices (no need to check).
	 *
	 * @param result
	 */
	buildMesh: function ( result ) {
		var meshOutputGroups = result.subGroups;

		var vertexFA = new Float32Array( result.absoluteVertexCount );
		this.globalCounts.vertices += result.absoluteVertexCount / 3;
		this.globalCounts.faces += result.faceCount;
		this.globalCounts.doubleIndicesCount += result.doubleIndicesCount;
		var indexUA = ( result.absoluteIndexCount > 0 ) ? new Uint32Array( result.absoluteIndexCount ) : null;
		var colorFA = ( result.absoluteColorCount > 0 ) ? new Float32Array( result.absoluteColorCount ) : null;
		var normalFA = ( result.absoluteNormalCount > 0 ) ? new Float32Array( result.absoluteNormalCount ) : null;
		var uvFA = ( result.absoluteUvCount > 0 ) ? new Float32Array( result.absoluteUvCount ) : null;
		var haveVertexColors = THREE.LoaderSupport.Validator.isValid( colorFA );

		var meshOutputGroup;
		var materialNames = [];

		var createMultiMaterial = ( meshOutputGroups.length > 1 );
		var materialIndex = 0;
		var materialIndexMapping = [];
		var selectedMaterialIndex;
		var materialGroup;
		var materialGroups = [];

		var vertexFAOffset = 0;
		var indexUAOffset = 0;
		var colorFAOffset = 0;
		var normalFAOffset = 0;
		var uvFAOffset = 0;
		var materialGroupOffset = 0;
		var materialGroupLength = 0;

		var materialOrg, material, materialName, materialNameOrg;
		// only one specific face type
		for ( var oodIndex in meshOutputGroups ) {

			if ( ! meshOutputGroups.hasOwnProperty( oodIndex ) ) continue;
			meshOutputGroup = meshOutputGroups[ oodIndex ];

			materialNameOrg = meshOutputGroup.materialName;
			if ( this.rawMesh.faceType < 4 ) {

				materialName = materialNameOrg + ( haveVertexColors ? '_vertexColor' : '' ) + ( meshOutputGroup.smoothingGroup === 0 ? '_flat' : '' );


			} else {

				materialName = this.rawMesh.faceType === 6 ? 'defaultPointMaterial' : 'defaultLineMaterial';

			}
			materialOrg = this.materials[ materialNameOrg ];
			material = this.materials[ materialName ];

			// both original and derived names do not lead to an existing material => need to use a default material
			if ( ! THREE.LoaderSupport.Validator.isValid( materialOrg ) && ! THREE.LoaderSupport.Validator.isValid( material ) ) {

				var defaultMaterialName = haveVertexColors ? 'defaultVertexColorMaterial' : 'defaultMaterial';
				materialOrg = this.materials[ defaultMaterialName ];
				if ( this.logging.enabled ) console.warn( 'object_group "' + meshOutputGroup.objectName + '_' +
					meshOutputGroup.groupName + '" was defined with unresolvable material "' +
					materialNameOrg + '"! Assigning "' + defaultMaterialName + '".' );
				materialNameOrg = defaultMaterialName;

				// if names are identical then there is no need for later manipulation
				if ( materialNameOrg === materialName ) {

					material = materialOrg;
					materialName = defaultMaterialName;

				}

			}
			if ( ! THREE.LoaderSupport.Validator.isValid( material ) ) {

				var materialCloneInstructions = {
					materialNameOrg: materialNameOrg,
					materialName: materialName,
					materialProperties: {
						vertexColors: haveVertexColors ? 2 : 0,
						flatShading: meshOutputGroup.smoothingGroup === 0
					}
				};
				var payload = {
					cmd: 'materialData',
					materials: {
						materialCloneInstructions: materialCloneInstructions
					}
				};
				this.callbackMeshBuilder( payload );

				// fake entry for async; sync Parser always works on material references (Builder update directly visible here)
				if ( this.useAsync ) this.materials[ materialName ] = materialCloneInstructions;

			}

			if ( createMultiMaterial ) {

				// re-use material if already used before. Reduces materials array size and eliminates duplicates
				selectedMaterialIndex = materialIndexMapping[ materialName ];
				if ( ! selectedMaterialIndex ) {

					selectedMaterialIndex = materialIndex;
					materialIndexMapping[ materialName ] = materialIndex;
					materialNames.push( materialName );
					materialIndex++;

				}
				materialGroupLength = this.useIndices ? meshOutputGroup.indices.length : meshOutputGroup.vertices.length / 3;
				materialGroup = {
					start: materialGroupOffset,
					count: materialGroupLength,
					index: selectedMaterialIndex
				};
				materialGroups.push( materialGroup );
				materialGroupOffset += materialGroupLength;

			} else {

				materialNames.push( materialName );

			}

			vertexFA.set( meshOutputGroup.vertices, vertexFAOffset );
			vertexFAOffset += meshOutputGroup.vertices.length;

			if ( indexUA ) {

				indexUA.set( meshOutputGroup.indices, indexUAOffset );
				indexUAOffset += meshOutputGroup.indices.length;

			}

			if ( colorFA ) {

				colorFA.set( meshOutputGroup.colors, colorFAOffset );
				colorFAOffset += meshOutputGroup.colors.length;

			}

			if ( normalFA ) {

				normalFA.set( meshOutputGroup.normals, normalFAOffset );
				normalFAOffset += meshOutputGroup.normals.length;

			}
			if ( uvFA ) {

				uvFA.set( meshOutputGroup.uvs, uvFAOffset );
				uvFAOffset += meshOutputGroup.uvs.length;

			}

			if ( this.logging.enabled && this.logging.debug ) {
				var materialIndexLine = THREE.LoaderSupport.Validator.isValid( selectedMaterialIndex ) ? '\n\t\tmaterialIndex: ' + selectedMaterialIndex : '';
				var createdReport = '\tOutput Object no.: ' + this.outputObjectCount +
					'\n\t\tgroupName: ' + meshOutputGroup.groupName +
					'\n\t\tIndex: ' + meshOutputGroup.index +
					'\n\t\tfaceType: ' + this.rawMesh.faceType +
					'\n\t\tmaterialName: ' + meshOutputGroup.materialName +
					'\n\t\tsmoothingGroup: ' + meshOutputGroup.smoothingGroup +
					materialIndexLine +
					'\n\t\tobjectName: ' + meshOutputGroup.objectName +
					'\n\t\t#vertices: ' + meshOutputGroup.vertices.length / 3 +
					'\n\t\t#indices: ' + meshOutputGroup.indices.length +
					'\n\t\t#colors: ' + meshOutputGroup.colors.length / 3 +
					'\n\t\t#uvs: ' + meshOutputGroup.uvs.length / 2 +
					'\n\t\t#normals: ' + meshOutputGroup.normals.length / 3;
				console.debug( createdReport );
			}

		}

		this.outputObjectCount++;
		this.callbackMeshBuilder(
			{
				cmd: 'meshData',
				progress: {
					numericalValue: this.globalCounts.currentByte / this.globalCounts.totalBytes
				},
				params: {
					meshName: result.name
				},
				materials: {
					multiMaterial: createMultiMaterial,
					materialNames: materialNames,
					materialGroups: materialGroups
				},
				buffers: {
					vertices: vertexFA,
					indices: indexUA,
					colors: colorFA,
					normals: normalFA,
					uvs: uvFA
				},
				// 0: mesh, 1: line, 2: point
				geometryType: this.rawMesh.faceType < 4 ? 0 : ( this.rawMesh.faceType === 6 ) ? 2 : 1
			},
			[ vertexFA.buffer ],
			THREE.LoaderSupport.Validator.isValid( indexUA ) ? [ indexUA.buffer ] : null,
			THREE.LoaderSupport.Validator.isValid( colorFA ) ? [ colorFA.buffer ] : null,
			THREE.LoaderSupport.Validator.isValid( normalFA ) ? [ normalFA.buffer ] : null,
			THREE.LoaderSupport.Validator.isValid( uvFA ) ? [ uvFA.buffer ] : null
		);
	},

	finalizeParsing: function () {
		if ( this.logging.enabled ) console.info( 'Global output object count: ' + this.outputObjectCount );
		if ( this.processCompletedMesh() && this.logging.enabled ) {

			var parserFinalReport = 'Overall counts: ' +
				'\n\tVertices: ' + this.globalCounts.vertices +
				'\n\tFaces: ' + this.globalCounts.faces +
				'\n\tMultiple definitions: ' + this.globalCounts.doubleIndicesCount;
			console.info( parserFinalReport );

		}
	}
};

 return THREE.OBJLoader2;
});
/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define('OBJLoader',["three", "vendor/three/loaders/OBJLoader2", "lodash"], function( THREE, OBJLoader2, _ ){
    var OBJLoader = function ( manager, logger )
    { 
        OBJLoader2.call( this, manager, logger );
    };

    OBJLoader.prototype = _.create( OBJLoader2.prototype, {
        constructor : OBJLoader,
        
        load : function( url, onLoad, onProgress, onError )
        {
            onLoad = onLoad || function(){};
            if( url === null || url === undefined || url === "" ) {
                onLoad( null );
            };
            var scope = this;

            var path = scope.path === undefined ? THREE.LoaderUtils.extractUrlBase( url ) : scope.path;

            require(["text!" + url], function ( responseText ) {
                var fnc = onLoad || function(){};
                fnc ( scope.parse( responseText, path ) );
            }, onError);
        }
        
    });

    return OBJLoader;
});


define('vendor/three/loaders/MTLLoader',["three"], function(THREE){
/**
 * Loads a Wavefront .mtl file specifying materials
 *
 * @author angelxuanchang
 */

THREE.MTLLoader = function ( manager ) {

	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

};

THREE.MTLLoader.prototype = {

	constructor: THREE.MTLLoader,

	/**
	 * Loads and parses a MTL asset from a URL.
	 *
	 * @param {String} url - URL to the MTL file.
	 * @param {Function} [onLoad] - Callback invoked with the loaded object.
	 * @param {Function} [onProgress] - Callback for download progress.
	 * @param {Function} [onError] - Callback for download errors.
	 *
	 * @see setPath setResourcePath
	 *
	 * @note In order for relative texture references to resolve correctly
	 * you must call setResourcePath() explicitly prior to load.
	 */
	load: function ( url, onLoad, onProgress, onError ) {

		var scope = this;

		var path = ( this.path === undefined ) ? THREE.LoaderUtils.extractUrlBase( url ) : this.path;

		var loader = new THREE.FileLoader( this.manager );
		loader.setPath( this.path );
		loader.load( url, function ( text ) {

			onLoad( scope.parse( text, path ) );

		}, onProgress, onError );

	},

	/**
	 * Set base path for resolving references.
	 * If set this path will be prepended to each loaded and found reference.
	 *
	 * @see setResourcePath
	 * @param {String} path
	 * @return {THREE.MTLLoader}
	 *
	 * @example
	 *     mtlLoader.setPath( 'assets/obj/' );
	 *     mtlLoader.load( 'my.mtl', ... );
	 */
	setPath: function ( path ) {

		this.path = path;
		return this;

	},

	/**
	 * Set base path for additional resources like textures.
	 *
	 * @see setPath
	 * @param {String} path
	 * @return {THREE.MTLLoader}
	 *
	 * @example
	 *     mtlLoader.setPath( 'assets/obj/' );
	 *     mtlLoader.setResourcePath( 'assets/textures/' );
	 *     mtlLoader.load( 'my.mtl', ... );
	 */
	setResourcePath: function ( path ) {

		this.resourcePath = path;
		return this;

	},

	setTexturePath: function ( path ) {

		console.warn( 'THREE.MTLLoader: .setTexturePath() has been renamed to .setResourcePath().' );
		return this.setResourcePath( path );

	},

	setCrossOrigin: function ( value ) {

		this.crossOrigin = value;
		return this;

	},

	setMaterialOptions: function ( value ) {

		this.materialOptions = value;
		return this;

	},

	/**
	 * Parses a MTL file.
	 *
	 * @param {String} text - Content of MTL file
	 * @return {THREE.MTLLoader.MaterialCreator}
	 *
	 * @see setPath setResourcePath
	 *
	 * @note In order for relative texture references to resolve correctly
	 * you must call setResourcePath() explicitly prior to parse.
	 */
	parse: function ( text, path ) {

		var lines = text.split( '\n' );
		var info = {};
		var delimiter_pattern = /\s+/;
		var materialsInfo = {};

		for ( var i = 0; i < lines.length; i ++ ) {

			var line = lines[ i ];
			line = line.trim();

			if ( line.length === 0 || line.charAt( 0 ) === '#' ) {

				// Blank line or comment ignore
				continue;

			}

			var pos = line.indexOf( ' ' );

			var key = ( pos >= 0 ) ? line.substring( 0, pos ) : line;
			key = key.toLowerCase();

			var value = ( pos >= 0 ) ? line.substring( pos + 1 ) : '';
			value = value.trim();

			if ( key === 'newmtl' ) {

				// New material

				info = { name: value };
				materialsInfo[ value ] = info;

			} else {

				if ( key === 'ka' || key === 'kd' || key === 'ks' || key ==='ke' ) {

					var ss = value.split( delimiter_pattern, 3 );
					info[ key ] = [ parseFloat( ss[ 0 ] ), parseFloat( ss[ 1 ] ), parseFloat( ss[ 2 ] ) ];

				} else {

					info[ key ] = value;

				}

			}

		}

		var materialCreator = new THREE.MTLLoader.MaterialCreator( this.resourcePath || path, this.materialOptions );
		materialCreator.setCrossOrigin( this.crossOrigin );
		materialCreator.setManager( this.manager );
		materialCreator.setMaterials( materialsInfo );
		return materialCreator;

	}

};

/**
 * Create a new THREE-MTLLoader.MaterialCreator
 * @param baseUrl - Url relative to which textures are loaded
 * @param options - Set of options on how to construct the materials
 *                  side: Which side to apply the material
 *                        THREE.FrontSide (default), THREE.BackSide, THREE.DoubleSide
 *                  wrap: What type of wrapping to apply for textures
 *                        THREE.RepeatWrapping (default), THREE.ClampToEdgeWrapping, THREE.MirroredRepeatWrapping
 *                  normalizeRGB: RGBs need to be normalized to 0-1 from 0-255
 *                                Default: false, assumed to be already normalized
 *                  ignoreZeroRGBs: Ignore values of RGBs (Ka,Kd,Ks) that are all 0's
 *                                  Default: false
 * @constructor
 */

THREE.MTLLoader.MaterialCreator = function ( baseUrl, options ) {

	this.baseUrl = baseUrl || '';
	this.options = options;
	this.materialsInfo = {};
	this.materials = {};
	this.materialsArray = [];
	this.nameLookup = {};

	this.side = ( this.options && this.options.side ) ? this.options.side : THREE.FrontSide;
	this.wrap = ( this.options && this.options.wrap ) ? this.options.wrap : THREE.RepeatWrapping;

};

THREE.MTLLoader.MaterialCreator.prototype = {

	constructor: THREE.MTLLoader.MaterialCreator,

	crossOrigin: 'anonymous',

	setCrossOrigin: function ( value ) {

		this.crossOrigin = value;
		return this;

	},

	setManager: function ( value ) {

		this.manager = value;

	},

	setMaterials: function ( materialsInfo ) {

		this.materialsInfo = this.convert( materialsInfo );
		this.materials = {};
		this.materialsArray = [];
		this.nameLookup = {};

	},

	convert: function ( materialsInfo ) {

		if ( ! this.options ) return materialsInfo;

		var converted = {};

		for ( var mn in materialsInfo ) {

			// Convert materials info into normalized form based on options

			var mat = materialsInfo[ mn ];

			var covmat = {};

			converted[ mn ] = covmat;

			for ( var prop in mat ) {

				var save = true;
				var value = mat[ prop ];
				var lprop = prop.toLowerCase();

				switch ( lprop ) {

					case 'kd':
					case 'ka':
					case 'ks':

						// Diffuse color (color under white light) using RGB values

						if ( this.options && this.options.normalizeRGB ) {

							value = [ value[ 0 ] / 255, value[ 1 ] / 255, value[ 2 ] / 255 ];

						}

						if ( this.options && this.options.ignoreZeroRGBs ) {

							if ( value[ 0 ] === 0 && value[ 1 ] === 0 && value[ 2 ] === 0 ) {

								// ignore

								save = false;

							}

						}

						break;

					default:

						break;

				}

				if ( save ) {

					covmat[ lprop ] = value;

				}

			}

		}

		return converted;

	},

	preload: function () {

		for ( var mn in this.materialsInfo ) {

			this.create( mn );

		}

	},

	getIndex: function ( materialName ) {

		return this.nameLookup[ materialName ];

	},

	getAsArray: function () {

		var index = 0;

		for ( var mn in this.materialsInfo ) {

			this.materialsArray[ index ] = this.create( mn );
			this.nameLookup[ mn ] = index;
			index ++;

		}

		return this.materialsArray;

	},

	create: function ( materialName ) {

		if ( this.materials[ materialName ] === undefined ) {

			this.createMaterial_( materialName );

		}

		return this.materials[ materialName ];

	},

	createMaterial_: function ( materialName ) {

		// Create material

		var scope = this;
		var mat = this.materialsInfo[ materialName ];
		var params = {

			name: materialName,
			side: this.side

		};

		function resolveURL( baseUrl, url ) {

			if ( typeof url !== 'string' || url === '' )
				return '';

			// Absolute URL
			if ( /^https?:\/\//i.test( url ) ) return url;

			return baseUrl + url;

		}

		function setMapForType( mapType, value ) {

			if ( params[ mapType ] ) return; // Keep the first encountered texture

			var texParams = scope.getTextureParams( value, params );
			var map = scope.loadTexture( resolveURL( scope.baseUrl, texParams.url ) );

			map.repeat.copy( texParams.scale );
			map.offset.copy( texParams.offset );

			map.wrapS = scope.wrap;
			map.wrapT = scope.wrap;

			params[ mapType ] = map;

		}

		for ( var prop in mat ) {

			var value = mat[ prop ];
			var n;

			if ( value === '' ) continue;

			switch ( prop.toLowerCase() ) {

				// Ns is material specular exponent

				case 'kd':

					// Diffuse color (color under white light) using RGB values

					params.color = new THREE.Color().fromArray( value );

					break;

				case 'ks':

					// Specular color (color when light is reflected from shiny surface) using RGB values
					params.specular = new THREE.Color().fromArray( value );

					break;

				case 'ke':

					// Emissive using RGB values
					params.emissive = new THREE.Color().fromArray( value );

					break;

				case 'map_kd':

					// Diffuse texture map

					setMapForType( "map", value );

					break;

				case 'map_ks':

					// Specular map

					setMapForType( "specularMap", value );

					break;

				case 'map_ke':

					// Emissive map

					setMapForType( "emissiveMap", value );

					break;

				case 'norm':

					setMapForType( "normalMap", value );

					break;

				case 'map_bump':
				case 'bump':

					// Bump texture map

					setMapForType( "bumpMap", value );

					break;

				case 'map_d':

					// Alpha map

					setMapForType( "alphaMap", value );
					params.transparent = true;

					break;

				case 'ns':

					// The specular exponent (defines the focus of the specular highlight)
					// A high exponent results in a tight, concentrated highlight. Ns values normally range from 0 to 1000.

					params.shininess = parseFloat( value );

					break;

				case 'd':
					n = parseFloat( value );

					if ( n < 1 ) {

						params.opacity = n;
						params.transparent = true;

					}

					break;

				case 'tr':
					n = parseFloat( value );

					if ( this.options && this.options.invertTrProperty ) n = 1 - n;

					if ( n > 0 ) {

						params.opacity = 1 - n;
						params.transparent = true;

					}

					break;

				default:
					break;

			}

		}

		this.materials[ materialName ] = new THREE.MeshPhongMaterial( params );
		return this.materials[ materialName ];

	},

	getTextureParams: function ( value, matParams ) {

		var texParams = {

			scale: new THREE.Vector2( 1, 1 ),
			offset: new THREE.Vector2( 0, 0 )

		 };

		var items = value.split( /\s+/ );
		var pos;

		pos = items.indexOf( '-bm' );

		if ( pos >= 0 ) {

			matParams.bumpScale = parseFloat( items[ pos + 1 ] );
			items.splice( pos, 2 );

		}

		pos = items.indexOf( '-s' );

		if ( pos >= 0 ) {

			texParams.scale.set( parseFloat( items[ pos + 1 ] ), parseFloat( items[ pos + 2 ] ) );
			items.splice( pos, 4 ); // we expect 3 parameters here!

		}

		pos = items.indexOf( '-o' );

		if ( pos >= 0 ) {

			texParams.offset.set( parseFloat( items[ pos + 1 ] ), parseFloat( items[ pos + 2 ] ) );
			items.splice( pos, 4 ); // we expect 3 parameters here!

		}

		texParams.url = items.join( ' ' ).trim();
		return texParams;

	},

	loadTexture: function ( url, mapping, onLoad, onProgress, onError ) {

		var texture;
		var loader = THREE.Loader.Handlers.get( url );
		var manager = ( this.manager !== undefined ) ? this.manager : THREE.DefaultLoadingManager;

		if ( loader === null ) {

			loader = new THREE.TextureLoader( manager );

		}

		if ( loader.setCrossOrigin ) loader.setCrossOrigin( this.crossOrigin );
		texture = loader.load( url, onLoad, onProgress, onError );

		if ( mapping !== undefined ) texture.mapping = mapping;

		return texture;

	}

};

 return THREE.MTLLoader;
});
/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define('MTLLoader',["three", "vendor/three/loaders/MTLLoader", "lodash"], function( THREE, ThreeMTLLoader, _ ){
    var MTLLoader = function ( manager, logger )
    { 
        ThreeMTLLoader.call( this, manager, logger );
    };

    MTLLoader.prototype = _.create( ThreeMTLLoader.prototype, {
        constructor : MTLLoader,
        
        load : function(url, onLoad, onProgress, onError)
        {
            onLoad = onLoad || function(){};
            if( url === null || url === undefined || url === "" ) {
                onLoad( null );
            };
            var scope = this;

            var path = scope.path === undefined ? THREE.LoaderUtils.extractUrlBase( url ) : scope.path;

            require(["text!" + url], function ( responseText ) {
                var fnc = onLoad || function(){};
                fnc ( scope.parse( responseText, path ) );
            }, onError);
        }
        
    });

    return MTLLoader;
});


define('OBJMTLLoader',["lodash", "OBJLoader", "MTLLoader", "url"], function( _, OBJLoader, MTLLoader, URL ) {
    
    let defaults = {
        rootPath : ""
    };
    
    let OBJMTLLoader = function ( opts )
    {
        this.parser = {
            mtl: new MTLLoader( ),
            obj: new OBJLoader( )
        };
        
        this.options = _.extend( {}, defaults, opts );
        
        this.parser.mtl.crossOrigin = "anonymous";
        this.options.rootPath = URL.currentScriptURL();
    };

    OBJMTLLoader.prototype.load = function( url, mtl, onReady, onError )
    {
        let callback = onReady || function(){};
        
        if( url === null || url === undefined || url === "" ||
            mtl === null || mtl === undefined || mtl === "") {
            console.error("ERROR OBJMTLLoader: url and mtl needed");
            callBack( null );
        }

        var mtlLoader = this.parser.mtl;
        let path = this.options.rootPath + mtl.substring( 0, mtl.lastIndexOf("/") ) + "/";
        mtlLoader.setPath( path );
        mtlLoader.setResourcePath( path );
        
        let objLoader = this.parser.obj;
        objLoader.setPath( url.substring(0, url.lastIndexOf("/")) + "/" );

        require(["text!" + mtl], function ( responseText ) {
            let materials = mtlLoader.parse( responseText );
            materials.preload();
            
            require(["text!" + url], function ( responseText ) {
                objLoader.setMaterials( materials.materials );
                var obj = objLoader.parse( responseText );
                callback( obj );
            }.bind(this), onError);

        }.bind(this), onError);
    };

    return OBJMTLLoader;
});

/**
* @author:			macrocom by Richard Herrmann
* @last modified:	2015-06-17
*/
define('X3DLoader',["jquery", "three"], function( $, THREE ){

THREE.X3DLoader = function () {

    // some constants
    const DIFFUSE = 0 ;
    const SPECULAR = 1 ;

    const CYLINDER = 2;
    const TRIANGLE = 3 ;

    const NOEXIST = -1 ;     // in parseIndexedFaceSet

    // options: public properties, may be used to communicate with the renderer too
    var options = {
        backgroundColor: 0x111111,      // color:       may be used by the renderer to setClearColor( THREE.Color )
        bump: false,                    // boolean:     apply bump (experimental)
        creaseAngleThreshold: 0.1,      // float >0:    IFS > face normals > Threshold -> smooth
        defaultMaterial: SPECULAR,      // integer:     allowed values DIFFUSE, SPECULAR
        precision: 16,                  // integer:     set precision (number of segments) in Graphic primitives (sphere, cylinder, cone..)
        solid: false,                   // boolean:     apply bump (experimental)
        statistics: false,               // boolean:     apply bump (experimental)
        textureMapping: CYLINDER,       // integer:     allowed values CYLINDER
        faceNormals: true,              // boolean:     apply textures
        verbose: false,                 // boolean:     console output maximal
        vertexNormals: false,           // boolean:     in IndexedFaceSet -> geometry : automatic normals calculation smooth
        useTextures: true,              // boolean:     in IndexedFaceSet -> geometry : automatic normals calculation smooth
        x3dUnit: 1.0                    // float >0:    overall scale
    };


    var $x3D = null;
    var readyCallbackFunc = null;

   // different lists for later usage, naming according to x3d field names
    var geoFields = [ 'IndexedFaceSet', 'Box', 'Cone', 'Cylinder', 'Sphere' ];
    var matFields = [ 'Material', 'ImageTexture', 'TextureTransform', 'Appearance' ];
    var grpFields = [ 'Transform', 'Group', 'Scene' ];

    // lists of THREE.js objects
    var geometry;
    var geometries = [];

    var material;
    var materials = [];

    var imageTexture;
    var imageTextures = [];


    var textureTransform;
    var textureTransforms = [];

    var appearance ;
    var appearances = [];

    var appearanceToTextureTransformIndex = [];

    var shape ;
    var shapes = [];

    var transform;
    var transforms = [];

    var group;
    var groups = [];

    var scene;
    var scenes = [];

    var DEFines = []; // list of DEFs for x3d fields

    // the root node
    var rootNodeName;
    var mainScene = new THREE.Object3D();
    mainScene.name = generateUniqueDEF( "scene" );

    var result = {     // finally here we store the scene
        scene: new THREE.Object3D()
    };


    // local root directory for relative position of e.g. textures or other source files
	var baseUrl;



    // loader to fetch data
    function load ( url, readyCallback, progressCallback ) {
        var length = 0;

		if ( document.implementation && document.implementation.createDocument ) {
            require(["text!"+url], function(responseText){
                var $responseXML = $(responseText);
                readyCallbackFunc = readyCallback;
                parse( $responseXML, readyCallback, url );
            });

		} else {
			alert( "Don't know how to parse XML!" );
		}
	}

    // parser public method
	// purpose: generate scenegraph from
	// doc: document to parse
	// callBack: function call when parsed
	// url: full path to data
	function parse( $doc, callBack, url ) {

        $x3D = $doc;
        callBack = callBack || readyCallbackFunc;

        generateBaseUrl( url ) ;
        // check for inline later

        // get all DEFines and check for plausibility
        initializeLists(); // defines , material

        // parse geometry primitives
        parseBackground();              // <Background ..
        parseIndexedFaceSet();          // <IndexedFaceSet ..
        parseBox();                     // <Box ..
        parseCone();                    // <Cone ..
        parseCylinder();                // <Cylinder ..
        parseSphere();                  // <Sphere ..

        // parsing for static nodes and static aspects of group nodes and generate lists of corresponding THREE.js nodes
        parseAllMaterials();            // <Material, <ImageTexture, <Appearance ..
        // parse grouping nodes
        parseShape();                   // <Shape ..
        parseScene();                   // <Scene ..
        parseGroup();                   // <Group ..
        parseTransform();               // <Transform ..

        // present all information collected so far
        if (options.statistics) getStatistics();

        // traverse scene,                                 currently assuming scene.length = 1;
        var elements = $x3D.find( 'scene' ); // root entry point

        var $rootNode = $(elements[ 0 ]);                   // at least one <Scene node
        rootNodeName = $rootNode.prop('tagName').toLowerCase() ;              // give it a name
        var counter = 0;                                // number of steps in the hierarchy, just for emergency stop

        // traverse and build scene graph
        buildSceneGraph( $rootNode, mainScene, counter ) ;
        // scene completed

        // unit conversion
        mainScene.scale.multiplyScalar( options.x3dUnit );

        // add to the main scene to result object
        result.scene.add( mainScene );

        // good bye!
        if ( callBack ) {
			callBack( result );
		}
		return result;
	}

    //**************************************************************************************************
	// end of main method
    //**************************************************************************************************

    // function list


    /**
     * buildSceneGraph
     * @param $me              a node list, starting with the root node <X3D
     * @param scene           an empty THREE Object3D which will be filled with the full scene
     * @param counter         an iterator just for statistical purpose and to avoid dead locks, may be omitted in the final version
     *
     *
     * purpose:
     * in the previous steps the scene has bee reduced to only few relevant nodes
     * 1. Shape node : contains all geometries, materials and texture and has no additional relevant children
     * 2. Transform nodes: containing all transformations such as rotation, scale, translate and a list of shapes and groups
     * 3. Group nodes : contains a list of shapes, transforms and other groups
     * 4. Scene nodes: meta nodes containing larger structures like a full bedroom etc.
     *
     *
     * naming:
     * since we perform a mapping from
     * X3D(nodes) -> THREE(objects)
     * we use the naming scheme
     * node -> object
     *
     * This is a simplified approach assuming:
     * all geometries and materials are canonically included in a shape node. (We cleared this )
     * the master node is the up most <X3D> node, which may include <Scene, <Transform, <Group and <Shape as relevant nodes only
     *
     */
    function buildSceneGraph( $me, scene, counter ) {

        // before anything else is done, check for  termination:
        // Step 1: A crude check for emergency termination
        if( counter >100000 ) {
            console.warn( "counter: 100000 exceeded, emergency termination" );
            scene.add( getObject( $me ) );
            return;
        }

        //console.log("I am:", $me.prop('tagName').toLowerCase() + " I have:", $me.children().length + " children.");
        //console.log("is relevant ", isRelevant( $me ));
        // Step 2: check conditions for standard termination
        // a.) position == root
        // b.) no relevant children


        if( $me.prop('tagName').toLowerCase() == rootNodeName.toLowerCase()  && $me.children().length == 0 ) {
            scene.add( getObject( $me ) );
            return;
        }

        // OK, no termination yet, so start actions

        // hierarchy convention naming
        // parent      above
        // me          (my current position in the hierarchy)
        // child       below


        var $child = $($me.children()[0]);
        var $parent;

        if( options.verbose )
           $.each($me.children(), function(i,el){
               console.log( "N"+i  , $(el).prop("tagName") );
           });

        // Step 3: check conditions for dead end and conforming actions
        // a.) its a relevant node
        // b.) no relevant children
        if( isRelevant( $me ) && $me.children().length == 0 ){
            counter++;
        //    console.log( "case 3: dead end reached. number of ends so far:  " + counter );

            var childObject = getObject( $me ) ;
            var parentObject =  getObject( $me.parent() ) ;

            // cloning with USE must happen in time
            var attribute = $me.attr( 'USE' );
            // <Group DEF='g_new' USE='g_old'>
            if( attribute != null  && $me.prop('tagName').toLowerCase() == 'group' ) {
                var index = isNameInList( $me.attr( 'USE' ), groups );
                parentObject.add( groups[ index ].clone() );
            }
            else
                parentObject.add( childObject ); // standard action: add the pre-prepared object to the parent THREE-object

            $parent = $me.parent();
            $me.remove();                     // kill the obsolete node

            buildSceneGraph ( $parent, scene, counter );
        }

        // Step 4: check conditions for irrelevant child node
        // a.) there are child nodes
        // b.) the child node is irrelevant
        if( $me.children().length > 0 && !isRelevant( $child ) ){ // not relevant kill
        //    console.log('case 4');
            counter++;
            $child.remove();
            buildSceneGraph ( $me, scene, counter );
        }

        // Step 5: check conditions for relevant child node
        // a.) there are child nodes
        // b.) the child node is relevant -> step down
        if($me.children().length > 0 && isRelevant( $child )){
           // console.log("case 5: first child is relevant: step down to " + $child.attr('DEF'));
            counter++;
            buildSceneGraph ( $child, scene, counter );
        }

    }
    /**
     * checkUse  :  check for USE and clone object to the objects list
     * @param node
     * @param objs
     * @returns {boolean}     USE is used/ not used token
     */
    function checkUse ( node , objs ) {
        var attribute;
        var index ;
        // check for USE

        attribute = $(node).attr( 'USE' );
        if( attribute == null ) return false;

        index = isNameInList( attribute, objs );
        if ( index == null ) {
            console.warn( "USE " + attribute + " required, but no DEF found" );
            return true;
        }
        // clone and add to list
        var obj = objs[ index ].clone();
        obj.name =  $(node).attr( 'DEF' );
        objs.push( obj );

        // console.log( " checkuse:: name: >>" + obj.name + "<< cloned from " + objs[ index].name + " to list" );
        return true;
    }
    /**
     * checkValidityOfAttribute  parsing and crude error check for attributes in x3d
     *
     * @param attribute          original textstring e.g. ' 1.0 1.0 1.0'
     * @param token              attribute type      e.g. 'size'
     * @returns property         error checked parameter e.g. {1.0,1.0,1.0}
     */
    function checkValidityOfAttribute( attribute, token ){
        var parts;     // contains the list of parsed strings
        var property ; // return value
        var i;
        var pointList = [];


        if( !attribute ) return ( null ) ; // attribute not found, use default as defined in parse<Primitive>

        attribute = attribute.replace( "\t", " " );  // replace <TAB> by <SPACE>
        attribute = attribute.trim();  // kill leading and trailing  <SPACE>
        parts = attribute.split( " " );

        switch ( token ){   // check all valid X3D attributes

            //  single float
            case 'radius':          // Sphere
            case 'height':          // Cone
            case 'bottomRadius':    // Cone
            case 'ambientIntensity':    // Material
            case 'shininess':    // Material
            case 'transparency':    // Material
            case 'creaseAngle':    // IFS
            case 'rotation2':    // IFS
                if ( parts.length != 1 ) {
                    console.warn('Invalid scalar format detected for ' + token );
                    property = null;
                    break;
                }
                parts[0] = eval(parts[0]);
                property = parseFloat( parts[0] );
                break;

            // color
            case 'diffuseColor':
            case 'specularColor':
            case 'emissiveColor':
            case 'skyColor':
                if ( parts.length != 3 ) {
                    console.warn( 'Invalid vector format detected for ' + token );
                    property = null;
                    break;
                }
                property = new THREE.Color( parseFloat( parts[ 0 ] ), parseFloat( parts[ 1 ] ), parseFloat( parts[ 2 ] ) );
                break;


            // 3 float
            case 'scale':
            case 'size':
            case 'translation':
                if ( parts.length != 3 ) {
                    console.warn( 'Invalid vector format detected for ' + token );
                    property = null;
                    break;
                }
                property = new THREE.Vector3( parseFloat( parts[ 0 ] ), parseFloat( parts[ 1 ] ), parseFloat( parts[ 2 ] ) );
                break;

            // 2 float
            case 'center2':
            case 'scale2':
            case 'translation2':
                if ( parts.length != 2 ) {
                    console.warn( 'Invalid vector format detected for ' + token );
                    property = null;
                    break;
                }
                property = new THREE.Vector2( parseFloat( parts[ 0 ] ), parseFloat( parts[ 1 ] ) );
                break;



            case 'point2':

                if ( parts.length  % 2  != 0 ) {
                    console.log(parts);
                    console.warn( 'Invalid vector format detected for ' + token + " parts.length = " + parts.length );
                    property = null;
                    break;
                }
                for ( i = 0; i < parts.length ; i+=2)
                    pointList.push( new THREE.Vector2( parseFloat( parts[ i ] ), parseFloat( parts[ i + 1 ] ) ) );

                property = pointList;
                break;

            case 'point3':

                if ( parts.length  % 3  != 0 ) {
                    console.log(parts);
                    console.warn( 'Invalid vector format detected for ' + token + " parts.length = " + parts.length );
                    property = null;
                    break;
                }
                for ( i = 0; i < parts.length ; i+=3)
                    pointList.push( new THREE.Vector3( parseFloat( parts[ i ] ), parseFloat( parts[ i + 1 ] ), parseFloat( parts[ i + 2 ] ) ) );

                property = pointList;
                break;

            case 'coordIndex':
                var indexes;
                var faceList = [];

                parts = attribute.split( " -1" );  // contains the indices for a single n-face

                var skip = 0;

                for ( i = 0; i< parts.length; i++ ) {
                    parts[i]= parts[i].trim();
                    indexes = parts[i].split(" ");

                    skip = 0;
                    // Face3 only works with triangles, but IndexedFaceSet allows polygons with more then three vertices, build them of triangles
                    while ( indexes.length >= 3 && skip < ( indexes.length - 2 ) ) {
                        //console.log( "face3 " + indexes[ 0 ] + " " + indexes[ skip + 1 ] + " " +   indexes[ skip + 2 ] );
                        var face = new THREE.Face3(
                            indexes[ 0 ],
                            indexes[ skip + 1 ],
                            indexes[ skip + 2 ],
                            null // normal, will be added later
                        );
                        skip++;
                        faceList.push(face);
                    }
                }
                property = faceList;
                break;


            // quaternion
            case 'rotation':
                if (parts.length != 4) {
                    console.warn( 'Invalid quaternion format detected for ' + token );
                    break;
                }
                parts[3] = eval(parts[3]); // mutig, mutig
                property = new THREE.Vector4(parseFloat(parts[0]) , parseFloat( parts[1])  , parseFloat( parts[2] ) , parseFloat( parts[3]));
                break;


            // bool

            case 'bottom':
            case 'side':
            case 'solid':
            case 'ccw':             // IndexedFaceSet
            case 'colorPerVertex':  // IndexedFaceSet
            case 'normalPerVertex': // IndexedFaceSet
                if (parts.length != 1) {
                    console.warn('Invalid bool format detected for ' + token);
                    break;
                }
                property = parts[0] === 'TRUE' ;
                break;

            // string
            case 'url':
                parts[0] =  parts[0].replace('"',"");
                parts[0] =  parts[0].replace('"',"");
                property = parts[0] ;
                break;

            // not a valid x3d token or not implemented yet
            default:
                property = null;
                console.warn( ">>" + attribute + "<< is not conform with x3d or is not implemented yet" );
                break;

        }
        //console.log("checkValOfAttributes >>" + token + "<<" + property );
        return property;

    }
    // generate the base URL to find e.g. the textures
    function generateBaseUrl( url ){
        if ( url !== undefined ) {
            var parts = url.split( '/' );
            parts.pop();
            baseUrl = ( parts.length < 1 ? '.' : parts.join( '/' ) ) + '/';
        }
    }
    /**
     * getDefines - for a given token e.g. 'Box' the corresponding 'DEF = property' is read added to the definesList
     * @param token
     */
    function getDEFines( token ) {
        var $elements = $x3D.find( token );
        var $element = $elements[ 0 ];
        var property ;

        if (!$element) {
        } else {
            for ( var i = 0; i < $elements.length; i++ ){
                $element = $($elements[i]);
        //        property = elements[ i ].getAttribute( 'DEF' );
                property = $element.attr( 'DEF' );
                if( property ) {
                    DEFines.push( property );
                    if( options.verbose ) console.log( "getDefines:: " + token + ".name=" + property );
                }
            }
        }
    }
    /**
     * generateCanonicalShape, used in parse<Geometry> methods
     * the standard node for geometry objects is
     * AAA:
     *
     * <Shape>
     *      <geometry
     *      <Appearance
     *          <Material
     *
     * but there may be only
     * <geometry tags in the x3d-file.
     * In this case, we have to bring the node into the canonical form AAA:
     *
     * * @param obj : geometry node, which has to be tested
     */
    function generateCanonicalShape( obj ){
        var $obj = $(obj);
        var $parent = $(obj).parent();

        //if( parent != null && parent.nodeName != 'Shape' )
        if( $parent != null && $parent.prop('tagName').toLowerCase() != 'shape' ) {
             if( options.verbose ) console.log( $parent.prop('tagName').toLowerCase() + " is the parent of " + $(obj).prop('tagName').toLowerCase() + ": build cononical node" );

            // build the shape node and replace the rudimentary geometry
            var $shpNode = $( '<Shape></Shape>' );
            $shpNode.attr( "DEF", generateUniqueDEF( 'Shape' ) );

            var $appNode = $( '<Appearance></Appearance>' );
            $appNode.attr( "DEF", generateUniqueDEF( 'Appearance' ) );

            var $matNode = $( '<Material></Material>' );
            $matNode.attr( "DEF", generateUniqueDEF( 'Material' ) );


            var $objNode = $obj.clone();
            $matNode.attr( "DEF", materials[ 0 ].name );  // default material

            $appNode.append( $matNode );

            $shpNode.append( $objNode );
            $shpNode.append( $appNode );

            $obj.replaceWith( $shpNode );

            if( options.verbose ) console.log('new node ', $shpNode);
        }
    }
    /**
     * generateValidDef : a valid unique DEF
     * @param prefix
     * @returns {*}
     */
    function generateUniqueDEF( prefix ) {
        var counter = DEFines.length;
        var validDef = prefix + "_" + counter; // try a possible name

        while( isInList( validDef, DEFines ) )
            validDef = prefix +  "_" + ++counter; // count up until we find a new name

        return validDef;
    }
    /**
     * getObject - for a given node return the corresponding Object
     *
     * @param node
     * @returns {*}
     */
    function getObject( node ) {
        var index;

        var token = node.prop('tagName').toLowerCase();

        switch ( token ) {   // check all valid X3D attributes
            case 'transform':
                index = isNameInList( node.attr( 'DEF' ), transforms );
                if( index >= 0 ) return( transforms[index] );
                break;
            case 'group':
                index = isNameInList( node.attr( 'DEF' ), groups );
                if( index >= 0 ) return( groups[index] );
                break;
            case 'shape':
                index = isNameInList( node.attr( 'DEF' ), shapes );
                if( index >= 0 ) return( shapes[index]);
                break;
            case 'scene':
                index = isNameInList( node.attr( 'DEF' ), scenes );
                if( index>=0 ) return( scenes[index] );
                break;
        }

        return null; // not found

    }
    /**
     * getStatistics - a collection of informations on the scene
     *
     */
    function getStatistics(){
        var counterFaces = 0;
        var counterVertices = 0;

        console.log( "Statistics" );
        console.log( shapes.length + "  <Shape> nodes");
        console.log( shapes[0]);

        for ( var i = 0; i < geometries.length; i++ ){
            counterFaces += geometries[i].faces.length;
            counterVertices += geometries[i].vertices.length;
        }
        console.log( counterVertices + "  vertices");
        console.log( counterFaces + "  faces");

        console.log( materials.length + "  <Material> nodes");
        console.log( imageTextures.length + "  <ImageTexture> nodes");
        console.log( textureTransforms.length + "  <TextureTransforms> nodes");


        console.log( transforms.length + "  <Transform> nodes");
        console.log( groups.length + "  <Group> nodes");
        console.log( scenes.length + "  <Scene> nodes");


    }
    /**
     *  initializeLists - generates a list of DEFs in the original x3D tree
     */
    function initializeLists() {
        var k;
        // first make a list of reserved names
        // we assume full integrity of the x3D source file
        // therefore we assume, that all given DEFs are unique

        // materials ++
        for ( k = 0; k < matFields.length; k++ )
            getDEFines( matFields[k] );
        // geometries ++
        for ( k = 0; k < geoFields.length; k++ )
            getDEFines( geoFields[k] );
        // mesh
        getDEFines( 'Shape' );
        // groups ++
        for ( k = 0; k < grpFields.length; k++ )
            getDEFines( grpFields[k] );

        // now give a name to every unnamed field node

        // materials ++
        for ( k = 0; k< matFields.length; k++ )
            setDefines( matFields[k] );
        // geometries ++
        for ( k = 0; k < geoFields.length; k++ )
            setDefines( geoFields[k] );
        // mesh
        setDefines( 'Shape' );
        // groups ++
        setDefinesTransform();
        setDefines( "Group" );
        setDefines( "Scene" );

        setDefaultMaterial() ;  // set the standard for void material

        if( options.verbose ) console.log( "defines listing:" + DEFines );
    }
    function isInList( name, names ) {
        for ( var i = 0; i <  names.length; i++ ){
            if ( name == names[ i ] ) return i;
        }
        return null;
    }
    function isNameInList( name, list ) {
        for ( var i = 0; i <  list.length; i++ ){
            if ( name.toLowerCase() == list[ i ].name.toLowerCase() ) return i;
        }
        return null;
    }
    /**
     * isRelevant - returns true, if the nodename is a member of relevant node names
     * @param node
     * @returns {boolean}
     */
    function isRelevant( node ) {
        if(node != null) {
            if ( node.prop('tagName').toLowerCase() == 'scene' ) return true;
            if ( node.prop('tagName').toLowerCase() == 'group' ) return true;
            if ( node.prop('tagName').toLowerCase() == 'transform' ) return true;
            if ( node.prop('tagName').toLowerCase() == 'shape' ) return true;
        }
        return false; // not found
    }
    /**
     * parseNodes  :
     */
    function parseAllMaterials(){
        parseMaterial();
        parseImageTexture();
        parseTextureTransform();
        parseAppearance();
    }
    function parseAppearance() {
        var token = "Appearance";
        var elements = $x3D.find( token );
        var element = elements[0];
        var index;


        if ( !element ) {
        } else {
            for ( var i = 0; i < elements.length; i++ ) {
                /*
                 Appearance : X3DAppearanceNode {
                 SFNode [in,out] fillProperties   NULL [FillProperties]
                 SFNode [in,out] lineProperties   NULL [LineProperties]
                 SFNode [in,out] material         NULL [X3DMaterialNode]
                 SFNode [in,out] metadata         NULL [X3DMetadataObject]
                 MFNode [in,out] shaders          []   [X3DShaderNode]
                 SFNode [in,out] texture          NULL [X3DTextureNode]
                 SFNode [in,out] textureTransform NULL [X3DTextureTransformNode]
                 }
                 */

                if( !checkUse( elements[i], appearances ) ) {

                    for ( var j = 0; j < elements[i].children.length; j++ ) {
                        var $child = $(elements[i].children[j]);

                        if ('Material'.toLowerCase() === $child.prop('tagName').toLowerCase() )   {
                            index = isNameInList($child.attr('DEF'), materials);
                            if( options.verbose ) console.log("material found: " + $child.attr('DEF'), "index = ", index) ;
                            appearance = materials[index];
                        }

                        if ('ImageTexture'.toLowerCase() === $child.prop('tagName').toLowerCase() && options.useTextures) {
                            index = isNameInList($child.attr('DEF'), imageTextures);
                            if (options.verbose) console.log("imageTexture found: " + $child.attr('DEF'), "index = ", index);
                            appearance.map = imageTextures[index];

                            if (options.bump) {
                                appearance.bumpMap = imageTextures[0]; // just for fun
                                appearance.bumpScale = 0.1; // just for fun
                            }

                        }

                        if ('TextureTransform'.toLowerCase() === $child.prop('tagName').toLowerCase() && options.useTextures) {
                            index = isNameInList($child.attr('DEF'), textureTransforms);
                            appearanceToTextureTransformIndex.push( new THREE.Vector2(appearances.length, index) ); // connect appearance index and texture transform  index

                            if (options.verbose)
                                console.log("texture transform found: " + child.getAttribute('DEF'), "index = ", index);
                        }

                    }

                    // give a name and check
                    pushObjectAndNodeDEFToList( appearance, appearances, elements[i], token );
                    if( options.verbose ) console.log(token +  " name: >>" + appearance.name + "<< added to list");
                }
            }
        }   // end if(element)
    }
    function parseBackground() {
        var attribute;
        var token = "Background";
        var elements = $x3D.find( token );
        var element = elements[0];
        var value;

        // attributes
        var skyColor;

        if ( !element ) {
        } else {
            for ( var i = 0; i < elements.length; i++ ) {

                /*
                 Box : X3DGeometryNode {
                 SFNode  [in,out] metadata NULL  [X3DMetadataObject]
                 SFVec3f []       size     2 2 2 (0,∞)
                 SFBool  []       solid    TRUE
                 }*/

                if( !checkUse( elements[i], geometries ) ) {
                    element = $(elements[i]);
                    attribute = 'skyColor';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    skyColor = ( value != null ) ? value : new THREE.Color( 0.0, 0.0, 0.0 ); // set value or default

                    options.backgroundColor = skyColor ;

                    if( options.verbose )
                        console.log( token + "(" + skyColor.r + "," + skyColor.g + "," + skyColor.b + ")  added to options" );
                }
            }
        }   // end if(element)
    }
    function parseBox() {
        var attribute;
        var token = "Box";
        var elements = $x3D.find( token );
        var element = elements[0];
        var value;

        // attributes
        var size3;

        if ( !element ) {
        } else {
            for ( var i = 0; i < elements.length; i++ ) {

                /*
                 Box : X3DGeometryNode {
                 SFNode  [in,out] metadata NULL  [X3DMetadataObject]
                 SFVec3f []       size     2 2 2 (0,∞)
                 SFBool  []       solid    TRUE
                 }*/

                if(!checkUse( elements[i], geometries ) ) {
                    element = $(elements[i]);

                    attribute = 'size';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    size3 = ( value != null ) ? value : new THREE.Vector3( 2.0, 2.0, 2.0 ); // set value or default
                    console.log(attribute, ' ', value);

                    geometry = new THREE.BoxGeometry( size3.x, size3.y, size3.z );

                    // give a name and check
                    pushObjectAndNodeDEFToList( geometry, geometries, elements[i], token );
                    if( options.verbose )
                        console.log( token + "(" + size3.x + "," + size3.y + "," + size3.z + ") name: >>" + geometry.name + "<< added to list" );

                    generateCanonicalShape(elements[i]);

                }
            }
        }   // end if(element)
    }
    function parseCone() {
        var attribute;
        var token = "Cone";
        var elements = $x3D.find( token );
        var element = elements[0];
        var value;

        // attributes
        var bottom;
        var bottomRadius;
        var height;
        var side;

        if ( !element ) {
        } else {
            for ( var i = 0; i < elements.length; i++ ) {

                /*
                 Cone : X3DGeometryNode {
                 SFNode  [in,out] metadata     NULL [X3DMetadataObject]
                 SFBool  []       bottom       TRUE
                 SFFloat []       bottomRadius 1    (0,∞)
                 SFFloat []       height       2    (0,∞)
                 SFBool  []       side         TRUE
                 SFBool  []       solid        TRUE
                 }
                 */
                if( !checkUse( elements[i], geometries ) ) {
                    element = $(elements[i]);

                    attribute = 'bottom';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    bottom =  (value != null)? value : true; // set value or default

                    attribute = 'bottomRadius';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    bottomRadius =  (value != null)? value : 1.0; // set value or default

                    attribute = 'height';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    height =  (value != null)? value : 2.0; // set value or default

                    attribute = 'side';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    side =  (value != null)? value : true; // set value or default

                    // no ConeGeometry in THREE, so use Cylinder instead
                    // THREE.CylinderGeometry(radiusTop, radiusBottom, height, radiusSegments, heightSegments, openEnded, thetaStart, thetaLength)
                    geometry = new THREE.CylinderGeometry( 0, bottomRadius, height, options.precision, options.precision, !bottom );

                    // give a name
                    pushObjectAndNodeDEFToList( geometry, geometries, elements[i],token );

                    generateCanonicalShape(elements[i]);

                    // write info
                    if( options.verbose ) console.log( token + "(" + bottomRadius + "," + height + ") name:>>" + geometry.name + "<< added to list" );
                }
            }
        }   // end if(element)
    }
    function parseCylinder() {
        var attribute;
        var token = "Cylinder";
        var elements = $x3D.find( token );
        var element = elements[0];
        var value;

        // attributes
        var bottom;
        var height;
        var radius;
        var side;
        var top;

        if ( !element ) {
        } else {
            for ( var i = 0; i < elements.length; i++ ) {

                /*
                 Cylinder : X3DGeometryNode {
                 SFNode  [in,out] metadata NULL [X3DMetadataObject]
                 SFBool  []       bottom   TRUE
                 SFFloat []       height   2    (0,∞)
                 SFFloat []       radius   1    (0,∞)
                 SFBool  []       side     TRUE
                 SFBool  []       solid    TRUE
                 SFBool  []       top      TRUE
                 }*/
                if( !checkUse( elements[i], geometries ) ) {

                    element = $(elements[i]);

                    attribute = 'bottom';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    bottom = ( value != null ) ? value : true; // set value or default

                    attribute = 'height';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    height = ( value != null ) ? value : 2.0; // set value or default

                    attribute = 'radius';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    radius = ( value != null ) ? value : 1.0; // set value or default

                    attribute = 'side';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    side = ( value != null ) ? value : true; // set value or default

                    attribute = 'top';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    top = ( value != null ) ? value : true; // set value or default


                    // THREE.CylinderGeometry(radiusTop, radiusBottom, height, radiusSegments, heightSegments, openEnded, thetaStart, thetaLength)
                    geometry = new THREE.CylinderGeometry( radius, radius, height, options.precision, options.precision, (!bottom && !top) );

                    // give a name
                    pushObjectAndNodeDEFToList( geometry, geometries, elements[i], token );

                    // write info
                    if( options.verbose ) console.log( token + "(" + radius + "," + height + ") name:>>" + geometry.name + "<< added to list" );

                    generateCanonicalShape(elements[i]);

                }
            }
        }   // end if(element)
    }
    function parseGroup() {
        var token = "Group";
        var elements = $x3D.find( token );
        var element = elements[0];

        if ( !element ) {
        } else {
            for ( var i = 0; i < elements.length; i++ ) {

                /*
                 Group : X3DGroupingNode {
                 MFNode  [in]     addChildren             [X3DChildNode]
                 MFNode  [in]     removeChildren          [X3DChildNode]
                 MFNode  [in,out] children       []       [X3DChildNode]
                 SFNode  [in,out] metadata       NULL     [X3DMetadataObject]
                 SFVec3f []       bboxCenter     0 0 0    (-∞,∞)
                 SFVec3f []       bboxSize       -1 -1 -1 [0,∞) or −1 −1 −1
                 }
                 */

                if(!checkUse( elements[i], groups ) ) {

                    // actually a container, which will be filled by children through the traverse
                    group = new THREE.Object3D();

                    // give a name and check
                    pushObjectAndNodeDEFToList( group, groups, elements[i], token );

                    if( options.verbose )
                        console.log( token  + "  : >>" + group.name + "<< added to list" );
                }
            }
        }   // end if(element)
    }
    function parseImageTexture() {
        var attribute;
        var token = "ImageTexture";
        var elements = $x3D.find( token );
        var element = elements[ 0 ];
        var value;

        var url;
        var repeatS;
        var repeatT;

        if ( !element ) {
        } else {
            for ( var i = 0; i < elements.length; i++ ) {
                /*
                 ImageTexture : X3DTexture2DNode, X3DUrlObject {
                 SFNode   [in,out] metadata          NULL [X3DMetadataObject]
                 MFString [in,out] url               []   [URI]
                 SFBool   []       repeatS           TRUE
                 SFBool   []       repeatT           TRUE
                 SFNode   []       textureProperties NULL [TextureProperties]
                 }
                 */
                if(!checkUse( elements[i], imageTextures) ) {
                    element = $(elements[i]);
                    attribute = 'url';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    url = ( value != null ) ? value : ''; // set value or default
                    attribute = 'repeatS';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    repeatS = ( value != null ) ? value : true; // set value or default
                    attribute = 'repeatT';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    repeatT = ( value != null ) ? value : true; // set value or default


//                  e.g.   './models/x3d/earth-topo.png'
                    //  use baseUrl to determine relative link
                    var link = ((( url.indexOf( "http://" ) > -1 ) || ( url.indexOf( "https://" ) > -1 ) ) ?  url :  baseUrl + url );

                    imageTexture = THREE.ImageUtils.loadTexture( link , undefined, null, null );
                    imageTexture.wrapS = (repeatS ?  THREE.RepeatWrapping : THREE.ClampToEdgeWrapping ) ;
                    imageTexture.wrapT = (repeatT ?  THREE.RepeatWrapping : THREE.ClampToEdgeWrapping ) ;

                    imageTexture.repeat.set( 0.9999, 0.9999 ) ;

                    // give a name
                    pushObjectAndNodeDEFToList( imageTexture, imageTextures, elements[i], token );

                    // write info
                    if( options.verbose ) console.log( token + "(" + ") name:>>" + imageTexture.name + "<< added to list" );
                }
            }
        }   // end if(element)
    }
    function parseIndexedFaceSet() {
        var attribute;
        var token = "IndexedFaceSet";
        var elements = $x3D.find( token );
        var element = elements[0];
        var value;

        var j, k;
        var prop;

        // attributes
        var ccw;
        var colorPerVertex;
        var coordIndex;
        var creaseAngle;
        var normalPerVertex;

        if (!element) {
        } else {
            for (var i = 0; i < elements.length; i++) {

                /*
                 IndexedFaceSet : X3DComposedGeometryNode {
                 MFInt32 [in]     set_colorIndex
                 MFInt32 [in]     set_coordIndex
                 MFInt32 [in]     set_normalIndex
                 MFInt32 [in]     set_texCoordIndex
                 MFNode  [in,out] attrib            []   [X3DVertexAttributeNode]
                 SFNode  [in,out] color             NULL [X3DColorNode]
                 SFNode  [in,out] coord             NULL [X3DCoordinateNode]
                 SFNode  [in,out] fogCoord          []   [FogCoordinate]
                 SFNode  [in,out] metadata          NULL [X3DMetadataObject]
                 SFNode  [in,out] normal            NULL [X3DNormalNode]
                 SFNode  [in,out] texCoord          NULL [X3DTextureCoordinateNode]
                 SFBool  []       ccw               TRUE
                 MFInt32 []       colorIndex        []   [0,∞) or -1
                 SFBool  []       colorPerVertex    TRUE
                 SFBool  []       convex            TRUE
                 MFInt32 []       coordIndex        []   [0,∞) or -1
                 SFFloat []       creaseAngle       0    [0,∞)
                 MFInt32 []       normalIndex       []   [0,∞) or -1
                 SFBool  []       normalPerVertex   TRUE
                 SFBool  []       solid             TRUE
                 MFInt32 []       texCoordIndex     []   [-1,∞)
                 }
                 */

                if(!checkUse( elements[i], geometries) ) {
                    element = $(elements[i]);

                    attribute = 'ccw';

                    value = checkValidityOfAttribute(element.attr(attribute), attribute);
                    ccw = ( value != null ) ? value : true; // set value or default

                    attribute = 'creaseAngle';
                    value = checkValidityOfAttribute(element.attr(attribute), attribute);
                    creaseAngle = ( value != null ) ? value : NOEXIST; // set value or default


                    attribute = 'colorPerVertex';
                    value = checkValidityOfAttribute(element.attr(attribute), attribute);
                    colorPerVertex = ( value != null ) ? value : true; // set value or default

                    attribute = 'normalPerVertex';
                    value = checkValidityOfAttribute(element.attr(attribute), attribute);
                    normalPerVertex = ( value != null ) ? value : true; // set value or default



                    geometry = new THREE.Geometry();


                    attribute = 'coordIndex';
                    value = checkValidityOfAttribute(element.attr(attribute), attribute);


                    for (j = 0; j < value.length; j++)
                        geometry.faces.push(value[j]);

                    var counterTexture = NOEXIST;

                    for (j = 0; j < element.children().length; j++) {
                        var $child = $(element.children()[j]);

                        // add vertices
                        if ('Coordinate'.toLowerCase() === $child.prop('tagName').toLowerCase()  ) {
                            attribute = 'point';
                            prop = checkValidityOfAttribute($child.attr(attribute), 'point3');
                            for ( k = 0; k < prop.length; k++ )
                                geometry.vertices.push( prop[ k ] );
                        }

                        // add UVs
                        if ('TextureCoordinate'.toLowerCase() === $child.prop('tagName').toLowerCase() ) {
                            counterTexture = j;
                            attribute = 'point';
                            prop = checkValidityOfAttribute($child.attr(attribute), 'point2');

                            geometry.faceVertexUvs[ 0 ] = [];
                            for ( k = 0; k < geometry.faces.length; k++ ) {
                                var face = geometry.faces;
                                geometry.faceVertexUvs[ 0 ].push( [ prop[ face[ k ].a ], prop[ face[ k ].b ], prop[ face[ k ].c ] ] );
                                if( options.verbose ){
                                    console.log( face.a, face.b, face.c );
                                    console.log( prop[ face[k].a ], prop[ face[k].b ], prop[ face[k].c ] );
                                }
                            }
                        }
                    } // all children traversed

                    if ( (counterTexture === NOEXIST) && options.useTextures ){
                        if( options.verbose ) console.log("assigning automatic uvs");
                        var texMan = new THREE.TextureManipulations();
                        if(options.textureMapping == TRIANGLE) texMan.assignUVsTriangles(geometry);
                        if(options.textureMapping == CYLINDER) texMan.assignUVsCylindrical(geometry);

                    }

                    // creaseAngle = NOEXIST , use settings from options.
                    // creaseAngle <= threshold ->  flat shading
                    // creaseAngle >  threshold ->  smooth shading

                    if (creaseAngle == NOEXIST) {  // make your own choice from options
                        if (options.faceNormals)  geometry.computeFaceNormals();
                        if (options.faceNormals && options.vertexNormals)  geometry.computeVertexNormals(); // averages the faceNormals, therefore computeFaceNormals must have been calculated first

                        if (!options.faceNormals && options.vertexNormals) {// averages the faceNormals, therefore computeFaceNormals must have been calculated first
                            geometry.computeFaceNormals();
                            geometry.computeVertexNormals();
                        }
                    } else {  // given in x3d dataset
                        if( creaseAngle <= options.creaseAngleThreshold )   // flat
                            geometry.computeFaceNormals();
                        if( creaseAngle > options.creaseAngleThreshold ){ // smooth
                            geometry.computeFaceNormals();
                            geometry.computeVertexNormals();
                        }

                    }
                    geometry.computeBoundingSphere(); // vital for performance
                    geometry.computeBoundingBox();



                    // give a name
                    pushObjectAndNodeDEFToList( geometry, geometries, element[i], token );

                    // write info
                    if( options.verbose ) console.log( token + " name:>>" + geometry.name + "<< added to list" );

                    generateCanonicalShape(element[i]);

                }
            }
        }   // end if(element)
    }
    function parseMaterial() {
        var attribute;
        var token = "Material";
        var elements = $x3D.find( token );
        var element = elements[0];
        var value;

        // attributes
        var diffuseColor;
        var specularColor;
        var emissiveColor;
        var ambientIntensity;
        var shininess;
        var transparency;
        var appearanceCounter = 0 ; // check if all materials are childnodes of the appearance node

        if (!element) {
        } else {
            for (var i = 0; i < elements.length; i++) {
                /*
                 Material : X3DMaterialNode {
                 SFFloat [in,out] ambientIntensity 0.2         [0,1]
                 SFColor [in,out] diffuseColor     0.8 0.8 0.8 [0,1]
                 SFColor [in,out] emissiveColor    0 0 0       [0,1]
                 SFNode  [in,out] metadata         NULL        [X3DMetadataObject]
                 SFFloat [in,out] shininess        0.2         [0,1]
                 SFColor [in,out] specularColor    0 0 0       [0,1]
                 SFFloat [in,out] transparency     0           [0,1]
                 }
                   */
                if(!checkUse( elements[i], materials) ) {
                    element = $(elements[i]);

                    attribute = 'ambientIntensity';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    ambientIntensity = ( value != null ) ? value : 0.2; // set value or default
                    attribute = 'shininess';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    shininess = ( value != null ) ? value : 0.2; // set value or default
                    attribute = 'transparency';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    transparency = ( value != null ) ? value : 0.0; // set value or default

                    attribute = 'diffuseColor';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    diffuseColor = ( value != null ) ? value : new THREE.Color( 0.8, 0.8, 0.8 ); // set value or default
                    attribute = 'specularColor';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    specularColor = ( value != null ) ? value : new THREE.Color( 0.0, 0.0, 0.0 ); // set value or default
                    attribute = 'emissiveColor';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    emissiveColor = ( value != null ) ? value : new THREE.Color( 0.0, 0.0, 0.0 ); // set value or default

                    material = new THREE.MeshPhongMaterial({
                        color: diffuseColor,
                        specular: specularColor
                    });
                    material.emissive = emissiveColor;
                    material.shininess = 15.0 * shininess;

                    if ( transparency > 0 ) {
                        material.opacity = Math.abs( 1.0 - transparency );
                        material.transparent = true;
                    }

                    if( options.solid ) material.side = THREE.DoubleSide;
                    if( element.parent().prop('tagName').toLowerCase() != 'appearance' ) appearanceCounter++; // material should be a child of the Appearance node
                //    if( elements[i].parentNode.nodeName != 'Appearance' ) appearanceCounter++; // material should be a child of the Appearance node
                    // give a name
                    pushObjectAndNodeDEFToList( material, materials, elements[i], token );
                }
            }
        }   // end if(element)

        if (appearanceCounter > 0) console.warn("not all <Material nodes are children of <Appearance, representation may fail ");

    }
    function parseScene() {
        var token = "Scene";
        var elements = $x3D.find( token );
        var element = $(elements[0]);

        if ( !element ) {
        } else {
            for ( var i = 0; i < elements.length; i++ ) {

                /*
                 Group : X3DGroupingNode {
                 MFNode  [in]     addChildren             [X3DChildNode]
                 MFNode  [in]     removeChildren          [X3DChildNode]
                 MFNode  [in,out] children       []       [X3DChildNode]
                 SFNode  [in,out] metadata       NULL     [X3DMetadataObject]
                 SFVec3f []       bboxCenter     0 0 0    (-∞,∞)
                 SFVec3f []       bboxSize       -1 -1 -1 [0,∞) or −1 −1 −1
                 }
                 */

                if(!checkUse( elements[i], scenes ) ) {

                    // actually a container, which will be filled by children through the traverse
                    scene = new THREE.Object3D();

                    // give a name and check
                    pushObjectAndNodeDEFToList( scene, scenes, elements[i], token );

                    if( options.verbose )
                        console.log( token  + "  : >>" + scene.name + "<< added to list" );
                }
            }
        }   // end if(element)
    }
    function parseShape() {

        var token = "Shape";
        var elements = $x3D.find( token );
        var element = elements[0];
        var indexGeo ;
        var indexApp;
        var indexTex;

        if ( !element ) {
        } else {
            for ( var i = 0; i < elements.length; i++ ) {

                /*
                 Shape : X3DShapeNode {
                 SFNode  [in,out] appearance NULL     [X3DAppearanceNode]
                 SFNode  [in,out] geometry   NULL     [X3DGeometryNode]
                 SFNode  [in,out] metadata   NULL     [X3DMetadataObject]
                 SFVec3f []       bboxCenter 0 0 0    (-∞,∞)
                 SFVec3f []       bboxSize   -1 -1 -1 [0,∞) or −1 −1 −1
                 }
                 */

                if( !checkUse( elements[i], shapes ) ) {
                    indexGeo = NOEXIST ;
                    indexApp = NOEXIST;
                    indexTex = NOEXIST;

                    for ( var j = 0; j < elements[i].children.length; j++ ) {

                        var $child = $(elements[i].children[j]);
                        // any geometry node is ok
                        for ( var k = 0; k < geoFields.length; k++ ) {
                            if ( geoFields[k].toLowerCase()  === $child.prop('tagName').toLowerCase() ) {
                                indexGeo = isNameInList($child.attr('DEF'), geometries);
                                if( options.verbose ) console.log("geometry " + geoFields[k] + "  found: " + $child.attr('DEF'));
                            }
                        }

                        if ( 'Appearance'.toLowerCase() === $child.prop('tagName').toLowerCase() ){
                            indexApp = isNameInList($child.attr('DEF'), appearances);
                            if( options.verbose ) console.log("material found: " + $child.attr('DEF'), "index = ", indexApp) ;
                        }
                    }

                    if ( ( indexApp != NOEXIST ) && ( indexGeo != NOEXIST ) && options.useTextures ){
                        // UVs are existing, make transforms,if possible

                        // get texture transform
                        for ( k = 0; k < appearanceToTextureTransformIndex.length; k++ )
                            if ( appearanceToTextureTransformIndex[k].x == indexApp ) indexTex = appearanceToTextureTransformIndex[k].y ;

                        if( indexTex != NOEXIST ){
                            textureTransform = textureTransforms[ indexTex ];
                            geometry = geometries[ indexGeo ];
                            textureTransform.assignUVsCanonical( geometry );
                        }
                    }

                    shape = new THREE.Mesh( geometries[ indexGeo ], appearances[ indexApp ] );

                    // give a name and check
                    pushObjectAndNodeDEFToList( shape, shapes, elements[i], token );
                    if( options.verbose ) console.log( token +  " name: >>" + shape.name  + "<< added to list" );
                }
            }
        }   // end if(element)
    }
    function parseSphere() {
        var attribute;
        var token = "Sphere";
        var elements = $x3D.find( token );
        var element = elements[0];
        var value;

        // attributes
        var radius;

        if ( !element ) {
        } else {
            for ( var i = 0; i < elements.length; i++ ) {
                /*
                 Sphere : X3DGeometryNode {
                 SFNode  [in,out] metadata NULL [X3DMetadataObject]
                 SFFloat []       radius   1    (0,∞)
                 SFBool  []       solid    TRUE
                 }}
                 */
                if( !checkUse( elements[i], geometries ) ) {
                    element = $(elements[i]);
                    attribute = 'radius';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    radius = ( value != null ) ? value : 1.0; // set value or default


                    geometry = new THREE.SphereGeometry( radius, options.precision, options.precision );

                    // give a name
                    pushObjectAndNodeDEFToList( geometry, geometries, elements[i], token );

                    // write info
                    if( options.verbose ) console.log( token + "(" + radius + ") name:>>" + geometry.name + "<< added to list" );

                    generateCanonicalShape(elements[i]);

                }
            }
        }   // end if(element)
    }
    function parseTextureTransform() {
        var attribute;
        var token = "TextureTransform";
        var elements = $x3D.find( token );
        var element = elements[0];
        var value;

        var center2;
        var rot2;
        var scale2 ;
        var trans2;


        if ( !element ) {
        } else {
            for ( var i = 0; i < elements.length; i++ ) {

                /*
                 TextureTransform : X3DGroupingNode {
                 SFVec3f    [in,out] center           0 0 0    (-∞,∞)
                 SFRotation [in,out] rotation         0 0 1 0  [-1,1] or (-∞,∞)
                 SFVec3f    [in,out] scale            1 1 1    (-∞, ∞)
                 SFVec3f    [in,out] translation      0 0 0    (-∞,∞)
                 }
                 */

                if(!checkUse( elements[i], textureTransforms ) ) {
                    element = $(elements[i]);
                    attribute = 'center';
                    value = checkValidityOfAttribute( element.attr( attribute ), 'center2' );
                    center2 = ( value != null ) ? value : new THREE.Vector2( 0.0, 0.0 ); // set value or default

                    attribute = 'rotation';
                    value = checkValidityOfAttribute( element.attr( attribute ), 'rotation2' );
                    rot2 = ( value != null ) ? value : 0.0 ; // set value or default

                    attribute = 'scale';
                    value = checkValidityOfAttribute( element.attr( attribute ), 'scale2' );
                    scale2 = ( value != null ) ? value : new THREE.Vector2( 1.0, 1.0 ); // set value or default

                    attribute = 'translation';
                    value = checkValidityOfAttribute( element.attr( attribute ), 'translation2' );
                    trans2 = ( value != null ) ? value : new THREE.Vector2( 0.0, 0.0 ); // set value or default



                    // actually a container for transform data

                    textureTransform = new THREE.TextureManipulations();
                    textureTransform.center.set(center2.x, center2.y);
                    textureTransform.rotate = rot2;
                    textureTransform.translate.set(trans2.x, trans2.y);
                    textureTransform.scale.set( scale2.x, scale2.y );
                    if( options.verbose ) {
                        console.log("here comes my transform ");
                        console.log(textureTransform);
                    }

                    // give a name and check
                    pushObjectAndNodeDEFToList( textureTransform, textureTransforms, elements[i], token );
                    if( options.verbose ){
                        console.log( token  + "  : >>" + textureTransform.name + "<< added to list" );
                        console.log( textureTransform );
                    }


                }
            }
        }   // end if(element)
    }
    function parseTransform() {
        var attribute;
        var token = "Transform";
        var elements = $x3D.find( token );
        var element = elements[ 0 ];
        var value;

        var trans;
        var rot;
        var scal ;


        if ( !element ) {
        } else {
            for ( var i = 0; i < elements.length; i++ ) {

                /*
                 Transform : X3DGroupingNode {
                 MFNode     [in]     addChildren               [X3DChildNode]
                 MFNode     [in]     removeChildren            [X3DChildNode]
                 SFVec3f    [in,out] center           0 0 0    (-∞,∞)
                 MFNode     [in,out] children         []       [X3DChildNode]
                 SFNode     [in,out] metadata         NULL     [X3DMetadataObject]
                 SFRotation [in,out] rotation         0 0 1 0  [-1,1] or (-∞,∞)
                 SFVec3f    [in,out] scale            1 1 1    (-∞, ∞)
                 SFRotation [in,out] scaleOrientation 0 0 1 0  [-1,1] or (-∞,∞)
                 SFVec3f    [in,out] translation      0 0 0    (-∞,∞)
                 SFVec3f    []       bboxCenter       0 0 0    (-∞,∞)
                 SFVec3f    []       bboxSize         -1 -1 -1 [0,∞) or −1 −1 −1
                 }
                 */


                if(!checkUse( elements[i], transforms ) ) {
                    element = $(elements[i]);
                    attribute = 'translation';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    trans = ( value != null ) ? value : new THREE.Vector3( 0.0, 0.0, 0.0 ); // set value or default

                    attribute = 'scale';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    scal = ( value != null ) ? value : new THREE.Vector3( 1.0, 1.0, 1.0 ); // set value or default

                    attribute = 'rotation';
                    value = checkValidityOfAttribute( element.attr( attribute ), attribute );
                    rot = ( value != null ) ? value : new THREE.Vector4( 0, 0, 0 , 1.0 ); // set value or default

                    // actually a container, which will be filled by children through the traverse
                    transform = new THREE.Object3D();

                    transform.position.set( trans.x, trans.y, trans.z ) ;
                    transform.scale.set( scal.x, scal.y, scal.z ) ;
                    transform.quaternion.setFromAxisAngle( new THREE.Vector3( rot.x, rot.y, rot.z ), rot.w );

                    // give a name and check
                    pushObjectAndNodeDEFToList( transform, transforms, elements[i], token );
                    if( options.verbose )
                        console.log( token  + "  : >>" + transform.name + "<< added to list" );
                }
            }
        }   // end if(element)
    }
    function pushObjectAndNodeDEFToList( obj, objs, node, token ) {
        // give a name and push

        obj.name =  $(node).attr( 'DEF' );
        objs.push( obj );

        if( options.verbose )
        {
            console.log(token +  "name: >>" + obj.name + "<< added to list");
            console.log("parent NodeName = " + $(node).parent().prop('tagName'));
        }
        return true;
    }
    /**
     * setDefaultMaterial  :    generate an entry in the materials list, containing the default material
     */
    function setDefaultMaterial() {
        var diffuseColor;
        var specularColor;

        diffuseColor =  new THREE.Color( 0.8, 0.8, 0.8 ); // set value or default
        specularColor = new THREE.Color( 0.2, 0.2, 0.2 ); // set value or default

        if ( options.defaultMaterial == SPECULAR )
            material = new THREE.MeshPhongMaterial( {
                color: diffuseColor,
                specular: specularColor
            } );

        if ( options.defaultMaterial == DIFFUSE )
            material = new THREE.MeshLambertMaterial( {
                color: diffuseColor
            } );

        // give a name
        material.name =  generateUniqueDEF( 'material_default' ) ;
        materials.push( material );
    }
    /**
     * setDefines - for a given token e.g. 'Box' the corresponding 'DEF = property' is set and added to the definesList
     * @param token
     */
    function setDefines( token ) {
        var elements = $x3D.find( token );
        var element = elements[ 0 ];
        var property ;

        if ( !element ) {
        } else {
            for ( var i = 0; i < elements.length; i++ ){
                element = $(elements[i]);
                //property = elements[i].getAttribute( 'DEF' ); // check for DEF
                property = element.attr( 'DEF' );
                if( !property ) {  // not defined yet
                    property = generateUniqueDEF( token ); // generate a new unique name
                    element.attr( 'DEF', property );  // write attribute
                    DEFines.push( property );
                    if( options.verbose ) console.log( "setDefines:: " + token + ".name=" + property );
                }
            }
        }
    }
    /**
     * setDefinesTransform - 'DEF = property' is set and added to the definesList
     * special treatment since name reflects
     * Transform_s scale
     * Transform_r rotation
     * Transform_t translation
     * or mixture
     * easily detect the corresponding Transformation
     */
    function setDefinesTransform() {
        var token = "Transform";
        var elements = $x3D.find( token );
        var element = elements[ 0 ];
        var property ;
        var name ;

        if ( !element ) {
        } else {
            for ( var i = 0; i < elements.length; i++ ){
                name = token + "_" ;
                property = elements[i].getAttribute( 'DEF' ); // check for DEF
                if( !property ) {  // not defined yet
                    property = elements[i].getAttribute( 'scale' ); // check for DEF
                    if( property ) name += "s" ;
                    property = elements[i].getAttribute( 'translation' ); // check for DEF
                    if( property ) name += "t" ;
                    property = elements[i].getAttribute( 'rotation' ); // check for DEF
                    if( property ) name += "r" ;
                    property = generateUniqueDEF( name ); // generate a new unique name
                    elements[i].setAttribute( 'DEF', property );
                    DEFines.push( property );
                    if( options.verbose )
                        console.log( "setDefines:: " + token + ".name=" + property );
                }
            }
        }
    }

    return {
		load: load,
		parse: parse,
		//geometries : geometries,
		//materials : materials,
		options: options
	   };
};
});
define('vendor/three/loaders/STLLoader',["three"], function(THREE){
/**
 * @author aleeper / http://adamleeper.com/
 * @author mrdoob / http://mrdoob.com/
 * @author gero3 / https://github.com/gero3
 * @author Mugen87 / https://github.com/Mugen87
 *
 * Description: A THREE loader for STL ASCII files, as created by Solidworks and other CAD programs.
 *
 * Supports both binary and ASCII encoded files, with automatic detection of type.
 *
 * The loader returns a non-indexed buffer geometry.
 *
 * Limitations:
 *  Binary decoding supports "Magics" color format (http://en.wikipedia.org/wiki/STL_(file_format)#Color_in_binary_STL).
 *  There is perhaps some question as to how valid it is to always assume little-endian-ness.
 *  ASCII decoding assumes file is UTF-8.
 *
 * Usage:
 *  var loader = new THREE.STLLoader();
 *  loader.load( './models/stl/slotted_disk.stl', function ( geometry ) {
 *    scene.add( new THREE.Mesh( geometry ) );
 *  });
 *
 * For binary STLs geometry might contain colors for vertices. To use it:
 *  // use the same code to load STL as above
 *  if (geometry.hasColors) {
 *    material = new THREE.MeshPhongMaterial({ opacity: geometry.alpha, vertexColors: THREE.VertexColors });
 *  } else { .... }
 *  var mesh = new THREE.Mesh( geometry, material );
 */


THREE.STLLoader = function ( manager ) {

	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

};

THREE.STLLoader.prototype = {

	constructor: THREE.STLLoader,

	load: function ( url, onLoad, onProgress, onError ) {

		var scope = this;

		var loader = new THREE.FileLoader( scope.manager );
		loader.setPath( scope.path );
		loader.setResponseType( 'arraybuffer' );
		loader.load( url, function ( text ) {

			try {

				onLoad( scope.parse( text ) );

			} catch ( exception ) {

				if ( onError ) {

					onError( exception );

				}

			}

		}, onProgress, onError );

	},

	setPath: function ( value ) {

		this.path = value;
		return this;

	},

	parse: function ( data ) {

		function isBinary( data ) {

			var expect, face_size, n_faces, reader;
			reader = new DataView( data );
			face_size = ( 32 / 8 * 3 ) + ( ( 32 / 8 * 3 ) * 3 ) + ( 16 / 8 );
			n_faces = reader.getUint32( 80, true );
			expect = 80 + ( 32 / 8 ) + ( n_faces * face_size );

			if ( expect === reader.byteLength ) {

				return true;

			}

			// An ASCII STL data must begin with 'solid ' as the first six bytes.
			// However, ASCII STLs lacking the SPACE after the 'd' are known to be
			// plentiful.  So, check the first 5 bytes for 'solid'.

			// Several encodings, such as UTF-8, precede the text with up to 5 bytes:
			// https://en.wikipedia.org/wiki/Byte_order_mark#Byte_order_marks_by_encoding
			// Search for "solid" to start anywhere after those prefixes.

			// US-ASCII ordinal values for 's', 'o', 'l', 'i', 'd'

			var solid = [ 115, 111, 108, 105, 100 ];

			for ( var off = 0; off < 5; off ++ ) {

				// If "solid" text is matched to the current offset, declare it to be an ASCII STL.

				if ( matchDataViewAt ( solid, reader, off ) ) return false;

			}

			// Couldn't find "solid" text at the beginning; it is binary STL.

			return true;

		}

		function matchDataViewAt( query, reader, offset ) {

			// Check if each byte in query matches the corresponding byte from the current offset

			for ( var i = 0, il = query.length; i < il; i ++ ) {

				if ( query[ i ] !== reader.getUint8( offset + i, false ) ) return false;

			}

			return true;

		}

		function parseBinary( data ) {

			var reader = new DataView( data );
			var faces = reader.getUint32( 80, true );

			var r, g, b, hasColors = false, colors;
			var defaultR, defaultG, defaultB, alpha;

			// process STL header
			// check for default color in header ("COLOR=rgba" sequence).

			for ( var index = 0; index < 80 - 10; index ++ ) {

				if ( ( reader.getUint32( index, false ) == 0x434F4C4F /*COLO*/ ) &&
					( reader.getUint8( index + 4 ) == 0x52 /*'R'*/ ) &&
					( reader.getUint8( index + 5 ) == 0x3D /*'='*/ ) ) {

					hasColors = true;
					colors = [];

					defaultR = reader.getUint8( index + 6 ) / 255;
					defaultG = reader.getUint8( index + 7 ) / 255;
					defaultB = reader.getUint8( index + 8 ) / 255;
					alpha = reader.getUint8( index + 9 ) / 255;

				}

			}

			var dataOffset = 84;
			var faceLength = 12 * 4 + 2;

			var geometry = new THREE.BufferGeometry();

			var vertices = [];
			var normals = [];

			for ( var face = 0; face < faces; face ++ ) {

				var start = dataOffset + face * faceLength;
				var normalX = reader.getFloat32( start, true );
				var normalY = reader.getFloat32( start + 4, true );
				var normalZ = reader.getFloat32( start + 8, true );

				if ( hasColors ) {

					var packedColor = reader.getUint16( start + 48, true );

					if ( ( packedColor & 0x8000 ) === 0 ) {

						// facet has its own unique color

						r = ( packedColor & 0x1F ) / 31;
						g = ( ( packedColor >> 5 ) & 0x1F ) / 31;
						b = ( ( packedColor >> 10 ) & 0x1F ) / 31;

					} else {

						r = defaultR;
						g = defaultG;
						b = defaultB;

					}

				}

				for ( var i = 1; i <= 3; i ++ ) {

					var vertexstart = start + i * 12;

					vertices.push( reader.getFloat32( vertexstart, true ) );
					vertices.push( reader.getFloat32( vertexstart + 4, true ) );
					vertices.push( reader.getFloat32( vertexstart + 8, true ) );

					normals.push( normalX, normalY, normalZ );

					if ( hasColors ) {

						colors.push( r, g, b );

					}

				}

			}

			geometry.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( vertices ), 3 ) );
			geometry.addAttribute( 'normal', new THREE.BufferAttribute( new Float32Array( normals ), 3 ) );

			if ( hasColors ) {

				geometry.addAttribute( 'color', new THREE.BufferAttribute( new Float32Array( colors ), 3 ) );
				geometry.hasColors = true;
				geometry.alpha = alpha;

			}

			return geometry;

		}

		function parseASCII( data ) {

			var geometry = new THREE.BufferGeometry();
			var patternFace = /facet([\s\S]*?)endfacet/g;
			var faceCounter = 0;

			var patternFloat = /[\s]+([+-]?(?:\d*)(?:\.\d*)?(?:[eE][+-]?\d+)?)/.source;
			var patternVertex = new RegExp( 'vertex' + patternFloat + patternFloat + patternFloat, 'g' );
			var patternNormal = new RegExp( 'normal' + patternFloat + patternFloat + patternFloat, 'g' );

			var vertices = [];
			var normals = [];

			var normal = new THREE.Vector3();

			var result;

			while ( ( result = patternFace.exec( data ) ) !== null ) {

				var vertexCountPerFace = 0;
				var normalCountPerFace = 0;

				var text = result[ 0 ];

				while ( ( result = patternNormal.exec( text ) ) !== null ) {

					normal.x = parseFloat( result[ 1 ] );
					normal.y = parseFloat( result[ 2 ] );
					normal.z = parseFloat( result[ 3 ] );
					normalCountPerFace ++;

				}

				while ( ( result = patternVertex.exec( text ) ) !== null ) {

					vertices.push( parseFloat( result[ 1 ] ), parseFloat( result[ 2 ] ), parseFloat( result[ 3 ] ) );
					normals.push( normal.x, normal.y, normal.z );
					vertexCountPerFace ++;

				}

				// every face have to own ONE valid normal

				if ( normalCountPerFace !== 1 ) {

					console.error( 'THREE.STLLoader: Something isn\'t right with the normal of face number ' + faceCounter );

				}

				// each face have to own THREE valid vertices

				if ( vertexCountPerFace !== 3 ) {

					console.error( 'THREE.STLLoader: Something isn\'t right with the vertices of face number ' + faceCounter );

				}

				faceCounter ++;

			}

			geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
			geometry.addAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );

			return geometry;

		}

		function ensureString( buffer ) {

			if ( typeof buffer !== 'string' ) {

				return THREE.LoaderUtils.decodeText( new Uint8Array( buffer ) );

			}

			return buffer;

		}

		function ensureBinary( buffer ) {

			if ( typeof buffer === 'string' ) {

				var array_buffer = new Uint8Array( buffer.length );
				for ( var i = 0; i < buffer.length; i ++ ) {

					array_buffer[ i ] = buffer.charCodeAt( i ) & 0xff; // implicitly assumes little-endian

				}
				return array_buffer.buffer || array_buffer;

			} else {

				return buffer;

			}

		}

		// start

		var binData = ensureBinary( data );

		return isBinary( binData ) ? parseBinary( binData ) : parseASCII( ensureString( data ) );

	}

};

 return THREE.STLLoader;
});
/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define('STLLoader',["three", "vendor/three/loaders/STLLoader", "lodash"], function( THREE, ThreeSTLLoader, _ ){
    var STLLoader = function ( manager, logger )
    { 
        ThreeSTLLoader.call( this, manager, logger );
    };

    STLLoader.prototype = _.create( ThreeSTLLoader.prototype, {
        constructor : STLLoader,
        
        load : function(url, onLoad, onProgress, onError)
        {
            onLoad = onLoad || function(){};
            if( url === null || url === undefined || url === "" ) {
                onLoad( null );
            };
            var scope = this;

            var path = scope.path === undefined ? THREE.LoaderUtils.extractUrlBase( url ) : scope.path;

            require(["text!" + url], function ( responseText ) {
                var fnc = onLoad || function(){};
                try{
                    fnc ( scope.parse( responseText, path ) );
                }
                catch( e ){
                    onError ( e );
                }
                
            }, onError);
        }
        
    });

    return STLLoader;
});


/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

define('UniversalLoader',["three", "STLLoader", "ColladaLoader", "OBJLoader", "MTLLoader"], function( THREE, STLLoader, ColladaLoader, OBJLoader, MTLLoader ) {

    var UniversalLoader = function(){
        
    };

    UniversalLoader.prototype.load = function( urls, onLoad, onError ){
	
        // handle arguments polymorphism
	if( typeof(urls) === 'string' )	urls	= [urls];

	// load stl
	if( urls[0].match(/\.stl$/i) && urls.length === 1 ){
		this.loader	= new STLLoader();
		this.loader.addEventListener('load', function( event ){
			var geometry	= event.content;
			var material	= new THREE.MeshPhongMaterial();
			var object3d	= new THREE.Mesh( geometry, material );
			onLoad(object3d);
		});
		this.loader.load(urls[0]);
                
		return;
                
	}else if( urls[0].match(/\.dae$/i) && urls.length === 1 ){
		this.loader = new ColladaLoader();
		this.loader.options.convertUpAxis = true;
		this.loader.load(urls[0], function( collada ){
                    // console.dir(arguments)
                    var object3d = collada.scene;
                    onLoad( object3d );
		}, null, onError);
		return;
                
	}else if( urls[0].match(/\.js$/i) && urls.length === 1 ){
		this.loader = new THREE.JSONLoader();
		this.loader.load(urls[0], function(geometry, materials){
			if( materials.length > 1 ){
				var material	= new THREE.MeshFaceMaterial(materials);
			}else{
				var material	= materials[0];
			}
			var object3d	= new THREE.Mesh(geometry, material);
			onLoad(object3d);
		});
		return;
                
	}else if( urls[0].match(/\.obj$/i) && urls.length === 1 ){
		this.loader = new OBJLoader();
		this.loader.load(urls[0], function(object3d){
			onLoad(object3d);
		});
		return;
        }else if( urls[0].match(/\.mtl$/i) && urls.length === 1 ){
		this.loader	= new MTLLoader();
		this.loader.load(urls[1], urls[0], function( material ){
			onLoad( material );
		});
		return;
                        
	}else if( urls.length === 2 && urls[0].match(/\.mtl$/i) && urls[1].match(/\.obj$/i) ){
            _loadOBJMTL( [urls[1], urls[0]], onLoad, onError );
            return;
                
	}else if( urls.length === 2 && urls[0].match(/\.obj$/i) && urls[1].match(/\.mtl$/i) ){
            _loadOBJMTL( urls, onLoad, onError );
            return;
                
	}else	console.assert( false );
    };
    
    var _loadOBJMTL = function( urls, onLoad, onError ){
        
        var mtlLoader = new MTLLoader();
            //mtlLoader.setPath( 'models/obj/male02/' );
        
        mtlLoader.load( urls[1], function( materials ) {
            materials.preload();
            var objLoader = new OBJLoader();
            objLoader.setMaterials( materials );
            //objLoader.setPath( 'models/obj/male02/' );
            objLoader.load( urls[0], function ( object3d ) {

                onLoad( object3d );
            }, null, onError );
        });
        
    };
    
    return UniversalLoader;
});

/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define('ObjectDAE',["three", "lodash", "ColladaLoader"], function( THREE, _, ColladaLoader )
{
    var defaults = {
        shadow : false,
        scale : 39.37,
        onLoad : function(){}
    };

    var enableShadow = function( dae )
    {
        dae.traverse( function ( child ) {
            if ( child instanceof THREE.Mesh ) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    };
    var setName = function( dae )
    {
        var counter = 0;
        dae.traverse( function ( child ) {
            if ( child instanceof THREE.Mesh ) {
                child.name = dae.name + counter;
                counter++;
            }
        });
    };

    var counterClockwiseFaceOrder = function( dae )
    {
        dae.traverse( function ( el ) {
            if ( el instanceof THREE.Mesh ) {
                _.each( el.geometry.faces, function( face ){
                    var temp = face.a;
                    face.a = face.c;
                    face.c = temp;
                });
            }
        });

    };

    var ObjectDAE = function( file, opt )
    {
        var loader = new ColladaLoader();
        loader.options.convertUpAxis = true;

        this.options = _.extend( {}, defaults, opt );

        THREE.Object3D.call( this );

        this.registerEvents();

        loader.load( file, function( collada )
        {
            var dae = collada.scene;
            dae.name = this.options.name || file;
            setName(dae);
            if ( this.options.shadow ) enableShadow( dae );

            var scaleX = (this.options.mirror)? -this.options.scale : this.options.scale;
            dae.scale.set( scaleX, this.options.scale, this.options.scale );

            if( this.options.mirror ) counterClockwiseFaceOrder( dae );

            this.add( dae );
            this.options.onLoad( this, dae );
        }.bind(this) );
    };

    //inherits from THREE.Object3D
    ObjectDAE.prototype = Object.create( THREE.Object3D.prototype );
    ObjectDAE.prototype.constructor = ObjectDAE;
    
    ObjectDAE.prototype.registerEvents = function(){
        
    };
    
    return ObjectDAE;
});


/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define('ObjectX3D',["three", "X3DLoader", "lodash"], function( THREE, X3DLoader, _ ){ 
    
    var loader = new THREE.X3DLoader();
    loader.options.convertUpAxis = true;
    var options = {
        shadow : false,
        scale : 39.37,
        mirror : false,
        normalize : true,
        onLoad : function(){}
    };

    var enableShadow = function( dae )
    {
        dae.traverse( function ( child ) {
            if ( child instanceof THREE.Mesh ) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    };

    var setName = function( dae )
    {
        dae.traverse( function ( child ) {
            if ( child instanceof THREE.Mesh ) {
                if ( dae.name && (!child.name || child.name == "") ) child.name = dae.name + "_child";
                child.geometry.computeFaceNormals();
                child.geometry.computeVertexNormals();
            }
        });
    };

    var ObjectX3D = function( file, opt )
    {
        if ( opt ) this.options = _.extend( {}, options, opt );

        THREE.Object3D.call( this );

        this.registerEvents();

        loader.load( file, function( collada )
        {
            var dae = collada.scene;
            if (this.options.name) { dae.name = this.options.name; }
            setName( dae );
            if ( this.options.shadow ) { enableShadow( dae ); }

            var scaleX = (this.options.mirror)? -this.options.scale : this.options.scale;
            //ToDo: wenn mirror dann noch UVs spiegel!!
            dae.scale.set( scaleX, this.options.scale, this.options.scale );

            this.add( dae );
            this.options.onLoad( this, dae );
        }.bind(this) );
    };

    //inherits from THREE.Object3D
    ObjectX3D.prototype = Object.create( THREE.Object3D.prototype );
    ObjectX3D.prototype.constructor = ObjectX3D;
    ObjectX3D.prototype.super = THREE.Object3D;

    ObjectX3D.prototype.registerEvents = function(){

    };

    return ObjectX3D;
});
/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define('ObjectOBJ',["three", "lodash", "OBJLoader"], function( THREE, _, OBJLoader )
{
    var defaults = {
        shadow : false,
        scale : 1,
        onLoad : function(){}
    };

    var enableShadow = function( obj )
    {
        obj.traverse( function ( child ) {
            if ( child instanceof THREE.Mesh ) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    };

    var ObjectOBJ = function( file, opt )
    {
        var loader = new OBJLoader();

        this.options = _.extend( {}, defaults, opt );

        THREE.Object3D.call( this );

        this.registerEvents();

        loader.load( file, function( obj ){
            if ( this.options.shadow ) { enableShadow( obj ); }
            obj.scale.set( this.options.scale, this.options.scale, this.options.scale );
            this.add( obj );
            this.options.onLoad( this, obj );
        }.bind(this) );
    };
    
    //inherits from THREE.Object3D
    ObjectOBJ.prototype = Object.create( THREE.Object3D.prototype );
    ObjectOBJ.prototype.constructor = ObjectOBJ;

    ObjectOBJ.prototype.registerEvents = function(){
        
    };
    
    return ObjectOBJ;
});


/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define('ObjectOBJMTL',["three", "lodash", "OBJMTLLoader"], function( THREE, _, OBJMTLLoader )
{
    var defaults = {
        shadow : false,
        scale : 1,
        onLoad : function(){}
    };

    var enableShadow = function( obj )
    {
        obj.traverse( function ( child ) {
            if ( child instanceof THREE.Mesh ) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    };

    var ObjectOBJ = function( file, mtlfile, opt )
    {
        var loader = new OBJMTLLoader();

        this.options = _.extend( {}, defaults, opt );

        THREE.Object3D.call( this );

        this.registerEvents();

        loader.load( file, mtlfile, function( obj ){
            if ( this.options.shadow ) { enableShadow( obj ); }
            obj.scale.set( this.options.scale, this.options.scale, this.options.scale );
            this.add( obj );
            this.options.onLoad( this, obj );
        }.bind(this) );
    };
    
    //inherits from THREE.Object3D
    ObjectOBJ.prototype = Object.create( THREE.Object3D.prototype );
    ObjectOBJ.prototype.constructor = ObjectOBJ;
    ObjectOBJ.prototype.super = THREE.Object3D;

    ObjectOBJ.prototype.registerEvents = function(){
        
    };
    
    return ObjectOBJ;
});


/**
 * @author:			macrocom by Richard Herrmann
 * @last modified:	2015-06-17
 */
define('extras/loaders/POVLoader.Parser',["three"], function( THREE ){

THREE.POVLoader = function () {
    var pov = null;
    var readyCallbackFunc = null;

    // lists of THREE.js objects

    var groupOpen = false;
    var currentTextureName = '';
    //var mesh = 0;
    var counter = 0;
    var lines ;
    var res;
    var lastMaterialIndex = 0;

    var texture;

    var geometry;
    var geometries = [];

    var material;
    var materials = [];

    var reflectance = [];
    var reflectances = [];


    var camera;
    var cameras = [];
    var materialWithCameraNames = [];




    var light;
    var lights = [];

    var imageTextures = [];


    var textureTransforms = [];


    var shapes = [];

    var transforms = [];

    var group ;
    var groups = [];

    var scene;
    var scenes = [];

    var DEFines = []; // list of DEFs for x3d fields

    // the root node
    var mainScene = new THREE.Object3D();
    mainScene.name = generateUniqueDEF( "scene" );

    var result = {     // finally here we store the scene
        scene: new THREE.Object3D(),
        lights: [],
        cameras:[],
        geometries:[],
        materials:[],
        reflectances:[]
    };


    // local root directory for relative position of e.g. textures or other source files
    var baseUrl;

    // some constants
    const AMBIENT = 0 ;     // in setDefaultMaterial
    const DIFFUSE = 1 ;
    const SPECULAR = 2 ;


    // options: public properties, may be used to communicate with the renderer too

    var pigment = {
        name: '',                           // string:      name
        rgb: new THREE.Color(0.0,0.0,0.0),  // float:       ambient intensity
        transmit: 0.0,
        uv_mapping: false,                  // bool:       diffuse intensity
        url: ''                             // string:       diffuse intensity
    };

    var normal = {
        name: '',                           // string:      name
        bump_size: 0.5 ,                     // float:       bump intensity
        uv_mapping: false,                  // bool:        diffuse intensity
        url: ''                             // string:      diffuse intensity
    };

    var finish = {
        name: '',                       // string:      name
        ambient: 0.0,                   // float:       ambient intensity
        diffuse: 0.0,                   // float:       diffuse intensity
        specular: 0.0,                  // float:       diffuse intensity
        reflection: 0.0,                // float:       diffuse intensity
        brilliance: 0.0,                // float:       diffuse intensity
        metallic: 0.0                   // float:       diffuse intensity
    };

    // object contains information for tiling a texture
    var tile = {
        name: '',                       // string:      name
        size:{u:1000, v:1000},          // floats:      length and width of tile
        rotation:0.0,                   // float:       rotation angle
        offset:{x:0, y:0}          // floats:      translation
    };

    var options = {
        reflections: {boden: 0.95, front: 0.0},          // float>0:     boden reflections
        backgroundColor: 0x111111,      // color:       may be used by the renderer to setClearColor( THREE.Color )
        bump: true,                     // boolean:     apply bump
        bumpFactor: 1,                  // boolean:     apply bump
        castShadows: true,              // boolean:     meshes cast shadows
        castShadowsLight: true,         // boolean:     light cast shadows
        cameraResolution : 256,
        creaseAngleThreshold: 0.1,      // float >0:    IFS > face normals > Threshold -> smooth
        defaultMaterial: SPECULAR,      // integer:     allowed values AMBIENT, DIFFUSE, SPECULAR
        enableLights: false,             // boolean:     in IndexedFaceSet -> geometry : automatic normals calculation flat
        enableCameras: false,           // boolean:     in IndexedFaceSet -> geometry : automatic normals calculation flat
        faceNormals: false,             // boolean:     in IndexedFaceSet -> geometry : automatic normals calculation flat
        forcePosition: 0,               // integer:     in IndexedFaceSet -> geometry : automatic normals calculation flat
        lightIntensity: .75,           // float:       in IndexedFaceSet -> geometry : automatic normals calculation flat
        precision: 16,                  // integer:     set precision (number of segments) in Graphic primitives (sphere, cylinder, cone..)
        scale: 1.0,                     // float:       apply bump (experimental)
        showDeko: true,                 // boolean:     should deko be shown
        solid: false,                   // boolean:     apply bump (experimental)
        statistics: false,              // boolean:     show statistics
        thresholdReflection : 0.4,
        verbose: false,                  // boolean:     console output maximal
        vertexNormals: false,           // boolean:     in IndexedFaceSet -> geometry : automatic normals calculation smooth
        useTextures: true,              // boolean:     in IndexedFaceSet -> geometry : automatic normals calculation smooth
        povUnit: 1.0                    // float >0:    overall scale
    };

    // loader to fetch data
    function load ( url, readyCallback, progressCallback ) {
        var length = 0;
        if ( document.implementation && document.implementation.createDocument ) {
            var request = new XMLHttpRequest();
            request.onreadystatechange = function() {
                if( request.readyState === 4 ) {
                    if( request.status === 0 || request.status === 200 ) {
                        if ( request.responseXML ) {
                            readyCallbackFunc = readyCallback;
                            parse( request.responseXML, undefined, url );
                        } else if ( request.responseText ) {
                            readyCallbackFunc = readyCallback;
                            parse( request.responseText, undefined, url );
                        } else {
                            console.error( "PovLoader: Empty or non-existing file (" + url + ")" );
                        }
                    }
                } else if ( request.readyState === 3 ) {
                    if ( progressCallback ) {
                        if ( length === 0 ) {
                            length = request.getResponseHeader( "Content-Length" );
                        }
                        progressCallback( { total: length, loaded: request.responseText.length } );
                    }
                }
            };
            request.open( "GET", url, true );
            request.send( null );
        } else {
            alert( "Don't know how to parse XML!" );
        }
    }

    // parser public method
    // purpose: generate scenegraph from
    // doc: document to parse
    // callBack: function call when parsed
    // url: full path to data
    function parse( doc, callBack, url ) {


        pov = doc;
        callBack = callBack || readyCallbackFunc;

        generateBaseUrl( url ) ;
        setDefaultMaterial();
        checkText(pov);

        if(options.statistics)  getStatistics();

        /*
         generateCamera(materials[52]);
         generateCamera(materials[48]);
         generateCamera(materials[38]);
         */
        // 229
        // 230

        for (i = 0; i < groups.length; i++){

            result.scene.add( groups[i] );

            if( groups[i].name.indexOf( 'Boden' ) > -1 && options.reflections.boden > 0 && options.reflections.boden < 1){
                reflectance = [];
                reflectance[0] = groups[i].children[0].geometry;
                reflectance[1] = groups[i].children[0].material;
                reflectance[2] = groups[i];
                reflectance[1].userData = { type: 'boden', opacity: options.reflections.boden, rotation: tile.rotation, size: tile.size };
                reflectances.push( reflectance );
            }

            if(options.reflections.front > 0 && options.reflections.front < 1){
                if( groups[i].children[0].material.name.indexOf( 'Textur42' ) > -1 ){
                    reflectance = [];
                    reflectance[0] = groups[i].children[0].geometry ;
                    reflectance[1] = groups[i].children[0].material ;
                    reflectance[1].userData = { type: 'front', opacity: options.reflections.front };
                    reflectance[2] = groups[i];
                    reflectances.push( reflectance );
                }
            }
        }

        // lights from scene
        for (var i = 0; i < lights.length; i++){
            lights[i].castShadow = options.castShadowsLight;
        }


        if(options.enableLights){
            for (var i = 0; i < lights.length; i++){
                result.scene.add(lights[i]);
            }
        }

        // publish lists
        result.lights = lights;
        result.cameras = cameras;
        result.geometries = geometries;
        result.materials = materials;
        result.reflectances = reflectances;

        result.scene.scale.multiplyScalar( options.povUnit );

        // good bye!
        if ( callBack ) {
            callBack( result );
        }
        return result;
    }

    //**************************************************************************************************
    // end of main method
    //**************************************************************************************************

    // function list

    function checkText ( text ) {

        lines = text.split( '\n' );
        for ( var i = 0; i < lines.length; i ++ ) {
            var line = lines[i];
            line = line.trim();
            var parts = line.split(" ");

            if (line.length === 0) {
                //   continue;   // empty line


            } else if (/^#declare /.test(line)) { // material definitions
                if (line.indexOf('= pigment') > -1) {
                    pigment.name = parts[1];
                    parsePigment(line);
                }   else if (line.indexOf('= finish') > -1) {
                    finish.name = parts[1];
                    parseFinish(line);
                }   else if (line.indexOf('= normal') > -1) {
                    normal.name = parts[1];
                    parseNormal(line);
                }   else if (line.indexOf('= texture') > -1) {
                    parseTexture(parts);
                }


            } else if (/^\/\/!#declare/.test(line)) { // our extensions
                console.log(line);
                if (line.indexOf('= textureTransform') > -1) {
                    tile.name = parts[1];
                    parseTile(line);
                }
            } else if (/^mesh /.test(line)) { // group starts
                generateNewGroup(lines[i - 1]);


            } else if (line.indexOf('//! tile_size') > -1) { // read tile info
                res = getAttributeTileSize(line);  // 3 floats will do
                if (res != null) {
                    tile.size.u = res[0];
                    tile.size.v = res[1];
                }

            } else if (line.indexOf('//! tile_rotation') > -1) { // read tile info
                var value = getAttributeFloat(line, 'tile_rotation');
                if (value != null) tile.rotation = value; // set value or default

            } else if (/^light_source /.test(line)) { // light sources
                light = new THREE.SpotLight(0xFFFFFF, options.lightIntensity);
                light.name = generateUniqueDEF('light');

                res = getAttributeColor(lines[i+1]);
                vert1 = new THREE.Vector3(-res[0], res[1], res[2]) ;
                vert1.multiplyScalar(options.scale);
                light.position.set(vert1.x,vert1.y,vert1.z);

                res = getAttributeColor(lines[i+5]);
                vert1 = new THREE.Vector3(-res[0], res[1], res[2]) ;
                vert1.multiplyScalar(options.scale);
                light.target.position.set(vert1.x,vert1.y,vert1.z);

                lights.push(light) ;

            } else if (/^smooth_triangle /.test(line)) { // material definitions
                var p = lines[i+6].split(' ');           // line with texture name
                if(currentTextureName == '') currentTextureName = p[6]; // if there is no texture name, give it the actual
                if(currentTextureName != p[6]){                         // texture name change
                    var name = geometry.name;
                    if (name == '') generateNewGroup(lines[i - 1]);
                    else generateNewGroup(name);
                }
                res = getAttribute2FloatsInLine(lines[i+1]);
                var vert1 = new THREE.Vector3(-res[0], res[1], res[2]) ;
                var norm1 = new THREE.Vector3(-res[3], res[4], res[5]) ;
                vert1.multiplyScalar(options.scale);
                geometry.vertices.push(vert1) ;

                res = getAttribute2FloatsInLine(lines[i+2]);
                var vert2 = new THREE.Vector3(-res[0], res[1], res[2]) ;
                var norm2 = new THREE.Vector3(-res[3], res[4], res[5]) ;
                vert2.multiplyScalar(options.scale);
                geometry.vertices.push(vert2) ;

                res = getAttribute2FloatsInLine(lines[i+3]);
                var vert3 = new THREE.Vector3(-res[0], res[1], res[2]) ;
                var norm3 = new THREE.Vector3(-res[3], res[4], res[5]) ;
                vert3.multiplyScalar(options.scale);
                geometry.vertices.push(vert3) ;

                var face = new THREE.Face3(counter, counter+1, counter+2);
                if(!options.faceNormals && !options.faceNormals) { //use normals from povray
                    face.vertexNormals[0] = norm1;
                    face.vertexNormals[1] = norm2;
                    face.vertexNormals[2] = norm3;
                }
                geometry.faces.push(face) ;
                var uvs = getAttribute3FloatsInLine(lines[i+5]);
                geometry.faceVertexUvs[0].push ([
                    new THREE.Vector2(  uvs[0],  uvs[1]  ),    // TL
                    new THREE.Vector2(  uvs[2],  uvs[3]  ),    // BL
                    new THREE.Vector2(  uvs[4],  uvs[5]  )     // TR
                ]);
                counter += 3;
            }
        }

        //mesh = new THREE.Mesh( geometry, materials[lastMaterialIndex] );
        if( groupOpen == true ) {
            material = materials[isNameInList(currentTextureName, materials)];
            mesh = new THREE.Mesh( geometry, material );
            if (options.castShadows && group.name.indexOf('no_shadow') == -1){
                mesh.castShadow = true;
            }
            if (options.castShadows)  mesh.receiveShadow = true;
            var index = isInList(material.name, materialWithCameraNames);
            // ToDo
            if (index != null){
                //generateCamera(mesh, material);
            }

            group.add(mesh);
            geometry.name = group.name;
            geometries.push(geometry);
            groups.push(group);
            groupOpen = false;
        }
    }
    function generateBaseUrl( url ){

        if ( url !== undefined ) {
            var parts = url.split( '/' );
            parts.pop();
            baseUrl = ( parts.length < 1 ? '.' : parts.join( '/' ) ) + '/';
        }
    }
    function generateNewGroup( lin ){

        if( groupOpen == true ) {  // closing old mesh
            lastMaterialIndex = isNameInList(currentTextureName, materials);
            if(options.faceNormals)
                geometry.computeFaceNormals();
            if(options.vertexNormals && options.faceNormals)
                geometry.computeVertexNormals();
            if(options.vertexNormals && !options.faceNormals){
                geometry.computeFaceNormals();
                geometry.computeVertexNormals();
            }

            geometry.name = group.name;
            geometries.push(geometry);
            material = materials[isNameInList(currentTextureName, materials)];
            mesh = new THREE.Mesh( geometry, material );

            var index = isInList(material.name, materialWithCameraNames);
            // ToDo
            if (index != null){
                //generateCamera(mesh, material);
            }

            if (options.castShadows && group.name.indexOf('no_shadow') == -1){
                mesh.castShadow = true;
            }

            if (options.castShadows)  mesh.receiveShadow = true;

            group.add(mesh);
            groups.push(group);
            groupOpen = false;
        }
        if( groupOpen == false) {  // opening new mesh
            currentTextureName = '';
            group = new THREE.Object3D();
            groupOpen = true;
            group.name = getAttributeMeshName(lin); // give a name
            geometry = new THREE.Geometry();
            counter = 0;
        }
    }
    function generateCamera( obj, mat ){

        //camera  = new THREEx.CubeCamera( obj );
        //camera.name = mat.name;
        //mat.envMap = camera.textureCube;
        //cameras.push(camera);
    }
    function generateUniqueDEF( prefix ) {
        var counter = DEFines.length-1;
        var validDef = prefix + "_" + counter; // try a possible name

        while( isInList( validDef, DEFines ) )
            validDef = prefix +  "_" + ++counter; // count up until we find a new name
        DEFines.push(validDef);
        return validDef;
    }
    function getAttributeFloat( line, token ) {
        line.replace(/,/g, ' ') ;
        line.replace('{', ' ') ;
        line.replace('}', ' ') ;
        var parts = line.split( " " );
        for (var i = 0; i < parts.length-1; i++ )
            if (parts[i] == token) return parseFloat(parts[i+1]);
        return null; // not found
    }
    function getAttributeColor( line ) {
        var start = line.indexOf('<');
        if (start == -1) return null;
        var stop = line.indexOf('>');
        if (stop == -1) return null;
        var len = stop - start;
        if (len == 0) return null;

        var str = line.substr(start + 1, len - 1);
        var parts = str.split( "," );
        if (parts.length == 3 ){
            return [parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2])];
        }
        if (parts.length == 4 ){
            return [parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
        }
        return null; // not found
    }
    function getAttributeTileSize( line ) {
        var start = line.indexOf('<');
        if (start == -1) return null;
        var stop = line.indexOf('>');
        if (stop == -1) return null;
        var len = stop - start;
        if (len == 0) return null;

        var str = line.substr(start + 1, len - 1);
        var parts = str.split( "," );
        if (parts.length == 2 ){
            return [parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2])];
        }
        return null; // not found
    }
    function getAttribute2FloatsInLine( line ) {
        var myLine = line;
        var res = [];
        for(var i=0; i<2; i++) {
            var start = myLine.indexOf('<');
            if (start == -1) return null;
            var stop = myLine.indexOf('>');
            if (stop == -1) return null;
            var len = stop - start;
            if (len == 0) return null;
            var str = myLine.substr(start + 1, len - 1);
            var parts = str.split(",");
            res.push(parts[0]);
            res.push(parts[1]);
            res.push(parts[2]);
            myLine = myLine.substr(stop+2);
        }
        return(res);
    }
    function getAttribute3FloatsInLine( line ) {
        var myLine = line;
        var res = [];
        for(var i=0; i<3; i++) {
            var start = myLine.indexOf('<');
            if (start == -1) return null;
            var stop = myLine.indexOf('>');
            if (stop == -1) return null;
            var len = stop - start;
            if (len == 0) return null;
            var str = myLine.substr(start + 1, len - 1);
            var parts = str.split(",");
            res.push(parts[0]);
            res.push(parts[1]);
            myLine = myLine.substr(stop+3);
        }
        return(res);
    }
    function getAttributeMeshName( line ) {
        var start = line.indexOf('//');
        if (start == -1) return 'noName';
        return(line.substr(3));

    }
    function getAttributeTextureUrl( line ) {
        var token = '';
        if(line.indexOf('.jpg') > -1) token = 'jpeg';
        if(line.indexOf('.png') > -1) token = 'png';
        if(line.indexOf('.gif') > -1) token = 'gif';
        if (token == '') return null;

        var start = line.indexOf(token);
        if (start == -1) return null;
        var stop = line.indexOf('}');
        if (stop == -1) return null;
        var len = stop - start;
        if (len == 0) return null;

        var str = line.substr(start , len);
        var parts = str.split( " " );
        parts[1]= parts[1].replace(/"/g,"");

        return parts[1];
    }
    function getAttributeBumpSize( line ) {

        var start = line.indexOf('bump_size');
        if (start == -1) return 0;

        var str = line.substr(start);
        var parts = str.split( " " );
        return parts[1];
    }
    function getStatistics(){
        var counterFaces = 0;
        var counterVertices = 0;

        console.log( "// begin Statistics" );
        console.log( shapes.length + "  <Shape> nodes");

        for ( i = 0; i < geometries.length; i++ ){
            counterFaces += geometries[i].faces.length;
            counterVertices += geometries[i].vertices.length;
            console.log(geometries[i]);
        }
        console.log( counterVertices + "  vertices");
        console.log( counterFaces + "  faces");

        console.log( materials.length + "  <Material> nodes");
        console.log( imageTextures.length + "  <ImageTexture> nodes");
        console.log( textureTransforms.length + "  <TextureTransforms> nodes");


        console.log( transforms.length + "  <Transform> nodes");
        console.log( groups.length + "  <Group> nodes");
        console.log( scenes.length + "  <Scene> nodes");

        console.log('list of group names:');

        for (var i = 0; i < groups.length; i++){
            if(groups[i].name.indexOf('noName') == -1) console.log(groups[i].name);
        }
        console.log( "//  end statistics");

    }
    function isInList( name, names ) {
        for ( var i = 0; i <  names.length; i++ ){
            if ( name == names[ i ] ) return i;
        }
        return null;
    }
    function isNameInList( name, list ) {
        for ( var i = 0; i <  list.length; i++ ){
            if ( name == list[ i ].name ) return i;
        }
        return -1;
    }

    function parseFinish( line ) {
        var value;

        value = getAttributeFloat(line, 'ambient');
        if (value != null) finish.ambient = value; // set value or default
        value = getAttributeFloat(line, 'diffuse');
        if (value != null) finish.diffuse = value; // set value or default
        value = getAttributeFloat(line, 'reflection');
        if (value != null) {
            finish.reflection = value; // set value or default
        }
        value = getAttributeFloat( line, 'specular' );
        if (value != null) finish.specular =  value ; // set value or default
        value = getAttributeFloat( line, 'brilliance' );
        if (value != null) finish.brilliance =  value ; // set value or default
        value = getAttributeFloat( line, 'metallic' );
        if (value != null) finish.metallic =  value ; // set value or default

        if (options.verbose) console.log(finish);
    }
    function parseNormal( line ) {
        var value;
        value = getAttributeTextureUrl( line) ;
        if (value != null) {
            normal.uv_mapping = true;
            normal.url = value;
            if(value.indexOf('.bmp')> -1 ) console.error('not a valid texture type .bmp ', value );
            normal.bump_size = getAttributeBumpSize(line);
        }
        else{
            normal.uv_mapping = false;
            normal.url = '';
            normal.bump_size = 0;
        }

        if (options.verbose) console.log(pigment);
    }
    function parsePigment( line ) {
        var value;
        value = getAttributeColor( line );
        if (value != null && value.length == 3 ) {
            pigment.rgb  =  new THREE.Color( value[0], value[1], value[2] );
        }
        if (value != null && value.length == 4 ) {
            pigment.rgb  =  new THREE.Color( value[0], value[1], value[2] );
            pigment.transmit  =  value[3];
        }

        value = getAttributeTextureUrl( line) ;

        if (value != null) {
            pigment.uv_mapping = true;
            pigment.url = value;
            if(line.indexOf('transmit')> -1 ){
                var parts = line.split( " " );
                if (parts[16] == 'all') {
                    pigment.transmit = 0.75;   // just to see a little bit
                }
                else{
                    pigment.transmit = 1-parts[16];
                    pigment.transmit =0.15;
                }
            }
            if(value.indexOf('.bmp')> -1 ) console.error('not a valid texture type .bmp ', value );
        }
        else{
            pigment.uv_mapping = false;
            pigment.url = '';

        }

        if (options.verbose) console.log(pigment);
    }
    function parseTile( line ) {
        var value;

        value = getAttributeFloat(line, 'rotation');
        if (value != null) tile.rotation = value; // set value or default

        var parts = line.split( " " );

        for (var i = 0; i < parts.length; i++){
            if( parts[i] == 'size') {
                tile.size.u = parseFloat( parts[i+2] );
                tile.size.v = parseFloat( parts[i+3] );
            }
            if( parts[i] == 'offset') {
                tile.offset.x = parseFloat( parts[i+2] );
                tile.offset.y = parseFloat( parts[i+3] );
            }
        }

        if (options.verbose) console.log(tile);
    }
    function parseTexture( parts ) {

        var factor = 1.0;
        var repeat = 0.999999;
        var link;

        var ambientColor = new THREE.Color(factor*finish.ambient * pigment.rgb.r, factor*finish.ambient * pigment.rgb.g, factor*finish.ambient * pigment.rgb.b );
        var diffuseColor = new THREE.Color(factor*finish.diffuse * pigment.rgb.r, factor*finish.diffuse * pigment.rgb.g, factor*finish.diffuse * pigment.rgb.b );
        var specularColor = new THREE.Color(factor*finish.specular * pigment.rgb.r, factor*finish.specular * pigment.rgb.g, factor*finish.specular * pigment.rgb.b );

        material = new THREE.MeshPhongMaterial({
            name :   parts[1],
            ambient: ambientColor,
            color: diffuseColor,
            specular: specularColor
        });

        if(finish.brilliance > 1)
            material.shininess = 30.0*finish.brilliance;  // shininess = 30 is the default for THREE js

        if( options.solid ) material.side = THREE.DoubleSide;

        if(pigment.transmit > 0 ){
            material.transparent = true;
            if(pigment.transmit > 1) pigment.transmit = 1;
            material.opacity = Math.abs( 1 - pigment.transmit );
            //if (material.opacity <= .25) {material.opacity = Math.sqrt(material.opacity + .03) }
            var b0 = 0.321;  // 1. Berndsche Konstante
            material.opacity = b0 +( 1 - b0 )* material.opacity;
            material.specular = new THREE.Color(1,1,1);
           // material.emissive = new THREE.Color(0.5,0.5,0.5);
        }

        if (pigment.uv_mapping){
            link =  baseUrl + pigment.url ;
            texture = THREE.ImageUtils.loadTexture( link );
            texture.wrapS =  THREE.RepeatWrapping ;
            texture.wrapT = THREE.RepeatWrapping  ;
            texture.repeat.set( repeat, repeat ) ;
            material.map = texture;
            material.specularMap = texture;
            material.diffuseMap =  texture;
            material = new THREE.MeshPhongMaterial({map: texture, specularMap: texture, diffuseMap: texture, name: parts[1] });
            //if(pigment.transmit > 0)  material.transparent = true;
            if(pigment.transmit > 0 ){
                material.transparent = true;
                material.depthWrite = false;
                if(pigment.transmit > 1) pigment.transmit = 1;
                material.opacity = Math.abs( 1 - pigment.transmit );
                //if (material.opacity <= .25) {material.opacity = Math.sqrt(material.opacity + .3) }
                var b0 = 0.321;  // 1. Berndsche Konstante
                material.opacity = b0 +( 1 - b0 )* material.opacity;
                material.specular = new THREE.Color(1,1,1);
            //    material.emissive = new THREE.Color(0.5,0.5,0.5);
            }
        }

        if (normal.uv_mapping && options.bump){
            link =  baseUrl + normal.url ;
            texture = THREE.ImageUtils.loadTexture( link );
            texture.wrapS =  THREE.RepeatWrapping ;
            texture.wrapT = THREE.RepeatWrapping  ;
            texture.repeat.set( repeat, repeat ) ;
            material.bumpMap = texture;
            material.bumpScale = 0.05*normal.bump_size*options.bumpFactor;
        }

        if (finish.reflection > options.thresholdReflection){
            materialWithCameraNames.push(material.name);
        }

        if (tile.name != ''){
            material.map.repeat.set(tile.size.u, tile.size.v);
            material.map.offset.set(tile.offset.x, tile.offset.y);
            material.bumpMap.repeat.set(tile.size.u, tile.size.v);
            material.bumpMap.offset.set(tile.offset.x, tile.offset.y);

            material.userData = {rotation: tile.rotation, size: tile.size, offset: tile.offset };


            material.userData += tile;
            setDefaultTile();
        }

        materials.push(material) ;

        pigment.transmit = 0;
        pigment.uv_mapping = false;
        normal.uv_mapping = false;
    }

    function setDefaultMaterial() {
        var ambientColor;
        var diffuseColor;
        var specularColor;

        ambientColor = new THREE.Color(  0.4, 0.0, 0.4 ); // set value or default
        diffuseColor =  new THREE.Color( 0.8, 0.8, 0.8 ); // set value or default
        specularColor = new THREE.Color( 1.0, 1.0, 1.0 ); // set value or default

        if ( options.defaultMaterial == SPECULAR )
            material = new THREE.MeshPhongMaterial( {
                ambient: ambientColor,
                color: diffuseColor,
                specular: specularColor
            } );

        if ( options.defaultMaterial == DIFFUSE )
            material = new THREE.MeshLambertMaterial( {
                ambient: ambientColor,
                color: diffuseColor
            } );

        if ( options.defaultMaterial == AMBIENT )
            material = new THREE.MeshBasicMaterial( {
                color: ambientColor
            } );

        if( options.solid ) material.side = THREE.DoubleSide;

        // give a name
        material.name =  generateUniqueDEF( 'material_default' ) ;
        materials.push( material );
    }

    function setDefaultTile() {
        // object contains information for tiling a texture
        tile.name = '';
        tile.size.u = 1000;
        tile.size.v = 1000;
        tile.rotation = 0.0;
        tile.offset.x = 0;
        tile.offset.y = 0;
    }

    return {
        load: load,
        parse: parse,
        geometries : geometries,
        materials : materials,
        reflectances : reflectances,
        lights: lights,
        cameras: cameras,
        options: options
    };
};
return THREE.POVLoader;

});
/**
* @author Tim Knip / http://www.floorplanner.com/ / tim at floorplanner.com
* @author Tony Parisi / http://www.tonyparisi.com/
*/
define('POVLoader',["extras/loaders/POVLoader.Parser"], function( POVParser ) {
    var POVLoader = function ()
    {
        this.parser = new POVParser();
    };

    POVLoader.prototype.load = function(url, readyCallback, progressCallback)
    {
        if(url == null || url == undefined || url == "" ) {
            var callBack = callBack || readyCallbackFunc;
            if(callBack) callBack(null);
            else return null  ;
        };

        if (document.implementation && document.implementation.createDocument) {
            require(["text!" + url], function ( responseText ) {
                
                readyCallbackFunc = readyCallback;

                this.parser.parse(responseText, readyCallback, url);
            }.bind(this));
        } else {
            alert("Don't know how to parse XML!");
        }
    };

    return POVLoader;
});

define('vendor/three/loaders/GLTFLoader',["three"], function(THREE){
/**
 * @author Rich Tibbett / https://github.com/richtr
 * @author mrdoob / http://mrdoob.com/
 * @author Tony Parisi / http://www.tonyparisi.com/
 * @author Takahiro / https://github.com/takahirox
 * @author Don McCurdy / https://www.donmccurdy.com
 */

THREE.GLTFLoader = ( function () {

	function GLTFLoader( manager ) {

		this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;
		this.dracoLoader = null;

	}

	GLTFLoader.prototype = {

		constructor: GLTFLoader,

		crossOrigin: 'anonymous',

		load: function ( url, onLoad, onProgress, onError ) {

			var scope = this;

			var resourcePath;

			if ( this.resourcePath !== undefined ) {

				resourcePath = this.resourcePath;

			} else if ( this.path !== undefined ) {

				resourcePath = this.path;

			} else {

				resourcePath = THREE.LoaderUtils.extractUrlBase( url );

			}

			// Tells the LoadingManager to track an extra item, which resolves after
			// the model is fully loaded. This means the count of items loaded will
			// be incorrect, but ensures manager.onLoad() does not fire early.
			scope.manager.itemStart( url );

			var _onError = function ( e ) {

				if ( onError ) {

					onError( e );

				} else {

					console.error( e );

				}

				scope.manager.itemError( url );
				scope.manager.itemEnd( url );

			};

			var loader = new THREE.FileLoader( scope.manager );

			loader.setPath( this.path );
			loader.setResponseType( 'arraybuffer' );

			loader.load( url, function ( data ) {

				try {

					scope.parse( data, resourcePath, function ( gltf ) {

						onLoad( gltf );

						scope.manager.itemEnd( url );

					}, _onError );

				} catch ( e ) {

					_onError( e );

				}

			}, onProgress, _onError );

		},

		setCrossOrigin: function ( value ) {

			this.crossOrigin = value;
			return this;

		},

		setPath: function ( value ) {

			this.path = value;
			return this;

		},

		setResourcePath: function ( value ) {

			this.resourcePath = value;
			return this;

		},

		setDRACOLoader: function ( dracoLoader ) {

			this.dracoLoader = dracoLoader;
			return this;

		},

		parse: function ( data, path, onLoad, onError ) {

			var content;
			var extensions = {};

			if ( typeof data === 'string' ) {

				content = data;

			} else {

				var magic = THREE.LoaderUtils.decodeText( new Uint8Array( data, 0, 4 ) );

				if ( magic === BINARY_EXTENSION_HEADER_MAGIC ) {

					try {

						extensions[ EXTENSIONS.KHR_BINARY_GLTF ] = new GLTFBinaryExtension( data );

					} catch ( error ) {

						if ( onError ) onError( error );
						return;

					}

					content = extensions[ EXTENSIONS.KHR_BINARY_GLTF ].content;

				} else {

					content = THREE.LoaderUtils.decodeText( new Uint8Array( data ) );

				}

			}

			var json = JSON.parse( content );

			if ( json.asset === undefined || json.asset.version[ 0 ] < 2 ) {

				if ( onError ) onError( new Error( 'THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported. Use LegacyGLTFLoader instead.' ) );
				return;

			}

			if ( json.extensionsUsed ) {

				for ( var i = 0; i < json.extensionsUsed.length; ++ i ) {

					var extensionName = json.extensionsUsed[ i ];
					var extensionsRequired = json.extensionsRequired || [];

					switch ( extensionName ) {

						case EXTENSIONS.KHR_LIGHTS_PUNCTUAL:
							extensions[ extensionName ] = new GLTFLightsExtension( json );
							break;

						case EXTENSIONS.KHR_MATERIALS_UNLIT:
							extensions[ extensionName ] = new GLTFMaterialsUnlitExtension( json );
							break;

						case EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS:
							extensions[ extensionName ] = new GLTFMaterialsPbrSpecularGlossinessExtension( json );
							break;

						case EXTENSIONS.KHR_DRACO_MESH_COMPRESSION:
							extensions[ extensionName ] = new GLTFDracoMeshCompressionExtension( json, this.dracoLoader );
							break;

						case EXTENSIONS.MSFT_TEXTURE_DDS:
							extensions[ EXTENSIONS.MSFT_TEXTURE_DDS ] = new GLTFTextureDDSExtension();
							break;

						case EXTENSIONS.KHR_TEXTURE_TRANSFORM:
							extensions[ EXTENSIONS.KHR_TEXTURE_TRANSFORM ] = new GLTFTextureTransformExtension( json );
							break;

						default:

							if ( extensionsRequired.indexOf( extensionName ) >= 0 ) {

								console.warn( 'THREE.GLTFLoader: Unknown extension "' + extensionName + '".' );

							}

					}

				}

			}

			var parser = new GLTFParser( json, extensions, {

				path: path || this.resourcePath || '',
				crossOrigin: this.crossOrigin,
				manager: this.manager

			} );

			parser.parse( function ( scene, scenes, cameras, animations, json ) {

				var glTF = {
					scene: scene,
					scenes: scenes,
					cameras: cameras,
					animations: animations,
					asset: json.asset,
					parser: parser,
					userData: {}
				};

				addUnknownExtensionsToUserData( extensions, glTF, json );

				onLoad( glTF );

			}, onError );

		}

	};

	/* GLTFREGISTRY */

	function GLTFRegistry() {

		var objects = {};

		return	{

			get: function ( key ) {

				return objects[ key ];

			},

			add: function ( key, object ) {

				objects[ key ] = object;

			},

			remove: function ( key ) {

				delete objects[ key ];

			},

			removeAll: function () {

				objects = {};

			}

		};

	}

	/*********************************/
	/********** EXTENSIONS ***********/
	/*********************************/

	var EXTENSIONS = {
		KHR_BINARY_GLTF: 'KHR_binary_glTF',
		KHR_DRACO_MESH_COMPRESSION: 'KHR_draco_mesh_compression',
		KHR_LIGHTS_PUNCTUAL: 'KHR_lights_punctual',
		KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS: 'KHR_materials_pbrSpecularGlossiness',
		KHR_MATERIALS_UNLIT: 'KHR_materials_unlit',
		KHR_TEXTURE_TRANSFORM: 'KHR_texture_transform',
		MSFT_TEXTURE_DDS: 'MSFT_texture_dds'
	};

	/**
	 * DDS Texture Extension
	 *
	 * Specification:
	 * https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/MSFT_texture_dds
	 *
	 */
	function GLTFTextureDDSExtension() {

		if ( ! THREE.DDSLoader ) {

			throw new Error( 'THREE.GLTFLoader: Attempting to load .dds texture without importing THREE.DDSLoader' );

		}

		this.name = EXTENSIONS.MSFT_TEXTURE_DDS;
		this.ddsLoader = new THREE.DDSLoader();

	}

	/**
	 * Lights Extension
	 *
	 * Specification: PENDING
	 */
	function GLTFLightsExtension( json ) {

		this.name = EXTENSIONS.KHR_LIGHTS_PUNCTUAL;

		var extension = ( json.extensions && json.extensions[ EXTENSIONS.KHR_LIGHTS_PUNCTUAL ] ) || {};
		this.lightDefs = extension.lights || [];

	}

	GLTFLightsExtension.prototype.loadLight = function ( lightIndex ) {

		var lightDef = this.lightDefs[ lightIndex ];
		var lightNode;

		var color = new THREE.Color( 0xffffff );
		if ( lightDef.color !== undefined ) color.fromArray( lightDef.color );

		var range = lightDef.range !== undefined ? lightDef.range : 0;

		switch ( lightDef.type ) {

			case 'directional':
				lightNode = new THREE.DirectionalLight( color );
				lightNode.target.position.set( 0, 0, - 1 );
				lightNode.add( lightNode.target );
				break;

			case 'point':
				lightNode = new THREE.PointLight( color );
				lightNode.distance = range;
				break;

			case 'spot':
				lightNode = new THREE.SpotLight( color );
				lightNode.distance = range;
				// Handle spotlight properties.
				lightDef.spot = lightDef.spot || {};
				lightDef.spot.innerConeAngle = lightDef.spot.innerConeAngle !== undefined ? lightDef.spot.innerConeAngle : 0;
				lightDef.spot.outerConeAngle = lightDef.spot.outerConeAngle !== undefined ? lightDef.spot.outerConeAngle : Math.PI / 4.0;
				lightNode.angle = lightDef.spot.outerConeAngle;
				lightNode.penumbra = 1.0 - lightDef.spot.innerConeAngle / lightDef.spot.outerConeAngle;
				lightNode.target.position.set( 0, 0, - 1 );
				lightNode.add( lightNode.target );
				break;

			default:
				throw new Error( 'THREE.GLTFLoader: Unexpected light type, "' + lightDef.type + '".' );

		}

		// Some lights (e.g. spot) default to a position other than the origin. Reset the position
		// here, because node-level parsing will only override position if explicitly specified.
		lightNode.position.set( 0, 0, 0 );

		lightNode.decay = 2;

		if ( lightDef.intensity !== undefined ) lightNode.intensity = lightDef.intensity;

		lightNode.name = lightDef.name || ( 'light_' + lightIndex );

		return Promise.resolve( lightNode );

	};

	/**
	 * Unlit Materials Extension (pending)
	 *
	 * PR: https://github.com/KhronosGroup/glTF/pull/1163
	 */
	function GLTFMaterialsUnlitExtension( json ) {

		this.name = EXTENSIONS.KHR_MATERIALS_UNLIT;

	}

	GLTFMaterialsUnlitExtension.prototype.getMaterialType = function ( material ) {

		return THREE.MeshBasicMaterial;

	};

	GLTFMaterialsUnlitExtension.prototype.extendParams = function ( materialParams, material, parser ) {

		var pending = [];

		materialParams.color = new THREE.Color( 1.0, 1.0, 1.0 );
		materialParams.opacity = 1.0;

		var metallicRoughness = material.pbrMetallicRoughness;

		if ( metallicRoughness ) {

			if ( Array.isArray( metallicRoughness.baseColorFactor ) ) {

				var array = metallicRoughness.baseColorFactor;

				materialParams.color.fromArray( array );
				materialParams.opacity = array[ 3 ];

			}

			if ( metallicRoughness.baseColorTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'map', metallicRoughness.baseColorTexture ) );

			}

		}

		return Promise.all( pending );

	};

	/* BINARY EXTENSION */

	var BINARY_EXTENSION_BUFFER_NAME = 'binary_glTF';
	var BINARY_EXTENSION_HEADER_MAGIC = 'glTF';
	var BINARY_EXTENSION_HEADER_LENGTH = 12;
	var BINARY_EXTENSION_CHUNK_TYPES = { JSON: 0x4E4F534A, BIN: 0x004E4942 };

	function GLTFBinaryExtension( data ) {

		this.name = EXTENSIONS.KHR_BINARY_GLTF;
		this.content = null;
		this.body = null;

		var headerView = new DataView( data, 0, BINARY_EXTENSION_HEADER_LENGTH );

		this.header = {
			magic: THREE.LoaderUtils.decodeText( new Uint8Array( data.slice( 0, 4 ) ) ),
			version: headerView.getUint32( 4, true ),
			length: headerView.getUint32( 8, true )
		};

		if ( this.header.magic !== BINARY_EXTENSION_HEADER_MAGIC ) {

			throw new Error( 'THREE.GLTFLoader: Unsupported glTF-Binary header.' );

		} else if ( this.header.version < 2.0 ) {

			throw new Error( 'THREE.GLTFLoader: Legacy binary file detected. Use LegacyGLTFLoader instead.' );

		}

		var chunkView = new DataView( data, BINARY_EXTENSION_HEADER_LENGTH );
		var chunkIndex = 0;

		while ( chunkIndex < chunkView.byteLength ) {

			var chunkLength = chunkView.getUint32( chunkIndex, true );
			chunkIndex += 4;

			var chunkType = chunkView.getUint32( chunkIndex, true );
			chunkIndex += 4;

			if ( chunkType === BINARY_EXTENSION_CHUNK_TYPES.JSON ) {

				var contentArray = new Uint8Array( data, BINARY_EXTENSION_HEADER_LENGTH + chunkIndex, chunkLength );
				this.content = THREE.LoaderUtils.decodeText( contentArray );

			} else if ( chunkType === BINARY_EXTENSION_CHUNK_TYPES.BIN ) {

				var byteOffset = BINARY_EXTENSION_HEADER_LENGTH + chunkIndex;
				this.body = data.slice( byteOffset, byteOffset + chunkLength );

			}

			// Clients must ignore chunks with unknown types.

			chunkIndex += chunkLength;

		}

		if ( this.content === null ) {

			throw new Error( 'THREE.GLTFLoader: JSON content not found.' );

		}

	}

	/**
	 * DRACO Mesh Compression Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/pull/874
	 */
	function GLTFDracoMeshCompressionExtension( json, dracoLoader ) {

		if ( ! dracoLoader ) {

			throw new Error( 'THREE.GLTFLoader: No DRACOLoader instance provided.' );

		}

		this.name = EXTENSIONS.KHR_DRACO_MESH_COMPRESSION;
		this.json = json;
		this.dracoLoader = dracoLoader;
		THREE.DRACOLoader.getDecoderModule();

	}

	GLTFDracoMeshCompressionExtension.prototype.decodePrimitive = function ( primitive, parser ) {

		var json = this.json;
		var dracoLoader = this.dracoLoader;
		var bufferViewIndex = primitive.extensions[ this.name ].bufferView;
		var gltfAttributeMap = primitive.extensions[ this.name ].attributes;
		var threeAttributeMap = {};
		var attributeNormalizedMap = {};
		var attributeTypeMap = {};

		for ( var attributeName in gltfAttributeMap ) {

			if ( ! ( attributeName in ATTRIBUTES ) ) continue;

			threeAttributeMap[ ATTRIBUTES[ attributeName ] ] = gltfAttributeMap[ attributeName ];

		}

		for ( attributeName in primitive.attributes ) {

			if ( ATTRIBUTES[ attributeName ] !== undefined && gltfAttributeMap[ attributeName ] !== undefined ) {

				var accessorDef = json.accessors[ primitive.attributes[ attributeName ] ];
				var componentType = WEBGL_COMPONENT_TYPES[ accessorDef.componentType ];

				attributeTypeMap[ ATTRIBUTES[ attributeName ] ] = componentType;
				attributeNormalizedMap[ ATTRIBUTES[ attributeName ] ] = accessorDef.normalized === true;

			}

		}

		return parser.getDependency( 'bufferView', bufferViewIndex ).then( function ( bufferView ) {

			return new Promise( function ( resolve ) {

				dracoLoader.decodeDracoFile( bufferView, function ( geometry ) {

					for ( var attributeName in geometry.attributes ) {

						var attribute = geometry.attributes[ attributeName ];
						var normalized = attributeNormalizedMap[ attributeName ];

						if ( normalized !== undefined ) attribute.normalized = normalized;

					}

					resolve( geometry );

				}, threeAttributeMap, attributeTypeMap );

			} );

		} );

	};

	/**
	 * Texture Transform Extension
	 *
	 * Specification:
	 */
	function GLTFTextureTransformExtension( json ) {

		this.name = EXTENSIONS.KHR_TEXTURE_TRANSFORM;

	}

	GLTFTextureTransformExtension.prototype.extendTexture = function ( texture, transform ) {

		texture = texture.clone();

		if ( transform.offset !== undefined ) {

			texture.offset.fromArray( transform.offset );

		}

		if ( transform.rotation !== undefined ) {

			texture.rotation = transform.rotation;

		}

		if ( transform.scale !== undefined ) {

			texture.repeat.fromArray( transform.scale );

		}

		if ( transform.texCoord !== undefined ) {

			console.warn( 'THREE.GLTFLoader: Custom UV sets in "' + this.name + '" extension not yet supported.' );

		}

		texture.needsUpdate = true;

		return texture;

	};

	/**
	 * Specular-Glossiness Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_pbrSpecularGlossiness
	 */
	function GLTFMaterialsPbrSpecularGlossinessExtension() {

		return {

			name: EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS,

			specularGlossinessParams: [
				'color',
				'map',
				'lightMap',
				'lightMapIntensity',
				'aoMap',
				'aoMapIntensity',
				'emissive',
				'emissiveIntensity',
				'emissiveMap',
				'bumpMap',
				'bumpScale',
				'normalMap',
				'displacementMap',
				'displacementScale',
				'displacementBias',
				'specularMap',
				'specular',
				'glossinessMap',
				'glossiness',
				'alphaMap',
				'envMap',
				'envMapIntensity',
				'refractionRatio',
			],

			getMaterialType: function () {

				return THREE.ShaderMaterial;

			},

			extendParams: function ( params, material, parser ) {

				var pbrSpecularGlossiness = material.extensions[ this.name ];

				var shader = THREE.ShaderLib[ 'standard' ];

				var uniforms = THREE.UniformsUtils.clone( shader.uniforms );

				var specularMapParsFragmentChunk = [
					'#ifdef USE_SPECULARMAP',
					'	uniform sampler2D specularMap;',
					'#endif'
				].join( '\n' );

				var glossinessMapParsFragmentChunk = [
					'#ifdef USE_GLOSSINESSMAP',
					'	uniform sampler2D glossinessMap;',
					'#endif'
				].join( '\n' );

				var specularMapFragmentChunk = [
					'vec3 specularFactor = specular;',
					'#ifdef USE_SPECULARMAP',
					'	vec4 texelSpecular = texture2D( specularMap, vUv );',
					'	texelSpecular = sRGBToLinear( texelSpecular );',
					'	// reads channel RGB, compatible with a glTF Specular-Glossiness (RGBA) texture',
					'	specularFactor *= texelSpecular.rgb;',
					'#endif'
				].join( '\n' );

				var glossinessMapFragmentChunk = [
					'float glossinessFactor = glossiness;',
					'#ifdef USE_GLOSSINESSMAP',
					'	vec4 texelGlossiness = texture2D( glossinessMap, vUv );',
					'	// reads channel A, compatible with a glTF Specular-Glossiness (RGBA) texture',
					'	glossinessFactor *= texelGlossiness.a;',
					'#endif'
				].join( '\n' );

				var lightPhysicalFragmentChunk = [
					'PhysicalMaterial material;',
					'material.diffuseColor = diffuseColor.rgb;',
					'material.specularRoughness = clamp( 1.0 - glossinessFactor, 0.04, 1.0 );',
					'material.specularColor = specularFactor.rgb;',
				].join( '\n' );

				var fragmentShader = shader.fragmentShader
					.replace( 'uniform float roughness;', 'uniform vec3 specular;' )
					.replace( 'uniform float metalness;', 'uniform float glossiness;' )
					.replace( '#include <roughnessmap_pars_fragment>', specularMapParsFragmentChunk )
					.replace( '#include <metalnessmap_pars_fragment>', glossinessMapParsFragmentChunk )
					.replace( '#include <roughnessmap_fragment>', specularMapFragmentChunk )
					.replace( '#include <metalnessmap_fragment>', glossinessMapFragmentChunk )
					.replace( '#include <lights_physical_fragment>', lightPhysicalFragmentChunk );

				delete uniforms.roughness;
				delete uniforms.metalness;
				delete uniforms.roughnessMap;
				delete uniforms.metalnessMap;

				uniforms.specular = { value: new THREE.Color().setHex( 0x111111 ) };
				uniforms.glossiness = { value: 0.5 };
				uniforms.specularMap = { value: null };
				uniforms.glossinessMap = { value: null };

				params.vertexShader = shader.vertexShader;
				params.fragmentShader = fragmentShader;
				params.uniforms = uniforms;
				params.defines = { 'STANDARD': '' };

				params.color = new THREE.Color( 1.0, 1.0, 1.0 );
				params.opacity = 1.0;

				var pending = [];

				if ( Array.isArray( pbrSpecularGlossiness.diffuseFactor ) ) {

					var array = pbrSpecularGlossiness.diffuseFactor;

					params.color.fromArray( array );
					params.opacity = array[ 3 ];

				}

				if ( pbrSpecularGlossiness.diffuseTexture !== undefined ) {

					pending.push( parser.assignTexture( params, 'map', pbrSpecularGlossiness.diffuseTexture ) );

				}

				params.emissive = new THREE.Color( 0.0, 0.0, 0.0 );
				params.glossiness = pbrSpecularGlossiness.glossinessFactor !== undefined ? pbrSpecularGlossiness.glossinessFactor : 1.0;
				params.specular = new THREE.Color( 1.0, 1.0, 1.0 );

				if ( Array.isArray( pbrSpecularGlossiness.specularFactor ) ) {

					params.specular.fromArray( pbrSpecularGlossiness.specularFactor );

				}

				if ( pbrSpecularGlossiness.specularGlossinessTexture !== undefined ) {

					var specGlossMapDef = pbrSpecularGlossiness.specularGlossinessTexture;
					pending.push( parser.assignTexture( params, 'glossinessMap', specGlossMapDef ) );
					pending.push( parser.assignTexture( params, 'specularMap', specGlossMapDef ) );

				}

				return Promise.all( pending );

			},

			createMaterial: function ( params ) {

				// setup material properties based on MeshStandardMaterial for Specular-Glossiness

				var material = new THREE.ShaderMaterial( {
					defines: params.defines,
					vertexShader: params.vertexShader,
					fragmentShader: params.fragmentShader,
					uniforms: params.uniforms,
					fog: true,
					lights: true,
					opacity: params.opacity,
					transparent: params.transparent
				} );

				material.isGLTFSpecularGlossinessMaterial = true;

				material.color = params.color;

				material.map = params.map === undefined ? null : params.map;

				material.lightMap = null;
				material.lightMapIntensity = 1.0;

				material.aoMap = params.aoMap === undefined ? null : params.aoMap;
				material.aoMapIntensity = 1.0;

				material.emissive = params.emissive;
				material.emissiveIntensity = 1.0;
				material.emissiveMap = params.emissiveMap === undefined ? null : params.emissiveMap;

				material.bumpMap = params.bumpMap === undefined ? null : params.bumpMap;
				material.bumpScale = 1;

				material.normalMap = params.normalMap === undefined ? null : params.normalMap;
				if ( params.normalScale ) material.normalScale = params.normalScale;

				material.displacementMap = null;
				material.displacementScale = 1;
				material.displacementBias = 0;

				material.specularMap = params.specularMap === undefined ? null : params.specularMap;
				material.specular = params.specular;

				material.glossinessMap = params.glossinessMap === undefined ? null : params.glossinessMap;
				material.glossiness = params.glossiness;

				material.alphaMap = null;

				material.envMap = params.envMap === undefined ? null : params.envMap;
				material.envMapIntensity = 1.0;

				material.refractionRatio = 0.98;

				material.extensions.derivatives = true;

				return material;

			},

			/**
			 * Clones a GLTFSpecularGlossinessMaterial instance. The ShaderMaterial.copy() method can
			 * copy only properties it knows about or inherits, and misses many properties that would
			 * normally be defined by MeshStandardMaterial.
			 *
			 * This method allows GLTFSpecularGlossinessMaterials to be cloned in the process of
			 * loading a glTF model, but cloning later (e.g. by the user) would require these changes
			 * AND also updating `.onBeforeRender` on the parent mesh.
			 *
			 * @param  {THREE.ShaderMaterial} source
			 * @return {THREE.ShaderMaterial}
			 */
			cloneMaterial: function ( source ) {

				var target = source.clone();

				target.isGLTFSpecularGlossinessMaterial = true;

				var params = this.specularGlossinessParams;

				for ( var i = 0, il = params.length; i < il; i ++ ) {

					target[ params[ i ] ] = source[ params[ i ] ];

				}

				return target;

			},

			// Here's based on refreshUniformsCommon() and refreshUniformsStandard() in WebGLRenderer.
			refreshUniforms: function ( renderer, scene, camera, geometry, material, group ) {

				if ( material.isGLTFSpecularGlossinessMaterial !== true ) {

					return;

				}

				var uniforms = material.uniforms;
				var defines = material.defines;

				uniforms.opacity.value = material.opacity;

				uniforms.diffuse.value.copy( material.color );
				uniforms.emissive.value.copy( material.emissive ).multiplyScalar( material.emissiveIntensity );

				uniforms.map.value = material.map;
				uniforms.specularMap.value = material.specularMap;
				uniforms.alphaMap.value = material.alphaMap;

				uniforms.lightMap.value = material.lightMap;
				uniforms.lightMapIntensity.value = material.lightMapIntensity;

				uniforms.aoMap.value = material.aoMap;
				uniforms.aoMapIntensity.value = material.aoMapIntensity;

				// uv repeat and offset setting priorities
				// 1. color map
				// 2. specular map
				// 3. normal map
				// 4. bump map
				// 5. alpha map
				// 6. emissive map

				var uvScaleMap;

				if ( material.map ) {

					uvScaleMap = material.map;

				} else if ( material.specularMap ) {

					uvScaleMap = material.specularMap;

				} else if ( material.displacementMap ) {

					uvScaleMap = material.displacementMap;

				} else if ( material.normalMap ) {

					uvScaleMap = material.normalMap;

				} else if ( material.bumpMap ) {

					uvScaleMap = material.bumpMap;

				} else if ( material.glossinessMap ) {

					uvScaleMap = material.glossinessMap;

				} else if ( material.alphaMap ) {

					uvScaleMap = material.alphaMap;

				} else if ( material.emissiveMap ) {

					uvScaleMap = material.emissiveMap;

				}

				if ( uvScaleMap !== undefined ) {

					// backwards compatibility
					if ( uvScaleMap.isWebGLRenderTarget ) {

						uvScaleMap = uvScaleMap.texture;

					}

					if ( uvScaleMap.matrixAutoUpdate === true ) {

						uvScaleMap.updateMatrix();

					}

					uniforms.uvTransform.value.copy( uvScaleMap.matrix );

				}

				if ( material.envMap ) {

					uniforms.envMap.value = material.envMap;
					uniforms.envMapIntensity.value = material.envMapIntensity;

					// don't flip CubeTexture envMaps, flip everything else:
					//  WebGLRenderTargetCube will be flipped for backwards compatibility
					//  WebGLRenderTargetCube.texture will be flipped because it's a Texture and NOT a CubeTexture
					// this check must be handled differently, or removed entirely, if WebGLRenderTargetCube uses a CubeTexture in the future
					uniforms.flipEnvMap.value = material.envMap.isCubeTexture ? - 1 : 1;

					uniforms.reflectivity.value = material.reflectivity;
					uniforms.refractionRatio.value = material.refractionRatio;

					uniforms.maxMipLevel.value = renderer.properties.get( material.envMap ).__maxMipLevel;

				}

				uniforms.specular.value.copy( material.specular );
				uniforms.glossiness.value = material.glossiness;

				uniforms.glossinessMap.value = material.glossinessMap;

				uniforms.emissiveMap.value = material.emissiveMap;
				uniforms.bumpMap.value = material.bumpMap;
				uniforms.normalMap.value = material.normalMap;

				uniforms.displacementMap.value = material.displacementMap;
				uniforms.displacementScale.value = material.displacementScale;
				uniforms.displacementBias.value = material.displacementBias;

				if ( uniforms.glossinessMap.value !== null && defines.USE_GLOSSINESSMAP === undefined ) {

					defines.USE_GLOSSINESSMAP = '';
					// set USE_ROUGHNESSMAP to enable vUv
					defines.USE_ROUGHNESSMAP = '';

				}

				if ( uniforms.glossinessMap.value === null && defines.USE_GLOSSINESSMAP !== undefined ) {

					delete defines.USE_GLOSSINESSMAP;
					delete defines.USE_ROUGHNESSMAP;

				}

			}

		};

	}

	/*********************************/
	/********** INTERPOLATION ********/
	/*********************************/

	// Spline Interpolation
	// Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#appendix-c-spline-interpolation
	function GLTFCubicSplineInterpolant( parameterPositions, sampleValues, sampleSize, resultBuffer ) {

		THREE.Interpolant.call( this, parameterPositions, sampleValues, sampleSize, resultBuffer );

	}

	GLTFCubicSplineInterpolant.prototype = Object.create( THREE.Interpolant.prototype );
	GLTFCubicSplineInterpolant.prototype.constructor = GLTFCubicSplineInterpolant;

	GLTFCubicSplineInterpolant.prototype.copySampleValue_ = function ( index ) {

		// Copies a sample value to the result buffer. See description of glTF
		// CUBICSPLINE values layout in interpolate_() function below.

		var result = this.resultBuffer,
			values = this.sampleValues,
			valueSize = this.valueSize,
			offset = index * valueSize * 3 + valueSize;

		for ( var i = 0; i !== valueSize; i ++ ) {

			result[ i ] = values[ offset + i ];

		}

		return result;

	};

	GLTFCubicSplineInterpolant.prototype.beforeStart_ = GLTFCubicSplineInterpolant.prototype.copySampleValue_;

	GLTFCubicSplineInterpolant.prototype.afterEnd_ = GLTFCubicSplineInterpolant.prototype.copySampleValue_;

	GLTFCubicSplineInterpolant.prototype.interpolate_ = function ( i1, t0, t, t1 ) {

		var result = this.resultBuffer;
		var values = this.sampleValues;
		var stride = this.valueSize;

		var stride2 = stride * 2;
		var stride3 = stride * 3;

		var td = t1 - t0;

		var p = ( t - t0 ) / td;
		var pp = p * p;
		var ppp = pp * p;

		var offset1 = i1 * stride3;
		var offset0 = offset1 - stride3;

		var s2 = - 2 * ppp + 3 * pp;
		var s3 = ppp - pp;
		var s0 = 1 - s2;
		var s1 = s3 - pp + p;

		// Layout of keyframe output values for CUBICSPLINE animations:
		//   [ inTangent_1, splineVertex_1, outTangent_1, inTangent_2, splineVertex_2, ... ]
		for ( var i = 0; i !== stride; i ++ ) {

			var p0 = values[ offset0 + i + stride ]; // splineVertex_k
			var m0 = values[ offset0 + i + stride2 ] * td; // outTangent_k * (t_k+1 - t_k)
			var p1 = values[ offset1 + i + stride ]; // splineVertex_k+1
			var m1 = values[ offset1 + i ] * td; // inTangent_k+1 * (t_k+1 - t_k)

			result[ i ] = s0 * p0 + s1 * m0 + s2 * p1 + s3 * m1;

		}

		return result;

	};

	/*********************************/
	/********** INTERNALS ************/
	/*********************************/

	/* CONSTANTS */

	var WEBGL_CONSTANTS = {
		FLOAT: 5126,
		//FLOAT_MAT2: 35674,
		FLOAT_MAT3: 35675,
		FLOAT_MAT4: 35676,
		FLOAT_VEC2: 35664,
		FLOAT_VEC3: 35665,
		FLOAT_VEC4: 35666,
		LINEAR: 9729,
		REPEAT: 10497,
		SAMPLER_2D: 35678,
		POINTS: 0,
		LINES: 1,
		LINE_LOOP: 2,
		LINE_STRIP: 3,
		TRIANGLES: 4,
		TRIANGLE_STRIP: 5,
		TRIANGLE_FAN: 6,
		UNSIGNED_BYTE: 5121,
		UNSIGNED_SHORT: 5123
	};

	var WEBGL_TYPE = {
		5126: Number,
		//35674: THREE.Matrix2,
		35675: THREE.Matrix3,
		35676: THREE.Matrix4,
		35664: THREE.Vector2,
		35665: THREE.Vector3,
		35666: THREE.Vector4,
		35678: THREE.Texture
	};

	var WEBGL_COMPONENT_TYPES = {
		5120: Int8Array,
		5121: Uint8Array,
		5122: Int16Array,
		5123: Uint16Array,
		5125: Uint32Array,
		5126: Float32Array
	};

	var WEBGL_FILTERS = {
		9728: THREE.NearestFilter,
		9729: THREE.LinearFilter,
		9984: THREE.NearestMipMapNearestFilter,
		9985: THREE.LinearMipMapNearestFilter,
		9986: THREE.NearestMipMapLinearFilter,
		9987: THREE.LinearMipMapLinearFilter
	};

	var WEBGL_WRAPPINGS = {
		33071: THREE.ClampToEdgeWrapping,
		33648: THREE.MirroredRepeatWrapping,
		10497: THREE.RepeatWrapping
	};

	var WEBGL_SIDES = {
		1028: THREE.BackSide, // Culling front
		1029: THREE.FrontSide // Culling back
		//1032: THREE.NoSide   // Culling front and back, what to do?
	};

	var WEBGL_DEPTH_FUNCS = {
		512: THREE.NeverDepth,
		513: THREE.LessDepth,
		514: THREE.EqualDepth,
		515: THREE.LessEqualDepth,
		516: THREE.GreaterEqualDepth,
		517: THREE.NotEqualDepth,
		518: THREE.GreaterEqualDepth,
		519: THREE.AlwaysDepth
	};

	var WEBGL_BLEND_EQUATIONS = {
		32774: THREE.AddEquation,
		32778: THREE.SubtractEquation,
		32779: THREE.ReverseSubtractEquation
	};

	var WEBGL_BLEND_FUNCS = {
		0: THREE.ZeroFactor,
		1: THREE.OneFactor,
		768: THREE.SrcColorFactor,
		769: THREE.OneMinusSrcColorFactor,
		770: THREE.SrcAlphaFactor,
		771: THREE.OneMinusSrcAlphaFactor,
		772: THREE.DstAlphaFactor,
		773: THREE.OneMinusDstAlphaFactor,
		774: THREE.DstColorFactor,
		775: THREE.OneMinusDstColorFactor,
		776: THREE.SrcAlphaSaturateFactor
		// The followings are not supported by Three.js yet
		//32769: CONSTANT_COLOR,
		//32770: ONE_MINUS_CONSTANT_COLOR,
		//32771: CONSTANT_ALPHA,
		//32772: ONE_MINUS_CONSTANT_COLOR
	};

	var WEBGL_TYPE_SIZES = {
		'SCALAR': 1,
		'VEC2': 2,
		'VEC3': 3,
		'VEC4': 4,
		'MAT2': 4,
		'MAT3': 9,
		'MAT4': 16
	};

	var ATTRIBUTES = {
		POSITION: 'position',
		NORMAL: 'normal',
		TANGENT: 'tangent',
		TEXCOORD_0: 'uv',
		TEXCOORD_1: 'uv2',
		COLOR_0: 'color',
		WEIGHTS_0: 'skinWeight',
		JOINTS_0: 'skinIndex',
	};

	var PATH_PROPERTIES = {
		scale: 'scale',
		translation: 'position',
		rotation: 'quaternion',
		weights: 'morphTargetInfluences'
	};

	var INTERPOLATION = {
		CUBICSPLINE: THREE.InterpolateSmooth, // We use custom interpolation GLTFCubicSplineInterpolation for CUBICSPLINE.
		                                      // KeyframeTrack.optimize() can't handle glTF Cubic Spline output values layout,
		                                      // using THREE.InterpolateSmooth for KeyframeTrack instantiation to prevent optimization.
		                                      // See KeyframeTrack.optimize() for the detail.
		LINEAR: THREE.InterpolateLinear,
		STEP: THREE.InterpolateDiscrete
	};

	var STATES_ENABLES = {
		2884: 'CULL_FACE',
		2929: 'DEPTH_TEST',
		3042: 'BLEND',
		3089: 'SCISSOR_TEST',
		32823: 'POLYGON_OFFSET_FILL',
		32926: 'SAMPLE_ALPHA_TO_COVERAGE'
	};

	var ALPHA_MODES = {
		OPAQUE: 'OPAQUE',
		MASK: 'MASK',
		BLEND: 'BLEND'
	};

	var MIME_TYPE_FORMATS = {
		'image/png': THREE.RGBAFormat,
		'image/jpeg': THREE.RGBFormat
	};

	/* UTILITY FUNCTIONS */

	function resolveURL( url, path ) {

		// Invalid URL
		if ( typeof url !== 'string' || url === '' ) return '';

		// Absolute URL http://,https://,//
		if ( /^(https?:)?\/\//i.test( url ) ) return url;

		// Data URI
		if ( /^data:.*,.*$/i.test( url ) ) return url;

		// Blob URL
		if ( /^blob:.*$/i.test( url ) ) return url;

		// Relative URL
		return path + url;

	}

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#default-material
	 */
	function createDefaultMaterial() {

		return new THREE.MeshStandardMaterial( {
			color: 0xFFFFFF,
			emissive: 0x000000,
			metalness: 1,
			roughness: 1,
			transparent: false,
			depthTest: true,
			side: THREE.FrontSide
		} );

	}

	function addUnknownExtensionsToUserData( knownExtensions, object, objectDef ) {

		// Add unknown glTF extensions to an object's userData.

		for ( var name in objectDef.extensions ) {

			if ( knownExtensions[ name ] === undefined ) {

				object.userData.gltfExtensions = object.userData.gltfExtensions || {};
				object.userData.gltfExtensions[ name ] = objectDef.extensions[ name ];

			}

		}

	}

	/**
	 * @param {THREE.Object3D|THREE.Material|THREE.BufferGeometry} object
	 * @param {GLTF.definition} gltfDef
	 */
	function assignExtrasToUserData( object, gltfDef ) {

		if ( gltfDef.extras !== undefined ) {

			if ( typeof gltfDef.extras === 'object' ) {

				object.userData = gltfDef.extras;

			} else {

				console.warn( 'THREE.GLTFLoader: Ignoring primitive type .extras, ' + gltfDef.extras );

			}

		}

	}

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#morph-targets
	 *
	 * @param {THREE.BufferGeometry} geometry
	 * @param {Array<GLTF.Target>} targets
	 * @param {GLTFParser} parser
	 * @return {Promise<THREE.BufferGeometry>}
	 */
	function addMorphTargets( geometry, targets, parser ) {

		var hasMorphPosition = false;
		var hasMorphNormal = false;

		for ( var i = 0, il = targets.length; i < il; i ++ ) {

			var target = targets[ i ];

			if ( target.POSITION !== undefined ) hasMorphPosition = true;
			if ( target.NORMAL !== undefined ) hasMorphNormal = true;

			if ( hasMorphPosition && hasMorphNormal ) break;

		}

		if ( ! hasMorphPosition && ! hasMorphNormal ) return Promise.resolve( geometry );

		var pendingPositionAccessors = [];
		var pendingNormalAccessors = [];

		for ( var i = 0, il = targets.length; i < il; i ++ ) {

			var target = targets[ i ];

			if ( hasMorphPosition ) {

				// TODO: Error-prone use of a callback inside a loop.
				var accessor = target.POSITION !== undefined
					? parser.getDependency( 'accessor', target.POSITION )
						.then( function ( accessor ) {

							// Cloning not to pollute original accessor below
							return cloneBufferAttribute( accessor );

						} )
					: geometry.attributes.position;

				pendingPositionAccessors.push( accessor );

			}

			if ( hasMorphNormal ) {

				// TODO: Error-prone use of a callback inside a loop.
				var accessor = target.NORMAL !== undefined
					? parser.getDependency( 'accessor', target.NORMAL )
						.then( function ( accessor ) {

							return cloneBufferAttribute( accessor );

						} )
					: geometry.attributes.normal;

				pendingNormalAccessors.push( accessor );

			}

		}

		return Promise.all( [
			Promise.all( pendingPositionAccessors ),
			Promise.all( pendingNormalAccessors )
		] ).then( function ( accessors ) {

			var morphPositions = accessors[ 0 ];
			var morphNormals = accessors[ 1 ];

			for ( var i = 0, il = targets.length; i < il; i ++ ) {

				var target = targets[ i ];
				var attributeName = 'morphTarget' + i;

				if ( hasMorphPosition ) {

					// Three.js morph position is absolute value. The formula is
					//   basePosition
					//     + weight0 * ( morphPosition0 - basePosition )
					//     + weight1 * ( morphPosition1 - basePosition )
					//     ...
					// while the glTF one is relative
					//   basePosition
					//     + weight0 * glTFmorphPosition0
					//     + weight1 * glTFmorphPosition1
					//     ...
					// then we need to convert from relative to absolute here.

					if ( target.POSITION !== undefined ) {

						var positionAttribute = morphPositions[ i ];
						positionAttribute.name = attributeName;

						var position = geometry.attributes.position;

						for ( var j = 0, jl = positionAttribute.count; j < jl; j ++ ) {

							positionAttribute.setXYZ(
								j,
								positionAttribute.getX( j ) + position.getX( j ),
								positionAttribute.getY( j ) + position.getY( j ),
								positionAttribute.getZ( j ) + position.getZ( j )
							);

						}

					}

				}

				if ( hasMorphNormal ) {

					// see target.POSITION's comment

					if ( target.NORMAL !== undefined ) {

						var normalAttribute = morphNormals[ i ];
						normalAttribute.name = attributeName;

						var normal = geometry.attributes.normal;

						for ( var j = 0, jl = normalAttribute.count; j < jl; j ++ ) {

							normalAttribute.setXYZ(
								j,
								normalAttribute.getX( j ) + normal.getX( j ),
								normalAttribute.getY( j ) + normal.getY( j ),
								normalAttribute.getZ( j ) + normal.getZ( j )
							);

						}

					}

				}

			}

			if ( hasMorphPosition ) geometry.morphAttributes.position = morphPositions;
			if ( hasMorphNormal ) geometry.morphAttributes.normal = morphNormals;

			return geometry;

		} );

	}

	/**
	 * @param {THREE.Mesh} mesh
	 * @param {GLTF.Mesh} meshDef
	 */
	function updateMorphTargets( mesh, meshDef ) {

		mesh.updateMorphTargets();

		if ( meshDef.weights !== undefined ) {

			for ( var i = 0, il = meshDef.weights.length; i < il; i ++ ) {

				mesh.morphTargetInfluences[ i ] = meshDef.weights[ i ];

			}

		}

		// .extras has user-defined data, so check that .extras.targetNames is an array.
		if ( meshDef.extras && Array.isArray( meshDef.extras.targetNames ) ) {

			var targetNames = meshDef.extras.targetNames;

			if ( mesh.morphTargetInfluences.length === targetNames.length ) {

				mesh.morphTargetDictionary = {};

				for ( var i = 0, il = targetNames.length; i < il; i ++ ) {

					mesh.morphTargetDictionary[ targetNames[ i ] ] = i;

				}

			} else {

				console.warn( 'THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.' );

			}

		}

	}
	function isObjectEqual( a, b ) {

		if ( Object.keys( a ).length !== Object.keys( b ).length ) return false;

		for ( var key in a ) {

			if ( a[ key ] !== b[ key ] ) return false;

		}

		return true;

	}

	function createPrimitiveKey( primitiveDef ) {

		var dracoExtension = primitiveDef.extensions && primitiveDef.extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ];
		var geometryKey;

		if ( dracoExtension ) {

			geometryKey = 'draco:' + dracoExtension.bufferView
				+ ':' + dracoExtension.indices
				+ ':' + createAttributesKey( dracoExtension.attributes );

		} else {

			geometryKey = primitiveDef.indices + ':' + createAttributesKey( primitiveDef.attributes ) + ':' + primitiveDef.mode;

		}

		return geometryKey;

	}

	function createAttributesKey( attributes ) {

		var attributesKey = '';

		var keys = Object.keys( attributes ).sort();

		for ( var i = 0, il = keys.length; i < il; i ++ ) {

			attributesKey += keys[ i ] + ':' + attributes[ keys[ i ] ] + ';';

		}

		return attributesKey;

	}

	function createArrayKeyBufferGeometry( a ) {

		var arrayKey = '';

		for ( var i = 0, il = a.length; i < il; i ++ ) {

			arrayKey += ':' + a[ i ].uuid;

		}

		return arrayKey;

	}

	function createMultiPassGeometryKey( geometry, primitives ) {

		var key = geometry.uuid;

		for ( var i = 0, il = primitives.length; i < il; i ++ ) {

			key += i + createPrimitiveKey( primitives[ i ] );

		}

		return key;

	}

	function cloneBufferAttribute( attribute ) {

		if ( attribute.isInterleavedBufferAttribute ) {

			var count = attribute.count;
			var itemSize = attribute.itemSize;
			var array = attribute.array.slice( 0, count * itemSize );

			for ( var i = 0, j = 0; i < count; ++ i ) {

				array[ j ++ ] = attribute.getX( i );
				if ( itemSize >= 2 ) array[ j ++ ] = attribute.getY( i );
				if ( itemSize >= 3 ) array[ j ++ ] = attribute.getZ( i );
				if ( itemSize >= 4 ) array[ j ++ ] = attribute.getW( i );

			}

			return new THREE.BufferAttribute( array, itemSize, attribute.normalized );

		}

		return attribute.clone();

	}

	/**
	 * Checks if we can build a single Mesh with MultiMaterial from multiple primitives.
	 * Returns true if all primitives use the same attributes/morphAttributes/mode
	 * and also have index. Otherwise returns false.
	 *
	 * @param {Array<GLTF.Primitive>} primitives
	 * @return {Boolean}
	 */
	function isMultiPassGeometry( primitives ) {

		if ( primitives.length < 2 ) return false;

		var primitive0 = primitives[ 0 ];
		var targets0 = primitive0.targets || [];

		if ( primitive0.indices === undefined ) return false;

		for ( var i = 1, il = primitives.length; i < il; i ++ ) {

			var primitive = primitives[ i ];

			if ( primitive0.mode !== primitive.mode ) return false;
			if ( primitive.indices === undefined ) return false;
			if ( primitive.extensions && primitive.extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ] ) return false;
			if ( ! isObjectEqual( primitive0.attributes, primitive.attributes ) ) return false;

			var targets = primitive.targets || [];

			if ( targets0.length !== targets.length ) return false;

			for ( var j = 0, jl = targets0.length; j < jl; j ++ ) {

				if ( ! isObjectEqual( targets0[ j ], targets[ j ] ) ) return false;

			}

		}

		return true;

	}

	/* GLTF PARSER */

	function GLTFParser( json, extensions, options ) {

		this.json = json || {};
		this.extensions = extensions || {};
		this.options = options || {};

		// loader object cache
		this.cache = new GLTFRegistry();

		// BufferGeometry caching
		this.primitiveCache = {};
		this.multiplePrimitivesCache = {};
		this.multiPassGeometryCache = {};

		this.textureLoader = new THREE.TextureLoader( this.options.manager );
		this.textureLoader.setCrossOrigin( this.options.crossOrigin );

		this.fileLoader = new THREE.FileLoader( this.options.manager );
		this.fileLoader.setResponseType( 'arraybuffer' );

	}

	GLTFParser.prototype.parse = function ( onLoad, onError ) {

		var json = this.json;

		// Clear the loader cache
		this.cache.removeAll();

		// Mark the special nodes/meshes in json for efficient parse
		this.markDefs();

		// Fire the callback on complete
		this.getMultiDependencies( [

			'scene',
			'animation',
			'camera'

		] ).then( function ( dependencies ) {

			var scenes = dependencies.scenes || [];
			var scene = scenes[ json.scene || 0 ];
			var animations = dependencies.animations || [];
			var cameras = dependencies.cameras || [];

			onLoad( scene, scenes, cameras, animations, json );

		} ).catch( onError );

	};

	/**
	 * Marks the special nodes/meshes in json for efficient parse.
	 */
	GLTFParser.prototype.markDefs = function () {

		var nodeDefs = this.json.nodes || [];
		var skinDefs = this.json.skins || [];
		var meshDefs = this.json.meshes || [];

		var meshReferences = {};
		var meshUses = {};

		// Nothing in the node definition indicates whether it is a Bone or an
		// Object3D. Use the skins' joint references to mark bones.
		for ( var skinIndex = 0, skinLength = skinDefs.length; skinIndex < skinLength; skinIndex ++ ) {

			var joints = skinDefs[ skinIndex ].joints;

			for ( var i = 0, il = joints.length; i < il; i ++ ) {

				nodeDefs[ joints[ i ] ].isBone = true;

			}

		}

		// Meshes can (and should) be reused by multiple nodes in a glTF asset. To
		// avoid having more than one THREE.Mesh with the same name, count
		// references and rename instances below.
		//
		// Example: CesiumMilkTruck sample model reuses "Wheel" meshes.
		for ( var nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex ++ ) {

			var nodeDef = nodeDefs[ nodeIndex ];

			if ( nodeDef.mesh !== undefined ) {

				if ( meshReferences[ nodeDef.mesh ] === undefined ) {

					meshReferences[ nodeDef.mesh ] = meshUses[ nodeDef.mesh ] = 0;

				}

				meshReferences[ nodeDef.mesh ] ++;

				// Nothing in the mesh definition indicates whether it is
				// a SkinnedMesh or Mesh. Use the node's mesh reference
				// to mark SkinnedMesh if node has skin.
				if ( nodeDef.skin !== undefined ) {

					meshDefs[ nodeDef.mesh ].isSkinnedMesh = true;

				}

			}

		}

		this.json.meshReferences = meshReferences;
		this.json.meshUses = meshUses;

	};

	/**
	 * Requests the specified dependency asynchronously, with caching.
	 * @param {string} type
	 * @param {number} index
	 * @return {Promise<THREE.Object3D|THREE.Material|THREE.Texture|THREE.AnimationClip|ArrayBuffer|Object>}
	 */
	GLTFParser.prototype.getDependency = function ( type, index ) {

		var cacheKey = type + ':' + index;
		var dependency = this.cache.get( cacheKey );

		if ( ! dependency ) {

			switch ( type ) {

				case 'scene':
					dependency = this.loadScene( index );
					break;

				case 'node':
					dependency = this.loadNode( index );
					break;

				case 'mesh':
					dependency = this.loadMesh( index );
					break;

				case 'accessor':
					dependency = this.loadAccessor( index );
					break;

				case 'bufferView':
					dependency = this.loadBufferView( index );
					break;

				case 'buffer':
					dependency = this.loadBuffer( index );
					break;

				case 'material':
					dependency = this.loadMaterial( index );
					break;

				case 'texture':
					dependency = this.loadTexture( index );
					break;

				case 'skin':
					dependency = this.loadSkin( index );
					break;

				case 'animation':
					dependency = this.loadAnimation( index );
					break;

				case 'camera':
					dependency = this.loadCamera( index );
					break;

				case 'light':
					dependency = this.extensions[ EXTENSIONS.KHR_LIGHTS_PUNCTUAL ].loadLight( index );
					break;

				default:
					throw new Error( 'Unknown type: ' + type );

			}

			this.cache.add( cacheKey, dependency );

		}

		return dependency;

	};

	/**
	 * Requests all dependencies of the specified type asynchronously, with caching.
	 * @param {string} type
	 * @return {Promise<Array<Object>>}
	 */
	GLTFParser.prototype.getDependencies = function ( type ) {

		var dependencies = this.cache.get( type );

		if ( ! dependencies ) {

			var parser = this;
			var defs = this.json[ type + ( type === 'mesh' ? 'es' : 's' ) ] || [];

			dependencies = Promise.all( defs.map( function ( def, index ) {

				return parser.getDependency( type, index );

			} ) );

			this.cache.add( type, dependencies );

		}

		return dependencies;

	};

	/**
	 * Requests all multiple dependencies of the specified types asynchronously, with caching.
	 * @param {Array<string>} types
	 * @return {Promise<Object<Array<Object>>>}
	 */
	GLTFParser.prototype.getMultiDependencies = function ( types ) {

		var results = {};
		var pending = [];

		for ( var i = 0, il = types.length; i < il; i ++ ) {

			var type = types[ i ];
			var value = this.getDependencies( type );

			// TODO: Error-prone use of a callback inside a loop.
			value = value.then( function ( key, value ) {

				results[ key ] = value;

			}.bind( this, type + ( type === 'mesh' ? 'es' : 's' ) ) );

			pending.push( value );

		}

		return Promise.all( pending ).then( function () {

			return results;

		} );

	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
	 * @param {number} bufferIndex
	 * @return {Promise<ArrayBuffer>}
	 */
	GLTFParser.prototype.loadBuffer = function ( bufferIndex ) {

		var bufferDef = this.json.buffers[ bufferIndex ];
		var loader = this.fileLoader;

		if ( bufferDef.type && bufferDef.type !== 'arraybuffer' ) {

			throw new Error( 'THREE.GLTFLoader: ' + bufferDef.type + ' buffer type is not supported.' );

		}

		// If present, GLB container is required to be the first buffer.
		if ( bufferDef.uri === undefined && bufferIndex === 0 ) {

			return Promise.resolve( this.extensions[ EXTENSIONS.KHR_BINARY_GLTF ].body );

		}

		var options = this.options;

		return new Promise( function ( resolve, reject ) {

			loader.load( resolveURL( bufferDef.uri, options.path ), resolve, undefined, function () {

				reject( new Error( 'THREE.GLTFLoader: Failed to load buffer "' + bufferDef.uri + '".' ) );

			} );

		} );

	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
	 * @param {number} bufferViewIndex
	 * @return {Promise<ArrayBuffer>}
	 */
	GLTFParser.prototype.loadBufferView = function ( bufferViewIndex ) {

		var bufferViewDef = this.json.bufferViews[ bufferViewIndex ];

		return this.getDependency( 'buffer', bufferViewDef.buffer ).then( function ( buffer ) {

			var byteLength = bufferViewDef.byteLength || 0;
			var byteOffset = bufferViewDef.byteOffset || 0;
			return buffer.slice( byteOffset, byteOffset + byteLength );

		} );

	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#accessors
	 * @param {number} accessorIndex
	 * @return {Promise<THREE.BufferAttribute|THREE.InterleavedBufferAttribute>}
	 */
	GLTFParser.prototype.loadAccessor = function ( accessorIndex ) {

		var parser = this;
		var json = this.json;

		var accessorDef = this.json.accessors[ accessorIndex ];

		if ( accessorDef.bufferView === undefined && accessorDef.sparse === undefined ) {

			// Ignore empty accessors, which may be used to declare runtime
			// information about attributes coming from another source (e.g. Draco
			// compression extension).
			return Promise.resolve( null );

		}

		var pendingBufferViews = [];

		if ( accessorDef.bufferView !== undefined ) {

			pendingBufferViews.push( this.getDependency( 'bufferView', accessorDef.bufferView ) );

		} else {

			pendingBufferViews.push( null );

		}

		if ( accessorDef.sparse !== undefined ) {

			pendingBufferViews.push( this.getDependency( 'bufferView', accessorDef.sparse.indices.bufferView ) );
			pendingBufferViews.push( this.getDependency( 'bufferView', accessorDef.sparse.values.bufferView ) );

		}

		return Promise.all( pendingBufferViews ).then( function ( bufferViews ) {

			var bufferView = bufferViews[ 0 ];

			var itemSize = WEBGL_TYPE_SIZES[ accessorDef.type ];
			var TypedArray = WEBGL_COMPONENT_TYPES[ accessorDef.componentType ];

			// For VEC3: itemSize is 3, elementBytes is 4, itemBytes is 12.
			var elementBytes = TypedArray.BYTES_PER_ELEMENT;
			var itemBytes = elementBytes * itemSize;
			var byteOffset = accessorDef.byteOffset || 0;
			var byteStride = accessorDef.bufferView !== undefined ? json.bufferViews[ accessorDef.bufferView ].byteStride : undefined;
			var normalized = accessorDef.normalized === true;
			var array, bufferAttribute;

			// The buffer is not interleaved if the stride is the item size in bytes.
			if ( byteStride && byteStride !== itemBytes ) {

				var ibCacheKey = 'InterleavedBuffer:' + accessorDef.bufferView + ':' + accessorDef.componentType;
				var ib = parser.cache.get( ibCacheKey );

				if ( ! ib ) {

					// Use the full buffer if it's interleaved.
					array = new TypedArray( bufferView );

					// Integer parameters to IB/IBA are in array elements, not bytes.
					ib = new THREE.InterleavedBuffer( array, byteStride / elementBytes );

					parser.cache.add( ibCacheKey, ib );

				}

				bufferAttribute = new THREE.InterleavedBufferAttribute( ib, itemSize, byteOffset / elementBytes, normalized );

			} else {

				if ( bufferView === null ) {

					array = new TypedArray( accessorDef.count * itemSize );

				} else {

					array = new TypedArray( bufferView, byteOffset, accessorDef.count * itemSize );

				}

				bufferAttribute = new THREE.BufferAttribute( array, itemSize, normalized );

			}

			// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#sparse-accessors
			if ( accessorDef.sparse !== undefined ) {

				var itemSizeIndices = WEBGL_TYPE_SIZES.SCALAR;
				var TypedArrayIndices = WEBGL_COMPONENT_TYPES[ accessorDef.sparse.indices.componentType ];

				var byteOffsetIndices = accessorDef.sparse.indices.byteOffset || 0;
				var byteOffsetValues = accessorDef.sparse.values.byteOffset || 0;

				var sparseIndices = new TypedArrayIndices( bufferViews[ 1 ], byteOffsetIndices, accessorDef.sparse.count * itemSizeIndices );
				var sparseValues = new TypedArray( bufferViews[ 2 ], byteOffsetValues, accessorDef.sparse.count * itemSize );

				if ( bufferView !== null ) {

					// Avoid modifying the original ArrayBuffer, if the bufferView wasn't initialized with zeroes.
					bufferAttribute.setArray( bufferAttribute.array.slice() );

				}

				for ( var i = 0, il = sparseIndices.length; i < il; i ++ ) {

					var index = sparseIndices[ i ];

					bufferAttribute.setX( index, sparseValues[ i * itemSize ] );
					if ( itemSize >= 2 ) bufferAttribute.setY( index, sparseValues[ i * itemSize + 1 ] );
					if ( itemSize >= 3 ) bufferAttribute.setZ( index, sparseValues[ i * itemSize + 2 ] );
					if ( itemSize >= 4 ) bufferAttribute.setW( index, sparseValues[ i * itemSize + 3 ] );
					if ( itemSize >= 5 ) throw new Error( 'THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.' );

				}

			}

			return bufferAttribute;

		} );

	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#textures
	 * @param {number} textureIndex
	 * @return {Promise<THREE.Texture>}
	 */
	GLTFParser.prototype.loadTexture = function ( textureIndex ) {

		var parser = this;
		var json = this.json;
		var options = this.options;
		var textureLoader = this.textureLoader;

		var URL = window.URL || window.webkitURL;

		var textureDef = json.textures[ textureIndex ];

		var textureExtensions = textureDef.extensions || {};

		var source;

		if ( textureExtensions[ EXTENSIONS.MSFT_TEXTURE_DDS ] ) {

			source = json.images[ textureExtensions[ EXTENSIONS.MSFT_TEXTURE_DDS ].source ];

		} else {

			source = json.images[ textureDef.source ];

		}

		var sourceURI = source.uri;
		var isObjectURL = false;

		if ( source.bufferView !== undefined ) {

			// Load binary image data from bufferView, if provided.

			sourceURI = parser.getDependency( 'bufferView', source.bufferView ).then( function ( bufferView ) {

				isObjectURL = true;
				var blob = new Blob( [ bufferView ], { type: source.mimeType } );
				sourceURI = URL.createObjectURL( blob );
				return sourceURI;

			} );

		}

		return Promise.resolve( sourceURI ).then( function ( sourceURI ) {

			// Load Texture resource.

			var loader = THREE.Loader.Handlers.get( sourceURI );

			if ( ! loader ) {

				loader = textureExtensions[ EXTENSIONS.MSFT_TEXTURE_DDS ]
					? parser.extensions[ EXTENSIONS.MSFT_TEXTURE_DDS ].ddsLoader
					: textureLoader;

			}

			return new Promise( function ( resolve, reject ) {

				loader.load( resolveURL( sourceURI, options.path ), resolve, undefined, reject );

			} );

		} ).then( function ( texture ) {

			// Clean up resources and configure Texture.

			if ( isObjectURL === true ) {

				URL.revokeObjectURL( sourceURI );

			}

			texture.flipY = false;

			if ( textureDef.name !== undefined ) texture.name = textureDef.name;

			// Ignore unknown mime types, like DDS files.
			if ( source.mimeType in MIME_TYPE_FORMATS ) {

				texture.format = MIME_TYPE_FORMATS[ source.mimeType ];

			}

			var samplers = json.samplers || {};
			var sampler = samplers[ textureDef.sampler ] || {};

			texture.magFilter = WEBGL_FILTERS[ sampler.magFilter ] || THREE.LinearFilter;
			texture.minFilter = WEBGL_FILTERS[ sampler.minFilter ] || THREE.LinearMipMapLinearFilter;
			texture.wrapS = WEBGL_WRAPPINGS[ sampler.wrapS ] || THREE.RepeatWrapping;
			texture.wrapT = WEBGL_WRAPPINGS[ sampler.wrapT ] || THREE.RepeatWrapping;

			return texture;

		} );

	};

	/**
	 * Asynchronously assigns a texture to the given material parameters.
	 * @param {Object} materialParams
	 * @param {string} mapName
	 * @param {Object} mapDef
	 * @return {Promise}
	 */
	GLTFParser.prototype.assignTexture = function ( materialParams, mapName, mapDef ) {

		var parser = this;

		return this.getDependency( 'texture', mapDef.index ).then( function ( texture ) {

			switch ( mapName ) {

				case 'aoMap':
				case 'emissiveMap':
				case 'metalnessMap':
				case 'normalMap':
				case 'roughnessMap':
					texture.format = THREE.RGBFormat;
					break;

			}

			if ( parser.extensions[ EXTENSIONS.KHR_TEXTURE_TRANSFORM ] ) {

				var transform = mapDef.extensions !== undefined ? mapDef.extensions[ EXTENSIONS.KHR_TEXTURE_TRANSFORM ] : undefined;

				if ( transform ) {

					texture = parser.extensions[ EXTENSIONS.KHR_TEXTURE_TRANSFORM ].extendTexture( texture, transform );

				}

			}

			materialParams[ mapName ] = texture;

		} );

	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#materials
	 * @param {number} materialIndex
	 * @return {Promise<THREE.Material>}
	 */
	GLTFParser.prototype.loadMaterial = function ( materialIndex ) {

		var parser = this;
		var json = this.json;
		var extensions = this.extensions;
		var materialDef = json.materials[ materialIndex ];

		var materialType;
		var materialParams = {};
		var materialExtensions = materialDef.extensions || {};

		var pending = [];

		if ( materialExtensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ] ) {

			var sgExtension = extensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ];
			materialType = sgExtension.getMaterialType( materialDef );
			pending.push( sgExtension.extendParams( materialParams, materialDef, parser ) );

		} else if ( materialExtensions[ EXTENSIONS.KHR_MATERIALS_UNLIT ] ) {

			var kmuExtension = extensions[ EXTENSIONS.KHR_MATERIALS_UNLIT ];
			materialType = kmuExtension.getMaterialType( materialDef );
			pending.push( kmuExtension.extendParams( materialParams, materialDef, parser ) );

		} else {

			// Specification:
			// https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#metallic-roughness-material

			materialType = THREE.MeshStandardMaterial;

			var metallicRoughness = materialDef.pbrMetallicRoughness || {};

			materialParams.color = new THREE.Color( 1.0, 1.0, 1.0 );
			materialParams.opacity = 1.0;

			if ( Array.isArray( metallicRoughness.baseColorFactor ) ) {

				var array = metallicRoughness.baseColorFactor;

				materialParams.color.fromArray( array );
				materialParams.opacity = array[ 3 ];

			}

			if ( metallicRoughness.baseColorTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'map', metallicRoughness.baseColorTexture ) );

			}

			materialParams.metalness = metallicRoughness.metallicFactor !== undefined ? metallicRoughness.metallicFactor : 1.0;
			materialParams.roughness = metallicRoughness.roughnessFactor !== undefined ? metallicRoughness.roughnessFactor : 1.0;

			if ( metallicRoughness.metallicRoughnessTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'metalnessMap', metallicRoughness.metallicRoughnessTexture ) );
				pending.push( parser.assignTexture( materialParams, 'roughnessMap', metallicRoughness.metallicRoughnessTexture ) );

			}

		}

		if ( materialDef.doubleSided === true ) {

			materialParams.side = THREE.DoubleSide;

		}

		var alphaMode = materialDef.alphaMode || ALPHA_MODES.OPAQUE;

		if ( alphaMode === ALPHA_MODES.BLEND ) {

			materialParams.transparent = true;

		} else {

			materialParams.transparent = false;

			if ( alphaMode === ALPHA_MODES.MASK ) {

				materialParams.alphaTest = materialDef.alphaCutoff !== undefined ? materialDef.alphaCutoff : 0.5;

			}

		}

		if ( materialDef.normalTexture !== undefined && materialType !== THREE.MeshBasicMaterial ) {

			pending.push( parser.assignTexture( materialParams, 'normalMap', materialDef.normalTexture ) );

			materialParams.normalScale = new THREE.Vector2( 1, 1 );

			if ( materialDef.normalTexture.scale !== undefined ) {

				materialParams.normalScale.set( materialDef.normalTexture.scale, materialDef.normalTexture.scale );

			}

		}

		if ( materialDef.occlusionTexture !== undefined && materialType !== THREE.MeshBasicMaterial ) {

			pending.push( parser.assignTexture( materialParams, 'aoMap', materialDef.occlusionTexture ) );

			if ( materialDef.occlusionTexture.strength !== undefined ) {

				materialParams.aoMapIntensity = materialDef.occlusionTexture.strength;

			}

		}

		if ( materialDef.emissiveFactor !== undefined && materialType !== THREE.MeshBasicMaterial ) {

			materialParams.emissive = new THREE.Color().fromArray( materialDef.emissiveFactor );

		}

		if ( materialDef.emissiveTexture !== undefined && materialType !== THREE.MeshBasicMaterial ) {

			pending.push( parser.assignTexture( materialParams, 'emissiveMap', materialDef.emissiveTexture ) );

		}

		return Promise.all( pending ).then( function () {

			var material;

			if ( materialType === THREE.ShaderMaterial ) {

				material = extensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ].createMaterial( materialParams );

			} else {

				material = new materialType( materialParams );

			}

			if ( materialDef.name !== undefined ) material.name = materialDef.name;

			// baseColorTexture, emissiveTexture, and specularGlossinessTexture use sRGB encoding.
			if ( material.map ) material.map.encoding = THREE.sRGBEncoding;
			if ( material.emissiveMap ) material.emissiveMap.encoding = THREE.sRGBEncoding;
			if ( material.specularMap ) material.specularMap.encoding = THREE.sRGBEncoding;

			assignExtrasToUserData( material, materialDef );

			if ( materialDef.extensions ) addUnknownExtensionsToUserData( extensions, material, materialDef );

			return material;

		} );

	};

	/**
	 * @param {THREE.BufferGeometry} geometry
	 * @param {GLTF.Primitive} primitiveDef
	 * @param {GLTFParser} parser
	 * @return {Promise<THREE.BufferGeometry>}
	 */
	function addPrimitiveAttributes( geometry, primitiveDef, parser ) {

		var attributes = primitiveDef.attributes;

		var pending = [];

		function assignAttributeAccessor( accessorIndex, attributeName ) {

			return parser.getDependency( 'accessor', accessorIndex )
				.then( function ( accessor ) {

					geometry.addAttribute( attributeName, accessor );

				} );

		}

		for ( var gltfAttributeName in attributes ) {

			var threeAttributeName = ATTRIBUTES[ gltfAttributeName ];

			if ( ! threeAttributeName ) continue;

			// Skip attributes already provided by e.g. Draco extension.
			if ( threeAttributeName in geometry.attributes ) continue;

			pending.push( assignAttributeAccessor( attributes[ gltfAttributeName ], threeAttributeName ) );

		}

		if ( primitiveDef.indices !== undefined && ! geometry.index ) {

			var accessor = parser.getDependency( 'accessor', primitiveDef.indices ).then( function ( accessor ) {

				geometry.setIndex( accessor );

			} );

			pending.push( accessor );

		}

		assignExtrasToUserData( geometry, primitiveDef );

		return Promise.all( pending ).then( function () {

			return primitiveDef.targets !== undefined
				? addMorphTargets( geometry, primitiveDef.targets, parser )
				: geometry;

		} );

	}

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#geometry
	 *
	 * Creates BufferGeometries from primitives.
	 * If we can build a single BufferGeometry with .groups from multiple primitives, returns one BufferGeometry.
	 * Otherwise, returns BufferGeometries without .groups as many as primitives.
	 *
	 * @param {Array<GLTF.Primitive>} primitives
	 * @return {Promise<Array<THREE.BufferGeometry>>}
	 */
	GLTFParser.prototype.loadGeometries = function ( primitives ) {

		var parser = this;
		var extensions = this.extensions;
		var cache = this.primitiveCache;

		var isMultiPass = isMultiPassGeometry( primitives );
		var originalPrimitives;

		if ( isMultiPass ) {

			originalPrimitives = primitives; // save original primitives and use later

			// We build a single BufferGeometry with .groups from multiple primitives
			// because all primitives share the same attributes/morph/mode and have indices.

			primitives = [ primitives[ 0 ] ];

			// Sets .groups and combined indices to a geometry later in this method.

		}

		function createDracoPrimitive( primitive ) {

			return extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ]
				.decodePrimitive( primitive, parser )
				.then( function ( geometry ) {

					return addPrimitiveAttributes( geometry, primitive, parser );

				} );

		}

		var pending = [];

		for ( var i = 0, il = primitives.length; i < il; i ++ ) {

			var primitive = primitives[ i ];
			var cacheKey = createPrimitiveKey( primitive );

			// See if we've already created this geometry
			var cached = cache[ cacheKey ];

			if ( cached ) {

				// Use the cached geometry if it exists
				pending.push( cached.promise );

			} else {

				var geometryPromise;

				if ( primitive.extensions && primitive.extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ] ) {

					// Use DRACO geometry if available
					geometryPromise = createDracoPrimitive( primitive );

				} else {

					// Otherwise create a new geometry
					geometryPromise = addPrimitiveAttributes( new THREE.BufferGeometry(), primitive, parser );

				}

				// Cache this geometry
				cache[ cacheKey ] = { primitive: primitive, promise: geometryPromise };

				pending.push( geometryPromise );

			}

		}

		return Promise.all( pending ).then( function ( geometries ) {

			if ( isMultiPass ) {

				var baseGeometry = geometries[ 0 ];

				// See if we've already created this combined geometry
				var cache = parser.multiPassGeometryCache;
				var cacheKey = createMultiPassGeometryKey( baseGeometry, originalPrimitives );
				var cached = cache[ cacheKey ];

				if ( cached !== null ) return [ cached.geometry ];

				// Cloning geometry because of index override.
				// Attributes can be reused so cloning by myself here.
				var geometry = new THREE.BufferGeometry();

				geometry.name = baseGeometry.name;
				geometry.userData = baseGeometry.userData;

				for ( var key in baseGeometry.attributes ) geometry.addAttribute( key, baseGeometry.attributes[ key ] );
				for ( var key in baseGeometry.morphAttributes ) geometry.morphAttributes[ key ] = baseGeometry.morphAttributes[ key ];

				var pendingIndices = [];

				for ( var i = 0, il = originalPrimitives.length; i < il; i ++ ) {

					pendingIndices.push( parser.getDependency( 'accessor', originalPrimitives[ i ].indices ) );

				}

				return Promise.all( pendingIndices ).then( function ( accessors ) {

					var indices = [];
					var offset = 0;

					for ( var i = 0, il = originalPrimitives.length; i < il; i ++ ) {

						var accessor = accessors[ i ];

						for ( var j = 0, jl = accessor.count; j < jl; j ++ ) indices.push( accessor.array[ j ] );

						geometry.addGroup( offset, accessor.count, i );

						offset += accessor.count;

					}

					geometry.setIndex( indices );

					cache[ cacheKey ] = { geometry: geometry, baseGeometry: baseGeometry, primitives: originalPrimitives };

					return [ geometry ];

				} );

			} else if ( geometries.length > 1 && THREE.BufferGeometryUtils !== undefined ) {

				// Tries to merge geometries with BufferGeometryUtils if possible

				for ( var i = 1, il = primitives.length; i < il; i ++ ) {

					// can't merge if draw mode is different
					if ( primitives[ 0 ].mode !== primitives[ i ].mode ) return geometries;

				}

				// See if we've already created this combined geometry
				var cache = parser.multiplePrimitivesCache;
				var cacheKey = createArrayKeyBufferGeometry( geometries );
				var cached = cache[ cacheKey ];

				if ( cached ) {

					if ( cached.geometry !== null ) return [ cached.geometry ];

				} else {

					var geometry = THREE.BufferGeometryUtils.mergeBufferGeometries( geometries, true );

					cache[ cacheKey ] = { geometry: geometry, baseGeometries: geometries };

					if ( geometry !== null ) return [ geometry ];

				}

			}

			return geometries;

		} );

	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
	 * @param {number} meshIndex
	 * @return {Promise<THREE.Group|THREE.Mesh|THREE.SkinnedMesh>}
	 */
	GLTFParser.prototype.loadMesh = function ( meshIndex ) {

		var parser = this;
		var json = this.json;
		var extensions = this.extensions;

		var meshDef = json.meshes[ meshIndex ];
		var primitives = meshDef.primitives;

		var pending = [];

		for ( var i = 0, il = primitives.length; i < il; i ++ ) {

			var material = primitives[ i ].material === undefined
				? createDefaultMaterial()
				: this.getDependency( 'material', primitives[ i ].material );

			pending.push( material );

		}

		return Promise.all( pending ).then( function ( originalMaterials ) {

			return parser.loadGeometries( primitives ).then( function ( geometries ) {

				var isMultiMaterial = geometries.length === 1 && geometries[ 0 ].groups.length > 0;

				var meshes = [];

				for ( var i = 0, il = geometries.length; i < il; i ++ ) {

					var geometry = geometries[ i ];
					var primitive = primitives[ i ];

					// 1. create Mesh

					var mesh;

					var material = isMultiMaterial ? originalMaterials : originalMaterials[ i ];

					if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLES ||
						primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP ||
						primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN ||
						primitive.mode === undefined ) {

						// .isSkinnedMesh isn't in glTF spec. See .markDefs()
						mesh = meshDef.isSkinnedMesh === true
							? new THREE.SkinnedMesh( geometry, material )
							: new THREE.Mesh( geometry, material );

						if ( mesh.isSkinnedMesh === true ) mesh.normalizeSkinWeights(); // #15319

						if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP ) {

							mesh.drawMode = THREE.TriangleStripDrawMode;

						} else if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN ) {

							mesh.drawMode = THREE.TriangleFanDrawMode;

						}

					} else if ( primitive.mode === WEBGL_CONSTANTS.LINES ) {

						mesh = new THREE.LineSegments( geometry, material );

					} else if ( primitive.mode === WEBGL_CONSTANTS.LINE_STRIP ) {

						mesh = new THREE.Line( geometry, material );

					} else if ( primitive.mode === WEBGL_CONSTANTS.LINE_LOOP ) {

						mesh = new THREE.LineLoop( geometry, material );

					} else if ( primitive.mode === WEBGL_CONSTANTS.POINTS ) {

						mesh = new THREE.Points( geometry, material );

					} else {

						throw new Error( 'THREE.GLTFLoader: Primitive mode unsupported: ' + primitive.mode );

					}

					if ( Object.keys( mesh.geometry.morphAttributes ).length > 0 ) {

						updateMorphTargets( mesh, meshDef );

					}

					mesh.name = meshDef.name || ( 'mesh_' + meshIndex );

					if ( geometries.length > 1 ) mesh.name += '_' + i;

					assignExtrasToUserData( mesh, meshDef );

					meshes.push( mesh );

					// 2. update Material depending on Mesh and BufferGeometry

					var materials = isMultiMaterial ? mesh.material : [ mesh.material ];

					var useVertexTangents = geometry.attributes.tangent !== undefined;
					var useVertexColors = geometry.attributes.color !== undefined;
					var useFlatShading = geometry.attributes.normal === undefined;
					var useSkinning = mesh.isSkinnedMesh === true;
					var useMorphTargets = Object.keys( geometry.morphAttributes ).length > 0;
					var useMorphNormals = useMorphTargets && geometry.morphAttributes.normal !== undefined;

					for ( var j = 0, jl = materials.length; j < jl; j ++ ) {

						var material = materials[ j ];

						if ( mesh.isPoints ) {

							var cacheKey = 'PointsMaterial:' + material.uuid;

							var pointsMaterial = parser.cache.get( cacheKey );

							if ( ! pointsMaterial ) {

								pointsMaterial = new THREE.PointsMaterial();
								THREE.Material.prototype.copy.call( pointsMaterial, material );
								pointsMaterial.color.copy( material.color );
								pointsMaterial.map = material.map;
								pointsMaterial.lights = false; // PointsMaterial doesn't support lights yet

								parser.cache.add( cacheKey, pointsMaterial );

							}

							material = pointsMaterial;

						} else if ( mesh.isLine ) {

							var cacheKey = 'LineBasicMaterial:' + material.uuid;

							var lineMaterial = parser.cache.get( cacheKey );

							if ( ! lineMaterial ) {

								lineMaterial = new THREE.LineBasicMaterial();
								THREE.Material.prototype.copy.call( lineMaterial, material );
								lineMaterial.color.copy( material.color );
								lineMaterial.lights = false; // LineBasicMaterial doesn't support lights yet

								parser.cache.add( cacheKey, lineMaterial );

							}

							material = lineMaterial;

						}

						// Clone the material if it will be modified
						if ( useVertexTangents || useVertexColors || useFlatShading || useSkinning || useMorphTargets ) {

							var cacheKey = 'ClonedMaterial:' + material.uuid + ':';

							if ( material.isGLTFSpecularGlossinessMaterial ) cacheKey += 'specular-glossiness:';
							if ( useSkinning ) cacheKey += 'skinning:';
							if ( useVertexTangents ) cacheKey += 'vertex-tangents:';
							if ( useVertexColors ) cacheKey += 'vertex-colors:';
							if ( useFlatShading ) cacheKey += 'flat-shading:';
							if ( useMorphTargets ) cacheKey += 'morph-targets:';
							if ( useMorphNormals ) cacheKey += 'morph-normals:';

							var cachedMaterial = parser.cache.get( cacheKey );

							if ( ! cachedMaterial ) {

								cachedMaterial = material.isGLTFSpecularGlossinessMaterial
									? extensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ].cloneMaterial( material )
									: material.clone();

								if ( useSkinning ) cachedMaterial.skinning = true;
								if ( useVertexTangents ) cachedMaterial.vertexTangents = true;
								if ( useVertexColors ) cachedMaterial.vertexColors = THREE.VertexColors;
								if ( useFlatShading ) cachedMaterial.flatShading = true;
								if ( useMorphTargets ) cachedMaterial.morphTargets = true;
								if ( useMorphNormals ) cachedMaterial.morphNormals = true;

								parser.cache.add( cacheKey, cachedMaterial );

							}

							material = cachedMaterial;

						}

						materials[ j ] = material;

						// workarounds for mesh and geometry

						if ( material.aoMap && geometry.attributes.uv2 === undefined && geometry.attributes.uv !== undefined ) {

							console.log( 'THREE.GLTFLoader: Duplicating UVs to support aoMap.' );
							geometry.addAttribute( 'uv2', new THREE.BufferAttribute( geometry.attributes.uv.array, 2 ) );

						}

						if ( material.isGLTFSpecularGlossinessMaterial ) {

							// for GLTFSpecularGlossinessMaterial(ShaderMaterial) uniforms runtime update
							mesh.onBeforeRender = extensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ].refreshUniforms;

						}

					}

					mesh.material = isMultiMaterial ? materials : materials[ 0 ];

				}

				if ( meshes.length === 1 ) {

					return meshes[ 0 ];

				}

				var group = new THREE.Group();

				for ( var i = 0, il = meshes.length; i < il; i ++ ) {

					group.add( meshes[ i ] );

				}

				return group;

			} );

		} );

	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#cameras
	 * @param {number} cameraIndex
	 * @return {Promise<THREE.Camera>}
	 */
	GLTFParser.prototype.loadCamera = function ( cameraIndex ) {

		var camera;
		var cameraDef = this.json.cameras[ cameraIndex ];
		var params = cameraDef[ cameraDef.type ];

		if ( ! params ) {

			console.warn( 'THREE.GLTFLoader: Missing camera parameters.' );
			return;

		}

		if ( cameraDef.type === 'perspective' ) {

			camera = new THREE.PerspectiveCamera( THREE.Math.radToDeg( params.yfov ), params.aspectRatio || 1, params.znear || 1, params.zfar || 2e6 );

		} else if ( cameraDef.type === 'orthographic' ) {

			camera = new THREE.OrthographicCamera( params.xmag / - 2, params.xmag / 2, params.ymag / 2, params.ymag / - 2, params.znear, params.zfar );

		}

		if ( cameraDef.name !== undefined ) camera.name = cameraDef.name;

		assignExtrasToUserData( camera, cameraDef );

		return Promise.resolve( camera );

	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#skins
	 * @param {number} skinIndex
	 * @return {Promise<Object>}
	 */
	GLTFParser.prototype.loadSkin = function ( skinIndex ) {

		var skinDef = this.json.skins[ skinIndex ];

		var skinEntry = { joints: skinDef.joints };

		if ( skinDef.inverseBindMatrices === undefined ) {

			return Promise.resolve( skinEntry );

		}

		return this.getDependency( 'accessor', skinDef.inverseBindMatrices ).then( function ( accessor ) {

			skinEntry.inverseBindMatrices = accessor;

			return skinEntry;

		} );

	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animations
	 * @param {number} animationIndex
	 * @return {Promise<THREE.AnimationClip>}
	 */
	GLTFParser.prototype.loadAnimation = function ( animationIndex ) {

		var json = this.json;

		var animationDef = json.animations[ animationIndex ];

		var pendingNodes = [];
		var pendingInputAccessors = [];
		var pendingOutputAccessors = [];
		var pendingSamplers = [];
		var pendingTargets = [];

		for ( var i = 0, il = animationDef.channels.length; i < il; i ++ ) {

			var channel = animationDef.channels[ i ];
			var sampler = animationDef.samplers[ channel.sampler ];
			var target = channel.target;
			var name = target.node !== undefined ? target.node : target.id; // NOTE: target.id is deprecated.
			var input = animationDef.parameters !== undefined ? animationDef.parameters[ sampler.input ] : sampler.input;
			var output = animationDef.parameters !== undefined ? animationDef.parameters[ sampler.output ] : sampler.output;

			pendingNodes.push( this.getDependency( 'node', name ) );
			pendingInputAccessors.push( this.getDependency( 'accessor', input ) );
			pendingOutputAccessors.push( this.getDependency( 'accessor', output ) );
			pendingSamplers.push( sampler );
			pendingTargets.push( target );

		}

		return Promise.all( [

			Promise.all( pendingNodes ),
			Promise.all( pendingInputAccessors ),
			Promise.all( pendingOutputAccessors ),
			Promise.all( pendingSamplers ),
			Promise.all( pendingTargets )

		] ).then( function ( dependencies ) {

			var nodes = dependencies[ 0 ];
			var inputAccessors = dependencies[ 1 ];
			var outputAccessors = dependencies[ 2 ];
			var samplers = dependencies[ 3 ];
			var targets = dependencies[ 4 ];

			var tracks = [];

			for ( var i = 0, il = nodes.length; i < il; i ++ ) {

				var node = nodes[ i ];
				var inputAccessor = inputAccessors[ i ];
				var outputAccessor = outputAccessors[ i ];
				var sampler = samplers[ i ];
				var target = targets[ i ];

				if ( node === undefined ) continue;

				node.updateMatrix();
				node.matrixAutoUpdate = true;

				var TypedKeyframeTrack;

				switch ( PATH_PROPERTIES[ target.path ] ) {

					case PATH_PROPERTIES.weights:

						TypedKeyframeTrack = THREE.NumberKeyframeTrack;
						break;

					case PATH_PROPERTIES.rotation:

						TypedKeyframeTrack = THREE.QuaternionKeyframeTrack;
						break;

					case PATH_PROPERTIES.position:
					case PATH_PROPERTIES.scale:
					default:

						TypedKeyframeTrack = THREE.VectorKeyframeTrack;
						break;

				}

				var targetName = node.name ? node.name : node.uuid;

				var interpolation = sampler.interpolation !== undefined ? INTERPOLATION[ sampler.interpolation ] : THREE.InterpolateLinear;

				var targetNames = [];

				if ( PATH_PROPERTIES[ target.path ] === PATH_PROPERTIES.weights ) {

					// node can be THREE.Group here but
					// PATH_PROPERTIES.weights(morphTargetInfluences) should be
					// the property of a mesh object under group.

					node.traverse( function ( object ) {

						if ( object.isMesh === true && object.morphTargetInfluences ) {

							targetNames.push( object.name ? object.name : object.uuid );

						}

					} );

				} else {

					targetNames.push( targetName );

				}

				// KeyframeTrack.optimize() will modify given 'times' and 'values'
				// buffers before creating a truncated copy to keep. Because buffers may
				// be reused by other tracks, make copies here.
				for ( var j = 0, jl = targetNames.length; j < jl; j ++ ) {

					var track = new TypedKeyframeTrack(
						targetNames[ j ] + '.' + PATH_PROPERTIES[ target.path ],
						THREE.AnimationUtils.arraySlice( inputAccessor.array, 0 ),
						THREE.AnimationUtils.arraySlice( outputAccessor.array, 0 ),
						interpolation
					);

					// Here is the trick to enable custom interpolation.
					// Overrides .createInterpolant in a factory method which creates custom interpolation.
					if ( sampler.interpolation === 'CUBICSPLINE' ) {

						track.createInterpolant = function InterpolantFactoryMethodGLTFCubicSpline( result ) {

							// A CUBICSPLINE keyframe in glTF has three output values for each input value,
							// representing inTangent, splineVertex, and outTangent. As a result, track.getValueSize()
							// must be divided by three to get the interpolant's sampleSize argument.

							return new GLTFCubicSplineInterpolant( this.times, this.values, this.getValueSize() / 3, result );

						};

						// Workaround, provide an alternate way to know if the interpolant type is cubis spline to track.
						// track.getInterpolation() doesn't return valid value for custom interpolant.
						track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline = true;

					}

					tracks.push( track );

				}

			}

			var name = animationDef.name !== undefined ? animationDef.name : 'animation_' + animationIndex;

			return new THREE.AnimationClip( name, undefined, tracks );

		} );

	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#nodes-and-hierarchy
	 * @param {number} nodeIndex
	 * @return {Promise<THREE.Object3D>}
	 */
	GLTFParser.prototype.loadNode = function ( nodeIndex ) {

		var json = this.json;
		var extensions = this.extensions;
		var parser = this;

		var meshReferences = json.meshReferences;
		var meshUses = json.meshUses;

		var nodeDef = json.nodes[ nodeIndex ];

		return ( function () {

			// .isBone isn't in glTF spec. See .markDefs
			if ( nodeDef.isBone === true ) {

				return Promise.resolve( new THREE.Bone() );

			} else if ( nodeDef.mesh !== undefined ) {

				return parser.getDependency( 'mesh', nodeDef.mesh ).then( function ( mesh ) {

					var node;

					if ( meshReferences[ nodeDef.mesh ] > 1 ) {

						var instanceNum = meshUses[ nodeDef.mesh ] ++;

						node = mesh.clone();
						node.name += '_instance_' + instanceNum;

						// onBeforeRender copy for Specular-Glossiness
						node.onBeforeRender = mesh.onBeforeRender;

						for ( var i = 0, il = node.children.length; i < il; i ++ ) {

							node.children[ i ].name += '_instance_' + instanceNum;
							node.children[ i ].onBeforeRender = mesh.children[ i ].onBeforeRender;

						}

					} else {

						node = mesh;

					}

					// if weights are provided on the node, override weights on the mesh.
					if ( nodeDef.weights !== undefined ) {

						node.traverse( function ( o ) {

							if ( ! o.isMesh ) return;

							for ( var i = 0, il = nodeDef.weights.length; i < il; i ++ ) {

								o.morphTargetInfluences[ i ] = nodeDef.weights[ i ];

							}

						} );

					}

					return node;

				} );

			} else if ( nodeDef.camera !== undefined ) {

				return parser.getDependency( 'camera', nodeDef.camera );

			} else if ( nodeDef.extensions
				&& nodeDef.extensions[ EXTENSIONS.KHR_LIGHTS_PUNCTUAL ]
				&& nodeDef.extensions[ EXTENSIONS.KHR_LIGHTS_PUNCTUAL ].light !== undefined ) {

				return parser.getDependency( 'light', nodeDef.extensions[ EXTENSIONS.KHR_LIGHTS_PUNCTUAL ].light );

			} else {

				return Promise.resolve( new THREE.Object3D() );

			}

		}() ).then( function ( node ) {

			if ( nodeDef.name !== undefined ) {

				node.name = THREE.PropertyBinding.sanitizeNodeName( nodeDef.name );

			}

			assignExtrasToUserData( node, nodeDef );

			if ( nodeDef.extensions ) addUnknownExtensionsToUserData( extensions, node, nodeDef );

			if ( nodeDef.matrix !== undefined ) {

				var matrix = new THREE.Matrix4();
				matrix.fromArray( nodeDef.matrix );
				node.applyMatrix( matrix );

			} else {

				if ( nodeDef.translation !== undefined ) {

					node.position.fromArray( nodeDef.translation );

				}

				if ( nodeDef.rotation !== undefined ) {

					node.quaternion.fromArray( nodeDef.rotation );

				}

				if ( nodeDef.scale !== undefined ) {

					node.scale.fromArray( nodeDef.scale );

				}

			}

			return node;

		} );

	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#scenes
	 * @param {number} sceneIndex
	 * @return {Promise<THREE.Scene>}
	 */
	GLTFParser.prototype.loadScene = function () {

		// scene node hierachy builder

		function buildNodeHierachy( nodeId, parentObject, json, parser ) {

			var nodeDef = json.nodes[ nodeId ];

			return parser.getDependency( 'node', nodeId ).then( function ( node ) {

				if ( nodeDef.skin === undefined ) return node;

				// build skeleton here as well

				var skinEntry;

				return parser.getDependency( 'skin', nodeDef.skin ).then( function ( skin ) {

					skinEntry = skin;

					var pendingJoints = [];

					for ( var i = 0, il = skinEntry.joints.length; i < il; i ++ ) {

						pendingJoints.push( parser.getDependency( 'node', skinEntry.joints[ i ] ) );

					}

					return Promise.all( pendingJoints );

				} ).then( function ( jointNodes ) {

					var meshes = node.isGroup === true ? node.children : [ node ];

					for ( var i = 0, il = meshes.length; i < il; i ++ ) {

						var mesh = meshes[ i ];

						var bones = [];
						var boneInverses = [];

						for ( var j = 0, jl = jointNodes.length; j < jl; j ++ ) {

							var jointNode = jointNodes[ j ];

							if ( jointNode ) {

								bones.push( jointNode );

								var mat = new THREE.Matrix4();

								if ( skinEntry.inverseBindMatrices !== undefined ) {

									mat.fromArray( skinEntry.inverseBindMatrices.array, j * 16 );

								}

								boneInverses.push( mat );

							} else {

								console.warn( 'THREE.GLTFLoader: Joint "%s" could not be found.', skinEntry.joints[ j ] );

							}

						}

						mesh.bind( new THREE.Skeleton( bones, boneInverses ), mesh.matrixWorld );

					}

					return node;

				} );

			} ).then( function ( node ) {

				// build node hierachy

				parentObject.add( node );

				var pending = [];

				if ( nodeDef.children ) {

					var children = nodeDef.children;

					for ( var i = 0, il = children.length; i < il; i ++ ) {

						var child = children[ i ];
						pending.push( buildNodeHierachy( child, node, json, parser ) );

					}

				}

				return Promise.all( pending );

			} );

		}

		return function loadScene( sceneIndex ) {

			var json = this.json;
			var extensions = this.extensions;
			var sceneDef = this.json.scenes[ sceneIndex ];
			var parser = this;

			var scene = new THREE.Scene();
			if ( sceneDef.name !== undefined ) scene.name = sceneDef.name;

			assignExtrasToUserData( scene, sceneDef );

			if ( sceneDef.extensions ) addUnknownExtensionsToUserData( extensions, scene, sceneDef );

			var nodeIds = sceneDef.nodes || [];

			var pending = [];

			for ( var i = 0, il = nodeIds.length; i < il; i ++ ) {

				pending.push( buildNodeHierachy( nodeIds[ i ], scene, json, parser ) );

			}

			return Promise.all( pending ).then( function () {

				return scene;

			} );

		};

	}();

	return GLTFLoader;

} )();

 return THREE.GLTFLoader;
});
/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define('GLTFLoader',["three", "vendor/three/loaders/GLTFLoader", "lodash"], function( THREE, THREEGLTFLoader, _ ){
    var GLTFLoader = function ( manager, logger )
    { 
        THREEGLTFLoader.call( this, manager, logger );
    };

    GLTFLoader.prototype = _.create( THREEGLTFLoader.prototype, {
        constructor : GLTFLoader,
        
        load : function( url, onLoad, onProgress, onError )
        {
            onLoad = onLoad || function(){};
            if( url === null || url === undefined || url === "" ) {
                onLoad( null );
            };
            var scope = this;

            var path = scope.path === undefined ? THREE.LoaderUtils.extractUrlBase( url ) : scope.path;

            require(["text!" + url], function ( responseText ) {
                var fnc = onLoad || function(){};
                fnc ( scope.parse( responseText, path ) );
            }, onError);
        }
        
    });

    return GLTFLoader;
});


/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

define('threeVP-Loaders',["ColladaLoader", "OBJLoader", "MTLLoader", "OBJMTLLoader", "X3DLoader", "UniversalLoader", 
    "ObjectDAE", "ObjectX3D", "ObjectOBJ", "ObjectOBJMTL", "POVLoader", "GLTFLoader"], 
    function( 
        ColladaLoader, OBJLoader, MTLLoader, OBJMTLLoader, X3DLoader, UniversalLoader, 
        ObjectDAE, ObjectX3D, ObjectOBJ, ObjectOBJMTL, POVLoader, GLTFLoader )
    {
        return { 
            loader : {
                "ColladaLoader"   : ColladaLoader,
                "OBJLoader"       : OBJLoader,
                "GLTFLoader"      : GLTFLoader,
                "POVLoader"       : POVLoader,
                "MTLLoader"       : MTLLoader,
                "OBJMTLLoader"    : OBJMTLLoader,
                "X3DLoader"       : X3DLoader,
                "UniversalLoader" : UniversalLoader
            },
            "ObjectDAE"       : ObjectDAE,
            "ObjectX3D"       : ObjectX3D,
            "ObjectOBJ"       : ObjectOBJ,
            "ObjectOBJMTL"    : ObjectOBJMTL
        };
});

/**
 * Created by Hessberger on 18.03.2015.
 */
define('chaser/PositionChaser',["tween"], function ( TWEEN ) {

    var PositionChaser = function(obj, opt)
    {
        opt = opt || {};
        var sliderange = opt.sliderange || 20;
        var time = 2000;
        var axis = opt.axis || "z";
        var start = obj.position[axis];
        var stop = start + sliderange;
        var to = stop;
        var position = {  z: start };
        var target = {  z: to };
        var animate = false;


        var tween = new TWEEN.Tween(position).to(target, time)
            .onStart(function(){
                animate = true;
            })
            .onComplete(function(){
                animate = false;
                to = (to == start)? stop:start;
                tween.to({z: to}, time);
            })
            .onStop(function(){
                animate = false;
                to = (to == start)? stop:start;
                tween.to({z: to}, time);
            })
            .onUpdate(function(){
                obj.position[axis] = position.z;
            });
        this.toggle = function(){
            if (animate) {tween.stop(); }
            else tween.start();
        };
        this.close = function(){
            if( position.z == start ) return;
            if (animate) {tween.stop(); }
            tween.start();
        };
    };
    
    return PositionChaser;
});
/**
 * Created by Hessberger on 18.03.2015.
 */
define('chaser/RotationChaser',["lodash", "tween"], function ( _, TWEEN ) {
    
    var defaults = {
        hinge:"left",
        dir:"y",
        odir:"in",
        val:1.57
    };
    
    var dirs = {"left":"y", "right":"y", "top" : "x", "bottom" : "x"};

    var RotationChaser = function( obj, opt )
    {
        opt = opt || {};
        var options = _.extend(defaults, opt);
        options.dir = dirs[options.hinge] || defaults.dir;
        var angle = {left:-options.val, right:options.val, o:-options.val, u:options.val, in:1, out:-1};
        var start = obj.rotation[options.dir];
        var stop = start+angle[options.hinge]*angle[options.odir];
        var to = stop;
        var rotation = {  y: start };
        var target = {  y: stop };
        var animate = false;
        var time = 2000;

        var tween = new TWEEN.Tween( rotation ).to(target, time)
        .onStart(function(){
            animate = true;
        })
        .onComplete(function(){
            animate = false;
            to = (to === start)? stop:start;
            tween.to({y: to}, time);
        })
        .onStop(function(){
            animate = false;
            to = (to === start)? stop:start;
            tween.to({y: to}, time);
        })
        .onUpdate(function(){
            obj.rotation[options.dir] = rotation.y;
        });

        this.start = function(){
            tween.start();
        };
        this.toggle = function(){
            if ( animate ) tween.stop();
            else tween.start();
        };
        this.close = function(){
            if( rotation.y === start ) return;
            if (animate) {tween.stop(); }
            tween.start();
        };

    };
    return RotationChaser;
});
/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define('chaser/PositionTween',["chaser/PositionChaser"], function( Chaser ){
    
    var makeTween = function( DomEvents, mLade )
    {
        var o = this.model.attributes;
        
        var tween = new Chaser( mLade, {odir:o.dir} );
        
        var onClick = function( ev ){
            ev.cancelBubble = true;
            tween.toggle();
        };
        DomEvents.addEventListener( mLade, "click", onClick );
        mLade.addEventListener("removed", function(){ DomEvents.removeEventListener( mLade, "click", onClick ); });
    };
    return makeTween;

});


/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

define('pack-Animation',["chaser/PositionChaser", "chaser/RotationChaser", "chaser/PositionTween"], function( PositionChaser, RotationChaser, PositionTween ){
    return {
        PositionChaser : PositionChaser,
        RotationChaser : RotationChaser,
        PositionTween  : PositionTween
    };
});
/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

define('factorys/Factory',["lodash"], function( _ ){
    var Factory = function (){
        this.catalog = {};
        this.models = {};
    };
    
    _.extend( Factory.prototype, {
        
        loadCatalog : function( urlCat, callback ){
            require(["json!"+urlCat], function( objCat ){
                this.addCatalog( objCat );
                if ( callback ) { callback(this); }
            }.bind(this));
        },
        
        addCatalog : function( objCat ){
            _.extend( this.catalog, objCat );
        },
        
        /**
         * 
         * @param {type} name
         * @param {type} opts
         * @returns {this.models}
         */
        get : function( name, opts ){
            return new this.models[name]? new this.models[name]( opts ) : null;
        },
        
        set : function( name, obj ){
            this.models[name] = obj;
        }
    });
    return Factory;
});

/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define('factorys/MaterialFactory',["three", "lodash", "factorys/Factory", "module"], function( THREE, _, Factory, module ){

    var catalog = {}, presets = {};
    var loaderMat = new THREE.MaterialLoader();
    var loaderTex = new THREE.TextureLoader();
    var loaderImg = new THREE.ImageLoader();
    var RGBFormat = 1022;
    var RGBAFormat = 1023;
    var colors = ['color', 'emissive', 'specular'];
    var tempColor = new THREE.Color();

    var options = {
        texturePath : "textures/",
        defaultMatType : "MeshPhongMaterial",
        myPath      : module.uri.substring(0, module.uri.lastIndexOf("/")+1 ) + "textures/",
        debug       : false,
        reflection  : false,
        WIDTH       : window.innerWidth,
        HEIGHT      : window.innerHeight,
        clipBias    : 0.003,
        color       : 0x777777
    };

    var setUV = function( jsonMaterial )
    {
        var trans = {};
        if (jsonMaterial.userData.size)
        {
            trans.size = jsonMaterial.userData.size;
            var u = 100 / trans.size[0];
            var v = 100 / trans.size[1];

            if ( u === 1.0 ) u = 0.9999;
            if ( v === 1.0 ) v = 0.9999;
   
            if (!jsonMaterial.map.wrap) jsonMaterial.map.wrap = [THREE.RepeatWrapping, THREE.RepeatWrapping];
            jsonMaterial.map.repeat = [u, v];
        }
        
        return jsonMaterial;
    };

    var MFactory = function( objCat, opt )
    {
        if ( objCat ) {
            if ( objCat.materials ) {
                this.addCatalog( objCat.materials );
            } else {
                this.addCatalog( objCat );
            }
        }
        
        this.options = _.extend( {}, options, opt );

        this.textures = {};
        this.materials = {};

        loaderImg.setPath( this.options.texturePath );
        loaderMat.setTextures( this.textures );
    };
    
    MFactory.prototype = _.create( Factory.prototype, {
        
        constructor : MFactory,
        
        loadCatalog : function( urlCat, callback )
        {
            require(["json!"+urlCat], function( objCat ){
                this.addCatalog( objCat );
                if ( typeof callback === "function" ) { 
                    callback( this ); 
                }
            }.bind(this));
        },

        loadPresets : function( url )
        {
            require(["json!"+url], function( obj ){
                this.addPresets( obj );
            }.bind(this));
        },
        
        addCatalog : function( objCat ){ 
            _.each( objCat, function( mat ){
                if ( !mat.userData ) mat.userData = {};
                _.each( colors, function( col ){
                    if ( mat[col] ){
                        if ( mat[col] instanceof Array ) {
                            mat.userData[col] = mat[col];
                            tempColor.setRGB( mat[col][0], mat[col][1], mat[col][2] );
                            mat[col] = tempColor.getHex();
                        }
                        if ( typeof mat[col] === "string" ) {
                            mat.userData[col] = mat[col];
                            tempColor.setStyle( mat[col] );
                            mat[col] = tempColor.getHex();
                        }
                    }
                });
            });

            _.extend( catalog, objCat );
        },
        
        addPresets : function( obj ){
            _.extend( presets, obj );
        },
        
        /**
         * 
         * @param {type} matKey
         * @returns {undefined}
         */
        deleteMaterial : function( matKey ){
            if ( this.materials[ matKey ] ) { 
                this.materials[ matKey ].dispose();
                this.materials[ matKey ] = null; 
            }
        },
        
        enableReflection : function( VP ){
            this.VP = VP;
            this.options.reflection = true;
            var cubeCamera1 = new THREE.CubeCamera( 1, 1000, 256 );
            
            cubeCamera1.renderTarget.texture.minFilter = THREE.LinearMipMapLinearFilter;
            cubeCamera1.position.set(0, 5, 0);
            VP.scene.add( cubeCamera1 );
            this.planeMirror = cubeCamera1.renderTarget;
            VP.loop.add( function(){ cubeCamera1.updateCubeMap( VP.renderer, VP.scene ); });
        },

        /**
         *
         * @param matKey {string} key of material
         * @param copy {boolean} return copy or reference
         * @returns {*}
         */
        getMaterial : function( matKey, copy )
        {
            if ( copy === undefined ) copy = true;
            
            if ( !catalog[ matKey ] ) {
                return null;
            }

            //cached?
            if ( this.materials[ matKey ] ){ 
                return ( copy )? this.materials[ matKey ].clone() : this.materials[ matKey ];
            }

            var jsonCatMat = catalog[ matKey ];
            var jsonMaterial = _.clone( jsonCatMat );
            var mapDefault = { wrap:[], magFilter:[] };

            if ( !jsonMaterial.type ) jsonMaterial.type = options.defaultMatType;

            if ( jsonMaterial.userData && jsonMaterial.userData.preset && presets[jsonMaterial.userData.preset] ){
                jsonMaterial = _.extend({}, presets[jsonMaterial.userData.preset], jsonMaterial );
            }

            if ( jsonCatMat.map )
            {
                if ( jsonMaterial.map.wrap ) {
                    if ( typeof jsonMaterial.map.wrap[0] === "string" ) { 
                        jsonMaterial.map.wrap[0] = THREE[jsonMaterial.map.wrap[0]]; 
                    }
                    if ( typeof jsonMaterial.map.wrap[1] === "string" ) {
                        jsonMaterial.map.wrap[1] = THREE[jsonMaterial.map.wrap[1]];
                    }
                } else{
                    if ( jsonMaterial.map.rotation ) {
                        jsonMaterial.map.wrap = [THREE.RepeatWrapping, THREE.RepeatWrapping];
                    }
                }
                
                if ( jsonMaterial.userData && jsonMaterial.userData.size ) {
                    setUV( jsonMaterial );
                }
                
                mapDefault = _.extend(mapDefault, jsonCatMat.map );
                
                this._createTexture("map", jsonMaterial, mapDefault);
            }
            
            var maps = ["bumpMap", "roughnessMap", "alphaMap", "normalMap", "emissiveMap", "specularMap"];
            
            //Maps
            _.each( maps , function( mapName ){
                if ( jsonCatMat[ mapName ] ) {
                    this._createTexture( mapName, jsonMaterial, mapDefault );
                }
            }.bind(this));

            //envMap
            if ( jsonCatMat.envMap ) {
                
                if ( !jsonCatMat.envMap.image === "flatMirror" ){
                    this._createTexture("envMap", jsonMaterial, mapDefault);
                } else {
                    jsonMaterial.envMap = null;
                }
            }

            this.materials[ matKey ] = loaderMat.parse( jsonMaterial );

            if (jsonMaterial.userData) {
                this.materials[ matKey ].userData = jsonMaterial.userData;
            }

            if ( jsonCatMat.envMap  && jsonCatMat.envMap.image === "flatMirror" && this.options.reflection ) {

                this.materials[ matKey ].envMap = this.planeMirror;
                 this.VP.loop.add( function(){ 
                     this.materials[ matKey ].envMap = this.planeMirror.texture;
                 }.bind(this));
               
            }
            
            return ( copy )? this.materials[ matKey ].clone() : this.materials[ matKey ];
        },
        
        _createTexture : function( map, jsonMaterial, defaultMap )
        {
            var myMap = jsonMaterial[ map ];
            var texName = map+"_"+myMap.image;

            if ( this.textures[ texName ] ) {
                jsonMaterial[map] = texName;
                return;
            }

            var mapOpt = {
                    mapping     : myMap.mapping || defaultMap.mapping, 
                    wrapS       : myMap.wrap ? myMap.wrap[0] : defaultMap.wrap[0], 
                    wrapT       : myMap.wrap ? myMap.wrap[1] : defaultMap.wrap[1], 
                    magFilter   : myMap.magFilter ? myMap.magFilter[0] : defaultMap.magFilter[0], 
                    minFilter   : myMap.magFilter ? myMap.magFilter[1] : defaultMap.magFilter[1], 
                    format      : myMap.format      || map.format,
                    type        : myMap.type        || defaultMap.type,
                    anisotropy  : myMap.anisotropy  || defaultMap.anisotropy,
                    encoding    : myMap.encoding    || defaultMap.encoding,
                    rotation    : myMap.rotation ? myMap.rotation : defaultMap.rotation || 0,
                    center      : myMap.center ? myMap.center : [0,0]
            };

            this.textures[ texName ] = new THREE.Texture( undefined, mapOpt.mapping, mapOpt.wrapS, mapOpt.wrapT, mapOpt.magFilter, mapOpt.minFilter, mapOpt.format, mapOpt.type, mapOpt.anisotropy, mapOpt.encoding );
            
            
            if ( myMap.repeat ) this.textures[ texName ].repeat.fromArray(  myMap.repeat );
            if ( myMap.rotation ) this.textures[ texName ].rotation = myMap.rotation;
            
            jsonMaterial[ map ] = texName;
                            
            this.loadImage( this.textures[ texName ], myMap.image );
        },
        
        loadImage : function( texture, url )
        {    
            var onProgress = function(){};
            var onError = function(){};
            
            loaderImg.load( url, function ( image ) 
            {
                // JPEGs can't have an alpha channel, so memory can be saved by storing them as RGB.
                var isJPEG = url.search( /\.(jpg|jpeg)$/ ) > 0 || url.search( /^data\:image\/jpeg/ ) === 0;

                texture.format = isJPEG ? RGBFormat : RGBAFormat;
                texture.image = image;
                texture.needsUpdate = true;

            }, onProgress, onError );
        }
    });

    return MFactory;
});
/**
 * 
 * @param {type} THREE
 * @param {type} _
 * @param {type} $
 * @param {type} Backbone
 * @param {type} CMD
 * @returns {packL#5.packAnonym$1}
 */

define('pack-Factorys',[ "factorys/MaterialFactory"], 
function( MaterialFactory ) {
    return {
        MaterialFactory       : MaterialFactory
     };
});

/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

define('plugins/plg.Tween',["plugin", "tween", "cmd"], function(Plugin, Tween, CMD){
    var PlgTween = function(){
        this.super.constructor.call( this );
    };

    PlgTween.prototype = Object.create( Plugin.prototype );
    PlgTween.prototype.constructor = PlgTween;
    PlgTween.prototype.super = Plugin.prototype;

    PlgTween.prototype.registerEvents = function()
    {
        CMD.on("viewportInitalized", function( VP ){
            VP.loop.add(function() {
                Tween.update();
            });
        });
    };
    
    return PlgTween;
});

/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define('utilities/ModelDatGui',["lodash", "dat-gui", "cmd"], function(_, dat, CMD )
{       
    var options = {
        open : false
    };
    
    /**
     * ModelDatGUI constructor
     * 
     * @param {type} model
     * @param {type} opt
     * @returns {ModelDatGuiL#6.ModelDatGUI}
     */
    var ModelDatGUI = function( model, opt )
    {        
        this.options = _.extend({}, options, opt);
        
        //ToDo: opt.filter
        dat.GUI.call( this ); 
        
        if ( model ) _addModel( this, model );
   
        if ( this.options.open ) this.open();
    };
    
    ModelDatGUI.prototype = _.create( dat.GUI.prototype, { 
        constructor : ModelDatGUI,

        addModel : function( model ){
            _addModel(this, model);
        },
        
        addModelFolder : function( model, n ){
            if (typeof model !== "object" ){
                console.log("model must be Backbone.Model");
            }
            var name = (typeof n === "string")? n : model.attributes.name;
            
            var f = this.addFolder( name );
            _addModel( f, model );
            return this;
        }
    });
    
    _addModel = function(gui, model){
        var o = model.toJSON();
        var b = model.bounds;
        _.each(b, function( v, k ){
            var f = function( val ){ var p ={}; p[k]=val; model.set( p, {validate:true} ); };
            if( v.type === "number" && v.min !== undefined ) gui.add(o, k).min( v.min ).max( v.max ).step(v.step||1).listen().onChange( f );
              if( v.list ) gui.add(o, k, v.list ).onChange( f );
              if ( v.type === "boolean" ) gui.add(o, k).onChange( f );
              if ( v.type === "color" ){
                  var conf = {};
                  conf[k] = v.color;
                  gui.addColor(conf, k).onChange( f );
              } 
        });
    };
            
    return ModelDatGUI;
});


define('vendor/three/utils/ShadowMapViewer',["three"], function(THREE){
/**
 * @author arya-s / https://github.com/arya-s
 *
 * This is a helper for visualising a given light's shadow map.
 * It works for shadow casting lights: THREE.DirectionalLight and THREE.SpotLight.
 * It renders out the shadow map and displays it on a HUD.
 *
 * Example usage:
 *	1) Include <script src='examples/js/utils/ShadowMapViewer.js'><script> in your html file
 *
 *	2) Create a shadow casting light and name it optionally:
 *		var light = new THREE.DirectionalLight( 0xffffff, 1 );
 *		light.castShadow = true;
 *		light.name = 'Sun';
 *
 *	3) Create a shadow map viewer for that light and set its size and position optionally:
 *		var shadowMapViewer = new THREE.ShadowMapViewer( light );
 *		shadowMapViewer.size.set( 128, 128 );	//width, height  default: 256, 256
 *		shadowMapViewer.position.set( 10, 10 );	//x, y in pixel	 default: 0, 0 (top left corner)
 *
 *	4) Render the shadow map viewer in your render loop:
 *		shadowMapViewer.render( renderer );
 *
 *	5) Optionally: Update the shadow map viewer on window resize:
 *		shadowMapViewer.updateForWindowResize();
 *
 *	6) If you set the position or size members directly, you need to call shadowMapViewer.update();
 */

THREE.ShadowMapViewer = function ( light ) {

	//- Internals
	var scope = this;
	var doRenderLabel = ( light.name !== undefined && light.name !== '' );
	var userAutoClearSetting;

	//Holds the initial position and dimension of the HUD
	var frame = {
		x: 10,
		y: 10,
		width: 256,
		height: 256
	};

	var camera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, 1, 10 );
	camera.position.set( 0, 0, 2 );
	var scene = new THREE.Scene();

	//HUD for shadow map
	var shader = THREE.UnpackDepthRGBAShader;

	var uniforms = new THREE.UniformsUtils.clone( shader.uniforms );
	var material = new THREE.ShaderMaterial( {
		uniforms: uniforms,
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader
	} );
	var plane = new THREE.PlaneBufferGeometry( frame.width, frame.height );
	var mesh = new THREE.Mesh( plane, material );

	scene.add( mesh );


	//Label for light's name
	var labelCanvas, labelMesh;

	if ( doRenderLabel ) {

		labelCanvas = document.createElement( 'canvas' );

		var context = labelCanvas.getContext( '2d' );
		context.font = 'Bold 20px Arial';

		var labelWidth = context.measureText( light.name ).width;
		labelCanvas.width = labelWidth;
		labelCanvas.height = 25;	//25 to account for g, p, etc.

		context.font = 'Bold 20px Arial';
		context.fillStyle = 'rgba( 255, 0, 0, 1 )';
		context.fillText( light.name, 0, 20 );

		var labelTexture = new THREE.Texture( labelCanvas );
		labelTexture.magFilter = THREE.LinearFilter;
		labelTexture.minFilter = THREE.LinearFilter;
		labelTexture.needsUpdate = true;

		var labelMaterial = new THREE.MeshBasicMaterial( { map: labelTexture, side: THREE.DoubleSide } );
		labelMaterial.transparent = true;

		var labelPlane = new THREE.PlaneBufferGeometry( labelCanvas.width, labelCanvas.height );
		labelMesh = new THREE.Mesh( labelPlane, labelMaterial );

		scene.add( labelMesh );

	}


	function resetPosition () {

		scope.position.set( scope.position.x, scope.position.y );

	}

	//- API
	// Set to false to disable displaying this shadow map
	this.enabled = true;

	// Set the size of the displayed shadow map on the HUD
	this.size = {
		width: frame.width,
		height: frame.height,
		set: function ( width, height ) {

			this.width = width;
			this.height = height;

			mesh.scale.set( this.width / frame.width, this.height / frame.height, 1 );

			//Reset the position as it is off when we scale stuff
			resetPosition();

		}
	};

	// Set the position of the displayed shadow map on the HUD
	this.position = {
		x: frame.x,
		y: frame.y,
		set: function ( x, y ) {

			this.x = x;
			this.y = y;

			var width = scope.size.width;
			var height = scope.size.height;

			mesh.position.set( - window.innerWidth / 2 + width / 2 + this.x, window.innerHeight / 2 - height / 2 - this.y, 0 );

			if ( doRenderLabel ) labelMesh.position.set( mesh.position.x, mesh.position.y - scope.size.height / 2 + labelCanvas.height / 2, 0 );

		}
	};

	this.render = function ( renderer ) {

		if ( this.enabled ) {

			//Because a light's .shadowMap is only initialised after the first render pass
			//we have to make sure the correct map is sent into the shader, otherwise we
			//always end up with the scene's first added shadow casting light's shadowMap
			//in the shader
			//See: https://github.com/mrdoob/three.js/issues/5932
			uniforms.tDiffuse.value = light.shadow.map.texture;

			userAutoClearSetting = renderer.autoClear;
			renderer.autoClear = false; // To allow render overlay
			renderer.clearDepth();
			renderer.render( scene, camera );
			renderer.autoClear = userAutoClearSetting;	//Restore user's setting

		}

	};

	this.updateForWindowResize = function () {

		if ( this.enabled ) {

			 camera.left = window.innerWidth / - 2;
			 camera.right = window.innerWidth / 2;
			 camera.top = window.innerHeight / 2;
			 camera.bottom = window.innerHeight / - 2;
			 camera.updateProjectionMatrix();

			 this.update();
		}

	};

	this.update = function () {

		this.position.set( this.position.x, this.position.y );
		this.size.set( this.size.width, this.size.height );

	};

	//Force an update to set position/size
	this.update();

};

THREE.ShadowMapViewer.prototype.constructor = THREE.ShadowMapViewer;

 return THREE.ShadowMapViewer;
});
/**
 * Created by bernie on 21.11.15.
 */
define('lights/Sunlight',["three", "lodash", "vendor/three/utils/ShadowMapViewer"], function ( THREE, _ ) {
    var options = {
        color       : 0xCCCCCC,
        intensity   : .9,
        debug       : true,
        castShadow  : true,
        size        : 50,
        shadowMap : 2048
    };
    
    var Sunlight = function( opt )
    {
        this.options = _.extend( options, opt ); 
        
        this.super.call( this, this.options.color, this.options.intensity );

        if ( this.options.castShadow ){
            this.castShadow = true;
            
            this.shadow.camera.left = -this.options.size;
            this.shadow.camera.top = -this.options.size;
            this.shadow.camera.right = this.options.size;
            this.shadow.camera.bottom = this.options.size;
            
            this.shadow.camera.near = this.options.near || 20;
            this.shadow.camera.far = this.options.far || 200;
            
            this.shadow.bias = -.001;
            
            this.shadow.mapSize.width = this.shadow.mapSize.height = this.options.shadowMap;
            //this.shadowDarkness = .4;
        }
        
        this.registerEvents();
    };
    
    Sunlight.prototype = _.create( THREE.DirectionalLight.prototype, {
        constructor : Sunlight,
        super : THREE.DirectionalLight,

        registerEvents : function(){
            this.addEventListener("added", this.onAdded.bind(this) );
        }
    });

    
    Sunlight.prototype.onAdded = function(){
        if ( this.options.debug ) {
            this.parent.add( new THREE.CameraHelper( this.shadow.camera ) );
        }
    };

    return Sunlight;
});
/**
 * from http://stemkoski.blogspot.fr/2013/07/shaders-in-threejs-glow-and-halo.html
 * @return {[type]} [description]
 */
define('lights/Volumetricspotlightmaterial',["three"], function( THREE )
{
    var VolumetricSpotLightMaterial = function()
    {	
	var vertexShader	= [
		'varying vec3 vNormal;',
		'varying vec3 vWorldPosition;',
		
		'void main(){',
			'// compute intensity',
			'vNormal		= normalize( normalMatrix * normal );',

			'vec4 worldPosition	= modelMatrix * vec4( position, 1.0 );',
			'vWorldPosition		= worldPosition.xyz;',

			'// set gl_Position',
			'gl_Position	= projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
		'}'
	].join('\n');
	var fragmentShader	= [
		'varying vec3		vNormal;',
		'varying vec3		vWorldPosition;',

		'uniform vec3		lightColor;',

		'uniform vec3		spotPosition;',

		'uniform float		attenuation;',
		'uniform float		anglePower;',

		'void main(){',
			'float intensity;',

			//////////////////////////////////////////////////////////
			// distance attenuation					//
			//////////////////////////////////////////////////////////
			'intensity	= distance(vWorldPosition, spotPosition)/attenuation;',
			'intensity	= 1.0 - clamp(intensity, 0.0, 1.0);',

			//////////////////////////////////////////////////////////
			// intensity on angle					//
			//////////////////////////////////////////////////////////
			'vec3 normal	= vec3(vNormal.x, vNormal.y, abs(vNormal.z));',
			'float angleIntensity	= pow( dot(normal, vec3(0.0, 0.0, 1.0)), anglePower );',
			'intensity	= intensity * angleIntensity;',		
			// 'gl_FragColor	= vec4( lightColor, intensity );',

			//////////////////////////////////////////////////////////
			// final color						//
			//////////////////////////////////////////////////////////

			// set the final color
			'gl_FragColor	= vec4( lightColor, intensity);',
		'}'
	].join('\n');

	// create custom material from the shader code above
	//   that is within specially labeled script tags
	var material	= new THREE.ShaderMaterial({
		uniforms: { 
			attenuation	: {
				type	: "f",
				value	: 5.0
			},
			anglePower	: {
				type	: "f",
				value	: 1.2
			},
			spotPosition		: {
				type	: "v3",
				value	: new THREE.Vector3( 0, 0, 0 )
			},
			lightColor	: {
				type	: "c",
				value	: new THREE.Color('cyan')
			}
		},
		vertexShader	: vertexShader,
		fragmentShader	: fragmentShader,
		// side		: THREE.DoubleSide,
		// blending	: THREE.AdditiveBlending,
		transparent	: true,
		depthWrite	: false
	});
	return material;
    };
    
    return VolumetricSpotLightMaterial;
});

/**
 * vendor.js framework definition
 * @type {Object}
 */
define('lights/Volumetricspotlightmaterialdatgui',[], function(){
    
    var addVolumetricSpotlightMaterial2DatGui	= function( material, datGui )
    {
	datGui		= datGui || new dat.GUI();
	var uniforms	= material.uniforms;
	
        /**
         * options
         * @type object
         */
	var options  = {
		anglePower	: uniforms['anglePower'].value,
		attenuation	: uniforms['attenuation'].value,
		lightColor	: '#'+uniforms.lightColor.value.getHexString()
	};
        
        /**
         * 
         * @returns {undefined}
         */
	var onChange = function(){
		uniforms['anglePower'].value	= options.anglePower;
		uniforms['attenuation'].value	= options.attenuation;
		uniforms.lightColor.value.set( options.lightColor ); 
	};
	onChange();
	
	// config datGui
	datGui.add( options, 'anglePower', 0, 10)	.listen().onChange( onChange );
	datGui.add( options, 'attenuation', 0, 10)	.listen().onChange( onChange );
	datGui.addColor( options, 'lightColor' )	.listen().onChange( onChange );
    };
    
    return addVolumetricSpotlightMaterial2DatGui;
});


/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

define('lights/Volumetricspotlight',["three", "lights/Volumetricspotlightmaterial", "lights/Volumetricspotlightmaterialdatgui"], function( THREE, VolumetricSpotLightMaterial, addVolumetricSpotlightMaterial2DatGui )
{
    var geometry	= new THREE.CylinderGeometry( 0.1, 1.5, 5, 32*2, 20, true);
    // var geometry	= new THREE.CylinderGeometry( 0.1, 5*Math.cos(Math.PI/3)/1.5, 5, 32*2, 20, true);
    geometry.applyMatrix( new THREE.Matrix4().makeTranslation( 0, -geometry.parameters.height/2, 0 ) );
    geometry.applyMatrix( new THREE.Matrix4().makeRotationX( -Math.PI / 2 ) );
    // geometry.computeVertexNormals()
    // var geometry	= new THREE.BoxGeometry( 3, 1, 3 );
    // var material	= new THREE.MeshNormalMaterial({
    // 	side	: THREE.DoubleSide
    // });
    // var material	= new THREE.MeshPhongMaterial({
    // 	color		: 0x000000,
    // 	wireframe	: true,
    // })
    var material	= new VolumetricSpotLightMaterial();
    var mesh            = new THREE.Mesh( geometry, material );
	
    mesh.position.set(1.5,2,0);
    mesh.lookAt(new THREE.Vector3(0,0, 0));
    material.uniforms.lightColor.value.set('white');
    material.uniforms.spotPosition.value	= mesh.position;

    // add a DAT.Gui for fine tuning
    //new addVolumetricSpotlightMaterial2DatGui( material );
        
    return mesh;
});
/**
 * @license RequireJS text 2.0.14 Copyright (c) 2010-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/requirejs/text for details
 */
/*jslint regexp: true */
/*global require, XMLHttpRequest, ActiveXObject,
  define, window, process, Packages,
  java, location, Components, FileUtils */

define('base64',['module'], function (module) {
    'use strict';

    (function() {
        try {
            var a = new Uint8Array(1);
            return; //no need
        } catch(e) { }

        function subarray(start, end) {
            return this.slice(start, end);
        }

        function set_(array, offset) {
            if (arguments.length < 2) offset = 0;
            for (var i = 0, n = array.length; i < n; ++i, ++offset)
                this[offset] = array[i] & 0xFF;
        }

        // we need typed arrays
        function TypedArray(arg1) {
            var result;
            if (typeof arg1 === "number") {
                result = new Array(arg1);
                for (var i = 0; i < arg1; ++i)
                    result[i] = 0;
            } else
                result = arg1.slice(0);
            result.subarray = subarray;
            result.buffer = result;
            result.byteLength = result.length;
            result.set = set_;
            if (typeof arg1 === "object" && arg1.buffer)
                result.buffer = arg1.buffer;

            return result;
        }

        window.Uint8Array = TypedArray;
        window.Uint32Array = TypedArray;
        window.Int32Array = TypedArray;
    })();

    var base64, fs, Cc, Ci, xpcIsWindows,
        progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'],
        hasLocation = typeof location !== 'undefined' && location.href,
        defaultProtocol = hasLocation && location.protocol && location.protocol.replace(/\:/, ''),
        defaultHostName = hasLocation && location.hostname,
        defaultPort = hasLocation && (location.port || undefined),
        buildMap = {},
        masterConfig = (module.config && module.config()) || {};

    base64 = {
        version: '2.0.14',

        createXhr: masterConfig.createXhr || function () {
            //Would love to dump the ActiveX crap in here. Need IE 6 to die first.
            var xhr, i, progId;
            if (typeof XMLHttpRequest !== "undefined") {
                return new XMLHttpRequest();
            } else if (typeof ActiveXObject !== "undefined") {
                for (i = 0; i < 3; i += 1) {
                    progId = progIds[i];
                    try {
                        xhr = new ActiveXObject(progId);
                    } catch (e) {}

                    if (xhr) {
                        progIds = [progId];  // so faster next time
                        break;
                    }
                }
            }

            return xhr;
        },

        xdRegExp: /^((\w+)\:)?\/\/([^\/\\]+)/,

        /**
         * Is an URL on another domain. Only works for browser use, returns
         * false in non-browser environments. Only used to know if an
         * optimized .js version of a text resource should be loaded
         * instead.
         * @param {String} url
         * @param {String} protocol
         * @param {String} hostname
         * @param {Number} port
         * @returns Boolean
         */
        useXhr: function (url, protocol, hostname, port) {
            return true;
            var uProtocol, uHostName, uPort,
                match = base64.xdRegExp.exec(url);
            if (!match) {
                return true;
            }
            uProtocol = match[2];
            uHostName = match[3];

            uHostName = uHostName.split(':');
            uPort = uHostName[1];
            uHostName = uHostName[0];

            return (!uProtocol || uProtocol === protocol) &&
                   (!uHostName || uHostName.toLowerCase() === hostname.toLowerCase()) &&
                   ((!uPort && !uHostName) || uPort === port);
        },

        finishLoad: function (name, content, onLoad) {
            if (masterConfig.isBuild) {
                buildMap[name] = content;
            }
            onLoad(content);
        },

        load: function (name, req, onLoad, config) {
            // Do not bother with the work if a build and text will
            // not be inlined.
            if (config && config.isBuild && !config.inlineText) {
                onLoad();
                return;
            }

            masterConfig.isBuild = config && config.isBuild;

            var url = req.toUrl(name),
                useXhr = (masterConfig.useXhr) ||
                         base64.useXhr;

            // Do not load if it is an empty: url
            if (url.indexOf('empty:') === 0) {
                onLoad();
                return;
            }

            //Load the text. Use XHR if possible and in a browser.
            if (!hasLocation || useXhr(url, defaultProtocol, defaultHostName, defaultPort)) {
                base64.get(url, function (content) {
                    base64.finishLoad(name, content, onLoad);
                }, function (err) {
                    if (onLoad.error) {
                        onLoad.error(err);
                    }
                });
            } else {
                //Need to fetch the resource across domains. Assume
                //the resource has been optimized into a JS module. Fetch
                //by the module name + extension.
                req([name], function (content) {
                    base64.finishLoad(name, content, onLoad);
                });
            }
        },

        write: function (pluginName, moduleName, write, config) {
            if (buildMap.hasOwnProperty(moduleName)) {
                write.asModule(pluginName + "!" + moduleName,
                               "define(function () { return '" +
                                   buildMap[moduleName] +
                               "';});\n");
            }
        },

        writeFile: function (pluginName, moduleName, req, write, config) {
            //Use a '.js' file name so that it indicates it is a
            //script that can be loaded across domains.
            var fileName = req.toUrl(moduleName) + '.js';

            //Leverage own load() method to load plugin value, but only
            //write out values that do not have the strip argument,
            //to avoid any potential issues with ! in file names.
            base64.load(moduleName, req, function (value) {
                //Use own write() method to construct full module value.
                //But need to create shell that translates writeFile's
                //write() to the right interface.
                var textWrite = function (contents) {
                    return write(fileName, contents);
                };
                textWrite.asModule = function (moduleName, contents) {
                    return write.asModule(moduleName, fileName, contents);
                };

                base64.write(pluginName, moduleName, textWrite, config);
            }, config);
        }
    };

    if (masterConfig.env === 'node' || (!masterConfig.env &&
            typeof process !== "undefined" &&
            process.versions &&
            !!process.versions.node &&
            !process.versions['node-webkit'] &&
            !process.versions['atom-shell'])) {
        //Using special require.nodeRequire, something added by r.js.
        fs = require.nodeRequire('fs');

        base64.get = function (url, callback, errback) {
            try {
                // read binary data
                var file = fs.readFileSync(url);
                // convert binary data to base64 encoded string
                callback(new Buffer(file).toString('base64'));
            } catch (e) {
                if (errback) {
                    errback(e);
                }
            }
        };
    } else if (masterConfig.env === 'xhr' || (!masterConfig.env &&
            base64.createXhr())) {
        base64.get = function (url, callback, errback, headers) {
            var xhr = base64.createXhr(), header;
            xhr.open('GET', url, true);

            var isXHR2 = 'responseType' in xhr,
                hasOverride = 'overrideMimeType' in xhr;

            if (isXHR2) {
                // new browsers (XMLHttpRequest2-compliant)
                xhr.responseType = 'arraybuffer';
            } else if (hasOverride) {
                // old browsers (XMLHttpRequest-compliant)
                xhr.overrideMimeType('text/plain; charset=x-user-defined');
            } else {
                // IE9 (Microsoft.XMLHTTP-compliant)
                xhr.setRequestHeader('Accept-Charset', 'x-user-defined');
            }

            //Allow plugins direct access to xhr headers
            if (headers) {
                for (header in headers) {
                    if (headers.hasOwnProperty(header)) {
                        xhr.setRequestHeader(header.toLowerCase(), headers[header]);
                    }
                }
            }

            //Allow overrides specified in config
            if (masterConfig.onXhr) {
                masterConfig.onXhr(xhr, url);
            }

            xhr.onreadystatechange = function (evt) {
                var status, data, err;
                //Do not explicitly handle errors, those should be
                //visible via console output in the browser.
                if (xhr.readyState === 4) {
                    status = xhr.status || 0;
                    if (status > 399 && status < 600) {
                        //An http 4xx or 5xx error. Signal an error.
                        err = new Error(url + ' HTTP status: ' + status);
                        err.xhr = xhr;
                        if (errback) {
                            errback(err);
                        }
                    } else {
                        // emulating response field for IE9
                        if (!('response' in xhr)) {
                            xhr.response = new VBArray(xhr.responseBody).toArray().map(String.fromCharCode).join('');
                        }

                        data = base64ArrayBuffer(xhr.response);

                        callback(data);
                    }

                    if (masterConfig.onXhrComplete) {
                        masterConfig.onXhrComplete(xhr, url);
                    }
                }
            };
            xhr.send(null);
        };
    } else {
        throw new Error("No XHR available")
    }

    function base64ArrayBuffer(arrayBuffer) {
        var base64    = ''
        var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

        var bytes         = new Uint8Array(arrayBuffer)
        var byteLength    = bytes.byteLength
        var byteRemainder = byteLength % 3
        var mainLength    = byteLength - byteRemainder

        var a, b, c, d
        var chunk

        // Main loop deals with bytes in chunks of 3
        for (var i = 0; i < mainLength; i = i + 3) {
            // Combine the three bytes into a single integer
            chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

            // Use bitmasks to extract 6-bit segments from the triplet
            a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
            b = (chunk & 258048)   >> 12 // 258048   = (2^6 - 1) << 12
            c = (chunk & 4032)     >>  6 // 4032     = (2^6 - 1) << 6
            d = chunk & 63               // 63       = 2^6 - 1

            // Convert the raw binary segments to the appropriate ASCII encoding
            base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
        }

        // Deal with the remaining bytes and padding
        if (byteRemainder == 1) {
            chunk = bytes[mainLength]

            a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

            // Set the 4 least significant bits to zero
            b = (chunk & 3)   << 4 // 3   = 2^2 - 1

            base64 += encodings[a] + encodings[b] + '=='
        } else if (byteRemainder == 2) {
            chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

            a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
            b = (chunk & 1008)  >>  4 // 1008  = (2^6 - 1) << 4

            // Set the 2 least significant bits to zero
            c = (chunk & 15)    <<  2 // 15    = 2^4 - 1

            base64 += encodings[a] + encodings[b] + encodings[c] + '='
        }

        return base64
    }

    return base64;
});




define('base64!objects/Floor/textures/hardwood2_bump.jpg',[],function () { return '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RRQAUUUUABz6D86aRJ/Cyj6rn+tOpMnPQ/WgAG7uQfoKWiigBGGRjJH0oVVXp/OlooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiikLAHGQDQAtFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAEgDkgUAg9CDRSAAdKAFooooA5H4ksfL0mP+F7w7vp5bV0ul/8gy1x08lP/QRXN/Ex9ljp/GSbrHXn7p7d66PRv+QRZf8AXvH/AOgigC1RRRQAGiiigAooooAKKKKACiiigBGIUFj0FJHIsgJXPHqCKVlDKVOcH0oUbRjJPuaAFooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigBMn+6aWiigAooooAKKCARyM0iqq/dUD6CgBaKKKACiiigAooooAaQ28ENhe4xTqKKACiiigAooooAKKKKACmAy90T/vs/wCFPooAbmTP3Fx67v8A61OoooAKKKKACg9OuKKKAGlARglv++jSLGqrgFvxYmn0UDuxioVbPmOR6E5p9FFArhRRRQAUUUUAFFFJnnGDQAtFITjsTS0AFFFFABRRQaACiolW4BOZUYdspj+tS0AFFFFACOyoNzHApaKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAK5j4pv5fgPUX9DF/6NSunrmfikobwJqKt0Plf+jUprcBfhgoXwNpyq24DzQD/wBtXrpa5X4SBx8PdMEilXHmgg9c+a9dDqFxPbxb4LUznuN+2kBZoqvY3DXMId7eSBu6tg/qKsUAFFFFAAQPSiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACjPNFRzRu2CkrRkegyPyoAkooooAKKKKACiiigA7UUUUAFFFFABRRRQAUUUUAFFFFABRRRkZxnmgAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAE5z2x9aWiigA70UUUAMzNn7iY/wB8/wCFPoooAKKKKACiiigAooooA5T4jNElrZNKhOZiAcf7Ld66HRzu0izb1gT/ANBFc/8AEjb9hsNx6XWQP+ANXQaRxpNmMY/cJx/wEUwLVFFFIAooooAKKKKACiiigAooooAKKKKACiiigAooooAajq2drA4606iigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKaJFLbfmz/ummymbjyljPruJFA7ElFIhcj51UH2OaWgQUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUVHNcW8P+unij/33A/nQBJRUC3lm4+S6gb/AHZAamUhhkHIoAWikO7nGD7VH5koOGgJ91YH+eKAJaKqzx30hBjuI4Rjps3fzqSL7UP9b5Lf7uRQBNRTcyf3V/76/wDrUn70k/cUdupoAfRTAJcHLoT67D/jVP8A4nCy8/Ynj/2Qwb9TSuNIv1h+PI1m8KXsbdG8sf8AkRa1pEuGA2zJH64TP8zXL/Ffz4fAOozJdSLIvlYK8DmVB/WqW4i58NmZ/BWns2MnzDx/10auhZVZdrDIrnfhn/yJGnfNu4k5/wC2jV0dD3AAABgDAooopAFFFFABRRRQAUUUUAFFFFABRTQzbsbCB65p1ABRRQKACiiigAopGZVGWYAe5pQQenNABRRRQAUUUUAFId3YgfUUoORxzRQAUjbuNppaKACiiigAopFYN0OaWgAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACii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FFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABXF/HB2j+FusyIcMohI/7/JXaVxPx1OPhVrOPSH/0fHQgNrwHIZfCdlIep3/+htW5WT4Qihh8P26W7l4gX2kn/bNa1N7gFHOe2KKKQBRRRQAUUUUAFFFFABRRRQAUHkUUUAAooooAKKKKAEbGOai/eZ/dxAe7tU1B/KgY0sqgb2UfU4pxz2qGSI7vMjSMyf3n7VKob+JgT7DFAgAI6kmlooBBGRyKACiigZxyc0ARyyonykkn0UZNRMsFw4WSOQkDjcCBU77tpwwT3PNRRwncHed5T6cbfypjRG2mWLf8u4B9QxH8qsQRiKMKGZh/tHNOZlUEswAAycntURe3nJiDB/Xaen5UrCuK03zMsSeYV64OOfSmwvdN/rII0+kpP9KmVVUbVUAegFIWHmBOckE0AOooooAaEQHIRQfpTqZNIIkLbWY9lUZJ+lNjYyAMytGwPTNAEtFIyhlKsMg1FDbxwsSrynPZnJH60DJqa54+6zfQ0v4ZoRQowowKAGKMkHa4+rf/AF6kopCeeh+tAC0UUDmgQUUUUAFB4GaKbIu8bckDvjvQBAt2zH5bS4I9cLj+dTLJn/lm4+op9FABRUcscjOGSZkx2wCDUE91Na/NcQFo+7xc7R7jr/OgC3RTLeaK4iEsLh0PQin0AFIyq33lB+opaKAGkMv3MEehNOHT0oooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoopG3/wqp+pxQAtFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAHNeMYLd7zTZbh9zJMfLUnAztaugs/+PSHHTy1/lXN/EHrpJCsSt2zEgcY8p8iui07/kH23/XJf5CgbZPRRRQIKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAo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QAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAU103Y+dl+hp1FAAQCMEZHvSBQv3QB9BS0UAFFFFABRRRQAUUUUAFFFFABRQPoRUBln34FqxX13igCeio43kZsNCVHruBqSgAoppDH+Lb9KEXaPvMfqc0AKzKoyxAHqaQSRkZDqR9aCiscsoJ96dQAgYHpn8qWiigCpdR37t/o91HEPeLd/WnQw3YbM12HHosQX/GrJIAyTgU0SRk4DqfoaB6jqR1V12soYehFLmgH6/lQIakcaDCIq/QU4gelFFACFVJyVB/CgAKMKAB7UM6r95lH1NNMiAct+lAx9M8qLeJPLTeOjY5oEqk8bv++TT6A1CuS1fTft3ju3ncyKtvBGVwO+9jmutrCur5U8VrbMpB8mLB9cs1VERu0UUVIBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRSBgSVzyOopaACiiigAopGJA4Ut9KWgAooooAKKKKACiiigDz/4zQ+dZ2ChsH97/AOyV6BXnfxikYXuhwhsLJ5+78PL/AMa9EpvZAFFFFIAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooARlDAg9KSNEjUKihV9AMU6igAooooAKKKKACiiigAooooAKKKKACiiigBCAeoBpaKKACiiigAooooAKKKKACiiigArldUQf8ACbQOp52Q5H/Amrqq5HUpD/wnqRjOfKtyfpvaqjuB11FFFSAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFNIbPDfmKdRQACg57YoooAKKKKACjvRRQAVWEM0hLvcuueix4AH+NWaKAGqp2gOd5HcinUUUAIQT/ER9KYsbB9xmkb2OMfoKkooAKKKMj1FABRRRQAUUUUAFFFFAHn/xbg8y90WY/di8/I9c+XXoFcH8X7gQ21hHjJcyY59Nv+Nd5VPZAFFFFSAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFchqLxr8QYwvLmGAH2+d66+uNvI1/wCFpbiBzYW5/HzZKa3A7KiiikAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFBOOvFFFAAORRRRQAUUUUAFFFFABRRRQAUUUUAFFFFACPu2nZgN2zUUK3BwZzFkf3AefzqaigAopkrbE3bhkevenjpQAUUUUAFFFFAEUk6I4T5mf0UZqWiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAxzRRRQAUUUUAFFFFABQKKKAK7STbyqx8f3sdKbNbMSH+1MjA9SoxVqmOzAgCMsD15oKv2HIMKAW3e9BZV6sB9TTTHlgwLJ6gd6a8ZIO7Eq/3WAoEQXq6gyh7G4g652yJwR9RVVdYjjzHqltLaSepUuh+jCrVvawRSma1XyyeHQHAP4etW+GXkcEdDQO5FAttIomh8t1PRlORUqqq/dUD6Cqb6fslaWzna2ZjllC5Rj64qWJrxQRNHHIfVDjP4Gi4Wv1ON+KMYmvtHhZNyETFvb7ld1XEfEPULeO8sLWRSkxSRlBXr9zpXb1T2RFrNhRRRUjCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAriNUuFi+KCKQSWtLZeO2ZZK7euJ1sxD4j2wdcMYbcqfX949NAdtRRRSAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKRWVvusD9DS0AFFFFABRRRQAUUUHpQAUUCigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAprqW/iIHsKdRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFMkmjj+9IoPuaAH0U0On94fnTsj1oAKKKKACigCigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigApFZWzggkdR6UtMWKNZDJtG89TQA+m7xu2HhsZA9qdWdqPmW99BeBGkiAKSBRyuejUDRbFxGLn7O5xIRkccMPapqoXUiT3VssKeaUbfuHRRV5c4+bAP1oBoWikOar3DXWA1tscqcMj8Z/GkI4D4yKv9reHpCcOoudvvxHXpFea/FmOa61rw1J5MiIguDIT0XIj4/SvSqt7IAoooqQCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigArgPEhb/AIWfYM52oI7dVz3Jkau/rzrxmnmfErR+cBWtyfc+aaqO4HotFFFSAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAHE6d8UfCd1CXnmvrFwxHlz2bkkYBzmMMuOfXPBq0fiP4NAz/a0mP+vOf/AOIrlfhl4M03W/DcWtauXuGui2yJHKCIKxXqOpyDzXXx+AfCadNLP43Ev/xVbSVJPdi1Kx+JvgkddYk/8Ap//iKY3xR8Cr97WmH/AG5T/wDxFXG8A+Em+9pOf+3iX/4qm/8ACvfB/wD0Bl/7/wAv/wAVU/u/MNSp/wALS8C/9BmX/wAALj/43T/+FneCcZ/tW4/8F9z/APG6sj4f+EMYGjgD/r4l/wDiqmj8EeF40KppYVT1HnSf/FUe55hqZ5+J/gkHnVbgf9w65/8AjdH/AAs/wT/0Fp//AAX3H/xuprr4e+GJ/wDlzkQ+qzv/AI1C3wz8IsMGxn/8CpP8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xrIu1sgexqN4YVhO8tgdSTzQBKzqAeRmmfOzjIyhH5VXsoWw3zHAb5TT0F0JyrSZjzwdooAtDOOeaKKhmWc48uQL6/LmgBxmAz8rHjPAzmq0eoRvcCLayg9zSSfakX5pGOfVR/Smx2szASYVW/2utMDQopkPmBQJNufVTT6QBTd3zkc8deDS8/Smyx+YpGcHscUAPJwO1NMij7zAVUEd4vV0YexIp/kFn+fA9xSGTmWPON4zTgQelVjDCkvzSKOPunApzzwxv7jjNMRYqOSaKLh321BDeiSby/LI98066C5B8kSUATo6OMowb6U6mRKoUFY9ntT+9ABRRSBR6UALRRRQAUUUUAFFFFABRRRQAUUUUABoAoooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACub+Jy7/A+oLzz5XT/AK6pXSVznxMIHgnUCTgfuv8A0alNbgX/AApIJNAtpB0O/H/fZrUrJ8HhR4ctAucYb/0M1rUgCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKADvRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABQRkEetV44JI5A4uJXyeQx4x9KsUAFFFFABRRRQAjusalnYBR1JoVlYZVgR6g0p6U1Y0U5VFX6DFADqKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKDn1xQAUUgH+0TS49zQAUUAYHf86KACiiigAopkyM6jY+xx0OM0kfnD/WshPYIpoAkooHT0oNABRTMTbx8yFO42kH+dPoAKKKKACiiigAooooApasyRi3ldc7JgR+Rq5Gd0at6gGsDxpNLDHp7RuVDXO1h65Rq2rNj9igZuvlrn64qnsgJqM1A0jNlRhT9aeJEaP5mU8cjNSBJRVWe4RYB5cmfc1PBuMSluuKAH0YGc45oooAMD0pGUNjPalooAKKKKACim7xv2cg04kUAFFA9aKACmyRrIBup1GfbFADEXZ8qqAPWlkfYhbazeyjJp1FAEUNxHL03D/eGKlopCoNADXjXHGV/3Tin0hUEc5/OmyR7lwrsn0NMB9BIAyTgVD5LEfvJNx9duKfHHtXaTuHvQBFeW/wBoi/dvtbs1QWunyQNu+1Mx/wB3A/nV+kY4B4J+lIBRRUE822Pd80fOOVzTRukHF0hyP7op2HYsADHQUtRQwmNid+R6AYqWkIKKQAAn3paACmtuYY3FPcf/AFxTqDyMUAIQGANUJ1mW5J85c/w1ceCJxhkyPrUa2Nqv3Y8f8CP+NAEIumJ2b0dvQEVIk0m9Qw2jGWyM1YijSNdqKFHtQEQNuCjPrimMSOQyEkKQvqeKfRRSERXM6wIGZS2egFZWo6pfQN+5tAy/7Sk/yNas8TSAbZXjP+zUgHAzyfXFAGZp+oXlynzWOD6gkD9RVyBrh03vGUbP3SeKsUUAUxNdi5EciRqhP3sf/Xq2WAGSQB6mlooAjM8I6yx4/wB6q32xmnKxBHQd1bNXaRunQH2NA0QrcAttaNgfbmplYMOKgZJByltbk9svj/2WnRqwHzQQr/utn+lAaCXFykJwysf93FN+1k8rbyFP71PeKJj81srH1KipgABgDAoEQQXUMzbVLZ9xUkyM6ELIUPqKEhiRzIsahj1IFPoGNj3BAGyT706igkAcnFAgpDjuM/hSg5HHNFABUckyx9Vc/RCaV5I0OGcD60iTQyEhZFJ9M0AMa7iXqs3/AH5f/ChbqJhwsxH/AFxf/CpzxRQA1GVh8oIHupFOoooATcv94Ux5olcKXG49qkooAjZlLquR171JRRQA3zF8zZn5vSnUUUAQXd1FbJukJyegAyahh1KCQjhgD0Jq28cb/fRW+ozTRbwYx5MeP90UASA5AI6UU0Roo+VQv+7xTfJj3FsNk99xoAZdwmZRg9O1Z0VvcSNjYSgPVjWvtG3bjij5UAGMDtgUANjVFjGE28dMc0izwsdqyoW9N3NSD1qPyI/M8znP1oARDP5mG8sr3xkGpaQAZ4paACiiigAooooAKKaTJ/dX/vr/AOtThnvigAooooAKKKKACiiigAPTimK0hfDRgL65zT6KACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigArnPiXH5vgnUIwcbvK5/7apXR1i+OIjN4WvIwcEhOf+BrTjugF8EjHhizGc/f5/wCBtWzWN4KBHhizBBBAfr/vtWzSAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACkIB6gH60tFABRRRQAUUUUAFFFFAGL4rthPBauSx8qfcFHQnacGtKw3NYxeYc5UflWf4s8w6fEsRIdpgo/I1oaahjsIFY5IjHP4Vb+FAOlWKKPcwJGfqaeixsobb9M0rorjawyKcOBgcCoAhmtYpAQQV+lSouxAuScdzSEtvAC5Hc56UpZQQCwBPQetAC0UUUAFFFFABRRRkZx3oAKD0oooATaPTBx2paKKACiiigANFFFABRRRQAUUUUAFFFFABRRRQAU1kRvvIrfUZp1FACBcY28D0FBzjg4/ClooAbtOPvt+lJsbdnzX+mB/hT6KAGqHA5YH8KdRRQAUUUgY4+6R+VACnPbFFGeehooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoIBGDyKKKAAcCiiigBNvXk/nURt1zncxb1OM1NRQBGsbB9xkbA6LxjFSUUUAFFFFABRRRQAUhz2OKWigBBn60vOe2KKKAGkMWHzYHcY60oDZ5bI+lLRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABTZHEaFmzj2p1FADIpBIMrjHtT6KKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKoeIY/N0eeP12/8AoQq9tX+6PyrK8XyND4cupEyCoQjH++Kcd0Ba0VVXTIVXoM/zNXK574dNdSeELKS8dmnbzN+7/ro1dDSAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKbIHI+Rgp9xmgB1FAzjnk0UAFFFFABRRSBgTjIzQAtFFFABRRRQAUUyWQRruIJHtTgQVDdjRcBaKR2VFLMcCo1nVgCEfn2oHYloqMy4XcUYD1OP8aYLy3IyHOP90/4UBZk9FQrdQN0kz/wE1MCCMg5FAgooJAHNRmaMdS3/fJoAkoqL7RF/eP/AHyaQXUBbbvIPupFFgJqKYZEHXP5GkE0R6N+hoAkoqM3EP8Af/Sm/aoM/wCsH5GgCaio/Pi/vfoacZEAyW4oAdRUJuoB1kH5GmNqFopwZv8Ax0/4UAWaKqjUbM/8tv8Ax0/4Uf2hZ/8APUn6I3+FA7Fqiq3261x/rD/3wf8AClF7bkAh2OemEb/CgVixRSI6uMqcj6UtABRTWfHRS30pUbcM7Sv1oAw/GzFdLiwSD568/g1amk5Ol2hYknyEyT/uisvxeks9vDDGmVVjI59MA/41q6aMadbD0hT+QpvYCxRRRSAKQKoJIAyeppaKACiiigAooooAKQgEc0tFABRRRQAUUUUAFFFFABRRRQAUUUUAFFIDkfdIpaACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiimhWB/1jH24/wAKAHUUUUAFFFFABRRRQAUUhUE5IBNLQAUUUUAFFFFACM6qQGYAnpk9aWk2ru3bRn1xS0ANaSNfvOo+ppwIPQg/SkZEb7yqfqKUADoMUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRzQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABWD8QZfJ8I3suM7fL4/7aLW9WN43iSbwveRyDKnZn8HU01uBJ4SmguNAtpLfmM7scf7RrVrB+H/l/wDCI2Xl52fvMZ/66NW9SYBSZ9jS0UAIWA9fyNIXX0b/AL5NOooAj89M42y/9+m/wpRIp7P+KH/Cnjp60UAAoNAprOi/edR9TQA4UUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFACMqt95VP1FLgYxgYoooAKMUUUANeNXG1s4+pqEWVsDkRnP+8f8asUUBcqnT7Q/8sz/AN9t/jTf7Nt92Ve4X2EzY/nVyigd2V47NI+ktw3+9KxpxEqn93GhHvIR/SpqKLiIczN96CP/AL+f/Wow4ORAM+z1NRRdgN3Nj/Vt+n+NAZj1jYfXH+NOooAQjvtzSBFzkrz7806igBCi5ztGfpSFFJzTqKLgNdgCAVY/QZphghZtxhXPripaKAIvs0HaMD6cU4QxjotPop3YDPKjxjaKBFGBtCjFPopAAAAwBgUUUUAFFFFAGfq6pLHF+8xl8cHqNpq7bqFt41GcBQBn6VkeJEVrrTduRL556dCuxs5rZjGEUewpvYXUWiiikMKKKKACiijvQAUUUUAFBoooAB0ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAEZSejsv0xQBjuTS0UABooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKx/GjbfDV2f9z/0Na2KwvHx2+Er0/7n/oxaa3Af4IQR+F7NBjA39P8AfatquV0rxJo+n2CWbTEyQ53ouMoCSRnJ9Kux+LNEfH+lBfqy/wCNJsdjdorH/wCEk0oqGSfzAf7mD/WrI1ezIUhm+bpxRYLF+iq9teQT8K2D71YoEFFQG8tQ20zJnOKmRlcZUgigBaKKKACiiigAooooAKKKKACiiigAooooATB/vH9KUZoooAhl+1Z/dGHH+0DT187+IRn6E0+igAoOccYoooAbmT+6v/fX/wBakUy/xIg+jk/0p9FACDd3AH40tFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAAelNViT9xh7nFOoAA6ACgAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKDnHHBoooA5/xLPc2MtrcBlkRnKnPY44GK27SQy2kMp4Lxqx/EVj+Mo1ltrNHYDNyMA9zsatizG2zhX0jUfpT6AS/hRRRSAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKQkCmlizlVI4+8fSnKoUYAoGKDnsRSFlHU4+tLRQIByOKKaRnlflP+etRwzFnaKRdsi847EeooAmooooAKB0oooAKKZNJ5a/KpdjwFHenJu2jft3d8dKAsLRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFc58TJPJ8EajJ/dEf/oxa6Oua+KEfm+BtQj3bdxi5/wC2qU1uBDqUHh24ufNn0HT7kgbQ8kKHA/EUrab4UdA76Ho6t6CCPP8AKqlr8PbUITe6xqM8pbJaNlQH8CDz170svw40mQ5Oq6yPpcJ/8RRpcLu2pYbQPCM0iM1rpaY/hULVkeH/AApji1sD/wACB/rWYvw20lTuOra2x97lf/iKsx+AtOj+7qus/wDgQv8A8TTuF2WxoPhVSCtna8dAr4/rVpdL0FEyscIHtMf8ay38Caex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gPMij8aAHUUDpxzQaAPPfi5M1peaVNG2GkWZGH94Dbj+dehVxHxRW1U6fJNHvYCUL1z/AA129U9kJBRRRUjCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooIyMc0xY9rZ3P9C2aAH0UyVZGA8uQJ9VzVd11JQBHJbSepdSp/SgC3RVdJrpR++tef+mb7v54qdW3DoR7GgA2r/dH5UbVz0H5UtFABRRRQAUGiigAooooAKKKKACiiigAooooARgT0Yr9MUAEfxE/WlooAKOc9KKKAEJx2J+lMEynqkg+qGpKKAGh12luQB/eGP504EEZByKKKACimNDC33ooz9VFRNY2bPuNtFu9dtAFiigAKAAMAVG6zbhslQL6FMn880ASUUUjbv4WA+ozQAtFMXzB9/De6jH6U4HPr+VAC0UhYDqQPrS0AFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQA3Yn9xfypwAAwBiiigAooooAOc9sfSiiigAooooAKKKKACiiigAooooAKKKKACiiigAoNFFACHPYfnSfvCvRQfrmnUUAIA38TA/QYpSKKKAEKg+v5mkVEU5VFB9hTqKACiiigAooooAKKKrG8iMnlxK8xzg7BkD6mgaTZZoqqxv5CAqxQDPJY7yR+FNa3uCxMl7KVPRUULj8aVxqPmXKYZYx1kX86gjsoQcsHf/fbNWVVVGFUAewo1BpIb5gIyqs34Vxd7a3Unj1L+ZvLi3Qxxp6gM3/167euT1S1abxxHm4kVBFFIoHZizD/2UVpBasiXodZRRRUDCikO71H5UfN6j8qAFoopCP8AaNAC0Uwxt/z2kH4L/hS7W/56P+Q/woAdRTQp/vsfyp1AABj1/OiigUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRR3ooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACkViTyjL9cUtFABQfpmiigAooooAKKKKACiiigAooooADUEduEnMu76DGMVPRRYLiYGc96SR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FPszf40fufMP3nkYo8a23/QC17/wEH/xVO/4TGP/AKF3xCfpZg/+zVujT7MdIf8Ax4/41ItrAowE4+ppN0ulybVe6Od/4TOLt4c8Rn6WQ/8AiqePF8ZGf+Ef8QD/ALcx/wDFV0AtoAf9WKcsca9FApXh2K/eeRz6+LEP/Mv6+PraD/4qmt4wt1ODoutf+Ay//FV0ZjQ9VFM+zQZP7peaE4dUH7zyOTn+IekwnE2nash9DAv/AMVWfqfxU0q3tw9tpl9K5YDbKAgIOehXcSeOmK7eXTbCb/W2cL/VBXPeKfC+jPpslxHarFNEQUZB6kDH61adHqmFp9y78P3EnhCxdTkHec/9tGrerl/hVMJ/AWmyhSoPm8H/AK6vXUVi9zQKKKKQBRRRQAUUUUAFIMg9SQf0oLDO0df5UtABRRRQAVHcLK0RELbW96kpGZVG5iAPU0AMg8xQEkwSB94d6kqGfzG2+Ttz/ePSph9c0AFFFFABSOqsOfwI6ilooAakYX+Jz9WpJGkUZRA/tuwafRQBBFJct9+3WP8A7aZ/pU4zjkYNFFABTN7bciNs+hIFPooAKQE56GlooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACimkNvBDYHcY60y8dktnZeOOuelADWuQZTFCplcfewflX6ms670/UricyHWGtQfurEgI/WtO0t47aBYoxgDqe5PqakcBkKsoII6EZoGtzDtodfsFLyXcepwgkldmyTHt2rYtporq3WWPlWHIPb2NZlrb/ANn6xHDbsVt7hWYxdlYDqK0Le2WC4mkThZCDtHQH1oHIZPZRtIksShWDDco4DCrIRRjA6cD6U6igkQkKC3bqaWik3DOMjPpQAtIeRgilooAQAAcACloooAKYXb/nk/5j/Gn0UAIORyCPY0BQvQY9hSIzE4aMr75BFOoAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoqORHZgVkKjuKeoIHPJoAWiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAMvxIoe2t1YgZnHP/AAFqv2Y22cK+kaj9Ky/F7+XYQt388Y9uDWlpx3afbH1iX+QpgT0UUUgCiiigAooooAKKKKACiiigAooooAKaZFz0b/vk06igAzx0NIDkfdI+tLRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFNBbzWB+7gY+vOf6U6gBsIxEoyTx1NOpsP+qXIwcYp1DAKCM0UUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAjDIxkj6UiKy5y+76inUUAMZ2XrGSP9nmkWaMgZ3Ln+8pX+dSUUAFFFFABRRRQAUUUUANKt/wA9GH4D/CnDgdSfrRRQAUUUUAFFFFABRRRQAUUUUAFFFFABQaKKAI2jbOVmdfbgj+VSUUUAFIwDDDAEe9LRQADiiiigAooooAKKKKACk+bPUY+lLRQADpzRRRQAUUUUAFFFFABQSAMngUUUAFFFFABRRRQAUUUUAFYHxCme38IXs0ZIZPLIx/10Wt+ue+JEbzeC7+OMZZvLA/7+LTW4DPhlatZ+CNPt5OWUSZ5z1kY10lZHgz/kWrPHo3/oZrXpAFFFFABRRRQAVT1GW5XEdtGxJ6sB0qWG0hjmaYAtIerMcmp6AIrWMxxDcSWPLHHepaKKACiiigAoIB6gGmTrI6bY32Enlscge1LGu1Qu5m9yeaAHUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABTZUWSNo2GVYYNOooAr2HmrD5Mw+eP5c/3h2NWD0oooApQ2aw3TXlxN5szDapIwFHoBV0ZwM9e9JtGQTyR3paB3Cq5u41kZHSVQDjeV+U/jU7KrdevqODSgAdBigQm4FNy/MMZGO9IjAjhWX6jFOAx04HpRQAUUUjFh91d340ALRRRQAUUUUAFAIPSikwQTjvQAtFFFABRRRQAUUUUAJtX+6PypaKbKxWMsoBPYHvQA6ioLW4Mw5jKEHBGanoAKKKKACiiigAooooAKKKKACiiigAooo70AFFFFABRRRQAUnP1paKACiiigAooxSAAdOKAFoprrvGNzD6HFIkaqchnP1cmgB9FFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAGR4tTzNLA2g4kBye3B5q/pf8AyDLX/rin/oIqDXs/YeBkbxn6c1ZsOLG3x/zyX+VAE1FFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUjOqn5mUfU0ALRQDkZFBoAKCcDoT9KTbzzzS0ANQufvKF/HNOH50UUAFB4FIGBPy8+4pe+e9ABRSLu53EH8KWgBrNtdVx94/0p1IxABZsADnJ7UKQwDDuOKAFoopk0iQxmSRgqjqaAHgdaKr27yrKYJQWHVJP7w9PrVigAooooAKKKKACio7mUQwmQjOKdE2+NW2lcjoaAHUUUUAFFFFABSB1JKg8jqKWigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKx/GjpH4au3kGVGzP/fa1sVz3xHBPgvUAvXEeP+/i01uBpeHkWLR7eNTkANj/AL6NX6wfAEhm8KWc7ZLSGQkn/ro1b1D3BBRRRSAKKKKACiikZlUFmIAHUmgAY4UnBPsKWoJby1iGZLiMfjmpIZo5k3xuGX1FAEdyJ5EKRooz/EzdKZZ28kOS5jLeoyf51aBB6HNMVmL4KkDHWgY+iiigQUUUUAFFFFABRRRQAUUUUAFFFFABRSOyopZjgDqaWgAooooAKKKKACiiigAooooAKCQOvFFFABRUTW67WEbNHn+6akRdqhck+5NAC0UUUAFFFFABRTSZN/yqpX1Lc/yp1ABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAySKOQYkjR/8AeGacqqo2qAB7UtFABRRRQAUUUUAFFFFABRRRQAUUUUAFcVqMOr6n4t1K1s9WksZLaBGgVfunP972zXa1zXizSNQe+t9e0N0XUbUFWicfLPGeqn39DTQXMbTfiHHpuof2L43tTot8qApcuc29x7hh93+XB5HSulk8VeGY7MXja/pvkHo4uVIP5GobHUtC8U2L2N5BBI/SexukBZT/ALp6/UVWT4e+CI3Ei+GtPBHOTHQBUfxdJr90dP8ACEZuRj97qDKRFEPbI+Y1oaBePJ4jvbFp2mNrEFdic/NmsrxT4wt9PEegeEreG/1eU+XFFCP3Vv8A7TkcAD0ra8EaDJoWlst3cfar+4cy3U5/jc/0FPoBvUUUVIBRRQQCMEAj3oAKKaFwflJA7inUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRTGk2sF2s3uBwKeDnsRQAUUUUAFFFFAGb4kZl007DglgP0NWtMz/Ztrnr5KfyFR61DHNp0vmZwqlsg+1SaYQdOtiOnkpj8hRYCxRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFAAHQAUUUAFFFFABRSNu6KB9TSjPfmgBokjLbQ6k+gPNEsayJsb7p6j1p1FAAAAAAAAOgFFFFABRRUUkZmwH4j/u+v1oASSIzON7/uhyFH8X1qagdKKACmyxpKmyRdy9wadRQAcZH6Vmx6i8t3PDDCzeQ22RCMN9R61pU1UUSM4UBmwCfXFAxVIZQw6EZFLRRQIKKCARggH60YHoKAA0UUUAFFFFABRRRQAUHpRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFGRnHegAooooAKKKKACiiigAooooAKKZLJHGB5jYzwBjOafQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAIAB0AH0paKKACiiigAooooAKKKKACiiigArC8fyiHwjfSMu4LsyP+2i1u1hePoxN4SvYzwD5ef+/i0AQfDH/kRtO7/wCsP/kRq6PcN2Oc/Sub+GDF/A2nsV2583j0/evXS0MAooooApait6/y2r7cjjjj8TVWCz1XzQZLw7B2Lcn8hWvRQO5Sms5pYPLNwQx/i5/xqCLRo1wXncn/AGQB/PNalFAig+kWMhBmjaXH95jVuCGKBNkKBF9BUlFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAHkYPIoAwMDgUUUAFFFFABSMwGBnk9KWmGNDMJSvzgYB9BQA/v0ozziquqX1nYWjTXtwsEfTcTg59q5y18XW+4z+RfXFsF5ljgJUD1p2A62iub0PxZZatqLW9pIJE6DKlSD+NdJQ1YAooopAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFI2SDg4PrTViQHcRub1PJoAfRRRQAUUUUAFFFFABRRRQAHkUDgUUUAFFFFABRRTFkDNgK/1KkD9aAH0UUyYyhf3QUn3oAfRWTYrrZ1AtdyoLfJwqKuMfzrWoAbI+xd21m/3RmnA5GRQeRRQAUGiigAooooAKKKKACiiigDK1rw9pOrusl5agzL0lQlH/MVnXHgjRblv9Il1OVf7rX0mP5101FPmYGdomh6TosPlabYw247sq/MfqetaNFFIAopCwBAzyaWgAooooAKKKazMG2qhPv0AoAdRTVEmfmZcegH9adQA1nVWCluT0FOoooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigCprKs2l3Kp1Mbfyp2lDGl2g/6Yp/6CKW/ZhEFUDDkqxPYYNSwDbCi+igfpT6APooopAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAAeBSHPYUuBnOOaKAAZ7miiigAooooAKKKR22qW2lsdh1NAC0wSxlwisCx7Dmki8x4/3yKM/wAPXH1pyIkY2oiqPQDFADqKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigApCwHUgfWlpMDOcDPrQAtFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUE4HPFAIIyCCKACiiigAoprOqnDNg0oIPSgBaKKq3V/DbffDn/dANAWLVFV7S8hus+VnjrmpmkCnGD+VAWHUVF53zbdp/EU/fn7oz+dADqxPHRC+Fbwnp8n/AKGtbJLfwj8xWF493f8ACL3YztUlAcZzjeKa3Ad4BMbeE7Mw8R5kx/38at2ue+HH/Il6f9JP/RjV0NJgFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFACBlJKhgSOoplxMlvA80hIRBk0k1tBMwaWJXI6EisDXL7Gt2GkcGKSZSwI7Y6UDNZbOC8Md1eQLI+MojjIQduD3q8AAAAAAOgFFFAileabY3kwmeFVuEPyzIMOp7c/41PaNJtMc3MicZ/vDsaYRtu4pfutICrr64GRVjaN27vjFCGxaKKKBBRRRQAUUUUAFFFFABRRRQAUUUUAFJuGduRn0paKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiikG7JyQR2wKAFooooAKDRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQBXvyoiXd3bAP4Gpov9Un+6Kq6wUFplyR83y49cGrFr/x7Rf7g/lT6ASUUUUgCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigApF3ZbcQRnjHYUtFABRRTfLj3bvLXPXOKAHUUUGgBGzjjjmlpk8yQx+ZIcKDyfSn0AFFHb1+lMWTc33Wx7qRQA+imSSbCPkYjuR2p46UAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAIyq2Nyg46ZFLRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUjsEUsegoAWiiigAoqJphuKRqZHHUDt9TUU8dwyFvOKnsqD+tAFqioUWO4gBddwPUH1pVtrdW3LCgP0oAlopAoB4AFLQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUARvFuB3SP8AgcU5FCLtGcU6igAooooAZJGjkblz+NOVQowowKWigAqN4IX+9DG31UGpKKAGpHGg+RFX6DFOoooAKKKKACsLx9/yKV76/u//AEYtbtYvjjP/AAi93jr+7x/32tNbgyp8L8f8ILp2Dkfvf/Rr10tcr8Jju+H+mEf9Nf8A0a9dVSYBRRRQAEZHejH1/OiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACua8Y2b+bBqUGfOiYFW9COldLTJkSWNopEDo4IYHpigCHTLyO+tEmjIyQNy/3T6VZrKstK/s+Z5LWZijHlG9PrVySeYJujgWT0HmYNAE+wGUSHqBgD0pwOelVo1uZv8AX7Yl7qhyT+NWRwMDgUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAFHWVDWyBs/6z+hq1bf8AHvF/uD+VQ6iygQb+hlx/461WVxtGOmKfQBaKKKQBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAEBgQQCD1BqDf9nIV8+V0DensanoPIweRQAA5+lFIiqgwowPSloAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAopNi79+0bsYzS0AFFFFABQeRRRQAik52tycdfWlqtqEv2dEnK5VH+cgdFwef5VYRldFdSCrDII7igBar3LTtIsMKlQRlpP7v/ANerFFADIY1iQIgwP505xuUj8qWigDP0hphujlU4PzA/oRWhSBcMT2paACiiigAIyMGgcCiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigBFOR0I+tYnj2f7L4TvZ9oYJ5ZIPp5i1uVgfERDJ4OvkUEk+XjH/AF0WhAVPhKoX4faYF6fvcf8Af166quV+E3/JP9M7/wCt/wDRr11VABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRQeRXL6nea1Y3pZIjJCScEgkLQB1FFctb6hqV26scpj0WuhsppJE/eDDY9KB2LFNKI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9F/Onc+1ABRRSfN6D86AFoppL4+6v/fX/wBamB59+DCoHr5n/wBagCWiikB9iKAFooooAKKKKACiiigAooooAKKKKACiiigAIBGCAR6VVfTdOdiz2FqxPUmJf8KtUUAZ8mi6S+c6dagnqREo/pVceGdF3ZNlEfqg/wAK2KKLDuVf7N07y/L+w22z08pcVC+iaQ2P+JZaDHpCo/pWhRQIzBoOkBs/2fbH3MS/4VVuvCmj3D7ms4AO48pTmt2indj5mcvfeBdAukKtZxL9EqkPhxoY/wCWcRHoYc/1rtaKLsLnk3xH8M2Oi6DF9kkMf7x5HRF2h/ujp616zXm/x7uFg8OwZxufeq/mlekU29EIKKKKkAooooAKKKKACiiigBrCTPysoHuuf600edvO7yyvbGQakooAYzuv/LIt/ukf1xSJLubDRSJ9R/hUlFADPNj3bS2D7jFL5kf99fzp1Iyqwwygj0IoANw9RS03Yn9xfyo8uP8A55p+VADqKaY1III6+9ARR6/maAHUZGeopvlp/dFNaFSQecg+poAkpodC20MCaFRV6AClAA6AD1oAR3VRlmApUZWGVOR60tFABRRRQAjbsfKQPqM1GfN2/MqNz0H/ANepaCM+v500ADOORg0jkqpIUsfQUtFIBEJKAkYOOhpR0oooAKKKYsiMcAnPuCP50APooooAKKiluIYiPMYpn1U1KORmgAoprSIv3nVfqacORkc0AFFFFABRRRQAUUUUAFFFFABRRRQAUUE4GTQKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACgDHSiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACuJ8Usv/AAnemK8e7/UbT/21NdtXFeKo3bxpYyRmPMccb7W7kO2P5VUdwO1opEYkDKlTilqQCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAFFFFABRRRQAUUUUAFFFFABRRRQAUUh3Z4YAe4pR0oAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAopFYHowP0paACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiggEYIBFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUEUUUAIAB0FLRSMobrn8CRQAtFMMa+r/APfZ/wAaPKX1f/vs/wCNAD6Kb5a+r/8AfZpwGPX86ACig/WigAooooA8q/aK2/2Tpu4tgmXODjj5D/SvVa82+POmQ32gxSFyJ41fYCeGGV3D8q9JGcc9ab2QBRUNzcw26gzSBc9B3NNiujIMrazgepCjP60WYFiiq4vIN22RvKb0firFKwAaRd2PmwT6ilooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigCqn2wXZ3LmHtyOKtUUUAFFFFABRRRQAUUUUAFFFFACAc/eJpaKKACiiigBkkaSDDjP44p9FFADWRG+8qn6inAADAAApFzj5sE+1LQA10Dd2H0YinUUUAFFFFAAc44ODUbibB2yRg9soT/AFqSigCsZLtOHgRxjO5D/Q81YU5AOCPY0HOeCPoaWgAooqOCXzAflKsOoNAElFFFADXDHG1sfhTqKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKO1RfZ4853S/9/W/xoAkCn+836UFT/eI/Klpnlrnq/wD32aAH4+tFJtHv+ZpaACiigj6/nQAUUUmQO4/OgBaCM+tAIPQg0UAJt9z+dAGO5NNRyWKsp9jtNOYkDIGaAFooFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAVxPih7b/hOtPST/AFhEQOD/AA72zXbVyuq/Zj40i3RK0gjjLEjJxuNVHcDqqKTavoPypakAopMjOM80tABRQSB1OKYZIx/FQA+imq6N91gfxoLqP4qAHUVGZ4h1f9KPPhx/rBQBJRUYaOQELN/3yRTl+VeWJ9zQA6ikDL60nmJu27hmgLjqKYZFJ2q4z9M05enLZNAC0U1lJ6SMPpigK2f9Yx/Af4UAOopkm4AYkC/UUwmbOBNGD6GI/wCNAE1FQ4uP+e0OP+uZ/wDiqasskY/fYP8AuRtQOxYoqs97Cv8AyzuD9IH/AMKYNStf4vOT/ehYf0oCzLlFV/t1t3kI+qN/hR9stv8Anp/46aBWLFFRxzxSDKuCKfuX+8PzoAWiiigAopGZVGWIA9TSgg9CDQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQB578Y7O7vF04w7kiiExds+uyvQh0ri/i7cCDw2553eW7DHtiu0HQY6VT2QFO0ts3c15MMuzbY8j7qirlRrIvmNHuG7sM84qSkxsiubeG5hMU0YdD2NUtGjltZJrF5GkSPBjLdcHtVm9vYLVCWbe/8ADGvLMfTFVtFt7xWmvL5gJpyCIx0jUdBT1sBpUUVGVdWyrZXup6/hUiJKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAa77TjBZvQUzdM3/LML7ls1LRTuAxRIDywYevQ04HnHelpsillO04PY0AOopsTM0aswwxHI9DTqQBSBVDFgoBPU+tLRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFBoooAQIoOQqg/SloooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKAfYiiigAooooAKKKKACiiigArkfEsbf8JbaeXM0ZnSNH4zxuYf1rrq5LXQzeNrMdgsJH/fbU1uB1oGAB6U0oS27zHHsMU6ikAgAFLRRQAjKGGDn8DioTaQE5Kt/32f8anooAriyth0Rv++2/wAaQ2FqesbH/gbf41ZooC5WWwtV6Rf+PH/GmnTrM9Yj/wB9t/jVuigCsLC0HSH/AMeNSJbwqMLGBUtFADDGh6r+tNFvCOiY/E1LRQBAbO3PWP8AU05beFeiAfjUtFADDDGRgqcfU0ggiHRT/wB9GpKKAInt4XGGXI+poW3iUYCtj/eNS0UXAj8mP0P/AH0ad5a/7X/fRp1FABQQCMEZFFFAEclvFJ95c/iaabS3/wCef5E1NRQFyEW6L91mUegxR9nGQTJIfqamooHdkaQorbhuLepYmpKKKBDJI1kxuzkdCKeBgAUUUAFFFFABRRRQAUCiigAooooAKKKKAA5x8oBPuabGXOd6Bfoc5p1FABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUHOOODRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAcB8aVLaPHjP+ouM/8AfK13dqSbWInqUX+VcV8W/wDjwtlPQxz7vptWu0tObSE5z+7Xn8Kt/CgHPDG7h2jUsOhI5okiWRdpLgf7LEfypWdF+86j6mgSI33XU/Q1Fx6kNtY2tsxaGFVb16mrFFHf2oEFFFFABRSA5Pt60tABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAU2SRYxlyQPoTTqR13IV5GRjigCC2vrO5Ypb3UMjD+FXBP5VYrL03R47K7e584uzZ424rUoAKKKKACiiigBNw3be/wBKWiigAoNFHfpQAx9wZFQDrz9KfQaitFkSEec2XJJPtntQBLRRRQAUUm4biueR1paACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKZHIHZl2srDsafSBVDFscnqaAFopG3fw4z6mlH50AFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAVzGsRlvF9s2SSFh49AJDXT1yHiC6kh8a2CJtZX8pG9R85/oacRo6+iiikIKKKKACiiigAooozzigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKje4hRtruFP+1xUlBAIwQCPegAooooAKKKKACiimhsyFMjgZ96ACTdjKYJHYnrTIHmYnzYRGO2Hzmpe/X8KKACiiigAooooAKKKKACiiigAooooAKKKKACijAznAz60UAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQBxPxY506FNoO+KdfzVa6/TQF0+2VegiQD8hXPfEFUe0iD/8APOXH/jtb2kf8gq1x2hUdMdqt/CgLVFFFQAHOOOtMQyFvm2gd+DT6KACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKADvRRRQAUUUUANVo9xCkZzzj1p1MmmjhQvIwVfWhX3fdU49WGKAH0UUUAFFIxwpOCfaloAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAEO7PQY+tGfYilooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACo2jYtu86RfYYx/KpKKAEUgjgg+4rlfE0UcvifTAiDzVmhkZvUBzXV1zOqyeX4vg3ITvSFUOP8AbbP86qIHTUUUVIBRRRQAUUUUAFFFFADZFkYDy3CH3XOaVd2PmIJ9hilooAKQgHryPSlooAidbgklJY19AUz/AFp8RcxjzAA/fHT8KdRQAUUUUAFFFFACfNnoMfWloooAT5s9Bj60tFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAhXnO4j2paKKACiiigAooooAKKKKACig0UAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRQDkZooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA474l3KwJZK2fnEpz9Nv+NdJochk0i2kYAFowcCuR+K9xb28umGdsArPjj/AHK6/RF2aVbrnPydat/CgLlFFFQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFIzKqlmYKB3JoAWkdlRSzMFUdSTgUbl27tw2+ueKSSNJAA6hhnODQA2GeGYHypFfHXBqSgAAcDFFABRRRQAUUUUAFHeiigAIB6jNFFFADZG2LnBPsKXcBjJANDsFHUZqBSGfCjI9sUdAHyxK0gfaCw6bugqRdwHzMCfYYqjcx3rXKNEqbO+5ulW1WQj94/wCC8UwJKQMD0INDKrEZGcdKWkA2Tft+QKT/ALXSgB8fMw/AU6igAPAqGGcPM0fllcdM96moAAHAA+lABRRRQAU1nVerAU6igCMTRs4VTuJ9KkopPmz0H50ALRSJux8+M+1KKACiiigAooooATaud20Z9cUtFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFcn4iunXxfY2u1dpETbu4+c11lcVr2sw2fjq3t5bdy5ijVCozuyW4qo7jR2pweOtNMcZHKL+VRFrl1GyNI8jq5yR+A/wAag+wzTKReXkkik/cQbFx6HuakdvMjk1SxiYxW6yXMg/hhQvz9elEH9sTzCSTyLSHH3Mb3/E9K0Io44YxHGiog6ADAqO5hWddsv+rHJA/ioFcVLiA/KJ43I64IqQEMMg5FV47ePACxLEg4CqoBNSJbxqm0b9voXJ/rQGgyW3Mk277Q6/7K4qU7kXu31o+ZSAsY2/XpT6BBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRQKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA83+NQhafRklYDK3GMnHaOvQNNTy7KOP+7kfqa8z+PZAutAbgMPtOD/36r1C2yYef7zfzNU/hQElFNlkSKMySNtUdTVOLVtPlcJHcZY9BsYf0qQL1FFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRTVdWYqOwB/CgB1FFFABRRRQAUUUUAFFFFABRRRQAUhVWxuUH602V9pRcZ3nFPoGIVU9VB+opaKKBAabGwcdMHuD2px6GjvQAjZIIGR6GjBwMH8+aWigAz+dFAAHQUUAFNKtvBBwO+B1p1FABRRSEgAk0ANaNS4bvTgqr91QPoKEbcM4I+tLnnHegAooo70AFFFFABRRRQAUiMrDK0p6GgcDAoACBnOKMD0oooAKKQsN23vVZrhxctFxnHyjBJNAFqiiigAoopo8zfzgL9aAHUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABXBeK2H/CwtMDD+ODB/4Ga72uC8WW0s/wAQNPaEqGiWFzu/66HH61UQO9oqsbeWSffNMfLH3Y14B+vrUyIv3igB6/SpGPqC7n8kKqIXkc4RfWp+lVLmGcTxzw/vNhPyE46+lAE0kqworStySB7ZqWs+eO4vpoQ0fk28bCRg4+ZmHYegrQoEI7Ki7mYKPU0tNJViUOCccihV2k8k59aAHUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUEgdSBRRQAUUAAdABRQAUUjEhSQMn0qCa6jhTfOREvq5xQBYoqjDqUExDQyB0z1U5FXVdWztYHHWgdhaKRWVhlWBHsaU0CCiiigAooooAKKKKACiiigAooooAKKKKACiiig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FABRRRQAUUUUAFFFI7FRkLn8cUALRUQkc/dRT64anRyK4PYjqD2oAeQD1qjfadHcD5Tsz19KvUUBcxv+EdsWjKvvy3U55H0NO0rRF0678yKeR0x912rXooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigArlfiz/AMk+1P8A7Zf+jUrqq5X4tsy/D7U2UZI8nj/tslAG/o//ACDYfof5mrdZnhWZp9Btpm4Lbz/4+a06bAKKKKQBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUgZT0YH8aAFooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiigZyeaADn2ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAMnxR/x5QnGcTA4/wCAtWjZnNnCfWNf5VR8Sf8AHjHwT+9XgfQ1es/+POHIIPlrwfpVPYXUloooqRhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRQaACigUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAIzbVzjJ7D1qFoDMD9obepH+rHC/wD16nqJmZrgRrwANxPr7UDQ2OztIxiO1hT/AHUAqK8s2eMtbyvFKOV54zVtWDKGU5BpaBHL6Z4kZNWXSNQH77oWA+4ewY9K6iuP+JNqsVvaavDGftUUyxFlHVGzwfb/ABro9Dne40i2mkGHMYDfUcf0oGXaKKKBBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRSc56jH0paACiiigArl/iqpfwFqSgZJ8r/0aldRXOfExS3gjUVXg4j/APRi0ATeAW3+ErJuufM/9GNW7WH4CiMHhOyiLBivmDI/66NW5Te4BRRQc44xn3pAFFIpz1BBpaACiiigAoopCT0Xr/KgBaKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKaA27Jbj0xTqKACiiigAooooAKKKKACiiigAooooAKTJz900tFACE8dDTVdmODE6+5x/jT6KAAn2JooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAMrxJceRDbLzl5sAj/dNaNs263ib1QH9KoeIQohtpGQNsmzz2+Vq0LY5t4yOhQfyqnsgH0UUVIBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRSY5zzQAtFFIzBRliAKAFopEYMoZc4PTiloAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiori4htwGmkCD3oAloqOCeGYExSB8dcVIfagAopHZUXcxwKZFL5mf3ci/7y4oAkooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoIz6/nRRQAUUUDp60AFFFFABRRRQBHJJ5cq7zhX+UE/3qSRHEqypzxtZc9vUe9OuIo54WikGVYc1zmo6zfaNdm3NrLqcORtKcSIPcY+aiw0dKihVCqMD0pa5hvG2mINstlqscuQPLa0bOfr0/WprHW9T1S4VLLR57e23Ye4uSF4/wBle9OwF3Vo49QuodPaPeiOs0p7ADoPxq7Ik0cIS0WLjoHyB+lSxxrGDt6k5J7k04kDqQKQDIjIYx5qqrdwpyKfRRQIKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigArA+IamTwffIudxCYx/vqa36wPiHdG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FqPJc8ZA/OpKKAIZ+Bndg+mSKIVYYbb+ZqagkAZJAHvQBE0p80RqhbPUjoKGaRWwseR64oNxbgkedHkdfmFPWRGxtYH6GgBq+YxBYBR6dacVwPlxn3p1FAECmbduaPOfRulTjpRRQBE/nAHbhj71Vaa/3ALEMeu2r5I9aKAAZwM4z3xRRRQAUUUUAFFFFAASB1ooNFABRRRQAUUhYDGe9LQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAGL4s4gtGK5Hn/+ymtWy/484f8Armv8qxPGsjLa26qrH97u4/3TWxphJ021J6+SmfyFN7ICxRRRSAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACkwc/eP04paKACkcErhW2n1xS0UAIgYD5m3e+KWiigAooooAKKKKACiiigAooPApEZXGVORQAtFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABQRkYPIoooAKCM+v50UnzZ6jH0oAWiiigAooooAKKKKACk2jfu5zjFLSFgCAep6UALRTDIo6h/++DTkZWGVOaAFooooAKKKKAAADoAKKKKAELYPQ49aGzglcZ7Z6UfNnoMfWloAr+fMCA9s4PqpDCpGEu4FSuD1DdqkooAKY7PvCoB7k9qeTgEnoKp6xM1vps88bhGC/exnHOKBotgYHUmlqrp1lDZxAIWdzy0jHJY1aoBkYmXzvJb5XxlQf4h7VJVXU1UW4mwN8TBkJ9cirEbiRQy9KBDqKKKACgdPSiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKa8iqwUnLHoB1NADqjMKtMJGZmx90E8CnDfu5ChfrzTqACiiigAooooARmCqWPQDJqra6hBdSmOEOcdSVwKde2xuh5bHEePm56/hTrS0gtVxCmCerHkn6mgBbqKaVcRXBh9woJ/WpI12RhdzNgdWOSadRQAUUUUAFFFFABWH48cR+E71mIAATk/761uVynxbDn4fans3bsw9Ov8ArUprcDb026ke3BmYMQTlh9alluN0fyrIp9+P60aRL9osUuNoXzCzYA/2jVsk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V29zTVVfyoXJ5nCXMvj5m3Q2l2p9N1tj/wBCp9ne+OkbbdadcNj+IGDn8q7mil7X+6g5H3Oaj1jX4jtfw7e3H+1viX/2akuNY8SvlYfCt3H/ALRuoD/7NXTUUe0V78qDlfc4OSf4gb90On3IHcPJbAfzNU7ub4kyPtOnymP0EsA/lXpFFV7b+6gULdTktP1DxdHCPtOgzzsPSeFf5tVtNa17OH8KXn4XEP8A8VXRUUnVT+yg5H3OdfWPEDD5PCt2vubqH/GmDV/EQPzeG7z6ebD/APFV0tFCqxX2V+Icr7nKSar4pJzH4dvB7GWD/wCKqObUPGDKPL0O6Q9z5luf/Zq6+il7VfyoXI+5wE138Q3/ANVpko9jLbimif4k7DusXU+oktzXoNFP2391FcvmebW0nxNidzJayuCe725qDXLrxt5Ubajot9NBu6QeXIc467E+nevUKKft1/KhcnmHPtRSAgjgg/SlrAsKKKKACiiigAozz3/KiigAooooAKKKKACiiigAyKKKKACgUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRzTcSZ+8v/fP/ANegB1FA6UUAFBzRSM23sT9BQAtFAooAQqp6qD+FLiiigAooooAKKKKACiiigAooooAKKKKACiiigAoooJwOeKACimh1JwDn8KUt7E/hSuh2FooH0xRz7UxBRSHdjqB+FIqtj5pGb9KBjqKQKPf8zS0CCiiigAooooAKKKKACiiigAooopAeV/HF4/7S0Vmkw0cdwVXPf5OcV6pXkPx/U3Gq6BHDgmJLkyEds+Xgfofzr16rfwoAoooqQCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiikRdv8TH60ALRRRQAUUjsEXc2cewJqOKbzGK+TKoHdlwKAJaKKKACiiigAooooAKKKKACiiigApjuyttWJm9+AKfRQAwmXbkIufQt/wDWpQz4+dMf7pzTqKAAdKKKKACiiigBrSIv3nVfqcUGWP8A56J+dOooAAQehBooooAKKKKACiiigAprttx8rHPoKdRQAUUUUAIoI6sT9aWiigAooooAKKBnuR+VFAAAB0GKKKKACigAelFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRUbxkyq4ZuOo3ED8qkoAKKKKACiiigAoNFFACD1wAaWgUUAIFUHIUA9zXMa7b/8VZY3DfdJjAx67q6iua1yYL4rsYnzjEZX6lyP6VUNxM6WiiipGFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABkZxkZooooAMUHpQQCMEAj3pNq/wB0flQBWNmhl8z5PpsFWQqjoB+VN8sYwGcfjQsZUY81/wAcH+lBTY5lDdc/gSKaI1Hd/wDvs07Df3vzFKM45waBBRRRQIPxoNFFACDd3I/KjHuaWigAooooAKKKKACigZ74P4UUABGfX86YYl9X/wC+z/jT6Qbu4H50ACrt7k/U5paKKACikZlX7zAfU0BgRkEEUAN8qLO7y0z67RSmNSQcEEehIp1FADQgB6t+LE0pGf4iKWigCMpJniYj/gIpix3Ik3G5BX+75f8A9ep6KB3Co5JCrAeVI3uoFSUUCAcjoR9aDwPWiigBgkO7DRuo9TjH86f2opuxN27aM+uKBihlJwGGfrS0VDNHNu3wS7W/utypoBE1FRwtKw/exBD7Nmnge5NANC0UUUCCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAA8igADoBRRQAUUUUAFFFFABRRRQAUUUUAFFFRXNxDbpvmfaD04yTQCVyWiqqy3M8e+GNYgRx5oOT+ApDaSS83Nw7cYKJ8q0rlcvdk0l1bx53TICOozz+VRC9DFvLtrhwOjbNoP51PBDFCmyKNUX2FPo1C6KgnvGB/0ZI/d5M/yqRRcvjMiJ6gJn+dTbVznAJpaLDcl0QwxllwZH+o4pBDGDn5j9WJqSijlRPMzzb4yxs15o8SRr+984BgORjYTXpNeYfHW4a1m0OZDhl8/H/kOvSQ9wEBaFS2OQr/AONW/hRK3ZNRVa7vEtkDPDM2egVMmltLpriMv9luIsfwyqFP86kqzLFFMaTaCTHJ+AzS7xjOG/75NAh1FQy3GxNwhmf2VOf1qOG6mJxPZyRehyGH6UDsWqKiS4iZtqlif901KPoRQIKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACikY7Rk5/AZqOGcSMVEcq47shAoAlooBooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoooIyMc/nQAUUigKABwBS0AFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFcpr8Sv40sHL7WWOLA9f3hrq65TxAv8AxWWnkHJxFx7BzmqjuB1dFFFSAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAU1i+flVSPdsf0p1FACAtj5lGfY5qOSZkGfs8rf7uD/WpaKAKQ1O33bXS5j93gcD88VZiuIZANkqnPQZ5qQACmsiMcsit9RTGOopAqr91QPoKQ+ZjjaT+VIQ6io4zPn94kYH+y5P9KkoAKKaHUnGefQjFOoAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoooNABRUbzwIMvNGo92AqGTUbFOtzGf8AdO7+VAFqiqB1iwA4kkY9gInyf0qVL0SJujt7k8ZGY8Z/OgdmWqKp/wDEwmPSO2T/AL6f/ChrOZwmb6dSOu3AzQO3mXCcUVXgs4om3lnlf+9I241YoE7BRRRQIKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAqJWR7h1ON0eMfj3qWoim2czLzkAMKBolooBBAI5BooEFFFFABRRRQAUUUUAeWfHuJppdBjXGSbjr/wBs69Tryz4+vJF/YskQJcfaMf8AkOvU6p7IAoopDu7Y/GpAWimEzdlQ/wDAiP6UoMndVH0b/wCtQA6iiigAooOccEA+4pOfagCOW3ilB3Lg+qnB/MVF9hj80Sedc5HbzmIqdzMPuIjfVyP6Uqs/G6PH0OaLjuKBgYyaBuxzg/pS0UCEJP8AdJpC+Dgqw/DP8qdRQAjMqjLMB9TQrqw+Vlb6HNLSbR6UALRSAY7k/WhhkY3Ee4oAWimGNv8Ans4/Af4U8DA6k+5oAKKKKACiimpIG/hdT7rigB1FFFABRRRQAUUUUAIyq33lB+opaKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigArB1bb/AMJLZnaCxCD6Dc1b1crrTsvjSzXdkMsR2+nzmqjuB1VFFFSAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFRvPCn35o1+rAUxby1b7syt9OaB2ZPRUIuFb7scrfRf8ac0pVc+TIfYAf40ByskoqmlzeNIQdOkVP7xlX+Wasead20xSD3xkfpQFmSUUi56k5/DFLQIKKQkg/dJ+mKWgAooooAKKKTeu7buXPpmgBaKKKACiiigAooooAKKKKACiiigAooooAKKKKACkLY/hNLRQACiims6qcHOfYE0AOoqI3EY/hl/CJv8KFmZv8Al3lH1wP60DsS0VEHnY/6gKP9p/8ADNRKuomQlpLVU7AIxP55/pQItUUAfifWigAooooAKKKKACiiigAopGBI4Yr9MVXubNbjiSafb3VX2g/lQBLNcW8I/fTxR/77gfzqOK9tZjiKYSH/AGQTSQ6fZRKFS1i46Erk/manRET7iKv0GKAEkcrwqFmPQdB+dRobtj86woPYlj/Sp6KAIpIncDMzp/uYGf505YUHUFv94k/zp9FA7jDFGTkxoT67afRRQIKKa5RFy7bR6lsVTl1azRtitJM/92KMsaAL1FVLe+E0gT7Ldx57vCQPzq3QAUUU2VWZcLIU9wKAHUVVez3Da11ckf7+P6U02trbwgmQxBf4y/8AjxQMuUVDbtbMf3UqSH/f3GpqBCBgehoJI/hJ/KlooAB06YpDuzwBj60tFABRSFgv3iB9aQOh/jX86AFIOfvEe1AB/vE0tFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABQAAOBiiigAooooAPxNFFFABRRRQAUUUUAA5ooqN4ImfeyDd60ASUU3y1xj5v++jTqACig0gLfxLj6HNAC0UUUAFFFFABRRRQAUUAg5wQcdaKACiiigDIn/tawk/0WBL62yTsL7XQegPf9TVmx1JLg7JoJbSX+5MME1epksUcq7ZEV19CM0F8ye6H0VTjsnhf/R7uVE/55t86j6Z5qK7uruwHnXCpPbA/O6LhkHqR3FAuXszRopsMkc0SyxOrowyrA5BFOoJCiiigDzL477RFpTk4KrPj8469Nry79oPcNL09kzvAl2n8Y69RqnsgCiiipAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACud1mHf4ptH4wEjzn2kJroqy5LeObxGzyZOy1Qgf8CcU4uzA1KKaVbcCHOPTFOpAFFFFABRSFlB5YD6mlBB6c0AFFFFABRRRQAUUUUANcsB8q7j9cUyWLzk2yMyjuFanum4Y3Ov0NHzKP7/6UFJ9hkdtDGu1FIH+8ajksLWRw7xlmHfef8and9q52sfpUaXVu3/LVQfRuDT1D3hFhgj+VLZceoUVPSJjGQ24fXNLSJ1Cio5Li3j/1k8Sf7zgVSm1zSouDeI59IwW/lTsNRb6GjRWbHrEMiborS+kHqIDTv7QuXbbDpd0feQqg/nRYfKzQJwMngVQbVrLzGjjaSZ16iKNmx+QqRI7qcf6VsjT/AJ5oc5+p/wAKtIqqoVVCj0FGgtEU11DceLK9/GLH86d9ovG+5YFfeSRQP0zVuikFyCH7Zn980AHoin+pqeiigQjKrDDKGHuKaIYQciJAfXaKfSKqr91QPwoAWiiigAooooAKKKKACiimvIifeYCgB1FIDkZGfxGKR/Mx8m3PvQA6ioyJyeGjUf7pP9aiaG6Y8XgUe0Q/rQBZoqFYW53X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f+WIb/df/GnZkzygx7NS5OPun9KAGGSQdYGP+6QaVH3fwOv1FPqOWQoRwx+iE/ypN2Ae7BRkhj9BmmJOjdFlH1jYf0prXCrjKv8A9+zT0lVjgZ/FSKFJMdhd657/AJGgSR4++v506oXuYlON6k+gYU7isShlPQg0tReZEwDFR+IzT0ZGyVx6UwaHUU1kz0dl+lJEsirh5N59duKBD6KZIZQPkVW9icVH58itte1k+qkEfzouOxMyqwwygj3FN8mPsoX/AHeP5U5WyM4YexFLnjNLQNSPy2BJWRx7HkUpE3Zo/wDvk/40vmR5xvXP1pwII4IP0o0ABnHP6U0uoOCwB96dRTEFFIFUdFA+lLQAUUUUAFNeON/vorfUZp1BoArfYYVJMTSxE9djkD8ulPEUykbbgkejqD/LFSqyt91gfoaWlZDuyPM6/wACP9DikMsgPNvIR7EH+tS0UwuNWRWA4ZfqMUqsrfdYH6GlooEAopCo+n04qIwfPu86Ye2/igCaigfXNNk8zH7sqP8AeFAHk/7SMKy6TprP0XzufQkx161Xj37SFzKul6fatAC0glIcdDzH0r2Gm9kAUUUUgCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigArD8QFm1PT0XqJ42b6bjW5XP67MsXiCyDKzbtgUD13mqhuB0FFFFSAUUUUAFFFFABRRjmigAooooAKKKKAEJx6/lS0UUAFFFFAAc9gPzph83sE/M0+igBBu7kflS0UUAFFIzKoyzBR7nFQm8tR/wAt0P8AunP8qB2J6QqpPKg/hUK3kDH5Wc/SNv8ACn+cn92T/v23+FAWZJRUcUvmdIpFH+0MVJQIKKKQbu5B+goAWik59R+VBHuRQAtFHbrRQAUUgUD1/OloAKKKKAGhmJ+4QPUkUvPfApaKAGlR6t+Z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';});


define('base64!objects/Floor/textures/hardwood2_roughness.jpg',[],function () { return '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FABTgpxnjH1ptWrS5hiQpPZx3CnoSxVgfqKAKtFK2MnAwOwpKACiiigAooooAUfTNFJRQAUUUUAFFFFABRRRQAUUUUAFFFO2tt3bTt6ZxxQA2iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigApe3UfSkooAKUDJxx+JxSUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUtJRQAUUUUAFFFFADvk2nlt3YY4pAcf/AKqSigBxIx7/AEpBjPOQPYUlFAEzLbbMrLKW9DEAPz3VH8vqfyptFABRRRQAUUUUAFFFFAHq/wCznHcTanrUdvKEIs1Z13YJHmJ/U1594yUr4v1lT1F/OP8AyI1egfs3bv7d1zavJ00At/dHnRn+lefeLju8Waw2c5vpzn/to1JbgZVFFFMAooooAKKKKACiiigAooooAKKKKACiiigApaSigCSaGWHHmIVB5B7H8ajoooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACipnt5Ej8xjHt9pFJ/IHNOtFszu+1STp/d8tA355IoFcr0VJOIQ/7iSR19XQKf0JqOgYUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUVZs9Pv704s7K5uT6RRM/8AIUAVqKvyaNq8RxLpd7Gf9uBl/mKpSI0bFXGGHUdxRcV0Nopy7ejZ+o/wqz5FkVDLfEHuHhIP6ZoC5UorVs7jQ4PluNPubz/bM/l/kAD/ADqvd/2YzbrU3cYPVZFVsfiCM/lQwuUqKm223/PaX/v0P/iqU/ZVC485z/EOFH4daAuQUVOzWhYbYJlHf96D/wCy1sFfB72h2NrMVzj/AJaNGUPtwuaaVxN2MCu4+BFw1r8VtGnThl8/H4wSCuUgm06NmL2Us4xwHmxj8hXf/s9zW0/xg0W3Gn24jf7R94byMW8h6n6UrXKuVf2jVVPjLrqqMAfZsD/t2irgYJZIZBJE21h3rv8A9o//AJLPr3/bv/6TRV55QA52Z2LMck9TTaKKACiiigAooooAKKKKACiiigAoqV0jVARMrH0VT/Wo+PegBKKWlbGeBjigBKSiigAop8UUspIijd8ddqk4pGVlOGG0+hoAbRS0lABRRRQAp4PXNOQx7TvVyexDY/pTWUqcMCD6GigBKfEU53qDxxnPFMpQCTgDJoAKKDwcHg0AFiAoJJ7CgAycYpKfJG8Z+dSKb2oASiiloASiiigBRjvmkoooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKfFG0sgjQAsemSB/OpjY3AOCsef+uq/wCNAFair6aVfkbhCn4yJ/jVaeORX2yeWCOwK/0p2Fchop/ltkD5f++hTpYJIwC23B6YcH+RpDIqU8ULnIx1q1HZ3k6b1QMD3LKCfzNAFSlHWrg0u9K7hGhH/XVf8aj+xXHmmLaocHBUyKD/ADoC5G0EigEhcH0YGmMpUDOOfQg1Zmju4YNsmwIO2VJ/xqpTdhBRRRSGS2tvNdTrDAm+RugyB/Opb2wu7PH2mHZnp8wP8jTLOee3mWS3YLIOh2g/zqa/ur+6UNdOXUdPlAH6UxHpn7PEfPiWTzAC9lHEqAZJJlU5/IGvN/E6lPEuqIwwVvJgf++zXqf7MsFvLd67LMAHit08pu+Sw46dOK808cc+NdcP/URuP/RjVNxmNRRRTAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKUEjpSUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFLSUUAKOtB68dKSigAooooAKXtikooAKKKKACiiigAooooAKKKKACiilFACUVYjjtfJZpblhJ/CiR7vzORUBxnigVxKKU+1CnBzgH2NAxKKcWy27AHsBxVhb6ZYxGEtsD1toyfz25oAq0VNJcySKVZYQD/dhRf5CoaAFUFjhQSfQVYWzYxlmmgQj+BpAG/KofMfy/L3HZnOKZQLUcVw23cvXqORUpS2VR++kZu+1OB+ZqCigY47e24/pSZ/2RSUUAPMjZ4O3jHy8fyqxZajfWeTa3dxAx6NHIVI/KqlPi8vd+8Lgf7IoET3GoahcKVuL66mU9Q8rMD+ZqrVxZdNTP+iXEpxwWnAGfoF/rVVyhb5VKj0JzTBDaKlEiAEeRGfclv8ajPXpj2pDEooooAKKnja1CDzIZmfuRKAPy2/1qwlzpoA3aY7H1Nyf8KBFCirc9xZsuIdPWMnu0rNj6dKqn6YoGJXoH7O8gh+MOhyFSwUXJwP8Ar3lrz+vRP2b/APks+g/9vH/pNLQAftIf8ln17/t3/wDSaKvO67/9oYzH4wa59ox5n+j5x/17x1wJOcdPwFACVYtbX7QxX7RbxY/56SYBqvRQBNcQCF9pnikP/TM7h+fSo12Z+ZmA9hn+tNooAfIIhjy3dv8AeUD+pplFLQAlLT/Jm2lvJkwOp2mkRQx+aRUHqc/0oFcZRTmVVbAcMPUA/wBabQMKciPI21FZm9AMmjPTAFSi7uVjWNZ5FVegVsAUAMaGZV3NGyj1IxTCMdwaGZmJZiST1Jqeys7m8k8u2hMh78gAfUngUCK9KTx0Aq/d6ZcWH/HzNDG3dElDN+QqgevHSgE7iiRwNodgPTNIQecg+9PjlaPlAoPrtB/nSPJI7EsxJPWgYynIVB+YE+1IQVOGBB96BjB4Oe3NAAaSiloAKKtG3to4Q0t4PNPPlxpux9TnGaW1Fux8pYDNK2Npd9oB+g/xoFcp0VauLNoWPmSxIM4HOc/lmq8i7WwGDe4z/WgY2nIzKwZTgg5BptFAEks0shy7k49OKRZZFGFkcD2amjml2+4/OgBCSTySfrSUo5OKmjt2kB2MpIGSOf8ACgBRayeT5mD0zgioCCKc8boMsMUygAooooAKKKKACiiigAooooAKKKKACinFSADx+YptABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUtJQApxgY/GkoooAKKKKACiiigApaSigAooooAKWkooAKKKKACiiigB0btG4ZDgj2qT7RNnO4f8AfIqGigC3/aN5t2ibA/3F/wAKqsxZizHJPU0lFAD1kZem38VBolleVt0hyfpimUUALVhL26SMRrJhR0G0VWooAtrqF2owsigf7i/4VA0sjS+YWy+c596jooAklmll/wBY278KjpykDOVB+uabQAp+tJRRQAo4NPeaV02M5K+lR0UAesfs/XdvDH4hhkIFw1tG0PXPEgz+lec+KWMnifVXJyWvZiT/AMDNd58A7eOW68QzPndFp67ecdZkB/SuB8R/8jDqWOn2uX/0M0luBn0UUUwCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAK9E/Zv/wCSz6D/ANvH/pNLXndeifs3/wDJZ9B/7eP/AEmloAT9owiT4z68U+YH7PjH/XvFXn7Ruv3lK+x4re+Iy3SeM79LxmadfLDEtk8Rrjn6YrnqEAUUUUAFLSUUAFFFFABRSinHyxghmY9wVx/WgBtaGlaVd337yM28Ua8l55VRePrVIlmQkbVXPQH/ACamguY1QrcQfaMfd3SEAflQBpNpdvMRu1C1DjgiBSy/h61Fe6XDZxeZLJO4b7v7vy8/nVRtQuN+6ER24xjbEuAPz5qC4uLi4Ia4nlmI4Bdy2PzpIDRs7uxgRnWzgLlcL52ZMfh0qvNqM8kXlNISncKAoP4Yqlg8ds+tSRNHG25kEjDoD938fWgQksskn3yD+FPjg3Q+a08KDOMFvmP4DmkuLh5yNyxqF6BECgUW8qRElreOY9t5OB+AIpgSmS0hULFCJ3B5kkyB+Cj+tRNczEBQ5RR0CDaP0pk0nmSFtiJ7IMAU0Ak8DNILAzFm3MST3JNS/Zyse6SSOM4yFJ+Y/gKhopjCil5waWNtjhsA47HpQAho49zWoLWK50m41W6u4oWVxDBbovLtjJ47KB39TWVQBKkkwjO1mKDGR1FT2upXVu4ZHAA44UAkemcVWSSRAwViAwwRnqKsaWszXiGGOGRgekqhl/EHrSFYu3GtedEUa13bh8xZ85/SshiCxIXA9K6+XRdaa2NxcHRreMcnNrGpH/fMdZ4igMTD7RpLyD2CD9QDRt0JTXQwOMd80H6YqzNM8czJ5NsCDj5UVh+B5qGKPzX27lU+rcCmUMDMv3WI+hqQXE4GBNIB6BjTNoyRuXr1pWQjoQw9jT1DQRpHYYZ2b6mm05kdcblYZ6ZFNpDFpKKKACiiigAooooAKKKKACiiigBSc+n4ChSVOQcGkooAsve3DQeQ0hKehwagUgMCy7h3HrTaKALLyWbIALaVH9RLkfkR/WprS202bAk1Jrck4+eAkD3yDVCincVjdTwvfXEbPp1zY6ht5KQTjeB6lTg1j3NvcWz7LiGSJvR1IqKrIvbry/KeVpYsY2SHcB9M9Pwo0F7yK1FWYIoLhtvnpbsenmZ2/mOn41JeaXfWsYlkhLRHpLGQ6EfUUrD5kUqKKKBhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFKetACUUUUAFFFLQAlFFFABRRRQAUUUUAKFYjIBx9KKSigB8UUsp2xRu59FUmnSQTw8yQyJ/vIR/OnW9zJCjKiqdx5JHNRvJI/35Gb6nNADaSiigApyqzHCqWPsM02poLhoc7UQn1OaAGNHIv3o3X6rQY5AOY2H4U6Z5Jm8xsE47GiSdpIljKr8vcZyaBDPLfGdjY+lIKVTtOdoP1oVtrZ2qfY5oGDKy/eVh9RSHjrViSeSeNIEhUAdkBJP55qBlZW2spU+hGKYhtFSpPOgwk0ij0DEUyR2dtzEk+ppDG0U9XIXblsem7imjHofzoASilp0MnlyB9obHYgEfrQAylNaF1dWckQ2QYk7kRKo/Ss802JM9O/Z/thcX3iBg53R6ep2AfeBmQH8q4LxQuzxNqif3byYf+PmvS/2d5ngi8RSK/wC6S1RplGMkbxj8M15p4ok87xNqk2Mb7yZsfVyajqNMzaKKKoAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACvRP2b/APks+g/9vH/pNLXndeifs3/8ln0H/t4/9JpaAKfx2t1tfitrUC9FMB/OCM/1rh66/wCMF1eXnxA1GbUIUiuiIfMAUg58lOv4YrkKUdkAU4bNh+Vi/Y54FNopgFLSUUAFFFFACmkoooAKKKKAClBwc0lFACkljliSfU0lFFAC0lFFAD487htAJHqMj/CrbGBlzdXbMc/6uCMYH8h+VUqB16ZpWFYlEbS7vs8Lsq8k4yQPemLsxliSc9B3/GrVvdhk8i6lnFuB9yHAyfft/Oq0rRlv3KMi47tkn9BQASSBhtVFRfQf41HSgHaW7CldWRirDBHUUxiZOMdqSinMVONqkeuTmgCxaWlxJ+8URqg6tIwA/WrUUl7YQySWtxbLkjcIyrMPfPPH41Qg2eYu6My/7AyM1aub5fJMEGn29qD95huL/TJPSkSy1H4m1xBj7cWXuGRSD+lZt5cm6mMrQxRsevlrtB/Co445JGCxxs5JwAozzVtbfULFBdNE0AOQDIACfwNO6GkhkdniOOS5mW3ST7pYE5Hrgc1Jew6XGv8Aot/cztgdbYIue/O/P6VTmlkmkMkrs7nqSacsLNavPuACsFx3OaQyOkoopgSGaYrtMshXpgscVHViytjdS7fNjhQAlpJCQq8d8A067jS2kKwyJPGw4fb1/wAKLiKtFPikeJw8bFWBq1eX1zfIoljt/k7x26Ix+pUAmgLlOpIVySDJGhH98f8A1jTAOfvAU6eV5n3yNuOAM+woAklICEebA/8AuR4P54FV6KkWPcufMQHHQnFAJWI6KUdaCCOoIoGJRRRQAUqgswUDJJwKSpbeXyXLhQzY+Un+E+tAF99IWMfvNV05HxnYXfP0+7VN7dVz/pMBx6E/4VBSUAKaSrVrcwxwvHNZRTbujEsGU+xBq7ZaXaal8lherFcY+WC5O0ufRWHBP1xQBkUVYv7O6sLp7W8geGZDyrD9R6j3FV6ACpI5pY8+XI6Z67WIqOigCZGjkY+flSejqOh9x3qNgAThgw9RTaKdxWCiiikMKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKWkooAKKKkiEJz5sjr6bUDf1FADB9M0GlbbuO0kjsSMU2gApRyaSigAooooAKKKKACiiigAoopR1oASilPXikoAKKKKACiiloASiiigAooooAKKKKACilP0pKACiiigBQcHjig89aD7UlABRRRQAUUUUAFFFFACk8dvyoBwegP1pKKAPSvhBeXyaT4ht7K3VYpLZftEijJA3rjPoMnrXn+rgjVbwN1E75/76NeifAVSzeJ/3iqh01AVJ+8fPjI/QH864DxCNuv6ivpdSj/x80dQSsUKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAFxSUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABXon7N/8AyWfQf+3j/wBJpa87r0T9m/8A5LPoP/bx/wCk0tAEP7QUP2f4va3DnO37Pn/wHjNcDXqv7S+havb/ABQ1PV5dPmWwvEheC4xlHCQojcjoQyng4PQ9CK8vjeNFP7ve/q3QfhSVraAyKpIxCVPmSSK3YKgI/mKa7s5+ZifT2pDtxwST9KYgOO2afDDJM2I1z6k8AfU0ygsT1JNAEk8XlOFMkbnvsbIH401hHt+VmLehXA/nTRyant7K8uG2wWs8reiRk0r2HYr0VPdW01rL5VwhSTumeR9asQXXkW37nT4C38Usi7z+GeB+VNa7CbsU0ildSyRuyjqQuQKZVqfUL2aHyZbqVos52bvlJ9cVVoGKOtOkdnOW2/goH8qZU1va3VwCbe2mmA67ELY/KgCGitNdIkiXzL+4hs09Gbc5/wCAjn88VDDErziGwhlu5TkDdHn8Qoz+tJST2CxWiheTkYCjqzHAFLcRCF9omjl9ShJAq9qdhJZxL9sllSb/AJ5NERtPpz0qhFLJESY22k9wOadmJMZSVI0UwiEzRyCNzw5U4J+tMXbzuz04x60DFKMEDHgHpSAE9Bmkqe2S5BFxbpJ+7Od6qcL+NICMjaq4IbcMkehyf8/jU1nC8sjKtu8zgZwDgAD19vyqBmYsWJ5J5NWoLsi0a1kkdYPveXHgb29WNMCq7F3LHGT6DAp4hZnSOMNJK+MIoycnoPc0W0Ms0gEQ5HO7OAo9Se1bNvq0WiI8WjMGunG2S9ZeVGORGOw9+v6UXAgGn3OmjOozPZA4Pkg/vG/Dt361oaVNbNldG8OrdSqp3zXr7wPfHCj86g0WxgvLtrzWJz9myWlnllwzn27k/WtIlX0+WDSz+6z92Jc7vfcelSDiytqereIp7J4Dqtu0CDJitFC7cdvlUfzrmZTI0hMhYv3LdatwzT2M4YxhcEghuQTUuqalHeQKq26xuD8zBRzT0C1jN7ZqZJALKWLjLSIw/AN/jT4dPvJrdriOEmJerEgfz61VpgFSW6xtKvnMwj/i29cegqOloA3bm8s009omhAJXEUS8f8CY/wCSf1rCJJxkk46UHk5PJpKACinLt3DdnHfFWY4bOQcXEsbf3Wi3fyNArlSitC6ttKjt1aDVJZpcDchtSoB787uaWy01LxlS31C1Eh6LMSnPpzxSuh3M6lrXv/DerWbEGFJwF3FoHDgflWW8M0bbZInQ+jKRQmnsAylKlQN3GeQPapFjVkwm+SXrtVeAKLqZ55jI6gHAGAOgAxTAiBxngGlLfLtwAPpzTaKACirmn2El5cm1XctwVzGhQ/OeuPbiobu2ubOcwXUEsEo6pIpU/kaAuRVfm1WZrEWUMMFvCDk+WvzN9SetRWlrI7xvJHKtu7BGlEZIGasa/oeoaLOqXlvIsUo3QTFSElX1U/iKV1cLmZRS0lMCWaeeYKJppJAgwu5icD0FRUpBABIIz0ooASiiigAooooAKKKKACiiigAooooAKKKKACiiigAopQD6GiiwCUUUUAFFFFABRRRQAUUUUAFFFFABRTkVnYKilmPQAZJodHjYq6srDqCMEUANoqzDJbRxjNsZpSCPnY7Qe2AOTTLqSSSXdJEkRI4VUCjH0oFchqS3EJk/0hpFT/YUE/rUdKAScAZNAx03l+a3k7xHn5d3XHvTKdJG8b7ZEZG9GGDT7fyPM/0jzNn/AEzAz+tAEVFWA0AkH7hjGOuWJJ/lSXckMj5hjKj6AfyptWFcgooopDCilGSeOaSgAooooAKKKUgg8jFACU+KN5W2xqWb0FMooAkkhljOJI2X6io6KKACiiigAooooAKKKKACilpKACiiigAooooAKKKKAHBmx94/nTaKKACiiigD034ERwsPEryBt8dgjKQeOZkH9a4DxAd2vag3rdS/+hGvTPgdpWqroHiPVTZ+Vps1vHCbuZSqkiTcdp74K84zjiuF8Q6FqC6vcSQRfaIpZDIrxkEfMScZqeZXGk7HP0VZlsbyJ9klu6t6VG0EqkhkK/WnzLuFmRUVJ5L4z8v500bQfmyw9jii6FYbRStjJ2jA7CkpgFFFFABRRS4OM4OPWgBKKKUAnoCaAEooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAopQCxwoJPtTmjkVdzRuq+pHFADKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoopcGgBKKKUKxHAJ/CgBKKUgjqCKSgAooooAKKKKACiiigAr0T9m//ks+g/8Abx/6TS153XqX7Mej6pefFPTtVtrGaSwsFma5uNuI490LooJPBJLDgc4ycYBIAOh8S/GPwncJDZ6f4b1m6tEiAZri+SBi2TkbQsgxjHOR1PAxzyx8eeCd2/8A4V5O75zufWief+/Vea0UuVBr3PXdP+L2j6dj7B4H8ke+p5/9pVsH9oaTYFTwmEx0I1D/AO114VRS5UNNrqe7n9oiWSPZceFBKP8AsIBf5RUW37Qq27Aw+EZFHcf2mP8A4zXhFFL2cewXZ9C/8NLZG0+DSB3I1Pn/ANFVj6v8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gBSSxySSaSnxRySuEijZ2PRVGTSzQTQkCaGSMnoHUj+dAEdFFFABRRRQAUUUUAFFFFABSg4Of6UlFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFOZWUAnofegBtFWLSzurogQQswzjd0H5nirV7ompWsYle33xn+OJg4/SgV0ZtFSPBPGu54ZFHqVIp8drcSY2wvhjgEjA/M8UDuQUVYSzuHmEKqpkY4Ch1yT6dau3vh3XLKFZbvTLiFG6FlxmnZi5l3MqvVvAFxp3/AAp7WrK+MMTSXM/lSueQxhQcfpXm66Zc+WJJWhgU9PNlCk/h1ru/DPha9uvhTqusK0clrBJOxKsDtIjUn3HSs6i0RUWjzdhhiMg4PUd6SiirEPjjaT7pQf7zhf5mpBayYJMkA/7bL/jUFFAD9mG2s6j3zkfpRsX/AJ6p+R/wplFAFxLUPEGF7Zj2JIP8qiaCNTj7XAfoG/8AiagooEStGijIuIm9gG/qKioooGLRSUUAFFFFABSnHvSUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAvy46nP0pKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigBysVYMMZHqMipJ7mWcDzNnH92NV/kKhooAKUHHp+VJRQAUUUUAFLSUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAfQv7Hk7R23izczGNPsjhc8AkTZIHqcD8hXz1Xv/wCx6u+fxKhzg/ZCfw86vAKlbsAoooqgCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKWkooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoopaAEooooAKKKKACiiigAqaGYRg/uInJGMuCf61DRQA5XZX3KxVvVeKWSSSQ5kdnPqxzTKKLhYKKKKACiiigAoopTQAlFLSUAFFLj3FXVtLExBjqkYYjlPJfj9KVxXKNFWbiG2jj3RXglbP3RGw/U1XHWmMSipd0S/dUufVuB+Q/wAaJpjJj93EmOyIBQIbHHJI22NGdvRRk0821wpw0EoPuhpqTzIm1JGQf7PGajoDUe0bL97aP+BA004B65+lJRQM19KudBii/wCJjplxcP28u42fj/kVHeXmkspFno5iOest0z8fQAVnKrMcKpY+gFSG2uFXc0Mij3XFFibK+5EevTHtTopZIXDxSMjDupwaQKTnoPqcUMpXGdv4MD/Kgoknubidi000khPXc2c1GrMudrEZ64NNooCw9ZZFG1ZHUegYikd3c7nZmPqTmnRwzSAmOJ3A6lVJpy2s7HATH1IH86LC0Ian+13XkGD7TN5R6pvO38qV7OZELM0HHbz0J/LNQU9UGjEr1rwh4k/sL4F31jEsMj6hf3IkVhkgeTGAMfnXktd3pWiyz/CqXU0kVkF3c5Xuu2OPP8xWcxnCnr6UlFFWAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUU943VFcj5W6EHNMoAKKKKACipIkVyd0yR47sDz+QNMPXrmgBKKKKACiiigAooooA96/ZAnEWpa+h6OLfP4eb/jXgte/fsigfZvFsm0FkFntPp/rq8BqVuwCiiiqAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAHxSNG4dMBh0OM4pZ5priTzJpHkfpljk1HRRcLBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFADld1Hysy/Q0lJRQAUUUUAFFFFABRRRQAUUUUAFeqeF7iRfgpeRuD5fnXgT0yYo8/0ryuvWfDcY/4UTcSZH/Hzej8fKiqJ7AeTUUUVYBRRRQAUUUUAFFFFABRRRQAUUUUALSUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFKaAEooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAWkoooAKKKKACpA8W3DQ8+qtj+eajooAU4z8oIHuaVNufm3Y9qbRQAp60UlFABS7vl24H5c0lFABWob2ytlWK30yCUqMPJcbmLn1wCAtZdFKwEryDzC0S+UD/CDkVHSUUwHoyqPmjVvck/0NTtdJ9mMKWduhPWTBLfqeKq0UCsFFFOVWb7qk/QUDG0UtJQAUUUUAFFFFAHvH7KE/l2fiyJf9ZJ9jCD6GbNeD17x+yLZNc32vzb8JD9m3L/AHs+b/hXg9St2MKKKKoQUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFeueGreZvgFdSFQsYu7xlIH3v3Uec/lXkdes6DPJ/wzxdJuJC6pdIB6L5EZP6mplsB5NRRRVAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABSqrMcKCT6AUlKOKAAgg4IwaSiigAopaSgAooooAKKKKACiiigAooooAkt/J85ftG/wArPzbMbse2as3r6cqslgtyQ2MtPtyPpiqVKOD60AJRU9pH584jEZYH0/h96hYbWK+hoASiiigAoopRwc0AWoNPnlgacmKKIfxSOFyfQd81VYAHAYN7ihjk5pKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAFBOCMnB60lFFABRRRQAUtJRQAUp69MUlFAGgltYmAO1yVf8Au7h83+FS2WpQxpJAdLjljZSMK7Bh75/+tWXU1vGjI0jXAiZfu8dT+FBLQyYq0zFUMYzwpOcUiRyOdqIzn0UZqb7SQGWRIbkHgM4ORz2PBp0E8QdSm+0cf8tImb+Wc/rQF3Yv6LL4eWQw65p98vylTJbSjcGzwdrf4/hWlJ4QuLpluPDGoW2q275KqJVimT2ZGI5+maztQ1S9ubNbPVnFwqjNvOQGZfo3Ug45zWP88UmVYqw6Mp/rQKzLmoPqlrM1reedBIh5RhtP/wBeqbySSEb3dz2yc1tR+IPtFolrrNjHqSRjEcjOUlUem8ckVUvI9FkfdZT3UC91nQNj6FadgTtuj2D9l64ks9G8XXUUmx0Nlt/2smbgV4bXtf7Pej3smma1ex3CS2peBTscnB+fqO3UV4pWa+Jml9EFFFFWIKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACvY/CNhJcfs9ahMCAI7y8k574gj/wNeOV7T4I+0t+zzqpiLNGlzfLIB2zBGR/Wk9gPFqKKKYBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRTmVlxuUrn1GKbQAUUUUAFFFFAC0lFKuM8nAoASilOM8UlABRRRQAUUUUAFFFFABRRRQAUUUUAFFFKKAEooooAWkoooAKKKKACpYZEjyfL3NjAJPAqKigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKngs7qcZigkYYzkDj86AuQUVI0Ey/ejcfhTCpHUYoC4lFFLQAlFKTxjj8qSgAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAp8kUkYDPGwB6HHB/Gmjr0zU8l3O8C2/mHyV+6vp+NAEHGOn41IIZPJ88KWjDbSwHAPpUVdH4cW3v9B1DR2mihvHdZrcyHAfH3lz2PA/WgT0MltPnbTP7RhUvbq22TBz5Z9/r/hVKug0y3msdK1JryUWqTR+SInHzSMCD09qwpAm792WZQOSRigE7jKKcMZGenetLT49L3tBqfmwbxmOeL5tvuR3H05oGe1/sjKHsPF6Pyv+h8fjNXgFe/8A7MSpYab4zMd1DPhrRUKHrgy8498/pXgFT1YdAoooqgCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAr3j4bLt/Zu8QeWpkLy3zvj+HFug/lXg9fQ3wekEP7Nvi4MMtIt/txzx9mUc/iDUy2BHzzRRRVAFFFFAC0GkooAKUc9KSloAKSlJNJQAUUUUAFFFFABRRRQAUUUtACUUpJPXmkoAKKKKACiiigAoo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/iwKvinVlQAKL6YADsN5rqfhDNbaff3l9cTBJJYfs8MZ/iyysT+G0fnXJ+JH8zxFqcn967lP5uaV9RmfRRRTELTnkdlCljtByFHQfhTKKACiiigAooooAKfHI8bbkbHGD7j0NMooAWkoooAKKKKACiiigAooooAKKKUdfSgBKKeVAJ/eKfpn/CmUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFKOD0B9qe8isuBDGh9QWz+poAjooooAKKKKACiiigAopyuyqVViAeuO9NoAKKKKACiiloAckcjqzJG7BfvEDOPrTacJZAmwSOF/u54ptAEiW8742QyNnphSaY6sjbXVlPoRg05J5kGEmkUegYimu7u252Zj6k5oASkpaSgAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoopw24+YkH2FADaKKKACiiigAooooAKKKKACilpKACilpKACiiigAooooAKKKKACiiigAooooAK7z4AWwu/i5oluWKh/P5+kEh/pXB12nwSuJrT4oaPcW7BZFM2CRnGYXB/nSlswK3xZs76w8e6hBqIAuB5RYbgf+Wa4rlK7v4++f8A8La1v7Tt80mAtt6f6iOuEpoBaXb6MD+NNooAekbP0KD6uB/M0/7PJ/eh/wC/y/41DS0AWfsM39+2/wDAmP8A+Kpj20idWhP0mQ/yNQnk9AKACegJoEDDacHH4HNCqzHCqSfYUHjrT0gmkG5IZGHqFJoGMwc9KDRSUAFFFLQAlFKeetJQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAopKUEjOCRmkoAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAJI5po/wDVzSJ/usRTdzZLbjk9Tmm0UALQCR0JFJRQBLDPJCwaMhWByDtBI/Grja3qTKFM6ED/AKYp/hWdRQFjVHiDVh/y8Rn6wRn/ANlqX/hJ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pKvjgs0hGfpkfzqn/wANGeNu+l+H8e0E3/x2kB56fAnjcHH/AAh3iH/wWzf/ABNek/s7/D7xda/ESx8Qalot1pthYCbzGvYzC7lomQKiMNx5fOcYwDznAMK/tGeMgedK0M/9spf/AI5VzSP2kfEUVyzav4e0q7g2EKlq8kDhsjBLMXBGM8YHUc8YJuB4bRRRTAKKKKACiiigAooooAKKKKACiiigAopaSgAooooAKKKKACiiigAooooAKKKKACiiigAopQD6UlABRRS0AJRSjr604lSv3VU/jzQAyiiigAopaSgAooooAKKKKACiinLt/iJH0GaAG0UUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAfQn7HQJj8WYOP+PP8A9r18919D/slx29noviS8ublIxcyQRqpOMbRJznPct09vevnipXxMAoooqgCiiigBysVBxSHmkooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigBaU7ewI/Gm0tAEiNBt+aOUt6iQD+lO/wBEYfenjP8Auhv6ioQM/wAQH1o70CFwm/G5tvqV5/nVr7DmHzVuYCv/AAIH+VVxGcBg6f8AfWKsGHUNnHnOrf3G3D9KAKu3/aFOWJiflaP8XA/nSvBNGCXhkUDqWUjFRUAPkjaM4bb/AMBYH+VNpKKBi0UlFABTtrYztOPpSiSQJsDsF9M8U2gApKKKACiiigBaXac9vzFNooAk8pvVP++1/wAaSSN4z82PwYH+VMooFqFFFFAwoopzMW64/AAUANooooAKKUbf4gT9DQdvYH86AEopw29wT9DSsY8fKrA+7Z/pQAyiiloASilpKACilGPf8qKAEopT9aSgAooooAKXt0pKKACnKwUcxq31z/jTaKAFJyegHsKSiigBaSiigApaSigApaSigB3y+h/Ohtv8II+pzTaKAHp5eDvD57EGkj2bh5hYL32jmm0UAa0K+HDF++m1ZZMdEijIz+LCqV0tiCfsstyw7CSNR/JjVfPFJQSl5i8Z6/nUhjjA/wCPhD7AN/UVFRTGKevrQuO5x+FJRSGKwAPBzSUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFSJDM67kidh6hSaAI6Km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PpWdR7WRpFdzyailPXpikqhBRThtxyCT7Gg7cdDn60ANopRwQcA+xp/mL/zxj/Nv8aAGY4zx+dFTieLbj7HAT65fP/oVN86P/n1h/N//AIqgRDSg4Pb8RUjyIwwLeNfcFv6moqBjmYt1x+AAptFLQAlFFFABRRS5OMZoASiiigAooooAKKKKACiiigAooooAKKKKAFopKKACiiigAooooAKKKKACiiigAopc8Y4/KkoAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigBaSiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAUckCnyxqnSaNznkLnj8xUdFABSqM9WA+tJRQAUUUUAFLSUUAFFFFABRRRQAoODkcVfudSM1gtqYjwc7i2fyGOKz6KLisP8x/L8vd8uc496dbSJFJukgSZf7rEj+RqKigZqDU7cDAsdvptl4H5inW2rRW8yzR2sm5f+m3Gf++ayaKBWR1R8b6gCdlrbD3bcT/MU2XxtqskPlGG1A7EBgf8A0KuXooCyNG81rU7o/PdyqPRHIFQHUL1hhrqZ/wDecn+tVaKBll7yWSPZIFce+c/zqAsCc7FA9BTaKAJFkVTzDG31J/xpzzBkKrBCme4BJ/UmoaKAFU4OcA/WnO+4AbEUewplFADwwH8Cn65p6zKo/wCPeIn1O7/GoaKAHvJufcVXPsOKRm3fwqPoKbRQA5W2nOAfqKl+0Dbg28JPrtOf51BRQBdi1DZjdZ2shHQsrD+RFOm1LzBg2VoPorf1NUKKALjXsbAbtPtCfX5x/JqdHqCxsGTT7VSPeT/4qqNFAG5F4kmjGF06wP1En/xdR3WvT3A2m0tYx38sN/VjWPRSsgLK3W1g3l9DnrVhNXuVcNhCBxjnpWdRTA0mv7ORzJPp3mP6+cQPyxVOaSF2LJbiP2DEgVDRQKx9BfsltarpviWZvllge2ZmI42nzMfqDXz7XuP7LuJNK8X25/5aizH5GY14dUL4mMKKKKsAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiloASiiigAooooAKKKKACiiigAooooAKKKKACiiigCeK4KdYoX/3kFJcTecQfJijx/zzXGahooFYcm0sN7Mq9yBk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E1oMpK7OTXvCmtW+Nd0Kezv9p3X2nuMSOT95ozgfkTWJfaFOq/aNNcajaEZEkIJZfZl6g/hTsSp9HoY9FFFIsKKKKACvVPD0MY+CU25clpryVT6Hy0X/ANkFeV16d4bKzfCO7XzP9ULr5c9Dsz/WsqvQaPMaKKK1EFFFFABRRRQAUUUUAFFFFABRRRQAvbPakoooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKWgBKKKKACiiigAooooAKKKKACiiigAooooAWkoooAKKKKACiiigAooooAKKKKACiiigBR71II4yufPUH0ZT/AEzUVFADnUKeHVvpn+tKI2IJynHqwFMooAXHOOPzpKKKACl+Xb3z+lJRQAVqNYadDHCbnVD5rqGeOKDfsz05JHasulY7iT60AT3JhVjHEVkT+F8FWx71Acds0lFAEiIrdZkX6g/4VNLDZpbb0vGkmz/qxEQB/wACJ/pVWigVh8UssRPlSOmRg7WIzTTycnk0lFAwooooAKKKKACiiigD0z4YveJ8JfiMdPaRbnbp2zy/vY8592P+A7q84Rp5CUUNIW7bdxr2z9k+wa/vtdRlzbr9mMvP/XXFeQ3uu6nc3EkgupYFdiRHE2xVHoAKSerCV7IrHTtQAybG6x/1xb/Cq7qyNtZSp9CMU+aeebHnTSSY6b2Jx+dRVWglfqFO2jbnzFz6c/4U2ikMU/XNJRRQAUUUUAFLSUUASrcTKMCV8YwQTkflTSyleU+bPXP9KZRQKxaghtpVOboQP2Eikg/iBxUTboSVjmDA9dhOKipaVgSa6ihWbopP0FX7PRb+6QSKkUUZP35pVjH/AI8aqm8vCnlm6nKdNvmHFQkknJJJoE+Y6iHwpYxAtqvirSbRQOkLGdvyXFRz6d4Nt2z/AMJLf3oHaHTvLz7Au9c1RRbzCz6s6Frjwfbrut9P1a7fstzOiL/44M1lalfyXrgeXFBCp+SGJdqr/ifc1ToosCigoooplBRRRQAtJRRQAUUVYt7K7nK+TbysG6Hbx+fSgCvR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piscFd2FPX3oAQjacHB/Gkp8jIduyPbgc5bJJplAEsUJkhmkDL+6AJXuQTiowDgnBwOppYw7OEjyWb5QB3z2pZFMZKE8g/MPQigBlFFT2drPeTrBbpvkOcLkDOBnv9KAImbdj1Ax9abWjqEVtLbJe2xSNs7Z4OmxvUZ7H/Gs+gBKKKKAFpKKKACirWmWjX12turBSQTyew9PWorqIQzvEJFkCnhh0NAEVFFFABRRRQAo78/SpJIJY41kZflboQQaipaAEooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAK7D4MQzXHxK0mG3/1redj/AL8ua4+vQf2dGRPjLoLSEBf9I5P/AF7yUnsBz/xFmlufGN/cSKQzGPPH/TNcVz1d78fYFs/ipq1jEFEcAgAwMZJt4yT+dcFQgFHXmlO3sSfwptFMAooooAKKWnJHI7BURmZugAyTQARLvkCl1TPdugpver9rourXX+osJ2+q4z9M9arXlnc2chjuYWjcHGDRcCzp5sYZhNcXEh29Ejj5P1yQKm1jUYLvCw+eEHZgB/LNZbKygFhj61I8cSwB1l3Pn7tAaENFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFPijeVwkalmPQDrTSCCQRgjqKAEooooAKKKKACiiigAooooAKVVZjhVJPoKSlBIORwaAA9aSrqahIZI2uYorkJjAkXsO2RVaeQSSb1RUz2A4pAR0UUUwCiiigAoqRRD5JLPIJc8KEBUj65/pTASOnFACUp60lFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFLQAlFFFABRRRQAUUUUAT213dWxzb3EsXrscgH6+tRzSSTSGSRizHqaZRQAoHBOR9KSiigBcmkoooAKKKKACiiigAooooAK9q8P3vhTwz8J/DWqap4Vt9at9RvpotQkcAugVv4cjG4DOASM469x4rXonwu8V6LFo1/wCB/GKynw/qbiRLhD81lOOkg9uBn6dCCaTCxs+JPhFHrFn/AMJF8LtQj8Qa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gAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA98/ZI1DT7CXXobiYfaLprURRhcnjzs89O4rwV8bztGBngelevfssQGXxtJIRmOLaWz0yUkx+teQuCHYN1BOaXUDY1fUiumWmkWb7IYk3T7DxJIep9xWLViS3m+zJceWxjIwW7Ag4/wqDBxuwcetEdhIs6XqF5pl4l3ZTtDKhyCD19j6itzxlcW+rWtnr0VvHbzXGUuEQYBde/+fWs3Q9EvdVmURqIbfP7y4lO2NF7nJ649BWl411DSWis9F0NC9nYAg3DDDTufvNx2paXA5miirCvA8RSWPZJj5ZF4H4j+o/WqGV6KU8GkoAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigApaSigAooooAKKKKAJoIfM+ZpEjQHlmP8h3qUx2KDd9peX2VNp/WqlFKwE8jW7LlEaNh2HIP51EVIXdwR6im1LauqTDeoZDwwI7UWsBFRU15GkV1JHG25AflPqO1RHr6UwEqRppGhSFmOxCSq+hNMpKACiiigAooooAWkoooAKKKKACiiigAooooAKKKKAClpKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKUEg5BIPtSUUASGaYrtMshHpuNR0UUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFLgY+8PpSUUAFFFFABRRRQAUUUUAFeu/DW6X/AIVPqwubOOeOymuJ4STghvKQkfjgf5FeRV634FaNPgnrTL995LxG/CBP/iqmWwHkzszuztyzEk8d6lScLF5Zt4X/ANpgc/oagoqgHu7NxwB2AFMoooAfDI8T70IB9wCPyNXRrF+FCiSIAdMQIMfpWfRQBovrWpOctMh/7Yp/hTk17VF+7cJ/35T/AArMooFY0217Vm63Q/79J/hTx4i1cLtF0oH/AFxT/Csmii4zTbXtWYkm7PP/AEzX/Cq0uoXkpzJOSfoKq0UATJczocrIfyBqY6lekYM5x/uj/CqdFAF5dW1BRgXBxjHKg/zFRtqF233pif8AgIqrRQBY+2XO7d5mD64FK99dN96X/wAdH+FVqKALUN/dxPujmwfdQR+RpZdQu5G3PIpP/XNR/SqlFAFg3lx/z0A+igUxriVurD/vkVFRQAp60qMyNuVip9QcU2igC3BqF5AMRzY+qA/zFPGragP+W4P1RT/SqNFAF1tSmk/10cUpz1ZcfyIo/tBwCFt7dc+inj8zVKigLFmW8mki8pvLCegQA/n1quCR04pKKAJrW4kt2YoFO4YINRu25i2APpTaKACiiigAooooAUHFBOaSigAooooAXt70lFFADk27hvJC9yBk0+4WBSvkTPICOdybSP1NRUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABTl27huBI7gHFNooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKcqljgY/EgU2igAooooAKKKKACiiigAooooAKKKKACiiigD3H9k4qNT1jOM+ZaY/OWvF9VCrqd2qjCiZwPpuNeyfsqKp1TVi3UTWmPzlrx3V8/2tebhg+e+R6fMalPUBkN5dQwPBFO6ROQWUHgmi1u5beXzEWJm/6aRK/8xUccM0g/dxSP/uqTSvb3CAl4JVA6koRVWFoXNT1vVdSULeXssqDonRfyFZ1FLQMSiiigAop7rswG+/3HpTKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAqW2t5biTy4VUsegLAfzqKnwSeVMkm0NtYNg98UAXtT0LWdMiWbUNLvLaJsbZJIiEP0bpWdXUeJfGFxrWkxac1osMaY58wvnHpkcVy9ABRRRQAUUUUAP8t/K83A2ZxnI6/SmUUUAFKvrnGOlJTynB+dSR2zQBJCsTRTSTMSQoVFB5LHp+AAP6VDSpt3jcSFzyR6Va1aa1mvCbKHyoFVVQYwTgck/U5oEVKDwaSigYUU8xusYkZcKTgZ70ygAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACp7i3aKNJA6SI/RkzgH05HWoKe0jtEsZb5FJIHuaAGUVJCIgd02SvZV6k/wBKYxBYkDA9KAEooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKU/QCgBK9P8Iz+X8H9Si2gBpLv5s9SYUH8gK8wr13wBpdvffBbXZpvMWW2+1zRY6N+5X/4mplsB5FRRRVAFFFFABRRRQAUUU7adm7jGcdRn8qAG0UUUAFFFFABRSng80lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAVai0+6mi8yGPzFxk7WBx+FVacrMrBlYqR0IODQAh4NJSk5OTknvSUAFFFFABRRUrREWyzYJBYjPYf/AF6AEtzFvxNu2EYyoyR7471New2cQT7LeNcE/ezEU2/rVbI24xznrSUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFLk4xk49KSgAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAPZ/2WovM1jUWL7Qk1ox98GQ/0ryfxEzN4g1FmwGN3KTj13mvQf2f5podWumi6efbFvpl64TxeP+Kq1VtwbddyOCOnzMT/AFqF8TAyqXJxikoqwFXbn5s49qmmFuI/3Yk3dssD+mKgooAKUUlFACnrSUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRSjGecmgBKKWkoAKKKKAF42jnnuKSlwcZwcUlABRRRQBM8NwIVZ1IQfdyf6VFViws7i+mWG2jaSQnkY4A9Sew9zgU2SAQ58yRNw42oQxz70AQUUUUAFFOjUM4VmCjuT2pD7dKAEopaCCOooASilPbkGkoAKKX8KSgApaSigAooooAKKKKACiiigAooooAKKKKACiiigBTjtn8qSiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAHAKRyxB+nFDLjoyt9KbRQA7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q8N8Tz/atdubj++VP/jor3X9jT/ma/8Atz/9r14FqmBeEL2RAfrsGaXUCrRUtpbzXVwlvboXlc4Vc4ya2Lzwl4htLdri40/ZGo3E+chOPoGzTAwqKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACilHJxUstu8cfmHON23kY5oAhooooAKKKKACiiigAooooAKKKKAFpySPGT5blSRglTjIqW0hMiTTZAEKbunfoKr0CHrJIudrsueuDjNNpKKBirjcM5x3xUtzD5LjDB0YZRx3FRoxVwwx+PSk3Nt25O3Oce9ADoyqsCwDDuKCV3sSpI5x2plFADirY3YOKbSlmbGWJx6migBKnSVFgKsm98ELk8LnvUFLQAlKPekp6Rs7AKOvSgCaK5kS3MSqNnJzjkE//qqF5JHADuzY6ZOaWePyn2bgx74PGaaB0JHFADaKKdgbM7uc9MUANooooAKKKKAFAyQKfNFJCwWQYJGRznimxkCRS3TNEjF3LHqTQAK7KCAcA0Fmb7zE/U02igAoqVIWaJpOig4zWlHptu2lpc7mPJ3yBhhcdsdf8/hQBkUUp6+tJQAtJRU5+zeRwXMv04oAgooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACvefhUkn/AAz94nkjcgeTfBx6jyBXg1e9fCrUrOx/Z/19LxZGWeS7hIj67TCmT+RNRMDwWitRdRtrWwWCys189s+bcSjL/Rf7oxVOadgQscrED+IcZqxXK9XtIsBevLJNMsFtAm+aQ9h2A9yelU+Wy3fvWvpd5YPY3Gn3gNsswXbNGueV5G4d6AbKEFs95PIlqnyorPz1Cjuar5A6c/WuisbnTdDsL0x3H2vUriJoIzEf3caMMEk9ziuboAfFHJK22KN3b0UZNNIIOCMGpFSZFEyhlGeGziiaUyBRtAC9P/10DIqKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKUAsflBP0pKWgApKUszfeYn60lABRT4lVpArttUnk1etNJuL24EFjuu5D0WJCx/IUAZ1Fbt34dvbNWjvIXglC52yIVOPXB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WJ+poAeFVW/eNux/Cpz+vSn3d1LcsvmHCou2NB91B6CoKKACiiigAopc/LtwPypKALEt08tvHDKqt5Ywj4+YD0z3FV6KKAsFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAd18HLcT6vqbbirR2O4H/togx+tcp4h/5D+o/9fUv/AKGa6f4QTNFreogDIbT2B/7+R1y+v/8AId1D/r6k/wDQjUrdgUaKKKoAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKWkoAKKUU+FEdsM+PYDJNAEdFXDawAEvNKvpmH/wCvUV1btCQ24PG33XHQ0ARI7J91iPpW5ofiSfT2XzE81VwFweR69awhk+9JQB2Y+IuuR3KyweWFQ4AYfeX0OKj8VeNZfEOk/Zrqyt4p9wJeJMZGc98n9a5CigVgooooGFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABXon7N/wDyWfQf+3j/ANJpa87r0T9m/wD5LPoP/bx/6TS0Acn4zx/wkt3jplP/AEBax66f4p2a6f471GzViwj8rk+8SH+tcxSWwBRRRTAKUdaSigBT7UlFFABS44pKUHB4oASilpKACiiigAooooAKKUYpKACilHWnGOQDJRgPcUAMooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACilpxZcDCc+pNACHZjjcT+VNoooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAOt+Fx/wCJ1epu277Jhn0/eIf6Vz2tjGs3wJyRcSc/8CNbvw1GdcuNzKqi0YszHAA3LWDrJU6velSCpuJMEdxuNSt2PoVKKKKoQUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUtACUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRSglSCOCKAEpTQTk0lABRRRQAUUUUAFFFFABRRRQAUUtFACUUoooASiiloASilpKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigCSCPzJAu4KOpY9hVxL8Wm3+z08qRT/r25c/T0qh2q1FHDHp7XEg3yO5jjU9BgAk/qKaE3Yln1rV55A8+pXUpHQPIWX8jxVvR9ajhnCajaxXVu5AkyvIXvjtWPLG8UhjkUqw6g9RTKQz1HxN8OoZvCknizw/uFmMMqF8iUZ+bYMdvXOOCOuceXV6/wDs4arJc32p+EL2WM6bc2sl0iSHBWZQBlT7jqP9n615346s4NP8XalaWpBhSbKYORggH+tILmJRRRTAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoopRjHIP50AJRTgU2nKtnsd3/ANam0AFFFFABXon7N/8AyWfQf+3j/wBJpa87r0P9nD/ks+g/9vH/AKTy0AVvj3F5PxY1mL0Fv/6Tx1wtdz8eLtb74r6zdKmwSeR8vpiCMf0rhqS2AKKKcu3PzA49qYDaKklRVPySB17EDH6VHQAUUpBwKSgAooqSNV5aRsKBwO7e3/16AI6KU9aSgAooooAKKKKACiiigBaSiigAooooAKKKKACiiloASiiigAooooAKKKKACil7UAH0oASiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACpWaHy9ohIf+9v/pUVFABRRRQAUUUUAKcds0UlFACnrxSUUUAFFFFABT9i4z5qfTB/wplFADwq5/1iD8/8KfNDHGoK3MUueyBuPzAqGigByqCCSyrjsc802iigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAFpKKKACiiigAooooAKKKKAClyc9TSUUALSUUUAFFFFABRRRQAUUUUAFFFFABS0lFAHW/DTT/t11qbbhths9zg9wZE/riua1JQuo3Kr0Ezgfma6D4ePJ9s1K3jmaPzrIrwcZ/eIf8AGuf1IFdRuVJyRK4z68mpW7Ar0UUVQBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRTi3yBdqj3xyaAG0UU+KN5XCRqWYnAAoAZRUk0TwvsfbuHUBgcflUdADgxCleMH1ANNoooAKKKWgBKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooq3p+nXmoMy2cBlK9cEDH50AVKKtX9heWLKt3A0Rbpkg5/Kq6bc/Pux7UANoqSCGSaTZGuTjPJAAHuTwKlurT7OoLXFtIx/hjk3kflx+tAFaiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAcihmwXVB6nOP0pD16596SigAooooAKKKKACiiigApQ2ARxzSUUAFFFKxz/AAgfSgBKKKKACiiigC3bW32mzlMQzPD8xXP3k74Ht/Wi2lha1e1n+T5t8cmM7WxyD7HApmnXk9hdpdWzbZEPcZBHoa9G8P8Ag/QfGmk/2gup23hu8AO/z+beVug5JGzJ+vfjpkTsJq55pPI8srPI29ieW9aZXpf/AApnxFJOPsmteGrq1KlvtUepL5YAPQ8Zz9AR71X1vwT4Z8L2DTa14ysdR1LyS0enacDJl88bpRkAexAP9UMxvCVzP4e0q98QpP5M08bWdouDuZjjc446DHX6isSCa0u7x5tXmuhuHLwIrsT9CR/Oq1zcS3DAyMcKMIvZR6ColVm+6pPGeB2piSJrwWomP2RpWi7GRQG/IVBRRQMKKKUgigBKWkooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAK7/APZ6mS3+MGhTSMFRTPknsPs8lcBXdfAWyj1D4saLZyMyrJ5+SvXiCQ/0oYDfjvcJd/FXWLmNdqSCBgPT9xHXIWFvHcOyyTJEAONx6muo+LbyS/EjUftEKB/3W5VPX90lc9JBbq/+rkXP8JBOPrSWwFGRGjcowwR1pCTgDJwOlTypbqoCSs8mTuwPlFX410z+z3/dl5+xyQcew/rTAyaSiigBQaKSigBaKSigAopxRgoY4wenPNOi2nIZlXjqRmgBn6UlOO3naD+NNoAKKUAnOATjk0DHHNACUU5tuflJI9SMU2gAooooAKKKKACiilAJ6AmgBKKnitZZGVV2DccAlwB/OpxZ20bstzqESY6eUpkyf0FArlGinyiMSERszp2LLtJ/DJpFbB6A+xoGNoqQSL/zxjP4t/jThMqnK28I/AnP5mgCGinO5c5IUfQYptAC8Y96SilFACUU7cfb8hTaACiiigAooooAKKKKACiiigAoopyqzfdUn6CgBtFPeKSMAvG6g9ypFMoAKKKKACirEEcDp+8kKPnrnjFNuFhQ4jYt75oAhooq1FbpMq4mt4z33uRQBVoq3IsFvINsiSsDztyR+feq8rKzFlXaPSgBlFFFABRRRQAUUVKszqMcH6igCNVZjhQSfYU6SOSM4kjdTjPIxThPIJNy8YPFSSXc0pHmYbjFAFainhwGPyLg9jTT1oASiiigBe1JT0DZ4I/FgKaeDigBKKUAEfeAowP7woASilpKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKUDJxSUUAKaKSigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAp4EfdnH/AAH/AOvTKKANbw7Obe/k8k5LR7QSMHqD/Ss+93G9nLfe8xs/XNaPhZR9tnkIyY4C4+u5R/Ws69bfeTsepkY/rUrdjIaKKKoQUUUUAFFFW7eyaYEm4tYsH/lpMAaAKlFPlTy5Cm9Hx/Ep4NMoAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigApygE8sF+uabRQBIUUDPmqfYA/wCFM4z6ikooAUHB6CnvNIy7S52+g4H5VHRQAUUUUAFFFLQAlFFFABRRXffDb4Zal4ssptavryHRdAt8mXULnhTjrsBxnHckgds5obA4GivWNRvvgr4eP2Ox0LU/Fk8a7XuZrt7eJm7kbcH/AMdx7msuLxd8Ori5VL34Zx29qRhmtdTlMi+4zgGld9gPO6K9P1H4b6Vr+nz6x8NdcGrxxIZJtKuBsvYRxnA/jHPX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UUAFLSUUAFFFFABSikooAcFY9FJ/CkNJRQAUpBHUYpKKACiiigAooooAKKKKACiiigAooooAKKKWgBKKKKACinDb/EpP0NSbrbb/AKmbPr5ox/6DTFchopW27vlBA9Cc0lIYUo29yfypKfGm8n50X/eOKBMZRSsMEjIP0pKBj0kkT7rsv0OKaST1JNJRQAUtJRQAtJRRQAUUUUAFFFFABRRRQAUUUUAFFFKAT0BNACUVK9vIoBYKAemXH+NNEfHzOi/jn+VOzFdDKKcyqCPnDD2B/rS/u/8AaP6UWC4yinqUBGVLfjjNPaZMny7eNB75P8zRbzC77ENFSeY2CMJ/3wP8KZk460aBqJRRRSGFLSUUAFFFFABRRRQAUtJRQB9IfsdxFdN8RSGNQHkt8P3OBJx+H9a+b6+j/wBjq1uIrDxHcSArDM9sIwc8kCXJx6cjn29q+cKbEgooopDCiiigAooooAKKKKACiiigAooooAKKKKACiiigAoopaAEooooAKKKklk8wj5UUAYAVcf8A66AI6KKKACipIIXmfYmwHGfmcKPzJqa5s/s8QZrq1diB8kcm8j8uP1oC5VooooAKKKKAClHWkooAU9aSiigAooooAKsQQRyJvku4YuejBif0FV6KAJwlr5hVriTbn7yxZz+ZFJJHDn9zMWH+2u0/zI/WoaKBWFYbTjg/Q0lFFAwooooAlignlGY4ZHHqqk0v2a4/595f++DUNFADmVlOGUqfQim0UUAFFFFABRRRQAVJFEZN2GjXaM/MwGfpnrUdFABRRRQA+RlYjbGE45wSf502kooAKKKUYyNwJHsaAEpacxjyNqOBjnLZ/pTaAFZmY5Zix9zTaKWgBKKczMwwzEj3NNoAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKtW86payxOsJ3A4JiBbPscZH51VoAKKKKACiiigApR9cUlFADjxwGyPagNjooz6nmkJye34DFJQA95JHAVnZgOgJ4H0r07wPqH/ABabW9Pj2lwlwz5HIUxj/E15dXpngmzd/hRrV5CqqQ1zHKe7KIUYfzqKi0HF2PM6KKKsQUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUALtbGdpx64pKKKAFB4+6PrQpwQeR9KVGZG3IxU+oOKf583/AD1cj0JoEaI1qVbbyFE3QjJmz/SswyOc5djn1NP+0PuyyxN9Y15/Sle4Vzk2sA+gYfyNAkrdBkcrR9Ah/wB5A38xTnuJHHKxD6RKP5CmBo8/Mh/4C2P8aRtuflBA9zmgfyEpKWkoGKDweAfege4zSUUAOJXHCnP1o3DH3F/Wm0U7hYKKKKQBRRS0AJRTm2/wgj6nNNoAcjlDkbT9VB/nUoupR/DB/wB+E/wqFdufmJA9hmlbZ/CzH6rj+tArIWSRpD8wT/gKBf5Uylxx1H0ooGJS06OKWQExxs+Ou0ZoaORTtZGU+hGKAJPtd1t2/aJSvoXOPypsdxKilQVIPXcob+dRUUXCxLJM8gwyxj/djUfyFNRlU/NGr/XP9DTKKAsWVntx96yjP/A2/wAame50025RdMZZSOH+0EgfhiqFFAuVC1YgtklTcby3iP8AdcsD+gqtRQMc6hWwrq/uM/1oRdzAbgvuabRQBO1uu0lLmGRv7q7gT+YFQkENtIIPpSVIJpthTzG2+hPFAtRDFIq7mjcD1K0yir1nc2vl+TfWvmJ2kjO2Rf6H6GgG2ijRVi9jtY3H2W5M6n1QqRULEHGFC/TNAJ3G0UUUDCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAFVivSgszfeYn6mkooAKKKKACiiigAooooAKKKKACiirel6dealOYbOLewG5iWChR6kmgTaW5UorVe10uynMN7cyXLqSGFqRtHtuPX8KBqkNqSNNsIYjniWUeZJ+GeB+Ap27k83ZFa20zULnBhs5mU9GK4X8zxVltG8pV+06pp0DHqnml2X67QQD+NUr28ur2YzXdxJM57u2ar07oLSfU13tNFhZc6lcXQxysUATH4kn+VQPJpcbHy7O4lHYyTjH5BR/OqQkcLtDED2plHN2QlB9WWBcIpO21hA98n+Zoe7mYFf3aA9kjVf5Cq9FHPLuVyI+if2QrpI7DxRJNNI3lm1LBuQB+9xivnavoT9juJJ4fFsMi7kcWYI/7/14S8OmtM6xXkiID8peLOR+FSUUaK1dI0WTUpfLhvrKPAyzSyMoUep4pmraWunzrEdU0+6yM77aRpFH47adhcyM2irC26s4Vbq357ksB+opghfON0f/AH8X/GkO5FRV2008zvta7s4Fzy0kwwPyyanvNMtVH+g6xa3hHVdrRn8Nw5oFdGXRVqWwuYo/MkVFX1Mi/wAs5qsfrmgE0xKKKKBhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRTo0aRwqlQT/AHmCj8zxVm7sZLaJZGntZM9VinVyPqAaAuVST6mjNGD6GkoAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKWgBKKKKACiinI21twCk+4yKAG0U52Z3LMck9abQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAV6r4DuZYfgvr0ccQYST3QZvQfZ0ryqvVvh/If+FOeIVI+UNc8+5gWonsB5TRRRVgFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABSgZ9PxNJRQAtJRRQAUUUUAFFFFABRRRQAVLGtuV/eSyq3osYI/PcKiooAeVjz8shx/tLj+Was2tlHO4QahaRsf+ehZR+ZXFU6KBG43hfUiu6GbTrj2iv4ify3ZrOudOvrdmWa1lG37xC5A/EcVVZixyf5VJDcXEIIhnljB6hHIz+VAakdJT2kd/9YzP9TmnoLZiPMaVB3wob+ooC5DRVidbIKPImuHP+3EF/kxqCgExKKlaGRU34BXuVYNj646VFQO4UUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRSqCxwoJPoKAEoqzDY303+ps7iT/AHIif5Crlv4d1yYErps6Af8APUCP/wBCxQK5lUVvxeENecjdbQxKf4nuYwB/49mq0+htbz+Vcalpq/Nhis4bH4CgOZGTRWyP+Efs15NxqUw9P3UX/wAUf0pE1ezjeTZoWnurfdEm87fxBFAuZ9EZABOcAnHWlYEHBUr7GtC91i6uIvJjjgtIe8dumxSfU96ziSTk8mgauJRRRQMKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAq3LHLBp8Eqlglxu5HfacYqpVyOYTWS2T5+Vy8behOMj8cCmiZFOinOrI5VlIYHBBptIoKKKKACiiigAooooA+hv2NTgeKyen+h/wDtevnmvof9jT/ma/8Atz/9r1880AJRRT18vA3bgfUc/pQAyirAWyPWa4X2EIP67hTWW2wds0xPbMQGf/HqAIaKKKACinJtz86kj2OKc3lHO0Ovpkg/4UATWl/dW3+rkBXptdQ649MGrv8Ab1x9la3+xabhurC0RW/MDis6JbYj97NMp/2Yg3/swolSEcxz7vZkIP8AWjlFZEZbc2WAPr2pT5RJxvXjjoaZRQMftXj94oz6g8U/yAVJSeFiO2SD+oFQ0UAPSOR22ojMfQDNEsUkR2yRuh9GUimU/wAyTuxI9DyKAGUU523HO1QfYYpYmVH3NGsg/utnH6EGgBlFWUuIVYk2FswPYtJgfk1QSMGcssaxj+6ucD8yaAG0UppKACilHJxkD3NSzW7RqGEkUinujZx9R1FAXIaKKKACiiigAooooAkSaVBhJXUegYimGkooAKKKKACiiigApaSigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigApaSigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigArvvCfmt8NdXUOwjDzNjsT5Sf4VwNereCYY5vgxrEmwK8cl0Nw6keSh5qJ7AtzymiiirAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACirMNhfTY8mzuJM9NsRNTto2pr/AKy0eP8A3yF/maLi5l3M+irv9mzKMzTW0X+9Mp/QZqNLZGcKby3Uf3iWx/KgXMitRWzPpmkR2+5fEUEk3eNbaTH/AH1is9rUbC6XVu4/38H8jigOZFaipH2kBVTB7ndnNMPFBQlFPVVIyZEX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0YqynIIOCDTaKAOim8SjU4RH4gsY7+RV2pdKfLnHplhww+orOePRpCBDPd2/PJlUOP8Ax3FZ1FO5KglsX7izslP7nVreQY/iikU/+gn+dS/2FqEkLTWiJexoPna2cPt+oHP6Vl1La3FxazCa2mkhlHR42KkfiKLoLPoz3z9ju4jiuvEVu27zJvs+BjgbRL/j+lfP1fS37JeoLqcHiBri3hN5C9uWuAgDSBhJjOO4wefTFfNNSlZsroFFFFMAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAK9N+H2l6fqHw21a41KB5IrKeacBT97ESEj9K8yr034eaoE+GviLS1iAZre5kZvUeUB/hUT2A4R9UXc3k6bYRoSSoMW8gemT1pj6tfsu3zURewSJFx+QqhRWl2TyrsPllkmffI5ZvU0yiikUFFFFABRRRQAUUUUAFFFFABRRRQAUUUUASQymNgdqPjs4yKmkvZGxthto8d1hXP8AKqtFAuVF/wDtnVuNuo3UYAwBHIUH6VXury7ujm5up5z/ANNJC386gooBJIKKKKBhRRSqrMwVVJJ6ACgBKKklhmiA82KRM9NykZqOgAoopybdw3khe5AyaAG0VYYWakbZJ5B3ygT+pqBtu47QQOwJzQAlFORgpyUVvY5q3DqU0A/cR28bf3hECf1zQBBDbXMw/c28sn+4hP8AKkkgljXLgL7Fhn8utTy6nqEpy13KOMEK20H8BVSgWoqBCfnZlHsuf61oWsmjQjdNBd3T/wBwsI1/MEms2igZYvJoJZN1varbp/dDlj+ZqEszKFLEgdAT0ptFABRRRQAUVJBDNcSeXBFJK/8AdRST+lTXNhdW3/HxF5Y9yKAKtFWI7ZWUM13bx57MWz+gNPa1gC5/tG2J9Asmf/QcUCuVKKlZYVOPOZvcJx+ppYxb7x5jylc8hVAP86BkNFTzNa4IhimB7F5Af0AFOt7pYR/x6W0nvIpP9aAK1Fag1y7QYgt7CEei2cZz/wB9A05vEWrlCi3SIp7RwRp/JRQLUbYeHddvl3WmkXsq4zuEJC4+p4pH0n7M+zUrqOzb+4VLMPqBUc2s6tMmyXU7x06bTM2PyzVGgNTRWLRoZR5l1c3Sd/KjCf8AoVRXs2nNvW0sZI+flaSbcQPoAKpU+KOSVgscbOx7KMmgYRyGNtwVDx0Zcj9asw6lewxNHDMIlbr5aKp/MDNFzpt7bxebPCI17bnX+Wap0C0HySSSHMkjuf8AaOabSUUDCiiigAoqwby5ySZMk9eBTUm2tuMMTfVaYtSGirkVza7i09hHJ7K7JVi3m0WW6RZdOuY42OD5dyCR9Mj+tILmYqs33VJ+gp0cUsjbY43duuFGTXZC80nRmEmn6dp1w2MF7qfzCPXMfrWZrXi7Vb6IW8Mq2luvSOBQgH0I5x+NIDPt9E1CWLzniW3i5+edwg/XmmXEenWvyCZ7yXuU+SMe2SMn9KpO7yMWdmdj1JOSabRZgKTk9APpSVJFGHzulSPH97P9BTmSFV/15dv9lOPzOP5UxkNFFWbKznupAsaNz3xQBXAJ7UEEHBGDXQf8I5eomZsIvZzIq49jz+lY1xbGH700JPorZ/lTsK5APripYBbf8t3mHsiA/wAzUR69qSkMsuLHI2SXAHfKDn9artt3HbnHbPWnqpbHlLIzDqQKHSRfmkRxnuRimIQsu3GwA+uTTKVsZO3OO2aArY3bTj1xSGJRRRQAqqzHCqSfQClKsG2lSD6EU2igBzRuoBZGUHoSKbRS0AJRS0D86ACkpTSUAFLSUUAFOUhWyVDD0OabRQA5mBJOwAegzSgx5+ZD+DYplFO4FnfY4/49rn/v+v8A8RSO1mcbIZ19cyg/+yiq9OTZn52YD2XP9aEKw79ySOZFHfgH/Cpkis2z/pjJ/vw9fyJqPZbkfLOwP+3HgfoTUe0f31/WnYRYFvbnpfQj/eRx/SmTwCLBW4hlB/uE/wBQKhIx3BqxZ26zbtzxjHQNMqZ/OhK4fMihiaZwisgJ7u4UfmamnsZocbpLZs/3LmNv5GniwkLEb4PqLmM/1qGW2liUswUrnGVkU/yNDi0F13GmGQY+4c+jg/1pWtrhesMn/fJqIAk4AJNXYNLupULeTKgHUtGRSHcptG6gFkZQemRim1cNvdQ5VJDnHIViKrzRzRkeaGGRkZ70AmR0VNHMqkb4Y3HfjBP5U66ktZHLQWzwj+75u4fqM0gK9FTwLat/rppY/wDdjDD+YqybG0eMSQ6rb+6SoyN+gI/WnYLopRySRndG7IfVTipftlyQQ0zOD13/ADfzqKWPY+0SI/up4/WkKkHHH4HNGoaMn+0oyqslrCQO6jaT+VCtY4O6C5B9RMp/9lqP7Ncbd32eXb67DimOjxttdGU+hGKNRKwjbdx25x2zTxDIyb1QsucZXmo6UdaRQUlOaR2+8xb6802gAooooAKlhuLiEYhnljH+w5H8qipQCxCqCSegFAGm2uXkqhbqO1uwowPNgUkD6gA1A11ZyK3maciuejQyMuPwORVWSOSMgSIyEjI3DGR60yndi5UWgli54mmi/wB9AwH4j/ClW1t2A26hAGJxhlcfrjFVKKQWJ5LZ1YhWjkx3Rwc/h1qN4pUIDRupPTKkZplFACng4NJT1kcHOQ3+8Af51ZN+xi8s2lmeOvkgH8xT0DUp0UrHJJwB7Cpbc22f9IWUj1RgMfgRSGfQP7Gn/M1f9uf/ALXr54r6O/ZAt7dY/Elzb3TOGNsrRMAGTHm4J5754/GvnGjUAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigBaSiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAK7n4fbY/DHiKVzhWsLiNf97YK4avQvA1nJd/D3WmjlRPL89pN393ylqKmw0ee0UtJViCiiigAopaSgAop4kYDHy/ioNMoAKKKKACiiigBwQkZ+X8WFIeDSUUAFFFFADl2/xEj6DNSotp/HJP+EY/xqCigB7eX/CH/E03tSUUAFFSRQyynEUTyH0VSatpo+qNj/QZk95F2D9cUCbSKFPSSRfuyMv0OKuzaPqEP+sj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';});

/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor. 
 */
define('objects/Floor/material',["three",
    "base64!objects/Floor/textures/hardwood2_diffuse.jpg", "base64!objects/Floor/textures/hardwood2_bump.jpg", "base64!objects/Floor/textures/hardwood2_roughness.jpg"], 
function( THREE, diffuse, bump, roughness )
{
    var options = {
        imagetype : 'data:image/jpeg;base64,'
    };
    
    var floorMat = new THREE.MeshStandardMaterial( {
            roughness: 0.8,
            color: 0xffffff,
            metalness: 0.2,
            bumpScale: 0.0005
    });
    
    var image_diffuse = new Image();
    image_diffuse.src = 'data:image/jpeg;base64,' + diffuse;
    var texture_diffuse = new THREE.Texture();
    texture_diffuse.image = image_diffuse;
    image_diffuse.onload = function() {
        texture_diffuse.wrapS = THREE.RepeatWrapping;
        texture_diffuse.wrapT = THREE.RepeatWrapping;
        texture_diffuse.anisotropy = 4;
        texture_diffuse.repeat.set( 10, 24 );
        texture_diffuse.needsUpdate = true;
        floorMat.map = texture_diffuse;
        floorMat.needsUpdate = true;
    };
    
    var image_bump = new Image();
    image_bump.src = 'data:image/jpeg;base64,' + bump;
    var texture_bump = new THREE.Texture();
    texture_bump.image = image_bump;
    image_bump.onload = function() {
        texture_bump.wrapS = THREE.RepeatWrapping;
        texture_bump.wrapT = THREE.RepeatWrapping;
        texture_bump.anisotropy = 4;
        texture_bump.repeat.set( 10, 24 );
        texture_bump.needsUpdate = true;
        floorMat.bumpMap = texture_bump;
        floorMat.needsUpdate = true;
    };
    
    var image_roughness = new Image();
    image_roughness.src = 'data:image/jpeg;base64,' + roughness;
    var texture_roughness = new THREE.Texture();
    texture_roughness.image = image_roughness;
    image_roughness.onload = function() {
        texture_roughness.wrapS = THREE.RepeatWrapping;
        texture_roughness.wrapT = THREE.RepeatWrapping;
        texture_roughness.anisotropy = 4;
        texture_roughness.repeat.set( 10, 24 );
        texture_roughness.needsUpdate = true;
        floorMat.roughnessMap = texture_roughness;
        floorMat.needsUpdate = true;
    };
    
    
    return floorMat;
});


/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define('objects/Floor/Floor',["three", "module", "lodash", "./material"], function( THREE, module, _, material )
{
    var options = {
        shadow : true,
        material : material,
        size : [ 20, 20 ]
    };    

    var Floor = function( opt )
    {
        this.options = _.extend({}, options, opt);

        var geometry = new THREE.PlaneBufferGeometry( this.options.size[0], this.options.size[1] );
        THREE.Mesh.call(this, geometry, this.options.material );

        this.rotation.x = -Math.PI / 2.0;

        if ( this.options.shadow == true ) { this.receiveShadow = true; }
    };

    //inherits from Mesh
    Floor.prototype = Object.create( THREE.Mesh.prototype );
    Floor.prototype.constructor = Floor;
    Floor.prototype.super = THREE.Mesh;

    return Floor;
});


/**
 * Create a texture cube. Suitable for skymap or envmap
 * 
 * @returns {THREE.Texture} the just-built texture 
*/
define('materials/texturecube',["three"], function( THREE )
{
    var loader = new THREE.CubeTextureLoader();
    
    var options = {
            bridge2 : {basename: "Bridge2", format: ".jpg", posPrefix:"pos", negPrefix:"neg"}
    };

    var createTextureCube	= function( opts, opt )
    {
        if (opt.imagePath) TextureCube.baseUrl = opt.imagePath;
        TextureCube.initWellKnownUrls( TextureCube.baseUrl );
        
        // handle parameters polymorphisms
	if( typeof( opts ) === 'string' ){
		console.assert( TextureCube.WellKnownUrls[opts], "no THREEx.TextureCube.WellKnownUrls for "+opts);
		var urls	= TextureCube.WellKnownUrls[opts];
	}else if( opts instanceof THREE.Texture ){
		var textureCube	= opts;
		return textureCube;
	}else if( opts instanceof Array ){
		var urls	= opts;
	}else	console.assert(false, "opts invalid type " + opts );
	
        // sanity check
	console.assert( urls.length === 6, "url length not valid" );
	
        // create the textureCube
	var textureCube	= loader.load( urls );
	
        // return it
	return textureCube;
    };

    var TextureCube = 
    {
        baseUrl	: "",

        /**
         * To create urls compatible with THREE.ImageUtils.loadTextureCube
         * @param {type} basename
         * @param {type} format
         * @param {type} rootUrl
         * @param {type} posPrefix
         * @param {type} negPrefix
         * @returns {Array}
         */
        createUrls	: function(basename, format, rootUrl, posPrefix, negPrefix)
        {
            posPrefix	= posPrefix || "p";
            negPrefix	= negPrefix || "n";
            var path	= rootUrl + basename + "/";
            
            var urls	= [
                    path + posPrefix + 'x' + format, path + negPrefix + 'x' + format,
                    path + posPrefix + 'y' + format, path + negPrefix + 'y' + format,
                    path + posPrefix + 'z' + format, path + negPrefix + 'z' + format
            ];
    
            return urls;
        }
    };
 

    TextureCube.initWellKnownUrls	= function( baseUrl ){
            var wellKnownUrls	= {};
            var rootUrl		= baseUrl;
            wellKnownUrls['bridge2']		= TextureCube.createUrls('Bridge2'		, '.jpg', rootUrl, 'pos', 'neg');
            wellKnownUrls['dawnmountain']	= TextureCube.createUrls('dawnmountain'		, '.png', rootUrl, 'pos', 'neg');
            wellKnownUrls['escher']		= TextureCube.createUrls('Escher'		, '.jpg', rootUrl);
            wellKnownUrls['park2']		= TextureCube.createUrls('Park2'		, '.jpg', rootUrl, 'pos', 'neg');
            wellKnownUrls['park3med']		= TextureCube.createUrls('Park3Med'		, '.jpg', rootUrl);
            wellKnownUrls['pisa']		= TextureCube.createUrls('pisa'			, '.png', rootUrl);
            wellKnownUrls['skybox']		= TextureCube.createUrls('skybox'		, '.jpg', rootUrl);
            wellKnownUrls['swedishroyalcastle']	= TextureCube.createUrls('SwedishRoyalCastle'	, '.jpg', rootUrl);

            wellKnownUrls['mars']		= TextureCube.createUrls('mars'			, '.jpg', rootUrl);

            // copy result
            TextureCube.WellKnownUrls	= wellKnownUrls;
    };

    /**
     * predefined urls compatible with THREE.ImageUtils.loadTextureCube.
     * They points toward the cube maps in plugins/assets
    */
    TextureCube.WellKnownUrls	= {};


    return createTextureCube;
});


/**
 * Created by bernie on 21.11.15.
 */
define('SkyBox',["three", "lodash", "materials/texturecube", "module"], function (THREE, _, createTextureCube, module) 
{
    var loader = new THREE.TextureLoader();
    
    let defaults = {
        imagePath : module.uri.substring(0, module.uri.lastIndexOf("/")+1 ) + "textures/"
    };
    
    var SkyBox = function( opt )
    {
        this.options = _.extend( {}, defaults, opt );

        var imagePrefix = this.options.imagePath + "dawnmountain/";
        
        var directions  = ["posx", "negx", "posy", "negy", "posz", "negz"];
        var imageSuffix = ".png";
//var ct = createTextureCube("Pisa");
        var skyGeometry = new THREE.BoxGeometry( 5000, 5000, 5000 );
        var materialArray = [];
        
        for ( let i = 0; i < 6; i++ ) { 
            materialArray.push( new THREE.MeshBasicMaterial({
                map: loader.load( imagePrefix + directions[i] + imageSuffix ),
                side: THREE.BackSide
            }));
        }
        var skyMaterial = materialArray;

        this.super.call(this, skyGeometry, skyMaterial );

        this.name = "SkyBox";
    };
    SkyBox.prototype = _.create( THREE.Mesh.prototype, {
        constructor : SkyBox,
        super : THREE.Mesh
    });

    return SkyBox;
});
/** @license
 * RequireJS Image Plugin
 * Author: Miller Medeiros
 * Version: 0.2.2 (2013/02/08)
 * Released under the MIT license
 */
define('image',[],function(){

    var CACHE_BUST_QUERY_PARAM = 'bust',
        CACHE_BUST_FLAG = '!bust',
        RELATIVE_FLAG = '!rel';

    function noop(){}

    function cacheBust(url){
        url = url.replace(CACHE_BUST_FLAG, '');
        url += (url.indexOf('?') < 0)? '?' : '&';
        return url + CACHE_BUST_QUERY_PARAM +'='+ Math.round(2147483647 * Math.random());
    }

    return {
        load : function(name, req, onLoad, config){
            var img;
            if(config.isBuild){
                onLoad(null); //avoid errors on the optimizer since it can't inline image files
            }else{
                img = new Image();
                img.onerror = function (err) {
                    onLoad.error(err);
                };
                img.onload = function(evt){
                    onLoad(img);
                    try {
                        delete img.onload; //release memory - suggested by John Hann
                    } catch(err) {
                        img.onload = noop; // IE7 :(
                    }
                };
                if (name.indexOf(RELATIVE_FLAG) !== -1) {
                    //load image relative to module path / baseUrl
                    img.src = req.toUrl( name.replace(RELATIVE_FLAG, '') );
                } else {
                    img.src = name;
                }
            }
        },
        normalize : function (name, normalize) {
            //used normalize to avoid caching references to a "cache busted" request
            return (name.indexOf(CACHE_BUST_FLAG) === -1)? name : cacheBust(name);
        }
    };

});

/**
 * @license RequireJS i18n 2.0.4 Copyright (c) 2010-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/requirejs/i18n for details
 */
/*jslint regexp: true */
/*global require: false, navigator: false, define: false */

/**
 * This plugin handles i18n! prefixed modules. It does the following:
 *
 * 1) A regular module can have a dependency on an i18n bundle, but the regular
 * module does not want to specify what locale to load. So it just specifies
 * the top-level bundle, like "i18n!nls/colors".
 *
 * This plugin will load the i18n bundle at nls/colors, see that it is a root/master
 * bundle since it does not have a locale in its name. It will then try to find
 * the best match locale available in that master bundle, then request all the
 * locale pieces for that best match locale. For instance, if the locale is "en-us",
 * then the plugin will ask for the "en-us", "en" and "root" bundles to be loaded
 * (but only if they are specified on the master bundle).
 *
 * Once all the bundles for the locale pieces load, then it mixes in all those
 * locale pieces into each other, then finally sets the context.defined value
 * for the nls/colors bundle to be that mixed in locale.
 *
 * 2) A regular module specifies a specific locale to load. For instance,
 * i18n!nls/fr-fr/colors. In this case, the plugin needs to load the master bundle
 * first, at nls/colors, then figure out what the best match locale is for fr-fr,
 * since maybe only fr or just root is defined for that locale. Once that best
 * fit is found, all of its locale pieces need to have their bundles loaded.
 *
 * Once all the bundles for the locale pieces load, then it mixes in all those
 * locale pieces into each other, then finally sets the context.defined value
 * for the nls/fr-fr/colors bundle to be that mixed in locale.
 */
(function () {
    'use strict';

    //regexp for reconstructing the master bundle name from parts of the regexp match
    //nlsRegExp.exec("foo/bar/baz/nls/en-ca/foo") gives:
    //["foo/bar/baz/nls/en-ca/foo", "foo/bar/baz/nls/", "/", "/", "en-ca", "foo"]
    //nlsRegExp.exec("foo/bar/baz/nls/foo") gives:
    //["foo/bar/baz/nls/foo", "foo/bar/baz/nls/", "/", "/", "foo", ""]
    //so, if match[5] is blank, it means this is the top bundle definition.
    var nlsRegExp = /(^.*(^|\/)nls(\/|$))([^\/]*)\/?([^\/]*)/;

    //Helper function to avoid repeating code. Lots of arguments in the
    //desire to stay functional and support RequireJS contexts without having
    //to know about the RequireJS contexts.
    function addPart(locale, master, needed, toLoad, prefix, suffix) {
        if (master[locale]) {
            needed.push(locale);
            if (master[locale] === true || master[locale] === 1) {
                toLoad.push(prefix + locale + '/' + suffix);
            }
        }
    }

    function addIfExists(req, locale, toLoad, prefix, suffix) {
        var fullName = prefix + locale + '/' + suffix;
        if (require._fileExists(req.toUrl(fullName + '.js'))) {
            toLoad.push(fullName);
        }
    }

    /**
     * Simple function to mix in properties from source into target,
     * but only if target does not already have a property of the same name.
     * This is not robust in IE for transferring methods that match
     * Object.prototype names, but the uses of mixin here seem unlikely to
     * trigger a problem related to that.
     */
    function mixin(target, source, force) {
        var prop;
        for (prop in source) {
            if (source.hasOwnProperty(prop) && (!target.hasOwnProperty(prop) || force)) {
                target[prop] = source[prop];
            } else if (typeof source[prop] === 'object') {
                if (!target[prop] && source[prop]) {
                    target[prop] = {};
                }
                mixin(target[prop], source[prop], force);
            }
        }
    }

    define('i18n',['module'], function (module) {
        var masterConfig = module.config ? module.config() : {};

        return {
            version: '2.0.4',
            /**
             * Called when a dependency needs to be loaded.
             */
            load: function (name, req, onLoad, config) {
                config = config || {};

                if (config.locale) {
                    masterConfig.locale = config.locale;
                }

                var masterName,
                    match = nlsRegExp.exec(name),
                    prefix = match[1],
                    locale = match[4],
                    suffix = match[5],
                    parts = locale.split("-"),
                    toLoad = [],
                    value = {},
                    i, part, current = "";

                //If match[5] is blank, it means this is the top bundle definition,
                //so it does not have to be handled. Locale-specific requests
                //will have a match[4] value but no match[5]
                if (match[5]) {
                    //locale-specific bundle
                    prefix = match[1];
                    masterName = prefix + suffix;
                } else {
                    //Top-level bundle.
                    masterName = name;
                    suffix = match[4];
                    locale = masterConfig.locale;
                    if (!locale) {
                        locale = masterConfig.locale =
                            typeof navigator === "undefined" ? "root" :
                            (navigator.language ||
                             navigator.userLanguage || "root").toLowerCase();
                    }
                    parts = locale.split("-");
                }

                if (config.isBuild) {
                    //Check for existence of all locale possible files and
                    //require them if exist.
                    toLoad.push(masterName);
                    addIfExists(req, "root", toLoad, prefix, suffix);
                    for (i = 0; i < parts.length; i++) {
                        part = parts[i];
                        current += (current ? "-" : "") + part;
                        addIfExists(req, current, toLoad, prefix, suffix);
                    }

                    req(toLoad, function () {
                        onLoad();
                    });
                } else {
                    //First, fetch the master bundle, it knows what locales are available.
                    req([masterName], function (master) {
                        //Figure out the best fit
                        var needed = [],
                            part;

                        //Always allow for root, then do the rest of the locale parts.
                        addPart("root", master, needed, toLoad, prefix, suffix);
                        for (i = 0; i < parts.length; i++) {
                            part = parts[i];
                            current += (current ? "-" : "") + part;
                            addPart(current, master, needed, toLoad, prefix, suffix);
                        }

                        //Load all the parts missing.
                        req(toLoad, function () {
                            var i, partBundle, part;
                            for (i = needed.length - 1; i > -1 && needed[i]; i--) {
                                part = needed[i];
                                partBundle = master[part];
                                if (partBundle === true || partBundle === 1) {
                                    partBundle = req(prefix + part + '/' + suffix);
                                }
                                mixin(value, partBundle);
                            }

                            //All done, notify the loader.
                            onLoad(value);
                        });
                    });
                }
            }
        };
    });
}());

/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
define('threeVP-Extras',["lodash", "pack-postprocessing", "pack-shaders", "pack-Interactive", "threeVP-Loaders", "pack-Animation", "pack-Factorys", "plugins/plg.Tween", 
    "utilities/ModelDatGui", "factorys/Factory",
    "lights/Sunlight", "lights/Volumetricspotlight", "objects/Floor/Floor", "SkyBox", "image", "base64", "i18n"], 
function( _, postprocessing, shaders, interactive, loaders, animation, factorys, PlgTween, 
            ModelDatGui,  Factory,
            Sunlight, Volumetricspotlight, Floor, SkyBox ){
    return _.extend( {}, postprocessing, shaders, interactive, loaders, animation, factorys, {
        PlgTween    : PlgTween,
        Factory     : Factory,
        ModelDatGui : ModelDatGui,
        Sunlight    : Sunlight,
        Floor       : Floor,
        Volumetricspotlight : Volumetricspotlight,
        SkyBox      : SkyBox
    });
});