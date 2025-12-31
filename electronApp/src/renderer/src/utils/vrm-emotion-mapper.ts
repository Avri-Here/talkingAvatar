/**
 * Maps backend emotion names to VRM expression names
 * VRM Standard Expressions: neutral, happy, angry, sad, relaxed, surprised
 */

export interface EmotionMapping {
  [key: string]: string;
}

// Default emotion mapping from backend to VRM
export const EMOTION_MAP: EmotionMapping = {
  // Backend emotion -> VRM expression
  neutral: 'neutral',
  happy: 'happy',
  joy: 'happy',
  smirk: 'happy',
  angry: 'angry',
  anger: 'angry',
  disgust: 'angry',
  sad: 'sad',
  sadness: 'sad',
  fear: 'surprised',
  surprised: 'surprised',
  surprise: 'surprised',
  relaxed: 'relaxed',
  calm: 'relaxed'
};

/**
 * Convert backend emotion to VRM expression name
 */
export const mapEmotionToVRM = (emotion: string): string => {
  const normalized = emotion.toLowerCase().trim();
  return EMOTION_MAP[normalized] || 'neutral';
};

/**
 * Set VRM expression via window API
 */
export const setVRMExpression = (emotion: string, intensity: number = 1.0): void => {
  const vrmExpression = mapEmotionToVRM(emotion);
  
  if (typeof (window as any).setVRMExpression === 'function') {
    // Reset other expressions first
    if (typeof (window as any).resetVRMExpressions === 'function') {
      (window as any).resetVRMExpressions();
    }
    
    // Set new expression
    (window as any).setVRMExpression(vrmExpression, intensity);
    console.log(`[VRM Emotion] ${emotion} -> ${vrmExpression} (${intensity})`);
  } else {
    console.warn('[VRM Emotion] VRM expression functions not available');
  }
};

/**
 * Reset all VRM expressions to neutral
 */
export const resetVRMExpressions = (): void => {
  if (typeof (window as any).resetVRMExpressions === 'function') {
    (window as any).resetVRMExpressions();
    console.log('[VRM Emotion] Reset to neutral');
  }
};

/**
 * Get available VRM expressions
 */
export const getAvailableVRMExpressions = (): string[] => {
  const vrm = (window as any).vrm;
  if (vrm?.expressionManager) {
    return vrm.expressionManager.expressionMap.keys();
  }
  return ['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised'];
};

