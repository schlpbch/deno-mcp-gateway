#!/bin/bash

# Initialize Federated MCP Gateway with server configuration
# This script registers all backend servers with the gateway

set -e

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8000}"
CONFIG_FILE="${CONFIG_FILE:-./servers-config.json}"

echo "=== Federated MCP Gateway Server Configuration ==="
echo "Gateway URL: $GATEWAY_URL"
echo "Config File: $CONFIG_FILE"
echo ""

# Wait for gateway to be ready
echo "Waiting for gateway to be ready..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if curl -s "$GATEWAY_URL/health" > /dev/null; then
    echo "✅ Gateway is ready"
    break
  fi
  echo "⏳ Waiting... (attempt $((attempt+1))/$max_attempts)"
  sleep 1
  ((attempt++))
done

if [ $attempt -eq $max_attempts ]; then
  echo "❌ Gateway failed to start after $max_attempts seconds"
  exit 1
fi

echo ""
echo "=== Registering Servers ==="
echo ""

# Parse the JSON configuration and register each server
servers=$(cat "$CONFIG_FILE" | jq -r '.servers[] | "\(.id)|\(.name)|\(.endpoint)|\(.requiresSession)"')

while IFS='|' read -r id name endpoint requiresSession; do
  echo "Registering: $name ($id)"
  
  curl -s -X POST "$GATEWAY_URL/mcp/servers/register" \
    -H "Content-Type: application/json" \
    -d "{
      \"id\": \"$id\",
      \"name\": \"$name\",
      \"endpoint\": \"$endpoint\",
      \"requiresSession\": $requiresSession
    }" | jq .
  
  echo "✅ Registered $name"
  echo ""
done <<< "$servers"

echo "=== Configuration Summary ==="
curl -s -X GET "$GATEWAY_URL/mcp/servers/register" | jq '.servers | map({id, name, status: "registered"})'

echo ""
echo "✅ All servers registered successfully!"
