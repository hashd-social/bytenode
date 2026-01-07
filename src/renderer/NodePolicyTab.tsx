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
  const [newCid, setNewCid] = useState('');
  const [newPeerId, setNewPeerId] = useState('');

  // Load blocked content on mount
  useEffect(() => {
    loadBlockedContent();
  }, []);

  const loadBlockedContent = async () => {
    try {
      const content = await window.bytecave.policy.getBlockedContent();
      setBlockedContent(content);
    } catch (error) {
      console.error('Failed to load blocked content:', error);
    }
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

  return (
    <div className="tab-content">
      <h2>🛡️ Node Policy</h2>

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
