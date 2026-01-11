# MCP Gateway Routing Architecture

## MCP Standard Specification

Based on the MCP (Model Context Protocol) specification from the official Python SDK implementation:

### HTTP Transport Endpoints

The MCP standard specifies a **single HTTP endpoint** for the Streamable HTTP transport:

- **Primary endpoint**: `POST /` (or `POST /mcp` by convention)
  - Handles JSON-RPC requests from clients
  - Returns either JSON responses or SSE streams based on Accept headers
  - Session management via `Mcp-Session-Id` header
  - Protocol version negotiation via `Mcp-Protocol-Version` header

- **Optional GET endpoint**: `GET /` (or `GET /mcp`)
  - Establishes SSE stream for server-initiated messages
  - Requires valid session ID via header
  - Supports resumability with `Last-Event-ID` header

- **Optional DELETE endpoint**: `DELETE /` (or `DELETE /mcp`)
  - Explicit session termination
  - Cleans up server resources

### Key MCP Standard Requirements

✅ **Content Negotiation** (Accept headers required):
```
Accept: application/json, text/event-stream
Content-Type: application/json
```

✅ **Session Management** (Optional but recommended):
```
Mcp-Session-Id: {uuid}
Mcp-Protocol-Version: 2024-11-05
```

✅ **Response Formats**:
- JSON responses for stateless/simple operations
- SSE (Server-Sent Events) for streaming responses
- Supports batch requests (array of JSON-RPC messages)

✅ **Error Handling**:
- HTTP status codes: 202 Accepted, 406 Not Acceptable, 400 Bad Request, 405 Method Not Allowed
- JSON-RPC error format for protocol errors

✅ **Resumability** (Optional):
- Event storage for dropped connections
- `Last-Event-ID` header for reconnection
- Client can resume and receive missed events

### Current Gateway Implementation vs Standard

**Current Structure:**
```
Management Endpoints (outside /mcp/):
- GET  /health              ← NOT in MCP spec
- GET  /metrics             ← NOT in MCP spec
- GET  /sse                 ← Custom SSE variant
- POST /message             ← Custom message handler

MCP Protocol Endpoints (under /mcp/):
- POST /mcp                 ✅ Matches MCP spec
- GET  /mcp                 ✅ Matches MCP spec (optional)
- DELETE /mcp               ✅ Matches MCP spec (optional)
- GET  /mcp/tools/list      ✓ Extended REST variant
- GET  /mcp/resources/list  ✓ Extended REST variant
- GET  /mcp/prompts/list    ✓ Extended REST variant
```

**Standards Compliance:**
- ✅ Core MCP endpoints are spec-compliant
- ⚠️ Extended REST endpoints are useful but not part of standard
- ℹ️ Health/metrics are common but outside MCP specification

## Recommendations

### Option A: Keep Current Structure (RECOMMENDED)
**Pros:**
- ✅ Follows common API patterns (health at root level)
- ✅ MCP-compliant for core protocol
- ✅ Health/metrics easily discoverable for orchestration
- ✅ Extended REST endpoints for web UI convenience

**Cons:**
- API is slightly fragmented across namespaces

### Option B: Move Everything Under /mcp/
**Pros:**
- ✅ All features in one namespace
- ✅ Cleaner from MCP perspective
- ✅ Matches pure MCP server implementation

**Cons:**
- ❌ Health endpoints not at standard location (breaks load balancer conventions)
- ❌ Makes monitoring harder for orchestration systems
- ❌ Deviates from HTTP API best practices

### Option C: Hybrid (Balanced Approach)
**Suggested Layout:**
```
GET  /health              ← Standard location for K8s, load balancers
GET  /metrics             ← Standard location for monitoring

GET  /mcp/tools/list      ← REST convenience API (grouped)
GET  /mcp/resources/list  
GET  /mcp/prompts/list

POST /mcp                 ← Core MCP protocol
GET  /mcp                 ← Optional SSE for server->client
DELETE /mcp               ← Session cleanup
```

## Conclusion

The MCP standard is **endpoint-agnostic for non-protocol features**. It only specifies:
- `POST /` (or configured path) for JSON-RPC requests
- `GET /` (optional) for server-initiated SSE
- `DELETE /` (optional) for session termination

Everything else (health, metrics, REST variants) is implementation-specific.

### Current Implementation Assessment:
✅ **MCP Protocol Compliant** - Core endpoints follow standard
✅ **Well-Designed** - Health/metrics at standard locations
✅ **Production-Ready** - Suitable for orchestration systems

**Recommendation:** Keep the current structure. It's compliant, practical, and follows industry best practices.

