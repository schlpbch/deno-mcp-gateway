/**
 * Shared type definitions for MCP Gateway
 * Used across backend and frontend packages
 */

// ============================================================================
// Server Capabilities
// ============================================================================

export interface ServerCapabilities {
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
// Server Registration & Health
// ============================================================================

export interface ServerRegistration {
  id: string;
  name: string;
  endpoint: string;
  capabilities: ServerCapabilities;
}

export interface ServerHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastChecked: Date;
  errorCount: number;
  lastError?: string;
}

// ============================================================================
// Backend Server Configuration
// ============================================================================

export interface BackendServer {
  id: string;
  name: string;
  endpoint: string;
  capabilities?: ServerCapabilities;
}

// ============================================================================
// MCP Protocol Types
// ============================================================================

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

// ============================================================================
// Tool Operations
// ============================================================================

export interface ToolCall {
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolName: string;
  result: unknown;
  error?: string;
}

// ============================================================================
// Resource Operations
// ============================================================================

export interface ResourceRequest {
  uri: string;
}

export interface ResourceResponse {
  uri: string;
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: Uint8Array;
  }>;
}

// ============================================================================
// Prompt Operations
// ============================================================================

export interface PromptRequest {
  name: string;
  arguments?: Record<string, string>;
}

export interface PromptResponse {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

// ============================================================================
// Health & Status
// ============================================================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  servers: Record<string, ServerHealth>;
  timestamp: Date;
}

export interface MetricsData {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  uptime: string;
  errorRate?: string;
  servers: Record<
    string,
    {
      requests: number;
      successRate: number;
      averageResponseTime: number;
    }
  >;
}
