import {
  createContext, useMemo, useContext, useState, useCallback, useEffect,
} from 'react';
import { loadConfig } from '@/utils/config-loader';
import { useWebSocket } from './websocket-context';

/**
 * Background file interface
 * @interface BackgroundFile
 */
interface BackgroundFile {
  name: string;
  url: string;
}

/**
 * Background URL context state interface
 * @interface BgUrlContextState
 */
export interface BgUrlContextState {
  backgroundUrl: string;
  setBackgroundUrl: (url: string) => void;
  backgroundFiles: BackgroundFile[];
  setBackgroundFiles: (files: BackgroundFile[]) => void;
  resetBackground: () => void;
  addBackgroundFile: (file: BackgroundFile) => void;
  removeBackgroundFile: (name: string) => void;
  isDefaultBackground: boolean;
  useCameraBackground: boolean;
  setUseCameraBackground: (use: boolean) => void;
}

/**
 * Create the background URL context
 */
const BgUrlContext = createContext<BgUrlContextState | null>(null);

/**
 * Background URL Provider Component
 * @param {Object} props - Provider props
 * @param {React.ReactNode} props.children - Child components
 */
export function BgUrlProvider({ children }: { children: React.ReactNode }) {
  const { baseUrl } = useWebSocket();
  const DEFAULT_BACKGROUND = `${baseUrl}/bg/ceiling-window-room-night.jpeg`;

  const [backgroundUrl, setBackgroundUrl] = useState<string>(DEFAULT_BACKGROUND);
  const [backgroundFiles, setBackgroundFiles] = useState<BackgroundFile[]>([]);
  const [useCameraBackground, setUseCameraBackground] = useState<boolean>(false);

  useEffect(() => {
    loadConfig().then((config) => {
      setBackgroundUrl(config.background.backgroundUrl);
      setUseCameraBackground(config.background.useCameraBackground);
    }).catch((error) => {
      console.error('Failed to load background config:', error);
    });
  }, []);

  const resetBackground = useCallback(() => {
    setBackgroundUrl(DEFAULT_BACKGROUND);
  }, [DEFAULT_BACKGROUND]);

  const addBackgroundFile = useCallback((file: BackgroundFile) => {
    setBackgroundFiles((prev) => [...prev, file]);
  }, []);

  const removeBackgroundFile = useCallback((name: string) => {
    setBackgroundFiles((prev) => prev.filter((file) => file.name !== name));
  }, []);

  const isDefaultBackground = useMemo(
    () => backgroundUrl === DEFAULT_BACKGROUND,
    [backgroundUrl, DEFAULT_BACKGROUND],
  );

  // Memoized context value
  const contextValue = useMemo(() => ({
    backgroundUrl,
    setBackgroundUrl,
    backgroundFiles,
    setBackgroundFiles,
    resetBackground,
    addBackgroundFile,
    removeBackgroundFile,
    isDefaultBackground,
    useCameraBackground,
    setUseCameraBackground,
  }), [backgroundUrl, setBackgroundUrl, backgroundFiles, resetBackground, addBackgroundFile, removeBackgroundFile, isDefaultBackground, useCameraBackground]);

  return (
    <BgUrlContext.Provider value={contextValue}>
      {children}
    </BgUrlContext.Provider>
  );
}

/**
 * Custom hook to use the background URL context
 * @throws {Error} If used outside of BgUrlProvider
 */
export function useBgUrl() {
  const context = useContext(BgUrlContext);

  if (!context) {
    throw new Error('useBgUrl must be used within a BgUrlProvider');
  }

  return context;
}
