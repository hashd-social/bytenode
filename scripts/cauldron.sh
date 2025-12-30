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
mkdir -p "$PROJECT_DIR/test-data/bat-1"
mkdir -p "$PROJECT_DIR/test-data/bat-2"
mkdir -p "$PROJECT_DIR/test-data/bat-3"
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
            RELAY_PEER="/ip4/127.0.0.1/tcp/4001/p2p/$RELAY_PEER_ID"
            echo "✓ Detected relay: $RELAY_PEER"
        else
            echo "⚠️  Could not detect relay peer ID"
            echo "   Make sure bytecave-relay Docker container is running"
            echo "   Run: docker logs $RELAY_CONTAINER"
            exit 1
        fi
    else
        echo "ERROR: bytecave-relay Docker container not running"
        echo "Start it with: ./start-all.sh or manually start the relay"
        exit 1
    fi
fi

# Contract addresses from hardhat deployment
# TODO: Update these after running hardhat deploy scripts
RPC_URL="${RPC_URL:-http://localhost:8545}"
VAULT_REGISTRY_ADDRESS="${VAULT_REGISTRY_ADDRESS:-}"
MESSAGE_STORAGE_ADDRESS="${MESSAGE_STORAGE_ADDRESS:-}"
POST_STORAGE_ADDRESS="${POST_STORAGE_ADDRESS:-}"
GROUP_FACTORY_ADDRESS="${GROUP_FACTORY_ADDRESS:-}"

# Launch Instance 1 (Bat Alpha) - Port 5001, P2P 5011-5012
echo -e "${CYAN}🦇 Launching Bat Alpha (port 5001)...${NC}"
BYTENODE_PORT=5001 \
BYTENODE_NODE_ID=bat-alpha \
BYTENODE_P2P_PORTS="5011,5012" \
BYTENODE_RELAY_PEERS="$RELAY_PEER" \
RPC_URL="$RPC_URL" \
VAULT_REGISTRY_ADDRESS="$VAULT_REGISTRY_ADDRESS" \
MESSAGE_STORAGE_ADDRESS="$MESSAGE_STORAGE_ADDRESS" \
POST_STORAGE_ADDRESS="$POST_STORAGE_ADDRESS" \
GROUP_FACTORY_ADDRESS="$GROUP_FACTORY_ADDRESS" \
"$ELECTRON" "$PROJECT_DIR" --user-data-dir="$PROJECT_DIR/test-data/bat-1" > "$PROJECT_DIR/test-data/logs/bat-alpha.log" 2>&1 &
PID1=$!
sleep 2

# Launch Instance 2 (Bat Beta) - Port 5002, P2P 5021-5022
echo -e "${GREEN}🦇 Launching Bat Beta (port 5002)...${NC}"
BYTENODE_PORT=5002 \
BYTENODE_NODE_ID=bat-beta \
BYTENODE_P2P_PORTS="5021,5022" \
BYTENODE_RELAY_PEERS="$RELAY_PEER" \
RPC_URL="$RPC_URL" \
VAULT_REGISTRY_ADDRESS="$VAULT_REGISTRY_ADDRESS" \
MESSAGE_STORAGE_ADDRESS="$MESSAGE_STORAGE_ADDRESS" \
POST_STORAGE_ADDRESS="$POST_STORAGE_ADDRESS" \
GROUP_FACTORY_ADDRESS="$GROUP_FACTORY_ADDRESS" \
"$ELECTRON" "$PROJECT_DIR" --user-data-dir="$PROJECT_DIR/test-data/bat-2" > "$PROJECT_DIR/test-data/logs/bat-beta.log" 2>&1 &
PID2=$!
sleep 2

# Launch Instance 3 (Bat Gamma) - Port 5003, P2P 5031-5032
echo -e "${YELLOW}🦇 Launching Bat Gamma (port 5003)...${NC}"
BYTENODE_PORT=5003 \
BYTENODE_NODE_ID=bat-gamma \
BYTENODE_P2P_PORTS="5031,5032" \
BYTENODE_RELAY_PEERS="$RELAY_PEER" \
RPC_URL="$RPC_URL" \
VAULT_REGISTRY_ADDRESS="$VAULT_REGISTRY_ADDRESS" \
MESSAGE_STORAGE_ADDRESS="$MESSAGE_STORAGE_ADDRESS" \
POST_STORAGE_ADDRESS="$POST_STORAGE_ADDRESS" \
GROUP_FACTORY_ADDRESS="$GROUP_FACTORY_ADDRESS" \
"$ELECTRON" "$PROJECT_DIR" --user-data-dir="$PROJECT_DIR/test-data/bat-3" > "$PROJECT_DIR/test-data/logs/bat-gamma.log" 2>&1 &
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
