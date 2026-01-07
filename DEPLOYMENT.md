# MCP Gateway Deployment Guide

This guide covers deploying the MCP Gateway on Netlify Edge Functions.

## Prerequisites

- Git repository pushed to GitHub
- Netlify CLI installed (`npm install -g netlify-cli`)
- GitHub repository: https://github.com/schlpbch/netlify-mcp-gateway
- pnpm package manager (v9.0.0+)

## Deployment Methods

### Method 1: Automatic GitHub Integration (Recommended)

Netlify automatically deploys on every push to the main branch.

#### 1. Link Repository to Netlify

```bash
netlify link --repo=https://github.com/schlpbch/netlify-mcp-gateway
```

Or connect via Netlify dashboard:
1. Go to https://app.netlify.com
2. Click "New site from Git"
3. Select your GitHub repository
4. Netlify auto-detects build settings from `netlify.toml`

#### 2. Configure Build Settings

Build command: `pnpm install` (no build needed for edge functions)
Publish directory: `public`

#### 3. Environment Variables

Set in Netlify dashboard > Site settings > Build & deploy > Environment:

```
BACKEND_MCP_SERVERS=["journey-service", "swiss-mobility", "aareguru", "open-meteo"]
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

Or use the shorthand npm script:

```bash
pnpm deploy
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

- **publish**: Directory containing static assets and edge function output
- **edge_functions**: Configures the MCP edge function and its route pattern
- **dev**: Local development server port

### Environment Variables

Set in Netlify dashboard or `.env` file locally:

| Variable | Purpose | Example |
|----------|---------|---------|
| `NODE_ENV` | Environment (dev/prod) | `production` |
| `DEBUG` | Enable debug logging | `true` |

Local development with `.env`:

```bash
# .env (not committed to git)
NODE_ENV=development
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
curl https://netliy-mcp-gateway.netlify.app/mcp/health
```

Expected response:

```json
{
  "status": "UP",
  "timestamp": "2026-01-07T12:34:56.789Z",
  "servers": [...]
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

## Development

### Local Development

Start the local Netlify dev server:

```bash
pnpm dev
```

This runs at `http://localhost:8888` with:
- Live reload on file changes
- Full edge functions support
- Environment variable support

### Testing Endpoints Locally

Use the interactive web UI at `http://localhost:8888`:

```bash
# GET endpoints
curl http://localhost:8888/mcp/tools/list
curl http://localhost:8888/mcp/resources/list
curl http://localhost:8888/mcp/prompts/list
curl http://localhost:8888/mcp/health

# POST endpoints
curl -X POST http://localhost:8888/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{"tool":"example","input":"test"}'
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
