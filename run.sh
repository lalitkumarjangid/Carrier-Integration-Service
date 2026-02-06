#!/usr/bin/env bash
set -euo pipefail

echo "============================================"
echo "  Cybership Carrier Integration Service"
echo "============================================"
echo ""

echo "[1/3] Installing dependencies..."
npm install --silent
echo "  Done."
echo ""

echo "[2/3] Running TypeScript type check..."
npm run typecheck
echo "  Done."
echo ""

echo "[3/3] Running all tests..."
npm test
echo ""

echo "============================================"
echo "  All steps completed successfully!"
echo "============================================"
