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
      maxStartupTime: 600000,
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
    
    if (this.isStarting) {
      console.log('[Python Server] Already starting or running, skipping ...');
      return;
    }

    this.isStarting = true;
    console.log('[Python Server] Starting server...');
    console.log('[Python Server] Server path:', this.serverPath);

    try {
      // Always clean up any existing server to ensure we load fresh code
      console.log('[Python Server] Cleaning up any existing server instances...');
      await this.killExistingServer();
      await new Promise(resolve => setTimeout(resolve, 1000));

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

  private async killExistingServer(): Promise<void> {
    const isWindows = process.platform === 'win32';
    
    return new Promise((resolve) => {
      if (isWindows) {
        // Kill all processes on the specific port
        const findProcess = spawn('netstat', ['-ano']);
        let output = '';
        
        findProcess.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
        });
        
        findProcess.on('close', () => {
          const lines = output.split('\n');
          const portLine = lines.find(line => 
            line.includes(`:${this.config.port}`) && line.includes('LISTENING')
          );
          
          if (portLine) {
            const parts = portLine.trim().split(/\s+/);
            const pidMatch = parts[parts.length - 1];
            if (pidMatch && !isNaN(Number(pidMatch))) {
              console.log(`[Python Server] Killing process ${pidMatch} on port ${this.config.port}`);
              spawn('taskkill', ['/pid', pidMatch, '/f', '/t']);
            }
          }
          
          setTimeout(resolve, 2000);
        });

        findProcess.on('error', () => {
          console.log('[Python Server] No existing server found');
          resolve();
        });
      } else {
        // Unix-like systems
        const lsof = spawn('lsof', ['-ti', `:${this.config.port}`]);
        let pid = '';
        
        lsof.stdout?.on('data', (data: Buffer) => {
          pid += data.toString().trim();
        });
        
        lsof.on('close', () => {
          if (pid) {
            console.log(`[Python Server] Killing process ${pid} on port ${this.config.port}`);
            spawn('kill', ['-9', pid]);
          }
          setTimeout(resolve, 2000);
        });

        lsof.on('error', () => {
          console.log('[Python Server] No existing server found');
          resolve();
        });
      }
    });
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
        console.error(`server err -  ${error.trim()}`);
      });

      this.serverProcess.on('error', (error: Error) => {
        console.error('server err -  Process error:', error);
        reject(error);
      });

      this.serverProcess.on('exit', (code: number | null) => {
        console.warn(`server err -  Process exited with code ${code}`);
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

      const processToKill = this.serverProcess;
      let hasExited = false;

      const onExit = () => {
        if (!hasExited) {
          hasExited = true;
          console.log('[Python Server] Server stopped');
          this.isRunning = false;
          this.serverProcess = null;
          resolve();
        }
      };

      processToKill.on('exit', onExit);

      const isWindows = process.platform === 'win32';
      
      if (isWindows && processToKill.pid) {
        spawn('taskkill', ['/pid', processToKill.pid.toString(), '/f', '/t'], {
          shell: false,
          windowsHide: true
        });
      } else {
        processToKill.kill('SIGTERM');
      }

      setTimeout(() => {
        if (!hasExited) {
          console.log('[Python Server] Force killing server process');
          if (isWindows && processToKill.pid) {
            spawn('taskkill', ['/pid', processToKill.pid.toString(), '/f', '/t'], {
              shell: false,
              windowsHide: true
            });
          }
          onExit();
        }
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

