/**
 * HTTP route handlers module
 * Implements individual HTTP endpoints
 */

import { corsHeaders } from './config.ts';
import {
  jsonRpcResponse,
  jsonRpcError,
} from './jsonrpc.ts';
import { sessions, metrics, sendSSE } from './session.ts';
import { checkBackendHealth, circuitBreakerRegistry } from './backend.ts';
import {
  validateServerConfiguration,
  extractServersFromConfig,
  buildBulkUploadResponse,
  buildHealthStatusResponse,
  jsonResponse,
} from './endpoints/serverConfigUpload.ts';
import type { BackendServer } from './config.ts';

/**
 * Handle CORS preflight requests
 */
export function handleCors(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/**
 * Handle static file serving
 */
export async function handleStaticFile(path: string): Promise<Response | null> {
  const filePath = path === '/' ? '/index.html' : path;
  try {
    const content = await Deno.readTextFile(`./dist${filePath}`);

    // Determine content type
    let contentType = 'text/html; charset=utf-8';
    if (filePath.endsWith('.js'))
      contentType = 'application/javascript; charset=utf-8';
    else if (filePath.endsWith('.css'))
      contentType = 'text/css; charset=utf-8';
    else if (filePath.endsWith('.json')) contentType = 'application/json';
    else if (filePath.endsWith('.svg')) contentType = 'image/svg+xml';
    else if (filePath.endsWith('.png')) contentType = 'image/png';
    else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg'))
      contentType = 'image/jpeg';

    return new Response(content, {
      headers: { 'Content-Type': contentType, ...corsHeaders },
    });
  } catch {
    // File not found, try index.html for SPA routing (unless it's an API route)
    if (
      !path.startsWith('/mcp') &&
      !path.startsWith('/health') &&
      !path.startsWith('/metrics')
    ) {
      try {
        const content = await Deno.readTextFile('./dist/index.html');
        return new Response(content, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            ...corsHeaders,
          },
        });
      } catch {
        // Fall through to API routes
      }
    }
  }

  return null;
}

/**
 * Handle health check endpoint
 */
export async function handleHealth(
  staticServers: BackendServer[]
): Promise<Response> {
  const backendHealth = await Promise.all(
    staticServers.map((server) => checkBackendHealth(server))
  );
  const allHealthy = backendHealth.every((b) => b.status === 'healthy');
  const anyHealthy = backendHealth.some((b) => b.status === 'healthy');

  return new Response(
    JSON.stringify({
      status: allHealthy ? 'UP' : anyHealthy ? 'DEGRADED' : 'DOWN',
      server: allHealthy ? 'UP' : anyHealthy ? 'DEGRADED' : 'DOWN',
      backends: backendHealth.map((b) => {
        const server = staticServers.find((s) => s.id === b.id);
        return {
          id: b.id,
          name: b.name,
          endpoint: server?.endpoint,
          status: b.status === 'healthy' ? 'HEALTHY' : 'DOWN',
          latency: b.latencyMs,
          errorMessage: b.error,
        };
      }),
    }),
    {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    }
  );
}

/**
 * Handle metrics endpoint
 */
export function handleMetrics(): Response {
  const uptimeMs = Date.now() - metrics.startTime;
  return new Response(
    JSON.stringify({
      uptime: `${Math.floor(uptimeMs / 1000)}s`,
      totalRequests: metrics.totalRequests,
      totalErrors: metrics.totalErrors,
      toolCalls: metrics.toolCalls,
      sessionsCreated: metrics.sessionsCreated,
      activeSessions: sessions.size,
      errorRate:
        metrics.totalRequests > 0
          ? `${(
              (metrics.totalErrors / metrics.totalRequests) *
              100
            ).toFixed(2)}%`
          : '0%',
      circuitBreakers: circuitBreakerRegistry.getAllStatuses(),
    }),
    {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    }
  );
}

/**
 * Handle SSE stream endpoint (GET /sse)
 */
export function handleSseStream(): Response {
  const sessionId = crypto.randomUUID();
  const encoder = new TextEncoder();

  metrics.sessionsCreated++;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      sessions.set(sessionId, {
        controller,
        encoder,
        createdAt: Date.now(),
      });

      // Send endpoint event (for old SSE transport)
      const endpointEvent = `event: endpoint\ndata: "/message?sessionId=${sessionId}"\n\n`;
      controller.enqueue(encoder.encode(endpointEvent));

      // Keep-alive ping every 25 seconds
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(pingInterval);
          sessions.delete(sessionId);
        }
      }, 25000);

      // Clean up on abort
      const abortHandler = () => {
        clearInterval(pingInterval);
        sessions.delete(sessionId);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      // addEventListener might not be available, try to use signal
      if (typeof (controller as any).signal?.addEventListener === 'function') {
        (controller as any).signal.addEventListener('abort', abortHandler);
      }
    },
    cancel() {
      sessions.delete(sessionId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...corsHeaders,
    },
  });
}

