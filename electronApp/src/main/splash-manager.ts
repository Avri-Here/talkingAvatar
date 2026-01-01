import { BrowserWindow, screen, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
// yourAiRoommate 🎭🪟🤖🥡✨🙋‍♂️🧙‍♂️🧑‍🚀🕵️🤖👻🐽🪟📘🎡🎓🪄🕯️🔦🗃️🎤🖱️👋🔳 yourAiRoommate 

interface ModelPosition {
  x: number;
  y: number;
}

export class SplashManager {
  private splash: BrowserWindow | null = null;
  private positionFilePath: string;

  constructor() {
    this.positionFilePath = path.join(app.getPath('userData'), 'model-position.json');
  }

  private getSavedModelPosition(): ModelPosition | null {
    try {
      if (fs.existsSync(this.positionFilePath)) {
        const data = fs.readFileSync(this.positionFilePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[Splash] Failed to read saved position:', error);
    }
    return null;
  }

  private calculateScreenPosition(): { x: number; y: number } {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    
    const savedPosition = this.getSavedModelPosition();
    
    if (savedPosition) {
      // Convert model position (-1 to 1) to screen coordinates
      // Model position is in normalized coordinates where (0,0) is center
      const screenX = Math.round((width / 2) + (savedPosition.x * width / 2));
      const screenY = Math.round((height / 2) - (savedPosition.y * height / 2));
      
      // Center the splash on the model position
      const splashWidth = 200;
      const splashHeight = 190;
      
      return {
        x: Math.max(0, Math.min(screenX - splashWidth / 2, width - splashWidth)),
        y: Math.max(0, Math.min(screenY - splashHeight / 2, height - splashHeight))
      };
    }
    
    // Default to center if no saved position
    return {
      x: Math.round((width - 200) / 2),
      y: Math.round((height - 190) / 2)
    };
  }

  createSplash(): BrowserWindow {
    const position = this.calculateScreenPosition();
    
    this.splash = new BrowserWindow({
      width: 200,
      height: 190,
      // x: position.x,
      // y: position.y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      center: true, // Center the splash on the screen
      resizable: false,
      movable: true,
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
      user-select: none;
      -webkit-app-region: drag;

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
      padding: 15px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      width: 180px;
      -webkit-app-region: drag;
    }
    .logo-container {
      margin-bottom: 15px;
      animation: fadeIn 0.8s ease-in;
    }
    .logo {
      cursor: progress;
      font-size: 60px;
      margin-left: 15px;
      margin-right: 15px;
      margin-bottom: 22px;
      animation: pulse 3s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .loader {
      height: 7px;
      margin-left: 22px;
      margin-right: 22px;
      background: rgba(54, 46, 46, 0.25);
      border-radius: 7px;
      overflow: hidden;
    }
    .loader-bar {
      height: 100%;
      background: linear-gradient(90deg, rgba(255,255,255,0.8), white, rgba(255,255,255,0.8));
      border-radius: 9px;
      animation: loading 1.8s ease-in-out infinite;
    }
    @keyframes loading {
      0% { width: 0%; margin-left: 0%; }
      50% { width: 60%; margin-left: 20%; }
      100% { width: 0%; margin-left: 100%; }
    }
    .version {
      color: rgba(8, 13, 17, 0.6);
      font-size: 15px;
      font-weight: bolder;
      margin-top: 18px;
      text-align: center;
      line-height: 1.1;
      text-shadow: 0 1px 1px rgba(0,0,0,0.3);
      font-family: 'Arial', sans-serif;
    }
  </style>
</head>
<body>
  <div class="splash-container">
    <div class="logo-container">
      <div class="logo">🪟</div>
    </div>
    <div class="loader">
      <div class="loader-bar"></div>
    </div>
    <div class="version">v1.2.1</div>
  </div>
  <script>
    const { ipcRenderer } = require('electron');
    ipcRenderer.on('splash-status', (event, message) => {
      console.log('[Splash] Status:', message);
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
      console.log('[Splash] Status updated:', message);
    }
  }

  async close(): Promise<void> {
    if (this.splash) {
      await new Promise(resolve => setTimeout(resolve, 700));
      this.splash.close();
      this.splash = null;
    }
  }

  getSplash(): BrowserWindow | null {
    return this.splash;
  }

  saveModelPosition(position: ModelPosition): void {
    try {
      fs.writeFileSync(this.positionFilePath, JSON.stringify(position, null, 2));
      console.log('[Splash] Model position saved:', position);
    } catch (error) {
      console.error('[Splash] Failed to save model position:', error);
    }
  }
}

