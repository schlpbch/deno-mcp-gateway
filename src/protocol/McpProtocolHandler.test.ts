import {
  assertEquals,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { HealthStatus, TransportType } from '../types/server.ts';
import type { ServerRegistration } from '../types/server.ts';
import type {
  McpToolCallResponse,
  McpResourceReadResponse,
  McpPromptGetResponse,
  McpListToolsResponse,
  McpListResourcesResponse,
  McpListPromptsResponse,
} from '../types/mcp.ts';

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

  listHealthyServers(): ServerRegistration[] {
    return Array.from(this.servers.values()).filter(
      (s) => s.health.status === HealthStatus.HEALTHY
    );
  }

  clear(): void {
    this.servers.clear();
  }
}

class MockIntelligentRouter {
  public routeToolCallCalls: Array<{ toolName: string; args?: Record<string, unknown> }> = [];
  public routeResourceReadCalls: string[] = [];
  public routePromptGetCalls: Array<{ promptName: string; args?: Record<string, unknown> }> = [];

  async routeToolCall(
    toolName: string,
    args?: Record<string, unknown>
  ): Promise<McpToolCallResponse> {
    this.routeToolCallCalls.push({ toolName, args });
    return { content: [{ type: 'text', text: `Result from ${toolName}` }] };
  }

  async routeResourceRead(uri: string): Promise<McpResourceReadResponse> {
    this.routeResourceReadCalls.push(uri);
    return { contents: [{ uri, text: 'Resource content' }] };
  }

  async routePromptGet(
    promptName: string,
    args?: Record<string, unknown>
  ): Promise<McpPromptGetResponse> {
    this.routePromptGetCalls.push({ promptName, args });
    return { messages: [{ role: 'user', content: { type: 'text', text: 'Prompt message' } }] };
  }
}

class MockBackendMcpClient {
  public listToolsResults: Map<string, McpListToolsResponse> = new Map();
  public listResourcesResults: Map<string, McpListResourcesResponse> = new Map();
  public listPromptsResults: Map<string, McpListPromptsResponse> = new Map();
  public shouldFail: Set<string> = new Set();

  async listTools(server: ServerRegistration): Promise<McpListToolsResponse> {
    if (this.shouldFail.has(server.id)) {
      throw new Error(`Failed to list tools from ${server.id}`);
    }
    return this.listToolsResults.get(server.id) || { tools: [] };
  }

  async listResources(server: ServerRegistration): Promise<McpListResourcesResponse> {
    if (this.shouldFail.has(server.id)) {
      throw new Error(`Failed to list resources from ${server.id}`);
    }
    return this.listResourcesResults.get(server.id) || { resources: [] };
  }

  async listPrompts(server: ServerRegistration): Promise<McpListPromptsResponse> {
    if (this.shouldFail.has(server.id)) {
      throw new Error(`Failed to list prompts from ${server.id}`);
    }
    return this.listPromptsResults.get(server.id) || { prompts: [] };
  }
}

// Testable McpProtocolHandler
class TestableMcpProtocolHandler {
  constructor(
    private registry: MockServerRegistry,
    private router: MockIntelligentRouter,
    private client: MockBackendMcpClient
  ) {}

  async listTools(): Promise<McpListToolsResponse> {
    const servers = this.registry.listHealthyServers();
    const allTools = [];

    for (const server of servers) {
      try {
        const response = await this.client.listTools(server);
        const namespacedTools = response.tools.map((tool) => ({
          ...tool,
          name: this.addNamespace(server.id, tool.name),
          description: tool.description || `${tool.name} from ${server.name}`,
        }));
        allTools.push(...namespacedTools);
      } catch (error) {
        console.error(`Failed to list tools from ${server.id}:`, error);
      }
    }

    return { tools: allTools };
  }

  async callTool(request: { name: string; arguments?: Record<string, unknown> }): Promise<McpToolCallResponse> {
    return await this.router.routeToolCall(request.name, request.arguments);
  }

  async listResources(): Promise<McpListResourcesResponse> {
    const servers = this.registry.listHealthyServers();
    const allResources = [];

    for (const server of servers) {
      try {
        const response = await this.client.listResources(server);
        allResources.push(...response.resources);
      } catch (error) {
        console.error(`Failed to list resources from ${server.id}:`, error);
      }
    }

    return { resources: allResources };
  }

