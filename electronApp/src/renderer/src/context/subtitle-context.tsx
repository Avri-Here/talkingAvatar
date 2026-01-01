import {
  createContext, useState, useMemo, useContext, memo, useEffect,
} from 'react';
import { loadConfig } from '@/utils/config-loader';

/**
 * Subtitle context state interface
 * @interface SubtitleState
 */
interface SubtitleState {
  /** Current subtitle text */
  subtitleText: string

  /** Set subtitle text */
  setSubtitleText: (text: string) => void

  /** Whether to show subtitle */
  showSubtitle: boolean

  /** Toggle subtitle visibility */
  setShowSubtitle: (show: boolean) => void
}

/**
 * Default values and constants
 */
const DEFAULT_SUBTITLE = {
  text: "Hi, I'm some random AI VTuber. Who the hell are ya? "
        + 'Ahh, you must be amazed by my awesomeness, right? right?',
};

/**
 * Create the subtitle context
 */
export const SubtitleContext = createContext<SubtitleState | null>(null);

/**
 * Subtitle Provider Component
 * Manages the subtitle display text state
 *
 * @param {Object} props - Provider props
 * @param {React.ReactNode} props.children - Child components
 */
export const SubtitleProvider = memo(({ children }: { children: React.ReactNode }) => {
  const [subtitleText, setSubtitleText] = useState<string>(DEFAULT_SUBTITLE.text);
  const [showSubtitle, setShowSubtitle] = useState<boolean>(true);

  useEffect(() => {
    loadConfig().then((config) => {
      setShowSubtitle(config.general.showSubtitle);
    }).catch((error) => {
      console.error('Failed to load subtitle config:', error);
    });
  }, []);

  // Memoized context value
  const contextValue = useMemo(
    () => ({
      subtitleText,
      setSubtitleText,
      showSubtitle,
      setShowSubtitle,
    }),
    [subtitleText, showSubtitle],
  );

  return (
    <SubtitleContext.Provider value={contextValue}>
      {children}
    </SubtitleContext.Provider>
  );
});

/**
 * Custom hook to use the subtitle context
 * @throws {Error} If used outside of SubtitleProvider
 */
export function useSubtitle() {
  const context = useContext(SubtitleContext);

  if (!context) {
    throw new Error('useSubtitle must be used within a SubtitleProvider');
  }

  return context;
}
