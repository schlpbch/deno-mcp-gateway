#!/bin/bash

# Integration test script for server config upload endpoints
# Run this after starting the server with: deno run --allow-net --allow-env main.ts

set -e

BASE_URL="http://localhost:8000"
CONFIG_FILE="servers-config.json"

echo "=== Testing Server Config Upload Endpoints ==="
echo ""

# Test 1: GET /mcp/servers/register (should return empty initially)
echo "1. GET /mcp/servers/register"
curl -X GET "${BASE_URL}/mcp/servers/register" \
  -H "Content-Type: application/json" \
  -s | jq .
echo ""

# Test 2: POST /mcp/servers/register (single server)
echo "2. POST /mcp/servers/register (single server)"
curl -X POST "${BASE_URL}/mcp/servers/register" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-service",
    "name": "Test Service",
    "endpoint": "http://localhost:3000/mcp",
    "requiresSession": false
  }' \
  -s | jq .
echo ""

# Test 3: GET /mcp/servers/register (should now show the registered server)
echo "3. GET /mcp/servers/register (after registration)"
curl -X GET "${BASE_URL}/mcp/servers/register" \
  -H "Content-Type: application/json" \
  -s | jq .
echo ""

# Test 4: POST /mcp/servers/upload (multipart upload)
echo "4. POST /mcp/servers/upload (multipart form)"
curl -X POST "${BASE_URL}/mcp/servers/upload" \
  -F "config=@${CONFIG_FILE}" \
  -s | jq .
echo ""

# Test 5: GET /mcp/servers/test-service/health
echo "5. GET /mcp/servers/test-service/health"
curl -X GET "${BASE_URL}/mcp/servers/test-service/health" \
  -H "Content-Type: application/json" \
  -s | jq .
echo ""

# Test 6: DELETE /mcp/servers/test-service
echo "6. DELETE /mcp/servers/test-service"
curl -X DELETE "${BASE_URL}/mcp/servers/test-service" \
  -H "Content-Type: application/json" \
  -s | jq .
echo ""

# Test 7: GET /mcp/servers/test-service/health (should fail with 404)
echo "7. GET /mcp/servers/test-service/health (after deletion)"
curl -X GET "${BASE_URL}/mcp/servers/test-service/health" \
  -H "Content-Type: application/json" \
  -s | jq .
echo ""

echo "=== All endpoint tests completed ==="
