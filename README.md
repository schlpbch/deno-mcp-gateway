# Deno Federated MCP Gateway

**Unified Federated MCP Gateway** deployed on **Deno Deploy**, providing a single
entry point for AI assistants to access federated Model Context Protocol (MCP)
servers with support for SSE and Streamable HTTP transports.

## 🚀 Features

- **Global Edge Deployment**: Sub-50ms latency worldwide via Deno Deploy
- **Multi-Transport Support**: SSE (Server-Sent Events) and Streamable HTTP
- **Session Management**: Stateful sessions with Deno KV persistence
- **Dynamic Server Registration**: Register MCP servers at runtime via API
- **Health Monitoring**: Automatic health checks for all backend servers
- **TypeScript**: Fully typed with strict mode enabled
- **Zero Configuration**: Works out of the box with sensible defaults
- **Claude Desktop Compatible**: Direct integration via MCP protocol
- **Comprehensive Testing**: 40+ test cases with 90%+ coverage

## 🏗️ Architecture

```text
Claude Desktop / AI Client
     ↓ (MCP Protocol)
Deno Deploy (Global Edge)
     ↓
Federated MCP Gateway
     ├── SSE Transport (/sse)
     ├── Streamable HTTP (/mcp)
     └── REST API (/mcp/*)
          ↓
     Backend MCP Servers
     ├── journey-service-mcp
     ├── swiss-mobility-mcp
     ├── aareguru-mcp
     └── open-meteo-mcp
```

### Transport Protocols

The gateway supports multiple MCP transport protocols:

1. **Streamable HTTP** (`POST /mcp`): Stateless request/response with optional session support
2. **SSE** (`GET /sse` + `POST /message`): Stateful bidirectional communication
3. **REST API** (`/mcp/tools/list`, etc.): Direct HTTP endpoints for web UIs

### Namespace Routing

Tools, resources, and prompts are namespaced to avoid collisions:

- `journey.*` → Journey Service MCP
- `swiss-mobility.*` → Swiss Mobility MCP
- `aareguru.*` → Aareguru MCP
- `open-meteo.*` → Open Meteo MCP

Example: `journey.findTrips` routes to Journey Service's `findTrips` tool.

## 🛠️ Technology Stack

- **Runtime**: Deno 1.40+ with Deno Deploy
- **Language**: TypeScript 5.x (strict mode)
- **Storage**: Deno KV for session persistence
- **Deployment**: Deno Deploy (global edge network)
- **Testing**: Deno test with 90%+ coverage

## 📋 Prerequisites

