/**
 * MCP request handler module
 * Implements the core MCP protocol methods
 */

import { SERVER_INFO } from './config.ts';
import {
  fetchToolsFromServer,
  fetchResourcesFromServer,
  fetchPromptsFromServer,
  callToolOnServer,
  readResourceFromServer,
  getPromptFromServer,
} from './backend.ts';
import {
  validateToolCall,
  validateResourceRead,
  validatePromptGet,
  sanitizeInput,
} from './validation/mcpValidation.ts';
import type { BackendServer } from './types.ts';
import { logger } from './logger.ts';
import * as kv from './kv.ts';

/**
 * Get a server by ID from static, dynamic, or KV registry
 */
export function createGetServer(
  staticServers: BackendServer[],
  dynamicServers: Map<string, BackendServer>,
  kvServers: BackendServer[]
) {
  return (id: string): BackendServer | undefined => {
    // Check KV first (highest priority), then dynamic, then static
    return (
      kvServers.find((s) => s.id === id) ||
      dynamicServers.get(id) ||
      staticServers.find((s) => s.id === id)
    );
  };
}

/**
 * Get all servers (static + dynamic + KV)
 */
export async function getAllServers(
  staticServers: BackendServer[],
  dynamicServers: Map<string, BackendServer>
): Promise<BackendServer[]> {
  // Deduplicate by ID (KV servers override dynamic, which override static)
  const serverMap = new Map<string, BackendServer>();
  staticServers.forEach((s) => serverMap.set(s.id, s));
  Array.from(dynamicServers.values()).forEach((s) => serverMap.set(s.id, s));

  // Add servers from KV storage
  const kvServers = await kv.listServers();
  kvServers.forEach((s) => serverMap.set(s.id, s));

  return Array.from(serverMap.values());
}

/**
 * Handle JSON-RPC requests
 */
export async function handleJsonRpcRequest(
  method: string,
  params: Record<string, unknown> | undefined,
  staticServers: BackendServer[],
  dynamicServers: Map<string, BackendServer>
): Promise<unknown> {
  // Fetch servers from KV for cross-isolate persistence
  const kvServers = await kv.listServers();
  const getServer = createGetServer(staticServers, dynamicServers, kvServers);
  const allServers = await getAllServers(staticServers, dynamicServers);

  // Log MCP method call
  logger.info('MCP request', {
    method,
    serverCount: allServers.length,
    hasParams: !!params,
  });

  const startTime = performance.now();

  try {
    const result = await handleMcpMethod(method, params, getServer, allServers);
    const durationMs = performance.now() - startTime;
    logger.info('MCP response', { method, durationMs: Math.round(durationMs) });
    return result;
  } catch (error) {
    const durationMs = performance.now() - startTime;
    logger.error('MCP error', {
      method,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Math.round(durationMs),
    });
    throw error;
  }
}

async function handleMcpMethod(
  method: string,
  params: Record<string, unknown> | undefined,
  getServer: (id: string) => BackendServer | undefined,
  allServers: BackendServer[]
): Promise<unknown> {
  switch (method) {
    case 'initialize':
      return {
        protocolVersion: SERVER_INFO.protocolVersion,
        capabilities: {
          tools: { listChanged: false },
          resources: { listChanged: false },
          prompts: { listChanged: false },
        },
        serverInfo: {
          name: SERVER_INFO.name,
          version: SERVER_INFO.version,
        },
      };

    case 'notifications/initialized':
      return undefined;

    case 'tools/list': {
      const toolsArrays = await Promise.all(
        allServers.map((server) => fetchToolsFromServer(server))
      );
      return { tools: toolsArrays.flat() };
    }

    case 'tools/call': {
      // Validate request
      const validation = validateToolCall(params);
      if (!validation.valid) {
        throw new Error(
          `Invalid tool call: ${validation.errors.join(', ')}`
        );
      }

      const name = params?.name as string;
      const args = sanitizeInput(
        params?.arguments || {}
      ) as Record<string, unknown>;
      return await callToolOnServer(name, args, getServer);
    }

    case 'resources/list': {
      const resourcesArrays = await Promise.all(
        allServers.map((server) => fetchResourcesFromServer(server))
      );
      return { resources: resourcesArrays.flat() };
    }

    case 'resources/read': {
      // Validate request
      const validation = validateResourceRead(params);
      if (!validation.valid) {
        throw new Error(
          `Invalid resource read: ${validation.errors.join(', ')}`
        );
      }

      const uri = params?.uri as string;
      return await readResourceFromServer(uri, getServer);
    }

    case 'prompts/list': {
      const promptsArrays = await Promise.all(
        allServers.map((server) => fetchPromptsFromServer(server))
      );
      return { prompts: promptsArrays.flat() };
    }

    case 'prompts/get': {
      // Validate request
      const validation = validatePromptGet(params);
      if (!validation.valid) {
        throw new Error(
          `Invalid prompt request: ${validation.errors.join(', ')}`
        );
      }

      const name = params?.name as string;
      const args = sanitizeInput(
        params?.arguments
      ) as Record<string, unknown> | undefined;
      return await getPromptFromServer(name, args, getServer);
    }

    case 'ping':
      return {};

    default:
      throw new Error(`Method not found: ${method}`);
  }
}
