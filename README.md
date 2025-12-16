# Electron Vault

Desktop P2P storage node with libp2p - a next-generation Electron app for running a ByteCave node.

## Features

- **True P2P**: Nodes discover and connect directly using libp2p
- **Content-Addressed Storage**: CID-based addressing ensures data integrity
- **DHT**: Distributed Hash Table for peer and content discovery
- **Gossipsub**: Pubsub for node announcements and coordination
- **mDNS**: Local network peer discovery
- **NAT Traversal**: Circuit relay and DCUtR for connectivity behind NATs
- **HTTP Bridge**: Backward compatibility with existing web app
- **Desktop App**: Electron-based GUI for easy node management

## Architecture

```
bytecave/
├── src/
│   ├── node/           # P2P node implementation
│   │   ├── p2p-node.ts     # libp2p node with protocols
│   │   ├── storage.ts      # CID-based blob storage
│   │   ├── http-bridge.ts  # HTTP API for web compatibility
│   │   └── standalone.ts   # CLI node runner
│   ├── main/           # Electron main process
│   ├── preload/        # Electron preload scripts
│   ├── renderer/       # React desktop UI
│   └── shared/         # Shared types and constants
```

## Installation

```bash
cd bytecave
yarn install
```

## Usage

### Run as Desktop App

```bash
yarn dev      # Development mode with hot reload
yarn build    # Build for production
yarn start    # Run built app
```

### Run as Standalone Node (CLI)

```bash
yarn node:dev   # Development mode with watch
yarn node:start # Production mode
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ID` | auto-generated | Unique node identifier |
| `DATA_DIR` | `~/.bytecave` | Storage directory |
| `HTTP_PORT` | `3004` | HTTP bridge port |
| `MAX_STORAGE_MB` | `1024` | Maximum storage in MB |
| `CONTENT_TYPES` | `all` | Comma-separated: messages,posts,media,listings |
| `BOOTSTRAP_PEERS` | none | Comma-separated multiaddrs |
| `ENABLE_DHT` | `true` | Enable DHT for peer discovery |
| `ENABLE_MDNS` | `true` | Enable mDNS for local discovery |
| `ENABLE_RELAY` | `true` | Enable circuit relay |

## P2P Protocols

| Protocol | Purpose |
|----------|---------|
| `/bytecave/store/1.0.0` | Store new blobs |
| `/bytecave/retrieve/1.0.0` | Retrieve blobs by CID |
| `/bytecave/replicate/1.0.0` | Replicate blobs between nodes |
| `/bytecave/announce/1.0.0` | Announce node capabilities |

## HTTP API (Bridge)

The HTTP bridge provides backward compatibility with the existing web app:

- `GET /health` - Node health check
- `GET /node/info` - Node metadata and capabilities
- `POST /store` - Store a blob
- `GET /blob/:cid` - Retrieve a blob
- `GET /peers` - List known peers
- `GET /stats` - Node statistics

## Comparison with Vault (HTTP)

| Feature | Vault (HTTP) | ByteCave (libp2p) |
|---------|--------------|-------------------|
| Discovery | Contract registry | DHT + mDNS + Bootstrap |
| Communication | REST API | libp2p streams |
| Replication | Manual | Automatic gossip |
| NAT Traversal | None | Circuit relay + DCUtR |
| Offline Support | No | Yes (local storage) |
| Desktop App | No | Yes (Electron) |

## Development

```bash
# Type checking
yarn typecheck

# Linting
yarn lint
```

## License

MIT
