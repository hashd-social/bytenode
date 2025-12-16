/**
 * ByteCave Desktop App - Main Renderer
 */

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import bytebatLogo from './assets/bytebat.png';

declare global {
  interface Window {
    bytecave: {
      node: {
        start: () => Promise<{ success: boolean }>;
        stop: () => Promise<{ success: boolean }>;
        status: () => Promise<NodeStatus>;
        peers: () => Promise<PeerInfo[]>;
        onStarted: (callback: (data: StartedData) => void) => void;
        onStopped: (callback: () => void) => void;
        onPeerConnect: (callback: (peerId: string) => void) => void;
        onPeerDisconnect: (callback: (peerId: string) => void) => void;
      };
      config: {
        get: () => Promise<NodeConfig>;
        set: (config: Partial<NodeConfig>) => Promise<{ success: boolean }>;
      };
    };
  }
}

interface NodeStatus {
  running: boolean;
  peerId?: string;
  publicKey?: string;
  peers?: number;
  connectedPeers?: number;
  storedBlobs?: number;
  totalSize?: number;
  totalStorageUsed?: number;
  maxStorage?: number;
  uptime?: number;
  contentTypes?: string[] | 'all';
}

interface PeerInfo {
  peerId: string;
  multiaddrs: string[];
  contentTypes: string[] | 'all';
  lastSeen: number;
  reputation: number;
}

interface NodeConfig {
  nodeId: string;
  dataDir: string;
  port: number;
  listenAddresses: string[];
  bootstrapPeers: string[];
  contentTypes: string[] | 'all';
  maxStorageMB: number;
  enableRelay: boolean;
  enableDHT: boolean;
  enableMDNS: boolean;
  httpPort: number;
  ownerAddress?: string;
}

interface StartedData {
  peerId: string;
  addresses: string[];
}

