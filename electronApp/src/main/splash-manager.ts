import { BrowserWindow } from 'electron';
// yourAiRoommate 🎭🪟🤖🥡✨🙋‍♂️🧙‍♂️🧑‍🚀🕵️🤖👻🐽🪟📘🎡🎓🪄🕯️🔦🗃️🎤🖱️👋🔳 yourAiRoommate 

export class SplashManager {
  private splash: BrowserWindow | null = null;

  createSplash(): BrowserWindow {
    this.splash = new BrowserWindow({
      width: 200,
      height: 190,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      center: true,
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

  async close(): Promise<void> {
    if (this.splash) {
      // await new Promise(resolve => setTimeout(resolve, 1500));
      this.splash.close();
      this.splash = null;
    }
  }

  getSplash(): BrowserWindow | null {
    return this.splash;
  }
}

