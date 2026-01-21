#!/bin/bash

# 🦇 ByteCave Desktop Cauldron - Spawn multiple desktop app instances
# Usage: yarn cauldron

echo "🦇 Starting ByteCave Desktop Cauldron - 3 instances..."
echo ""

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Create separate user data directories for each instance
mkdir -p "$PROJECT_DIR/test-data/bat-alpha"
mkdir -p "$PROJECT_DIR/test-data/bat-beta"
mkdir -p "$PROJECT_DIR/test-data/bat-gamma"
mkdir -p "$PROJECT_DIR/test-data/logs"

# Clear old logs
rm -f "$PROJECT_DIR/test-data/logs/bat-alpha.log"
rm -f "$PROJECT_DIR/test-data/logs/bat-beta.log"
rm -f "$PROJECT_DIR/test-data/logs/bat-gamma.log"

# Build first if needed
if [ ! -f "$PROJECT_DIR/dist/renderer/index.html" ]; then
  echo "Building desktop app first..."
  cd "$PROJECT_DIR" && yarn build
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo -e "${CYAN}🦇 LAUNCHING 3 BYTECAVE DESKTOP INSTANCES${NC}"
echo "════════════════════════════════════════════════════════"
echo ""

# Path to local electron
ELECTRON="$PROJECT_DIR/node_modules/.bin/electron"

# Relay peer address (localhost - Docker port mapping)
# Preferably set by environment variable from start-all.sh
# If not set, try to get from running Docker container, or use localhost default
if [ -z "$RELAY_PEER" ]; then
    echo "⚠️  RELAY_PEER not set, attempting to detect from Docker..."
    
    # Try to get peer ID from running bytecave-relay container
    RELAY_CONTAINER=$(docker ps --format '{{.Names}}' | grep bytecave-relay | head -1)
    if [ ! -z "$RELAY_CONTAINER" ]; then
        RELAY_PEER_ID=$(docker logs "$RELAY_CONTAINER" 2>&1 | grep "Peer ID:" | head -1 | awk '{print $NF}')
        if [ ! -z "$RELAY_PEER_ID" ]; then
            RELAY_PEER="/ip4/127.0.0.1/tcp/4002/ws/p2p/$RELAY_PEER_ID"
            echo "✓ Detected relay: $RELAY_PEER"
        else
            echo "⚠️  Could not detect relay peer ID from container"
        fi
    else
        echo "⚠️  Relay container not running - will use cached bootstrap peers if available"
    fi
fi

# Load environment variables from bytecave-core .env file
BYTECAVE_ENV_FILE="$PROJECT_DIR/../bytecave-core/.env"
if [ -f "$BYTECAVE_ENV_FILE" ]; then
    echo "📋 Loading environment variables from bytecave-core/.env..."
    source "$BYTECAVE_ENV_FILE"
else
    echo "⚠️  bytecave-core/.env not found"
fi

# Load contract addresses from .env.vault if it exists (created by start-all.sh)
ENV_VAULT_FILE="$PROJECT_DIR/../.env.vault"
if [ -f "$ENV_VAULT_FILE" ]; then
    echo "📋 Loading contract addresses from .env.vault..."
    source "$ENV_VAULT_FILE"
else
    echo "⚠️  .env.vault not found - using defaults or environment variables"
fi

# Contract addresses from hardhat deployment
# Default to the deployed contract address if not provided from environment
# Force IPv4 to avoid IPv6 connection issues in Electron
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
VAULT_REGISTRY_ADDRESS="${VAULT_REGISTRY_ADDRESS:-0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690}"

# Meshnet configuration
# Set your NordVPN Meshnet hostname here for VPN-friendly P2P connections
# Format: alexx-atlas.nord (your NordVPN Meshnet hostname)
MESHNET_ADDRESS="${MESHNET_ADDRESS:-}"

