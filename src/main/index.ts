/**
 * ByteCave Desktop - Electron Main Process
 * GUI wrapper for bytecave-core storage node
 */

import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import Store from 'electron-store';

interface NodeConfig {
  nodeId: string;
  dataDir: string;
  port: number;
  p2pEnabled: boolean;
  p2pListenAddresses: string[];
  maxStorageMB: number;
  ownerAddress?: string;
}

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let nodeProcess: ChildProcess | null = null;
let nodeRunning = false;

// Get config from environment (for multi-instance testing) or use defaults
const envPort = process.env.BYTECAVE_PORT ? parseInt(process.env.BYTECAVE_PORT) : 3004;
const envNodeId = process.env.BYTECAVE_NODE_ID || `bytecave-${Date.now()}`;
const envP2pPorts = process.env.BYTECAVE_P2P_PORTS?.split(',') || ['4001', '4002'];

// Default config
const defaultConfig: NodeConfig = {
  nodeId: envNodeId,
  dataDir: path.join(os.homedir(), '.bytecave'),
  port: envPort,
  p2pEnabled: true,
  p2pListenAddresses: [
    `/ip4/0.0.0.0/tcp/${envP2pPorts[0]}`,
    `/ip4/0.0.0.0/tcp/${envP2pPorts[1] || parseInt(envP2pPorts[0]) + 1}/ws`
  ],
  maxStorageMB: 1024
};

function getConfig(): NodeConfig {
  return {
    ...defaultConfig,
    ...store.get('nodeConfig', {}) as Partial<NodeConfig>
  };
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a2e',
    show: false
  });

  // Load the renderer
  // electron-vite sets ELECTRON_RENDERER_URL in dev mode
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin') {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray(): void {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show ByteCave', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Start Node', click: () => startNode() },
    { label: 'Stop Node', click: () => stopNode() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);

  tray.setToolTip('ByteCave');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    mainWindow?.show();
  });
}

/**
 * Get the path to bytecave-core server
 */
function getBytecaveCorePath(): string {
  // __dirname in dev: /Users/.../bytecave-desktop/dist/main
  // We need to go up to hashd/ then into bytecave-core/
  const corePath = path.resolve(__dirname, '..', '..', '..', 'bytecave-core');
  console.log('[DEBUG] __dirname:', __dirname);
  console.log('[DEBUG] bytecave-core path:', corePath);
  return corePath;
}

/**
 * Start the bytecave-core node as a child process
 */
async function startNode(): Promise<void> {
  console.log('[startNode] Called');
  
  if (nodeProcess) {
    console.log('[startNode] Node already running');
    return;
  }

  const config = getConfig();
  console.log('[startNode] Config:', JSON.stringify(config, null, 2));
  
  const corePath = getBytecaveCorePath();

  // Set environment variables for bytecave-core
  const env = {
    ...process.env,
    NODE_ID: config.nodeId,
    DATA_DIR: config.dataDir,
    PORT: String(config.port),
    NODE_URL: `http://localhost:${config.port}`,
    P2P_ENABLED: String(config.p2pEnabled),
    P2P_LISTEN_ADDRESSES: config.p2pListenAddresses.join(','),
    GC_MAX_STORAGE_MB: String(config.maxStorageMB),
    OWNER_ADDRESS: config.ownerAddress || ''
  };

  console.log(`Starting bytecave-core from: ${corePath}`);

  // Spawn bytecave-core using tsx (for development) or node (for production)
  const isDevMode = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDevMode) {
    nodeProcess = spawn('npx', ['tsx', 'src/server.ts'], {
      cwd: corePath,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } else {
    nodeProcess = spawn('node', ['dist/server.js'], {
      cwd: corePath,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  }

  // Capture stdout with error handling
  nodeProcess.stdout?.on('data', (data: Buffer) => {
    try {
      const output = data.toString();
      console.log('[bytecave-core]', output);
      
      // Parse log output for events - check for various forms of the ready message
      if (output.includes('Server ready') || output.includes('ready for requests')) {
        console.log('[startNode] Detected server ready, setting nodeRunning=true');
        nodeRunning = true;
        mainWindow?.webContents.send('node:started', {
          port: config.port,
          nodeId: config.nodeId
        });
      }
      
      if (output.includes('P2P node started:')) {
        const match = output.match(/P2P node started: (\S+)/);
        if (match) {
          mainWindow?.webContents.send('node:p2p-started', {
            peerId: match[1]
          });
        }
      }

      if (output.includes('Peer connected via P2P')) {
        const match = output.match(/peerId":"([^"]+)"/);
        if (match) {
          mainWindow?.webContents.send('peer:connect', match[1]);
        }
      }
    } catch {
      // Ignore errors during shutdown
    }
  });

  // Capture stderr with error handling
  nodeProcess.stderr?.on('data', (data: Buffer) => {
    try {
      console.error('[bytecave-core error]', data.toString());
    } catch {
      // Ignore errors during shutdown
    }
  });

  // Handle process exit
  nodeProcess.on('exit', (code) => {
    console.log(`bytecave-core exited with code ${code}`);
    nodeProcess = null;
    nodeRunning = false;
    mainWindow?.webContents.send('node:stopped');
  });

  nodeProcess.on('error', (error) => {
    console.error('Failed to start bytecave-core:', error);
    nodeProcess = null;
    nodeRunning = false;
    mainWindow?.webContents.send('node:error', error.message);
  });
}

/**
 * Stop the bytecave-core node
 */
async function stopNode(): Promise<void> {
  if (!nodeProcess) {
    return;
  }

  return new Promise((resolve) => {
    nodeProcess!.on('exit', () => {
      nodeProcess = null;
      nodeRunning = false;
      mainWindow?.webContents.send('node:stopped');
      resolve();
    });

    // Send SIGTERM for graceful shutdown
    nodeProcess!.kill('SIGTERM');

    // Force kill after 5 seconds
    setTimeout(() => {
      if (nodeProcess) {
        nodeProcess.kill('SIGKILL');
      }
    }, 5000);
  });
}

/**
 * Get node status by calling the HTTP API
 */
async function getNodeStatus(): Promise<any> {
  if (!nodeRunning) {
    return { running: false };
  }

  const config = getConfig();
  try {
    const response = await fetch(`http://localhost:${config.port}/health`);
    if (response.ok) {
      const health = await response.json();
      return { running: true, ...health };
    }
  } catch {
    // Node not responding
  }
  
  return { running: nodeRunning, error: 'Node not responding' };
}

// IPC Handlers
ipcMain.handle('node:start', async () => {
  console.log('[IPC] node:start called');
  try {
    await startNode();
    console.log('[IPC] node:start completed');
    return { success: true };
  } catch (error) {
    console.error('[IPC] node:start error:', error);
    throw error;
  }
});

ipcMain.handle('node:stop', async () => {
  await stopNode();
  return { success: true };
});

ipcMain.handle('node:status', async () => {
  return getNodeStatus();
});

ipcMain.handle('node:peers', async () => {
  // Return empty array - peer list not yet implemented in bytecave-core HTTP API
  // The health endpoint only returns peer count, not peer details
  if (!nodeRunning) return [];
  return [];
});

ipcMain.handle('config:get', () => {
  return getConfig();
});

ipcMain.handle('config:set', (_event, newConfig: Partial<NodeConfig>) => {
  store.set('nodeConfig', { ...getConfig(), ...newConfig });
  return { success: true };
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // App lifecycle
  app.whenReady().then(() => {
    createWindow();
    createTray();

    // Auto-start node if configured
    if (store.get('autoStart', false)) {
      startNode();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else {
        mainWindow?.show();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await stopNode();
});
