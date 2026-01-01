import {
  Tray, nativeImage, Menu, BrowserWindow, ipcMain, screen, MenuItemConstructorOptions, app,
} from 'electron';
// @ts-expect-error
import trayIcon from '../../resources/sd.png?asset';

export interface ConfigFile {
  filename: string;
  name: string;
}

export class MenuManager {
  private tray: Tray | null = null;


  private configFiles: ConfigFile[] = [];

  constructor() {
    this.setupContextMenu();
  }

  createTray(): void {
    const icon = nativeImage.createFromPath(trayIcon);
    const trayIconResized = icon.resize({
      width: process.platform === 'win32' ? 16 : 18,
      height: process.platform === 'win32' ? 16 : 18,
    });

    this.tray = new Tray(trayIconResized);
    this.updateTrayMenu();
  }

  private updateTrayMenu(): void {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Exit',
        click: () => {
          app.quit();
        },
      },
      {
        label: 'Hide',
        click: () => {
          const windows = BrowserWindow.getAllWindows();
          windows.forEach((window) => {
            window.hide();
          });
        },
      },
      {
        label: 'Show',
        click: () => {
          const windows = BrowserWindow.getAllWindows();
          windows.forEach((window) => {
            window.show();
          });
        },
      },
      {
        label: 'Toggle Mouse Passthrough',
        click: () => {
          const windows = BrowserWindow.getAllWindows();
          windows.forEach((window) => {
            window.webContents.send('toggle-force-ignore-mouse');
          });
        },
      },
    ]);

    this.tray.setToolTip('yourAiRoommate');
    this.tray.setContextMenu(contextMenu);
  }

  private getContextMenuItems(event: Electron.IpcMainEvent): MenuItemConstructorOptions[] {
    const template: MenuItemConstructorOptions[] = [
      {
        label: 'Exit',
        click: () => {
          app.quit();
        },
      },
      {
        label: 'Hide',
        click: () => {
          const windows = BrowserWindow.getAllWindows();
          windows.forEach((window) => {
            window.hide();
          });
        },
      },
      {
        label: 'New Chat',
        click: () => {
          event.sender.send('new-chat');
        },
      },
      {
        label: 'Interrupt',
        click: () => {
          event.sender.send('interrupt');
        },
      },
      {
        label: 'Switch Model',
        submenu: this.configFiles.map((config) => ({
          label: config.name,
          click: () => {
            event.sender.send('switch-character', config.filename);
          },
        })),
      },
      {
        label: 'Toggle Microphone',
        click: () => {
          event.sender.send('mic-toggle');
        },
      },
      {
        label: 'Toggle Mouse Passthrough',
        click: () => {
          event.sender.send('toggle-force-ignore-mouse');
        },
      },
      {
        label: 'Toggle Scrolling to Resize',
        click: () => {
          event.sender.send('toggle-scroll-to-resize');
        },
      },
    ];
    return template;
  }

  private setupContextMenu(): void {
    ipcMain.on('show-context-menu', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        const screenPoint = screen.getCursorScreenPoint();
        const menu = Menu.buildFromTemplate(this.getContextMenuItems(event));
        menu.popup({
          window: win,
          x: Math.round(screenPoint.x),
          y: Math.round(screenPoint.y),
        });
      }
    });
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }

  updateConfigFiles(files: ConfigFile[]): void {
    this.configFiles = files;
  }
}