# Hardhat default wallets (for testing)
# Wallet 0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (used by dashboard/owner)
# Wallet 1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
WALLET_1_ADDRESS="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
WALLET_1_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
# Wallet 2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
WALLET_2_ADDRESS="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
WALLET_2_KEY="0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
# Wallet 3: 0x90F79bf6EB2c4f870365E785982E1f101E93b906
WALLET_3_ADDRESS="0x90F79bf6EB2c4f870365E785982E1f101E93b906"
WALLET_3_KEY="0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
# Wallet 4: 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
WALLET_4_ADDRESS="0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
WALLET_4_KEY="0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"

# Launch Instance 1 (Bat Alpha) - Port 5001, P2P 5011-5012 - Wallet 1
echo -e "${CYAN}🦇 Launching Bat Alpha (port 5001) - Wallet 1...${NC}"
echo -e "${CYAN}   📋 Environment Variables:${NC}"
echo -e "${CYAN}   VAULT_REGISTRY_ADDRESS: ${VAULT_REGISTRY_ADDRESS:-'NOT SET'}${NC}"
echo -e "${CYAN}   HASHD_TOKEN_ADDRESS: ${HASHD_TOKEN_ADDRESS:-'NOT SET'}${NC}"
echo -e "${CYAN}   CONTENT_REGISTRY_ADDRESS: ${CONTENT_REGISTRY_ADDRESS:-'NOT SET'}${NC}"
echo -e "${CYAN}   RPC_URL: ${RPC_URL:-'NOT SET'}${NC}"
echo -e "${CYAN}   MESHNET_ADDRESS: ${MESHNET_ADDRESS:-'NOT SET'}${NC}"
echo -e "${CYAN}   OWNER_ADDRESS: ${WALLET_1_ADDRESS}${NC}"
echo -e "${CYAN}   NODE_URL: http://localhost:5001${NC}"
echo ""
BYTENODE_PORT=5001 \
BYTENODE_NODE_ID=bat-alpha \
BYTENODE_P2P_PORTS="5011,5012" \
BYTENODE_RELAY_PEERS="$RELAY_PEER" \
NODE_URL="http://localhost:5001" \
VAULT_REGISTRY_ADDRESS="$VAULT_REGISTRY_ADDRESS" \
HASHD_TOKEN_ADDRESS="$HASHD_TOKEN_ADDRESS" \
CONTENT_REGISTRY_ADDRESS="$CONTENT_REGISTRY_ADDRESS" \
CONTENT_REGISTRY_STORAGE_ADDRESS="$CONTENT_REGISTRY_STORAGE_ADDRESS" \
MESHNET_ADDRESS="$MESHNET_ADDRESS" \
OWNER_ADDRESS="$WALLET_1_ADDRESS" \
PRIVATE_KEY="$WALLET_1_KEY" \
"$ELECTRON" "$PROJECT_DIR" --user-data-dir="$PROJECT_DIR/test-data/bat-alpha" > "$PROJECT_DIR/test-data/logs/bat-alpha.log" 2>&1 &
PID1=$!
sleep 2

