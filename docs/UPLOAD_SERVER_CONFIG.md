# Server Configuration Upload Script

This script allows you to bulk upload and configure MCP server configurations to
the gateway's dynamic server registry.

## Features

- ✅ Validates gateway connectivity before uploading
- ✅ Validates server configurations (required fields, URL format)
- ✅ Bulk upload multiple servers at once
- ✅ Detailed error reporting
- ✅ Progress feedback
- ✅ Summary statistics

## Files

- `scripts/upload-server-config.ts` - The upload script
- `servers-config.json` - Example configuration file

## Configuration File Format

Create a `servers-config.json` file with the following structure:

```json
{
  "servers": [
    {
      "id": "journey",
      "name": "Journey Service",
      "endpoint": "http://localhost:3001/mcp",
      "requiresSession": true
    },
    {
      "id": "aareguru",
      "name": "Aareguru",
      "endpoint": "http://localhost:3003/mcp",
      "requiresSession": false
    }
  ]
}
```

### Configuration Fields

| Field             | Type    | Required | Description                                                 |
| ----------------- | ------- | -------- | ----------------------------------------------------------- |
| `id`              | string  | ✓        | Unique server identifier (used for routing)                 |
| `name`            | string  | ✓        | Human-readable server name                                  |
| `endpoint`        | string  | ✓        | Full URL to the MCP server endpoint                         |
| `requiresSession` | boolean |          | Whether the server requires MCP-Session-Id (default: false) |

## Usage

### Quick Start (Using Default Settings)

```bash
# Uses servers-config.json and http://localhost:8888
deno task upload-config
```

### With Custom Configuration File

```bash
# Use custom configuration file
deno run --allow-net --allow-read scripts/upload-server-config.ts my-servers.json
```

### With Custom Configuration File and Gateway URL

```bash
# Use custom config and custom gateway URL
deno run --allow-net --allow-read scripts/upload-server-config.ts \
  my-servers.json \
  http://example.com:8888
```

## Examples

### Example 1: Local Development

```bash
# Terminal 1: Start the gateway
deno task dev

# Terminal 2: Upload configurations
deno task upload-config
```

**Output:**

```
📋 MCP Server Configuration Upload Script
==========================================

Gateway URL: http://localhost:8888
Config File: ./servers-config.json

🔍 Verifying gateway connection...
✓ Gateway is reachable

📂 Loading configuration file...
✓ Loaded 4 server(s)

📤 Uploading server configurations...

✓ Successfully registered "Journey Service"
✓ Successfully registered "Aareguru"
✓ Successfully registered "Swiss Mobility"
✓ Successfully registered "Open Meteo"

==========================================
📊 Upload Summary
==========================================
✓ Successful: 4
❌ Failed: 0
📊 Total: 4
```

### Example 2: Custom Configuration File

```bash
# Create a custom configuration
cat > production-servers.json << 'EOF'
{
  "servers": [
    {
      "id": "prod-journey",
      "name": "Production Journey Service",
      "endpoint": "https://journey-service.example.com/mcp",
      "requiresSession": true
    }
  ]
}
EOF

# Upload using the custom file
./scripts/upload-server-config.sh production-servers.json https://gateway.example.com
```

### Example 3: Production Deployment

```bash
# Deploy to production gateway
./scripts/upload-server-config.sh servers-config.json https://mcp-gateway.deno.dev
```

## Error Handling

The script validates configurations and provides detailed error messages:

### Missing Required Fields

```
❌ Invalid server config: missing required fields (id, name, endpoint)
```

### Invalid Endpoint URL

```
❌ Invalid endpoint URL for "Journey Service": not-a-valid-url
```

### Gateway Connection Error

```
❌ Error: Cannot connect to gateway at http://localhost:8888
   Make sure the gateway is running (e.g., deno task dev or deno task start)
```

### Server Registration Failed

```
Failed to register server "Journey Service"
   Error: HTTP 400
```

## API Reference

The script uses the following gateway API endpoint:

### POST `/mcp/servers/register`

Registers a new server with the gateway.

**Request:**

```json
{
  "id": "journey",
  "name": "Journey Service",
  "endpoint": "http://localhost:3001/mcp",
  "requiresSession": true
}
```

**Response (Success):**

```json
{
  "success": true,
  "serverId": "journey",
  "message": "Server \"Journey Service\" registered successfully"
}
```

**Response (Error):**

```json
{
  "error": "Missing required fields: id, name, endpoint"
}
```

## Validation Rules

### Server ID

- Must be a valid string
- Should be URL-safe (lowercase, hyphens, underscores)
- Must be unique across all servers

### Server Name

- Must be a non-empty string
- Human-readable description

### Endpoint

- Must be a valid HTTP/HTTPS URL
- Must be accessible from the gateway
- Should point to the `/mcp` path or equivalent

### Requires Session

- Optional boolean field
- Only set to `true` if the server requires MCP-Session-Id header

## Tips & Best Practices

1. **Start with the example file**: Use the provided `servers-config.json` as a
   template

2. **Validate before uploading**: The script validates all configurations before
   uploading

3. **Test local servers first**: Ensure your MCP servers are running before
   uploading

4. **Use meaningful IDs**: Use lowercase, hyphenated IDs that reflect the server
   purpose

   ```json
   {
     "id": "journey-service", // ✓ Good
     "id": "JourneyService", // ✗ Avoid
     "id": "journey_service" // ✓ Acceptable
   }
   ```

5. **Check gateway health**: The script automatically verifies the gateway is
   reachable

6. **Review output**: Check the summary for any failed uploads

## Troubleshooting

### "Cannot connect to gateway"

Make sure the gateway is running:

```bash
# Start the gateway in a terminal
deno task dev
```

### "Invalid endpoint URL"

Verify the endpoint is a complete URL with protocol and path:

```json
{
  "endpoint": "http://localhost:3001/mcp" // ✓ Valid
}
```

### Server not appearing after upload

1. Check the script output for error messages
2. Verify the gateway is still running
3. Try uploading again - registrations are per-session
4. Check gateway logs for any errors

## Integration with CI/CD

### GitHub Actions

```yaml
- name: Upload Server Configuration
  run: |
    deno run --allow-net --allow-read scripts/upload-server-config.ts \
      servers-config.json \
      ${{ secrets.GATEWAY_URL }}
```

### Docker

```dockerfile
RUN deno run --allow-net --allow-read scripts/upload-server-config.ts \
    servers-config.json \
    http://gateway:8888
```

## Exit Codes

- `0` - All servers uploaded successfully
- `1` - One or more servers failed to upload, or validation error

## Related Documentation

- [Server Registry](../REGISTRY.md)
- [Architecture](../ARCHITECTURE.md)
- [Deployment Guide](../DEPLOYMENT.md)
