/**
 * Federated MCP Gateway Server for Deno Deploy
 *
 * A stateful Federated MCP Gateway that aggregates multiple backend MCP servers
 * and exposes them via SSE transport for claude.ai integration.
 *
 * Run locally: deno run --allow-net --allow-env main.ts
 * Deploy: deployctl deploy --project=mcp-gateway --prod main.ts
 */

// ============================================================================
// Module Imports
// ============================================================================

import {
  SERVER_INFO,
  corsHeaders,
  initializeServersFromEnv,
} from './src/config.ts';
import type { BackendServer } from './src/types.ts';
import { jsonRpcResponse, jsonRpcError, JsonRpcErrorCode } from './src/jsonrpc.ts';
import { logger } from './src/logger.ts';
import { sessions, metrics, sendSSE } from './src/session.ts';
import { handleJsonRpcRequest } from './src/mcprequest.ts';
import {
  handleCors,
  handleStaticFile,
  handleHealth,
  handleMetrics,
  handleSseStream,
  handleMessage,
  handleStreamableHttp,
  handleMcpGetStream,
  handleMcpDeleteSession,
  handleRegisterServer,
  handleUploadConfig,
  handleDeleteServer,
  handleServerHealth,
  handle404,
} from './src/handlers.ts';

// ============================================================================
// Global State
// ============================================================================

const BACKEND_SERVERS: BackendServer[] = initializeServersFromEnv();
const dynamicServers = new Map<string, BackendServer>();

// ============================================================================
// Content-Type Validation Helper
// ============================================================================

/**
 * Validate Content-Type header for JSON-RPC endpoints
 * Returns error response if invalid, null if valid
 */
