/**
 * JSON-RPC protocol helpers
 */

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
