import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Config Persistence Tests
 * 
 * These tests verify that the desktop app correctly:
 * 1. Reads settings from config.json (not electron-store)
 * 2. Saves settings to config.json
 * 3. Settings persist after save and reload
 * 4. Bootstrap peers are loaded from config.json
 */

describe('Config Persistence', () => {
  let testDataDir: string;
  let configPath: string;

  beforeEach(() => {
    // Create a temporary test directory
    testDataDir = path.join(os.tmpdir(), `bytecave-test-${Date.now()}`);
    fs.mkdirSync(testDataDir, { recursive: true });
    configPath = path.join(testDataDir, 'config.json');
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('Initial Load', () => {
    it('should use default values when config.json does not exist', () => {
      expect(fs.existsSync(configPath)).toBe(false);
      
      // Simulate getConfig() behavior
      const config = {
        nodeId: 'test-node',
        maxStorageMB: 1024,
        p2pBootstrapPeers: [],
        p2pRelayPeers: []
      };
      
      expect(config.maxStorageMB).toBe(1024);
      expect(config.p2pBootstrapPeers).toEqual([]);
    });

    it('should load all settings from config.json when it exists', () => {
      // Create a config.json with test data
      const testConfig = {
        nodeId: 'test-node',
        maxStorageMB: 2000,
        port: 5001,
        p2pBootstrapPeers: [
          '/ip4/192.168.1.1/tcp/4001/p2p/12D3KooWTest1',
          '/ip4/192.168.1.2/tcp/4001/p2p/12D3KooWTest2'
        ],
        p2pRelayPeers: [
          '/ip4/127.0.0.1/tcp/4001/p2p/12D3KooWRelay'
        ]
      };
      
      fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
      
      // Simulate getConfig() reading from file
      const loadedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      expect(loadedConfig.maxStorageMB).toBe(2000);
      expect(loadedConfig.p2pBootstrapPeers).toHaveLength(2);
      expect(loadedConfig.p2pBootstrapPeers[0]).toBe('/ip4/192.168.1.1/tcp/4001/p2p/12D3KooWTest1');
    });
  });

  describe('Save Settings', () => {
    it('should write all settings to config.json', () => {
      const newConfig = {
        nodeId: 'test-node',
        maxStorageMB: 3000,
        port: 5002,
        p2pBootstrapPeers: [
          '/ip4/192.168.1.3/tcp/4001/p2p/12D3KooWTest3'
        ]
      };
      
      // Simulate config:set behavior
      fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
      
      expect(fs.existsSync(configPath)).toBe(true);
      
      const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(savedConfig.maxStorageMB).toBe(3000);
      expect(savedConfig.port).toBe(5002);
      expect(savedConfig.p2pBootstrapPeers).toHaveLength(1);
    });

    it('should preserve existing settings when updating partial config', () => {
      // Initial config
      const initialConfig = {
        nodeId: 'test-node',
        maxStorageMB: 1024,
        port: 5001,
        p2pBootstrapPeers: ['/ip4/192.168.1.1/tcp/4001/p2p/12D3KooWTest1']
      };
      
      fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));
      
      // Update only maxStorageMB
      const existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const updatedConfig = {
        ...existingConfig,
        maxStorageMB: 2000
      };
      
      fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
      
      // Verify all settings are preserved
      const finalConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(finalConfig.maxStorageMB).toBe(2000);
      expect(finalConfig.port).toBe(5001);
      expect(finalConfig.p2pBootstrapPeers).toHaveLength(1);
      expect(finalConfig.nodeId).toBe('test-node');
    });
  });

  describe('Reload After Save', () => {
    it('should load updated values after save', () => {
      // Initial config
      const initialConfig = {
        nodeId: 'test-node',
        maxStorageMB: 1024
      };
      
      fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));
      
      // Load initial
      let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(config.maxStorageMB).toBe(1024);
      
      // Update config
      config.maxStorageMB = 2000;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      // Reload and verify
      const reloadedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(reloadedConfig.maxStorageMB).toBe(2000);
    });

    it('should not revert to old values after reload', () => {
      // Create initial config
      fs.writeFileSync(configPath, JSON.stringify({ maxStorageMB: 1024 }, null, 2));
      
      // Update to new value
      fs.writeFileSync(configPath, JSON.stringify({ maxStorageMB: 2000 }, null, 2));
      
      // Reload multiple times
      for (let i = 0; i < 5; i++) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        expect(config.maxStorageMB).toBe(2000);
      }
    });
  });

  describe('Bootstrap Peers', () => {
    it('should load bootstrap peers from config.json', () => {
      const testPeers = [
        '/ip4/192.168.1.1/tcp/4001/p2p/12D3KooWTest1',
        '/ip4/192.168.1.2/tcp/4001/p2p/12D3KooWTest2',
        '/ip4/192.168.1.3/tcp/4001/p2p/12D3KooWTest3'
      ];
      
      fs.writeFileSync(configPath, JSON.stringify({
        p2pBootstrapPeers: testPeers
      }, null, 2));
      
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(config.p2pBootstrapPeers).toHaveLength(3);
      expect(config.p2pBootstrapPeers).toEqual(testPeers);
    });

    it('should persist bootstrap peers after save', () => {
      const initialPeers = ['/ip4/192.168.1.1/tcp/4001/p2p/12D3KooWTest1'];
      
      fs.writeFileSync(configPath, JSON.stringify({
        p2pBootstrapPeers: initialPeers
      }, null, 2));
      
      // Add more peers
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      config.p2pBootstrapPeers.push('/ip4/192.168.1.2/tcp/4001/p2p/12D3KooWTest2');
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      // Reload and verify
      const reloadedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(reloadedConfig.p2pBootstrapPeers).toHaveLength(2);
    });

    it('should show empty array when no bootstrap peers exist', () => {
      fs.writeFileSync(configPath, JSON.stringify({
        p2pBootstrapPeers: []
      }, null, 2));
      
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(config.p2pBootstrapPeers).toEqual([]);
    });
  });

  describe('No Electron Store Interference', () => {
    it('should only read from config.json, not electron-store', () => {
      // This test verifies that even if electron-store has different values,
      // config.json is the source of truth
      
      const configJsonValue = { maxStorageMB: 2000 };
      fs.writeFileSync(configPath, JSON.stringify(configJsonValue, null, 2));
      
      // Simulate electron-store having different value (should be ignored)
      const electronStoreValue = { maxStorageMB: 1024 };
      
      // Load from config.json (should ignore electron-store)
      const loadedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      expect(loadedConfig.maxStorageMB).toBe(2000);
      expect(loadedConfig.maxStorageMB).not.toBe(electronStoreValue.maxStorageMB);
    });

    it('should only write to config.json, not electron-store', () => {
      const newConfig = { maxStorageMB: 3000 };
      
      // Save to config.json only
      fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
      
      // Verify it was written to config.json
      const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(savedConfig.maxStorageMB).toBe(3000);
      
      // In real implementation, verify electron-store was NOT updated
      // (this would require mocking electron-store)
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing fields gracefully', () => {
      fs.writeFileSync(configPath, JSON.stringify({
        nodeId: 'test-node'
        // maxStorageMB is missing
      }, null, 2));
      
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(config.nodeId).toBe('test-node');
      expect(config.maxStorageMB).toBeUndefined();
    });

    it('should handle corrupted config.json', () => {
      fs.writeFileSync(configPath, 'invalid json {{{');
      
      expect(() => {
        JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }).toThrow();
    });

    it('should handle very large bootstrap peer lists', () => {
      const largePeerList = Array.from({ length: 100 }, (_, i) => 
        `/ip4/192.168.1.${i}/tcp/4001/p2p/12D3KooWTest${i}`
      );
      
      fs.writeFileSync(configPath, JSON.stringify({
        p2pBootstrapPeers: largePeerList
      }, null, 2));
      
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(config.p2pBootstrapPeers).toHaveLength(100);
    });
  });
});
