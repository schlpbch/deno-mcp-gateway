/**
 * LOGGING IMPLEMENTATION GUIDE
 * 
 * Comprehensive logging has been added to track all gateway calls
 */

// ============================================================================
// LOGGER MODULE (src/logger.ts)
// ============================================================================
// A structured logging utility providing:
// - LogLevels: DEBUG, INFO, WARN, ERROR
// - Formatted timestamps (ISO 8601)
// - Structured data with JSON serialization
// - Log level filtering
// - Specialized logging methods for different operations

// ============================================================================
// LOG EXAMPLES
// ============================================================================

// Example 1: Health Check Request
// Input: GET /health
// Log Output:
// [2026-01-12T16:30:45.123Z] INFO: Incoming request {
//   "method": "GET",
//   "path": "/health",
//   "timestamp": "2026-01-12T16:30:45.123Z"
// }
// [2026-01-12T16:30:45.234Z] INFO: Health check requested {
//   "backendsCount": 4
// }
// [2026-01-12T16:30:45.456Z] INFO: Health check completed {
//   "status": "UP",
//   "healthy": 4,
//   "total": 4
// }
// [2026-01-12T16:30:45.460Z] INFO: Response sent {
//   "method": "GET",
//   "path": "/health",
//   "status": 200,
//   "durationMs": 337,
//   "timestamp": "2026-01-12T16:30:45.460Z"
// }

// Example 2: New MCP Session with StreamableHTTP
// Input: POST /mcp with Streamable HTTP request
// Log Output:
// [2026-01-12T16:31:10.100Z] INFO: Incoming request {
//   "method": "POST",
//   "path": "/mcp",
//   "timestamp": "2026-01-12T16:31:10.100Z"
// }
// [2026-01-12T16:31:10.105Z] INFO: New session created {
//   "sessionId": "7f5fb34f-8821-4cf9-b04c-747b2d5d5bd5",
//   "wantsSSE": false
// }
// [2026-01-12T16:31:10.110Z] DEBUG: StreamableHTTP request {
//   "sessionId": "7f5fb34f-8821-4cf9-b04c-747b2d5d5bd5",
//   "isNewSession": true,
//   "wantsSSE": false,
//   "requestCount": 1
// }
// [2026-01-12T16:31:10.115Z] DEBUG: Processing RPC method {
//   "sessionId": "7f5fb34f-8821-4cf9-b04c-747b2d5d5bd5",
//   "method": "tools/list"
// }
// [2026-01-12T16:31:10.450Z] INFO: Response sent {
//   "method": "POST",
//   "path": "/mcp",
//   "status": 200,
//   "durationMs": 350,
//   "timestamp": "2026-01-12T16:31:10.450Z"
// }

// Example 3: Message with Invalid Session
// Input: POST /message?sessionId=invalid-id
// Log Output:
// [2026-01-12T16:32:00.100Z] INFO: Incoming request {
//   "method": "POST",
//   "path": "/message",
//   "query": { "sessionId": "invalid-id" },
//   "timestamp": "2026-01-12T16:32:00.100Z"
// }
// [2026-01-12T16:32:00.110Z] WARN: Message received with invalid session {
//   "sessionId": "invalid-id"
// }
// [2026-01-12T16:32:00.115Z] INFO: Response sent {
//   "method": "POST",
//   "path": "/message",
//   "status": 400,
//   "durationMs": 15,
//   "timestamp": "2026-01-12T16:32:00.115Z"
// }

// Example 4: Server Error in Handler
// Input: POST /mcp with malformed body
// Log Output:
// [2026-01-12T16:33:00.100Z] INFO: Incoming request {
//   "method": "POST",
//   "path": "/mcp",
//   "timestamp": "2026-01-12T16:33:00.100Z"
// }
// [2026-01-12T16:33:00.150Z] ERROR: Request handler error {
//   "path": "/mcp",
//   "method": "POST",
//   "error": "JSON.parse error: Unexpected token",
//   "durationMs": 50
// }
// [2026-01-12T16:33:00.151Z] INFO: Response sent {
//   "method": "POST",
//   "path": "/mcp",
//   "status": 500,
//   "durationMs": 51,
//   "timestamp": "2026-01-12T16:33:00.151Z"
// }

// ============================================================================
// AVAILABLE LOGGING METHODS
// ============================================================================

// import { logger } from './src/logger.ts';

// Basic logging
// logger.debug(message, data?)   // DEBUG level
// logger.info(message, data?)    // INFO level
// logger.warn(message, data?)    // WARN level
// logger.error(message, data?)   // ERROR level

// Specialized logging methods:
// logger.logRequest(method, path, query?, headers?)
// logger.logResponse(method, path, statusCode, durationMs, size?)
// logger.logBackendCall(method, endpoint, serverId, durationMs, statusCode?, error?)
// logger.logSession(action, sessionId, serverId?)
// logger.logCircuitBreaker(serverId, state, failureCount?)
// logger.logMcpMethod(method, params?, serverId?)
// logger.logCache(operation, key, ttl?)

// ============================================================================
// LOGGING CONFIGURATION
// ============================================================================

// To change log level at runtime:
// import { logger, LogLevel } from './src/logger.ts';
// logger.setMinLevel(LogLevel.DEBUG);  // Show all messages
// logger.setMinLevel(LogLevel.ERROR);  // Only show errors

// ============================================================================
// WHERE LOGGING IS IMPLEMENTED
// ============================================================================

// 1. main.ts - Request handler entry point
//    ✓ Incoming request logging
//    ✓ Response timing and status
//    ✓ Error handling and logging

// 2. handlers.ts
//    ✓ handleHealth - Backend health check results
//    ✓ handleMessage - Message processing and session validation
//    ✓ handleStreamableHttp - Session creation and RPC method calls

// 3. Additional locations ready for logging:
//    - backend.ts - Circuit breaker state changes, backend calls
//    - session.ts - Session lifecycle events
//    - mcprequest.ts - MCP method invocations

// ============================================================================
// LOG OUTPUT DESTINATION
// ============================================================================

// Logs are written to:
// - Local development: console (stdout/stderr)
// - Deno Deploy: Available in deployment logs
// - Use with: deno task dev (local) or deployctl logs (production)

// Example: View logs in development
// deno task dev 2>&1 | grep "INFO\|ERROR"
// deno task dev 2>&1 | grep "sessionId"

// ============================================================================
// LOG FILTERING EXAMPLES
// ============================================================================

// Show only errors:
// deno task dev 2>&1 | grep ERROR

// Show health checks:
// deno task dev 2>&1 | grep "health\|Health"

// Show session activity:
// deno task dev 2>&1 | grep "session\|Session"

// Show specific server:
// deno task dev 2>&1 | grep "journey-service-mcp"

// Show request latencies:
// deno task dev 2>&1 | grep "durationMs"

// ============================================================================
// NEXT STEPS FOR ENHANCED LOGGING
// ============================================================================

// 1. Add database/file persistence for logs
// 2. Implement log aggregation (e.g., to external service)
// 3. Add request correlation IDs for tracing
// 4. Implement structured logging format (JSON) for parsing
// 5. Add performance metrics collection
// 6. Implement log rotation and retention policies
