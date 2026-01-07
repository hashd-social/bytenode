/**
 * Global type declarations for ByteCave Desktop
 */

interface NodeStatus {
  running: boolean;
  peerId?: string;
  multiaddrs?: string[];
  peers?: number;
}

interface PeerInfo {
  peerId: string;
  multiaddrs: string[];
}

interface StartedData {
  peerId: string;
  multiaddrs: string[];
}

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
        connect: (multiaddr: string) => Promise<any>;
      };
      config: {
        get: () => Promise<any>;
        set: (config: any) => Promise<any>;
        getRelayPeers: () => Promise<string[]>;
      };
      resetNode: () => Promise<{ success: boolean; error?: string }>;
      policy: {
        getBlockedContent: () => Promise<any>;
        blockCid: (cid: string) => Promise<any>;
        unblockCid: (cid: string) => Promise<any>;
        blockPeer: (peerId: string) => Promise<any>;
        unblockPeer: (peerId: string) => Promise<any>;
        getGuilds: () => Promise<any>;
        setGuilds: (config: any) => Promise<any>;
      };
    };
  }
}

export {};
