/**
 * Configuration module for Federated MCP Gateway
 * Handles environment-based server initialization and constants
 */

import type { BackendServer } from './types.ts';

export type { BackendServer };

export const SERVER_INFO = {
  name: 'mcp-gateway',
  version: '3.2.0',
  protocolVersion: '2025-06-18',
};

/**
 * Initialize servers from environment variables
 * Configure servers via:
 * 1. Environment variables: JOURNEY_SERVICE_URL, SWISS_MOBILITY_URL, etc.
 * 2. Dynamic registration API: POST /mcp/servers/register
 * 3. Upload script: deno task upload-config
 */
export function initializeServersFromEnv(): BackendServer[] {
  const servers: BackendServer[] = [];

  // Journey Service
  const journeyUrl = Deno.env.get('JOURNEY_SERVICE_URL');
  if (journeyUrl) {
    servers.push({
      id: 'journey',
      name: 'Journey Service',
      endpoint: journeyUrl,
      requiresSession: true,
    });
  }

  // Swiss Mobility
  const mobilityUrl = Deno.env.get('SWISS_MOBILITY_URL');
  if (mobilityUrl) {
    servers.push({
      id: 'swiss-mobility',
      name: 'Swiss Mobility',
      endpoint: mobilityUrl,
      requiresSession: false,
    });
  }

  // Aareguru
  const aaregruUrl = Deno.env.get('AAREGURU_URL');
  if (aaregruUrl) {
    servers.push({
      id: 'aareguru',
      name: 'Aareguru',
      endpoint: aaregruUrl,
      requiresSession: false,
    });
  }

  // Open Meteo
  const meteoUrl = Deno.env.get('OPEN_METEO_URL');
  if (meteoUrl) {
    servers.push({
      id: 'open-meteo',
      name: 'Open Meteo',
      endpoint: meteoUrl,
      requiresSession: false,
    });
  }

  return servers;
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id',
};
