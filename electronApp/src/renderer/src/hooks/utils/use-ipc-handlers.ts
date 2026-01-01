import { useEffect, useCallback } from "react";
import { useInterrupt } from "@/components/canvas/live2d";
import { useMicToggle } from "./use-mic-toggle";
import { useLive2DConfig } from "@/context/live2d-config-context";
import { useSwitchCharacter } from "@/hooks/utils/use-switch-character";
import { useForceIgnoreMouse } from "@/hooks/utils/use-force-ignore-mouse";
import { useMode } from "@/context/mode-context";
import { useSidebar } from "@/hooks/sidebar/use-sidebar";

export function useIpcHandlers() {
  const { handleMicToggle } = useMicToggle();
  const { interrupt } = useInterrupt();
  const { modelInfo, setModelInfo } = useLive2DConfig();
  const { switchCharacter } = useSwitchCharacter();
  const { setForceIgnoreMouse } = useForceIgnoreMouse();
  const { createNewHistory } = useSidebar();
  const { mode } = useMode();
  const isPet = mode === 'pet';

  const micToggleHandler = useCallback(() => {
    handleMicToggle();
  }, [handleMicToggle]);

  const interruptHandler = useCallback(() => {
    interrupt();
  }, [interrupt]);

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

  useEffect(() => {
    if (!window.electron?.ipcRenderer) return;
    if (!isPet) return;

    window.electron.ipcRenderer.removeAllListeners("mic-toggle");
    window.electron.ipcRenderer.removeAllListeners("interrupt");
    window.electron.ipcRenderer.removeAllListeners("toggle-scroll-to-resize");
    window.electron.ipcRenderer.removeAllListeners("switch-character");
    window.electron.ipcRenderer.removeAllListeners("toggle-force-ignore-mouse");
    window.electron.ipcRenderer.removeAllListeners("force-ignore-mouse-changed");
    window.electron.ipcRenderer.removeAllListeners("new-chat");

    window.electron.ipcRenderer.on("mic-toggle", micToggleHandler);
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

    return () => {
      window.electron?.ipcRenderer.removeAllListeners("mic-toggle");
      window.electron?.ipcRenderer.removeAllListeners("interrupt");
      window.electron?.ipcRenderer.removeAllListeners(
        "toggle-scroll-to-resize",
      );
      window.electron?.ipcRenderer.removeAllListeners("switch-character");
      window.electron?.ipcRenderer.removeAllListeners("toggle-force-ignore-mouse");
      window.electron?.ipcRenderer.removeAllListeners("force-ignore-mouse-changed");
      window.electron?.ipcRenderer.removeAllListeners("new-chat");
    };
  }, [
    micToggleHandler,
    interruptHandler,
    scrollToResizeHandler,
    switchCharacterHandler,
    toggleForceIgnoreMouseHandler,
    forceIgnoreMouseChangedHandler,
    newChatHandler,
    isPet,
  ]);
}
