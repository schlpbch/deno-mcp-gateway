/**
 * Shared type definitions for MCP Gateway
 * Used across backend and frontend packages
 * 
 * This package provides unified types for:
 * - Server capabilities and health monitoring
 * - MCP protocol operations (tools, resources, prompts)
 * - Configuration and routing
 * - Health status and metrics
 */

// ============================================================================
// Enums & Constants
// ============================================================================

/**
 * Health status enum for servers and system health
 * HEALTHY: Server responding normally
 * DEGRADED: Server responding but with issues
 * DOWN: Server unreachable
 * UNKNOWN: Health status not yet determined
 */
export enum HealthStatusEnum {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  DOWN = 'DOWN',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Transport mechanism for MCP communication
 */
export enum TransportType {
  HTTP = 'http',
  STDIO = 'stdio',
}

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
  transport?: TransportType;
  capabilities: ServerCapabilities;
  priority?: number;
}

/**
 * Enhanced server health information
 * Includes latency and failure tracking for intelligent routing
 */
export interface ServerHealth {
  status: HealthStatusEnum | 'healthy' | 'degraded' | 'unhealthy';
  lastChecked?: Date;
  latency?: number; // milliseconds
  errorCount?: number;
  lastError?: string;
  consecutiveFailures?: number;
}

/**
 * Extended server health for UI/frontend
 * Includes human-readable timestamps and error details
 */
export interface ServerHealthUI extends ServerHealth {
  lastCheck?: Date;
  status: HealthStatusEnum | 'healthy' | 'degraded' | 'unhealthy';
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

export interface HealthStatusResponse {
  status: HealthStatusEnum | 'healthy' | 'degraded' | 'unhealthy';
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

// ============================================================================
// Configuration Types
// ============================================================================

export interface CacheConfig {
  defaultTtl: number; // seconds
  maxSize: number;
}

export interface RetryConfig {
  maxAttempts: number;
  backoffDelay: number; // milliseconds
  backoffMultiplier: number;
  maxDelay: number; // milliseconds
}

export interface TimeoutConfig {
  connect: number; // milliseconds
  read: number; // milliseconds
}

export interface RoutingConfig {
  retry?: RetryConfig;
  timeout?: TimeoutConfig;
}

export interface HealthConfig {
  checkInterval: number; // milliseconds
  unhealthyThreshold: number;
}

export interface GatewayConfig {
  cache?: CacheConfig;
  routing?: RoutingConfig;
  health?: HealthConfig;
  servers?: ServerRegistration[];
}

export interface ServerConfig extends ServerRegistration {
  registeredAt?: Date;
}

// ============================================================================
// MCP List Operations
// ============================================================================

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  _server?: { id: string; name: string }; // Server metadata
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface McpListToolsResponse {
  tools: McpTool[];
}

export interface McpListResourcesResponse {
  resources: McpResource[];
}

export interface McpListPromptsResponse {
  prompts: McpPrompt[];
}

// ============================================================================
// MCP Call Operations
// ============================================================================

export interface McpContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface McpToolCallRequest {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpToolCallResponse {
  content: McpContent[];
  isError?: boolean;
}

export interface McpResourceReadRequest {
  uri: string;
}

export interface McpResourceReadResponse {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
  }>;
}

export interface McpPromptGetRequest {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpPromptMessage {
  role: 'user' | 'assistant';
  content: McpContent;
}

export interface McpPromptGetResponse {
  description?: string;
  messages: McpPromptMessage[];
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Options for list operations
 */
export interface ListOptions {
  bypassCache?: boolean;
  skipHealthCheck?: boolean;
}

/**
 * Generic request context for handlers
 */
export interface RequestContext {
  method: string;
  path: string;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  servers: Record<string, ServerHealth>;
  timestamp: Date;
}
