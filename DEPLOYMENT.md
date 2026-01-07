# MCP Gateway Deployment Guide

This guide covers deploying the MCP Gateway on Netlify Edge Functions and alternative platforms.

## Prerequisites

- **Deno** 1.40+ installed ([deno.land](https://deno.land))
- **Git** repository pushed to GitHub
- **Netlify account** (for Netlify deployment)
- **GitHub repository**: https://github.com/schlpbch/netlify-mcp-gateway

> **Note**: No Node.js or package managers needed! This is a pure Deno project.

## Deployment Methods

### Method 1: Automatic GitHub Integration (Recommended)

Netlify automatically deploys on every push to the main branch.

#### 1. Link Repository to Netlify

Connect via Netlify dashboard:
1. Go to https://app.netlify.com
2. Click "New site from Git"
3. Select your GitHub repository
4. Netlify auto-detects build settings from `netlify.toml`

Or use CLI:

```bash
# Install Netlify CLI (if needed)
deno install --allow-all https://deno.land/x/netlify_cli/netlify.ts
# Or: npm install -g netlify-cli

# Link repository
netlify link --repo=https://github.com/schlpbch/netlify-mcp-gateway
```

#### 2. Configure Build Settings

- **Build command**: _(none needed - Deno code runs directly)_
- **Publish directory**: `public`
- **Edge Functions**: Auto-detected from `netlify/edge-functions/`

#### 3. Environment Variables

Set in Netlify dashboard > Site settings > Build & deploy > Environment:

```bash
JOURNEY_SERVICE_URL=https://journey-service.example.com
SWISS_MOBILITY_URL=https://mobility.example.com
AAREGURU_URL=https://aareguru.example.com
OPEN_METEO_URL=https://meteo.example.com
```

The site automatically deploys on every `git push` to main branch.

### Method 2: Manual CLI Deployment

Deploy from your local machine using the Netlify CLI.

#### 1. Authenticate

```bash
netlify login
```

This opens a browser to authorize your Netlify account.

#### 2. Deploy to Production

```bash
netlify deploy --prod --dir=public
```

Or with Deno (if using Deno-based Netlify CLI):

```bash
deno task deploy  # If configured in deno.json
```

#### 3. View Deployment

```bash
netlify open site
```

Opens your site in the browser.

### Method 3: Draft Deployments (Testing)

Test changes before pushing to production.

```bash
netlify deploy --dir=public
```

This creates a draft deploy with a unique preview URL. Share for testing before promoting to production.

## Alternative Deployment Platforms

### Deploy to Deno Deploy

[Deno Deploy](https://deno.com/deploy) is the native Deno cloud platform with global edge network.

#### 1. Connect Repository

1. Go to https://dash.deno.com/new
2. Connect your GitHub repository
3. Select branch: `master` or `main`
4. Set entry point: `dev.ts`

#### 2. Configure Environment

Add environment variables in Deno Deploy dashboard:
- `JOURNEY_SERVICE_URL`
- `SWISS_MOBILITY_URL`
- `AAREGURU_URL`
- `OPEN_METEO_URL`

#### 3. Deploy

Push to GitHub → Automatic deployment

**Benefits**:
- ✅ Native Deno platform (zero config)
- ✅ Global edge network
- ✅ Built-in analytics
- ✅ Fast cold starts
- ✅ Free tier: 100K requests/day

### Deploy to Cloudflare Workers

Can be adapted for Cloudflare Workers with minimal changes.

#### Required Changes:

1. Create `wrangler.toml`:
   ```toml
   name = "mcp-gateway"
   main = "worker.ts"
   compatibility_date = "2024-01-01"
   ```

2. Adapt `dev.ts` to Workers format:
   ```typescript
   export default {
     async fetch(request: Request): Promise<Response> {
       // Handler logic
     }
   }
   ```

3. Deploy:
   ```bash
   npx wrangler deploy
   ```

**Benefits**:
- ✅ Larger edge network (275+ cities)
- ✅ Generous free tier
- ✅ Deno compatibility via workerd

## Configuration

### netlify.toml

The project includes a `netlify.toml` configuration file:

```toml
[build]
  publish = "public"

[[edge_functions]]
  function = "mcp"
  path = "/mcp/*"

[dev]
  port = 8888
```

- **publish**: Directory containing static assets
- **edge_functions**: Configures the MCP edge function and its route pattern
- **dev**: Local development server port (used by `netlify dev`)

### Environment Variables

Set in Netlify dashboard or `.env` file locally:

| Variable | Purpose | Example |
|----------|---------|---------|
| `JOURNEY_SERVICE_URL` | Journey Service backend | `https://journey.example.com` |
| `SWISS_MOBILITY_URL` | Swiss Mobility backend | `https://mobility.example.com` |
| `AAREGURU_URL` | Aareguru backend | `https://aareguru.example.com` |
| `OPEN_METEO_URL` | Open Meteo backend | `https://meteo.example.com` |
| `PORT` | Local dev server port | `8888` |
| `DEBUG` | Enable debug logging | `true` |

Local development with `.env`:

```bash
# Create .env file
cat > .env << 'EOF'
JOURNEY_SERVICE_URL=http://localhost:3001
SWISS_MOBILITY_URL=http://localhost:3002
AAREGURU_URL=http://localhost:3003
OPEN_METEO_URL=http://localhost:3004
DEBUG=true
EOF

# Run dev server
deno task dev
```

## Verification

### 1. Check Deployment Status

```bash
netlify status
```

### 2. View Live Site

```bash
# Open deployed site
netlify open site

# Or use the URL directly
open https://netliy-mcp-gateway.netlify.app
```

### 3. Test Health Endpoint

```bash
curl https://netliy-mcp-gateway.netlify.app/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2026-01-07T12:34:56.789Z",
  "gateway": "mcp-gateway",
  "version": "0.2.0"
}
```

### 4. List Tools

```bash
curl -X GET https://netliy-mcp-gateway.netlify.app/mcp/tools/list
```

### 5. View Logs

```bash
# Stream logs from production
netlify logs:deploy

# Or via dashboard
netlify open admin
```

## Local Development

### Start Dev Server

```bash
# Using Deno (recommended)
deno task dev

# Or using Netlify CLI (includes edge function simulation)
netlify dev
```

**Deno dev server** runs at `http://localhost:8888` with:
- ✅ Hot reload on file changes
- ✅ Native Deno runtime (exact production behavior)
- ✅ Fast startup
- ✅ Environment variable support

**Netlify CLI** provides:
- ✅ Full edge functions support
- ✅ Netlify Blobs simulation
- ✅ Production-like environment

### Testing Endpoints Locally

Use the interactive web UI at `http://localhost:8888` or curl:

```bash
# GET endpoints
curl http://localhost:8888/mcp/tools/list
curl http://localhost:8888/mcp/resources/list
curl http://localhost:8888/mcp/prompts/list
curl http://localhost:8888/health

# POST endpoints
curl -X POST http://localhost:8888/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name":"journey.findTrips","arguments":{"from":"Bern","to":"Zurich"}}'
```

### Type Checking

```bash
# Check all TypeScript files
deno task check

# Or check specific files
deno check netlify/edge-functions/mcp.ts
```

### Formatting & Linting

```bash
# Format code
deno task fmt

# Check formatting
deno task fmt:check

# Lint code
deno task lint
```

## Deployment Workflow

### 1. Development

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and test locally
pnpm dev

# Commit changes
git add .
git commit -m "feat: my feature"
```

### 2. Staging (Draft Deploy)

```bash
# Deploy draft to test before production
netlify deploy --dir=public

# Preview URL is printed in output
# Share with team for testing
```

### 3. Production

```bash
# Push to main branch triggers automatic deployment
git push origin feature/my-feature
git pull-request

# After PR merge, automatic deploy to production
```

Or manual production deploy:

```bash
git push origin main
# Netlify automatically deploys
```

## Monitoring

### View Deployment History

```bash
# List recent deploys
netlify deploys:list --limit=10

# View specific deploy details
netlify deploy:info --filter={DEPLOY_ID}
```

### View Logs

```bash
# Edge function logs
netlify logs:edge-functions

# Function execution logs
netlify logs:functions

# Deployment logs
netlify logs:deploy
```

### Analytics

Netlify dashboard shows:
- Request count
- Bandwidth usage
- Error rates
- Deploy success/failure

## Troubleshooting

### Deployment Fails

**Check build logs**:

```bash
netlify logs:deploy
```

Common causes:
- Missing `public` directory
- Invalid `netlify.toml` syntax
- Unresolved imports in edge function

### Edge Function Not Responding

**Verify edge function is bundled**:

```bash
# Check if mcp.ts is properly formatted
deno lint netlify/edge-functions/mcp.ts

# Verify function exists
ls -la netlify/edge-functions/
```

**Check bundling logs**:

```bash
netlify logs:deploy | grep -i "edge function"
```

### Slow Response Times

**Causes**:
- Backend server is slow
- Network latency

**Solutions**:
- Check backend service health
- Use the interactive UI to test endpoints
- Monitor edge function logs

### 404 Routes

**Verify route pattern in netlify.toml**:

```toml
[[edge_functions]]
  function = "mcp"
  path = "/mcp/*"
```

The `path` pattern must match your request URLs.

## Rollback

### Rollback to Previous Deploy

```bash
# List recent deploys
netlify deploys:list

# Rollback to specific deploy
netlify deploy --alias={DEPLOY_ID}

# Or use dashboard to manually revert
netlify open admin
```

## Security

### Public Endpoint

The gateway is publicly accessible at:

```
https://netliy-mcp-gateway.netlify.app
```

For production, consider:

- Adding authentication middleware
- IP allowlisting
- Rate limiting (via Cloud Functions or API gateway)
- Request validation

### Secrets Management

Use Netlify environment variables for sensitive data:

1. Go to Site settings > Build & deploy > Environment
2. Add sensitive variables as "Secrets"
3. Reference in edge function via `context.env`

## Scaling & Performance

### Edge Function Optimization

The edge function automatically:
- Scales globally across 100+ edge locations
- Serves from nearest data center to user
- Handles concurrent requests

### Bandwidth & Cost

Netlify Edge Functions pricing:
- **Included**: 1M requests per month
- **Additional**: Pay-per-use beyond free tier

Monitor usage in Netlify dashboard.

## Next Steps

1. ✅ Push code to GitHub
2. ✅ Link repository to Netlify (automatic deploy on push)
3. Test endpoints via interactive UI
4. Monitor logs and performance
5. Set up alerts for errors

## Useful Commands

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify account
netlify login

# Link local repo to Netlify
netlify link

# Deploy draft version
netlify deploy --dir=public

# Deploy to production
netlify deploy --prod --dir=public

# View local dev server
pnpm dev

# See deployment history
netlify deploys:list

# View logs
netlify logs:edge-functions

# Open Netlify dashboard
netlify open admin
```

## Resources

- [Netlify Edge Functions Docs](https://docs.netlify.com/edge-functions/overview/)
- [Netlify CLI Reference](https://cli.netlify.com/)
- [Project Repository](https://github.com/schlpbch/netlify-mcp-gateway)
- [Live Site](https://netliy-mcp-gateway.netlify.app)
