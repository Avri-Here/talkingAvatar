import { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      setIgnoreMouseEvents: (ignore: boolean) => void
      toggleForceIgnoreMouse: () => void
      onForceIgnoreMouseChanged: (callback: (isForced: boolean) => void) => () => void
      showContextMenu: () => void
      onModeChanged: (callback: (mode: 'pet' | 'window') => void) => void
      onMicToggle: (callback: () => void) => () => void
      onInterrupt: (callback: () => void) => () => void
      updateComponentHover: (componentId: string, isHovering: boolean) => void
      onToggleScrollToResize: (callback: () => void) => () => void
      onSwitchCharacter: (callback: (filename: string) => void) => () => void
      getConfigFiles: () => Promise<any>
      updateConfigFiles: (files: any[]) => void
      showSplash: () => void
    }
  }
}

interface IpcRenderer {
  on(channel: 'mode-changed', func: (_event: any, mode: 'pet' | 'window') => void): void;
  send(channel: string, ...args: any[]): void;
}
