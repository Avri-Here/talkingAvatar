// @ts-nocheck
import { useEffect, useRef, useCallback, useState, RefObject } from "react";
import { ModelInfo } from "@/context/live2d-config-context";
import { updateModelConfig } from '../../../WebSDK/src/lappdefine';
import { LAppDelegate } from '../../../WebSDK/src/lappdelegate';
import { initializeLive2D } from '@cubismsdksamples/main';
import { useMode } from '@/context/mode-context';

interface UseLive2DModelProps {
  modelInfo: ModelInfo | undefined;
  canvasRef: RefObject<HTMLCanvasElement>;
}

interface Position {
  x: number;
  y: number;
}

// Thresholds for tap vs drag detection
const TAP_DURATION_THRESHOLD_MS = 200; // Max duration for a tap
const DRAG_DISTANCE_THRESHOLD_PX = 5; // Min distance to be considered a drag

// Fade transition settings
const FADE_OUT_DURATION_MS = 3000; // 3 seconds fade out
const FADE_IN_DURATION_MS = 1000; // 1 second fade in

// LocalStorage key for saving model position
const MODEL_POSITION_STORAGE_KEY = 'live2d-model-position';

// Helper functions for localStorage
const savePositionToStorage = (position: { x: number; y: number }) => {
  try {
    localStorage.setItem(MODEL_POSITION_STORAGE_KEY, JSON.stringify(position));
    // Also notify main process about the position change
    (window as any).electron?.ipcRenderer?.send('model-position-changed', position);
  } catch (error) {
    console.error('Failed to save position to localStorage:', error);
  }
};

const isPositionValid = (position: { x: number; y: number }): boolean => {
  try {

    // Position should be within reasonable bounds
    // Live2D coordinates are typically between -2 and 2 for normal viewing
    // If position is too extreme, it means the model is off-screen
    const isValid = 
      position.x >= -1.5 && 
      position.x <= 1.5 && 
      position.y >= -1.5 && 
      position.y <= 1.5;
    
    console.log(`🔍 [Position Validation] Position (${position.x}, ${position.y}) is ${isValid ? 'valid' : 'invalid'}`);
    
    return isValid;
  } catch (error) {
    console.error('Failed to validate position:', error);
    return false;
  }
};

const loadPositionFromStorage = async (): Promise<{ x: number; y: number } | null> => {
  try {
    // First try localStorage
    const saved = localStorage.getItem(MODEL_POSITION_STORAGE_KEY);
    if (saved) {

      const position = JSON.parse(saved);
      if (isPositionValid(position)) {
        return position;
      } else {

        console.warn('Saved position is out of bounds, clearing it:', position);
        console.warn('Avatar will be centered. Use right-click menu -> "Reset Avatar Position" if needed.');
        localStorage.removeItem(MODEL_POSITION_STORAGE_KEY);
        // Notify main process to clear its cache
        (window as any).electron?.ipcRenderer?.send('clear-saved-model-position');
      }
    }
    
    // If not in localStorage, try to get from main process
    const savedFromMain = await (window as any).electron?.ipcRenderer?.invoke('get-saved-model-position');
    if (savedFromMain && isPositionValid(savedFromMain)) {
      // Store in localStorage for faster access next time
      localStorage.setItem(MODEL_POSITION_STORAGE_KEY, JSON.stringify(savedFromMain));
      return savedFromMain;
    } else if (savedFromMain && !isPositionValid(savedFromMain)) {
      console.warn('⚠️ [Position Load] Main process position is out of bounds, clearing it:', savedFromMain);
      (window as any).electron?.ipcRenderer?.send('clear-saved-model-position');
    }
  } catch (error) {
    console.error('Failed to load position from localStorage:', error);
  }
  return null;
};

// Fade out current model
const fadeOutModel = (durationMs: number): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const manager = (window as any).LAppLive2DManager?.getInstance?.();
      if (!manager) {
        console.log('🔍 [Fade] No Live2D manager found');
        resolve();
        return;
      }

      const model = manager.getModel(0);
      if (!model) {
        console.log('🔍 [Fade] No model found');
        resolve();
        return;
      }

      console.log('🌅 [Fade Out] Starting fade out animation');
      const startTime = Date.now();
      const startOpacity = model.getOpacity ? model.getOpacity() : 1.0;

      const fadeInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        const newOpacity = startOpacity * (1 - progress);

        if (model.setOpacity) {
          model.setOpacity(newOpacity);
        }

        if (progress >= 1) {
          clearInterval(fadeInterval);
          console.log('✅ [Fade Out] Completed');
          resolve();
        }
      }, 16); // ~60fps
    } catch (error) {
      console.error('❌ [Fade Out] Error:', error);
      resolve();
    }
  });
};

