# Deployment Steps

## Recent Changes

Two commits have been made to fix the health endpoint to properly display registered services in the UI:

### Commit 1: Include dynamic services in health response
**Hash**: `481a255`
- Updates `/health` endpoint to fetch dynamically registered services from KV storage
- Includes all registered services (both static and dynamic) in the response

### Commit 2: Use 'servers' field instead of 'backends'
**Hash**: `e02650d`
- Changed response field from `backends` to `servers` for UI compatibility
- Removes duplicate field to simplify the API response

## Deploy to deno.dev

To deploy these changes to your live gateway:

```bash
cd c:\Users\schlp\code\deno-mcp-gateway
deployctl deploy --project deno-mcp-gateway main.ts
```

## Expected Result

After deployment, the `/health` endpoint will return:

```json
{
  "status": "UP",
  "server": "UP",
  "servers": [
    {
      "id": "journey-service-mcp",
      "name": "Journey Service MCP",
      "endpoint": "https://journey-service-mcp-staging-jf43t3fcba-oa.a.run.app/mcp",
      "status": "HEALTHY",
      "latency": 234,
      "errorMessage": null
    },
    {
      "id": "swiss-mobility-mcp",
      "name": "Swiss Mobility MCP",
      "endpoint": "https://swiss-mobility-mcp-staging-nag5vm55xa-oa.a.run.app/mcp",
      "status": "HEALTHY",
      "latency": 189,
      "errorMessage": null
    },
    // ... more services
  ]
}
```

## Verify Deployment

After deployment, verify the endpoint is working:

```bash
curl https://deno-mcp-gateway.deno.dev/health | jq .servers
```

You should see all 5 registered services listed.

## UI Impact

Once deployed, the "Connected Services" dashboard in the web UI will:
- ✅ Display all registered services
- ✅ Show service health status (Healthy/Down/Degraded)
- ✅ Display latency information
- ✅ Show error messages if services are down
- ✅ Update the initials and colored badges for each service

## Rollback

If needed to rollback to previous version:

```bash
git revert e02650d
git revert 481a255
deployctl deploy --project deno-mcp-gateway main.ts
```
