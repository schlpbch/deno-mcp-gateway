# Server Registry

The Server Registry feature enables dynamic runtime registration and management of backend MCP servers without requiring application restart.

## Features

- **Dynamic Registration**: Register/unregister servers at runtime
- **Health Management**: Track and update server health status
- **Smart Resolution**: Automatically resolve which server handles a specific tool, resource, or prompt
- **Server Indexing**: Fast lookups for tools, resources, and prompts
- **Capacity to manage multiple services**: Support for multiple backend servers with independent capabilities

## API Usage

### Basic Registration

```typescript
import { ServerRegistry } from './src/registry/mod.ts';

const registry = new ServerRegistry();

// Register a server
registry.register({
  id: 'journey-service',
  name: 'Journey Service',
  endpoint: 'http://localhost:8080/mcp',
  transport: 'HTTP',
  capabilities: {
    tools: ['findTrips', 'compareRoutes'],
    resources: ['resource://journey/'],
    prompts: [],
  },
  requiresSession: true,
});
```

### Getting Servers

```typescript
// List all servers
const allServers = registry.listServers();

// Get a specific server
const server = registry.getServer('journey-service');

// Get only healthy servers
const healthy = registry.getHealthyServers();
```

### Health Management

```typescript
// Update server health
registry.updateHealth('journey-service', {
  status: 'HEALTHY',
  message: 'Server is responding normally',
});

// Get all statuses
const statuses = registry.getStatuses();
```

### Smart Resolution

```typescript
// Resolve which server handles a tool
const toolServer = registry.resolveToolServer('journey-service.findTrips');

// Resolve which server handles a resource
const resourceServer = registry.resolveResourceServer('resource://journey/');

// Resolve which server handles a prompt
const promptServer = registry.resolvePromptServer('journey-service.plan-trip');
```

### Unregistration

```typescript
// Unregister a server
registry.unregister('journey-service');

// Reset a server's health
registry.resetHealth('journey-service');

// Reset all servers
registry.resetAll();
```

## Singleton Pattern

For application-wide usage, use the singleton getter:

```typescript
import { getRegistry, resetRegistry } from './src/registry/mod.ts';

const registry = getRegistry(); // Gets or creates the singleton
registry.register(server);

// Later, reset if needed
resetRegistry();
```

## Health Status Values

- `HEALTHY`: Server is fully operational
- `DEGRADED`: Server is responding but with reduced capacity
- `DOWN`: Server is not responding
- `UNKNOWN`: Server status has not been checked yet

## Types

```typescript
interface ServerRegistration {
  id: string;                              // Unique identifier
  name: string;                            // Display name
  endpoint: string;                        // URL to the MCP server
  transport: 'HTTP' | 'STDIO';            // Communication transport
  capabilities: ServerCapabilities;        // Available tools, resources, prompts
  health?: ServerHealth;                   // Current health status
  requiresSession?: boolean;               // Whether MCP-Session-Id is required
}

interface ServerCapabilities {
  tools: string[];                         // Available tool names
  resources: string[];                     // Available resource URIs
  prompts: string[];                       // Available prompt names
}

interface ServerHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  lastCheck?: number;                      // Unix timestamp of last health check
  message?: string;                        // Optional status message
}
```

## Testing

Run the registry tests:

```bash
deno test src/registry/ServerRegistry.test.ts --allow-net --allow-env --allow-read --allow-import
```

All 11 tests should pass, covering registration, resolution, health management, and cleanup.
