#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Local development server for MCP Gateway
 * Mimics Netlify Edge Functions locally using native Deno HTTP server
 */

import { initGateway } from './src/init.ts';

const PORT = parseInt(Deno.env.get('PORT') || '8888');

// Initialize gateway
const gateway = await initGateway();

// Import the edge function handler
const mcpHandler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);

  // Health check endpoint
  if (url.pathname === '/health') {
    return new Response(
      JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        gateway: 'mcp-gateway',
        version: '0.2.0',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  // Static files from public/
  if (url.pathname === '/' || url.pathname.startsWith('/public/')) {
    try {
      const filePath = url.pathname === '/'
        ? './public/index.html'
        : '.' + url.pathname;

      const file = await Deno.readFile(filePath);
      const contentType = filePath.endsWith('.html')
        ? 'text/html'
        : filePath.endsWith('.css')
        ? 'text/css'
        : filePath.endsWith('.js')
        ? 'application/javascript'
        : 'application/octet-stream';

      return new Response(file, {
        status: 200,
        headers: { 'Content-Type': contentType },
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  }

  // MCP endpoints
  if (url.pathname.startsWith('/mcp/')) {
    // Load and execute the edge function
    const { default: handler } = await import('./netlify/edge-functions/mcp.ts');
    return handler(request, { gateway });
  }

  return new Response('Not Found', { status: 404 });
};

// Start HTTP server
console.log(`🦕 Deno MCP Gateway`);
console.log(`📡 Server starting on http://localhost:${PORT}`);
console.log(`🌐 MCP endpoints: http://localhost:${PORT}/mcp/*`);
console.log(`❤️  Health check: http://localhost:${PORT}/health`);
console.log(`📄 Web UI: http://localhost:${PORT}/\n`);

Deno.serve({ port: PORT }, mcpHandler);
