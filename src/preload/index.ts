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
    }
  },
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (config: any) => ipcRenderer.invoke('config:set', config)
  }
});
