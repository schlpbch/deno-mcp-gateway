import type { Context } from '@netlify/edge-functions';
import { Hono } from 'hono';
import { initializeGateway } from '../../src/init.ts';

const app = new Hono<{ Bindings: Context }>();

// Middleware to attach gateway to context
app.use('*', async (c, next) => {
  const gateway = await initializeGateway(c.env);
  c.set('gateway', gateway);
  await next();
});

// GET /mcp/tools/list
app.get('/mcp/tools/list', async (c) => {
  const gateway = c.get('gateway') as any;
  const result = await gateway.protocolHandler.listTools();
  return c.json(result);
});

// POST /mcp/tools/call
app.post('/mcp/tools/call', async (c) => {
  const gateway = c.get('gateway') as any;
  const body = await c.req.json();
  const result = await gateway.protocolHandler.callTool(body);
  return c.json(result);
});

// GET /mcp/resources/list
app.get('/mcp/resources/list', async (c) => {
  const gateway = c.get('gateway') as any;
  const result = await gateway.protocolHandler.listResources();
  return c.json(result);
});

// POST /mcp/resources/read
app.post('/mcp/resources/read', async (c) => {
  const gateway = c.get('gateway') as any;
  const body = await c.req.json();
  const result = await gateway.protocolHandler.readResource(body);
  return c.json(result);
});

// GET /mcp/prompts/list
app.get('/mcp/prompts/list', async (c) => {
  const gateway = c.get('gateway') as any;
  const result = await gateway.protocolHandler.listPrompts();
  return c.json(result);
});

// POST /mcp/prompts/get
app.post('/mcp/prompts/get', async (c) => {
  const gateway = c.get('gateway') as any;
  const body = await c.req.json();
  const result = await gateway.protocolHandler.getPrompt(body);
  return c.json(result);
});

// GET /mcp/health or /health
const healthHandler = async (c: any) => {
  const gateway = c.get('gateway') as any;
  const servers = gateway.registry.listServers();

  const healthChecks = await Promise.allSettled(
    servers.map(async (server: any) => {
      const health = await gateway.client.checkHealth(server);
      return { server, health };
    })
  );

  const serverStatuses = healthChecks.map((result: any, index: number) => {
    if (result.status === 'fulfilled') {
      const { server, health } = result.value;
      return {
        id: server.id,
        name: server.name,
        endpoint: server.endpoint,
        status: health.status,
        latency: health.latency,
        lastCheck: health.lastCheck,
        errorMessage: health.errorMessage,
      };
    } else {
      const server = servers[index];
      return {
        id: server.id,
        name: server.name,
        endpoint: server.endpoint,
        status: 'DOWN',
        latency: 0,
        errorMessage: result.reason?.message || 'Health check failed',
      };
    }
  });

  const allHealthy = serverStatuses.every((s: any) => s.status === 'HEALTHY');
  const anyHealthy = serverStatuses.some((s: any) => s.status === 'HEALTHY');

  return c.json({
    status: allHealthy ? 'UP' : anyHealthy ? 'DEGRADED' : 'DOWN',
    timestamp: new Date().toISOString(),
    servers: serverStatuses,
  });
};

app.get('/mcp/health', healthHandler);
app.get('/health', healthHandler);

// 404 handler
app.notFound((c) => c.text('Not Found', 404));

// Error handler
app.onError((err, c) => {
  console.error('Edge function error:', err);
  return c.json(
    {
      error: err instanceof Error ? err.message : 'Internal server error',
    },
    500
  );
});

export default async (request: Request, context: Context) =>
  app.handle(request, context);

export const config = { path: '/mcp/*' };
