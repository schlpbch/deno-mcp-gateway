/**
 * Backend communication module
 * Handles JSON-RPC requests to backend servers with circuit breaker
 */

import { CircuitBreakerRegistry, CircuitState } from './circuitbreaker/mod.ts';
import type { BackendServer, ServerHealth } from './types.ts';
import { metrics } from './session.ts';

export type { ServerHealth };

let requestIdCounter = 1;
const backendSessions = new Map<string, string>();
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * Get or create a session for a backend server
 */
export async function getBackendSession(
  server: BackendServer
): Promise<string | null> {
  if (!server.requiresSession) {
    return null;
  }

  const existingSession = backendSessions.get(server.id);
  if (existingSession) {
    return existingSession;
  }

  // Sessions must be initialized externally
  return null;
}

/**
 * Send JSON-RPC request to a backend server
 */
export async function sendJsonRpcRequest(
  endpoint: string,
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs = 30000,
  sessionId?: string | null
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };

  if (sessionId) {
    headers['Mcp-Session-Id'] = sessionId;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: requestIdCounter++,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const text = await response.text();

    // Parse SSE or plain JSON response
    if (text.startsWith('event:') || text.startsWith('data:')) {
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonRpc = JSON.parse(line.substring(6));
          if (jsonRpc.error) throw new Error(jsonRpc.error.message);
          return jsonRpc.result;
        }
      }
      throw new Error('No data in SSE response');
    }

    const jsonRpc = JSON.parse(text);
    if (jsonRpc.error) throw new Error(jsonRpc.error.message);
    return jsonRpc.result;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Send JSON-RPC request to a backend server with circuit breaker protection
 */
export async function sendToBackend(
  server: BackendServer,
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs = 30000
): Promise<unknown> {
  const circuitBreaker = circuitBreakerRegistry.getOrCreate(server.id, {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
  });

  return circuitBreaker.execute(async () => {
    const sessionId = await getBackendSession(server);
    return sendJsonRpcRequest(
      server.endpoint,
      method,
      params,
      timeoutMs,
      sessionId
    );
  });
}

/**
 * Check health of a backend server
 */
export async function checkBackendHealth(
  server: BackendServer
): Promise<ServerHealth> {
  const circuitBreaker = circuitBreakerRegistry.getOrCreate(server.id);
  const cbStatus = circuitBreaker.getStatus();

  // If circuit breaker is open, report it immediately
  if (cbStatus.state === CircuitState.OPEN) {
    return {
      id: server.id,
      name: server.name,
      status: 'open',
      error: 'Circuit breaker is open - service unavailable',
      circuitBreakerState: CircuitState.OPEN,
    };
  }

  const start = Date.now();
  try {
    await sendToBackend(server, 'ping', {}, 5000);
    return {
      id: server.id,
      name: server.name,
      status: 'healthy',
      latencyMs: Date.now() - start,
      circuitBreakerState: cbStatus.state,
    };
  } catch (e) {
    return {
      id: server.id,
      name: server.name,
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : 'Unknown error',
      circuitBreakerState: cbStatus.state,
    };
  }
}

/**
 * Fetch tools from a backend server
 */
export async function fetchToolsFromServer(
  server: BackendServer
): Promise<unknown[]> {
  try {
    const result = (await sendToBackend(server, 'tools/list')) as {
      tools?: unknown[];
    };
    return (result.tools || []).map((tool: unknown) => {
      const t = tool as Record<string, unknown>;
      const toolName = t.name as string;
      
      // Check if the tool name already starts with the server ID
      // This prevents double-prefixing when backends use v2.0.0 namespacing
      const namespacedName = toolName.startsWith(`${server.id}__`)
        ? toolName
        : `${server.id}__${toolName}`;
      
      return {
        ...t,
        name: namespacedName,
      };
    });
  } catch (e) {
    console.error(`Failed to fetch tools from ${server.name}:`, e);
    return [];
  }
}

/**
 * Fetch resources from a backend server
 */
export async function fetchResourcesFromServer(
  server: BackendServer
): Promise<unknown[]> {
  try {
    const result = (await sendToBackend(server, 'resources/list')) as {
      resources?: unknown[];
    };
    return (result.resources || []).map((resource: unknown) => {
      const r = resource as Record<string, unknown>;
      return {
        ...r,
        uri: `${server.id}://${r.uri}`,
        _server: {
          id: server.id,
          name: server.name,
        },
      };
    });
  } catch (e) {
    console.error(`Failed to fetch resources from ${server.name}:`, e);
    return [];
  }
}

/**
 * Fetch prompts from a backend server
 */
export async function fetchPromptsFromServer(
  server: BackendServer
): Promise<unknown[]> {
  try {
    const result = (await sendToBackend(server, 'prompts/list')) as {
      prompts?: unknown[];
    };
    return (result.prompts || []).map((prompt: unknown) => {
      const p = prompt as Record<string, unknown>;
      const promptName = p.name as string;
      
      // Check if the prompt name already starts with the server ID
      // This prevents double-prefixing when backends use v2.0.0 namespacing
      const namespacedName = promptName.startsWith(`${server.id}__`)
        ? promptName
        : `${server.id}__${promptName}`;
      
      return {
        ...p,
        name: namespacedName,
      };
    });
  } catch (e) {
    console.error(`Failed to fetch prompts from ${server.name}:`, e);
    return [];
  }
}

/**
 * Call a tool on a backend server
 */
export async function callToolOnServer(
  toolName: string,
  args: Record<string, unknown>,
  getServer: (id: string) => BackendServer | undefined
): Promise<unknown> {
  // Split on double underscore (namespace separator)
  const separatorIndex = toolName.indexOf('__');
  if (separatorIndex === -1) {
    throw new Error(`Invalid tool name format: ${toolName}`);
  }
  const serverId = toolName.substring(0, separatorIndex);
  const actualToolName = toolName.substring(separatorIndex + 2);

  const server = getServer(serverId);
  if (!server) {
    throw new Error(`Unknown server: ${serverId}`);
  }

  metrics.toolCalls++;
  return await sendToBackend(server, 'tools/call', {
    name: actualToolName,
    arguments: args,
  });
}

/**
 * Read a resource from a backend server
 */
export async function readResourceFromServer(
  uri: string,
  getServer: (id: string) => BackendServer | undefined
): Promise<unknown> {
  // Parse URI format: serverId://originalUri
  const match = uri.match(/^([^:]+):\/\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid resource URI: ${uri}`);
  }

  const [, serverId, originalUri] = match;
  const server = getServer(serverId);
  if (!server) {
    throw new Error(`Unknown server: ${serverId}`);
  }

  return await sendToBackend(server, 'resources/read', { uri: originalUri });
}

/**
 * Get a prompt from a backend server
 */
export async function getPromptFromServer(
  promptName: string,
  args: Record<string, unknown> | undefined,
  getServer: (id: string) => BackendServer | undefined
): Promise<unknown> {
  // Split on double underscore (namespace separator)
  const separatorIndex = promptName.indexOf('__');
  if (separatorIndex === -1) {
    throw new Error(`Invalid prompt name format: ${promptName}`);
  }
  const serverId = promptName.substring(0, separatorIndex);
  const actualPromptName = promptName.substring(separatorIndex + 2);

  const server = getServer(serverId);
  if (!server) {
    throw new Error(`Unknown server: ${serverId}`);
  }

  return await sendToBackend(server, 'prompts/get', {
    name: actualPromptName,
    arguments: args,
  });
}
