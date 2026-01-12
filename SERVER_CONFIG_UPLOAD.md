# Server Configuration Upload Feature - Implementation Guide

## Overview

This document describes the complete implementation of the server configuration upload feature for the MCP Gateway, including backend API endpoints, validation, and testing.

## Architecture

### Backend Components

#### 1. API Endpoints

Three new REST API endpoints have been implemented:

##### `POST /mcp/servers/upload` - Multipart File Upload
Accepts server configuration files in JSON format via multipart form-data.

**Request:**
```bash
curl -X POST http://localhost:8000/mcp/servers/upload \
  -F "config=@servers-config.json"
```

**Response Success (200):**
```json
{
  "success": true,
  "uploaded": 2,
  "failed": 0,
  "servers": [
    {
      "id": "journey-service",
      "name": "Journey Service",
      "endpoint": "http://localhost:3001/mcp",
      "requiresSession": true
    }
  ],
  "errors": null
}
```

**Response Error (400):**
```json
{
  "error": "Invalid configuration",
  "details": [
    "Server 1: invalid endpoint URL: not-a-url",
    "Server 2: duplicate server ID \"service-1\""
  ]
}
```

##### `GET /mcp/servers/{serverId}/health` - Server Health Check
Checks the health status of a registered server.

**Request:**
```bash
curl -X GET http://localhost:8000/mcp/servers/journey-service/health
```

**Response Success (200):**
```json
{
  "id": "journey-service",
  "name": "Journey Service",
  "status": "healthy"
}
```

**Response Error (503 - Unreachable):**
```json
{
  "id": "non-existent-service",
  "name": "Unknown Service",
  "status": "unknown"
}
```

##### `DELETE /mcp/servers/{serverId}` - Unregister Server
Removes a dynamically registered server.

**Request:**
```bash
curl -X DELETE http://localhost:8000/mcp/servers/journey-service
```

**Response Success (200):**
```json
{
  "success": true,
  "message": "Server journey-service deleted"
}
```

**Response Error (404):**
```json
{
  "error": "Server not found: non-existent-service"
}
```

#### 2. Configuration Validation

The `validateServerConfiguration()` function performs comprehensive validation:

- **Structure Validation**: Ensures configuration is a valid JSON object with a "servers" array
- **Required Fields**: Validates that each server has id, name, and endpoint
- **URL Validation**: Verifies endpoints are valid URLs using JavaScript's URL constructor
- **Duplicate Detection**: Checks for duplicate server IDs across the configuration
- **Type Checking**: Ensures `requiresSession` is boolean if provided

**Valid Configuration Example:**
```json
{
  "servers": [
    {
      "id": "journey-service",
      "name": "Journey Service",
      "endpoint": "http://localhost:3001/mcp",
      "requiresSession": true
    },
    {
      "id": "mobility-service",
      "name": "Swiss Mobility Service",
      "endpoint": "http://localhost:3002/mcp",
      "requiresSession": false
    }
  ]
}
```

#### 3. Server State Management

The gateway maintains two data structures:

- **`dynamicServers` Map**: Stores all currently registered servers by ID
- **`backendSessions` Map**: Tracks session IDs for servers requiring sessions (MCP-Session-Id header)

Servers added via:
1. `/mcp/servers/register` (single server POST)
2. `/mcp/servers/upload` (bulk configuration upload)
3. Environment variables (configured on startup)

### File Structure

```
src/endpoints/
├── serverConfigUpload.ts       # Validation and response building utilities
└── serverConfigUpload.test.ts  # Comprehensive test suite (18 tests)

main.ts                         # Integrated endpoint handlers
scripts/
├── upload-server-config.sh     # Bash CLI utility for uploads
```

## Testing

### Unit Tests (18 tests)

Tests are located in `src/endpoints/serverConfigUpload.test.ts`:

**Configuration Validation (6 tests)**
- Valid configuration passes validation
- Missing endpoint detection
- Duplicate server ID detection
- Invalid endpoint URL detection
- Missing servers array detection
- Empty servers array handling

**Server Registration (3 tests)**
- Single server registration
- Duplicate server handling
- Multiple server registration

**Bulk Upload (3 tests)**
- Valid configuration upload
- Mixed valid/invalid configuration handling
- Empty configuration handling

**Server Listing (2 tests)**
- Listing registered servers
- Listing with empty registry

