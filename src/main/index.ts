/**
 * ByteCave Desktop - Electron Main Process
 * GUI wrapper for bytecave-core storage node
 */

import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import Store from 'electron-store';
import { ethers } from 'ethers';

interface ShardRange {
  start: number;
  end: number;
}

interface NodeConfig {
  // Node Configuration
  nodeId: string;
  dataDir: string;
  port: number;
  nodeUrl?: string;
  
  // Identity
  ownerAddress?: string;
  walletPrivateKey?: string;
  publicKey?: string;
  
  // P2P Configuration
  p2pEnabled: boolean;
  p2pListenAddresses: string[];
  p2pBootstrapPeers: string[];
  p2pRelayPeers: string[];
  p2pEnableRelay: boolean;
  p2pEnableDHT: boolean;
  p2pEnableMDNS: boolean;
  
  // Sharding
  shardCount: number;
  nodeShards: ShardRange[];
  
  // Garbage Collection
  gcEnabled?: boolean;
  gcRetentionMode?: 'size' | 'time' | 'hybrid';
  gcMaxStorageMB?: number;
  gcMaxBlobAgeDays?: number;
  gcMinFreeDiskMB?: number;
  gcReservedForPinnedMB?: number;
  gcIntervalMinutes?: number;
  gcVerifyReplicas?: boolean;
  gcVerifyProofs?: boolean;
  
  // Storage Configuration
  maxStorageMB: number;
  maxBlobSizeMB?: number;
  maxStorageGB?: number;
  
  // Replication Configuration
  replicationEnabled?: boolean;
  replicationTimeoutMs?: number;
  replicationFactor?: number;
  
  // Security
  enableBlockedContent?: boolean;
  allowedApps?: string[];
  requireAppRegistry?: boolean;
  
  // Contract Integration
  rpcUrl?: string;
  registryAddress?: string;
  
  // Performance
  cacheSizeMB?: number;
  compressionEnabled?: boolean;
  
  // Monitoring
  metricsEnabled?: boolean;
  logLevel?: string;
}

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let nodeProcess: ChildProcess | null = null;
let nodeRunning = false;

// Get config from environment (for multi-instance testing) or use defaults
const envPort = process.env.BYTENODE_PORT ? parseInt(process.env.BYTENODE_PORT) : 5001;
const envNodeId = process.env.BYTENODE_NODE_ID || 'bat-alpha'; // Default to bat-alpha for normal desktop app usage
const envP2pPorts = process.env.BYTENODE_P2P_PORTS?.split(',') || ['5011', '5012'];
const envRelayPeers = process.env.BYTENODE_RELAY_PEERS?.split(',') || [];
const envBootstrapPeers = process.env.BYTENODE_BOOTSTRAP_PEERS?.split(',') || [];

// Data directory: if BYTENODE_DATA_DIR is set, use it as-is (already includes nodeId)
// Otherwise, create path with nodeId subfolder: e.g., ~/.bytecave/bat-alpha
const envDataDir = process.env.BYTENODE_DATA_DIR 
  ? process.env.BYTENODE_DATA_DIR
  : path.join(os.homedir(), '.bytecave', envNodeId);

// Default config
const defaultConfig: NodeConfig = {
  nodeId: envNodeId,
  dataDir: envDataDir,
  port: envPort,
  ownerAddress: process.env.OWNER_ADDRESS || '',
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY || '',
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
  nodeShards: [{ start: 0, end: 1023 }],
  rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
  registryAddress: process.env.VAULT_REGISTRY_ADDRESS || ''
};

