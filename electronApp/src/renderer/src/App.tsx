import { Box, ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { useEffect, useRef, useMemo } from "react";
import { AiStateProvider } from "./context/ai-state-context";
// ... (rest of imports)
import { Live2DConfigProvider } from "./context/live2d-config-context";
import { SubtitleProvider } from "./context/subtitle-context";
import { BgUrlProvider } from "./context/bgurl-context";
import WebSocketHandler from "./services/websocket-handler";
import { CameraProvider } from "./context/camera-context";
import { ChatHistoryProvider } from "./context/chat-history-context";
import { CharacterConfigProvider } from "./context/character-config-context";
import { Toaster } from "./components/ui/toaster";
import { VADProvider } from "./context/vad-context";
import { Live2D } from "./components/canvas/live2d";
import { InputSubtitle } from "./components/electron/input-subtitle";
import { ProactiveSpeakProvider } from "./context/proactive-speak-context";
import { ScreenCaptureProvider } from "./context/screen-capture-context";
import { GroupProvider } from "./context/group-context";
import { BrowserProvider } from "./context/browser-context";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import { ModeProvider } from "./context/mode-context";
import { ServerStatusIndicator } from "./components/ServerStatus";

function AppContent(): JSX.Element {
  const live2dContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set viewport height for mobile browsers and Electron
    const handleResize = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    // Set global body styles once on mount
    const originalStyles = {
      overflow: document.body.style.overflow,
      height: document.body.style.height,
      position: document.body.style.position,
      width: document.body.style.width,
    };

    Object.assign(document.documentElement.style, {
      overflow: 'hidden',
      height: '100%',
      position: 'fixed',
      width: '100%',
    });

    Object.assign(document.body.style, {
      overflow: 'hidden',
      height: '100%',
      position: 'fixed',
      width: '100%',
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      Object.assign(document.documentElement.style, originalStyles);
      Object.assign(document.body.style, originalStyles);
    };
  }, []);

  const live2dPetStyle = useMemo(() => ({
    position: "absolute" as const,
    overflow: "hidden",
    transition: "all 0.3s ease-in-out",
    pointerEvents: "auto" as const,
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    zIndex: 15,
  }), []);

  return (
    <>
      <Box ref={live2dContainerRef} {...live2dPetStyle}>
        <Live2D />
      </Box>
      <InputSubtitle />
      <ServerStatusIndicator />
    </>
  );
}

function App(): JSX.Element {
  return (
    <ChakraProvider value={defaultSystem}>
      {/* ModeProvider needs to wrap AppContent to provide mode to getGlobalStyles */}
      <ModeProvider>
        <AppWithGlobalStyles />
      </ModeProvider>
    </ChakraProvider>
  );
}

// New component to access mode for global styles
function AppWithGlobalStyles(): JSX.Element {
  return (
    <>
      <CameraProvider>
        <ScreenCaptureProvider>
          <CharacterConfigProvider>
            <ChatHistoryProvider>
              <AiStateProvider>
                <ProactiveSpeakProvider>
                  <Live2DConfigProvider>
                    <SubtitleProvider>
                      <VADProvider>
                        <BgUrlProvider>
                          <GroupProvider>
                            <BrowserProvider>
                              <WebSocketHandler>
                                <Toaster />
                                <AppContent />
                              </WebSocketHandler>
                            </BrowserProvider>
                          </GroupProvider>
                        </BgUrlProvider>
                      </VADProvider>
                    </SubtitleProvider>
                  </Live2DConfigProvider>
                </ProactiveSpeakProvider>
              </AiStateProvider>
            </ChatHistoryProvider>
          </CharacterConfigProvider>
        </ScreenCaptureProvider>
      </CameraProvider>
    </>
  );
}

export default App;
