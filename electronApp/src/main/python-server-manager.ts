import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { app } from 'electron';
import * as http from 'http';

export interface ServerConfig {
  host: string;
  port: number;
  maxStartupTime: number;
}

export class PythonServerManager {
  private serverProcess: ChildProcess | null = null;
  private config: ServerConfig;
  private serverPath: string;
  private isStarting = false;
  private isRunning = false;

  constructor(config?: Partial<ServerConfig>) {
    this.config = {
      host: 'localhost',
      port: 12393,
      maxStartupTime: 60000,
      ...config
    };

    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    
    if (isDev) {
      this.serverPath = join(app.getAppPath(), '..', 'serverHere');
    } else {
      this.serverPath = join(process.resourcesPath, 'serverHere');
    }
  }

  async start(): Promise<void> {
    if (this.isStarting || this.isRunning) {
      console.log('[Python Server] Already starting or running');
      return;
    }

    this.isStarting = true;
    console.log('[Python Server] Starting server...');
    console.log('[Python Server] Server path:', this.serverPath);

    try {
      await this.checkIfAlreadyRunning();
      
      if (this.isRunning) {
        console.log('[Python Server] Server already running, connecting to existing instance');
        this.isStarting = false;
        return;
      }

      await this.startServerProcess();
      await this.waitForServerReady();
      
      this.isRunning = true;
      this.isStarting = false;
      console.log('[Python Server] Server started successfully');
    } catch (error) {
      this.isStarting = false;
      this.isRunning = false;
      console.error('[Python Server] Failed to start:', error);
      throw error;
    }
  }

  private async checkIfAlreadyRunning(): Promise<void> {
    try {
      const isHealthy = await this.checkHealth();
      if (isHealthy) {
        this.isRunning = true;
        console.log('[Python Server] Found existing server instance');
      }
    } catch {
      // Server not running, that's fine !
    }
  }

  private async startServerProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'cmd.exe' : 'sh';
      const args = isWindows 
        ? ['/c', 'uv', 'run', 'run_server.py']
        : ['-c', 'uv run run_server.py'];

      console.log('[Python Server] Executing:', command, args.join(' '));
      console.log('[Python Server] Working directory:', this.serverPath);

      this.serverProcess = spawn(command, args, {
        cwd: this.serverPath,
        shell: true,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1'
        }
      });

      this.serverProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        console.log(`[Python Server]: ${output.trim()}`);
        
        if (output.includes('Starting server') || output.includes('Uvicorn running')) {
          resolve();
        }
      });

      this.serverProcess.stderr?.on('data', (data: Buffer) => {
        const error = data.toString();
        console.error(`[Python Server Error]: ${error.trim()}`);
      });

      this.serverProcess.on('error', (error: Error) => {
        console.error('[Python Server] Process error:', error);
        reject(error);
      });

      this.serverProcess.on('exit', (code: number | null) => {
        console.log(`[Python Server] Process exited with code ${code}`);
        this.isRunning = false;
        this.serverProcess = null;
      });

      setTimeout(() => resolve(), 5000);
    });
  }

  private async waitForServerReady(): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 1000;
    const maxAttempts = this.config.maxStartupTime / checkInterval;
    let attempts = 0;

    console.log('[Python Server] Waiting for server to be ready...');

    while (attempts < maxAttempts) {
      try {
        const isHealthy = await this.checkHealth();
        if (isHealthy) {
          console.log(`[Python Server] Server ready after ${Date.now() - startTime}ms`);
          return;
        }
      } catch (error) {
        // Server not ready yet, continue waiting !
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
      attempts++;
      
      if (attempts % 5 === 0) {
        console.log(`[Python Server] Still waiting... (${attempts}/${maxAttempts} attempts)`);
      }
    }

    throw new Error(`Server failed to start within ${this.config.maxStartupTime}ms`);
  }

  async checkHealth(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://${this.config.host}:${this.config.port}/`, (res) => {
        resolve(res.statusCode === 200 || res.statusCode === 404);
      });

      req.on('error', () => {
        resolve(false);
      });

      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.serverProcess) {
      console.log('[Python Server] No server process to stop');
      return;
    }

    console.log('[Python Server] Stopping server...');

    return new Promise((resolve) => {
      if (!this.serverProcess) {
        resolve();
        return;
      }

      this.serverProcess.on('exit', () => {
        console.log('[Python Server] Server stopped');
        this.isRunning = false;
        this.serverProcess = null;
        resolve();
      });

      const isWindows = process.platform === 'win32';
      
      if (isWindows) {
        spawn('taskkill', ['/pid', this.serverProcess.pid!.toString(), '/f', '/t']);
      } else {
        this.serverProcess.kill('SIGTERM');
      }

      setTimeout(() => {
        if (this.serverProcess) {
          console.log('[Python Server] Force killing server process');
          this.serverProcess.kill('SIGKILL');
        }
        resolve();
      }, 5000);
    });
  }

  getStatus(): { isRunning: boolean; isStarting: boolean } {
    return {
      isRunning: this.isRunning,
      isStarting: this.isStarting
    };
  }

  getServerUrl(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }
}

