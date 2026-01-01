import { app, ipcMain, globalShortcut, desktopCapturer, dialog } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import { WindowManager } from "./window-manager";
import { MenuManager } from "./menu-manager";
import { PythonServerManager } from "./python-server-manager";
import { SplashManager } from "./splash-manager";

let windowManager: WindowManager;
let menuManager: MenuManager;
let pythonServer: PythonServerManager;
let splashManager: SplashManager;
let isQuitting = false;

function setupIPC(): void {
  ipcMain.handle("get-platform", () => process.platform);

  ipcMain.on("set-ignore-mouse-events", (_event, ignore: boolean) => {
    const window = windowManager.getWindow();
    if (window) {
      windowManager.setIgnoreMouseEvents(ignore);
    }
  });

  ipcMain.on("get-current-mode", (event) => {
    event.returnValue = windowManager.getCurrentMode();
  });

  ipcMain.on("pre-mode-changed", (_event, newMode) => {
    if (newMode === 'window' || newMode === 'pet') {
      menuManager.setMode(newMode);
    }
  });

  ipcMain.on("window-minimize", () => {
    windowManager.getWindow()?.minimize();
  });

  ipcMain.on("window-maximize", () => {
    const window = windowManager.getWindow();
    if (window) {
      windowManager.maximizeWindow();
    }
  });

  ipcMain.on("window-close", () => {
    const window = windowManager.getWindow();
    if (window) {
      if (process.platform === "darwin") {
        window.hide();
      } else {
        window.close();
      }
    }
  });

  ipcMain.on(
    "update-component-hover",
    (_event, componentId: string, isHovering: boolean) => {
      windowManager.updateComponentHover(componentId, isHovering);
    },
  );

  ipcMain.handle("get-config-files", () => {
    const configFiles = JSON.parse(localStorage.getItem("configFiles") || "[]");
    menuManager.updateConfigFiles(configFiles);
    return configFiles;
  });

  ipcMain.on("update-config-files", (_event, files) => {
    menuManager.updateConfigFiles(files);
  });

  ipcMain.handle('get-screen-capture', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    return sources[0].id;
  });

  ipcMain.handle('get-server-status', () => {
    return pythonServer.getStatus();
  });

  ipcMain.handle('get-server-url', () => {
    return pythonServer.getServerUrl();
  });
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId("com.electron");

  splashManager = new SplashManager();
  splashManager.createSplash();
  
  pythonServer = new PythonServerManager();
  
  console.log('[Main] Starting Python server...');
  splashManager.updateStatus('Initializing Python environment...');
  
  try {
    await pythonServer.start();
    console.log('[Main] Python server started successfully');
    splashManager.updateStatus('Server ready ! Loading interface ...');
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    console.error('[Main] Failed to start Python server:', error);
    splashManager.close();
    
    const result = await dialog.showMessageBox({
      type: 'error',
      title: 'Server Error',
      message: 'Failed to start Python server',
      detail: `Error: ${error}\n\nThe application may not work correctly. Do you want to continue?`,
      buttons: ['Exit', 'Continue Anyway'],
      defaultId: 0
    });
    
    if (result.response === 0) {
      app.quit();
      return;
    }
  }

  windowManager = new WindowManager();
  menuManager = new MenuManager((mode) => windowManager.setWindowMode(mode));

  const window = windowManager.createWindow({
    titleBarOverlay: {
      color: "#111111",
      symbolColor: "#FFFFFF",
      height: 30,
    },
  });
  menuManager.createTray();

  window.once('ready-to-show', () => {
    splashManager.close();
  });

  window.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      window.hide();
    }
    return false;
  });

  // if (process.env.NODE_ENV === "development") {
  //   globalShortcut.register("F12", () => {
  //     const window = windowManager.getWindow();
  //     if (!window) return;

  //     if (window.webContents.isDevToolsOpened()) {
  //       window.webContents.closeDevTools();
  //     } else {
  //       window.webContents.openDevTools();
  //     }
  //   });
  // }

  setupIPC();

  app.on("activate", () => {
    const window = windowManager.getWindow();
    if (window) {
      window.show();
    }
  });

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  app.on('web-contents-created', (_, contents) => {
    contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media') {
        callback(true);
      } else {
        callback(false);
      }
    });
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  isQuitting = true;
  menuManager.destroy();
  globalShortcut.unregisterAll();
  
  if (pythonServer) {
    console.log('[Main] Stopping Python server...');
    await pythonServer.stop();
  }
});
