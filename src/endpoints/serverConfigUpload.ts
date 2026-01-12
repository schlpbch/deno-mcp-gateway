/**
 * Server Configuration Upload and Management Endpoints
 *
 * Provides REST API endpoints for uploading, managing, and querying MCP server configurations.
 */

export interface UploadServerConfigRequest {
  id: string;
  name: string;
  endpoint: string;
  requiresSession?: boolean;
}

export interface UploadServerConfigResponse {
  success: boolean;
  uploaded?: number;
  failed?: number;
  servers?: UploadServerConfigRequest[];
  errors?: string[];
  message?: string;
  serverId?: string;
}

export interface ServerHealthStatus {
  id: string;
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown' | 'degraded';
  latencyMs?: number;
  error?: string;
}

/**
 * Validate server configuration structure and content
 */
export function validateServerConfiguration(
  config: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    errors.push('Configuration must be a valid JSON object');
    return { valid: false, errors };
  }

  const cfg = config as Record<string, unknown>;

  if (!Array.isArray(cfg.servers)) {
    errors.push('Configuration must have a "servers" array');
    return { valid: false, errors };
  }

  const serverIds = new Set<string>();

  for (let i = 0; i < cfg.servers.length; i++) {
    const server = cfg.servers[i];

    if (!server || typeof server !== 'object') {
      errors.push(`Server ${i}: must be a valid object`);
      continue;
    }

    const s = server as Record<string, unknown>;

    // Validate required fields
    if (!s.id || typeof s.id !== 'string') {
      errors.push(`Server ${i}: missing or invalid required field "id"`);
    } else {
      // Check for duplicates
      if (serverIds.has(s.id as string)) {
        errors.push(
          `Server ${i}: duplicate server ID "${s.id}" (IDs must be unique)`
        );
      }
      serverIds.add(s.id as string);
    }

    if (!s.name || typeof s.name !== 'string') {
      errors.push(`Server ${i}: missing or invalid required field "name"`);
    }

    if (!s.endpoint || typeof s.endpoint !== 'string') {
      errors.push(`Server ${i}: missing or invalid required field "endpoint"`);
    } else {
      // Validate URL format
      try {
        new URL(s.endpoint as string);
      } catch {
        errors.push(`Server ${i}: invalid endpoint URL: "${s.endpoint}"`);
      }
    }

    // Validate optional boolean field
    if (
      s.requiresSession !== undefined &&
      typeof s.requiresSession !== 'boolean'
    ) {
      errors.push(`Server ${i}: "requiresSession" must be a boolean`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Extract servers from validated configuration
 */
export function extractServersFromConfig(
  config: unknown
): UploadServerConfigRequest[] {
  if (!config || typeof config !== 'object') {
    return [];
  }

  const cfg = config as Record<string, unknown>;

  if (!Array.isArray(cfg.servers)) {
    return [];
  }

  return cfg.servers.map((s: unknown) => {
    const server = s as Record<string, unknown>;
    return {
      id: server.id as string,
      name: server.name as string,
      endpoint: server.endpoint as string,
      requiresSession: (server.requiresSession as boolean | undefined) ||
        false,
    };
  });
}

/**
 * Build multipart form handler for file uploads
 */
export async function parseMultipartFormData(
  req: Request
): Promise<{ files: Map<string, unknown>; errors: string[] }> {
  const files = new Map<string, unknown>();
  const errors: string[] = [];

  try {
    const contentType = req.headers.get('content-type');

    if (!contentType?.includes('multipart/form-data')) {
      errors.push(
        'Content-Type must be multipart/form-data for file uploads'
      );
      return { files, errors };
    }

    const formData = await req.formData();

    for (const [name, value] of formData) {
      if (value instanceof File) {
        try {
          const text = await value.text();
          const json = JSON.parse(text);
          files.set(name, json);
        } catch (error) {
          errors.push(
            `File "${name}": invalid JSON format (${error instanceof Error ? error.message : 'unknown error'})`
          );
        }
      } else {
        files.set(name, value);
      }
    }
  } catch (error) {
    errors.push(
      `Failed to parse form data: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }

  return { files, errors };
}

/**
 * Build response for server registration
 */
export function buildRegistrationResponse(
  serverId: string,
  success: boolean,
  message?: string
): UploadServerConfigResponse {
  return {
    success,
    serverId,
    message: message || `Server "${serverId}" registered successfully`,
  };
}

/**
 * Build response for bulk upload
 */
export function buildBulkUploadResponse(
  servers: UploadServerConfigRequest[],
  failedIndices: number[],
  errors: string[]
): UploadServerConfigResponse {
  const successful = servers.filter(
    (_, i) => !failedIndices.includes(i)
  );

  return {
    success: failedIndices.length === 0,
    uploaded: successful.length,
    failed: failedIndices.length,
    servers: successful,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Build health status response
 */
export function buildHealthStatusResponse(
  id: string,
  name: string,
  status: 'healthy' | 'unhealthy' | 'unknown' | 'degraded' = 'unknown'
): ServerHealthStatus {
  return {
    id,
    name,
    status,
  };
}

/**
 * Build error response
 */
export function buildErrorResponse(
  message: string,
  errors?: string[]
): Record<string, unknown> {
  return {
    error: message,
    ...(errors && errors.length > 0 && { details: errors }),
  };
}

/**
 * Generate JSON response
 */
export function jsonResponse(
  data: unknown,
  status = 200,
  corsHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(corsHeaders || {}),
    },
  });
}