function App() {
  const [status, setStatus] = useState<NodeStatus>({ running: false });
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [config, setConfig] = useState<NodeConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'peers' | 'settings'>('status');

  useEffect(() => {
    loadStatus();
    loadConfig();

    window.bytecave.node.onStarted((data) => {
      setStatus(prev => ({ ...prev, running: true, peerId: data.peerId }));
      loadStatus();
    });

    window.bytecave.node.onStopped(() => {
      setStatus({ running: false });
      setPeers([]);
    });

    window.bytecave.node.onPeerConnect(() => {
      loadPeers();
    });

    window.bytecave.node.onPeerDisconnect(() => {
      loadPeers();
    });

    const interval = setInterval(() => {
      if (status.running) {
        loadStatus();
        loadPeers();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [status.running]);

  const loadStatus = async () => {
    const s = await window.bytecave.node.status();
    setStatus(s);
  };

  const loadPeers = async () => {
    try {
      const p = await window.bytecave.node.peers();
      setPeers(Array.isArray(p) ? p : []);
    } catch (error) {
      console.error('Failed to load peers:', error);
      setPeers([]);
    }
  };

  const loadConfig = async () => {
    const c = await window.bytecave.config.get();
    setConfig(c);
  };

  const handleStart = async () => {
    console.log('[Renderer] Start button clicked');
    setLoading(true);
    try {
      console.log('[Renderer] Calling window.bytecave.node.start()');
      const result = await window.bytecave.node.start();
      console.log('[Renderer] Start result:', result);
    } catch (error) {
      console.error('[Renderer] Start error:', error);
    }
    setLoading(false);
  };

  const handleStop = async () => {
    setLoading(true);
    await window.bytecave.node.stop();
    setLoading(false);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-spacer" />
        <div className="logo">
          <img src={bytebatLogo} alt="ByteCave" className="logo-icon" />
          <span className="logo-text">BYTECAVE</span>
        </div>
        <div className="status-indicator">
          <span className={`status-dot ${status.running ? 'online' : 'offline'}`} />
          <span>{status.running ? 'Online' : 'Offline'}</span>
        </div>
      </header>

      <nav className="tabs">
        <button 
          className={`tab ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => setActiveTab('status')}
        >
          Status
        </button>
        <button 
          className={`tab ${activeTab === 'peers' ? 'active' : ''}`}
          onClick={() => setActiveTab('peers')}
        >
          Peers ({status.peers ?? status.connectedPeers ?? 0})
        </button>
        <button 
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </nav>

      <main className="content">
        {activeTab === 'status' && (
          <div className="status-panel">
            <div className="control-buttons">
              {!status.running ? (
                <button 
                  className="btn btn-primary"
                  onClick={handleStart}
                  disabled={loading}
                >
                  {loading ? 'Starting...' : 'Start Node'}
                </button>
              ) : (
                <button 
                  className="btn btn-danger"
                  onClick={handleStop}
                  disabled={loading}
                >
                  {loading ? 'Stopping...' : 'Stop Node'}
                </button>
              )}
            </div>

            {status.running && (
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">HTTP Port</div>
                  <div className="stat-value">{config?.port || 'N/A'}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Peer ID</div>
                  <div className="stat-value mono">{status.peerId ? `${status.peerId.slice(0, 16)}...` : 'N/A'}</div>
                </div>
                <div className="stat-card full-width">
                  <div className="stat-label">Public Key (for contract registration)</div>
                  <div className="stat-value mono copyable" onClick={() => {
                    if (status.publicKey) {
                      navigator.clipboard.writeText(`0x${status.publicKey}`);
                      alert('Public key copied to clipboard!');
                    }
                  }}>
                    {status.publicKey ? `0x${status.publicKey.slice(0, 32)}...` : 'N/A'}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Connected Peers</div>
                  <div className="stat-value">{status.peers ?? status.connectedPeers ?? 0}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Stored Blobs</div>
                  <div className="stat-value">{status.storedBlobs || 0}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Storage Used</div>
                  <div className="stat-value">
                    {formatBytes(status.totalSize || status.totalStorageUsed || 0)}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Uptime</div>
                  <div className="stat-value">{formatUptime(status.uptime || 0)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Content Types</div>
                  <div className="stat-value">
                    {status.contentTypes === 'all' ? 'ALL' : (status.contentTypes || []).join(', ')}
                  </div>
                </div>
              </div>
            )}

            {!status.running && (
              <div className="offline-message">
                <p>Your ByteCave node is not running.</p>
                <p>Start the node to join the P2P network and contribute storage.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'peers' && (
          <div className="peers-panel">
            {peers.length === 0 ? (
              <div className="empty-state">
                <p>No peers connected yet.</p>
                <p>Peers will appear here as they are discovered on the network.</p>
              </div>
            ) : (
              <div className="peers-list">
                {peers.map((peer) => (
                  <div key={peer.peerId} className="peer-card">
                    <div className="peer-id mono">{peer.peerId.slice(0, 20)}...</div>
                    <div className="peer-meta">
                      <span>Content: {peer.contentTypes === 'all' ? 'ALL' : (peer.contentTypes || []).join(', ')}</span>
                      <span>Rep: {peer.reputation}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && config && (
          <div className="settings-panel">
            <div className="setting-group">
              <label>Owner Wallet Address (for contract registration)</label>
              <input 
                type="text" 
                value={config.ownerAddress || ''} 
                onChange={(e) => setConfig({ ...config, ownerAddress: e.target.value })}
                placeholder="0x..."
                className="input"
              />
              <small className="setting-hint">Your Ethereum address that will own this node on-chain</small>
            </div>
            <div className="setting-group">
              <label>Data Directory</label>
              <input type="text" value={config.dataDir} readOnly className="input" />
            </div>
            <div className="setting-group">
              <label>Max Storage (MB)</label>
              <input 
                type="number" 
                value={config.maxStorageMB} 
                onChange={(e) => setConfig({ ...config, maxStorageMB: parseInt(e.target.value) })}
                className="input"
              />
            </div>
            <div className="setting-group">
              <label>HTTP Port</label>
              <input 
                type="number" 
                value={config.httpPort} 
                onChange={(e) => setConfig({ ...config, httpPort: parseInt(e.target.value) })}
                className="input"
              />
            </div>
            <div className="setting-group">
              <label>Content Types</label>
              <select 
                value={config.contentTypes === 'all' ? 'all' : 'custom'}
                onChange={(e) => setConfig({ 
                  ...config, 
                  contentTypes: e.target.value === 'all' ? 'all' : ['messages', 'posts'] 
                })}
                className="input"
              >
                <option value="all">All Content Types</option>
                <option value="custom">Custom Selection</option>
              </select>
            </div>
            <div className="setting-group checkboxes">
              <label>
                <input 
                  type="checkbox" 
                  checked={config.enableDHT}
                  onChange={(e) => setConfig({ ...config, enableDHT: e.target.checked })}
                />
                Enable DHT (Distributed Hash Table)
              </label>
              <label>
                <input 
                  type="checkbox" 
                  checked={config.enableMDNS}
                  onChange={(e) => setConfig({ ...config, enableMDNS: e.target.checked })}
                />
                Enable mDNS (Local Discovery)
              </label>
              <label>
                <input 
                  type="checkbox" 
                  checked={config.enableRelay}
                  onChange={(e) => setConfig({ ...config, enableRelay: e.target.checked })}
                />
                Enable Relay (NAT Traversal)
              </label>
            </div>
            <button 
              className="btn btn-primary"
              onClick={async () => {
                await window.bytecave.config.set(config);
                alert('Settings saved! Restart the node for changes to take effect.');
              }}
            >
              Save Settings
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
