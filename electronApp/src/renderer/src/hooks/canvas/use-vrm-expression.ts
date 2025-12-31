import { useCallback } from 'react';
import { setVRMExpression, resetVRMExpressions, mapEmotionToVRM } from '@/utils/vrm-emotion-mapper';

/**
 * Custom hook for handling VRM model expressions
 * Similar to useLive2DExpression but for VRM models
 */
export const useVRMExpression = () => {
  /**
   * Set expression for VRM model
   * @param expressionValue - Expression name (string) or emotion keyword
   * @param intensity - Expression intensity (0-1), default 1.0
   * @param logMessage - Optional message to log on success
   */
  const setExpression = useCallback((
    expressionValue: string | number,
    intensity: number = 1.0,
    logMessage?: string,
  ) => {
    try {
      let emotionName: string;

      if (typeof expressionValue === 'string') {
        emotionName = expressionValue;
      } else if (typeof expressionValue === 'number') {
        // Map number to emotion name (for backward compatibility with Live2D)
        const emotionMap = ['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised'];
        emotionName = emotionMap[expressionValue] || 'neutral';
      } else {
        emotionName = 'neutral';
      }

      setVRMExpression(emotionName, intensity);

      if (logMessage) {
        console.log(logMessage);
      }
    } catch (error) {
      console.error('[VRM Expression] Failed to set expression:', error);
    }
  }, []);

  /**
   * Reset expression to neutral
   */
  const resetExpression = useCallback(() => {
    try {
      resetVRMExpressions();
      console.log('[VRM Expression] Reset to neutral');
    } catch (error) {
      console.error('[VRM Expression] Failed to reset expression:', error);
    }
  }, []);

  /**
   * Get VRM expression name from emotion keyword
   */
  const getExpressionName = useCallback((emotion: string): string => {
    return mapEmotionToVRM(emotion);
  }, []);

  return {
    setExpression,
    resetExpression,
    getExpressionName,
  };
};