  async readResource(request: { uri: string }): Promise<McpResourceReadResponse> {
    return await this.router.routeResourceRead(request.uri);
  }

  async listPrompts(): Promise<McpListPromptsResponse> {
    const servers = this.registry.listHealthyServers();
    const allPrompts = [];

    for (const server of servers) {
      try {
        const response = await this.client.listPrompts(server);
        const namespacedPrompts = response.prompts.map((prompt) => ({
          ...prompt,
          name: this.addNamespace(server.id, prompt.name),
          description: prompt.description || `${prompt.name} from ${server.name}`,
        }));
        allPrompts.push(...namespacedPrompts);
      } catch (error) {
        console.error(`Failed to list prompts from ${server.id}:`, error);
      }
    }

    return { prompts: allPrompts };
  }

  async getPrompt(request: { name: string; arguments?: Record<string, unknown> }): Promise<McpPromptGetResponse> {
    return await this.router.routePromptGet(request.name, request.arguments);
  }

  private addNamespace(serverId: string, name: string): string {
    const namespaceMap: Record<string, string> = {
      'journey-service-mcp': 'journey',
      'swiss-mobility-mcp': 'mobility',
      'aareguru-mcp': 'aareguru',
      'open-meteo-mcp': 'meteo',
    };
    const prefix = namespaceMap[serverId] || serverId.replace('-mcp', '');
    return `${prefix}.${name}`;
  }
}

Deno.test('McpProtocolHandler - listTools aggregates tools from all healthy servers', async () => {
  const registry = new MockServerRegistry();
  const router = new MockIntelligentRouter();
  const client = new MockBackendMcpClient();
  const handler = new TestableMcpProtocolHandler(registry, router, client);

  registry.register(createMockServer('journey-service-mcp'));
  registry.register(createMockServer('swiss-mobility-mcp'));

  client.listToolsResults.set('journey-service-mcp', {
    tools: [{ name: 'findTrips', description: 'Find trips' }],
  });
  client.listToolsResults.set('swiss-mobility-mcp', {
    tools: [{ name: 'getStations', description: 'Get stations' }],
  });

  const result = await handler.listTools();

  assertEquals(result.tools.length, 2);
  assertEquals(result.tools[0].name, 'journey.findTrips');
  assertEquals(result.tools[1].name, 'mobility.getStations');
});

Deno.test('McpProtocolHandler - listTools skips unhealthy servers', async () => {
  const registry = new MockServerRegistry();
  const router = new MockIntelligentRouter();
  const client = new MockBackendMcpClient();
  const handler = new TestableMcpProtocolHandler(registry, router, client);

  registry.register(createMockServer('journey-service-mcp', HealthStatus.HEALTHY));
  registry.register(createMockServer('swiss-mobility-mcp', HealthStatus.DOWN));

  client.listToolsResults.set('journey-service-mcp', {
    tools: [{ name: 'findTrips' }],
  });
  client.listToolsResults.set('swiss-mobility-mcp', {
    tools: [{ name: 'getStations' }],
  });

  const result = await handler.listTools();

  assertEquals(result.tools.length, 1);
  assertEquals(result.tools[0].name, 'journey.findTrips');
});

Deno.test('McpProtocolHandler - listTools handles server errors gracefully', async () => {
  const registry = new MockServerRegistry();
  const router = new MockIntelligentRouter();
  const client = new MockBackendMcpClient();
  const handler = new TestableMcpProtocolHandler(registry, router, client);

  registry.register(createMockServer('journey-service-mcp'));
  registry.register(createMockServer('swiss-mobility-mcp'));

  client.listToolsResults.set('journey-service-mcp', {
    tools: [{ name: 'findTrips' }],
  });
  client.shouldFail.add('swiss-mobility-mcp');

  const result = await handler.listTools();

  assertEquals(result.tools.length, 1);
  assertEquals(result.tools[0].name, 'journey.findTrips');
});

Deno.test('McpProtocolHandler - listTools adds default description when missing', async () => {
  const registry = new MockServerRegistry();
  const router = new MockIntelligentRouter();
  const client = new MockBackendMcpClient();
  const handler = new TestableMcpProtocolHandler(registry, router, client);

  registry.register(createMockServer('journey-service-mcp'));

  client.listToolsResults.set('journey-service-mcp', {
    tools: [{ name: 'findTrips' }], // No description
  });

  const result = await handler.listTools();

  assertEquals(result.tools[0].description, 'findTrips from Test Server journey-service-mcp');
});