// Fade in new model
const fadeInModel = (durationMs: number): void => {
  try {
    const manager = (window as any).LAppLive2DManager?.getInstance?.();
    if (!manager) {
      console.log('🔍 [Fade In] No Live2D manager found');
      return;
    }

    const model = manager.getModel(0);
    if (!model) {
      console.log('🔍 [Fade In] No model found');
      return;
    }

    if (model.setOpacity) {
      model.setOpacity(0);
    }
    
    console.log('🌄 [Fade In] Starting fade in animation');
    const startTime = Date.now();

    const fadeInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      
      if (model.setOpacity) {
        model.setOpacity(progress);
      }

      if (progress >= 1) {
        clearInterval(fadeInterval);
        console.log('✅ [Fade In] Completed');
      }
    }, 16); // ~60fps
  } catch (error) {
    console.error('❌ [Fade In] Error:', error);
  }
};

function parseModelUrl(url: string): { baseUrl: string; modelDir: string; modelFileName: string } {
  try {
    const urlObj = new URL(url);
    const { pathname } = urlObj;

    const lastSlashIndex = pathname.lastIndexOf('/');
    if (lastSlashIndex === -1) {
      throw new Error('Invalid model URL format');
    }

    const fullFileName = pathname.substring(lastSlashIndex + 1);
    const modelFileName = fullFileName.replace('.model3.json', '');

    const secondLastSlashIndex = pathname.lastIndexOf('/', lastSlashIndex - 1);
    if (secondLastSlashIndex === -1) {
      throw new Error('Invalid model URL format');
    }

    const modelDir = pathname.substring(secondLastSlashIndex + 1, lastSlashIndex);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}${pathname.substring(0, secondLastSlashIndex + 1)}`;

    return { baseUrl, modelDir, modelFileName };
  } catch (error) {
    console.error('Error parsing model URL:', error);
    return { baseUrl: '', modelDir: '', modelFileName: '' };
  }
}

export const playAudioWithLipSync = (audioPath: string, modelIndex = 0): Promise<void> => new Promise((resolve, reject) => {
  const live2dManager = window.LAppLive2DManager?.getInstance();
  if (!live2dManager) {
    reject(new Error('Live2D manager not initialized'));
    return;
  }

  const fullPath = `/Resources/${audioPath}`;
  const audio = new Audio(fullPath);

  audio.addEventListener('canplaythrough', () => {
    const model = live2dManager.getModel(modelIndex);
    if (model) {
      if (model._wavFileHandler) {
        model._wavFileHandler.start(fullPath);
        audio.play();
      } else {
        reject(new Error('Wav file handler not available on model'));
      }
    } else {
      reject(new Error(`Model index ${modelIndex} not found`));
    }
  });

  audio.addEventListener('ended', () => {
    resolve();
  });

  audio.addEventListener('error', () => {
    reject(new Error(`Failed to load audio: ${fullPath}`));
  });

  audio.load();
});

export const useLive2DModel = ({
  modelInfo,
  canvasRef,
}: UseLive2DModelProps) => {
  const { mode } = useMode();
  const isPet = mode === 'pet';
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Add loading state
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const dragStartPos = useRef<Position>({ x: 0, y: 0 }); // Screen coordinates at drag start
  const modelStartPos = useRef<Position>({ x: 0, y: 0 }); // Model coordinates at drag start
  const modelPositionRef = useRef<Position>({ x: 0, y: 0 });
  const prevModelUrlRef = useRef<string | null>(null);
  const isHoveringModelRef = useRef(false);
  const electronApi = (window as any).electron;

  // --- State for Tap vs Drag ---
  const mouseDownTimeRef = useRef<number>(0);
  const mouseDownPosRef = useRef<Position>({ x: 0, y: 0 }); // Screen coords at mousedown
  const isPotentialTapRef = useRef<boolean>(false); // Flag for ongoing potential tap/drag action
  // ---

  useEffect(() => {
    
    console.log('🎨 [Live2D Model] modelInfo changed:', modelInfo);
    
    const currentUrl = modelInfo?.url;
    const sdkScale = (window as any).LAppDefine?.CurrentKScale;
    const modelScale = modelInfo?.kScale !== undefined ? Number(modelInfo.kScale) : undefined;


    const needsUpdate = currentUrl &&
                        (currentUrl !== prevModelUrlRef.current ||
                         (sdkScale !== undefined && modelScale !== undefined && sdkScale !== modelScale));

    console.log('🎨 [Live2D Model] Needs update?', needsUpdate);

    if (currentUrl && currentUrl !== prevModelUrlRef.current) {
      setIsLoading(true); // Always set loading if URL changed
    }

    if (needsUpdate) {
      prevModelUrlRef.current = currentUrl;
      // setIsLoading(true); // Moved above

      const switchModel = async () => {
        try {
          const { baseUrl, modelDir, modelFileName } = parseModelUrl(currentUrl);
          console.log('🎨 [Live2D Model] Parsed URL - Base:', baseUrl, 'Dir:', modelDir, 'File:', modelFileName);

          if (baseUrl && modelDir) {
            console.log('🎨 [Live2D Model] Updating model config...');
            
            // Release current instance
            if ((window as any).LAppLive2DManager?.releaseInstance) {
              (window as any).LAppLive2DManager.releaseInstance();
            }

            updateModelConfig(baseUrl, modelDir, modelFileName, Number(modelInfo.kScale));

            setTimeout(() => {
              console.log('🎨 [Live2D Model] Initializing Live2D...');
              initializeLive2D();
              
              // Restore position from localStorage immediately after model loads
              setTimeout(async () => {
                const savedPosition = await loadPositionFromStorage();
                if (savedPosition) {
                  console.log('🔄 [Live2D Model] Restoring saved position from storage:', savedPosition);
                  setModelPosition(savedPosition.x, savedPosition.y);
                  modelPositionRef.current = { ...savedPosition };
                  setPosition(savedPosition);
                }
                
                // Set model visible immediately
                const manager = window.LAppLive2DManager?.getInstance();
                if (manager) {
                  const model = manager.getModel(0);
                  if (model && model.setOpacity) {
                    model.setOpacity(1);
                    console.log('✅ [Live2D Model] Model set to fully visible');
                  }
                }
                
                setIsLoading(false);
              }, 100);
            }, 200);
          } else {
            console.warn('⚠️ [Live2D Model] Missing baseUrl or modelDir!');
            setIsLoading(false);
          }
        } catch (error) {
          console.error('❌ [Live2D Model] Error processing model URL:', error);
          setIsLoading(false);
        }
      };

      switchModel();
    }
  }, [modelInfo?.url, modelInfo?.kScale]);

  const getModelPosition = useCallback(() => {
    const adapter = (window as any).getLAppAdapter?.();
    if (adapter) {
      const model = adapter.getModel();
      if (model && model._modelMatrix) {
        const matrix = model._modelMatrix.getArray();
        return {
          x: matrix[12],
          y: matrix[13],
        };
      }
    }
    return { x: 0, y: 0 };
  }, []);

  const setModelPosition = useCallback((x: number, y: number) => {
    const adapter = (window as any).getLAppAdapter?.();
    if (adapter) {
      const model = adapter.getModel();
      if (model && model._modelMatrix) {
        const matrix = model._modelMatrix.getArray();

        const newMatrix = [...matrix];
        newMatrix[12] = x;
        newMatrix[13] = y;

        model._modelMatrix.setMatrix(newMatrix);
        modelPositionRef.current = { x, y };
      }
    }
  }, []);

  const resetPosition = useCallback(() => {

    try {
      // Clear saved position from localStorage
      localStorage.removeItem(MODEL_POSITION_STORAGE_KEY);
      console.log('Cleared saved position from storage');
      
      const defaultPosition = { x: 0, y: 0 };
      setModelPosition(defaultPosition.x, defaultPosition.y);
      modelPositionRef.current = defaultPosition;
      setPosition(defaultPosition);
      
      console.log('Avatar position reset to default:', defaultPosition);
      
      (window as any).electron?.ipcRenderer?.send('clear-saved-model-position');
    } catch (error) {
      console.error('❌ [Reset Position] Failed to reset position:', error);
    }
  }, [setModelPosition]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      // Load position from localStorage or use default
      const savedPosition = await loadPositionFromStorage();
      
      if (savedPosition) {
        console.log('📍 [Live2D Model] Loading saved position from storage:', savedPosition);
        setModelPosition(savedPosition.x, savedPosition.y);
        modelPositionRef.current = savedPosition;
        setPosition(savedPosition);
      } else {
        console.log('📍 [Live2D Model] Using default position');
        const currentPos = getModelPosition();
        modelPositionRef.current = currentPos;
        setPosition(currentPos);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [modelInfo?.url, getModelPosition, setModelPosition]);

  const getCanvasScale = useCallback(() => {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!canvas) return { width: 1, height: 1, scale: 1 };

    const { width } = canvas;
    const { height } = canvas;
    const scale = width / canvas.clientWidth;

    return { width, height, scale };
  }, []);

  const screenToModelPosition = useCallback((screenX: number, screenY: number) => {
    const { width, height, scale } = getCanvasScale();

    const x = ((screenX * scale) / width) * 2 - 1;
    const y = -((screenY * scale) / height) * 2 + 1;

    return { x, y };
  }, [getCanvasScale]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const adapter = (window as any).getLAppAdapter?.();
    if (!adapter || !canvasRef.current) return;

    const model = adapter.getModel();
    const view = LAppDelegate.getInstance().getView();
    if (!view || !model) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left; // Screen X relative to canvas
    const y = e.clientY - rect.top; // Screen Y relative to canvas

    // --- Check if click is on model ---
    const scale = canvas.width / canvas.clientWidth;
    const scaledX = x * scale;
    const scaledY = y * scale;
    const modelX = view._deviceToScreen.transformX(scaledX);
    const modelY = view._deviceToScreen.transformY(scaledY);

    const hitAreaName = model.anyhitTest(modelX, modelY);
    const isHitOnModel = model.isHitOnModel(modelX, modelY);
    // --- End Check ---

    if (hitAreaName !== null || isHitOnModel) {
      // Record potential tap/drag start
      mouseDownTimeRef.current = Date.now();
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY }; // Use clientX/Y for distance check
      isPotentialTapRef.current = true;
      setIsDragging(false); // Ensure dragging is false initially

      // Store initial model position IF drag starts later
      if (model._modelMatrix) {
        const matrix = model._modelMatrix.getArray();
        modelStartPos.current = { x: matrix[12], y: matrix[13] };
      }
    }
  }, [canvasRef, modelInfo]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const adapter = (window as any).getLAppAdapter?.();
    const view = LAppDelegate.getInstance().getView();
    const model = adapter?.getModel();

    // --- Start Drag Logic ---
    if (isPotentialTapRef.current && adapter && view && model && canvasRef.current) {
      const timeElapsed = Date.now() - mouseDownTimeRef.current;
      const deltaX = e.clientX - mouseDownPosRef.current.x;
      const deltaY = e.clientY - mouseDownPosRef.current.y;
      const distanceMoved = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Check if it's a drag (moved enough distance OR held long enough while moving slightly)
      if (distanceMoved > DRAG_DISTANCE_THRESHOLD_PX || (timeElapsed > TAP_DURATION_THRESHOLD_MS && distanceMoved > 1)) {
        isPotentialTapRef.current = false; // It's a drag, not a tap
        setIsDragging(true);

        // Set initial drag screen position using the position from mousedown
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        dragStartPos.current = {
          x: mouseDownPosRef.current.x - rect.left,
          y: mouseDownPosRef.current.y - rect.top,
        };
        // modelStartPos is already set in handleMouseDown
      }
    }
    // --- End Start Drag Logic ---

    // --- Continue Drag Logic ---
    if (isDragging && adapter && view && model && canvasRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left; // Current screen X relative to canvas
      const currentY = e.clientY - rect.top; // Current screen Y relative to canvas

      // Convert screen delta to model delta
      const scale = canvas.width / canvas.clientWidth;
      const startScaledX = dragStartPos.current.x * scale;
      const startScaledY = dragStartPos.current.y * scale;
      const startModelX = view._deviceToScreen.transformX(startScaledX);
      const startModelY = view._deviceToScreen.transformY(startScaledY);

      const currentScaledX = currentX * scale;
      const currentScaledY = currentY * scale;
      const currentModelX = view._deviceToScreen.transformX(currentScaledX);
      const currentModelY = view._deviceToScreen.transformY(currentScaledY);

      const dx = currentModelX - startModelX;
      const dy = currentModelY - startModelY;

      const newX = modelStartPos.current.x + dx;
      const newY = modelStartPos.current.y + dy;

      // Use the adapter's setModelPosition method if available, otherwise update matrix directly
      if (adapter.setModelPosition) {
        adapter.setModelPosition(newX, newY);
      } else if (model._modelMatrix) {
        const matrix = model._modelMatrix.getArray();
        const newMatrix = [...matrix];
        newMatrix[12] = newX;
        newMatrix[13] = newY;
        model._modelMatrix.setMatrix(newMatrix);
      }

      const newPosition = { x: newX, y: newY };
      modelPositionRef.current = newPosition;
      setPosition(newPosition);
    }
    // --- End Continue Drag Logic ---

    // --- Pet Hover Logic (Unchanged) ---
    if (isPet && !isDragging && !isPotentialTapRef.current && electronApi && adapter && view && model && canvasRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const scale = canvas.width / canvas.clientWidth;
      const scaledX = x * scale;
      const scaledY = y * scale;
      const modelX = view._deviceToScreen.transformX(scaledX);
      const modelY = view._deviceToScreen.transformY(scaledY);

      const currentHitState = model.anyhitTest(modelX, modelY) !== null || model.isHitOnModel(modelX, modelY);

      if (currentHitState !== isHoveringModelRef.current) {
        isHoveringModelRef.current = currentHitState;
        electronApi.ipcRenderer.send('update-component-hover', 'live2d-model', currentHitState);
      }
    }
    // --- End Pet Hover Logic ---
  }, [isPet, isDragging, electronApi, canvasRef]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const adapter = (window as any).getLAppAdapter?.();
    const model = adapter?.getModel();
    const view = LAppDelegate.getInstance().getView();

    if (isDragging) {
      // Finalize drag
      setIsDragging(false);
      if (adapter) {
        const currentModel = adapter.getModel(); // Re-get model in case adapter changed
        if (currentModel && currentModel._modelMatrix) {
          const matrix = currentModel._modelMatrix.getArray();
          const finalPos = { x: matrix[12], y: matrix[13] };
          modelPositionRef.current = finalPos;
          modelStartPos.current = finalPos; // Update base position for next potential drag
          setPosition(finalPos);
          // Save to localStorage for persistence across model switches
          savePositionToStorage(finalPos);
          console.log('💾 [Live2D Model] Saved position to storage:', finalPos);
        }
      }
    } else if (isPotentialTapRef.current && adapter && model && view && canvasRef.current) {
      // --- Tap Motion Logic ---
      const timeElapsed = Date.now() - mouseDownTimeRef.current;
      const deltaX = e.clientX - mouseDownPosRef.current.x;
      const deltaY = e.clientY - mouseDownPosRef.current.y;
      const distanceMoved = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Check if it qualifies as a tap (short duration, minimal movement)
      if (timeElapsed < TAP_DURATION_THRESHOLD_MS && distanceMoved < DRAG_DISTANCE_THRESHOLD_PX) {
        const allowTapMotion = modelInfo?.pointerInteractive !== false;

        if (allowTapMotion && modelInfo?.tapMotions) {
          // Use mouse down position for hit testing
          const canvas = canvasRef.current;
          const rect = canvas.getBoundingClientRect();
          const scale = canvas.width / canvas.clientWidth;
          const downX = (mouseDownPosRef.current.x - rect.left) * scale;
          const downY = (mouseDownPosRef.current.y - rect.top) * scale;
          const modelX = view._deviceToScreen.transformX(downX);
          const modelY = view._deviceToScreen.transformY(downY);

          const hitAreaName = model.anyhitTest(modelX, modelY);
          // Trigger tap motion using the specific hit area name or null for general body tap
          model.startTapMotion(hitAreaName, modelInfo.tapMotions);
        }
      }
      // --- End Tap Motion Logic ---
    }

    // Reset potential tap flag regardless of outcome
    isPotentialTapRef.current = false;
  }, [isDragging, canvasRef, modelInfo]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      // If dragging and mouse leaves, treat it like a mouse up to end drag
      handleMouseUp({} as React.MouseEvent); // Pass a dummy event or adjust handleMouseUp signature
    }
    // Reset potential tap if mouse leaves before mouse up
    if (isPotentialTapRef.current) {
      isPotentialTapRef.current = false;
    }
    // --- Pet Hover Logic (Unchanged) ---
    if (isPet && electronApi && isHoveringModelRef.current) {
      isHoveringModelRef.current = false;
      electronApi.ipcRenderer.send('update-component-hover', 'live2d-model', false);
    }
  }, [isPet, isDragging, electronApi, handleMouseUp]);

  useEffect(() => {
    if (!isPet && electronApi && isHoveringModelRef.current) {
      isHoveringModelRef.current = false;
    }
  }, [isPet, electronApi]);

  // Expose motion debugging functions to window for console testing
  useEffect(() => {
    const playMotion = (motionGroup: string, motionIndex: number = 0, priority: number = 3) => {
      const adapter = (window as any).getLAppAdapter?.();
      if (!adapter) {
        console.error('Live2D adapter not available');
        return false;
      }

      const model = adapter.getModel();
      if (!model) {
        console.error('Live2D model not available');
        return false;
      }

      try {
        console.log(`Playing motion: group="${motionGroup}", index=${motionIndex}, priority=${priority}`);
        const result = model.startMotion(motionGroup, motionIndex, priority);
        console.log('Motion start result:', result);
        return result;
      } catch (error) {
        console.error('Error playing motion:', error);
        return false;
      }
    };

    const playRandomMotion = (motionGroup: string, priority: number = 3) => {
      const adapter = (window as any).getLAppAdapter?.();
      if (!adapter) {
        console.error('Live2D adapter not available');
        return false;
      }

      const model = adapter.getModel();
      if (!model) {
        console.error('Live2D model not available');
        return false;
      }

      try {
        console.log(`Playing random motion from group: "${motionGroup}", priority=${priority}`);
        const result = model.startRandomMotion(motionGroup, priority);
        console.log('Random motion start result:', result);
        return result;
      } catch (error) {
        console.error('Error playing random motion:', error);
        return false;
      }
    };

    const getMotionInfo = () => {
      const adapter = (window as any).getLAppAdapter?.();
      if (!adapter) {
        console.error('Live2D adapter not available');
        return null;
      }

      const model = adapter.getModel();
      if (!model) {
        console.error('Live2D model not available');
        return null;
      }

      try {
        const motionGroups = [];
        const setting = model._modelSetting;
        if (setting) {
          // Get all motion groups
          const groups = setting._json?.FileReferences?.Motions;
          if (groups) {
            for (const groupName in groups) {
              const motions = groups[groupName];
              motionGroups.push({
                name: groupName,
                count: motions.length,
                motions: motions.map((motion: any, index: number) => ({
                  index,
                  file: motion.File
                }))
              });
            }
          }
        }
        
        console.log('Available motion groups:', motionGroups);
        return motionGroups;
      } catch (error) {
        console.error('Error getting motion info:', error);
        return null;
      }
    };

    // Expose to window for console access
    (window as any).Live2DDebug = {
      playMotion,
      playRandomMotion,
      getMotionInfo,
      // Helper functions
      help: () => {
        console.log(`
Live2D Motion Debug Functions:
- Live2DDebug.getMotionInfo() - Get all available motion groups and their motions
- Live2DDebug.playMotion(group, index, priority) - Play specific motion
- Live2DDebug.playRandomMotion(group, priority) - Play random motion from group  
- Live2DDebug.help() - Show this help

Example usage:
Live2DDebug.getMotionInfo()  // See available motions
Live2DDebug.playMotion("", 0)  // Play first motion from default group
Live2DDebug.playRandomMotion("")  // Play random motion from default group
        `);
      }
    };

    console.log('Live2D Debug functions exposed to window.Live2DDebug');
    console.log('Type Live2DDebug.help() for usage information');

    // Cleanup function
    return () => {
      delete (window as any).Live2DDebug;
    };
  }, []);

  return {
    position,
    isDragging,
    isLoading,
    resetPosition,
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
    },
  };
};
