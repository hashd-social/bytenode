/**
 * ByteCave Desktop App - Main Renderer
 */

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import bytebatLogo from './assets/bytebat.png';
import { NodePolicyTab } from './NodePolicyTab';

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
      peer: {
        connect: (multiaddr: string) => Promise<{ success: boolean; error?: string }>;
      };
      config: {
        get: () => Promise<NodeConfig>;
        set: (config: Partial<NodeConfig>) => Promise<{ success: boolean }>;
        getRelayPeers: () => Promise<string[]>;
      };
      policy: {
        getBlockedContent: () => Promise<any>;
        blockCid: (cid: string) => Promise<{ success: boolean }>;
        unblockCid: (cid: string) => Promise<{ success: boolean }>;
        blockPeer: (peerId: string) => Promise<{ success: boolean }>;
        unblockPeer: (peerId: string) => Promise<{ success: boolean }>;
        getGuilds: () => Promise<any>;
        setGuilds: (config: any) => Promise<{ success: boolean }>;
      };
    };
  }
}

interface NodeStatus {
  running: boolean;
  status?: 'healthy' | 'degraded' | 'unhealthy' | 'outdated';
  version?: string;
  minVersion?: string;
  peerId?: string;
  publicKey?: string;
  ownerAddress?: string;
  registeredOnChain?: boolean;
  onChainNodeId?: string;
  peers?: number;
  p2p?: {
    connected: number;
    registered: number;
    relay: number;
  };
  connectedPeers?: number;
  storedBlobs?: number;
  totalSize?: number;
  totalStorageUsed?: number;
  latencyMs?: number;
  uptime?: number;
  multiaddrs?: string[];
  contentTypes?: string[] | 'all';
  metrics?: {
    requestsLastHour: number;
    avgResponseTime: number;
    successRate: number;
  };
  integrity?: {
    checked: number;
    passed: number;
    failed: number;
    orphaned: number;
    metadataTampered: number;
  };
}

