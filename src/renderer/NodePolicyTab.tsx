/**
 * Node Policy Tab - Simplified content filtering and blocking
 */

import React, { useState, useEffect } from 'react';

interface BlockedContent {
  version: number;
  updatedAt: number;
  cids: string[];
  peerIds: string[];
}

interface GuildConfig {
  allowedGuilds: 'all' | string[];
  blockedGuilds: string[];
}

interface NodePolicyTabProps {
  config: any;
  onConfigChange: (config: any) => void;
}

export function NodePolicyTab({ config, onConfigChange }: NodePolicyTabProps) {
  const [blockedContent, setBlockedContent] = useState<BlockedContent>({
    version: 1,
    updatedAt: Date.now(),
    cids: [],
    peerIds: []
  });
  const [guildConfig, setGuildConfig] = useState<GuildConfig>({
    allowedGuilds: 'all',
    blockedGuilds: []
  });
  const [newCid, setNewCid] = useState('');
  const [newPeerId, setNewPeerId] = useState('');
  const [newGuildId, setNewGuildId] = useState('');
  const [guildMode, setGuildMode] = useState<'all' | 'allowlist' | 'blocklist'>('all');

  // Load blocked content and guild config on mount
  useEffect(() => {
    loadBlockedContent();
    loadGuildConfig();
  }, []);

  const loadBlockedContent = async () => {
    try {
      const content = await window.bytecave.policy.getBlockedContent();
      setBlockedContent(content);
    } catch (error) {
      console.error('Failed to load blocked content:', error);
    }
  };

  const loadGuildConfig = async () => {
    try {
      const guilds = await window.bytecave.policy.getGuilds();
      setGuildConfig(guilds);
      
      // Determine mode
      if (guilds.allowedGuilds === 'all') {
        setGuildMode(guilds.blockedGuilds.length > 0 ? 'blocklist' : 'all');
      } else {
        setGuildMode('allowlist');
      }
    } catch (error) {
      console.error('Failed to load guild config:', error);
    }
  };

  const handleContentTypeChange = (type: string, checked: boolean) => {
    const currentTypes = config.contentTypes || 'all';
    let types: string[];

    if (currentTypes === 'all') {
      types = ['messages', 'posts', 'media', 'listings'];
    } else {
      types = currentTypes.split(',');
    }

    if (checked) {
      if (!types.includes(type)) {
        types.push(type);
      }
    } else {
      types = types.filter(t => t !== type);
    }

    const newContentTypes = types.length === 4 ? 'all' : types.join(',');
    onConfigChange({ ...config, contentTypes: newContentTypes });
  };

  const isContentTypeEnabled = (type: string): boolean => {
    const currentTypes = config.contentTypes || 'all';
    if (currentTypes === 'all') return true;
    return currentTypes.split(',').includes(type);
  };

  const handleBlockCid = async () => {
    if (!newCid.trim()) return;
    
    try {
      await window.bytecave.policy.blockCid(newCid.trim());
      setNewCid('');
      await loadBlockedContent();
    } catch (error) {
      console.error('Failed to block CID:', error);
      alert('Failed to block CID: ' + error);
    }
  };

  const handleUnblockCid = async (cid: string) => {
    try {
      await window.bytecave.policy.unblockCid(cid);
      await loadBlockedContent();
    } catch (error) {
      console.error('Failed to unblock CID:', error);
    }
  };

  const handleBlockPeer = async () => {
    if (!newPeerId.trim()) return;
    
    try {
      await window.bytecave.policy.blockPeer(newPeerId.trim());
      setNewPeerId('');
      await loadBlockedContent();
    } catch (error) {
      console.error('Failed to block peer:', error);
      alert('Failed to block peer: ' + error);
    }
  };

  const handleUnblockPeer = async (peerId: string) => {
    try {
      await window.bytecave.policy.unblockPeer(peerId);
      await loadBlockedContent();
    } catch (error) {
      console.error('Failed to unblock peer:', error);
    }
  };

  const handleGuildModeChange = async (mode: 'all' | 'allowlist' | 'blocklist') => {
    setGuildMode(mode);
    
    let newConfig: GuildConfig;
    if (mode === 'all') {
      newConfig = { allowedGuilds: 'all', blockedGuilds: [] };
    } else if (mode === 'allowlist') {
      newConfig = { allowedGuilds: [], blockedGuilds: [] };
    } else {
      newConfig = { allowedGuilds: 'all', blockedGuilds: guildConfig.blockedGuilds };
    }
    
    try {
      await window.bytecave.policy.setGuilds(newConfig);
      setGuildConfig(newConfig);
    } catch (error) {
      console.error('Failed to update guild mode:', error);
    }
  };

  const handleAddGuild = async () => {
    if (!newGuildId.trim()) return;
    
    try {
      const newConfig = { ...guildConfig };
      
      if (guildMode === 'allowlist') {
        if (Array.isArray(newConfig.allowedGuilds)) {
          newConfig.allowedGuilds.push(newGuildId.trim());
        }
      } else if (guildMode === 'blocklist') {
        newConfig.blockedGuilds.push(newGuildId.trim());
      }
      
      await window.bytecave.policy.setGuilds(newConfig);
      setGuildConfig(newConfig);
      setNewGuildId('');
    } catch (error) {
      console.error('Failed to add guild:', error);
    }
  };

  const handleRemoveGuild = async (guildId: string, list: 'allowed' | 'blocked') => {
    try {
      const newConfig = { ...guildConfig };
      
      if (list === 'allowed' && Array.isArray(newConfig.allowedGuilds)) {
        newConfig.allowedGuilds = newConfig.allowedGuilds.filter(id => id !== guildId);
      } else if (list === 'blocked') {
        newConfig.blockedGuilds = newConfig.blockedGuilds.filter(id => id !== guildId);
      }
      
      await window.bytecave.policy.setGuilds(newConfig);
      setGuildConfig(newConfig);
    } catch (error) {
      console.error('Failed to remove guild:', error);
    }
  };

  return (
    <div className="tab-content">
      <h2>🛡️ Node Policy</h2>
      
      {/* Content Types */}
      <section className="policy-section">
        <h3>Content Types to Store</h3>
        <p className="help-text">Choose which types of content this node will store</p>
        
        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={isContentTypeEnabled('messages')}
              onChange={(e) => handleContentTypeChange('messages', e.target.checked)}
            />
            <span>Messages</span>
            <span className="help-text">Direct messages and chats</span>
          </label>
          
          <label>
            <input
              type="checkbox"
              checked={isContentTypeEnabled('posts')}
              onChange={(e) => handleContentTypeChange('posts', e.target.checked)}
            />
            <span>Posts</span>
            <span className="help-text">Social posts and comments</span>
          </label>
          
          <label>
            <input
              type="checkbox"
              checked={isContentTypeEnabled('media')}
              onChange={(e) => handleContentTypeChange('media', e.target.checked)}
            />
            <span>Media</span>
            <span className="help-text">Images and videos</span>
          </label>
          
          <label>
            <input
              type="checkbox"
              checked={isContentTypeEnabled('listings')}
              onChange={(e) => handleContentTypeChange('listings', e.target.checked)}
            />
            <span>Listings</span>
            <span className="help-text">Marketplace listings</span>
          </label>
        </div>
      </section>

      {/* Guild Filtering */}
      <section className="policy-section">
        <h3>Guild Filtering</h3>
        <p className="help-text">Control which guilds/groups this node accepts content from</p>
        
        <div className="radio-group">
          <label>
            <input
              type="radio"
              checked={guildMode === 'all'}
              onChange={() => handleGuildModeChange('all')}
            />
            <span>Accept all guilds</span>
          </label>
          
          <label>
            <input
              type="radio"
              checked={guildMode === 'allowlist'}
              onChange={() => handleGuildModeChange('allowlist')}
            />
            <span>Only specific guilds (allowlist)</span>
          </label>
          
          <label>
            <input
              type="radio"
              checked={guildMode === 'blocklist'}
              onChange={() => handleGuildModeChange('blocklist')}
            />
            <span>Block specific guilds</span>
          </label>
        </div>

        {guildMode === 'allowlist' && (
          <div className="list-manager">
            <h4>Allowed Guilds</h4>
            <div className="input-group">
              <input
                type="text"
                value={newGuildId}
                onChange={(e) => setNewGuildId(e.target.value)}
                placeholder="Guild ID"
                onKeyPress={(e) => e.key === 'Enter' && handleAddGuild()}
              />
              <button onClick={handleAddGuild}>Add</button>
            </div>
            <ul className="item-list">
              {Array.isArray(guildConfig.allowedGuilds) && guildConfig.allowedGuilds.map(guildId => (
                <li key={guildId}>
                  <span>{guildId}</span>
                  <button onClick={() => handleRemoveGuild(guildId, 'allowed')}>Remove</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {guildMode === 'blocklist' && (
          <div className="list-manager">
            <h4>Blocked Guilds</h4>
            <div className="input-group">
              <input
                type="text"
                value={newGuildId}
                onChange={(e) => setNewGuildId(e.target.value)}
                placeholder="Guild ID"
                onKeyPress={(e) => e.key === 'Enter' && handleAddGuild()}
              />
              <button onClick={handleAddGuild}>Add</button>
            </div>
            <ul className="item-list">
              {guildConfig.blockedGuilds.map(guildId => (
                <li key={guildId}>
                  <span>{guildId}</span>
                  <button onClick={() => handleRemoveGuild(guildId, 'blocked')}>Remove</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Blocked CIDs */}
      <section className="policy-section">
        <h3>Blocked Content (CIDs)</h3>
        <p className="help-text">Block specific content by CID (e.g., DMCA takedowns)</p>
        
        <div className="list-manager">
          <div className="input-group">
            <input
              type="text"
              value={newCid}
              onChange={(e) => setNewCid(e.target.value)}
              placeholder="bafybei..."
              onKeyPress={(e) => e.key === 'Enter' && handleBlockCid()}
            />
            <button onClick={handleBlockCid}>Block CID</button>
          </div>
          
          <ul className="item-list">
            {blockedContent.cids.length === 0 ? (
              <li className="empty">No blocked CIDs</li>
            ) : (
              blockedContent.cids.map(cid => (
                <li key={cid}>
                  <span className="monospace">{cid}</span>
                  <button onClick={() => handleUnblockCid(cid)}>Unblock</button>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      {/* Blocked Peers */}
      <section className="policy-section">
        <h3>Blocked Peers</h3>
        <p className="help-text">Block specific peers from storing content on this node</p>
        
        <div className="list-manager">
          <div className="input-group">
            <input
              type="text"
              value={newPeerId}
              onChange={(e) => setNewPeerId(e.target.value)}
              placeholder="12D3KooW..."
              onKeyPress={(e) => e.key === 'Enter' && handleBlockPeer()}
            />
            <button onClick={handleBlockPeer}>Block Peer</button>
          </div>
          
          <ul className="item-list">
            {blockedContent.peerIds.length === 0 ? (
              <li className="empty">No blocked peers</li>
            ) : (
              blockedContent.peerIds.map(peerId => (
                <li key={peerId}>
                  <span className="monospace">{peerId}</span>
                  <button onClick={() => handleUnblockPeer(peerId)}>Unblock</button>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
