/**
 * Centralized type definitions for MCP Gateway
 * Re-exports and extends shared types from packages/types
 */

// ============================================================================
// Server Configuration Types
// ============================================================================

export interface BackendServer {
  id: string;
  name: string;
  endpoint: string;
  requiresSession: boolean;
}

export interface ServerHealth {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unhealthy' | 'open';
  latencyMs?: number;
  error?: string;
  circuitBreakerState?: string;
}

// ============================================================================
// Session Types
// ============================================================================

export interface Session {
  id: string;
  serverId: string;
  transportType: 'sse' | 'http';
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

export interface SessionMetrics {
  totalSessions: number;
  activeSessions: number;
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
}

// ============================================================================
// JSON-RPC Types
// ============================================================================

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// ============================================================================
// MCP Protocol Types
// ============================================================================

export interface MCPCapabilities {
  tools?: ToolCapability[];
  resources?: ResourceCapability[];
  prompts?: PromptCapability[];
}

export interface ToolCapability {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface ResourceCapability {
  uriTemplate: string;
  mimeType?: string;
  description?: string;
}

export interface PromptCapability {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

// ============================================================================
// Tool Types
// ============================================================================

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  result: unknown;
  error?: string;
}

// ============================================================================
// Resource Types
// ============================================================================

export interface ResourceRequest {
  uri: string;
}

export interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: Uint8Array;
}

export interface ResourceResponse {
  uri: string;
  contents: ResourceContent[];
}

// ============================================================================
// Prompt Types
// ============================================================================

export interface PromptRequest {
  name: string;
  arguments?: Record<string, string>;
}

export interface PromptMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PromptResponse {
  messages: PromptMessage[];
}

// ============================================================================
// Health & Metrics Types
// ============================================================================

export interface HealthResponse {
  status: 'UP' | 'DEGRADED' | 'DOWN';
  server: 'UP' | 'DEGRADED' | 'DOWN';
  backends: ServerHealth[];
}

export interface MetricsResponse {
  uptime: string;
  totalRequests: number;
  totalErrors: number;
  errorRate?: string;
  timestamp?: string;
  requests?: {
    total: number;
    errors: number;
    errorRate?: string;
  };
  latency?: {
    avg: string;
    p50: string;
    p95: string;
    p99: string;
  };
  cache?: {
    hitRate: string;
    memorySize: number;
  };
  circuitBreakers?: Record<string, unknown>;
  endpoints?: Record<string, unknown>;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  status: number;
  data?: T;
  error?: string;
  message?: string;
}

export interface ToolsListResponse {
  tools: Array<{
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }>;
}

export interface ResourcesListResponse {
  resources: Array<{
    uriTemplate: string;
    mimeType?: string;
    description?: string;
  }>;
}

export interface PromptsListResponse {
  prompts: Array<{
    name: string;
    description?: string;
    arguments?: PromptArgument[];
  }>;
}

// ============================================================================
// Handler Types
// ============================================================================

export interface HandlerContext {
  BACKEND_SERVERS: BackendServer[];
  dynamicServers: Map<string, BackendServer>;
}