interface PeerInfo {
  peerId: string;
  multiaddrs: string[];
  contentTypes: string[] | 'all';
  lastSeen: number;
  reputation: number;
  httpEndpoint?: string;
  connected?: boolean;
}

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
  publicKey?: string;
  
  // P2P Configuration
  p2pEnabled: boolean;
  p2pListenAddresses: string[];
  p2pBootstrapPeers: string[];
  p2pRelayPeers: string[];
  p2pEnableRelay: boolean;
  
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
  // gcVerifyReplicas and gcVerifyProofs removed - always true for security
  
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
  
  // Content Types
  contentTypes?: string;
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
  const [activeTab, setActiveTab] = useState<'status' | 'peers' | 'broadcast' | 'policy' | 'settings'>('status');
  const [relayPeerIds, setRelayPeerIds] = useState<string[]>([]);
  const [broadcasts, setBroadcasts] = useState<Array<{from: string; message: string; timestamp: number}>>([]);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [peerMultiaddr, setPeerMultiaddr] = useState('');
  const [connectingPeer, setConnectingPeer] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
    loadConfig();

    window.bytecave.node.onStarted((data) => {
      setStatus(prev => ({ ...prev, running: true, peerId: data.peerId }));
      // Don't call loadStatus here - let the interval handle it
    });

    window.bytecave.node.onStopped(() => {
      setStatus({ running: false });
      setPeers([]);
      setBroadcasts([]);
    });

    window.bytecave.node.onPeerConnect(() => {
      loadPeers();
    });

    window.bytecave.node.onPeerDisconnect(() => {
      loadPeers();
    });
  }, []); // Empty deps - only run once on mount

  // Separate effect for polling that has access to current state
  useEffect(() => {
    if (!status.running) return;

    const interval = setInterval(() => {
      loadStatus();
      loadPeers();
      loadBroadcasts();
      loadConfig(); // Reload config to pick up auto-saved bootstrap peers
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [status.running, config]); // Re-create interval when status.running or config changes

  // Reload config when Settings tab is activated
  useEffect(() => {
    if (activeTab === 'settings') {
      loadConfig();
    }
  }, [activeTab]);

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

  const loadBroadcasts = async () => {
    if (!config) return;
    try {
      const response = await fetch(`http://localhost:${config.port}/broadcasts`);
      const data = await response.json();
      setBroadcasts(data.broadcasts || []);
    } catch (error) {
      console.error('Failed to load broadcasts:', error);
    }
  };

  const loadConfig = async () => {
    console.log('[Renderer] loadConfig() called');
    const c = await window.bytecave.config.get();
    console.log('[Renderer] Loaded config from IPC:');
    console.log('  - maxStorageMB:', c.maxStorageMB);
    console.log('  - p2pBootstrapPeers count:', c.p2pBootstrapPeers?.length || 0);
    console.log('  - port:', c.port);
    console.log('[Renderer] Setting config state...');
    setConfig(c);
    console.log('[Renderer] Config state updated');
    
    // Extract relay peer IDs from relay multiaddrs
    const relayAddrs = await window.bytecave.config.getRelayPeers();
    const relayIds = relayAddrs.map((addr: string) => {
      const match = addr.match(/\/p2p\/([^\/]+)$/);
      return match ? match[1] : null;
    }).filter((id): id is string => id !== null);
    setRelayPeerIds(relayIds);
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

  const handleRegister = async () => {
    if (!confirm('Register this node on-chain?')) {
      return;
    }
    
    setLoading(true);
    try {
      const result = await window.bytecave.node.register();
      if (result.success) {
        alert('✅ Node registered successfully!');
        await loadStatus();
      } else {
        alert(`❌ Registration failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`❌ Registration failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeregister = async () => {
    if (!confirm('Deregister this node from the contract? Your stake will be returned.')) {
      return;
    }
    
    setLoading(true);
    try {
      const result = await window.bytecave.node.deregister();
      if (result.success) {
        alert('✅ Node deregistered successfully! Stake returned.');
        await loadStatus();
      } else {
        alert(`❌ Deregistration failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`❌ Deregistration failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const formatUptime = (uptimeSeconds: number) => {

    const seconds = Math.floor(uptimeSeconds);
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
          <span className="logo-text">BYTENODE</span>
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
          Peers ({peers.length})
        </button>
        <button 
          className={`tab ${activeTab === 'broadcast' ? 'active' : ''}`}
          onClick={() => setActiveTab('broadcast')}
        >
          Broadcast ({broadcasts.length})
        </button>
        <button 
          className={`tab ${activeTab === 'policy' ? 'active' : ''}`}
          onClick={() => setActiveTab('policy')}
        >
          Policy
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
              <>
                {/* Health Status Banner */}
                <div className={`health-banner ${status.status || 'healthy'}`}>
                  <span className="health-icon">
                    {status.status === 'healthy' ? '✓' : 
                     status.status === 'degraded' ? '⚠' : 
                     status.status === 'outdated' ? '⚠' : '✗'}
                  </span>
                  <span className="health-text">
                    {(status.status || 'healthy').toUpperCase()}
                  </span>
                  {status.version && <span className="version-badge">v{status.version}</span>}
                  {status.status === 'outdated' && status.minVersion && (
                    <span className="min-version-badge">Required: v{status.minVersion}</span>
                  )}
                </div>

                {/* Identity Section */}
                <div className="section-header">Identity</div>
                <div className="stats-grid">
                  <div className="stat-card full-width">
                    <div className="stat-label">Node ID</div>
                    <div className="stat-value mono">{config?.nodeId || 'N/A'}</div>
                  </div>
                  <div className="stat-card full-width">
                    <div className="stat-label">On-Chain Registration</div>
                    <div className="stat-value">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }}>
                        <div>
                          {status.registeredOnChain ? (
                            <span style={{ color: '#4ade80' }}>✓ Registered</span>
                          ) : (
                            <span style={{ color: '#f87171' }}>✗ Not Registered</span>
                          )}
                          {status.onChainNodeId && (
                            <div style={{ fontSize: '0.8em', marginTop: '4px', opacity: 0.7 }}>
                              {status.onChainNodeId.slice(0, 16)}...
                            </div>
                          )}
                        </div>
                        {status.peerId && (
                          <>
                            {status.registeredOnChain ? (
                              <button 
                                className="btn btn-secondary"
                                onClick={handleDeregister}
                                style={{ fontSize: '0.85em', padding: '6px 12px' }}
                              >
                                Deregister
                              </button>
                            ) : (
                              <button 
                                className="btn btn-primary"
                                onClick={handleRegister}
                                style={{ fontSize: '0.85em', padding: '6px 12px' }}
                              >
                                Register
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="stat-card full-width">
                    <div className="stat-label">Peer ID</div>
                    <div className="stat-value mono copyable" onClick={() => {
                      if (status.peerId) {
                        navigator.clipboard.writeText(status.peerId);
                        alert('Peer ID copied to clipboard!');
                      }
                    }}>
                      {status.peerId || 'N/A'}
                    </div>
                  </div>
                  <div className="stat-card full-width">
                    <div className="stat-label">Public Key (for contract registration)</div>
                    <div className="stat-value mono copyable" onClick={() => {
                      if (status.publicKey) {
                        navigator.clipboard.writeText(`0x${status.publicKey}`);
                        alert('Public key copied to clipboard!');
                      }
                    }}>
                      {status.publicKey ? `0x${status.publicKey}` : 'N/A'}
                    </div>
                  </div>
                  {status.ownerAddress && (
                    <div className="stat-card full-width">
                      <div className="stat-label">Owner Address</div>
                      <div className="stat-value mono">{status.ownerAddress}</div>
                    </div>
                  )}
                </div>

                {/* Network Section */}
                <div className="section-header">Network</div>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-label">HTTP Port</div>
                    <div className="stat-value">{config?.port || 'N/A'}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">P2P Network</div>
                    <div className="stat-value">
                      {status.p2p ? (
                        <div style={{ fontSize: '0.9em', lineHeight: '1.6' }}>
                          <div><strong>{status.p2p.connected}</strong> connected</div>
                          <div><strong>{status.p2p.registered}</strong> registered</div>
                        </div>
                      ) : (
                        peers.length
                      )}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Avg Latency</div>
                    <div className="stat-value">{status.latencyMs ? `${status.latencyMs.toFixed(0)}ms` : 'N/A'}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Uptime</div>
                    <div className="stat-value">{formatUptime(status.uptime || 0)}</div>
                  </div>
                </div>



                {/* Storage Section */}
                <div className="section-header">Storage</div>
                <div className="stats-grid">
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
                    <div className="stat-label">Content Types</div>
                    <div className="stat-value">
                      {status.contentTypes === 'all' ? 'ALL' : (status.contentTypes || []).join(', ') || 'ALL'}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Data Directory</div>
                    <div className="stat-value mono small">{config?.dataDir || 'N/A'}</div>
                  </div>
                </div>

                {/* Integrity Section */}
                {status.integrity && (
                  <>
                    <div className="section-header">Integrity</div>
                    <div className="stats-grid">
                      <div className="stat-card">
                        <div className="stat-label">Checked</div>
                        <div className="stat-value">{status.integrity.checked}</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Passed</div>
                        <div className="stat-value success">{status.integrity.passed}</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Failed</div>
                        <div className={`stat-value ${status.integrity.failed > 0 ? 'error' : ''}`}>
                          {status.integrity.failed}
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Orphaned</div>
                        <div className={`stat-value ${status.integrity.orphaned > 0 ? 'warning' : ''}`}>
                          {status.integrity.orphaned}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Metrics Section */}
                {status.metrics && (
                  <>
                    <div className="section-header">Performance</div>
                    <div className="stats-grid">
                      <div className="stat-card">
                        <div className="stat-label">Requests (Last Hour)</div>
                        <div className="stat-value">{status.metrics.requestsLastHour}</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Avg Response Time</div>
                        <div className="stat-value">{status.metrics.avgResponseTime.toFixed(0)}ms</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Success Rate</div>
                        <div className={`stat-value ${status.metrics.successRate < 0.9 ? 'warning' : 'success'}`}>
                          {(status.metrics.successRate * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </>
                )}


                {/* P2P Multiaddrs */}
                {status.multiaddrs && status.multiaddrs.length > 0 && (
                  <>
                    <div className="section-header">P2P Listen Addresses</div>
                    <div className="multiaddr-list">
                      {status.multiaddrs.map((addr, i) => (
                        <div key={i} className="multiaddr-item mono copyable" onClick={() => {
                          navigator.clipboard.writeText(addr);
                          alert('Address copied!');
                        }}>
                          {addr}
                        </div>
                      ))}
                    </div>
                  </>
                )}                
              </>
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
            {/* Manual Peer Connection */}
            <div className="connect-peer-section">
              <div className="section-header">Connect to Peer</div>
              <p className="connect-hint">
                Enter a peer's multiaddr to connect directly across any network. 
                Get this from another node's P2P Listen Addresses.
              </p>
              <div className="connect-form">
                <textarea
                  value={peerMultiaddr}
                  onChange={(e) => {
                    setPeerMultiaddr(e.target.value);
                    setConnectError(null);
                  }}
                  placeholder="/ip4/203.0.113.50/tcp/4001/p2p/12D3KooWExample..."
                  className="input textarea"
                  rows={2}
                  disabled={!status.running || connectingPeer}
                />
                <button
                  className="btn btn-primary"
                  disabled={!status.running || connectingPeer || !peerMultiaddr.trim()}
                  onClick={async () => {
                    setConnectingPeer(true);
                    setConnectError(null);
                    try {
                      const result = await window.bytecave.peer.connect(peerMultiaddr.trim());
                      if (result.success) {
                        setPeerMultiaddr('');
                        loadPeers();
                        loadStatus();
                      } else {
                        setConnectError(result.error || 'Failed to connect');
                      }
                    } catch (err: any) {
                      setConnectError(err.message);
                    } finally {
                      setConnectingPeer(false);
                    }
                  }}
                >
                  {connectingPeer ? 'Connecting...' : 'Connect'}
                </button>
              </div>
              {connectError && (
                <div className="connect-error">{connectError}</div>
              )}
              {!status.running && (
                <div className="connect-warning">Start your node first to connect to peers</div>
              )}
            </div>

            {/* Connected Peers List - backend already filters to connected only */}
            <div className="section-header">Connected Peers ({peers.length})</div>
            {peers.length === 0 ? (
              <div className="empty-state">
                <p>No peers connected yet.</p>
                <p>Enter a multiaddr above to connect to a known peer.</p>
              </div>
            ) : (
              <div className="peers-list">
                {peers.map((peer) => {
                  // Check if this peer ID matches any configured relay peer
                  const isRelay = relayPeerIds.includes(peer.peerId);
                  
                  return (
                    <div key={peer.peerId} className={`peer-card ${isRelay ? 'relay-peer' : ''}`}>
                      <div className="peer-id mono">
                        {peer.peerId}
                        {isRelay && <span className="relay-badge">RELAY</span>}
                      </div>
                      <div className="peer-meta">
                        <span>Content: {peer.contentTypes === 'all' ? 'ALL' : (peer.contentTypes || []).join(', ')}</span>
                        <span>Rep: {peer.reputation}</span>
                        {peer.httpEndpoint && <span>HTTP: ✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'broadcast' && (
          <div className="broadcast-panel">
            <div className="broadcast-send-section">
              <h3>Send Broadcast Message</h3>
              <textarea
                className="broadcast-input"
                placeholder="Type your message here..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                maxLength={1000}
                rows={4}
              />
              <div className="broadcast-actions">
                <button 
                  className="btn-primary"
                  onClick={async () => {
                    if (!broadcastMessage.trim()) return;
                    if (!config?.port) {
                      console.error('No port configured');
                      return;
                    }
                    try {
                      console.log(`Sending broadcast to http://localhost:${config.port}/broadcast`);
                      const response = await fetch(`http://localhost:${config.port}/broadcast`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: broadcastMessage })
                      });
                      console.log('Broadcast response:', response.status, response.statusText);
                      if (response.ok) {
                        setBroadcastMessage('');
                        loadBroadcasts();
                      } else {
                        const errorText = await response.text();
                        console.error('Broadcast failed:', response.status, errorText);
                      }
                    } catch (error) {
                      console.error('Failed to send broadcast:', error);
                    }
                  }}
                  disabled={!status.running || !broadcastMessage.trim()}
                >
                  Send to All Peers
                </button>
                <span className="char-count">{broadcastMessage.length}/1000</span>
              </div>
            </div>

            <div className="broadcast-list-section">
              <h3>Recent Broadcasts</h3>
              {broadcasts.length === 0 ? (
                <div className="empty-state">
                  <p>No broadcasts yet</p>
                  <p>Send a message to see it here</p>
                </div>
              ) : (
                <div className="broadcasts-list">
                  {broadcasts.map((broadcast, index) => (
                    <div key={index} className="broadcast-card">
                      <div className="broadcast-header">
                        <span className="broadcast-from mono">{broadcast.from.slice(0, 16)}...</span>
                        <span className="broadcast-time">
                          {new Date(broadcast.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="broadcast-message">{broadcast.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'policy' && config && (
          <NodePolicyTab 
            config={config}
            onConfigChange={(newConfig) => {
              setConfig(newConfig);
              window.bytecave.config.set(newConfig);
            }}
          />
        )}

        {activeTab === 'settings' && config && (
          <div className="settings-panel">
            <div className="setting-group">
              <label>Node ID</label>
              <input 
                type="text" 
                value={config.nodeId} 
                onChange={(e) => setConfig({ ...config, nodeId: e.target.value })}
                className="input"
              />
              <small className="setting-hint">Unique identifier for this node</small>
            </div>
            <div className="setting-group">
              <label>Data Directory</label>
              <input 
                type="text" 
                value={config.dataDir} 
                onChange={(e) => setConfig({ ...config, dataDir: e.target.value })}
                className="input"
              />
              <small className="setting-hint">Where node data is stored</small>
            </div>
            <div className="setting-group">
              <label>HTTP Port</label>
              <input 
                type="number" 
                value={config.port} 
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
                className="input"
              />
              <small className="setting-hint">Port for HTTP API</small>
            </div>
            <div className="setting-group">
              <label>Owner Wallet Address</label>
              <input 
                type="text" 
                value={config.ownerAddress || ''} 
                onChange={(e) => setConfig({ ...config, ownerAddress: e.target.value })}
                placeholder="0x..."
                className="input"
              />
              <small className="setting-hint">Your Ethereum address for on-chain registration</small>
            </div>
            <div className="setting-group">
              <label>Public Key</label>
              <input 
                type="text" 
                value={config.publicKey || ''} 
                readOnly
                placeholder="Generated automatically on first start..."
                className="input"
              />
              <small className="setting-hint">Node's public key (auto-generated on first start)</small>
            </div>
            <div className="setting-group">
              <label>Relay Nodes (for NAT traversal)</label>
              <textarea 
                value={(config.p2pRelayPeers || []).join('\n')} 
                onChange={(e) => setConfig({ 
                  ...config, 
                  p2pRelayPeers: e.target.value.split('\n').filter(p => p.trim()) 
                })}
                placeholder="/ip4/1.2.3.4/tcp/4001/p2p/12D3KooW..."
                className="input textarea"
                rows={3}
              />
              <small className="setting-hint">
                Enter relay node multiaddrs (one per line). Relays help nodes behind NATs/firewalls connect to each other.
              </small>
            </div>
            <div className="setting-group">
              <label>
                Bootstrap Peers (for cross-network discovery)
                {config?.p2pBootstrapPeers && config.p2pBootstrapPeers.length > 0 && (
                  <span style={{ marginLeft: '8px', fontSize: '12px', color: '#4ade80' }}>
                    ✓ {config.p2pBootstrapPeers.length} peer{config.p2pBootstrapPeers.length !== 1 ? 's' : ''} saved
                  </span>
                )}
              </label>
              <textarea 
                value={config?.p2pBootstrapPeers ? config.p2pBootstrapPeers.join('\n') : ''} 
                onChange={(e) => {
                  if (!config) return;
                  setConfig({ 
                    ...config, 
                    p2pBootstrapPeers: e.target.value.split('\n').filter(p => p.trim()) 
                  });
                }}
                placeholder="/ip4/1.2.3.4/tcp/4001/p2p/12D3KooW..."
                className="input textarea"
                rows={5}
              />
              <small className="setting-hint">
                ✨ Discovered peers are automatically saved here. You can also manually add known peers (one per line).
                <br />
                These peers are persisted in <code>data/config.json</code> and used for reconnection on restart.
              </small>
            </div>
            
            {/* Sharding Configuration */}
            <h3 style={{ marginTop: '24px', marginBottom: '16px', color: '#a78bfa' }}>⚡ Sharding</h3>
            <div className="setting-group">
              <label>Shard Count</label>
              <input 
                type="number" 
                value={config.shardCount} 
                onChange={(e) => setConfig({ ...config, shardCount: parseInt(e.target.value) })}
                className="input"
              />
              <small className="setting-hint">
                Total shards in the network. Content is distributed across shards using CID hashing.
                <br />
                <strong>Default: 1024</strong> (must match network-wide configuration)
              </small>
            </div>
            <div className="setting-group">
              <label>Node Shards (JSON)</label>
              <textarea 
                value={JSON.stringify(config.nodeShards, null, 2)} 
                onChange={(e) => {
                  try {
                    const shards = JSON.parse(e.target.value);
                    setConfig({ ...config, nodeShards: shards });
                  } catch (err) {
                    // Invalid JSON, ignore
                  }
                }}
                className="input textarea"
                rows={3}
              />
              <small className="setting-hint">
                Shard ranges this node stores. Each CID is hashed to a shard number, and nodes only store content in their assigned ranges.
                <br />
                <strong>Example:</strong> {`[{"start":0,"end":255}]`} stores first 25% of network content
              </small>
            </div>

            {/* Garbage Collection */}
            <h3 style={{ marginTop: '24px', marginBottom: '16px', color: '#a78bfa' }}>🗑️ Garbage Collection</h3>
            <div className="setting-group checkboxes">
              <label>
                <input 
                  type="checkbox" 
                  checked={config.gcEnabled ?? true}
                  onChange={(e) => setConfig({ ...config, gcEnabled: e.target.checked })}
                />
                Enable Garbage Collection
              </label>
            </div>
            <div className="setting-group">
              <label>Retention Mode</label>
              <select 
                value={config.gcRetentionMode || 'hybrid'} 
                onChange={(e) => setConfig({ ...config, gcRetentionMode: e.target.value as 'size' | 'time' | 'hybrid' })}
                className="input"
              >
                <option value="size">Size - Delete oldest blobs when storage limit reached</option>
                <option value="time">Time - Delete blobs older than max age</option>
                <option value="hybrid">Hybrid - Delete based on both size and age limits</option>
              </select>
            </div>
            <div className="setting-group">
              <label>Max Storage (MB)</label>
              <input 
                type="number" 
                value={config.gcMaxStorageMB ?? config.maxStorageMB} 
                onChange={(e) => setConfig({ ...config, gcMaxStorageMB: parseInt(e.target.value) })}
                className="input"
              />
              <small className="setting-hint">
                Maximum storage for garbage collection. When exceeded, oldest/least-accessed blobs are deleted based on retention mode.
                <br />
                <strong>Default: 5000 MB (5 GB)</strong>
              </small>
            </div>
            <div className="setting-group">
              <label>Max Blob Age (Days)</label>
              <input 
                type="number" 
                value={config.gcMaxBlobAgeDays ?? 30} 
                onChange={(e) => setConfig({ ...config, gcMaxBlobAgeDays: parseInt(e.target.value) })}
                className="input"
              />
              <small className="setting-hint">
                Blobs older than this are eligible for deletion during garbage collection (if retention mode includes time).
                <br />
                <strong>Default: 30 days</strong>
              </small>
            </div>
            <div className="setting-group">
              <label>Reserved for Pinned (MB)</label>
              <input 
                type="number" 
                value={config.gcReservedForPinnedMB ?? 1000} 
                onChange={(e) => setConfig({ ...config, gcReservedForPinnedMB: parseInt(e.target.value) })}
                className="input"
              />
              <small className="setting-hint">
                Storage reserved for pinned blobs (never deleted). GC will not delete pinned content even when storage is full.
                <br />
                <strong>Default: 1000 MB (1 GB)</strong>
              </small>
            </div>
            <div className="setting-group">
              <label>GC Interval (Minutes)</label>
              <input 
                type="number" 
                value={config.gcIntervalMinutes ?? 10} 
                onChange={(e) => setConfig({ ...config, gcIntervalMinutes: parseInt(e.target.value) })}
                className="input"
              />
              <small className="setting-hint">
                Frequency of automatic garbage collection runs. Set higher to reduce CPU usage, lower for more aggressive cleanup.
                <br />
                <strong>Default: 10 minutes</strong>
              </small>
            </div>
            <div className="setting-group">
              <div style={{ padding: '12px', backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#4ade80' }}>
                  ✓ <strong>Replica Verification:</strong> Always enabled (security requirement)
                  <br />
                  ✓ <strong>Storage Proof Verification:</strong> Always enabled (security requirement)
                </p>
                <small style={{ display: 'block', marginTop: '8px', color: '#86efac', fontSize: '11px' }}>
                  These security features cannot be disabled. All replicas and storage proofs are verified before garbage collection.
                </small>
              </div>
            </div>

            {/* Storage Configuration */}
            <h3 style={{ marginTop: '24px', marginBottom: '16px', color: '#a78bfa' }}>💾 Storage</h3>
            <div className="setting-group">
              <label>Max Storage (MB)</label>
              <input 
                type="number" 
                value={config.maxStorageMB} 
                onChange={(e) => setConfig({ ...config, maxStorageMB: parseInt(e.target.value) })}
                className="input"
              />
              <small className="setting-hint">Total storage capacity</small>
            </div>
            <div className="setting-group">
              <label>Max Blob Size (MB)</label>
              <input 
                type="number" 
                value={config.maxBlobSizeMB ?? 10} 
                onChange={(e) => setConfig({ ...config, maxBlobSizeMB: parseInt(e.target.value) })}
                className="input"
              />
              <small className="setting-hint">Maximum size for a single blob (default: 10 MB)</small>
            </div>
            <div className="setting-group">
              <label>Max Storage (GB)</label>
              <input 
                type="number" 
                value={config.maxStorageGB ?? 100} 
                onChange={(e) => setConfig({ ...config, maxStorageGB: parseInt(e.target.value) })}
                className="input"
              />
              <small className="setting-hint">Maximum total storage in GB (default: 100 GB)</small>
            </div>

            {/* Contract Integration */}
            <h3 style={{ marginTop: '24px', marginBottom: '16px', color: '#a78bfa' }}>⛓️ Contract Integration</h3>
            <div className="setting-group">
              <label>RPC URL</label>
              <input 
                type="text" 
                value={config.rpcUrl ?? 'http://127.0.0.1:8545'} 
                onChange={(e) => setConfig({ ...config, rpcUrl: e.target.value })}
                className="input"
                placeholder="http://127.0.0.1:8545"
              />
              <small className="setting-hint">Ethereum RPC endpoint for on-chain registry access</small>
            </div>
            <div className="setting-group">
              <label>Vault Registry Address</label>
              <input 
                type="text" 
                value={config.registryAddress ?? ''} 
                onChange={(e) => setConfig({ ...config, registryAddress: e.target.value })}
                className="input"
                placeholder="0x..."
              />
              <small className="setting-hint">Contract address for VaultNodeRegistry (required for peer registration checking)</small>
            </div>

            {/* Replication Configuration */}
            <h3 style={{ marginTop: '24px', marginBottom: '16px', color: '#a78bfa' }}>🔄 Replication</h3>
            <div className="setting-group checkboxes">
              <label>
                <input 
                  type="checkbox" 
                  checked={config.replicationEnabled ?? true}
                  onChange={(e) => setConfig({ ...config, replicationEnabled: e.target.checked })}
                />
                Enable Replication
              </label>
            </div>
            <div className="setting-group">
              <div style={{ padding: '12px', backgroundColor: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#a78bfa' }}>
                  ℹ️ <strong>Replication Factor:</strong> Fixed at 3 replicas (protocol constant)
                </p>
                <small style={{ display: 'block', marginTop: '8px', color: '#c4b5fd', fontSize: '11px' }}>
                  All nodes maintain 3 copies of each blob for network consistency. This ensures predictable redundancy and prevents coordination issues.
                </small>
              </div>
            </div>
            <div className="setting-group">
              <label>Replication Timeout (ms)</label>
              <input 
                type="number" 
                value={config.replicationTimeoutMs ?? 5000} 
                onChange={(e) => setConfig({ ...config, replicationTimeoutMs: parseInt(e.target.value) })}
                className="input"
              />
              <small className="setting-hint">
                How long to wait for replication requests to other nodes before timing out.
                <br />
                <strong>Default: 5000 ms (5 seconds)</strong>
              </small>
            </div>

            {/* Security Configuration */}
            <h3 style={{ marginTop: '24px', marginBottom: '16px', color: '#a78bfa' }}>🔒 Security</h3>
            <div className="setting-group checkboxes">
              <label>
                <input 
                  type="checkbox" 
                  checked={config.enableBlockedContent ?? true}
                  onChange={(e) => setConfig({ ...config, enableBlockedContent: e.target.checked })}
                />
                Enable Blocked Content Filtering
              </label>
            </div>
            <div className="setting-group">
              <label>Allowed Apps (comma-separated)</label>
              <input 
                type="text" 
                value={(config.allowedApps ?? ['hashd']).join(', ')} 
                onChange={(e) => setConfig({ 
                  ...config, 
                  allowedApps: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                })}
                className="input"
              />
              <small className="setting-hint">Apps this node accepts storage for (default: hashd). Leave empty to accept all registered apps.</small>
            </div>
            <div className="setting-group checkboxes">
              <label>
                <input 
                  type="checkbox" 
                  checked={config.requireAppRegistry ?? true}
                  onChange={(e) => setConfig({ ...config, requireAppRegistry: e.target.checked })}
                />
                Require AppRegistry Validation
              </label>
              <small className="setting-hint">
                When enabled, only accepts storage requests from apps registered in the on-chain AppRegistry contract.
                <br />
                <strong>Recommended: enabled</strong> for production nodes
              </small>
            </div>

            {/* Content Types Configuration */}
            <h3 style={{ marginTop: '24px', marginBottom: '16px', color: '#a78bfa' }}>📦 Content Types</h3>
            <div className="setting-group">
              <label>Content Types to Store</label>
              <input 
                type="text" 
                value={config.contentTypes || 'all'} 
                onChange={(e) => setConfig({ ...config, contentTypes: e.target.value })}
                placeholder="all"
                className="input"
              />
              <small className="setting-hint">
                Content types this node will accept and store. Use 'all' or comma-separated list: messages,posts,media,listings
                <br />
                <strong>Default: 'all'</strong> (accepts all content types)
              </small>
            </div>

            {/* Performance Configuration */}
            <h3 style={{ marginTop: '24px', marginBottom: '16px', color: '#a78bfa' }}>⚡ Performance</h3>
            <div className="setting-group">
              <label>Cache Size (MB)</label>
              <input 
                type="number" 
                value={config.cacheSizeMB ?? 50} 
                onChange={(e) => setConfig({ ...config, cacheSizeMB: parseInt(e.target.value) })}
                className="input"
              />
              <small className="setting-hint">
                In-memory cache for frequently accessed blobs. Reduces disk I/O and improves response times.
                <br />
                <strong>Default: 50 MB</strong>
              </small>
            </div>

            {/* Monitoring Configuration */}
            <h3 style={{ marginTop: '24px', marginBottom: '16px', color: '#a78bfa' }}>📊 Monitoring</h3>
            <div className="setting-group checkboxes">
              <label>
                <input 
                  type="checkbox" 
                  checked={config.metricsEnabled ?? true}
                  onChange={(e) => setConfig({ ...config, metricsEnabled: e.target.checked })}
                />
                Enable Metrics
              </label>
            </div>
            <div className="setting-group">
              <label>Log Level</label>
              <select 
                value={config.logLevel || 'info'} 
                onChange={(e) => setConfig({ ...config, logLevel: e.target.value })}
                className="input"
              >
                <option value="error">Error</option>
                <option value="warn">Warning</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
            </div>

            {/* P2P Configuration */}
            <h3 style={{ marginTop: '24px', marginBottom: '16px', color: '#a78bfa' }}>🌐 P2P</h3>
            <div className="setting-group checkboxes">
              <label>
                <input 
                  type="checkbox" 
                  checked={config.p2pEnableRelay}
                  onChange={(e) => setConfig({ ...config, p2pEnableRelay: e.target.checked })}
                />
                Enable Relay (NAT Traversal)
              </label>
            </div>
            <div style={{ marginTop: '24px', padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#f87171' }}>⚠️ Danger Zone</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#fca5a5' }}>
                Reset will permanently delete all stored data, blobs, and configuration. The node will restart as if it's a fresh installation.
              </p>
              <button 
                className="btn"
                style={{ backgroundColor: '#dc2626', color: 'white', marginRight: '12px' }}
                onClick={async () => {
                  const confirmed = window.confirm(
                    '⚠️ WARNING: This will permanently delete:\n\n' +
                    '• All stored blobs and data\n' +
                    '• Node configuration (config.json)\n' +
                    '• Node identity and peer history\n\n' +
                    'The node will restart as a fresh installation.\n\n' +
                    'Are you absolutely sure you want to continue?'
                  );
                  
                  if (!confirmed) return;
                  
                  const doubleCheck = window.confirm(
                    'This action CANNOT be undone!\n\n' +
                    'Type "DELETE" in the next prompt to confirm.'
                  );
                  
                  if (!doubleCheck) return;
                  
                  const finalConfirm = window.prompt('Type DELETE to confirm:');
                  if (finalConfirm !== 'DELETE') {
                    alert('Reset cancelled - confirmation text did not match.');
                    return;
                  }
                  
                  try {
                    await window.bytecave.resetNode();
                    alert('Node reset complete! The application will now restart.');
                    window.location.reload();
                  } catch (err: any) {
                    alert('Reset failed: ' + err.message);
                  }
                }}
              >
                Reset Node
              </button>
            </div>

            <button 
              className="btn btn-primary"
              style={{ marginTop: '16px' }}
              onClick={async () => {
                console.log('[Renderer] Saving config:', { maxStorageMB: config.maxStorageMB, port: config.port });
                await window.bytecave.config.set(config);
                console.log('[Renderer] Config saved, waiting before reload...');
                // Wait a bit for file write to complete, then reload
                await new Promise(resolve => setTimeout(resolve, 200));
                console.log('[Renderer] Reloading config...');
                await loadConfig();
                console.log('[Renderer] Config reloaded');
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