function getConfig(): NodeConfig {
  // Start with defaults from environment
  let config = { ...defaultConfig };
  console.log('[Config] Starting with defaults - dataDir:', config.dataDir, 'maxStorageMB:', config.maxStorageMB);
  
  // Ensure dataDir includes nodeId subfolder
  const pathParts = config.dataDir.split(path.sep);
  const lastPart = pathParts[pathParts.length - 1];
  const baseDataDir = lastPart === config.nodeId
    ? config.dataDir 
    : path.join(config.dataDir, config.nodeId);
  config.dataDir = baseDataDir;
  console.log('[Config] After path adjustment - dataDir:', config.dataDir);
  
  // ALWAYS load from config.json if it exists (single source of truth)
  // This applies to both normal mode and multi-instance mode
  try {
    const configJsonPath = path.join(config.dataDir, 'config.json');
    console.log('[Config] Looking for config.json at:', configJsonPath);
    console.log('[Config] File exists?', fs.existsSync(configJsonPath));
    
    // NOTE: We no longer create or manage config.json here
    // bytecave-core will create and manage config.json with all fields
    // Desktop app just reads it for display purposes
    if (fs.existsSync(configJsonPath)) {
      const data = fs.readFileSync(configJsonPath, 'utf8');
      const persistedConfig = JSON.parse(data);
      
      console.log('[Config] Found config.json created by bytecave-core');
      console.log('[Config] maxStorageMB:', persistedConfig.maxStorageMB);
      console.log('[Config] bootstrap peers:', persistedConfig.p2pBootstrapPeers?.length || 0);
      
      // Merge with persisted config for display
      config = {
        ...config,
        ...persistedConfig,
        // Ensure these critical paths stay correct
        dataDir: config.dataDir
      };
    } else {
      console.log('[Config] config.json does not exist yet - will be created by bytecave-core on first start');
    }
  } catch (error) {
    console.warn('[Config] Failed to load config.json:', error);
  }
  
  console.log('[Config] Returning config with maxStorageMB:', config.maxStorageMB);
  return config;
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
    PRIVATE_KEY: config.walletPrivateKey || '',
    PUBLIC_KEY: config.publicKey || '',
    RPC_URL: config.rpcUrl || '',
    VAULT_REGISTRY_ADDRESS: config.registryAddress || ''
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
    console.log('[stopNode] No node process to stop');
    return;
  }

  console.log('[stopNode] Stopping node process...');

  return new Promise((resolve) => {
    const pid = nodeProcess!.pid;
    
    const exitHandler = () => {
      console.log('[stopNode] Node process exited');
      nodeProcess = null;
      nodeRunning = false;
      mainWindow?.webContents.send('node:stopped');
      
      // Wait a bit for ports to be released before resolving
      setTimeout(() => {
        console.log('[stopNode] Ports should be released now');
        resolve();
      }, 1000);
    };

    nodeProcess!.once('exit', exitHandler);

    // Send SIGTERM for graceful shutdown
    console.log('[stopNode] Sending SIGTERM to PID', pid);
    nodeProcess!.kill('SIGTERM');

    // Force kill after 3 seconds (reduced from 5)
    setTimeout(() => {
      if (nodeProcess && pid) {
        console.log('[stopNode] Process still running, sending SIGKILL to PID', pid);
        try {
          // Kill the entire process group to ensure child processes are killed
          process.kill(-pid, 'SIGKILL');
        } catch (error) {
          console.log('[stopNode] Failed to kill process group, trying direct kill');
          nodeProcess.kill('SIGKILL');
        }
      }
    }, 3000);
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

ipcMain.handle('node:register', async () => {
  if (!nodeRunning) {
    return { success: false, error: 'Node is not running' };
  }
  
  const config = getConfig();
  
  try {
    // Get peer ID from health endpoint
    const healthResponse = await fetch(`http://localhost:${config.port}/health`);
    const health = await healthResponse.json();
    
    const peerId = health.peerId;
    
    if (!peerId) {
      return { success: false, error: 'Could not get peer ID from node' };
    }
    
    // Get public key from P2P status endpoint (has raw libp2p public key)
    const peersResponse = await fetch(`http://localhost:${config.port}/peers`);
    const peersData = await peersResponse.json();
    
    // The node's own public key should be available from the P2P service
    // We need to extract it from the peer ID using libp2p
    // For now, we'll derive it from the peer ID which encodes the public key
    
    // PeerID format: base58(multihash(protobuf(publicKey)))
    // We need to reverse this to get the raw public key
    // The peerId contains the public key, we need to extract it
    
    // Import libp2p peer-id to extract public key
    const { peerIdFromString } = await import('@libp2p/peer-id');
    const peerIdObj = peerIdFromString(peerId);
    
    if (!peerIdObj.publicKey) {
      return { success: false, error: 'Could not extract public key from peer ID' };
    }
    
    // Get the protobuf-encoded public key
    const publicKeyProto = (peerIdObj.publicKey as any).raw;
    if (!publicKeyProto) {
      return { success: false, error: 'Could not get public key from peer ID' };
    }
    
    // For secp256k1 keys in libp2p protobuf format:
    // The structure is: [protobuf header] + [key type byte] + [key length varint] + [actual key bytes]
    // For a 33-byte compressed key, the protobuf is typically 36 bytes total
    // We need to extract just the 33-byte key (skip the 3-byte header)
    const protoBuffer = Buffer.from(publicKeyProto);
    
    console.log('[IPC] Public key proto length:', protoBuffer.length);
    
    // For secp256k1, skip the protobuf wrapper (typically 3-5 bytes at the start)
    // The actual key starts after: type tag (1 byte) + key type (1 byte) + length varint (1+ bytes)
    let keyBytes: Buffer;
    if (protoBuffer.length === 33 || protoBuffer.length === 65) {
      // Already just the key
      keyBytes = protoBuffer;
    } else if (protoBuffer.length === 36) {
      // 3-byte header + 33-byte key (typical for compressed secp256k1)
      keyBytes = protoBuffer.slice(3);
    } else if (protoBuffer.length === 68) {
      // 3-byte header + 65-byte key (uncompressed)
      keyBytes = protoBuffer.slice(3);
    } else {
      // Try to find the key by looking for the 0x02 or 0x03 prefix (compressed) or 0x04 (uncompressed)
      let found = false;
      for (let i = 0; i < protoBuffer.length - 33; i++) {
        if (protoBuffer[i] === 0x02 || protoBuffer[i] === 0x03) {
          // Found compressed key prefix
          keyBytes = protoBuffer.slice(i, i + 33);
          found = true;
          break;
        } else if (protoBuffer[i] === 0x04 && protoBuffer.length >= i + 65) {
          // Found uncompressed key prefix
          keyBytes = protoBuffer.slice(i, i + 65);
          found = true;
          break;
        }
      }
      if (!found) {
        return { success: false, error: `Could not extract key from protobuf (length: ${protoBuffer.length})` };
      }
    }
    
    console.log('[IPC] Extracted key length:', keyBytes!.length);
    const publicKey = '0x' + keyBytes!.toString('hex');
    
    // Check if we have RPC URL and registry address
    // Force IPv4 to avoid IPv6 connection issues
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    const registryAddress = process.env.VAULT_REGISTRY_ADDRESS;
    
    console.log('[IPC] Registration config:', {
      rpcUrl,
      registryAddress: registryAddress?.slice(0, 10) + '...',
      hasPrivateKey: !!process.env.PRIVATE_KEY
    });
    
    if (!registryAddress) {
      return { success: false, error: 'VAULT_REGISTRY_ADDRESS not configured' };
    }
    
    // Check if we have private key from environment
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return { success: false, error: 'No wallet private key configured (PRIVATE_KEY env var)' };
    }
    
    // Connect to contract with explicit network config to avoid IPv6 issues
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
      staticNetwork: true,
      batchMaxCount: 1
    });
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Get HASHD token contract
    const hashdTokenAddress = process.env.HASHD_TOKEN || '0x7a2088a1bFc9d81c55368AE168C2C02570cB814F';
    const hashdAbi = [
      'function approve(address spender, uint256 amount) returns (bool)',
      'function allowance(address owner, address spender) view returns (uint256)'
    ];
    const hashd = new ethers.Contract(hashdTokenAddress, hashdAbi, wallet);
    
    const registryAbi = [
      'function registerNode(bytes publicKey, string peerId, bytes32 metadataHash, uint256 stakeAmount, bytes signature) returns (bytes32)',
      'function getNodeByOwner(address owner) view returns (bytes32)'
    ];
    const registry = new ethers.Contract(registryAddress, registryAbi, wallet);
    
    // Create metadata hash
    const metadata = {
      version: '1.0.0',
      capabilities: ['storage', 'replication'],
      timestamp: Date.now()
    };
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(metadata)));
    
    // Stake amount: 1000 HASHD tokens (minimum stake requirement)
    const stakeAmount = ethers.parseEther('1000');
    
    // Check if we need to approve tokens
    const currentAllowance = await hashd.allowance(wallet.address, registryAddress);
    if (currentAllowance < stakeAmount) {
      console.log('[IPC] Approving HASHD tokens for registry...');
      const approveTx = await hashd.approve(registryAddress, stakeAmount);
      await approveTx.wait();
      console.log('[IPC] Token approval confirmed');
      
      // Wait a bit for the blockchain to update
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Empty signature (not enforced yet)
    const emptySignature = '0x';
    
    console.log('[IPC] Registering node on-chain...', {
      peerId: peerId.slice(0, 16) + '...',
      publicKeyLength: publicKey.length,
      stakeAmount: stakeAmount.toString()
    });
    
    // Get fresh nonce to avoid nonce conflicts
    const nonce = await provider.getTransactionCount(wallet.address, 'latest');
    console.log('[IPC] Using nonce:', nonce);
    
    // Call registerNode with explicit nonce
    const tx = await registry.registerNode(
      publicKey,
      peerId,
      metadataHash,
      stakeAmount,
      emptySignature,
      { nonce }
    );
    
    console.log('[IPC] Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('[IPC] Transaction confirmed:', receipt.hash);
    
    return { success: true, txHash: receipt.hash };
  } catch (error: any) {
    console.error('[IPC] Failed to register node:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('node:deregister', async () => {
  if (!nodeRunning) {
    return { success: false, error: 'Node is not running' };
  }
  
  const config = getConfig();
  
  try {
    // Get peer ID from health endpoint
    const healthResponse = await fetch(`http://localhost:${config.port}/health`);
    const health = await healthResponse.json();
    const peerId = health.peerId;
    
    if (!peerId) {
      return { success: false, error: 'Could not get peer ID from node' };
    }
    
    // Extract public key from peer ID (same logic as registration)
    const { peerIdFromString } = await import('@libp2p/peer-id');
    const peerIdObj = peerIdFromString(peerId);
    
    if (!peerIdObj.publicKey) {
      return { success: false, error: 'Could not extract public key from peer ID' };
    }
    
    const publicKeyProto = (peerIdObj.publicKey as any).raw;
    if (!publicKeyProto) {
      return { success: false, error: 'Could not get public key from peer ID' };
    }
    
    const protoBuffer = Buffer.from(publicKeyProto);
    
    // Extract the actual key bytes (same logic as registration)
    let keyBytes: Buffer;
    if (protoBuffer.length === 33 || protoBuffer.length === 65) {
      keyBytes = protoBuffer;
    } else if (protoBuffer.length === 36) {
      keyBytes = protoBuffer.slice(3);
    } else if (protoBuffer.length === 68) {
      keyBytes = protoBuffer.slice(3);
    } else {
      let found = false;
      for (let i = 0; i < protoBuffer.length - 33; i++) {
        if (protoBuffer[i] === 0x02 || protoBuffer[i] === 0x03) {
          keyBytes = protoBuffer.slice(i, i + 33);
          found = true;
          break;
        } else if (protoBuffer[i] === 0x04 && protoBuffer.length >= i + 65) {
          keyBytes = protoBuffer.slice(i, i + 65);
          found = true;
          break;
        }
      }
      if (!found) {
        return { success: false, error: `Could not extract key from protobuf (length: ${protoBuffer.length})` };
      }
    }
    
    const publicKey = '0x' + keyBytes!.toString('hex');
    const nodeId = ethers.keccak256(publicKey);
    
    // Check if we have RPC URL and registry address
    // Force IPv4 to avoid IPv6 connection issues
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    const registryAddress = process.env.VAULT_REGISTRY_ADDRESS;
    
    if (!registryAddress) {
      return { success: false, error: 'VAULT_REGISTRY_ADDRESS not configured' };
    }
    
    // Check if we have private key from environment
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return { success: false, error: 'No wallet private key configured (PRIVATE_KEY env var)' };
    }
    
    // Connect to contract
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    const registryAbi = [
      'function deregisterNode(bytes32 nodeId) external',
      'function getNode(bytes32 nodeId) external view returns (tuple(address owner, bytes publicKey, string peerId, bytes32 metadataHash, uint256 registeredAt, bool active))'
    ];
    const registry = new ethers.Contract(registryAddress, registryAbi, wallet);
    
    // Check if node is actually registered on-chain
    try {
      const node = await registry.getNode(nodeId);
      if (node.owner === ethers.ZeroAddress) {
        console.log('[IPC] Node is not registered on-chain, skipping deregistration');
        return { success: true, message: 'Node is not registered on-chain, no deregistration needed' };
      }
    } catch (error) {
      console.log('[IPC] Node not found on-chain, skipping deregistration');
      return { success: true, message: 'Node is not registered on-chain, no deregistration needed' };
    }
    
    console.log('[IPC] Deregistering node from chain...', {
      nodeId: nodeId.slice(0, 16) + '...'
    });
    
    // Call deregisterNode
    const tx = await registry.deregisterNode(nodeId);
    
    console.log('[IPC] Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('[IPC] Transaction confirmed:', receipt.hash);
    
    return { success: true, txHash: receipt.hash };
  } catch (error: any) {
    console.error('[IPC] Failed to deregister node:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('config:get', () => {
  // getConfig() already reads from config.json as the source of truth
  const config = getConfig();
  console.log('[IPC] config:get - bootstrap peers:', config.p2pBootstrapPeers?.length || 0, 'maxStorageMB:', config.maxStorageMB);
  return config;
});

ipcMain.handle('config:getRelayPeers', () => {
  const config = getConfig();
  return config.p2pRelayPeers || [];
});

ipcMain.handle('config:set', async (_event, newConfig: Partial<NodeConfig>) => {
  console.log('[IPC] config:set called with:', { maxStorageMB: newConfig.maxStorageMB, port: newConfig.port });
  
  try {
    const config = getConfig();
    const configJsonPath = path.join(config.dataDir, 'config.json');
    console.log('[IPC] Will save to:', configJsonPath);
    
    const fs = await import('fs/promises');
    
    let persistedConfig: any = {};
    try {
      const data = await fs.readFile(configJsonPath, 'utf8');
      persistedConfig = JSON.parse(data);
      console.log('[IPC] Read existing config, maxStorageMB:', persistedConfig.maxStorageMB);
    } catch (err) {
      console.log('[IPC] No existing config, creating new');
    }
    
    // Update ALL settings that were changed
    if (newConfig.nodeId !== undefined) persistedConfig.nodeId = newConfig.nodeId;
    if (newConfig.port !== undefined) persistedConfig.port = newConfig.port;
    if (newConfig.maxStorageMB !== undefined) {
      console.log('[IPC] Updating maxStorageMB from', persistedConfig.maxStorageMB, 'to', newConfig.maxStorageMB);
      persistedConfig.maxStorageMB = newConfig.maxStorageMB;
    }
    if (newConfig.p2pBootstrapPeers !== undefined) persistedConfig.p2pBootstrapPeers = newConfig.p2pBootstrapPeers;
    if (newConfig.p2pRelayPeers !== undefined) persistedConfig.p2pRelayPeers = newConfig.p2pRelayPeers;
    if (newConfig.shardCount !== undefined) persistedConfig.shardCount = newConfig.shardCount;
    if (newConfig.nodeShards !== undefined) persistedConfig.nodeShards = newConfig.nodeShards;
    if (newConfig.ownerAddress !== undefined) persistedConfig.ownerAddress = newConfig.ownerAddress;
    if (newConfig.walletPrivateKey !== undefined) persistedConfig.walletPrivateKey = newConfig.walletPrivateKey;
    if (newConfig.publicKey !== undefined) persistedConfig.publicKey = newConfig.publicKey;
    
    // Garbage Collection
    if (newConfig.gcEnabled !== undefined) persistedConfig.gcEnabled = newConfig.gcEnabled;
    if (newConfig.gcRetentionMode !== undefined) persistedConfig.gcRetentionMode = newConfig.gcRetentionMode;
    if (newConfig.gcMaxStorageMB !== undefined) persistedConfig.gcMaxStorageMB = newConfig.gcMaxStorageMB;
    if (newConfig.gcMaxBlobAgeDays !== undefined) persistedConfig.gcMaxBlobAgeDays = newConfig.gcMaxBlobAgeDays;
    if (newConfig.gcMinFreeDiskMB !== undefined) persistedConfig.gcMinFreeDiskMB = newConfig.gcMinFreeDiskMB;
    if (newConfig.gcReservedForPinnedMB !== undefined) persistedConfig.gcReservedForPinnedMB = newConfig.gcReservedForPinnedMB;
    if (newConfig.gcIntervalMinutes !== undefined) persistedConfig.gcIntervalMinutes = newConfig.gcIntervalMinutes;
    if (newConfig.gcVerifyReplicas !== undefined) persistedConfig.gcVerifyReplicas = newConfig.gcVerifyReplicas;
    if (newConfig.gcVerifyProofs !== undefined) persistedConfig.gcVerifyProofs = newConfig.gcVerifyProofs;
    
    // Storage
    if (newConfig.maxBlobSizeMB !== undefined) persistedConfig.maxBlobSizeMB = newConfig.maxBlobSizeMB;
    if (newConfig.maxStorageGB !== undefined) persistedConfig.maxStorageGB = newConfig.maxStorageGB;
    
    // Replication
    if (newConfig.replicationEnabled !== undefined) persistedConfig.replicationEnabled = newConfig.replicationEnabled;
    if (newConfig.replicationTimeoutMs !== undefined) persistedConfig.replicationTimeoutMs = newConfig.replicationTimeoutMs;
    if (newConfig.replicationFactor !== undefined) persistedConfig.replicationFactor = newConfig.replicationFactor;
    
    // Security
    if (newConfig.enableBlockedContent !== undefined) persistedConfig.enableBlockedContent = newConfig.enableBlockedContent;
    if (newConfig.allowedApps !== undefined) persistedConfig.allowedApps = newConfig.allowedApps;
    if (newConfig.requireAppRegistry !== undefined) persistedConfig.requireAppRegistry = newConfig.requireAppRegistry;
    
    // Performance
    if (newConfig.cacheSizeMB !== undefined) persistedConfig.cacheSizeMB = newConfig.cacheSizeMB;
    if (newConfig.compressionEnabled !== undefined) persistedConfig.compressionEnabled = newConfig.compressionEnabled;
    
    // Monitoring
    if (newConfig.metricsEnabled !== undefined) persistedConfig.metricsEnabled = newConfig.metricsEnabled;
    if (newConfig.logLevel !== undefined) persistedConfig.logLevel = newConfig.logLevel;
    
    persistedConfig.lastUpdated = Date.now();
    
    console.log('[IPC] Writing config with maxStorageMB:', persistedConfig.maxStorageMB);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(configJsonPath), { recursive: true });
    
    // Write config.json
    await fs.writeFile(configJsonPath, JSON.stringify(persistedConfig, null, 2), 'utf8');
    console.log('[IPC] Successfully saved config to:', configJsonPath);
  } catch (error) {
    console.error('[IPC] Failed to save config:', error);
  }
  
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

// Node Policy IPC Handlers - Read/write directly to config.json like other settings
ipcMain.handle('policy:get-blocked-content', async () => {
  const config = getConfig();
  const configJsonPath = path.join(config.dataDir, 'config.json');
  
  try {
    const fs = await import('fs/promises');
    const content = await fs.readFile(configJsonPath, 'utf-8');
    const configData = JSON.parse(content);
    
    return {
      version: 1,
      updatedAt: configData.lastUpdated || Date.now(),
      cids: configData.blockedCids || [],
      peerIds: configData.blockedPeerIds || []
    };
  } catch (error: any) {
    return { version: 1, updatedAt: Date.now(), cids: [], peerIds: [] };
  }
});

ipcMain.handle('policy:block-cid', async (_event, cid: string) => {
  const config = getConfig();
  const configJsonPath = path.join(config.dataDir, 'config.json');
  const fs = await import('fs/promises');
  
  try {
    const content = await fs.readFile(configJsonPath, 'utf-8');
    const configData = JSON.parse(content);
    
    if (!configData.blockedCids) {
      configData.blockedCids = [];
    }
    
    const cidLower = cid.toLowerCase();
    if (!configData.blockedCids.includes(cidLower)) {
      configData.blockedCids.push(cidLower);
      configData.lastUpdated = Date.now();
      await fs.writeFile(configJsonPath, JSON.stringify(configData, null, 2));
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('policy:unblock-cid', async (_event, cid: string) => {
  const config = getConfig();
  const configJsonPath = path.join(config.dataDir, 'config.json');
  const fs = await import('fs/promises');
  
  try {
    const content = await fs.readFile(configJsonPath, 'utf-8');
    const configData = JSON.parse(content);
    
    if (configData.blockedCids) {
      const cidLower = cid.toLowerCase();
      const index = configData.blockedCids.indexOf(cidLower);
      if (index > -1) {
        configData.blockedCids.splice(index, 1);
        configData.lastUpdated = Date.now();
        await fs.writeFile(configJsonPath, JSON.stringify(configData, null, 2));
      }
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('policy:block-peer', async (_event, peerId: string) => {
  const config = getConfig();
  const configJsonPath = path.join(config.dataDir, 'config.json');
  const fs = await import('fs/promises');
  
  try {
    const content = await fs.readFile(configJsonPath, 'utf-8');
    const configData = JSON.parse(content);
    
    if (!configData.blockedPeerIds) {
      configData.blockedPeerIds = [];
    }
    
    if (!configData.blockedPeerIds.includes(peerId)) {
      configData.blockedPeerIds.push(peerId);
      configData.lastUpdated = Date.now();
      await fs.writeFile(configJsonPath, JSON.stringify(configData, null, 2));
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('policy:unblock-peer', async (_event, peerId: string) => {
  const config = getConfig();
  const configJsonPath = path.join(config.dataDir, 'config.json');
  const fs = await import('fs/promises');
  
  try {
    const content = await fs.readFile(configJsonPath, 'utf-8');
    const configData = JSON.parse(content);
    
    if (configData.blockedPeerIds) {
      const index = configData.blockedPeerIds.indexOf(peerId);
      if (index > -1) {
        configData.blockedPeerIds.splice(index, 1);
        configData.lastUpdated = Date.now();
        await fs.writeFile(configJsonPath, JSON.stringify(configData, null, 2));
      }
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

ipcMain.handle('node:reset', async () => {
  console.log('[IPC] node:reset called - resetting node to fresh state');
  
  try {
    // Stop node if running
    if (nodeRunning) {
      console.log('[Reset] Stopping node...');
      await stopNode();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const config = getConfig();
    const dataDir = config.dataDir;
    const configPath = path.join(dataDir, 'config', 'config.json');
    
    console.log('[Reset] Deleting data directory:', dataDir);
    
    // Delete the entire data directory
    const fs = await import('fs/promises');
    try {
      await fs.rm(dataDir, { recursive: true, force: true });
      console.log('[Reset] Data directory deleted');
    } catch (err: any) {
      console.error('[Reset] Failed to delete data directory:', err);
      throw new Error(`Failed to delete data directory: ${err.message}`);
    }
    
    // Recreate the data directory structure
    await fs.mkdir(path.join(dataDir, 'config'), { recursive: true });
    await fs.mkdir(path.join(dataDir, 'blobs'), { recursive: true });
    await fs.mkdir(path.join(dataDir, 'metadata'), { recursive: true });
    console.log('[Reset] Data directory structure recreated');
    
    // Clear electron-store (UI preferences)
    store.clear();
    console.log('[Reset] Electron store cleared');
    
    console.log('[Reset] Node reset complete - ready for fresh start');
    return { success: true };
  } catch (error: any) {
    console.error('[Reset] Reset failed:', error);
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
