# Deno Deploy Setup Guide - Complete MCP Gateway

This guide covers deploying all MCP services and the gateway on Deno Deploy so everything works together.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Deno Deploy                           │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  mcp-gateway-ui.deno.dev (Frontend)             │   │
│  │  - Astro SSR application                        │   │
│  │  - Connects to gateway API                      │   │
│  └──────────────────┬──────────────────────────────┘   │
│                     │                                    │
│  ┌──────────────────▼──────────────────────────────┐   │
│  │  deno-mcp-gateway.deno.dev (Backend Gateway)    │   │
│  │  - Routes requests to MCP services              │   │
│  │  - Aggregates tools, resources, prompts         │   │
│  │  - Circuit breaker protection                   │   │
│  └──────────────────┬──────────────────────────────┘   │
│                     │                                    │
│  ┌──────────────────┴──────────────────────────────┐   │
│  │  Individual MCP Services                        │   │
│  │  ├─ journey-service.deno.dev                    │   │
│  │  ├─ swiss-mobility.deno.dev                     │   │
│  │  ├─ aareguru.deno.dev                           │   │
│  │  └─ open-meteo.deno.dev                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Deployment Steps

### Step 1: Deploy Individual MCP Services

Each service must be deployed separately on Deno Deploy.

#### For journey-service:

```bash
cd journey-service-mcp

# Create/link Deno Deploy project
# Go to https://dash.deno.com and create project: "journey-service"

# Deploy
deployctl deploy --project=journey-service main.ts
```

Repeat for:
- `swiss-mobility-mcp` → project: `swiss-mobility`
- `aareguru-mcp` → project: `aareguru`  
- `open-meteo-mcp` → project: `open-meteo`

**Note the public URLs after deployment:**
- Journey Service: `https://journey-service.deno.dev`
- Swiss Mobility: `https://swiss-mobility.deno.dev`
- Aareguru: `https://aareguru.deno.dev`
- Open Meteo: `https://open-meteo.deno.dev`

### Step 2: Deploy Backend Gateway

Deploy the gateway with environment variables pointing to the services.

```bash
cd deno-mcp-gateway

# Create/link Deno Deploy project
# Go to https://dash.deno.com and create project: "deno-mcp-gateway"

# Set environment variables in Deno Deploy dashboard:
# Site settings > Environment > Add variables

# Environment Variables to set:
JOURNEY_SERVICE_URL=https://journey-service.deno.dev/mcp
SWISS_MOBILITY_URL=https://swiss-mobility.deno.dev/mcp
AAREGURU_URL=https://aareguru.deno.dev/mcp
OPEN_METEO_URL=https://open-meteo.deno.dev/mcp
```

Then deploy:

```bash
# Using GitHub integration (automatic on push)
# Or manual deployment:
deployctl deploy --project=deno-mcp-gateway main.ts
```

### Step 3: Deploy Frontend UI

The UI should now work with the gateway.

```bash
cd mcp-gateway-ui

# Create/link Deno Deploy project
# Go to https://dash.deno.com and create project: "mcp-gateway-ui"

# Environment variables (in Deno Deploy dashboard):
PUBLIC_API_BASE_URL=https://deno-mcp-gateway.deno.dev
ADAPTER=deno

# Deploy (automatic on push to master)
```

## Verifying Deployment

### Check Gateway Health

```bash
# Check gateway is running
curl https://deno-mcp-gateway.deno.dev/health

# List registered servers
curl https://deno-mcp-gateway.deno.dev/mcp/servers/register

# Should show something like:
# {
#   "servers": [
#     {
#       "id": "journey",
#       "name": "Journey Service",
#       "endpoint": "https://journey-service.deno.dev/mcp",
#       "requiresSession": true
#     },
#     ...
#   ]
# }
```

### Check UI

Visit `https://mcp-gateway-ui.deno.dev/` and verify:
- ✅ All 4 services show in "Connected Services"
- ✅ Status indicators show green (Healthy)
- ✅ Tools/Resources tabs show data from services

## Troubleshooting

### Services Show as "Down"

1. Check environment variables are set in deno-mcp-gateway project
   - Go to Site settings > Environment
   - Verify all 4 service URLs are correct

2. Verify individual services are running
   ```bash
   curl https://journey-service.deno.dev/health
   curl https://swiss-mobility.deno.dev/health
   curl https://aareguru.deno.dev/health
   curl https://open-meteo.deno.dev/health
   ```

3. Check gateway logs
   - Go to deno Deploy project
   - View recent deployments and logs

### UI Can't Connect to Gateway

1. Verify `PUBLIC_API_BASE_URL` is set in UI project
   - Should be: `https://deno-mcp-gateway.deno.dev`

2. Check CORS headers
   - Gateway must allow requests from UI domain

3. Check network tab in browser developer tools
   - Verify requests are going to correct URL

### Service URLs Not Loading

1. Verify service endpoint paths include `/mcp`
   - Gateway expects: `https://service.deno.dev/mcp`
   - Not: `https://service.deno.dev/`

2. Check service health endpoint
   ```bash
   curl https://service-name.deno.dev/health
   ```

## Production Considerations

### Domain Setup

To use custom domains instead of `*.deno.dev`:

1. In Deno Deploy dashboard, go to project settings
2. Add custom domain (requires DNS configuration)
3. Update environment variables to use custom domain

### Performance

- Deno Deploy provides edge caching and global distribution
- First request takes ~200-500ms
- Subsequent requests cached and served from edge

### Security

- Services communicate via HTTPS only
- No sensitive credentials in environment variables
- Circuit breaker prevents cascading failures
- Rate limiting protects against abuse

## Monitoring

### Check Service Health

```bash
# Gateway metrics
curl https://deno-mcp-gateway.deno.dev/metrics

# Individual service status
curl https://deno-mcp-gateway.deno.dev/mcp/servers/register | jq .
```

### View Logs

In Deno Deploy dashboard:
1. Select project
2. Click "Deployments" tab
3. View logs for current or previous deployments

## Rollback

If something breaks:

1. Go to Deno Deploy project
2. Click "Deployments" tab
3. Select previous working deployment
4. Click "Promote to Production"

## Next Steps

Once everything is deployed:

1. Test all service tools in the UI
2. Configure monitoring/alerting
3. Set up custom domain (if needed)
4. Configure automatic backups
5. Set up CI/CD for automated deployments
