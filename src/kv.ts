/**
 * Deno KV Storage for Dynamic Server Registry
 *
 * Provides persistent storage for dynamically registered MCP servers.
 * Uses Deno KV for cross-isolate persistence on Deno Deploy.
 */

import type { BackendServer } from './types.ts';
import { logger } from './logger.ts';

const SERVERS_PREFIX = ['dynamic_servers'];

let kv: Deno.Kv | null = null;

/**
 * Get or initialize the KV store
 */
async function getKv(): Promise<Deno.Kv> {
  if (!kv) {
    kv = await Deno.openKv();
  }
  return kv;
}

/**
 * Save a server to KV storage
 */
export async function saveServer(server: BackendServer): Promise<void> {
  const store = await getKv();
  await store.set([...SERVERS_PREFIX, server.id], server);
  logger.info('Server saved to KV', { serverId: server.id });
}

/**
 * Get a server from KV storage
 */
export async function getServer(id: string): Promise<BackendServer | null> {
  const store = await getKv();
  const result = await store.get<BackendServer>([...SERVERS_PREFIX, id]);
  return result.value;
}

/**
 * Delete a server from KV storage
 */
export async function deleteServer(id: string): Promise<boolean> {
  const store = await getKv();
  const existing = await store.get([...SERVERS_PREFIX, id]);
  if (!existing.value) {
    return false;
  }
  await store.delete([...SERVERS_PREFIX, id]);
  logger.info('Server deleted from KV', { serverId: id });
  return true;
}

/**
 * List all servers from KV storage
 */
export async function listServers(): Promise<BackendServer[]> {
  const store = await getKv();
  const servers: BackendServer[] = [];

  const iter = store.list<BackendServer>({ prefix: SERVERS_PREFIX });
  for await (const entry of iter) {
    if (entry.value) {
      servers.push(entry.value);
    }
  }

  return servers;
}

/**
 * Save multiple servers to KV storage (for bulk upload)
 */
export async function saveServers(servers: BackendServer[]): Promise<void> {
  const store = await getKv();

  for (const server of servers) {
    await store.set([...SERVERS_PREFIX, server.id], server);
  }

  logger.info('Bulk servers saved to KV', { count: servers.length });
}

/**
 * Sync KV storage to in-memory Map (for backward compatibility)
 */
export async function syncToMap(map: Map<string, BackendServer>): Promise<void> {
  const servers = await listServers();
  map.clear();
  for (const server of servers) {
    map.set(server.id, server);
  }
  logger.info('Synced KV to in-memory map', { count: servers.length });
}

/**
 * Close the KV store (for testing cleanup)
 */
export async function closeKv(): Promise<void> {
  if (kv) {
    kv.close();
    kv = null;
  }
}
