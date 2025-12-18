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

# Launch Instance 1 (Bat Alpha) - Port 5001, P2P 5011-5012
echo -e "${CYAN}🦇 Launching Bat Alpha (port 5001)...${NC}"
BYTENODE_PORT=5001 \
BYTENODE_NODE_ID=bat-alpha \
BYTENODE_P2P_PORTS="5011,5012" \
"$ELECTRON" "$PROJECT_DIR" --user-data-dir="$PROJECT_DIR/test-data/bat-1" &
PID1=$!
sleep 2

# Launch Instance 2 (Bat Beta) - Port 5002, P2P 5021-5022
echo -e "${GREEN}🦇 Launching Bat Beta (port 5002)...${NC}"
BYTENODE_PORT=5002 \
BYTENODE_NODE_ID=bat-beta \
BYTENODE_P2P_PORTS="5021,5022" \
"$ELECTRON" "$PROJECT_DIR" --user-data-dir="$PROJECT_DIR/test-data/bat-2" &
PID2=$!
sleep 2

# Launch Instance 3 (Bat Gamma) - Port 5003, P2P 5031-5032
echo -e "${YELLOW}🦇 Launching Bat Gamma (port 5003)...${NC}"
BYTENODE_PORT=5003 \
BYTENODE_NODE_ID=bat-gamma \
BYTENODE_P2P_PORTS="5031,5032" \
"$ELECTRON" "$PROJECT_DIR" --user-data-dir="$PROJECT_DIR/test-data/bat-3" &
PID3=$!

echo ""
echo "  Bat Alpha: PID $PID1 (HTTP 5001, P2P 5011/5012)"
echo "  Bat Beta:  PID $PID2 (HTTP 5002, P2P 5021/5022)"
echo "  Bat Gamma: PID $PID3 (HTTP 5003, P2P 5031/5032)"
echo ""
echo "  Stop all: yarn cauldron:stop"
echo ""

# Wait for all to exit
wait $PID1 $PID2 $PID3
