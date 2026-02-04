# ByteNode

ByteCave Desktop, also referred to as ByteNode, is a user-operated ByteCave Core node packaged as a desktop application. It allows individuals to run a storage and relay-capable node on their own machine without needing to manage the underlying networking or configuration manually.

ByteNode participates in the ByteCave peer-to-peer network by storing and replicating encrypted, content-addressed data, advertising availability to peers, and optionally acting as a relay for connectivity. Like all ByteCave nodes, it never sees plaintext data, never holds application encryption keys, and has no special authority over what it stores or serves.

For HASHD users, ByteNode provides a way to support the network directly — improving availability, reducing reliance on third-party infrastructure, and enabling local-first workflows. For developers and operators, it’s the simplest way to run a full ByteCave node without deploying server infrastructure.

## Features

- **Node Management** - Start/stop storage nodes with one click
- **On-Chain Registration** - Register nodes on blockchain with stake management
- **Deregistration** - Deregister nodes and recover staked tokens
- **Configuration UI** - Easy setup for P2P, storage, and blockchain settings
- **Real-time Monitoring** - View node status, peers, storage metrics, and registration status
- **Multi-Instance Testing** - Run multiple node instances for development and testing
- **Integrated Logs** - View node logs directly in the app
- **Tray Integration** - Minimize to system tray for background operation

## Installation

### Download Pre-built Binary

Download the latest release for your platform:
- **macOS**: ByteCave-Desktop-{version}.dmg
- **Windows**: ByteCave-Desktop-{version}.exe
- **Linux**: ByteCave-Desktop-{version}.AppImage

### Build from Source

```bash
# Install dependencies
yarn install

# Run in development mode
yarn dev

# Build for production
yarn build

# Package for distribution
yarn package
```

## Cryptographic Keys

ByteCave nodes use **two different public keys** displayed in the Status tab:

1. **secp256k1 Public Key** (64 bytes uncompressed) - Use this for on-chain node registration
2. **Ed25519 Public Key** (32 bytes) - Auto-managed for storage proofs

**Important:** When registering your node, always use the **secp256k1 public key** (64 bytes uncompressed format).

