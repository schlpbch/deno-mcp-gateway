// ============================================================================
// Health Endpoint Types
// ============================================================================

export interface HealthCheckResponse {
  status: 'UP' | 'DEGRADED' | 'DOWN';
  timestamp: string;
  servers: ServerHealthStatus[];
}

export interface ServerHealthStatus {
  id: string;
  name: string;
  endpoint: string;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  latency?: number;
  lastCheck?: string;
  errorMessage?: string;
}

// ============================================================================
// Tool Types
// ============================================================================

export interface ListToolsResponse {
  tools: Tool[];
}

export interface Tool {
  name: string;
  description?: string;
  inputSchema?: JSONSchema;
}

export interface CallToolRequest {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface CallToolResponse {
  content: Content[];
  isError?: boolean;
}

// ============================================================================
// Resource Types
// ============================================================================

export interface ListResourcesResponse {
  resources: Resource[];
}

export interface Resource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
  _server?: {
    id: string;
    name: string;
  };
}

export interface ReadResourceRequest {
  uri: string;
}

export interface ReadResourceResponse {
  contents: ResourceContent[];
}

export interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
}

// ============================================================================
// Prompt Types
// ============================================================================

export interface ListPromptsResponse {
  prompts: Prompt[];
}

export interface Prompt {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface GetPromptRequest {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface GetPromptResponse {
  description?: string;
  messages: PromptMessage[];
}

export interface PromptMessage {
  role: 'user' | 'assistant';
  content: Content;
}

// ============================================================================
// Metrics Endpoint Types
// ============================================================================

export interface MetricsResponse {
  timestamp: string;
  uptime: string;
  requests: {
    total: number;
    errors: number;
    errorRate: string;
  };
  latency: {
    avg: string;
    p50: string;
    p95: string;
    p99: string;
  };
  cache: {
    hitRate: string;
    memorySize: number;
  };
  endpoints: Record<string, EndpointMetrics>;
}

export interface EndpointMetrics {
  count: number;
  errors: number;
  avgLatency: number;
}

// ============================================================================
// Shared Types
// ============================================================================

export interface Content {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

export type JSONSchema = Record<string, unknown>;

export interface ErrorResponse {
  error: string;
}

// ============================================================================
// MCP Protocol Types
// ============================================================================

export interface McpToolCallRequest {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
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

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
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
  retry: RetryConfig;
  timeout: TimeoutConfig;
}

export interface HealthConfig {
  checkInterval: number; // milliseconds
  unhealthyThreshold: number;
}

export interface GatewayConfig {
  cache: CacheConfig;
  routing: RoutingConfig;
  health: HealthConfig;
  servers: ServerConfig[];
}

export const DEFAULT_CONFIG: Omit<GatewayConfig, 'servers'> = {
  cache: {
    defaultTtl: 300, // 5 minutes
    maxSize: 10000,
  },
  routing: {
    retry: {
      maxAttempts: 3,
      backoffDelay: 100,
      backoffMultiplier: 2.0,
      maxDelay: 2000,
    },
    timeout: {
      connect: 5000,
      read: 30000,
    },
  },
  health: {
    checkInterval: 60000, // 60 seconds
    unhealthyThreshold: 3,
  },
};

// ============================================================================
// Server Types
// ============================================================================

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  DOWN = 'DOWN',
  UNKNOWN = 'UNKNOWN',
}

export interface ServerHealth {
  status: HealthStatus;
  lastCheck: Date;
  latency: number; // milliseconds
  errorMessage?: string;
  consecutiveFailures: number;
}

export interface ResourceCapability {
  uriPrefix: string;
  description: string;
}

export interface ServerCapabilities {
  tools: string[];
  resources: ResourceCapability[];
  prompts: string[];
}

export enum TransportType {
  HTTP = 'http',
  STDIO = 'stdio',
}

export interface ServerRegistration {
  id: string;
  name: string;
  endpoint: string;
  transport: TransportType;
  capabilities: ServerCapabilities;
  health: ServerHealth;
  priority: number;
  registeredAt: Date;
}

export interface ServerConfig {
  id: string;
  name: string;
  endpoint: string;
  transport: TransportType;
  priority: number;
}

export interface BackendServer {
  id: string;
  name: string;
  endpoint: string;
  capabilities: ServerCapabilities;
}

// ============================================================================
// JSON-RPC Types
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