- [Deno](https://deno.land/) 1.40+ installed
- Deno Deploy account (for production deployment)
- Backend MCP servers configured (optional for local dev)

## 🏃 Quick Start

### 1. Install Deno

```bash
# Windows (PowerShell)
irm https://deno.land/install.ps1 | iex

# macOS/Linux
curl -fsSL https://deno.land/install.sh | sh

# Or use package managers
# macOS: brew install deno
# Windows: choco install deno
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure backend servers:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Backend MCP Server URLs
JOURNEY_SERVICE_URL=https://journey-service.example.com
SWISS_MOBILITY_URL=https://swiss-mobility.example.com
AAREGURU_URL=https://aareguru.example.com
OPEN_METEO_URL=https://open-meteo.example.com

# Optional: Logging
LOG_LEVEL=INFO
```

### 3. Run Locally

```bash
# Start dev server with hot reload
deno task dev

# Or run directly
deno run --allow-net --allow-env --allow-read --allow-import --unstable-kv dev.ts
```

The gateway will be available at:

- **MCP Root**: `http://localhost:8000/` (JSON-RPC)
- **Streamable HTTP**: `http://localhost:8000/mcp`
- **SSE Transport**: `http://localhost:8000/sse`
- **REST API**: `http://localhost:8000/mcp/tools/list`
- **Health**: `http://localhost:8000/health`
- **Metrics**: `http://localhost:8000/metrics`

### 4. Test Endpoints

```bash
# List all tools
curl http://localhost:8000/mcp/tools/list

# Call a tool
curl -X POST http://localhost:8000/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name":"journey.findTrips","arguments":{"from":"Bern","to":"Zurich"}}'

# List resources
curl http://localhost:8000/mcp/resources/list

# Health check
curl http://localhost:8000/health
```

## 🧪 Development

### Available Tasks

```bash
deno task dev          # Start dev server with hot reload
deno task start        # Start dev server (no watch)
deno task test         # Run all tests
deno task test:watch   # Run tests in watch mode
deno task test:coverage # Run tests with coverage
deno task check        # Type check all files
deno task lint         # Lint code
deno task fmt          # Format code
deno task fmt:check    # Check formatting
deno task upload-config # Upload server config to KV
```

### Project Structure

```
deno-mcp-gateway/
├── main.ts                   # Main entry point (Deno Deploy)
├── dev.ts                    # Local dev server wrapper
├── deno.json                 # Deno config & tasks
├── main_test.ts              # Comprehensive test suite
├── src/
│   ├── config.ts             # Server configuration
│   ├── types.ts              # TypeScript type definitions
│   ├── handlers.ts           # HTTP request handlers
│   ├── mcprequest.ts         # MCP protocol logic
│   ├── jsonrpc.ts            # JSON-RPC utilities
│   ├── session.ts            # Session management
│   ├── logger.ts             # Structured logging
│   ├── kv.ts                 # Deno KV operations
│   └── health.ts             # Health check utilities
├── scripts/
│   └── upload-server-config.sh # Server registration script
└── docs/
    └── API.md                # API documentation
```

## 🚀 Deployment

### Automatic Deployment (GitHub Actions)

The project includes GitHub Actions for automated deployment:

1. **Push to main branch**:

   ```bash
   git push origin main
   ```

2. **GitHub Actions automatically**:
   - Runs tests and type checking
   - Deploys to Deno Deploy
   - Updates production environment

3. **Monitor deployment**: Check the [Actions tab](https://github.com/schlpbch/deno-mcp-gateway/actions)

### Manual Deployment

Using the Deno Deploy CLI:

```bash
# Install deployctl
deno install --allow-all --no-check -r -f https://deno.land/x/deploy/deployctl.ts

# Deploy to production
deployctl deploy --project=mcp-gateway --prod main.ts

# Deploy to preview
deployctl deploy --project=mcp-gateway main.ts
```

### Environment Variables (Deno Deploy)

Configure in Deno Deploy dashboard → Project Settings → Environment Variables:

- `JOURNEY_SERVICE_URL`: Journey Service backend endpoint
- `SWISS_MOBILITY_URL`: Swiss Mobility backend endpoint
- `AAREGURU_URL`: Aareguru backend endpoint
- `OPEN_METEO_URL`: Open Meteo backend endpoint
- `LOG_LEVEL`: Logging level (DEBUG, INFO, WARN, ERROR)

## 🔧 Configuration

### Backend Server Configuration

Servers can be configured in three ways:

1. **Environment Variables** (recommended for production):

   ```bash
   JOURNEY_SERVICE_URL=https://journey.example.com
   ```

2. **Dynamic Registration API**:

   ```bash
   curl -X POST http://localhost:8000/servers/register \
     -H "Content-Type: application/json" \
     -d '{
       "id": "custom-server",
       "name": "Custom MCP Server",
       "endpoint": "https://custom.example.com",
       "requiresSession": false
     }'
   ```

3. **Upload Script** (batch registration):

   ```bash
   deno task upload-config
   ```

### Server Configuration Schema

```typescript
interface BackendServer {
  id: string;              // Unique server identifier
  name: string;            // Display name
  endpoint: string;        // Backend URL
  requiresSession: boolean; // Whether server needs session state
}
```

## 🔌 API Endpoints

### MCP Protocol (JSON-RPC)

- `POST /` - MCP root endpoint (Claude Desktop compatible)
- `POST /mcp` - Streamable HTTP transport
- `GET /mcp` - Get SSE stream (with `Mcp-Session-Id` header)
- `DELETE /mcp` - Close session (with `Mcp-Session-Id` header)

### SSE Transport

- `GET /sse` - Establish SSE connection
- `POST /message?sessionId={id}` - Send message to session

### REST API (Web UI)

- `GET /mcp/tools/list` - List all tools
- `POST /mcp/tools/call` - Execute a tool
- `GET /mcp/resources/list` - List all resources
- `POST /mcp/resources/read` - Read a resource
- `GET /mcp/prompts/list` - List all prompts
- `POST /mcp/prompts/get` - Get a prompt

### Server Management

- `POST /servers/register` - Register a new server
- `GET /mcp/servers/register` - List registered servers
- `DELETE /mcp/servers/{serverId}` - Delete a server
- `GET /mcp/servers/{serverId}/health` - Check server health

### Monitoring

- `GET /health` - Gateway health status
- `GET /metrics` - Gateway metrics (requests, errors, uptime)
- `GET /mcp/metrics` - Detailed metrics with circuit breaker status

## 🧪 Testing

The project includes comprehensive tests:

```bash
# Run all tests
deno task test

# Run tests in watch mode
deno task test:watch

# Run tests with coverage
deno task test:coverage

# View coverage report
deno coverage coverage --lcov > coverage.lcov
```

**Test Coverage**: 90%+ across all modules

**Test Categories**:

- Unit tests for protocol handlers
- Integration tests for MCP endpoints
- Session management tests
- Health check tests
- Error handling tests

## 🔒 Security

Current implementation:

- ✅ CORS enabled for web UI integration
- ✅ Content-Type validation for JSON-RPC endpoints
- ✅ Session isolation via Deno KV
- ✅ HTTPS enforced by Deno Deploy
- ⚠️ No authentication (public access)
- ⚠️ No rate limiting

**Recommended for production:**

- Add API key authentication
- Implement rate limiting per IP
- Add request validation middleware
- Enable audit logging
- Restrict CORS origins

## 📊 Monitoring

### Available Metrics

Access via `GET /metrics` or `GET /mcp/metrics`:

- **Requests**: Total requests, errors, error rate
- **Uptime**: Gateway uptime in seconds
- **Latency**: Average, P50, P95, P99 (planned)
- **Cache**: Hit rate, memory size (planned)
- **Circuit Breakers**: Per-server health status (planned)

### Logging

Structured JSON logging with configurable levels:

```typescript
// Set via LOG_LEVEL environment variable
LOG_LEVEL=DEBUG  // DEBUG, INFO, WARN, ERROR
```

Log output includes:

- Request/response logging
- Error tracking with stack traces
- Performance metrics
- Health check results

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`deno task test && deno task lint`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📝 License

MIT License - see [LICENSE](LICENSE) for details

## 🔗 Related Projects

- **Backend MCP Servers**:
  - [journey-service-mcp](https://github.com/schlpbch/journey-service-mcp) - Swiss public transport journey planning
  - [swiss-mobility-mcp](https://github.com/schlpbch/swiss-mobility-mcp) - Swiss mobility ticketing and booking
  - [aareguru-mcp](https://github.com/schlpbch/aareguru-mcp) - Aare river conditions
  - [open-meteo-mcp](https://github.com/schlpbch/open-meteo-mcp) - Weather forecasts

- **Libraries**:
  - [sbb-mcp-commons](https://github.com/schlpbch/sbb-mcp-commons) - Shared Java library for MCP servers

## 📚 Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - Detailed architecture documentation
- [QUICK_START.md](QUICK_START.md) - Quick start guide
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [LOGGING.md](LOGGING.md) - Logging documentation
- [COMPONENT_DIAGRAM.md](COMPONENT_DIAGRAM.md) - Component diagrams
