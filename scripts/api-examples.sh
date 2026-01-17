#!/bin/bash

# API Usage Examples for Deno.dev MCP Gateway
#
# This script demonstrates how to use the REST API endpoints
# to manage and interact with the MCP gateway.
#
# Usage:
#   ./api-examples.sh <gateway_url>
#
# Example:
#   ./api-examples.sh https://deno-mcp-gateway.deno.dev

GATEWAY_URL="${1:-https://deno-mcp-gateway.deno.dev}"

echo "════════════════════════════════════════════════════════════════"
echo "  MCP Gateway REST API Examples"
echo "════════════════════════════════════════════════════════════════"
echo "Gateway URL: $GATEWAY_URL"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print section headers
print_section() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

# Function to print example
print_example() {
  echo -e "${YELLOW}$1${NC}"
  echo "Command:"
  echo "$2"
  echo ""
}

# Health Check
print_section "1. Check Gateway Health"
print_example "Check if the gateway is running and healthy" \
  "curl -s $GATEWAY_URL/health | jq ."

# List Registered Services
print_section "2. List All Registered Services"
print_example "Fetch all dynamically registered services" \
  "curl -s $GATEWAY_URL/mcp/servers/register | jq ."

# Register a Single Service
print_section "3. Register a New Service"
print_example "Register Journey Service MCP" \
  'curl -X POST $GATEWAY_URL/servers/register \
  -H "Content-Type: application/json" \
  -d '"'"'{
    "id": "journey-service-mcp",
    "name": "Journey Service MCP",
    "endpoint": "https://journey-service-mcp-staging-jf43t3fcba-oa.a.run.app/mcp",
    "transport": "http",
    "priority": 1
  }'"'"' | jq .'

# Check Service Health
print_section "4. Check Individual Service Health"
print_example "Check health of Journey Service" \
  "curl -s $GATEWAY_URL/mcp/servers/journey-service-mcp/health | jq ."

# List Tools
print_section "5. List Available Tools"
print_example "Fetch all tools from all registered services" \
  "curl -s $GATEWAY_URL/mcp/tools/list | jq ."

# Call a Tool
print_section "6. Call a Tool"
print_example "Example tool call (adjust tool name and arguments)" \
  'curl -X POST $GATEWAY_URL/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '"'"'{
    "toolName": "example_tool",
    "arguments": {
      "param1": "value1"
    }
  }'"'"' | jq .'

# List Resources
print_section "7. List Available Resources"
print_example "Fetch all resources from all registered services" \
  "curl -s $GATEWAY_URL/mcp/resources/list | jq ."

# Read a Resource
print_section "8. Read a Resource"
print_example "Example resource read (adjust resource URI)" \
  'curl -X POST $GATEWAY_URL/mcp/resources/read \
  -H "Content-Type: application/json" \
  -d '"'"'{
    "uri": "resource://example"
  }'"'"' | jq .'

# List Prompts
print_section "9. List Available Prompts"
print_example "Fetch all prompts from all registered services" \
  "curl -s $GATEWAY_URL/mcp/prompts/list | jq ."

# Get a Prompt
print_section "10. Get a Prompt"
print_example "Example prompt get (adjust prompt name)" \
  'curl -X POST $GATEWAY_URL/mcp/prompts/get \
  -H "Content-Type: application/json" \
  -d '"'"'{
    "name": "example_prompt"
  }'"'"' | jq .'

# Get Gateway Metrics
print_section "11. Get Gateway Metrics"
print_example "Fetch gateway performance metrics" \
  "curl -s $GATEWAY_URL/metrics | jq ."

# Delete a Service
print_section "12. Delete a Registered Service"
print_example "Remove a service from the gateway" \
  "curl -X DELETE $GATEWAY_URL/mcp/servers/journey-service-mcp | jq ."

# JSON-RPC POST Request
print_section "13. Direct JSON-RPC Request"
print_example "Send a JSON-RPC request to the gateway (root endpoint)" \
  'curl -X POST $GATEWAY_URL/ \
  -H "Content-Type: application/json" \
  -d '"'"'{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'"'"' | jq .'

# SSE Stream Connection
print_section "14. Connect to SSE Stream"
print_example "Connect to server-sent events stream" \
  "curl -N $GATEWAY_URL/sse"

# Get SSE Stream with Session
print_section "15. Get MCP Stream (SSE)"
print_example "Get MCP stream with session ID" \
  'curl -N $GATEWAY_URL/mcp \
  -H "Mcp-Session-Id: your-session-id"'

# POST Message to Session
print_section "16. Send Message to Session"
print_example "Post a message to a specific session" \
  'curl -X POST "$GATEWAY_URL/message?sessionId=your-session-id" \
  -H "Content-Type: application/json" \
  -d '"'"'{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'"'"' | jq .'

# Batch Operations
print_section "17. Tips for Automation"
cat << 'EOF'
💡 Tips and Tricks:

1. Use jq for JSON formatting:
   curl -s $GATEWAY_URL/mcp/servers/register | jq .

2. Save the output to a file:
   curl -s $GATEWAY_URL/mcp/servers/register > servers.json

3. Check response status:
   curl -w "\nHTTP Status: %{http_code}\n" $GATEWAY_URL/health

4. Include response headers:
   curl -i $GATEWAY_URL/health

5. Use variables in curl:
   GATEWAY_URL="https://your-project.deno.dev"
   curl -s $GATEWAY_URL/health

6. POST with data from file:
   curl -X POST $GATEWAY_URL/servers/register \
     -H "Content-Type: application/json" \
     -d @service.json

7. Debug request details:
   curl -v $GATEWAY_URL/health

8. Use -s for silent mode (no progress bar):
   curl -s $GATEWAY_URL/health
EOF

echo ""
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  For more information, see DENO_DEPLOY_GUIDE.md${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo ""