For detailed information about the different keys, their purposes, security model, and when to use each, see the [bytecave-core README](../bytecave-core/README.md#cryptographic-keys--security-model).

## Quick Start

### 1. Launch Application

Open ByteNode and you'll see the main dashboard.

### 2. Configure Node

Click **Settings** tab and configure:

**Node Identity:**
- Node ID (auto-generated or custom)
- Data Directory path
- HTTP Port (default: 5001)

**P2P Configuration:**
- Enable P2P networking
- Listen addresses (TCP and WebSocket)
- Relay peers (required for NAT traversal)
- Bootstrap peers (optional)

**Storage:**
- Max storage in MB
- Shard count and ranges

**Blockchain:**
- Owner wallet address
- Wallet private key (for registration/deregistration)
- Vault registry contract address
- HASHD token contract address
- RPC URL

### 3. Configure Wallet Private Key (For Registration)

**Security Best Practices:**

1. **Create a Fresh Wallet**
   - Generate a new Ethereum wallet specifically for this node
   - Do NOT reuse an existing wallet with other assets
   - Only fund it with HASHD tokens needed for staking

2. **Add Wallet Private Key to Settings**
   - Go to Settings tab
   - Enter your wallet address in "Owner Wallet Address"
   - Enter your private key in "Wallet Private Key" field (shown as password)
   - Click "Save Configuration"

3. **Alternative: Use .env File**
   - Copy `.env.example` to `.env`
   - Set `OWNER_ADDRESS=0x...`
   - Set `WALLET_PRIVATE_KEY=0x...`
   - Restart the application

**Important:** Your private key is stored locally in `config.json` or `.env` and never transmitted over the network.

### 4. Register Node (Optional)

If you want to register your node on-chain:
1. Configure wallet private key (see above)
2. Configure contract addresses (Registry, HASHD Token, RPC URL)
3. Ensure wallet has 1000+ HASHD tokens
4. Click **Register** button
5. Node will stake 1000 HASHD and register on blockchain

### 5. Start Node

Click **Start Node** button. The node will:
1. Initialize P2P networking
2. Connect to relay peers
3. Discover other nodes
4. Start accepting storage requests

### 6. Monitor Status

View real-time metrics:
- Connection status
- Registration status (on-chain or off-chain)
- Connected peers
- Stored blobs
- Storage usage
- Node health

### 7. Deregister Node (Optional)

To deregister and recover staked tokens:
1. Stop the node if running
2. Click **Deregister** button
3. Staked HASHD tokens will be returned to wallet

## Configuration

### Settings File Location

**macOS**: `~/Library/Application Support/bytecave-desktop/config.json`
**Windows**: `%APPDATA%/bytecave-desktop/config.json`
**Linux**: `~/.config/bytecave-desktop/config.json`

### Configuration Schema

```json
{
  "config": {
    "nodeId": "my-node",
    "dataDir": "/path/to/data",
    "port": 5001,
    "p2pEnabled": true,
    "p2pListenAddresses": [
      "/ip4/0.0.0.0/tcp/5011",
      "/ip4/0.0.0.0/tcp/5012/ws"
    ],
    "p2pBootstrapPeers": [],
    "p2pRelayPeers": [
      "/dns4/relay.example.com/tcp/4001/p2p/12D3KooW..."
    ],
    "p2pEnableRelay": true,
    "maxStorageMB": 10240,
    "shardCount": 1024,
    "nodeShards": [{"start": 0, "end": 1023}],
    "ownerAddress": "0x...",
    "publicKey": "0x..." // Auto-generated, read-only
  }
}
```

### Required Settings

**Relay Peers** (required for P2P discovery):
```
/dns4/relay.example.com/tcp/4001/p2p/RELAY_PEER_ID
```

Get this from your relay node deployment.

**Owner Address** (required for contract registration):
```
0x1234567890123456789012345678901234567890
```

Your Ethereum wallet address.

## Features Guide

### Node Dashboard

- **Status Indicator** - Green (running), Yellow (starting), Red (stopped)
- **Peer Count** - Number of connected P2P peers
- **Storage Stats** - Blobs stored and total size
- **Uptime** - How long node has been running

### Settings Tab

**Node Configuration:**
- Node ID - Unique identifier for your node
- Data Directory - Where blobs are stored
- HTTP Port - API endpoint port
- Public Key - Auto-generated Ed25519 key (read-only)

**P2P Settings:**
- Enable P2P - Toggle P2P networking
- Listen Addresses - Addresses to accept connections
- Relay Nodes - Relay multiaddrs for NAT traversal
- Bootstrap Peers - Additional peers for discovery
- Enable Relay - Use circuit relay transport
- Enable DHT - Distributed hash table for discovery
- Enable mDNS - Local network discovery

**Storage Settings:**
- Max Storage - Maximum storage in MB
- Shard Count - Total shards in network (default: 1024)
- Node Shards - Shard ranges this node handles

**Blockchain Settings:**
- Owner Address - Your wallet address
- Private Key - Wallet private key (required for registration)
- Vault Registry - Contract address
- HASHD Token - HASHD token contract address
- RPC URL - Ethereum RPC endpoint

**Registration:**
- Register - Register node on blockchain (stakes 1000 HASHD)
- Deregister - Deregister node and recover staked tokens
- Status - Shows if node is registered on-chain

### Logs Tab

View real-time logs from the node:
- P2P connection events
- Storage operations
- Error messages
- Performance metrics

Filter logs by level: Info, Warning, Error

### System Tray

Minimize to tray for background operation:
- **Show/Hide** - Toggle window visibility
- **Start/Stop Node** - Quick node control
- **Quit** - Exit application

## Multi-Instance Testing

**Note:** This is primarily a developer/testing feature, not a production multi-node manager.

Run multiple node instances for testing replication:

1. Launch the app multiple times (separate Electron instances)
2. Each instance uses different data directories (e.g., `~/.bytecave/bat-alpha`, `~/.bytecave/bat-beta`)
3. Configure different ports for each instance
4. Assign different shard ranges if needed

Example test setup:
- Instance 1: Port 5001, bat-alpha data directory
- Instance 2: Port 5002, bat-beta data directory
- Instance 3: Port 5003, bat-gamma data directory

Each instance runs independently with no coordination between them.

## Troubleshooting

### Node Won't Start

**Check logs for errors:**
- Port already in use → Change HTTP port
- Data directory not writable → Check permissions
- Missing configuration → Verify all required settings

**Common fixes:**
1. Ensure relay peers are configured
2. Verify owner address is set
3. Check data directory exists and is writable
4. Try different port if 5001 is in use

### No Peers Connecting

**Verify P2P configuration:**
1. Relay peers are correct and reachable
2. P2P is enabled in settings
3. Firewall allows outbound connections
4. Relay node is running and accessible

**Check relay connection:**
```bash
# From relay logs
docker-compose logs relay1 | grep "Peer connected"
```

### Storage Errors

**Check available space:**
- Ensure disk has enough free space
- Verify max storage limit is reasonable
- Check data directory permissions

**Reset if needed:**
1. Stop node
2. Clear data directory
3. Restart node

### Application Crashes

**Collect crash logs:**
- **macOS**: `~/Library/Logs/bytecave-desktop/`
- **Windows**: `%APPDATA%/bytecave-desktop/logs/`
- **Linux**: `~/.config/bytecave-desktop/logs/`

**Common causes:**
- Corrupted configuration → Delete config.json
- Incompatible data → Clear data directory
- Missing dependencies → Reinstall application

## Development

### Project Structure

```
bytecave-desktop/
├── src/
│   ├── main/          # Electron main process
│   │   └── index.ts   # Node management, IPC
│   └── renderer/      # React UI
│       ├── main.tsx   # Main app component
│       └── styles.css # Styling
├── test-data/         # Test configurations
└── package.json
```

### Development Mode

```bash
# Install dependencies
yarn install

# Run in dev mode (hot reload)
yarn dev

# Build TypeScript
yarn build

# Package app
yarn package
```

### IPC Communication

Main process exposes APIs via `contextBridge`:

```typescript
window.bytecave.node.start()
window.bytecave.node.stop()
window.bytecave.node.getStatus()
window.bytecave.config.get()
window.bytecave.config.save(config)
```

### Adding Features

1. Add IPC handler in `src/main/index.ts`
2. Add UI component in `src/renderer/main.tsx`
3. Update types if needed
4. Test in development mode
5. Build and package

## Building for Distribution

### macOS

```bash
yarn package
# Output: dist/ByteCave-Desktop-{version}.dmg
```

**Code signing:**
```bash
export APPLE_ID=your@email.com
export APPLE_ID_PASSWORD=app-specific-password
yarn package
```

### Windows

```bash
yarn package
# Output: dist/ByteCave-Desktop-{version}.exe
```

**Code signing:**
```bash
export WINDOWS_CERTIFICATE_FILE=/path/to/cert.pfx
export WINDOWS_CERTIFICATE_PASSWORD=password
yarn package
```

### Linux

```bash
yarn package
# Output: dist/ByteCave-Desktop-{version}.AppImage
```

## Security

- Private keys stored locally in data directory (ensure proper file system permissions)
- Secure IPC communication between processes via Electron's contextBridge
- Sandboxed renderer process (Electron security best practices)
- No network transmission of private keys

**Important:** The desktop app stores configuration including wallet private keys in plain JSON files. Ensure your data directory has appropriate file system permissions and is not accessible to unauthorized users.

## Performance

- Minimal CPU usage when idle
- Efficient memory management
- Background processing for storage operations
- Optimized P2P connection handling

## System Requirements

- **OS**: macOS 10.13+, Windows 10+, Linux (Ubuntu 18.04+)
- **RAM**: 2GB minimum, 4GB recommended
- **Disk**: 500MB for app + storage space for blobs
- **Network**: Internet connection for P2P networking

## License

MIT

## Related Packages

- **bytecave-core** - Storage node implementation
- **bytecave-relay** - Relay node for NAT traversal
- **bytecave-browser** - Browser client library

## Roadmap

### Planned Features

- **Auto-Update System** - Implement `electron-updater` for automatic application updates
  - Signature verification for update packages
  - Configurable update channels (stable, beta)
  - User-controlled update preferences
- **Enhanced Multi-Node UI** - Built-in interface for managing multiple nodes from single app
- **Performance Metrics Dashboard** - Real-time charts for storage, bandwidth, and replication
- **Backup & Restore** - Automated backup of node keys and configuration

## Support

For issues and questions:
- GitHub Issues: https://github.com/your-org/bytecave/issues
- Documentation: https://docs.bytecave.io
- Discord: https://discord.gg/bytecave
