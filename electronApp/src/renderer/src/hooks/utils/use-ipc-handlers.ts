import { useEffect, useCallback } from "react";
import { useInterrupt } from "@/components/canvas/live2d";
import { useMicToggle } from "./use-mic-toggle";
import { useLive2DConfig } from "@/context/live2d-config-context";
import { useSwitchCharacter } from "@/hooks/utils/use-switch-character";
import { useForceIgnoreMouse } from "@/hooks/utils/use-force-ignore-mouse";
import { useWebSocket } from '@/context/websocket-context';
import { useChatHistory } from '@/context/chat-history-context';

export function useIpcHandlers() {
  const { handleMicToggle } = useMicToggle();
  const { interrupt } = useInterrupt();
  const { modelInfo, setModelInfo } = useLive2DConfig();
  const { switchCharacter } = useSwitchCharacter();
  const { setForceIgnoreMouse } = useForceIgnoreMouse();
  const { sendMessage } = useWebSocket();
  const { currentHistoryUid, messages, updateHistoryList } = useChatHistory();

  const createNewHistory = useCallback((): void => {
    if (currentHistoryUid && messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      updateHistoryList(currentHistoryUid, latestMessage);
    }

    interrupt();
    sendMessage({
      type: 'create-new-history',
    });
  }, [currentHistoryUid, messages, updateHistoryList, interrupt, sendMessage]);

  const micToggleHandler = useCallback((_event: Electron.IpcRendererEvent, args: { manualControl?: boolean }) => {
    handleMicToggle({ manualControl: args?.manualControl });
  }, [handleMicToggle]);

  const interruptHandler = useCallback((_event: Electron.IpcRendererEvent, args?: { resetChatHistory?: boolean }) => {

    if (args?.resetChatHistory) {
      createNewHistory();
      
    } else {
      interrupt();
    }
  }, [interrupt, createNewHistory]);

  const scrollToResizeHandler = useCallback(() => {
    if (modelInfo) {
      setModelInfo({
        ...modelInfo,
        scrollToResize: !modelInfo.scrollToResize,
      });
    }
  }, [modelInfo, setModelInfo]);

  const switchCharacterHandler = useCallback(
    (_event: Electron.IpcRendererEvent, filename: string) => {
      switchCharacter(filename);
    },
    [switchCharacter],
  );

  // Handler for force ignore mouse state changes from main process
  const forceIgnoreMouseChangedHandler = useCallback(
    (_event: Electron.IpcRendererEvent, isForced: boolean) => {
      console.log("Force ignore mouse changed:", isForced);
      setForceIgnoreMouse(isForced);
    },
    [setForceIgnoreMouse],
  );

  // Handle toggle force ignore mouse from menu
  const toggleForceIgnoreMouseHandler = useCallback(() => {
    (window.api as any).toggleForceIgnoreMouse();
  }, []);

  // Handler for new chat from context menu
  const newChatHandler = useCallback(() => {
    console.log("[IPC] New chat requested from context menu");
    createNewHistory();
  }, [createNewHistory]);

  // Handler for reset avatar position from context menu
  const resetAvatarPositionHandler = useCallback(() => {
    console.log("Reset avatar position requested from context menu");
    const resetFunc = (window as any).resetAvatarPosition;
    if (resetFunc) {
      resetFunc();
    } else {
      console.warn("[IPC] resetAvatarPosition function not found on window");
    }
  }, []);

  useEffect(() => {
    if (!window.electron?.ipcRenderer) return;

    window.electron.ipcRenderer.removeAllListeners("micToggle");
    window.electron.ipcRenderer.removeAllListeners("interrupt");
    window.electron.ipcRenderer.removeAllListeners("toggle-scroll-to-resize");
    window.electron.ipcRenderer.removeAllListeners("switch-character");
    window.electron.ipcRenderer.removeAllListeners("toggle-force-ignore-mouse");
    window.electron.ipcRenderer.removeAllListeners("force-ignore-mouse-changed");
    window.electron.ipcRenderer.removeAllListeners("new-chat");
    window.electron.ipcRenderer.removeAllListeners("reset-avatar-position");

    window.electron.ipcRenderer.on("micToggle", micToggleHandler);
    window.electron.ipcRenderer.on("interrupt", interruptHandler);
    window.electron.ipcRenderer.on(
      "toggle-scroll-to-resize",
      scrollToResizeHandler,
    );
    window.electron.ipcRenderer.on("switch-character", switchCharacterHandler);
    window.electron.ipcRenderer.on(
      "toggle-force-ignore-mouse",
      toggleForceIgnoreMouseHandler,
    );
    window.electron.ipcRenderer.on(
      "force-ignore-mouse-changed",
      forceIgnoreMouseChangedHandler,
    );
    window.electron.ipcRenderer.on("new-chat", newChatHandler);
    window.electron.ipcRenderer.on("reset-avatar-position", resetAvatarPositionHandler);

    return () => {
      window.electron?.ipcRenderer.removeAllListeners("micToggle");
      window.electron?.ipcRenderer.removeAllListeners("interrupt");
      window.electron?.ipcRenderer.removeAllListeners(
        "toggle-scroll-to-resize",
      );
      window.electron?.ipcRenderer.removeAllListeners("switch-character");
      window.electron?.ipcRenderer.removeAllListeners("toggle-force-ignore-mouse");
      window.electron?.ipcRenderer.removeAllListeners("force-ignore-mouse-changed");
      window.electron?.ipcRenderer.removeAllListeners("new-chat");
      window.electron?.ipcRenderer.removeAllListeners("reset-avatar-position");
    };
  }, [
    micToggleHandler,
    interruptHandler,
    scrollToResizeHandler,
    switchCharacterHandler,
    toggleForceIgnoreMouseHandler,
    forceIgnoreMouseChangedHandler,
    newChatHandler,
    resetAvatarPositionHandler,
  ]);
}