Deno.test('McpProtocolHandler - callTool delegates to router', async () => {
  const registry = new MockServerRegistry();
  const router = new MockIntelligentRouter();
  const client = new MockBackendMcpClient();
  const handler = new TestableMcpProtocolHandler(registry, router, client);

  const result = await handler.callTool({
    name: 'journey.findTrips',
    arguments: { from: 'A', to: 'B' },
  });

  assertEquals(router.routeToolCallCalls.length, 1);
  assertEquals(router.routeToolCallCalls[0].toolName, 'journey.findTrips');
  assertEquals(router.routeToolCallCalls[0].args, { from: 'A', to: 'B' });
});

Deno.test('McpProtocolHandler - listResources aggregates resources from all servers', async () => {
  const registry = new MockServerRegistry();
  const router = new MockIntelligentRouter();
  const client = new MockBackendMcpClient();
  const handler = new TestableMcpProtocolHandler(registry, router, client);

  registry.register(createMockServer('journey-service-mcp'));
  registry.register(createMockServer('swiss-mobility-mcp'));

  client.listResourcesResults.set('journey-service-mcp', {
    resources: [{ uri: 'journey://routes', name: 'Routes' }],
  });
  client.listResourcesResults.set('swiss-mobility-mcp', {
    resources: [{ uri: 'mobility://stations', name: 'Stations' }],
  });

  const result = await handler.listResources();

  assertEquals(result.resources.length, 2);
});

Deno.test('McpProtocolHandler - readResource delegates to router', async () => {
  const registry = new MockServerRegistry();
  const router = new MockIntelligentRouter();
  const client = new MockBackendMcpClient();
  const handler = new TestableMcpProtocolHandler(registry, router, client);

  const result = await handler.readResource({ uri: 'journey://routes/123' });

  assertEquals(router.routeResourceReadCalls.length, 1);
  assertEquals(router.routeResourceReadCalls[0], 'journey://routes/123');
});

Deno.test('McpProtocolHandler - listPrompts aggregates prompts from all servers', async () => {
  const registry = new MockServerRegistry();
  const router = new MockIntelligentRouter();
  const client = new MockBackendMcpClient();
  const handler = new TestableMcpProtocolHandler(registry, router, client);

  registry.register(createMockServer('journey-service-mcp'));
  registry.register(createMockServer('aareguru-mcp'));

  client.listPromptsResults.set('journey-service-mcp', {
    prompts: [{ name: 'tripPlanner', description: 'Plan a trip' }],
  });
  client.listPromptsResults.set('aareguru-mcp', {
    prompts: [{ name: 'riverReport', description: 'Get river report' }],
  });

  const result = await handler.listPrompts();

  assertEquals(result.prompts.length, 2);
  assertEquals(result.prompts[0].name, 'journey.tripPlanner');
  assertEquals(result.prompts[1].name, 'aareguru.riverReport');
});

Deno.test('McpProtocolHandler - getPrompt delegates to router', async () => {
  const registry = new MockServerRegistry();
  const router = new MockIntelligentRouter();
  const client = new MockBackendMcpClient();
  const handler = new TestableMcpProtocolHandler(registry, router, client);

  const result = await handler.getPrompt({
    name: 'journey.tripPlanner',
    arguments: { destination: 'Zurich' },
  });

  assertEquals(router.routePromptGetCalls.length, 1);
  assertEquals(router.routePromptGetCalls[0].promptName, 'journey.tripPlanner');
  assertEquals(router.routePromptGetCalls[0].args, { destination: 'Zurich' });
});

Deno.test('McpProtocolHandler - handles empty server list', async () => {
  const registry = new MockServerRegistry();
  const router = new MockIntelligentRouter();
  const client = new MockBackendMcpClient();
  const handler = new TestableMcpProtocolHandler(registry, router, client);

  const toolsResult = await handler.listTools();
  const resourcesResult = await handler.listResources();
  const promptsResult = await handler.listPrompts();

  assertEquals(toolsResult.tools.length, 0);
  assertEquals(resourcesResult.resources.length, 0);
  assertEquals(promptsResult.prompts.length, 0);
});
