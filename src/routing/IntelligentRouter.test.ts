import {
  assertEquals,
  assertRejects,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { HealthStatus, TransportType } from '../types/server.ts';
import type { ServerRegistration } from '../types/server.ts';
import type { McpToolCallResponse, McpResourceReadResponse, McpPromptGetResponse } from '../types/mcp.ts';

// Mock implementations for testing
function createMockServer(
  id: string,
  healthStatus: HealthStatus = HealthStatus.HEALTHY
): ServerRegistration {
  return {
    id,
    name: `Test Server ${id}`,
    endpoint: `https://${id}.example.com/mcp`,
    transport: TransportType.HTTP,
    capabilities: {
      tools: ['tool1', 'tool2'],
      resources: [],
      prompts: [],
    },
    health: {
      status: healthStatus,
      lastCheck: new Date(),
      latency: 100,
      consecutiveFailures: 0,
    },
    priority: 1,
    registeredAt: new Date(),
  };
}

class MockServerRegistry {
  private servers: Map<string, ServerRegistration> = new Map();

  register(server: ServerRegistration): void {
    this.servers.set(server.id, server);
  }

  resolveToolServer(toolName: string): ServerRegistration {
    const prefix = toolName.split('.')[0];
    const serverId = prefix === 'journey' ? 'journey-service-mcp' : `${prefix}-mcp`;
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server not found for tool: ${toolName}`);
    }
    return server;
  }

  resolveResourceServer(uri: string): ServerRegistration {
    const prefix = uri.split('://')[0];
    const serverId = prefix === 'journey' ? 'journey-service-mcp' : `${prefix}-mcp`;
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server not found for resource: ${uri}`);
    }
    return server;
  }

  resolvePromptServer(promptName: string): ServerRegistration {
    const prefix = promptName.split('.')[0];
    const serverId = prefix === 'journey' ? 'journey-service-mcp' : `${prefix}-mcp`;
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server not found for prompt: ${promptName}`);
    }
    return server;
  }

  clear(): void {
    this.servers.clear();
  }
}

class MockBackendMcpClient {
  public callToolCalls: Array<{ server: ServerRegistration; toolName: string; args?: Record<string, unknown> }> = [];
  public readResourceCalls: Array<{ server: ServerRegistration; uri: string }> = [];
  public getPromptCalls: Array<{ server: ServerRegistration; promptName: string; args?: Record<string, unknown> }> = [];

  async callTool(
    server: ServerRegistration,
    toolName: string,
    args?: Record<string, unknown>
  ): Promise<McpToolCallResponse> {
    this.callToolCalls.push({ server, toolName, args });
    return {
      content: [{ type: 'text', text: `Result from ${toolName}` }],
    };
  }

  async readResource(server: ServerRegistration, uri: string): Promise<McpResourceReadResponse> {
    this.readResourceCalls.push({ server, uri });
    return {
      contents: [{ uri, text: `Content from ${uri}` }],
    };
  }

  async getPrompt(
    server: ServerRegistration,
    promptName: string,
    args?: Record<string, unknown>
  ): Promise<McpPromptGetResponse> {
    this.getPromptCalls.push({ server, promptName, args });
    return {
      messages: [{ role: 'user', content: { type: 'text', text: `Prompt ${promptName}` } }],
    };
  }
}

class MockResponseCache {
  private cache: Map<string, unknown> = new Map();
  public getCalls: string[] = [];
  public setCalls: Array<{ key: string; value: unknown; ttl?: number }> = [];

  generateKey(toolName: string, args?: unknown): string {
    return `${toolName}:${JSON.stringify(args)}`;
  }

  async get<T>(key: string): Promise<T | undefined> {
    this.getCalls.push(key);
    return this.cache.get(key) as T | undefined;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.setCalls.push({ key, value, ttl });
    this.cache.set(key, value);
  }

  setMockValue(key: string, value: unknown): void {
    this.cache.set(key, value);
  }
}

// Simplified IntelligentRouter for testing
class TestableIntelligentRouter {
  constructor(
    private registry: MockServerRegistry,
    private client: MockBackendMcpClient,
    private cache: MockResponseCache
  ) {}

  async routeToolCall(
    toolName: string,
    args?: Record<string, unknown>
  ): Promise<McpToolCallResponse> {
    // Check cache
    const cacheKey = this.cache.generateKey(toolName, args);
    const cached = await this.cache.get<McpToolCallResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    // Resolve server
    const server = this.registry.resolveToolServer(toolName);

    // Check health
    if (server.health.status !== HealthStatus.HEALTHY) {
      throw new Error(`Server ${server.id} is unhealthy (status: ${server.health.status})`);
    }

    // Call backend
    const bareToolName = toolName.includes('.') ? toolName.split('.').slice(1).join('.') : toolName;
    const result = await this.client.callTool(server, bareToolName, args);

    // Cache result
    const ttl = this.determineTTL(toolName);
    await this.cache.set(cacheKey, result, ttl);

    return result;
  }

  async routeResourceRead(uri: string): Promise<McpResourceReadResponse> {
    const server = this.registry.resolveResourceServer(uri);

    if (server.health.status !== HealthStatus.HEALTHY) {
      throw new Error(`Server ${server.id} is unhealthy`);
    }

    return await this.client.readResource(server, uri);
  }

  async routePromptGet(
    promptName: string,
    args?: Record<string, unknown>
  ): Promise<McpPromptGetResponse> {
    const server = this.registry.resolvePromptServer(promptName);

    if (server.health.status !== HealthStatus.HEALTHY) {
      throw new Error(`Server ${server.id} is unhealthy`);
    }

    const barePromptName = promptName.includes('.') ? promptName.split('.').slice(1).join('.') : promptName;
    return await this.client.getPrompt(server, barePromptName, args);
  }

  private determineTTL(toolName: string): number {
    if (toolName.includes('location') || toolName.includes('station')) {
      return 3600;
    }
    if (
      toolName.includes('trip') ||
      toolName.includes('journey') ||
      toolName.includes('weather') ||
      toolName.includes('conditions')
    ) {
      return 60;
    }
    return 300;
  }
}

Deno.test('IntelligentRouter - routeToolCall calls backend and caches result', async () => {
  const registry = new MockServerRegistry();
  const client = new MockBackendMcpClient();
  const cache = new MockResponseCache();
  const router = new TestableIntelligentRouter(registry, client, cache);

  registry.register(createMockServer('journey-service-mcp'));

  const result = await router.routeToolCall('journey.findTrips', { from: 'Zurich', to: 'Geneva' });

  assertEquals(result.content[0].text, 'Result from findTrips');
  assertEquals(client.callToolCalls.length, 1);
  assertEquals(client.callToolCalls[0].toolName, 'findTrips');
  assertEquals(cache.setCalls.length, 1);
});

Deno.test('IntelligentRouter - routeToolCall returns cached result', async () => {
  const registry = new MockServerRegistry();
  const client = new MockBackendMcpClient();
  const cache = new MockResponseCache();
  const router = new TestableIntelligentRouter(registry, client, cache);

  registry.register(createMockServer('journey-service-mcp'));

  const cachedResponse: McpToolCallResponse = {
    content: [{ type: 'text', text: 'Cached result' }],
  };
  cache.setMockValue('journey.findTrips:{"from":"Zurich","to":"Geneva"}', cachedResponse);

  const result = await router.routeToolCall('journey.findTrips', { from: 'Zurich', to: 'Geneva' });

  assertEquals(result.content[0].text, 'Cached result');
  assertEquals(client.callToolCalls.length, 0); // Should not call backend
});

Deno.test('IntelligentRouter - routeToolCall throws for unhealthy server', async () => {
  const registry = new MockServerRegistry();
  const client = new MockBackendMcpClient();
  const cache = new MockResponseCache();
  const router = new TestableIntelligentRouter(registry, client, cache);

  registry.register(createMockServer('journey-service-mcp', HealthStatus.DOWN));

  await assertRejects(
    () => router.routeToolCall('journey.findTrips'),
    Error,
    'unhealthy'
  );
});

Deno.test('IntelligentRouter - routeToolCall uses correct TTL for static data', async () => {
  const registry = new MockServerRegistry();
  const client = new MockBackendMcpClient();
  const cache = new MockResponseCache();
  const router = new TestableIntelligentRouter(registry, client, cache);

  registry.register(createMockServer('journey-service-mcp'));

  // Note: determineTTL checks for lowercase 'location' or 'station'
  await router.routeToolCall('journey.get_station_location', { station: 'Zurich' });

  assertEquals(cache.setCalls[0].ttl, 3600); // 1 hour for location data
});

Deno.test('IntelligentRouter - routeToolCall uses correct TTL for realtime data', async () => {
  const registry = new MockServerRegistry();
  const client = new MockBackendMcpClient();
  const cache = new MockResponseCache();
  const router = new TestableIntelligentRouter(registry, client, cache);

  registry.register(createMockServer('journey-service-mcp'));

  await router.routeToolCall('journey.findTrips', { from: 'A', to: 'B' });

  assertEquals(cache.setCalls[0].ttl, 60); // 1 minute for trip data
});

Deno.test('IntelligentRouter - routeResourceRead calls backend', async () => {
  const registry = new MockServerRegistry();
  const client = new MockBackendMcpClient();
  const cache = new MockResponseCache();
  const router = new TestableIntelligentRouter(registry, client, cache);

  registry.register(createMockServer('journey-service-mcp'));

  const result = await router.routeResourceRead('journey://routes/123');

  assertEquals(result.contents[0].uri, 'journey://routes/123');
  assertEquals(client.readResourceCalls.length, 1);
});

Deno.test('IntelligentRouter - routeResourceRead throws for unhealthy server', async () => {
  const registry = new MockServerRegistry();
  const client = new MockBackendMcpClient();
  const cache = new MockResponseCache();
  const router = new TestableIntelligentRouter(registry, client, cache);

  registry.register(createMockServer('journey-service-mcp', HealthStatus.DOWN));

  await assertRejects(
    () => router.routeResourceRead('journey://routes/123'),
    Error,
    'unhealthy'
  );
});

Deno.test('IntelligentRouter - routePromptGet calls backend with stripped namespace', async () => {
  const registry = new MockServerRegistry();
  const client = new MockBackendMcpClient();
  const cache = new MockResponseCache();
  const router = new TestableIntelligentRouter(registry, client, cache);

  registry.register(createMockServer('journey-service-mcp'));

  const result = await router.routePromptGet('journey.tripPlanner', { destination: 'Zurich' });

  assertEquals(result.messages.length, 1);
  assertEquals(client.getPromptCalls.length, 1);
  assertEquals(client.getPromptCalls[0].promptName, 'tripPlanner');
});

Deno.test('IntelligentRouter - routePromptGet throws for unhealthy server', async () => {
  const registry = new MockServerRegistry();
  const client = new MockBackendMcpClient();
  const cache = new MockResponseCache();
  const router = new TestableIntelligentRouter(registry, client, cache);

  registry.register(createMockServer('journey-service-mcp', HealthStatus.DEGRADED));

  await assertRejects(
    () => router.routePromptGet('journey.tripPlanner'),
    Error,
    'unhealthy'
  );
});
