interface AppConfig {
  general: {
    language: string;
    imageCompressionQuality: number;
    imageMaxWidth: number;
  };
  websocket: {
    wsUrl: string;
    baseUrl: string;
  };
  background: {
    backgroundUrl: string;
    useCameraBackground: boolean;
  };
  character: {
    configFilename: string;
  };
  proactiveSpeak: {
    allowProactiveSpeak: boolean;
    idleSecondsToSpeak: number;
    allowButtonTrigger: boolean;
  };
  vad: {
    micOn: boolean;
    autoStartMicOn: boolean;
    autoStartMicOnConvEnd: boolean;
    positiveSpeechThreshold: number;
    negativeSpeechThreshold: number;
    redemptionFrames: number;
  };
  live2d: {
    scrollToResize: boolean;
    pointerInteractive: boolean;
    minScale: number;
    maxScale: number;
  };
}

let cachedConfig: AppConfig | null = null;

export const loadConfig = async (): Promise<AppConfig> => {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const response = await fetch('/config.json');
    if (!response.ok) {
      throw new Error('Failed to load config.json');
    }
    cachedConfig = await response.json();
    return cachedConfig!;
  } catch (error) {
    console.error('Error loading config:', error);
    throw error;
  }
};

export const getConfig = (): AppConfig | null => cachedConfig;

