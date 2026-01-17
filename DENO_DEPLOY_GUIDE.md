# Deno.dev Gateway Deployment Guide

This guide explains how to deploy and configure the MCP Gateway on deno.dev with your configured services.

## Quick Start

### 1. Prerequisites

- [Deno CLI](https://deno.land) installed
- [deployctl](https://github.com/denoland/deployctl) installed
- deno.dev account with a project created
- Gateway endpoint accessible from your local environment

### 2. Configure Environment Variables

Set the following environment variables for your deno.dev project:

```bash
# Backend Service URLs
JOURNEY_SERVICE_URL=https://journey-service-mcp-staging-jf43t3fcba-oa.a.run.app/mcp
SWISS_MOBILITY_URL=https://swiss-mobility-mcp-staging-nag5vm55xa-oa.a.run.app/mcp
AAREGURU_URL=https://aareguru.fastmcp.app/mcp
OPEN_METEO_URL=https://open-meteo-mcp.fastmcp.app/mcp

# Cache Configuration
CACHE_TTL=300
CACHE_MAX_SIZE=10000

# Retry Configuration
RETRY_MAX_ATTEMPTS=3
RETRY_BACKOFF_DELAY=100
RETRY_BACKOFF_MULTIPLIER=2.0
RETRY_MAX_DELAY=2000

# Timeout Configuration (milliseconds)
TIMEOUT_CONNECT=5000
TIMEOUT_READ=30000

# Health Check Configuration
HEALTH_CHECK_INTERVAL=60000
HEALTH_UNHEALTHY_THRESHOLD=3

# Logging
LOG_LEVEL=INFO
```

### 3. Deploy to deno.dev

```bash
# Deploy the gateway
deployctl deploy --project=YOUR_PROJECT_ID main.ts

# Verify deployment
curl https://YOUR_PROJECT.deno.dev/health
```

### 4. Register Services via REST API

Once your gateway is deployed, register all services using the REST API:

```bash
# Local development
GATEWAY_URL=http://localhost:8000 deno run --allow-net --allow-read --allow-env scripts/register-services.ts

# Production (deno.dev)
GATEWAY_URL=https://YOUR_PROJECT.deno.dev deno run --allow-net --allow-read --allow-env scripts/register-services.ts
```

## REST API Endpoints

### Register a Service

**Endpoint**: `POST /servers/register`

Register a new MCP service dynamically:

```bash
curl -X POST https://YOUR_GATEWAY/servers/register \
  -H "Content-Type: application/json" \
  -d '{
    "id": "journey-service-mcp",
    "name": "Journey Service MCP",
    "endpoint": "https://journey-service-mcp-staging-jf43t3fcba-oa.a.run.app/mcp",
    "transport": "http",
    "priority": 1
  }'
```

**Response**:
```json
{
  "message": "Server registered successfully",
  "serverId": "journey-service-mcp"
}
```

### List Registered Services

**Endpoint**: `GET /mcp/servers/register`

Fetch all dynamically registered services:

```bash
curl https://YOUR_GATEWAY/mcp/servers/register
```

**Response**:
```json
{
  "servers": [
    {
      "id": "journey-service-mcp",
      "name": "Journey Service MCP",
      "endpoint": "https://journey-service-mcp-staging-jf43t3fcba-oa.a.run.app/mcp",
      "transport": "http",
      "priority": 1
    },
    // ... more services
  ]
}
```

### Delete a Registered Service

**Endpoint**: `DELETE /mcp/servers/{serverId}`

Remove a registered service:

```bash
curl -X DELETE https://YOUR_GATEWAY/mcp/servers/journey-service-mcp
```

**Response**:
```json
{
  "message": "Server deleted successfully",
  "serverId": "journey-service-mcp"
}
```

### Check Service Health

**Endpoint**: `GET /mcp/servers/{serverId}/health`

Check the health status of a specific service:

```bash
curl https://YOUR_GATEWAY/mcp/servers/journey-service-mcp/health
```

**Response**:
```json
{
  "serverId": "journey-service-mcp",
  "name": "Journey Service MCP",
  "status": "healthy",
  "lastCheck": "2026-01-17T10:30:45.000Z",
  "latency": 234,
  "consecutiveFailures": 0
}
```

### Gateway Health Check

**Endpoint**: `GET /health`

Check overall gateway health:

```bash
curl https://YOUR_GATEWAY/health
```

### Gateway Metrics

**Endpoint**: `GET /metrics`

Get gateway metrics:

```bash
curl https://YOUR_GATEWAY/metrics
```

## Configured Services

Your gateway is pre-configured with these MCP services:

| Service | Priority | Endpoint |
|---------|----------|----------|
| Journey Service MCP | 1 | `https://journey-service-mcp-staging-jf43t3fcba-oa.a.run.app/mcp` |
| Swiss Mobility MCP | 2 | `https://swiss-mobility-mcp-staging-nag5vm55xa-oa.a.run.app/mcp` |
| Aareguru MCP | 3 | `https://aareguru.fastmcp.app/mcp` |
| Open Meteo MCP | 4 | `https://open-meteo-mcp.fastmcp.app/mcp` |
| Swiss Tourism MCP | 5 | `https://swiss-tourism-mcp.fastmcp.app/mcp` |

## Service Registration Script

The `scripts/register-services.ts` script automates service registration:

### Features

- ✅ Checks gateway health before registration
- ✅ Registers all pre-configured services
- ✅ Lists all successfully registered services
- ✅ Provides detailed feedback for each registration

### Usage

```bash
# For local development
GATEWAY_URL=http://localhost:8000 deno run --allow-net --allow-read --allow-env scripts/register-services.ts

# For production
GATEWAY_URL=https://your-project.deno.dev deno run --allow-net --allow-read --allow-env scripts/register-services.ts
```

### Output Example

```
════════════════════════════════════════════════════════════════
  MCP Gateway Service Registration
════════════════════════════════════════════════════════════════
  Gateway: https://your-project.deno.dev
  Services to register: 5
════════════════════════════════════════════════════════════════

🔍 Checking gateway health...
✅ Gateway is healthy
   Status: OK

📤 Registering: Journey Service MCP
   ID: journey-service-mcp
   Endpoint: https://journey-service-mcp-staging-jf43t3fcba-oa.a.run.app/mcp
   ✅ Success: Service registered

📤 Registering: Swiss Mobility MCP
   ID: swiss-mobility-mcp
   Endpoint: https://swiss-mobility-mcp-staging-nag5vm55xa-oa.a.run.app/mcp
   ✅ Success: Service registered

... more services ...

📋 Fetching registered services...

✅ Registered Services (5):
   • Journey Service MCP (journey-service-mcp)
     └─ https://journey-service-mcp-staging-jf43t3fcba-oa.a.run.app/mcp
   • Swiss Mobility MCP (swiss-mobility-mcp)
     └─ https://swiss-mobility-mcp-staging-nag5vm55xa-oa.a.run.app/mcp
   ... more services ...

════════════════════════════════════════════════════════════════
  Registration Complete
════════════════════════════════════════════════════════════════
```

## Troubleshooting

### Gateway is Unreachable

**Problem**: Script fails with "Gateway is unreachable"

**Solution**:
1. Verify the gateway is running: `curl https://YOUR_GATEWAY/health`
2. Check the `GATEWAY_URL` environment variable
3. Ensure firewall allows outbound connections

### Service Registration Fails

**Problem**: Services fail to register with error response

**Solution**:
1. Check the service endpoint is accessible
2. Verify the endpoint is a valid MCP endpoint
3. Check gateway logs for detailed error information

### Service Health Check Fails

**Problem**: Services show as unhealthy

**Solution**:
1. Verify the backend service is running
2. Check network connectivity between gateway and service
3. Review gateway logs for timeout or connection errors

## Integration with Claude Desktop

To use the gateway with Claude Desktop:

1. **Using SSE Transport**:
   ```json
   {
     "mcpServers": {
       "gateway": {
         "url": "sse://https://your-project.deno.dev"
       }
     }
   }
   ```

2. **Using Stdio Transport**:
   ```bash
   deno run --allow-net --allow-env main.ts
   ```

## Performance Optimization

### Caching

The gateway implements two-tier caching:

- **Memory Cache**: Fast access for frequently used resources
- **Deno Blob Cache**: Persistent cache across isolates

Configure cache behavior:

```bash
CACHE_TTL=300              # Cache expiration in seconds
CACHE_MAX_SIZE=10000       # Maximum items in cache
```

### Retry Logic

Automatic retry with exponential backoff:

```bash
RETRY_MAX_ATTEMPTS=3       # Maximum retry attempts
RETRY_BACKOFF_DELAY=100    # Initial backoff in ms
RETRY_BACKOFF_MULTIPLIER=2.0  # Backoff multiplier
RETRY_MAX_DELAY=2000       # Maximum backoff delay
```

### Timeouts

Connection and read timeouts:

```bash
TIMEOUT_CONNECT=5000       # Connection timeout in ms
TIMEOUT_READ=30000         # Read timeout in ms
```

## Monitoring

### Health Checks

The gateway performs periodic health checks on all services:

```bash
HEALTH_CHECK_INTERVAL=60000        # Check interval in ms
HEALTH_UNHEALTHY_THRESHOLD=3       # Failures before unhealthy
```

### Metrics

Access gateway metrics:

```bash
curl https://your-project.deno.dev/metrics
```

Includes:
- Total requests and error count
- Error rate percentage
- Request latency (p50, p95, p99)
- Cache hit rate
- Circuit breaker status

## Support

For issues or questions:
- Check the [deno.dev documentation](https://deno.com/deploy/docs)
- Review gateway logs: `deployctl logs --project=YOUR_PROJECT_ID`
- Check MCP service health endpoints
