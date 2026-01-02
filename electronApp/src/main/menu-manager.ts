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
  private currentConfigFilename: string = '';

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
        label: 'Toggle Passthrough',
        click: () => {
          const windows = BrowserWindow.getAllWindows();
          windows.forEach((window) => {
            window.webContents.send('toggle-force-ignore-mouse');
          });
        },
      },
      {
        label: 'Toggle DevTools',
        click: () => {

          const windows = BrowserWindow.getAllWindows();
          windows.forEach((window) => {

            if (!window) return;
            if (window.webContents.isDevToolsOpened()) {
              window.webContents.closeDevTools();
              return;
            };

            window.webContents.openDevTools({ mode: 'undocked' });
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
        label: 'Switch avatar',
        submenu: this.configFiles
          .filter((config, index, self) =>
            index === self.findIndex((c) => c.name.toLowerCase() === config.name.toLowerCase())
          )
          .filter((config) => config.filename !== this.currentConfigFilename)
          .map((config) => ({
            label: config.name,
            click: () => {
              event.sender.send('switch-character', config.filename);
            },
          })),
      },
      {
        label: 'Toggle freeVoiceChat',
        click: () => {
          event.sender.send('micToggle');
        },
      },
      {
        label: 'Toggle passthrough',
        click: () => {
          event.sender.send('toggle-force-ignore-mouse');
        },
      },
      {
        label: 'Toggle resize avatar',
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

  setCurrentConfigFilename(filename: string): void {
    this.currentConfigFilename = filename;
  }
}
