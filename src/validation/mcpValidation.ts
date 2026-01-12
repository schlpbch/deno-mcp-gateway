/**
 * MCP Protocol Request Validation
 * 
 * Provides validation and sanitization for MCP protocol requests
 * to prevent malformed requests and security vulnerabilities.
 */

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Namespace pattern: alphanumeric with hyphens/underscores
 * Tool/Prompt name pattern: alphanumeric with underscores
 * Note: The NAMESPACED_NAME_PATTERN ensures both parts are validated separately
 */
const NAMESPACE_PATTERN = /^[a-zA-Z0-9_-]+$/;
const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_]+$/;
const NAMESPACED_NAME_PATTERN = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_]+$/;

/**
 * Dangerous URI schemes that should be blocked
 */
const DANGEROUS_URI_SCHEMES = [
  'file',
  'javascript',
  'data',
  'vbscript',
  'about',
];

/**
 * Forbidden keys that indicate prototype pollution attempts
 */
const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * Validate tool call request
 */
export function validateToolCall(params: unknown): ValidationResult {
  const errors: string[] = [];

  if (!params || typeof params !== 'object') {
    errors.push('params must be an object');
    return { valid: false, errors };
  }

  const p = params as Record<string, unknown>;

  // Validate name field
  if (!p.name) {
    errors.push('name is required');
  } else if (typeof p.name !== 'string') {
    errors.push('name must be a string');
  } else {
    // Validate namespace format
    if (!NAMESPACED_NAME_PATTERN.test(p.name)) {
      errors.push(
        'name must match pattern {namespace}.{toolName} (e.g., "journey.findTrips")'
      );
    } else {
      const [namespace, toolName] = p.name.split('.');
      if (!NAMESPACE_PATTERN.test(namespace)) {
        errors.push(
          'namespace must be alphanumeric with hyphens/underscores only'
        );
      }
      if (!TOOL_NAME_PATTERN.test(toolName)) {
        errors.push('tool name must be alphanumeric with underscores only');
      }
    }
  }

  // Validate arguments field (optional)
  if (p.arguments !== undefined) {
    if (typeof p.arguments !== 'object' || p.arguments === null) {
      errors.push('arguments must be an object');
    } else {
      // Check for forbidden keys (prototype pollution)
      const hasProhibitedKeys = hasForbiddenKeys(p.arguments);
      if (hasProhibitedKeys) {
        errors.push(
          'arguments contain forbidden keys (__proto__, constructor, prototype)'
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate resource read request
 */
export function validateResourceRead(params: unknown): ValidationResult {
  const errors: string[] = [];

  if (!params || typeof params !== 'object') {
    errors.push('params must be an object');
    return { valid: false, errors };
  }

  const p = params as Record<string, unknown>;

  // Validate uri field
  if (!p.uri) {
    errors.push('uri is required');
  } else if (typeof p.uri !== 'string') {
    errors.push('uri must be a string');
  } else {
    const uri = p.uri as string;

    // Check for URI scheme
    if (!uri.includes('://')) {
      errors.push('uri must include a scheme (e.g., "journey://trips/123")');
    } else {
      const scheme = uri.split('://')[0].toLowerCase();

      // Block dangerous schemes
      if (DANGEROUS_URI_SCHEMES.includes(scheme)) {
        errors.push(
          `uri scheme "${scheme}" is not allowed (dangerous scheme)`
        );
      }

      // Validate namespace (scheme should be a valid server ID)
      if (!NAMESPACE_PATTERN.test(scheme)) {
        errors.push(
          'uri scheme must be alphanumeric with hyphens/underscores only'
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate prompt get request
 */
export function validatePromptGet(params: unknown): ValidationResult {
  const errors: string[] = [];

  if (!params || typeof params !== 'object') {
    errors.push('params must be an object');
    return { valid: false, errors };
  }

  const p = params as Record<string, unknown>;

  // Validate name field
  if (!p.name) {
    errors.push('name is required');
  } else if (typeof p.name !== 'string') {
    errors.push('name must be a string');
  } else {
    // Validate namespace format
    if (!NAMESPACED_NAME_PATTERN.test(p.name)) {
      errors.push(
        'name must match pattern {namespace}.{promptName} (e.g., "journey.tripSummary")'
      );
    } else {
      const [namespace, promptName] = p.name.split('.');
      if (!NAMESPACE_PATTERN.test(namespace)) {
        errors.push(
          'namespace must be alphanumeric with hyphens/underscores only'
        );
      }
      if (!TOOL_NAME_PATTERN.test(promptName)) {
        errors.push('prompt name must be alphanumeric with underscores only');
      }
    }
  }

  // Validate arguments field (optional)
  if (p.arguments !== undefined) {
    if (typeof p.arguments !== 'object' || p.arguments === null) {
      errors.push('arguments must be an object');
    } else {
      // Check for forbidden keys
      const hasProhibitedKeys = hasForbiddenKeys(p.arguments);
      if (hasProhibitedKeys) {
        errors.push(
          'arguments contain forbidden keys (__proto__, constructor, prototype)'
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate namespace format
 */
export function validateNamespace(name: string): ValidationResult {
  const errors: string[] = [];

  if (!name || typeof name !== 'string') {
    errors.push('name must be a non-empty string');
    return { valid: false, errors };
  }

  if (!NAMESPACED_NAME_PATTERN.test(name)) {
    errors.push(
      'name must match pattern {namespace}.{name} (e.g., "journey.findTrips")'
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Sanitize input by removing forbidden keys recursively
 * Uses Object.getOwnPropertyNames to catch all properties including __proto__
 */
export function sanitizeInput(input: unknown): unknown {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input !== 'object') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeInput(item));
  }

  // Handle objects - use getOwnPropertyNames to catch all properties
  const sanitized: Record<string, unknown> = {};
  const obj = input as Record<string, unknown>;

  // Get all own property names (including non-enumerable)
  const allKeys = Object.getOwnPropertyNames(obj);
  
  for (const key of allKeys) {
    // Skip forbidden keys
    if (FORBIDDEN_KEYS.includes(key)) {
      continue;
    }

    // Recursively sanitize nested objects
    sanitized[key] = sanitizeInput(obj[key]);
  }

  return sanitized;
}

/**
 * Check if an object contains forbidden keys (recursively)
 * Uses hasOwnProperty to detect __proto__, constructor, and prototype
 */
function hasForbiddenKeys(obj: unknown): boolean {
  if (obj === null || obj === undefined) {
    return false;
  }

  if (typeof obj !== 'object') {
    return false;
  }

  if (Array.isArray(obj)) {
    return obj.some((item) => hasForbiddenKeys(item));
  }

  const record = obj as Record<string, unknown>;

  // Check for forbidden keys using hasOwnProperty
  for (const forbiddenKey of FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, forbiddenKey)) {
      return true;
    }
  }

  // Check nested objects
  for (const value of Object.values(record)) {
    if (hasForbiddenKeys(value)) {
      return true;
    }
  }

  return false;
}
