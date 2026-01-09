#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Local development server for MCP Gateway
 * Simple wrapper around main.ts for local development
 */

// Import and run the main handler
import { handler } from './main.ts';

const PORT = parseInt(Deno.env.get('PORT') || '8000');

console.log(`🦕 Deno MCP Gateway - Development Mode`);
console.log(`📡 Server starting on http://localhost:${PORT}`);
console.log(`🌐 MCP endpoints: http://localhost:${PORT}/mcp/*`);
console.log(`❤️  Health check: http://localhost:${PORT}/health`);
console.log(`📊 Metrics: http://localhost:${PORT}/metrics\n`);

Deno.serve({ port: PORT }, handler);
