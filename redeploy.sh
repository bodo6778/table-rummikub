#!/bin/bash
set -e

cd /opt/table-rummikub

echo "Pulling latest changes..."
git pull

echo "Rebuilding and restarting containers..."
docker compose up -d --build

echo "Waiting for containers to start..."
sleep 3

echo "Container status:"
docker compose ps

echo ""
echo "Health check:"
curl -sf http://localhost:8080/health && echo " ✓ Server healthy" || echo " ✗ Server not responding"