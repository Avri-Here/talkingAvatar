import { useVAD } from '@/context/vad-context';
import { useAiState } from '@/context/ai-state-context';

export function useMicToggle() {

  const { startMic, stopMic, micOn, setIsShortcutSession } = useVAD();
  const { aiState, setAiState } = useAiState();

  const handleMicToggle = async (options?: { manualControl?: boolean }): Promise<void> => {

    if (micOn) {

      stopMic();

      if (aiState === 'listening') {
        setAiState('idle');
      }


    } else {
      if (options?.manualControl) {
        setIsShortcutSession(true);
      }

      await startMic();
    }
  };

  return {
    handleMicToggle,
    micOn,
  };
}
