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
  isPetMode?: boolean;
}

export const VRMRenderer = ({
  modelPath = '/models/f2.vrm',
  onModelLoaded,
  backgroundColor = 'transparent',
  isPetMode = false
}: VRMRendererProps): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vrmRef = useRef<VRM | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Drag state
  const isDraggingRef = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const modelOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!canvasRef.current) return;

    // Setup Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Setup Camera
    const camera = new THREE.PerspectiveCamera(
      20, // Narrower FOV to fit full body
      window.innerWidth / window.innerHeight,
      0.1,
      20
    );
    camera.position.set(0, 0.8, 5); // Move camera further back and higher
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
        
        // Position model - center it vertically
        vrm.scene.position.set(0, -1.0, 0); // Lower position for full body view

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
      (error: unknown) => {
        console.error('[VRM] Error loading model:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load VRM model';
        setLoadingError(errorMessage);
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

    // Mouse/Touch handlers for dragging
    const handlePointerDown = (event: PointerEvent) => {
      isDraggingRef.current = true;
      lastMousePos.current = { x: event.clientX, y: event.clientY };
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'grabbing';
      }

      // In Pet Mode, enable window dragging via Electron
      if (isPetMode) {
        console.log('[VRM Pet Mode] Dragging enabled - Electron will handle window movement');
        // Note: Electron handles window dragging automatically in pet mode
        // via the -webkit-app-region: drag CSS property
      }
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'grab';
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (isDraggingRef.current) {
        if (isPetMode) {
          // In Pet Mode, Electron handles the window dragging
          // Just show visual feedback
          console.log('[VRM Pet Mode] Dragging window');
        } else if (vrmRef.current) {
          // In Window Mode, move the model
          const deltaX = event.clientX - lastMousePos.current.x;
          const deltaY = event.clientY - lastMousePos.current.y;

          modelOffset.current.x += deltaX * 0.003;
          modelOffset.current.y -= deltaY * 0.003;

          vrmRef.current.scene.position.x = modelOffset.current.x;
          vrmRef.current.scene.position.y = -1.0 + modelOffset.current.y;

          lastMousePos.current = { x: event.clientX, y: event.clientY };
        }
      } else if (vrmRef.current?.lookAt && !isPetMode) {
        // Eye tracking when not dragging (only in Window Mode)
        const x = (event.clientX / window.innerWidth) * 2 - 1;
        const y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Update look-at target position
        const target = vrmRef.current.lookAt.target;
        if (target && 'position' in target) {
          target.position.set(x * 0.5, y * 0.5 + 1.3, 0);
        }
      }
    };

    // Mouse wheel for zoom
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (cameraRef.current) {
        const delta = event.deltaY * 0.001;
        cameraRef.current.position.z += delta;
        // Clamp zoom
        cameraRef.current.position.z = Math.max(2, Math.min(10, cameraRef.current.position.z));
      }
    };

    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'grab';
      canvasRef.current.addEventListener('pointerdown', handlePointerDown);
      canvasRef.current.addEventListener('pointerup', handlePointerUp);
      canvasRef.current.addEventListener('pointermove', handlePointerMove);
      canvasRef.current.addEventListener('pointerleave', handlePointerUp);
      canvasRef.current.addEventListener('wheel', handleWheel, { passive: false });
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);

      if (canvasRef.current) {
        canvasRef.current.removeEventListener('pointerdown', handlePointerDown);
        canvasRef.current.removeEventListener('pointerup', handlePointerUp);
        canvasRef.current.removeEventListener('pointermove', handlePointerMove);
        canvasRef.current.removeEventListener('pointerleave', handlePointerUp);
        canvasRef.current.removeEventListener('wheel', handleWheel);
      }

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

  // Expose methods to change expressions and lip sync
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

    // Lip sync support - set mouth open value based on audio volume
    const setLipSync = (volume: number) => {
      if (vrmRef.current?.expressionManager) {
        // VRM standard mouth shapes
        const mouthOpen = Math.min(1.0, volume * 3.0); // Amplify volume for visibility
        
        // Try different VRM mouth blendshapes
        vrmRef.current.expressionManager.setValue('aa', mouthOpen);
        vrmRef.current.expressionManager.setValue('a', mouthOpen);
        vrmRef.current.expressionManager.setValue('mouth', mouthOpen);
        
        // Debug first time
        if (volume > 0.1 && !(window as any)._vrmLipSyncDebug) {
          console.log(`[VRM Lip Sync] Volume: ${volume}, Mouth Open: ${mouthOpen}`);
          (window as any)._vrmLipSyncDebug = true;
        }
      }
    };

    const stopLipSync = () => {
      if (vrmRef.current?.expressionManager) {
        vrmRef.current.expressionManager.setValue('aa', 0);
        vrmRef.current.expressionManager.setValue('a', 0);
        vrmRef.current.expressionManager.setValue('mouth', 0);
      }
    };

    // Expose to window for WebSocket handler
    (window as any).setVRMExpression = setExpression;
    (window as any).resetVRMExpressions = resetExpressions;
    (window as any).setVRMLipSync = setLipSync;
    (window as any).stopVRMLipSync = stopLipSync;

    return () => {
      delete (window as any).setVRMExpression;
      delete (window as any).resetVRMExpressions;
      delete (window as any).setVRMLipSync;
      delete (window as any).stopVRMLipSync;
      delete (window as any)._vrmLipSyncDebug;
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

