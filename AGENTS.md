# ByteCave Desktop - Agent Guide

## Overview
ByteCave Desktop is an Electron-based desktop application that runs ByteCave storage nodes locally. It's primarily used for testing and development with multiple node instances (bat-alpha, bat-beta, bat-gamma).

## Critical Dependencies

### Internal Dependencies
- **bytecave-core** - The core node implementation (loaded directly, not via npm)
- Changes to bytecave-core require restarting desktop nodes to take effect

### External Dependencies
- **Electron** - Desktop application framework
- **React** - UI framework for renderer process
- **bytecave-core** - Loaded from local filesystem

## Build Process

### Standard Build
```bash
cd bytecave-desktop
yarn build
```
- Builds both main process and renderer process
- Not typically required for testing - nodes load bytecave-core directly

### Running Nodes
```bash
yarn start
```
- Starts Electron app with node selection UI
- Can run multiple instances (bat-alpha, bat-beta, bat-gamma)

## **CRITICAL: Node Restart Workflow**

### After bytecave-core Changes
**YOU MUST RESTART NODES:**

1. **Rebuild bytecave-core**
   ```bash
   cd ../bytecave-core
   yarn build
   ```

2. **Kill all Electron apps**
   - Close all running bytecave-desktop instances
   - Or: `pkill -f Electron` (if user requests)

3. **Restart nodes**
   ```bash
   cd ../bytecave-desktop
   yarn start
   ```
   - Select node (bat-alpha, bat-beta, or bat-gamma)
   - Repeat for each node you want running

### Why This Is Critical
- Nodes load bytecave-core code at startup
- Changes to bytecave-core won't take effect until nodes restart
- Running nodes use cached code from when they started

## Test Node Configuration

### Node Instances
Located in `test-data/`:
- **bat-alpha** - Primary test node
- **bat-beta** - Secondary test node  
- **bat-gamma** - Third test node (for replication factor 3)

### Node Data Directories
- `~/.bytecave/bat-alpha/` - bat-alpha data and config
- `~/.bytecave/bat-beta/` - bat-beta data and config
- `~/.bytecave/bat-gamma/` - bat-gamma data and config

Each contains:
- `blobs/` - Stored blob data
- `meta/` - Blob metadata JSON files
- `config.json` - Node configuration
- `peer-cache.json` - Cached peer information

### Log Files
- `test-data/logs/bat-alpha.log` - bat-alpha logs
- `test-data/logs/bat-beta.log` - bat-beta logs
- `test-data/logs/bat-gamma.log` - bat-gamma logs

**IMPORTANT**: Always check logs when debugging issues

## Testing Workflow

### Standard Test Flow
1. Ensure bytecave-core is built
2. Start bat-alpha: `yarn start` → select bat-alpha
3. Start bat-beta: `yarn start` → select bat-beta
4. (Optional) Start bat-gamma: `yarn start` → select bat-gamma
5. Test storage from dashboard or web app
6. Check logs for replication activity

### After bytecave-core Changes
1. Rebuild bytecave-core: `cd ../bytecave-core && yarn build`
2. Kill all Electron instances
3. Restart nodes
4. Test changes
5. Check logs for expected behavior

### Checking Logs
```bash
# View recent logs
tail -100 test-data/logs/bat-alpha.log

# Follow logs in real-time
tail -f test-data/logs/bat-alpha.log

# Search for specific events
grep "Replication" test-data/logs/bat-alpha.log
grep "shouldVerifyOnChain" test-data/logs/bat-alpha.log
```

### Checking Stored Blobs
```bash
# List blob metadata
ls -lt ~/.bytecave/bat-alpha/meta/

# View blob metadata
cat ~/.bytecave/bat-alpha/meta/{CID}.json

# Check blob data
ls -lh ~/.bytecave/bat-alpha/blobs/
```

## Common Issues

### Nodes Not Picking Up bytecave-core Changes
**Symptom**: Code changes don't appear in node behavior
**Solution**:
1. Verify bytecave-core was rebuilt: `cd ../bytecave-core && yarn build`
2. Kill ALL Electron instances (not just close windows)
3. Restart nodes
4. Check logs for new behavior

### Replication Not Working
**Symptom**: Blobs not replicating between nodes
**Solution**:
1. Check all nodes are running and registered on-chain
2. Verify replication factor (default 3)
3. Check logs for "Replication rejected" messages
4. Verify `shouldVerifyOnChain` flag is set correctly
5. Ensure nodes are connected (check peer count in logs)

### Node Won't Start
**Symptom**: Electron app crashes or won't start
**Solution**:
1. Check logs for error messages
2. Verify config.json is valid JSON
3. Check if port is already in use
4. Clear peer cache if corrupted: `rm ~/.bytecave/{node}/peer-cache.json`

### Stale Peer Connections
**Symptom**: Nodes can't connect to each other
**Solution**:
1. Restart all nodes
2. Check bootstrap peers in config.json
3. Verify nodes are on same network
4. Check firewall settings

## Key Features

### Test Storage UI
- Built-in UI for testing blob storage
- Uses bytecave-core directly (not bytecave-browser)
- Useful for testing node functionality

### Node Registration
- Nodes register on-chain with Ethereum wallet
- Requires MetaMask or similar wallet
- Registration persists across restarts

### Replication Monitoring
- Logs show replication activity
- Can monitor blob distribution across nodes
- Health checks run periodically

## Important Files

### Main Process
- `src/main/main.ts` - Electron main process
- `src/main/ipc-handlers.ts` - IPC communication with renderer

### Renderer Process
- `src/renderer/main.tsx` - React UI entry point
- `src/renderer/components/` - UI components

### Configuration
- `test-data/` - Test node data and logs
- Node configs in `~/.bytecave/{node}/config.json`

## Development

### Running in Dev Mode
```bash
yarn dev
```
- Runs with hot reload
- Useful for UI development

### Building for Production
```bash
yarn build
yarn package
```
- Creates distributable Electron app

## Package Manager
- **Yarn** - Always use `yarn` not `npm`
- Lock file: `yarn.lock`

## User Preferences
- User prefers separate components
- Avoid temporary fixes
- Fix lint errors at each step
- Use Yarn as package manager
- Always check logs when debugging