function validateJsonContentType(req: Request): Response | null {
  const contentType = req.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) {
    logger.warn('Invalid content type', { contentType, path: new URL(req.url).pathname });
    return new Response(
      JSON.stringify(
        jsonRpcError(
          null,
          JsonRpcErrorCode.INVALID_REQUEST,
          'Content-Type must be application/json'
        )
      ),
      {
        status: 415,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
  return null;
}

// ============================================================================
// HTTP Request Handler
// ============================================================================

export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const startTime = performance.now();

  metrics.totalRequests++;

  // Log incoming request
  const queryParams: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  logger.logRequest(req.method, path, queryParams, headers);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  try {
    // MCP JSON-RPC at root path (for Claude Desktop compatibility)
    if (path === '/' && req.method === 'POST') {
      const contentTypeError = validateJsonContentType(req);
      if (contentTypeError) return contentTypeError;
      const body = await req.json();
      return await handleStreamableHttp(req, body, (method, params) =>
        handleJsonRpcRequest(method, params, BACKEND_SERVERS, dynamicServers)
      );
    }

    // Serve static files
    const staticResponse = await handleStaticFile(path);
    if (staticResponse) {
      return staticResponse;
    }

    // Health check endpoint
    if (path === '/health') {
      return await handleHealth(BACKEND_SERVERS);
    }

    // Metrics endpoint
    if (path === '/metrics') {
      return handleMetrics();
    }

    // SSE endpoint - GET /sse
    if (path === '/sse' && req.method === 'GET') {
      return handleSseStream();
    }

    // Message endpoint - POST /message
    if (path === '/message' && req.method === 'POST') {
      const sessionId = url.searchParams.get('sessionId');
      const body = await req.json();
      return await handleMessage(sessionId, body, (method, params) =>
        handleJsonRpcRequest(method, params, BACKEND_SERVERS, dynamicServers)
      );
    }

    // Streamable HTTP transport - POST /mcp
    if ((path === '/mcp' || path === '/mcp/') && req.method === 'POST') {
      const contentTypeError = validateJsonContentType(req);
      if (contentTypeError) return contentTypeError;
      const body = await req.json();
      return await handleStreamableHttp(req, body, (method, params) =>
        handleJsonRpcRequest(method, params, BACKEND_SERVERS, dynamicServers)
      );
    }

    // Handle GET /mcp for SSE stream
    if ((path === '/mcp' || path === '/mcp/') && req.method === 'GET') {
      const sessionId = req.headers.get('Mcp-Session-Id');
      return handleMcpGetStream(sessionId);
    }

    // Handle DELETE /mcp to close session
    if ((path === '/mcp' || path === '/mcp/') && req.method === 'DELETE') {
      const sessionId = req.headers.get('Mcp-Session-Id');
      return handleMcpDeleteSession(sessionId);
    }

    // MCP REST endpoints (for web UI)
    if (
      (path === '/mcp/tools/list' || path === '/tools/list') &&
      req.method === 'GET'
    ) {
      const result = await handleJsonRpcRequest(
        'tools/list',
        undefined,
        BACKEND_SERVERS,
        dynamicServers
      );
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (
      (path === '/mcp/tools/call' || path === '/tools/call') &&
      req.method === 'POST'
    ) {
      const body = await req.json();
      const result = await handleJsonRpcRequest(
        'tools/call',
        body,
        BACKEND_SERVERS,
        dynamicServers
      );
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (
      (path === '/mcp/resources/list' || path === '/resources/list') &&
      req.method === 'GET'
    ) {
      const result = await handleJsonRpcRequest(
        'resources/list',
        undefined,
        BACKEND_SERVERS,
        dynamicServers
      );
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (
      (path === '/mcp/prompts/list' || path === '/prompts/list') &&
      req.method === 'GET'
    ) {
      const result = await handleJsonRpcRequest(
        'prompts/list',
        undefined,
        BACKEND_SERVERS,
        dynamicServers
      );
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (
      (path === '/mcp/resources/read' || path === '/resources/read') &&
      req.method === 'POST'
    ) {
      const body = await req.json();
      const result = await handleJsonRpcRequest(
        'resources/read',
        body,
        BACKEND_SERVERS,
        dynamicServers
      );
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (
      (path === '/mcp/prompts/get' || path === '/prompts/get') &&
      req.method === 'POST'
    ) {
      const body = await req.json();
      const result = await handleJsonRpcRequest(
        'prompts/get',
        body,
        BACKEND_SERVERS,
        dynamicServers
      );
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Register new server dynamically - POST /servers/register
    if (path === '/servers/register' && req.method === 'POST') {
      try {
        const body = await req.json();
        return handleRegisterServer(body, dynamicServers);
      } catch (error) {
        console.error('Error registering server:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to register server' }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // List dynamically registered servers - GET /mcp/servers/register
    if (path === '/mcp/servers/register' && req.method === 'GET') {
      const servers = Array.from(dynamicServers.values());
      return new Response(JSON.stringify({ servers }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Upload server configuration via multipart form - POST /mcp/servers/upload
    if (path === '/mcp/servers/upload' && req.method === 'POST') {
      try {
        return await handleUploadConfig(req, dynamicServers);
      } catch (error) {
        console.error('Error processing config upload:', error);
        return new Response(
          JSON.stringify({
            error: 'Failed to process upload',
            details: String(error),
          }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Delete a registered server - DELETE /mcp/servers/{serverId}
    const deleteServerMatch = path.match(/^\/mcp\/servers\/([^/]+)$/);
    if (deleteServerMatch && req.method === 'DELETE') {
      const serverId = deleteServerMatch[1];
      return handleDeleteServer(serverId, dynamicServers);
    }

    // Check server health status - GET /mcp/servers/{serverId}/health
    const healthCheckMatch = path.match(/^\/mcp\/servers\/([^/]+)\/health$/);
    if (healthCheckMatch && req.method === 'GET') {
      const serverId = healthCheckMatch[1];
      return await handleServerHealth(serverId, dynamicServers);
    }

    if (path === '/mcp/metrics' && req.method === 'GET') {
      const uptimeMs = Date.now() - metrics.startTime;
      return new Response(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          uptime: `${Math.floor(uptimeMs / 1000)}s`,
          requests: {
            total: metrics.totalRequests,
            errors: metrics.totalErrors,
            errorRate:
              metrics.totalRequests > 0
                ? `${(
                    (metrics.totalErrors / metrics.totalRequests) *
                    100
                  ).toFixed(2)}%`
                : '0%',
          },
          latency: {
            avg: '0ms',
            p50: '0ms',
            p95: '0ms',
            p99: '0ms',
          },
          cache: {
            hitRate: '0%',
            memorySize: 0,
          },
          circuitBreakers: {},
          endpoints: {},
        }),
        {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // 404 for unknown paths
    return handle404();
  } catch (error) {
    metrics.totalErrors++;
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    const durationMs = performance.now() - startTime;
    logger.error('Request handler error', {
      path,
      method: req.method,
      error: errorMessage,
      durationMs,
    });
    logger.logResponse(req.method, path, 500, durationMs);
    console.error('Request error:', errorMessage);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

// =============================================================================
// Server Startup
// =============================================================================

if (import.meta.main) {
  const port = parseInt(Deno.env.get('PORT') || '8000');
  const logLevel = Deno.env.get('LOG_LEVEL') || 'INFO';

  console.log(`
========================================
  Federated MCP Gateway Server v${SERVER_INFO.version}
========================================
  MCP Root:        http://localhost:${port}/
  Streamable HTTP: http://localhost:${port}/mcp
  SSE Transport:   http://localhost:${port}/sse
  Health Check:    http://localhost:${port}/health
  Metrics:         http://localhost:${port}/metrics
  Tools List:      http://localhost:${port}/mcp/tools/list
----------------------------------------
  Log Level:       ${logLevel}
  Backend Servers:
${BACKEND_SERVERS.map((s) => `    - ${s.name} (${s.id})`).join('\n')}
========================================
`);

  Deno.serve({ port }, handler);
}
