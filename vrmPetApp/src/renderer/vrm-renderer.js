import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

class VRMRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.vrm = null;
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    
    // Setup Camera
    this.camera = new THREE.PerspectiveCamera(
      30,
      window.innerWidth / window.innerHeight,
      0.1,
      20
    );
    this.camera.position.set(0, 1.0, 3.5);
    
    // Setup Renderer with transparent background
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true // Needed for pixel reading (hit test)
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0); // Fully transparent background
    
    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, Math.PI);
    light.position.set(1, 1, 1).normalize();
    this.scene.add(light);
    
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    
    window.addEventListener('resize', () => this.onResize());
    
    console.log('[VRM] Renderer initialized');
  }
  
  async loadVRM(path) {
    const loader = new GLTFLoader();
    loader.crossOrigin = 'anonymous';
    
    loader.register((parser) => new VRMLoaderPlugin(parser));
    
    // Show loading status
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.textContent = 'Loading VRM...';
    }
    
    return new Promise((resolve, reject) => {
      console.log('[VRM] Loading model from:', path);
      
      loader.load(
        path,
        (gltf) => {
          this.vrm = gltf.userData.vrm;
          
          if (!this.vrm) {
            reject(new Error('Failed to load VRM from GLTF'));
            return;
          }
          
          // Enable rotation for VRM0 models
          VRMUtils.rotateVRM0(this.vrm);
          
          // Scale and position model to show full body
          this.vrm.scene.scale.set(0.9, 0.9, 0.9);
          this.vrm.scene.position.set(0, -0.6, 0);
          this.scene.add(this.vrm.scene);
          
          console.log('[VRM] Model loaded successfully');
          
          // Try to log available expressions
          try {
            const expressions = this.getAvailableExpressions();
            console.log('[VRM] Available expressions:', expressions);
          } catch (error) {
            console.warn('[VRM] Could not list expressions:', error);
          }
          
          // Update status
          const statusEl = document.getElementById('status');
          if (statusEl) {
            statusEl.textContent = 'VRM Loaded ✓';
            setTimeout(() => {
              statusEl.style.display = 'none';
            }, 2000);
          }
          
          resolve(this.vrm);
        },
        (progress) => {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          console.log('[VRM] Loading progress:', percent, '%');
          
          const statusEl = document.getElementById('status');
          if (statusEl) {
            statusEl.textContent = `Loading VRM... ${percent}%`;
          }
        },
        (error) => {
          console.error('[VRM] Load error:', error);
          const statusEl = document.getElementById('status');
          if (statusEl) {
            statusEl.textContent = 'Error loading VRM!';
            statusEl.style.color = 'red';
          }
          reject(error);
        }
      );
    });
  }
  
  getAvailableExpressions() {
    if (!this.vrm?.expressionManager) return [];
    
    // Try to get expression names from the manager
    try {
      const expressions = [];
      const expressionMap = this.vrm.expressionManager.expressionMap;
      
      if (expressionMap) {
        // Try different ways to iterate
        if (typeof expressionMap.keys === 'function') {
          for (const name of expressionMap.keys()) {
            expressions.push(name);
          }
        } else if (typeof expressionMap === 'object') {
          expressions.push(...Object.keys(expressionMap));
        }
      }
      
      return expressions;
    } catch (error) {
      console.warn('[VRM] Could not get expression list:', error);
      return [];
    }
  }
  
  setExpression(name, value) {
    if (!this.vrm?.expressionManager) return;
    
    try {
      this.vrm.expressionManager.setValue(name, value);
      console.log(`[VRM] Set expression: ${name} = ${value}`);
    } catch (error) {
      console.warn(`[VRM] Could not set expression ${name}:`, error);
    }
  }
  
  resetExpressions() {
    if (!this.vrm?.expressionManager) return;
    
    try {
      const presets = ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral'];
      presets.forEach(preset => {
        try {
          this.vrm.expressionManager.setValue(preset, 0);
        } catch (e) {
          // Expression might not exist, ignore
        }
      });
    } catch (error) {
      console.warn('[VRM] Could not reset expressions:', error);
    }
  }
  
  setLipSync(volume) {
    if (!this.vrm?.expressionManager) return;
    
    try {
      const mouthOpen = Math.min(1.0, volume * 3.0);
      // Try different mouth blendshapes
      const mouthShapes = ['aa', 'a', 'mouth', 'A', 'O'];
      mouthShapes.forEach(shape => {
        try {
          this.vrm.expressionManager.setValue(shape, mouthOpen);
        } catch (e) {
          // Shape might not exist, ignore
        }
      });
    } catch (error) {
      // Ignore lip sync errors
    }
  }
  
  stopLipSync() {
    if (!this.vrm?.expressionManager) return;
    
    try {
      const mouthShapes = ['aa', 'a', 'mouth', 'A', 'O'];
      mouthShapes.forEach(shape => {
        try {
          this.vrm.expressionManager.setValue(shape, 0);
        } catch (e) {
          // Shape might not exist, ignore
        }
      });
    } catch (error) {
      // Ignore errors
    }
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    const deltaTime = this.clock.getDelta();
    
    if (this.vrm) {
      this.vrm.update(deltaTime);
      
      // Auto blink
      const s = Math.sin(Math.PI * this.clock.elapsedTime);
      if (this.vrm.expressionManager) {
        try {
          this.vrm.expressionManager.setValue('blink', s > 0.95 ? 1 : 0);
        } catch (e) {
          // Blink expression might not exist
        }
      }
      
      // Idle breathing animation
      if (this.vrm.humanoid) {
        try {
          const breathScale = Math.sin(this.clock.elapsedTime * 2) * 0.01;
          const spine = this.vrm.humanoid.getNormalizedBoneNode('spine');
          if (spine) {
            spine.rotation.z = breathScale;
          }
        } catch (e) {
          // Breathing animation might not work on this model
        }
      }
    }
    
    this.renderer.render(this.scene, this.camera);
  }
  
  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Initialize
console.log('[VRM] Starting initialization');

const canvas = document.getElementById('vrm-canvas');
const vrmRenderer = new VRMRenderer(canvas);

// Load VRM - use async to get config
(async () => {
  try {
    const config = await window.electronAPI.getConfig();
    console.log('[VRM] Config:', config);

    // Fix path to be relative to renderer directory
    const vrmPath = '../../models/character.vrm';
    console.log('[VRM] Loading from:', vrmPath);

    await vrmRenderer.loadVRM(vrmPath);
    console.log('[VRM] Starting animation loop');
    vrmRenderer.animate();
  } catch (error) {
    console.error('[VRM] Failed to initialize:', error);
  }
})();

// Expose globally for other modules
window.vrmRenderer = vrmRenderer;
console.log('[VRM] Renderer exposed to window');