# Launch Instance 2 (Bat Beta) - Port 5002, P2P 5021-5022 - Wallet 2
echo -e "${GREEN}🦇 Launching Bat Beta (port 5002) - Wallet 2...${NC}"
echo -e "${GREEN}   📋 Environment Variables:${NC}"
echo -e "${GREEN}   VAULT_REGISTRY_ADDRESS: ${VAULT_REGISTRY_ADDRESS:-'NOT SET'}${NC}"
echo -e "${GREEN}   HASHD_TOKEN_ADDRESS: ${HASHD_TOKEN_ADDRESS:-'NOT SET'}${NC}"
echo -e "${GREEN}   CONTENT_REGISTRY_ADDRESS: ${CONTENT_REGISTRY_ADDRESS:-'NOT SET'}${NC}"
echo -e "${GREEN}   RPC_URL: ${RPC_URL:-'NOT SET'}${NC}"
echo -e "${GREEN}   MESHNET_ADDRESS: ${MESHNET_ADDRESS:-'NOT SET'}${NC}"
echo -e "${GREEN}   OWNER_ADDRESS: ${WALLET_2_ADDRESS}${NC}"
echo -e "${GREEN}   NODE_URL: http://localhost:5002${NC}"
echo ""
BYTENODE_PORT=5002 \
BYTENODE_NODE_ID=bat-beta \
BYTENODE_P2P_PORTS="5021,5022" \
BYTENODE_RELAY_PEERS="$RELAY_PEER" \
NODE_URL="http://localhost:5002" \
VAULT_REGISTRY_ADDRESS="$VAULT_REGISTRY_ADDRESS" \
HASHD_TOKEN_ADDRESS="$HASHD_TOKEN_ADDRESS" \
CONTENT_REGISTRY_ADDRESS="$CONTENT_REGISTRY_ADDRESS" \
OWNER_ADDRESS="$WALLET_2_ADDRESS" \
PRIVATE_KEY="$WALLET_2_KEY" \
"$ELECTRON" "$PROJECT_DIR" --user-data-dir="$PROJECT_DIR/test-data/bat-beta" > "$PROJECT_DIR/test-data/logs/bat-beta.log" 2>&1 &
PID2=$!
sleep 2

# Launch Instance 3 (Bat Gamma) - Port 5003, P2P 5031-5032 - Wallet 3
echo -e "${YELLOW}🦇 Launching Bat Gamma (port 5003) - Wallet 3...${NC}"
echo -e "${YELLOW}   📋 Environment Variables:${NC}"
echo -e "${YELLOW}   VAULT_REGISTRY_ADDRESS: ${VAULT_REGISTRY_ADDRESS:-'NOT SET'}${NC}"
echo -e "${YELLOW}   HASHD_TOKEN_ADDRESS: ${HASHD_TOKEN_ADDRESS:-'NOT SET'}${NC}"
echo -e "${YELLOW}   CONTENT_REGISTRY_ADDRESS: ${CONTENT_REGISTRY_ADDRESS:-'NOT SET'}${NC}"
echo -e "${YELLOW}   RPC_URL: ${RPC_URL:-'NOT SET'}${NC}"
echo -e "${YELLOW}   MESHNET_ADDRESS: ${MESHNET_ADDRESS:-'NOT SET'}${NC}"
echo -e "${YELLOW}   OWNER_ADDRESS: ${WALLET_3_ADDRESS}${NC}"
echo -e "${YELLOW}   NODE_URL: http://localhost:5003${NC}"
echo ""
BYTENODE_PORT=5003 \
BYTENODE_NODE_ID=bat-gamma \
BYTENODE_P2P_PORTS="5031,5032" \
BYTENODE_RELAY_PEERS="$RELAY_PEER" \
NODE_URL="http://localhost:5003" \
VAULT_REGISTRY_ADDRESS="$VAULT_REGISTRY_ADDRESS" \
HASHD_TOKEN_ADDRESS="$HASHD_TOKEN_ADDRESS" \
CONTENT_REGISTRY_ADDRESS="$CONTENT_REGISTRY_ADDRESS" \
OWNER_ADDRESS="$WALLET_3_ADDRESS" \
PRIVATE_KEY="$WALLET_3_KEY" \
"$ELECTRON" "$PROJECT_DIR" --user-data-dir="$PROJECT_DIR/test-data/bat-gamma" > "$PROJECT_DIR/test-data/logs/bat-gamma.log" 2>&1 &
PID3=$!

echo ""
echo "  Bat Alpha: PID $PID1 (HTTP 5001, P2P 5011/5012)"
echo "  Bat Beta:  PID $PID2 (HTTP 5002, P2P 5021/5022)"
echo "  Bat Gamma: PID $PID3 (HTTP 5003, P2P 5031/5032)"
echo ""
echo "  Logs saved to: test-data/logs/"
echo "    - bat-alpha.log"
echo "    - bat-beta.log"
echo "    - bat-gamma.log"
echo ""
echo "  Stop all: yarn cauldron:stop"
echo ""

# Wait for all to exit
wait $PID1 $PID2 $PID3