/**
 * Handle message endpoint (POST /message?sessionId=...)
 */
export async function handleMessage(
  sessionId: string | null,
  body: unknown,
  rpcHandler: (method: string, params?: Record<string, unknown>) => Promise<unknown>
): Promise<Response> {
  if (!sessionId) {
    return new Response(
      JSON.stringify(jsonRpcError(null, -32600, 'Missing sessionId')),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return new Response(
      JSON.stringify(
        jsonRpcError(null, -32600, 'Invalid or expired session')
      ),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  const { id, method, params } = body as Record<string, unknown>;

  try {
    const result = await rpcHandler(method as string, params as Record<string, unknown>);

    // For notifications (no id), just acknowledge
    if (id === undefined || id === null) {
      return new Response(null, { status: 202, headers: corsHeaders });
    }

    // Send response via SSE stream
    const response = jsonRpcResponse(id as string | number, result);
    sendSSE(sessionId, 'message', response);

    return new Response(null, { status: 202, headers: corsHeaders });
  } catch (error) {
    metrics.totalErrors++;
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    if (id !== undefined && id !== null) {
      sendSSE(sessionId, 'message', jsonRpcError(id as string | number, -32603, errorMessage));
    }

    return new Response(null, { status: 202, headers: corsHeaders });
  }
}

/**
 * Handle streamable HTTP transport (POST /mcp)
 */
export async function handleStreamableHttp(
  req: Request,
  body: unknown,
  rpcHandler: (method: string, params?: Record<string, unknown>) => Promise<unknown>
): Promise<Response> {
  const acceptHeader = req.headers.get('Accept') || '';
  const wantsSSE = acceptHeader.includes('text/event-stream');
  const contentType = req.headers.get('Content-Type') || '';

  if (!contentType.includes('application/json')) {
    return new Response(
      JSON.stringify(
        jsonRpcError(null, -32600, 'Content-Type must be application/json')
      ),
      {
        status: 415,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  // Get or create session from header
  let sessionId = req.headers.get('Mcp-Session-Id');
  const isNewSession = !sessionId;

  if (isNewSession) {
    sessionId = crypto.randomUUID();
    metrics.sessionsCreated++;
  }

  // Handle batch requests (array of JSON-RPC messages)
  const requests = Array.isArray(body) ? body : [body];
  const responses: unknown[] = [];

  for (const request of requests) {
    const { id, method, params } = request as Record<string, unknown>;

    try {
      const result = await rpcHandler(method as string, params as Record<string, unknown>);

      // Only add response if it's not a notification (has id)
      if (id !== undefined && id !== null) {
        responses.push(jsonRpcResponse(id as string | number, result));
      }
    } catch (error) {
      metrics.totalErrors++;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      if (id !== undefined && id !== null) {
        responses.push(jsonRpcError(id as string | number, -32603, errorMessage));
      }
    }
  }

  // Build response headers
  const responseHeaders: Record<string, string> = {
    'Content-Type': wantsSSE ? 'text/event-stream' : 'application/json',
    'Cache-Control': 'no-cache',
    ...corsHeaders,
  };

  // Include session ID in response header for new sessions
  if (isNewSession && sessionId) {
    responseHeaders['Mcp-Session-Id'] = sessionId;
  }

  // If client wants SSE, stream the responses
  if (wantsSSE) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Send each response as an SSE event
        for (const response of responses) {
          const event = `event: message\ndata: ${JSON.stringify(
            response
          )}\n\n`;
          controller.enqueue(encoder.encode(event));
        }
        controller.close();
      },
    });

    return new Response(stream, { headers: responseHeaders });
  }

  // Return JSON response (single or batch)
  const responseBody = Array.isArray(body)
    ? responses
    : responses[0] || { jsonrpc: '2.0', result: null };

  return new Response(JSON.stringify(responseBody), {
    headers: responseHeaders,
  });
}

/**
 * Handle GET /mcp for SSE stream
 */
export function handleMcpGetStream(sessionId: string | null): Response {
  if (!sessionId) {
    return new Response(
      JSON.stringify({
        error: 'Mcp-Session-Id header required for GET /mcp',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Store the session for server-initiated messages
      sessions.set(sessionId, {
        controller,
        encoder,
        createdAt: Date.now(),
      });

      // Keep-alive ping every 25 seconds
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(pingInterval);
          sessions.delete(sessionId);
        }
      }, 25000);

      // Clean up on abort
      const abortHandler = () => {
        clearInterval(pingInterval);
        sessions.delete(sessionId);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      if (typeof (controller as any).signal?.addEventListener === 'function') {
        (controller as any).signal.addEventListener('abort', abortHandler);
      }
    },
    cancel() {
      sessions.delete(sessionId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Mcp-Session-Id': sessionId,
      ...corsHeaders,
    },
  });
}

/**
 * Handle DELETE /mcp to close session
 */
export function handleMcpDeleteSession(sessionId: string | null): Response {
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    if (session) {
      try {
        session.controller.close();
      } catch {
        // Already closed
      }
    }
    sessions.delete(sessionId);
  }

  return new Response(null, { status: 204, headers: corsHeaders });
}

/**
 * Handle registering a new server
 */
export function handleRegisterServer(
  body: unknown,
  dynamicServers: Map<string, BackendServer>
): Response {
  const { id, name, endpoint, requiresSession } = body as Record<string, unknown>;

  if (!id || !name || !endpoint) {
    return new Response(
      JSON.stringify({
        error: 'Missing required fields: id, name, endpoint',
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Validate endpoint URL
  try {
    new URL(endpoint as string);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid endpoint URL format' }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Create server object
  const newServer: BackendServer = {
    id: id as string,
    name: name as string,
    endpoint: endpoint as string,
    requiresSession: (requiresSession as boolean) || false,
  };

  // Add to dynamic registry
  dynamicServers.set(id as string, newServer);
  console.log(
    `✅ Registered dynamic server: ${newServer.name} (${newServer.id})`
  );

  return new Response(
    JSON.stringify({
      success: true,
      serverId: id,
      message: `Server "${name}" registered successfully`,
    }),
    { status: 200, headers: corsHeaders }
  );
}

/**
 * Handle uploading server configuration
 */
export async function handleUploadConfig(
  req: Request,
  dynamicServers: Map<string, BackendServer>
): Promise<Response> {
  const contentType = req.headers.get('content-type');
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return jsonResponse(
      { error: 'Invalid content-type. Expected multipart/form-data' },
      400,
      corsHeaders
    );
  }

  const body = await req.arrayBuffer();
  const uint8Array = new Uint8Array(body);
  const text = new TextDecoder().decode(uint8Array);

  // Simple multipart parser
  const boundaryMatch = contentType.match(/boundary=([^;]+)/);
  if (!boundaryMatch) {
    return jsonResponse(
      { error: 'No boundary in multipart request' },
      400,
      corsHeaders
    );
  }

  const boundary = boundaryMatch[1];
  const parts = text.split(`--${boundary}`);
  let configJson: string | null = null;

  for (const part of parts) {
    if (part.includes('name="config"')) {
      const match = part.match(/\r\n\r\n([\s\S]*?)\r\n/);
      if (match) {
        configJson = match[1];
        break;
      }
    }
  }

  if (!configJson) {
    return jsonResponse(
      { error: 'No config file found in upload' },
      400,
      corsHeaders
    );
  }

  // Parse and validate config
  const config = JSON.parse(configJson);
  const validation = validateServerConfiguration(config);

  if (!validation.valid) {
    return jsonResponse(
      { error: 'Invalid configuration', details: validation.errors },
      400,
      corsHeaders
    );
  }

  // Extract servers from config
  const servers = extractServersFromConfig(config);
  const failedIndices: number[] = [];
  const errors: string[] = [];

  // Register each server
  for (let i = 0; i < servers.length; i++) {
    try {
      const server = servers[i];
      dynamicServers.set(server.id, {
        id: server.id,
        name: server.name,
        endpoint: server.endpoint,
        requiresSession: server.requiresSession ?? false,
      });
    } catch (error) {
      failedIndices.push(i);
      errors.push(String(error));
    }
  }

  const response = buildBulkUploadResponse(servers, failedIndices, errors);
  return jsonResponse(response, 200, corsHeaders);
}

/**
 * Handle deleting a registered server
 */
export function handleDeleteServer(
  serverId: string,
  dynamicServers: Map<string, BackendServer>
): Response {
  if (!dynamicServers.has(serverId)) {
    return jsonResponse(
      { error: `Server not found: ${serverId}` },
      404,
      corsHeaders
    );
  }

  dynamicServers.delete(serverId);
  return jsonResponse(
    { success: true, message: `Server ${serverId} deleted` },
    200,
    corsHeaders
  );
}

/**
 * Handle server health check
 */
export async function handleServerHealth(
  serverId: string,
  dynamicServers: Map<string, BackendServer>
): Promise<Response> {
  const server = dynamicServers.get(serverId);

  if (!server) {
    return jsonResponse(
      { error: `Server not found: ${serverId}` },
      404,
      corsHeaders
    );
  }

  // Try to health check the server
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(server.endpoint, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const status = buildHealthStatusResponse(
      serverId,
      server.name,
      response.status === 200 ? 'healthy' : 'unhealthy'
    );

    return jsonResponse(status, 200, corsHeaders);
  } catch (_error) {
    const status = buildHealthStatusResponse(
      serverId,
      server.name,
      'unknown'
    );

    return jsonResponse(status, 503, corsHeaders);
  }
}

/**
 * Handle 404 for unknown paths
 */
export function handle404(): Response {
  return new Response(JSON.stringify({ error: 'Not Found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
