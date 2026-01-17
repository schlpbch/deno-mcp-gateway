#!/bin/bash

# Register MCP Services via REST API (Bash/curl version)
#
# This script registers all configured MCP services with the deno.dev gateway
# using the REST API endpoint: POST /servers/register
#
# Usage:
#   bash scripts/register-services.sh [GATEWAY_URL]
#
# Examples:
#   bash scripts/register-services.sh http://localhost:8000
#   bash scripts/register-services.sh https://your-project.deno.dev
#   GATEWAY_URL=https://your-project.deno.dev bash scripts/register-services.sh

GATEWAY_URL="${1:-https://deno-mcp-gateway.deno.dev}"

# Gateway URL - can be passed as argument or environment variable
GATEWAY_URL="${1:-${GATEWAY_URL:-}}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Service definitions
declare -a SERVICES=(
  '{"id":"journey-service-mcp","name":"Journey Service MCP","endpoint":"https://journey-service-mcp-staging-jf43t3fcba-oa.a.run.app/mcp","transport":"http","priority":1}'
  '{"id":"swiss-mobility-mcp","name":"Swiss Mobility MCP","endpoint":"https://swiss-mobility-mcp-staging-nag5vm55xa-oa.a.run.app/mcp","transport":"http","priority":2}'
  '{"id":"aareguru-mcp","name":"Aareguru MCP","endpoint":"https://aareguru.fastmcp.app/mcp","transport":"http","priority":3}'
  '{"id":"open-meteo-mcp","name":"Open Meteo MCP","endpoint":"https://open-meteo-mcp.fastmcp.app/mcp","transport":"http","priority":4}'
  '{"id":"swiss-tourism-mcp","name":"Swiss Tourism MCP","endpoint":"https://swiss-tourism-mcp.fastmcp.app/mcp","transport":"http","priority":5}'
)

# Print banner
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  MCP Gateway Service Registration (curl)"
echo "════════════════════════════════════════════════════════════════"
echo "  Gateway: $GATEWAY_URL"
echo "  Services: ${#SERVICES[@]}"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check gateway health
echo -e "${BLUE}🔍 Checking gateway health...${NC}"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$GATEWAY_URL/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Gateway is healthy${NC}"
  echo "   Status: OK"
else
  echo -e "${RED}❌ Gateway returned HTTP $HTTP_CODE${NC}"
  echo "⚠️  Gateway is not responding. Please ensure it is running."
  exit 1
fi

echo ""

# Register each service
REGISTERED=0
FAILED=0

for i in "${!SERVICES[@]}"; do
  SERVICE="${SERVICES[$i]}"

  # Extract fields for display
  ID=$(echo "$SERVICE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  NAME=$(echo "$SERVICE" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
  ENDPOINT=$(echo "$SERVICE" | grep -o '"endpoint":"[^"]*"' | cut -d'"' -f4)

  echo -e "${BLUE}📤 Registering: $NAME${NC}"
  echo "   ID: $ID"
  echo "   Endpoint: $ENDPOINT"

  # Register service
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$GATEWAY_URL/servers/register" \
    -H "Content-Type: application/json" \
    -d "$SERVICE")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n-1)

  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}   ✅ Success${NC}"
    ((REGISTERED++))
  else
    echo -e "${RED}   ❌ Error (HTTP $HTTP_CODE)${NC}"
    echo "   Response: $BODY"
    ((FAILED++))
  fi
  echo ""
done

# List registered services
echo -e "${BLUE}📋 Fetching registered services...${NC}"
LIST_RESPONSE=$(curl -s -w "\n%{http_code}" "$GATEWAY_URL/mcp/servers/register")
HTTP_CODE=$(echo "$LIST_RESPONSE" | tail -n1)
LIST_BODY=$(echo "$LIST_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  COUNT=$(echo "$LIST_BODY" | grep -o '"id"' | wc -l)
  echo -e "${GREEN}✅ Registered Services ($COUNT):${NC}"

  # Parse and display services (simple parsing)
  echo "$LIST_BODY" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | while read name; do
    echo "   • $name"
  done
else
  echo -e "${RED}❌ Failed to fetch services${NC}"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ Registration Summary${NC}"
echo "════════════════════════════════════════════════════════════════"
echo "  Registered: $REGISTERED / ${#SERVICES[@]}"
echo "  Failed: $FAILED"
echo "════════════════════════════════════════════════════════════════"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All services registered successfully!${NC}"
  exit 0
else
  echo -e "${RED}⚠️  Some services failed to register${NC}"
  exit 1
fi
