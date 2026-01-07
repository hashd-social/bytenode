#!/bin/bash

# Start ByteCave Desktop with relay configuration
# Usage: ./scripts/start-with-relay.sh [node-id] [port] [p2p-port]

NODE_ID=${1:-bat-alpha}
PORT=${2:-5001}
P2P_PORT=${3:-5011}
P2P_WS_PORT=$((P2P_PORT + 1))

# Current relay peer ID
RELAY_PEER="/ip4/127.0.0.1/tcp/4001/p2p/12D3KooWFTy8J6cHuz7qCbX8LoDcEwRExhAfRfCrYS3DXwF7cH14"

echo "Starting ByteCave Desktop: $NODE_ID"
echo "Port: $PORT"
echo "P2P Ports: $P2P_PORT, $P2P_WS_PORT"
echo "Relay: $RELAY_PEER"

BYTENODE_NODE_ID=$NODE_ID \
BYTENODE_PORT=$PORT \
BYTENODE_P2P_PORTS="$P2P_PORT,$P2P_WS_PORT" \
BYTENODE_RELAY_PEERS=$RELAY_PEER \
yarn dev
