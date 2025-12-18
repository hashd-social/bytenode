/**
 * ByteCave Desktop - Electron Main Process
 * GUI wrapper for bytecave-core storage node
 */

import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import Store from 'electron-store';

interface ShardRange {
  start: number;
  end: number;
}

interface NodeConfig {
  nodeId: string;
  dataDir: string;
  port: number;
  p2pEnabled: boolean;
  p2pListenAddresses: string[];
  p2pBootstrapPeers: string[];
  p2pRelayPeers: string[];
  p2pEnableRelay: boolean;
  p2pEnableDHT: boolean;
  p2pEnableMDNS: boolean;
  maxStorageMB: number;
  shardCount: number;
  nodeShards: ShardRange[];
  ownerAddress?: string;
  publicKey?: string;
  contentTypes?: string; // 'all' or 'messages,posts,media,listings'
}

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let nodeProcess: ChildProcess | null = null;
let nodeRunning = false;

// Get config from environment (for multi-instance testing) or use defaults
const envPort = process.env.BYTENODE_PORT ? parseInt(process.env.BYTENODE_PORT) : 5001;
const envNodeId = process.env.BYTENODE_NODE_ID || `bytecave-${Date.now()}`;
const envDataDir = process.env.BYTENODE_DATA_DIR || path.join(os.homedir(), '.bytecave');
const envP2pPorts = process.env.BYTENODE_P2P_PORTS?.split(',') || ['4001', '4002'];
const envRelayPeers = process.env.BYTENODE_RELAY_PEERS?.split(',') || [];
const envBootstrapPeers = process.env.BYTENODE_BOOTSTRAP_PEERS?.split(',') || [];

// Default config
const defaultConfig: NodeConfig = {
  nodeId: envNodeId,
  dataDir: envDataDir,
  port: envPort,
  p2pEnabled: true,
  p2pListenAddresses: [
    `/ip4/0.0.0.0/tcp/${envP2pPorts[0]}`,
    `/ip4/0.0.0.0/tcp/${envP2pPorts[1] || parseInt(envP2pPorts[0]) + 1}/ws`
  ],
  p2pBootstrapPeers: envBootstrapPeers,
  p2pRelayPeers: envRelayPeers,
  p2pEnableRelay: true,
  p2pEnableDHT: true,
  p2pEnableMDNS: true,
  maxStorageMB: 1024,
  shardCount: 1024,
  nodeShards: [{ start: 0, end: 1023 }]
};

function getConfig(): NodeConfig {
  // In multi-instance mode, prioritize environment variables over stored config
  const isMultiInstance = !!process.env.BYTENODE_PORT;
  
  if (isMultiInstance) {
    // Use environment variables directly, don't merge with stored config
    return defaultConfig;
  }
  
  // Normal mode: merge stored config with defaults
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
    P2P_BOOTSTRAP_PEERS: config.p2pBootstrapPeers.join(','),
    P2P_RELAY_PEERS: config.p2pRelayPeers.join(','),
    P2P_ENABLE_RELAY: String(config.p2pEnableRelay),
    GC_MAX_STORAGE_MB: String(config.maxStorageMB),
    SHARD_COUNT: String(config.shardCount),
    NODE_SHARDS: JSON.stringify(config.nodeShards),
    OWNER_ADDRESS: config.ownerAddress || '',
    PUBLIC_KEY: config.publicKey || '',
    CONTENT_TYPES: config.contentTypes || 'all'
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
  if (!nodeRunning) return [];
  
  const config = getConfig();
  try {
    const response = await fetch(`http://localhost:${config.port}/peers`);
    const data = await response.json();
    return data.peers || [];
  } catch (error: any) {
    console.error('[IPC] Failed to fetch peers:', error.message);
    return [];
  }
});

ipcMain.handle('config:get', () => {
  return getConfig();
});

ipcMain.handle('config:getRelayPeers', () => {
  const config = getConfig();
  return config.p2pRelayPeers || [];
});

ipcMain.handle('config:set', (_event, newConfig: Partial<NodeConfig>) => {
  store.set('nodeConfig', { ...getConfig(), ...newConfig });
  return { success: true };
});

