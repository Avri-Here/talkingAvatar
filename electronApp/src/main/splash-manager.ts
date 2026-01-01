import { BrowserWindow } from 'electron';
import { join } from 'path';

export class SplashManager {
  private splash: BrowserWindow | null = null;

  createSplash(): BrowserWindow {
    this.splash = new BrowserWindow({
      width: 400,
      height: 300,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      center: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
    }
    .splash-container {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 20px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      width: 380px;
    }
    .logo {
      font-size: 48px;
      margin-bottom: 20px;
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    h1 {
      color: white;
      font-size: 24px;
      margin-bottom: 10px;
      font-weight: 600;
    }
    .status {
      color: rgba(255,255,255,0.9);
      font-size: 14px;
      margin-bottom: 25px;
      min-height: 20px;
    }
    .loader {
      width: 100%;
      height: 4px;
      background: rgba(255,255,255,0.2);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 15px;
    }
    .loader-bar {
      height: 100%;
      background: white;
      border-radius: 2px;
      animation: loading 1.5s ease-in-out infinite;
    }
    @keyframes loading {
      0% { width: 0%; margin-left: 0%; }
      50% { width: 50%; margin-left: 25%; }
      100% { width: 0%; margin-left: 100%; }
    }
    .version {
      color: rgba(255,255,255,0.7);
      font-size: 12px;
      margin-top: 15px;
    }
  </style>
</head>
<body>
  <div class="splash-container">
    <div class="logo">🎭</div>
    <h1>Open LLM VTuber</h1>
    <div class="status" id="status">Starting Python server...</div>
    <div class="loader">
      <div class="loader-bar"></div>
    </div>
    <div class="version">v1.2.1</div>
  </div>
  <script>
    const { ipcRenderer } = require('electron');
    
    ipcRenderer.on('splash-status', (_, message) => {
      document.getElementById('status').textContent = message;
    });
  </script>
</body>
</html>
    `;

    this.splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    
    return this.splash;
  }

  updateStatus(message: string): void {
    if (this.splash) {
      this.splash.webContents.send('splash-status', message);
    }
  }

  close(): void {
    if (this.splash) {
      this.splash.close();
      this.splash = null;
    }
  }

  getSplash(): BrowserWindow | null {
    return this.splash;
  }
}

