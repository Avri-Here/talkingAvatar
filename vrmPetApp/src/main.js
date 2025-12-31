const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let config;

// Load config
function loadConfig() {
  const configPath = path.join(__dirname, '../config.json');
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log('[Main] Config loaded:', config);
}

// IPC handler to provide config to renderer
ipcMain.handle('get-config', () => {
  console.log('[Main] Config requested by renderer');
  return config;
});

function createWindow() {
  loadConfig();
  
  mainWindow = new BrowserWindow({
    width: config.window.width,
    height: config.window.height,
    transparent: config.window.transparent,
    frame: false,
    alwaysOnTop: config.window.alwaysOnTop,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  
  // Start with mouse events enabled for dragging
  // We'll use CSS -webkit-app-region for dragging
  mainWindow.setIgnoreMouseEvents(false);

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
  
  // Open DevTools for debugging (remove in production)
  // mainWindow.webContents.openDevTools();
  
  // ESC to quit
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      console.log('[Main] ESC pressed, quitting...');
      app.quit();
    }
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  console.log('[Main] Window created');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // On macOS, apps typically stay open until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

console.log('[Main] Electron app starting...');

