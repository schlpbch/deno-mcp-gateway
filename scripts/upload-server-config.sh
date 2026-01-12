#!/bin/bash

# Server Configuration Upload Script
#
# Uploads MCP server configurations to the gateway's dynamic server registry.
# Usage:
#   ./upload-server-config.sh [config-file] [gateway-url]
#
# Examples:
#   ./upload-server-config.sh
#   ./upload-server-config.sh servers.json
#   ./upload-server-config.sh servers.json http://localhost:8888

set -e

# Configuration
DEFAULT_GATEWAY_URL="http://localhost:8888"
DEFAULT_CONFIG_FILE="./servers-config.json"
CONFIG_FILE="${1:-$DEFAULT_CONFIG_FILE}"
GATEWAY_URL="${2:-$DEFAULT_GATEWAY_URL}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Header
echo -e "📋 MCP Server Configuration Upload Script"
echo "=========================================="
echo ""
echo "Gateway URL: $GATEWAY_URL"
echo "Config File: $CONFIG_FILE"
echo ""

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
  echo -e "${RED}❌ Error: Configuration file not found: $CONFIG_FILE${NC}"
  exit 1
fi

# Verify gateway connection
echo "🔍 Verifying gateway connection..."
if ! curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/health" | grep -q "200"; then
  echo -e "${RED}❌ Error: Cannot connect to gateway at $GATEWAY_URL${NC}"
  echo "   Make sure the gateway is running (e.g., deno task dev or deno task start)"
  exit 1
fi
echo -e "${GREEN}✓ Gateway is reachable${NC}"
echo ""

# Load and validate config
echo "📂 Loading configuration file..."
if ! command -v jq &> /dev/null; then
  echo -e "${YELLOW}⚠️  jq is not installed. Install it to validate JSON.${NC}"
  echo "   Ubuntu/Debian: sudo apt-get install jq"
  echo "   macOS: brew install jq"
  echo ""
fi

# Count servers
SERVER_COUNT=$(grep -c '"id"' "$CONFIG_FILE" 2>/dev/null || echo "0")
if [ "$SERVER_COUNT" -eq 0 ]; then
  echo -e "${YELLOW}⚠️  No servers found in configuration${NC}"
  exit 0
fi
echo -e "${GREEN}✓ Loaded $SERVER_COUNT server(s)${NC}"
echo ""

# Extract and upload servers
echo "📤 Uploading server configurations..."
echo ""

SUCCESS_COUNT=0
FAILURE_COUNT=0

# Parse JSON with jq if available, otherwise use grep/sed
if command -v jq &> /dev/null; then
  # Use jq for proper JSON parsing
  jq -r '.servers[] | "\(.id)|\(.name)|\(.endpoint)|\(.requiresSession // false)"' "$CONFIG_FILE" | while IFS='|' read -r id name endpoint requires_session; do
    # Validate fields
    if [ -z "$id" ] || [ -z "$name" ] || [ -z "$endpoint" ]; then
      echo -e "${RED}❌ Invalid server config: missing required fields${NC}"
      ((FAILURE_COUNT++))
      continue
    fi

    # Validate URL format (basic check)
    if ! echo "$endpoint" | grep -qE '^https?://'; then
      echo -e "${RED}❌ Invalid endpoint URL for \"$name\": $endpoint${NC}"
      ((FAILURE_COUNT++))
      continue
    fi

    # Upload server
    PAYLOAD=$(cat <<EOF
{
  "id": "$id",
  "name": "$name",
  "endpoint": "$endpoint",
  "requiresSession": $requires_session
}
EOF
)

    RESPONSE=$(curl -s -X POST "$GATEWAY_URL/mcp/servers/register" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" 2>/dev/null || echo '{"error": "Connection failed"}')

    # Check if error in response
    if echo "$RESPONSE" | grep -q '"error"'; then
      ERROR=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
      echo -e "${RED}Failed to register server \"$name\"${NC}"
      echo "   Error: $ERROR"
      ((FAILURE_COUNT++))
    else
      echo -e "${GREEN}✓ Successfully registered \"$name\"${NC}"
      ((SUCCESS_COUNT++))
    fi
  done
else
  # Fallback: simple line-by-line parsing (less reliable but works without jq)
  while IFS= read -r line; do
    if echo "$line" | grep -q '"id"'; then
      id=$(echo "$line" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    fi
    if echo "$line" | grep -q '"name"'; then
      name=$(echo "$line" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
    fi
    if echo "$line" | grep -q '"endpoint"'; then
      endpoint=$(echo "$line" | grep -o '"endpoint":"[^"]*"' | cut -d'"' -f4)
    fi
    if echo "$line" | grep -q '"requiresSession"'; then
      requires_session=$(echo "$line" | grep -o '"requiresSession":[^,}]*' | cut -d':' -f2)
    fi

    # Upload when we have all fields
    if [ -n "$id" ] && [ -n "$name" ] && [ -n "$endpoint" ] && echo "$line" | grep -q '}'; then
      if echo "$endpoint" | grep -qE '^https?://'; then
        PAYLOAD=$(cat <<EOF
{
  "id": "$id",
  "name": "$name",
  "endpoint": "$endpoint",
  "requiresSession": ${requires_session:-false}
}
EOF
)
        RESPONSE=$(curl -s -X POST "$GATEWAY_URL/mcp/servers/register" \
          -H "Content-Type: application/json" \
          -d "$PAYLOAD" 2>/dev/null || echo '{"error": "Connection failed"}')

        if echo "$RESPONSE" | grep -q '"error"'; then
          echo -e "${RED}Failed to register server \"$name\"${NC}"
          ((FAILURE_COUNT++))
        else
          echo -e "${GREEN}✓ Successfully registered \"$name\"${NC}"
          ((SUCCESS_COUNT++))
        fi
      else
        echo -e "${RED}❌ Invalid endpoint URL for \"$name\": $endpoint${NC}"
        ((FAILURE_COUNT++))
      fi

      # Reset variables
      id=""
      name=""
      endpoint=""
      requires_session=""
    fi
  done < "$CONFIG_FILE"
fi

# Summary
echo ""
echo "=========================================="
echo "📊 Upload Summary"
echo "=========================================="
echo -e "${GREEN}✓ Successful: $SUCCESS_COUNT${NC}"
echo -e "${RED}❌ Failed: $FAILURE_COUNT${NC}"
echo "📊 Total: $((SUCCESS_COUNT + FAILURE_COUNT))"

# Exit with error if any failed
[ "$FAILURE_COUNT" -eq 0 ] || exit 1
