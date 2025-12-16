#!/bin/bash

# 🦇 Stop all ByteCave desktop instances

echo "🦇 Stopping all desktop bats..."
pkill -f "electron.*bytecave-desktop" 2>/dev/null || true
pkill -f "tsx src/server.ts" 2>/dev/null || true
echo "✅ All bats returned to the cave"
