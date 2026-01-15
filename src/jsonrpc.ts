/**
 * JSON-RPC protocol helpers
 */

/**
 * Standard JSON-RPC 2.0 error codes
 * See: https://www.jsonrpc.org/specification#error_object
 */
export const JsonRpcErrorCode = {
  PARSE_ERROR: -32700,      // Invalid JSON
  INVALID_REQUEST: -32600,  // Not a valid Request object
  METHOD_NOT_FOUND: -32601, // Method does not exist
  INVALID_PARAMS: -32602,   // Invalid method parameters
  INTERNAL_ERROR: -32603,   // Internal JSON-RPC error
} as const;

export const jsonRpcResponse = (
  id: string | number | null,
  result: unknown
) => ({
  jsonrpc: '2.0' as const,
  id,
  result,
});

export const jsonRpcError = (
  id: string | number | null,
  code: number,
  message: string
) => ({
  jsonrpc: '2.0' as const,
  id,
  error: { code, message },
});
