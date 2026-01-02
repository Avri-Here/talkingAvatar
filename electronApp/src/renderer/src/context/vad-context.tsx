import {
  createContext, useContext, useRef, useCallback, useEffect, useReducer, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { MicVAD } from '@ricky0123/vad-web';
import { useInterrupt } from '@/components/canvas/live2d';
import { audioTaskQueue } from '@/utils/task-queue';
import { useSendAudio } from '@/hooks/utils/use-send-audio';
import { AiStateContext, AiState } from './ai-state-context';
import { loadConfig } from '@/utils/config-loader';

/**
 * VAD settings configuration interface
 * @interface VADSettings
 */
export interface VADSettings {
  /** Threshold for positive speech detection (0-100) */
  positiveSpeechThreshold: number;

  /** Threshold for negative speech detection (0-100) */
  negativeSpeechThreshold: number;

  /** Number of frames for speech redemption */
  redemptionFrames: number;
}

/**
 * VAD context state interface
 * @interface VADState
 */
interface VADState {
  /** Microphone active state */
  micOn: boolean;

  /** Set microphone state */
  setMicOn: (value: boolean) => void;

  /** Start microphone and VAD */
  startMic: () => Promise<void>;

  /** Stop microphone and VAD */
  stopMic: () => void;

  /** Previous speech probability value */
  previousTriggeredProbability: number;

  /** Set previous speech probability */
  setPreviousTriggeredProbability: (value: number) => void;

  /** VAD settings configuration */
  settings: VADSettings;

  /** Update VAD settings */
  updateSettings: (newSettings: VADSettings) => void;

  /** Auto start microphone when AI starts speaking */
  autoStartMicOn: boolean;

  /** Set auto start microphone state */
  setAutoStartMicOn: (value: boolean) => void;

  /** Auto start microphone when conversation ends */
  autoStartMicOnConvEnd: boolean;

  /** Set auto start microphone when conversation ends state */
  setAutoStartMicOnConvEnd: (value: boolean) => void;

  /** Set if current session is triggered by shortcut */
  setIsShortcutSession: (value: boolean) => void;
}

/**
 * Default values and constants
 */
const DEFAULT_VAD_SETTINGS: VADSettings = {
  positiveSpeechThreshold: 50,
  negativeSpeechThreshold: 35,
  redemptionFrames: 40,
};

const DEFAULT_VAD_STATE = {
  micOn: false,
  autoStartMicOn: false,
  autoStartMicOnConvEnd: false,
};

/**
 * Create the VAD context
 */
export const VADContext = createContext<VADState | null>(null);

/**
 * VAD Provider Component
 * Manages voice activity detection and microphone state
 *
 * @param {Object} props - Provider props
 * @param {React.ReactNode} props.children - Child components
 */
export function VADProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const vadRef = useRef<MicVAD | null>(null);
  const previousTriggeredProbabilityRef = useRef(0);
  const previousAiStateRef = useRef<AiState>('idle');

  const [micOn, setMicOn] = useState(DEFAULT_VAD_STATE.micOn);
  const [settings, setSettings] = useState<VADSettings>(DEFAULT_VAD_SETTINGS);
  const [autoStartMicOn, setAutoStartMicOnState] = useState(DEFAULT_VAD_STATE.autoStartMicOn);
  const autoStartMicRef = useRef(false);
  const [autoStartMicOnConvEnd, setAutoStartMicOnConvEndState] = useState(DEFAULT_VAD_STATE.autoStartMicOnConvEnd);
  const autoStartMicOnConvEndRef = useRef(false);
  const isShortcutSessionRef = useRef(false);
  const manualSessionBufferRef = useRef<Float32Array[]>([]);

  useEffect(() => {
    loadConfig().then((config) => {

      setMicOn(false);
      setSettings({
        positiveSpeechThreshold: config.vad.positiveSpeechThreshold,
        negativeSpeechThreshold: config.vad.negativeSpeechThreshold,
        redemptionFrames: config.vad.redemptionFrames,
      });
      setAutoStartMicOnState(false);
      setAutoStartMicOnConvEndState(false);
    }).catch((error) => {
      console.error('Failed to load VAD config:', error);
    });
  }, []);

  // Force update mechanism for ref updates
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  // External hooks and contexts
  const { interrupt } = useInterrupt();
  const { sendAudioPartition } = useSendAudio();
  const { aiState, setAiState } = useContext(AiStateContext)!;

  // Refs for callback stability
  const interruptRef = useRef(interrupt);
  const sendAudioPartitionRef = useRef(sendAudioPartition);
  const aiStateRef = useRef<AiState>(aiState);
  const setAiStateRef = useRef(setAiState);

  const isProcessingRef = useRef(false);
  const audioBufferRef = useRef<Float32Array[]>([]);

  // Update refs when dependencies change
  useEffect(() => {
    aiStateRef.current = aiState;
  }, [aiState]);

  useEffect(() => {
    interruptRef.current = interrupt;
  }, [interrupt]);

  useEffect(() => {
    sendAudioPartitionRef.current = sendAudioPartition;
  }, [sendAudioPartition]);

  useEffect(() => {
    setAiStateRef.current = setAiState;
  }, [setAiState]);

  useEffect(() => {
    autoStartMicRef.current = autoStartMicOn;
  }, [autoStartMicOn]);

  useEffect(() => {
    autoStartMicOnConvEndRef.current = autoStartMicOnConvEnd;
  }, [autoStartMicOnConvEnd]);

  /**
   * Update previous triggered probability and force re-render
   */
  const setPreviousTriggeredProbability = useCallback((value: number) => {
    previousTriggeredProbabilityRef.current = value;
    forceUpdate();
  }, []);

  /**
   * Handle speech start event (initial detection)
   */
  const handleSpeechStart = useCallback(() => {
    console.log('Speech started - saving current state');
    // Save current AI state but DON'T change to listening yet
    previousAiStateRef.current = aiStateRef.current;
    isProcessingRef.current = true;
    audioBufferRef.current = [];
    // Don't change state here - wait for onSpeechRealStart
  }, []);

  /**
   * Handle real speech start event (confirmed speech)
   */
  const handleSpeechRealStart = useCallback(() => {
    console.log('Real speech confirmed - checking if need to interrupt');
    // Check if we need to interrupt based on the PREVIOUS state (before speech started)
    if (previousAiStateRef.current === 'thinking-speaking') {
      console.log('Interrupting AI speech due to user speaking');
      interruptRef.current();
    }
    // Now change to listening state
    setAiStateRef.current('listening');
  }, []);

  /**
   * Handle frame processing event
   */
  const handleFrameProcessed = useCallback((probs: { isSpeech: number }, frame: Float32Array) => {
    if (probs.isSpeech > previousTriggeredProbabilityRef.current) {
      setPreviousTriggeredProbability(probs.isSpeech);
    }
    if (isProcessingRef.current) {
      audioBufferRef.current.push(frame);
    }
  }, []);

  /**
   * Handle speech end event
   */
  const handleSpeechEnd = useCallback((audio: Float32Array) => {
    if (!isProcessingRef.current) return;
    console.log('Speech ended');
    audioTaskQueue.clearQueue();

    if (!isShortcutSessionRef.current) {

      console.log('Auto stop mic is ON and not a Shortcut Session, stopping mic ...');
      stopMic();
    }
    
    else {
      console.log('Shortcut session: accumulating audio, not sending yet.');
      manualSessionBufferRef.current.push(audio);
      
      // We still need to reset VAD processing state so it can detect NEXT phrase
      setPreviousTriggeredProbability(0);
      isProcessingRef.current = false;
      audioBufferRef.current = [];
      return;
    }

    setPreviousTriggeredProbability(0);
    sendAudioPartitionRef.current(audio);
    isProcessingRef.current = false;
    audioBufferRef.current = [];
    setAiStateRef.current("thinking-speaking");
  }, []);

  /**
   * Handle VAD misfire event
   */
  const handleVADMisfire = useCallback(() => {
    if (!isProcessingRef.current) return;
    console.log('VAD misfire detected');
    setPreviousTriggeredProbability(0);
    isProcessingRef.current = false;
    audioBufferRef.current = [];

    // Restore previous AI state
    setAiStateRef.current(previousAiStateRef.current);
  }, []);

  /**
   * Update VAD settings and restart if active
   */
  const updateSettings = useCallback((newSettings: VADSettings) => {
    setSettings(newSettings);
    if (vadRef.current) {
      stopMic();
      setTimeout(() => {
        startMic();
      }, 100);
    }
  }, []);

  /**
   * Initialize new VAD instance
   */
  const initVAD = async () => {
    const newVAD = await MicVAD.new({
      model: "v5",
      preSpeechPadFrames: 20,
      positiveSpeechThreshold: settings.positiveSpeechThreshold / 100,
      negativeSpeechThreshold: settings.negativeSpeechThreshold / 100,
      redemptionFrames: settings.redemptionFrames,
      baseAssetPath: './libs/',
      onnxWASMBasePath: './libs/',
      onSpeechStart: handleSpeechStart,
      onSpeechRealStart: handleSpeechRealStart,
      onFrameProcessed: handleFrameProcessed,
      onSpeechEnd: handleSpeechEnd,
      onVADMisfire: handleVADMisfire,
    });

    vadRef.current = newVAD;
    newVAD.start();
  };

  /**
   * Start microphone and VAD processing
   */
  const startMic = useCallback(async () => {
    try {
      if (!vadRef.current) {
        console.log('Initializing VAD');
        await initVAD();
      } else {
        console.log('Starting VAD');
        vadRef.current.start();
      }
      setMicOn(true);
    } catch (error) {
      console.error(`${t('error.failedStartVAD')}:`, error);
    }
  }, [t]);

  /**
   * Stop microphone and VAD processing
   */
  const stopMic = useCallback(() => {
    console.log('Stopping VAD');
    if (vadRef.current) {
      // If we were processing speech, send what we have
      let currentAudio: Float32Array | null = null;
      if (isProcessingRef.current && audioBufferRef.current.length > 0) {
        console.log('Sending remaining audio buffer on manual stop');
        const totalLength = audioBufferRef.current.reduce((acc, curr) => acc + curr.length, 0);
        currentAudio = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of audioBufferRef.current) {
          currentAudio.set(chunk, offset);
          offset += chunk.length;
        }
      }

      const manualAudioChunks = manualSessionBufferRef.current;
      if (manualAudioChunks.length > 0 || currentAudio) {
        console.log('Combining manual session audio chunks and sending...');
        const allChunks = [...manualAudioChunks];
        if (currentAudio) {
          allChunks.push(currentAudio);
        }

        const totalLength = allChunks.reduce((acc, curr) => acc + curr.length, 0);
        const finalAudio = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of allChunks) {
          finalAudio.set(chunk, offset);
          offset += chunk.length;
        }

        sendAudioPartitionRef.current(finalAudio);
        setAiStateRef.current("thinking-speaking");
        manualSessionBufferRef.current = [];
      }

      vadRef.current.pause();
      vadRef.current.destroy();
      vadRef.current = null;
      console.log('VAD stopped and destroyed successfully');
      setPreviousTriggeredProbability(0);
    } else {
      console.log('VAD instance not found');
    }
    setMicOn(false);
    isProcessingRef.current = false;
    audioBufferRef.current = [];
    isShortcutSessionRef.current = false;
    manualSessionBufferRef.current = [];
  }, []);


  const setAutoStartMicOn = useCallback((value: boolean) => {
    autoStartMicRef.current = value;
    setAutoStartMicOnState(value);
    forceUpdate();
  }, []);

  const setAutoStartMicOnConvEnd = useCallback((value: boolean) => {
    autoStartMicOnConvEndRef.current = value;
    setAutoStartMicOnConvEndState(value);
    forceUpdate();
  }, []);

  const setIsShortcutSession = useCallback((value: boolean) => {
    isShortcutSessionRef.current = value;
  }, []);

  // Memoized context value
  const contextValue = useMemo(
    () => ({
      micOn,
      setMicOn,
      startMic,
      stopMic,
      previousTriggeredProbability: previousTriggeredProbabilityRef.current,
      setPreviousTriggeredProbability,
      settings,
      updateSettings,
      autoStartMicOn: autoStartMicRef.current,
      setAutoStartMicOn,
      autoStartMicOnConvEnd: autoStartMicOnConvEndRef.current,
      setAutoStartMicOnConvEnd,
      setIsShortcutSession,
    }),
    [
      micOn,
      startMic,
      stopMic,
      settings,
      updateSettings,
    ],
  );

  return (
    <VADContext.Provider value={contextValue}>
      {children}
    </VADContext.Provider>
  );
}

/**
 * Custom hook to use the VAD context
 * @throws {Error} If used outside of VADProvider
 */
export function useVAD() {
  const context = useContext(VADContext);

  if (!context) {
    throw new Error('useVAD must be used within a VADProvider');
  }

  return context;
}