ipcMain.handle('peer:connect', async (_event, multiaddr: string) => {
  if (!nodeRunning) {
    return { success: false, error: 'Node not running' };
  }

  const config = getConfig();
  try {
    const response = await fetch(`http://localhost:${config.port}/peers/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ multiaddr })
    });
    
    const result = await response.json();
    return result;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Node Policy IPC Handlers
ipcMain.handle('policy:get-blocked-content', async () => {
  const config = getConfig();
  const blockedContentPath = path.join(config.dataDir, 'config', 'blocked-content.json');
  try {
    const fs = await import('fs/promises');
    const content = await fs.readFile(blockedContentPath, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return { version: 1, updatedAt: Date.now(), cids: [], peerIds: [] };
    }
    throw error;
  }
});

ipcMain.handle('policy:block-cid', async (_event, cid: string) => {
  const config = getConfig();
  const blockedContentPath = path.join(config.dataDir, 'config', 'blocked-content.json');
  const fs = await import('fs/promises');
  
  try {
    const content = await fs.readFile(blockedContentPath, 'utf-8').catch(() => '{"version":1,"updatedAt":0,"cids":[],"peerIds":[]}');
    const blocked = JSON.parse(content);
    if (!blocked.cids.includes(cid.toLowerCase())) {
      blocked.cids.push(cid.toLowerCase());
      blocked.updatedAt = Date.now();
      await fs.mkdir(path.dirname(blockedContentPath), { recursive: true });
      await fs.writeFile(blockedContentPath, JSON.stringify(blocked, null, 2));
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('policy:unblock-cid', async (_event, cid: string) => {
  const config = getConfig();
  const blockedContentPath = path.join(config.dataDir, 'config', 'blocked-content.json');
  const fs = await import('fs/promises');
  
  try {
    const content = await fs.readFile(blockedContentPath, 'utf-8');
    const blocked = JSON.parse(content);
    const index = blocked.cids.indexOf(cid.toLowerCase());
    if (index > -1) {
      blocked.cids.splice(index, 1);
      blocked.updatedAt = Date.now();
      await fs.writeFile(blockedContentPath, JSON.stringify(blocked, null, 2));
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('policy:block-peer', async (_event, peerId: string) => {
  const config = getConfig();
  const blockedContentPath = path.join(config.dataDir, 'config', 'blocked-content.json');
  const fs = await import('fs/promises');
  
  try {
    const content = await fs.readFile(blockedContentPath, 'utf-8').catch(() => '{"version":1,"updatedAt":0,"cids":[],"peerIds":[]}');
    const blocked = JSON.parse(content);
    if (!blocked.peerIds.includes(peerId)) {
      blocked.peerIds.push(peerId);
      blocked.updatedAt = Date.now();
      await fs.mkdir(path.dirname(blockedContentPath), { recursive: true });
      await fs.writeFile(blockedContentPath, JSON.stringify(blocked, null, 2));
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('policy:unblock-peer', async (_event, peerId: string) => {
  const config = getConfig();
  const blockedContentPath = path.join(config.dataDir, 'config', 'blocked-content.json');
  const fs = await import('fs/promises');
  
  try {
    const content = await fs.readFile(blockedContentPath, 'utf-8');
    const blocked = JSON.parse(content);
    const index = blocked.peerIds.indexOf(peerId);
    if (index > -1) {
      blocked.peerIds.splice(index, 1);
      blocked.updatedAt = Date.now();
      await fs.writeFile(blockedContentPath, JSON.stringify(blocked, null, 2));
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('policy:get-guilds', async () => {
  const config = getConfig();
  const guildsPath = path.join(config.dataDir, 'config', 'guilds.json');
  try {
    const fs = await import('fs/promises');
    const content = await fs.readFile(guildsPath, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return { allowedGuilds: 'all', blockedGuilds: [] };
    }
    throw error;
  }
});

ipcMain.handle('policy:set-guilds', async (_event, guildsConfig: any) => {
  const config = getConfig();
  const guildsPath = path.join(config.dataDir, 'config', 'guilds.json');
  const fs = await import('fs/promises');
  
  try {
    await fs.mkdir(path.dirname(guildsPath), { recursive: true });
    await fs.writeFile(guildsPath, JSON.stringify(guildsConfig, null, 2));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Prevent multiple instances (unless in multi-instance mode for testing)
const isMultiInstance = !!process.env.BYTENODE_PORT;

if (!isMultiInstance) {
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
  }
}

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await stopNode();
});
