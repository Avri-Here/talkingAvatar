/* eslint-disable no-shadow */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

interface VRMRendererProps {
  modelPath?: string;
  onModelLoaded?: (vrm: VRM) => void;
  backgroundColor?: string;
}

export const VRMRenderer = ({
  modelPath = '/models/character.vrm',
  onModelLoaded,
  backgroundColor = 'transparent'
}: VRMRendererProps): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vrmRef = useRef<VRM | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Setup Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Setup Camera
    const camera = new THREE.PerspectiveCamera(
      30,
      window.innerWidth / window.innerHeight,
      0.1,
      20
    );
    camera.position.set(0, 1.3, 3);
    cameraRef.current = camera;

    // Setup Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: backgroundColor === 'transparent',
      antialias: true,
      preserveDrawingBuffer: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    // Setup Lights
    const directionalLight = new THREE.DirectionalLight(0xffffff, Math.PI);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Load VRM Model
    const loader = new GLTFLoader();
    loader.crossOrigin = 'anonymous';

    loader.register((parser) => {
      return new VRMLoaderPlugin(parser);
    });

    console.log('[VRM] Loading model from:', modelPath);

    loader.load(
      modelPath,
      (gltf) => {
        const vrm = gltf.userData.vrm as VRM;
        
        if (!vrm) {
          console.error('[VRM] Failed to load VRM from GLTF');
          setLoadingError('Failed to load VRM model');
          return;
        }

        // Enable rotation for VRM
        VRMUtils.rotateVRM0(vrm);

        vrmRef.current = vrm;
        scene.add(vrm.scene);

        console.log('[VRM] Model loaded successfully!', vrm);
        
        // Position model
        vrm.scene.position.y = -0.5;

        setIsLoaded(true);
        setLoadingProgress(100);

        if (onModelLoaded) {
          onModelLoaded(vrm);
        }

        // Expose VRM to window for testing
        (window as any).vrm = vrm;
      },
      (progress) => {
        const percent = (progress.loaded / progress.total) * 100;
        setLoadingProgress(Math.round(percent));
        console.log('[VRM] Loading progress:', Math.round(percent), '%');
      },
      (error) => {
        console.error('[VRM] Error loading model:', error);
        setLoadingError(error.message || 'Failed to load VRM model');
      }
    );

    // Animation Loop
    const clock = new THREE.Clock();
    
    const animate = () => {
      requestAnimationFrame(animate);

      const deltaTime = clock.getDelta();

      // Update VRM
      if (vrmRef.current) {
        vrmRef.current.update(deltaTime);

        // Auto blink
        const s = Math.sin(Math.PI * clock.elapsedTime);
        if (vrmRef.current.expressionManager) {
          vrmRef.current.expressionManager.setValue('blink', s > 0.95 ? 1 : 0);
        }

        // Idle breathing animation
        if (vrmRef.current.humanoid) {
          const breathScale = Math.sin(clock.elapsedTime * 2) * 0.01;
          const spine = vrmRef.current.humanoid.getNormalizedBoneNode('spine');
          if (spine) {
            spine.rotation.z = breathScale;
          }
        }
      }

      // Render
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    // Handle Window Resize
    const handleResize = () => {
      if (!rendererRef.current || !cameraRef.current) return;

      const width = window.innerWidth;
      const height = window.innerHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Mouse Movement for Eye Tracking
    const handleMouseMove = (event: MouseEvent) => {
      if (!vrmRef.current?.lookAt) return;

      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = -(event.clientY / window.innerHeight) * 2 + 1;

      // Update look-at target
      vrmRef.current.lookAt.target.set(x * 0.5, y * 0.5 + 1.3, 0);
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }

      if (vrmRef.current) {
        VRMUtils.deepDispose(vrmRef.current.scene);
      }

      // Clean up window reference
      delete (window as any).vrm;
    };
  }, [modelPath, onModelLoaded, backgroundColor]);

  // Expose methods to change expressions
  useEffect(() => {
    const setExpression = (expressionName: string, value: number) => {
      if (vrmRef.current?.expressionManager) {
        vrmRef.current.expressionManager.setValue(expressionName, value);
        console.log(`[VRM] Set expression ${expressionName} to ${value}`);
      }
    };

    const resetExpressions = () => {
      if (vrmRef.current?.expressionManager) {
        const presets = ['happy', 'angry', 'sad', 'relaxed', 'surprised'];
        presets.forEach(preset => {
          vrmRef.current?.expressionManager?.setValue(preset, 0);
        });
        console.log('[VRM] Reset all expressions');
      }
    };

    // Expose to window for WebSocket handler
    (window as any).setVRMExpression = setExpression;
    (window as any).resetVRMExpressions = resetExpressions;

    return () => {
      delete (window as any).setVRMExpression;
      delete (window as any).resetVRMExpressions;
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      />
      
      {/* Loading Indicator */}
      {!isLoaded && !loadingError && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'white',
            fontSize: '24px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            textAlign: 'center'
          }}
        >
          <div>Loading VRM Model...</div>
          <div style={{ fontSize: '18px', marginTop: '10px' }}>
            {loadingProgress}%
          </div>
        </div>
      )}

      {/* Error Message */}
      {loadingError && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'red',
            fontSize: '18px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            textAlign: 'center',
            maxWidth: '80%'
          }}
        >
          <div>Error Loading VRM:</div>
          <div style={{ fontSize: '14px', marginTop: '10px' }}>
            {loadingError}
          </div>
          <div style={{ fontSize: '12px', marginTop: '10px', color: '#ffaa00' }}>
            Check console for details
          </div>
        </div>
      )}
    </div>
  );
};

export default VRMRenderer;

