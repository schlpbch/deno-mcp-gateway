# SBB MCP Gateway

The **SBB MCP Gateway** is a unified entry point for AI assistants (like Claude) to access the federated Model Context Protocol (MCP) servers within the Swiss Travel Companion ecosystem.

It provides a single connection point that intelligently routes requests to:

- `journey-service-mcp` (Trip planning, pricing)
- `swiss-mobility-mcp` (Shared mobility)
- `aareguru-mcp` (Aare river safety)
- `open-meteo-mcp` (Weather data)

## 🚀 Key Features

- **Unified Discovery**: Aggregates tools, resources, and prompts from all backend servers.
- **Intelligent Routing**: Routes requests based on namespaced identifiers (e.g., `journey.findTrips`).
- **Response Caching**: In-memory caffeine caching for high-performance tool execution.
- **Health Monitoring**: Automatically detects and isolates unhealthy backend servers.
- **Resilience**: Built-in retry logic and failover handling.
- **Lombok-Free**: Built with modern Java 21 records and standard libraries for maximum stability.

## 🛠️ Technology Stack

- **Java 21 LTS**
- **Spring Boot 3.4**
- **Caffeine** (In-memory caching)
- **Spring Retry**
- **Maven** (Build tool)
- **Google Cloud Run** (Deployment target)

## 📋 Prerequisites

- Java 21 SDK
- Maven 3.9+
- Docker (optional, for containerization)

## 🏃‍♂️ Quick Start

### 1. Build the Project

```bash
mvn clean install
```

### 2. Run Locally

```bash
mvn spring-boot:run
```

The gateway will start on port `8080`.

### 3. Usage with Claude Desktop

Add the gateway to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sbb-gateway": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "gcr.io/sbb-mcp-gateway/mcp-gateway:latest"
      ]
    }
  }
}
```

*Note: For local development, you can point to the local process if running via stdio transport.*

## ⚙️ Configuration

Configuration is managed via `application.yml` and environment variables.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JOURNEY_SERVICE_URL` | URL for Journey Service MCP | `http://journey-service:8080/mcp` |
| `SWISS_MOBILITY_URL` | URL for Swiss Mobility MCP | `http://swiss-mobility:8080/mcp` |
| `AAREGURU_URL` | URL for Aareguru MCP | `http://aareguru:8000/mcp` |
| `OPEN_METEO_URL` | URL for Open-Meteo MCP | `http://open-meteo:8000/mcp` |
| `LOG_LEVEL` | Application logging level | `INFO` |

### Caching Configuration

```yaml
mcp:
  gateway:
    cache:
      default-ttl: 5m
      max-size: 10000
```

## 🔌 API Endpoints

### MCP Protocol

- `POST /mcp/tools/call` - Execute a tool
- `GET /mcp/tools/list` - List available tools
- `POST /mcp/resources/read` - Read a resource
- `GET /mcp/resources/list` - List available resources
- `POST /mcp/prompts/get` - Get a prompt
- `GET /mcp/prompts/list` - List available prompts

### Actuator

- `GET /actuator/health` - Health check status
- `GET /actuator/info` - Application info
- `GET /actuator/prometheus` - Prometheus metrics

## 🏗️ Architecture

The gateway uses a **Hub-and-Spoke** architecture where it acts as the central hub.

### Name Resolution

Tools and prompts are namespaced to avoid collisions:

- `journey.*` -> Journey Service
- `mobility.*` -> Swiss Mobility
- `aareguru.*` -> Aareguru
- `meteo.*` -> Open Meteo

Example: `journey.findTrips` is routed to the Journey Service `findTrips` tool.

## 🧪 Testing

Run unit and integration tests:

```bash
mvn test
```