**Server Deletion (2 tests)**
- Deleting existing server
- Handling non-existent server deletion

**Health Checks (2 tests)**
- Health status for registered server
- Health check for non-existent server

**Run Tests:**
```bash
# Run only serverConfigUpload tests
deno test src/endpoints/serverConfigUpload.test.ts --no-check

# Run full test suite
deno task test
```

### Integration Testing

Use the provided bash script to test endpoints against a running server:

```bash
# Start the server in one terminal
deno run --allow-net --allow-env main.ts

# In another terminal, run the integration tests
bash test-endpoints.sh
```

Or test manually with curl:

```bash
# Get current servers
curl http://localhost:8000/mcp/servers/register

# Check a server's health
curl http://localhost:8000/mcp/servers/journey-service/health

# Delete a server
curl -X DELETE http://localhost:8000/mcp/servers/journey-service
```

## Error Handling

### Validation Errors (400)
Returned when configuration is invalid:
- Missing required fields
- Duplicate server IDs
- Invalid URL format
- Type mismatches

### Not Found Errors (404)
Returned when trying to operate on non-existent server:
- Health check on unregistered server
- Delete of unregistered server

### Server Errors (500)
Returned on unexpected failures:
- File upload processing errors
- JSON parsing errors
- Configuration parsing errors

### Service Unavailable (503)
Returned when server is unreachable:
- Health check times out (5-second timeout)
- Connection refused
- Other network errors

## Implementation Details

### Multipart Form Parsing

The upload endpoint manually parses multipart form-data:

1. Extracts boundary from Content-Type header
2. Splits request body by boundary markers
3. Locates the "config" field containing JSON
4. Parses JSON configuration
5. Validates and registers servers

### Health Check Implementation

Health checks are performed with:
- 5-second timeout
- Simple GET request to server endpoint
- Status determination based on HTTP response code (200 = healthy)
- Graceful handling of timeouts and connection errors

### Response Building

Helper functions build consistent response structures:

- `buildBulkUploadResponse()`: Returns upload summary with successful/failed counts
- `buildHealthStatusResponse()`: Returns server health with status
- `jsonResponse()`: Wraps response in JSON with proper headers
- `buildErrorResponse()`: Creates standardized error responses

## CLI Upload Tool

A bash script is provided for command-line uploads:

```bash
# Using deno task (configured in deno.json)
deno task upload-config ./servers-config.json http://localhost:8000

# Or directly
./scripts/upload-server-config.sh ./servers-config.json http://localhost:8000
```

The script:
- Validates file exists
- Sends multipart form-data POST request
- Pretty-prints JSON response
- Returns appropriate exit codes

## Performance Considerations

- **Validation**: O(n) complexity where n = number of servers
- **Registration**: O(1) map insertion per server
- **Health Checks**: 5-second timeout prevents hanging
- **Memory**: In-memory storage suitable for production with reasonable server counts

## Security

- No authentication required for dynamic server registration
- Consider adding API key authentication in production
- Server IDs should be validated to prevent injection
- Endpoint URLs should be validated to prevent SSRF attacks

## Future Enhancements

1. **Persistent Storage**: Save registered servers to disk/database
2. **Authentication**: Add API key or JWT authentication
3. **RBAC**: Role-based access control for server management
4. **Metrics**: Track registration/deletion operations
5. **Event Notifications**: Publish server registration events
6. **Server Groups**: Organize servers into logical groups
7. **Load Balancing**: Support multiple endpoints per server
8. **Automatic Discovery**: Poll for server availability

## Troubleshooting

### Servers not persisting after restart
- Currently servers are stored in-memory only
- Restart clears all dynamically registered servers
- Solution: Use persistent storage or pre-configure in deno.json

### Upload fails with "No boundary in multipart request"
- Check that Content-Type header includes boundary parameter
- Verify curl/client is sending multipart data correctly

### Health check always shows "unknown"
- Verify server endpoint is accessible
- Check firewall/network connectivity
- Ensure server is running on configured port

### Validation errors for valid URLs
- Ensure URL includes protocol (http:// or https://)
- Check for special characters that need encoding
- Verify hostname/port are reachable

## References

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Deno Documentation](https://docs.deno.com/)
- [URL Standard](https://url.spec.whatwg.org/)
