/**
 * ByteCave Preload Script
 * Exposes safe IPC methods to the renderer
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('bytecave', {
  node: {
    start: () => ipcRenderer.invoke('node:start'),
    stop: () => ipcRenderer.invoke('node:stop'),
    status: () => ipcRenderer.invoke('node:status'),
    peers: () => ipcRenderer.invoke('node:peers'),
    register: () => ipcRenderer.invoke('node:register'),
    deregister: () => ipcRenderer.invoke('node:deregister'),
    onStarted: (callback: (data: any) => void) => {
      ipcRenderer.on('node:started', (_event, data) => callback(data));
    },
    onStopped: (callback: () => void) => {
      ipcRenderer.on('node:stopped', () => callback());
    },
    onPeerConnect: (callback: (peerId: string) => void) => {
      ipcRenderer.on('peer:connect', (_event, peerId) => callback(peerId));
    },
    onPeerDisconnect: (callback: (peerId: string) => void) => {
      ipcRenderer.on('peer:disconnect', (_event, peerId) => callback(peerId));
    },
    onBroadcast: (callback: (data: any) => void) => {
      ipcRenderer.on('broadcast:received', (_event, data) => callback(data));
    }
  },
  peer: {
    connect: (multiaddr: string) => ipcRenderer.invoke('peer:connect', multiaddr)
  },
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (config: any) => ipcRenderer.invoke('config:set', config),
    getRelayPeers: () => ipcRenderer.invoke('config:getRelayPeers')
  },
  resetNode: () => ipcRenderer.invoke('node:reset'),
  policy: {
    getBlockedContent: () => ipcRenderer.invoke('policy:get-blocked-content'),
    blockCid: (cid: string) => ipcRenderer.invoke('policy:block-cid', cid),
    unblockCid: (cid: string) => ipcRenderer.invoke('policy:unblock-cid', cid),
    blockPeer: (peerId: string) => ipcRenderer.invoke('policy:block-peer', peerId),
    unblockPeer: (peerId: string) => ipcRenderer.invoke('policy:unblock-peer', peerId),
    getGuilds: () => ipcRenderer.invoke('policy:get-guilds'),
    setGuilds: (config: any) => ipcRenderer.invoke('policy:set-guilds', config)
  }
});
