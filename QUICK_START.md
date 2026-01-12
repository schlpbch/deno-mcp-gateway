# Quick Start - Server Config Upload Feature

## 📋 Feature Overview

The server config upload feature allows you to dynamically register MCP servers without code changes or server restarts.

## 🚀 Quick Start

### 1. Start the Gateway Server
```bash
deno run --allow-net --allow-env main.ts
```
Server will be available at `http://localhost:8000`

### 2. Upload a Server Configuration
```bash
# Create your servers-config.json
cat > servers-config.json << 'EOF'
{
  "servers": [
    {
      "id": "my-service",
      "name": "My Service",
      "endpoint": "http://localhost:3000/mcp",
      "requiresSession": false
    }
  ]
}
EOF

# Upload it
curl -X POST http://localhost:8000/mcp/servers/upload \
  -F "config=@servers-config.json"
```

### 3. Check Server Health
```bash
curl http://localhost:8000/mcp/servers/my-service/health
```

### 4. List All Servers
```bash
curl http://localhost:8000/mcp/servers/register
```

### 5. Delete a Server (if needed)
```bash
curl -X DELETE http://localhost:8000/mcp/servers/my-service
```

## 📝 Configuration Format

Create a JSON file with your server configuration:

```json
{
  "servers": [
    {
      "id": "unique-server-id",
      "name": "Readable Server Name",
      "endpoint": "http://hostname:port/path",
      "requiresSession": false
    }
  ]
}
```

**Fields:**
- `id` (required): Unique identifier for the server
- `name` (required): Human-readable display name
- `endpoint` (required): Full URL to the MCP server endpoint
- `requiresSession` (optional): Set to `true` if server requires MCP-Session-Id header

## 🔧 CLI Tool

Use the included bash script for easier uploads:

```bash
# Using deno task
deno task upload-config ./servers-config.json http://localhost:8000

# Or directly with bash
./scripts/upload-server-config.sh ./servers-config.json http://localhost:8000
```

## ✅ Run Tests

```bash
# Run unit tests (18 tests)
deno test src/endpoints/serverConfigUpload.test.ts --no-check

# Run all tests
deno task test

# Run integration tests against running server
bash test-endpoints.sh
```

## 📚 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/mcp/servers/upload` | Upload server configuration (multipart) |
| GET | `/mcp/servers/{id}/health` | Check server health status |
| DELETE | `/mcp/servers/{id}` | Remove a registered server |
| GET | `/mcp/servers/register` | List all registered servers |
| POST | `/mcp/servers/register` | Register single server (JSON) |

## 📖 Documentation

- **IMPLEMENTATION_SUMMARY.md** - Complete feature overview and summary
- **SERVER_CONFIG_UPLOAD.md** - Detailed technical documentation
- **FEATURE_PLAN_SERVER_CONFIG_UI.md** - Original feature planning document

## 🐛 Troubleshooting

### Upload fails
- Check gateway is running on port 8000
- Verify servers-config.json is valid JSON
- Check Content-Type header includes boundary (curl -F handles this)

### Health check returns "unknown"
- Verify the endpoint URL is correct and accessible
- Check firewall rules
- Ensure server is running on the configured port

### Server registration doesn't persist
- Servers are stored in memory only
- They will be lost on server restart
- For persistence, implement database storage (future feature)

## 💡 Example Scenarios

### Register a Local Development Server
```json
{
  "servers": [
    {
      "id": "local-dev",
      "name": "Local Development Server",
      "endpoint": "http://localhost:3000/mcp",
      "requiresSession": false
    }
  ]
}
```

### Register Multiple Production Servers
```json
{
  "servers": [
    {
      "id": "prod-service-1",
      "name": "Production Service 1",
      "endpoint": "https://api.example.com/service1/mcp",
      "requiresSession": true
    },
    {
      "id": "prod-service-2",
      "name": "Production Service 2",
      "endpoint": "https://api.example.com/service2/mcp",
      "requiresSession": true
    }
  ]
}
```

### Register with Session Support
```json
{
  "servers": [
    {
      "id": "stateful-service",
      "name": "Stateful Service",
      "endpoint": "http://localhost:4000/mcp",
      "requiresSession": true
    }
  ]
}
```

## 🔒 Security Notes

⚠️ Current implementation:
- No authentication required
- Any client can register/delete servers
- Consider adding API key authentication for production

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review SERVER_CONFIG_UPLOAD.md for detailed documentation
3. Run tests to verify functionality: `deno test src/endpoints/serverConfigUpload.test.ts --no-check`

## 🎯 What's Next

- Frontend UI for server management
- Persistent storage for configurations
- Authentication and authorization
- Advanced server monitoring and metrics
- Server grouping and load balancing
