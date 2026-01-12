# Claude Project Context - deno-mcp-gateway

## 📋 Project Overview

**deno-mcp-gateway** is a unified MCP (Model Context Protocol) gateway deployed on deno Edge Functions. It provides AI assistants with intelligent routing, caching, health monitoring, and circuit breaker functionality for accessing federated MCP servers globally.

**Repository**: https://github.com/schlpbch/deno-mcp-gateway

## 🏗️ Architecture

### Core Components

```
main.ts (180 lines) → 6 modular services:
├── src/config.ts      - Server initialization & CORS
├── src/session.ts     - Session lifecycle & metrics
├── src/jsonrpc.ts     - JSON-RPC 2.0 protocol helpers
├── src/backend.ts     - Backend communication with circuit breaker
├── src/mcprequest.ts  - MCP protocol method handlers
└── src/handlers.ts    - HTTP endpoint routing

src/types.ts (235 lines) - Centralized type definitions
```

### Key Features

- **Global Edge Deployment**: Sub-50ms latency via deno Edge
- **Intelligent Routing**: Namespace-based routing (`journey.*`, `mobility.*`, etc.)
- **Persistent Caching**: Two-tier (memory + deno Blobs)
- **Health Monitoring**: Automatic checks with failover
- **Circuit Breaker**: Prevents cascading failures
- **Retry Logic**: Exponential backoff (3 attempts, 100-2000ms delay)
- **TypeScript**: Strict mode, fully typed

### Namespace Routing

```
journey.*       → Journey Service MCP
mobility.*      → Swiss Mobility MCP
aareguru.*      → Aareguru MCP
meteo.*         → Open Meteo MCP
weather.*       → Open Meteo MCP
```

## 📊 Test Coverage

- **130 tests passing** (100% success rate)
- **Line coverage**: 50.7%
- **Test breakdown**:
  - Backend tests: Handler functions, health checks, MCP protocol
  - Configuration tests: Server initialization, environment variables
  - Integration tests: End-to-end MCP operations

## 🔧 Recent Refactoring (January 2026)

### Code Quality Improvements

1. **Monolith to Modular Architecture**
   - `main.ts`: 1314 → 180 lines
   - Created 6 focused modules for separation of concerns
   - Each module has single responsibility

2. **Centralized Type System**
   - Created `src/types.ts` (235 lines) as single source of truth
   - All modules import from centralized types
   - Eliminated type duplication

3. **Test Coverage Improvements**
   - Fixed 9 failing tests after refactoring
   - Added 15 new tests for edge cases
   - Coverage: 36.5% → 50.7%

## 🔄 Type System

### Shared Types Package

**Location**: `packages/types/src/index.ts` (150+ lines)

**Exports**:
- `ServerCapabilities`, `ToolCapability`, `ResourceCapability`, `PromptCapability`
- `ServerRegistration`, `ServerHealth`, `BackendServer`
- `MCPRequest`, `MCPResponse`, `MCPError`
- `ToolCall`, `ResourceRequest`, `ResourceResponse`
- `PromptRequest`, `PromptResponse`
- `HealthStatus`, `MetricsData`

### Backend Types

**Location**: `src/types.ts` (235 lines)

**Key Interfaces**:
```typescript
interface BackendServer {
  name: string;
  endpoint: string;
  namespace: string;
  capabilities: ServerCapabilities;
}

interface ServerHealth {
  status: HealthStatus;
  lastCheck: Date;
  latency: number;
  errorMessage?: string;
  consecutiveFailures: number;
}

interface Session {
  id: string;
  serverId: string;
  createdAt: Date;
  expiresAt: Date;
  state?: Record<string, unknown>;
}
```

## 🚀 Running the Project

### Development

```bash
# Install dependencies
deno cache --reload deno.json

# Run dev server with hot reload
deno task dev

# Run tests
deno task test

# Run tests with coverage
deno task test:coverage

# Type checking
deno task check

# Linting
deno task lint

# Formatting
deno task fmt
```

### Deployment

The project is deployed on deno Edge Functions. Configuration is managed through environment variables and server config files.

## 🗂️ Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `main.ts` | Entry point with import.meta.main guard | 180 |
| `src/types.ts` | Centralized type definitions | 235 |
| `src/config.ts` | Server initialization | ~80 |
| `src/session.ts` | Session management & metrics | ~70 |
| `src/backend.ts` | Backend communication | ~90 |
| `src/handlers.ts` | HTTP endpoint routing | ~200 |
| `src/mcprequest.ts` | MCP protocol methods | ~150 |
| `src/jsonrpc.ts` | JSON-RPC helpers | ~50 |
| `packages/types/src/index.ts` | Shared type definitions | 150+ |

## 📝 Recent Commits

- **dde76ea**: Initial refactoring with modular architecture
- **2c5f0c4**: Fix test coverage and add new tests
- **af9f22f**: Type system improvements
- **77fdaca**: Frontend type integration

## ✅ Checklist for AI Assistants

- [x] Main.ts refactored into 6 modules
- [x] Tests fixed (9 failing → all passing)
- [x] Coverage improved (36.5% → 50.7%)
- [x] Centralized type definitions
- [x] Shared types package created
- [x] Type consistency across modules
- [x] Type integration with frontend
- [ ] Performance optimizations
- [ ] Additional test coverage (up to 70%+)

## 🔗 Related Projects

- **Frontend**: [mcp-gateway-ui](https://github.com/schlpbch/mcp-gateway-ui)
  - Astro + TypeScript + Tailwind
  - Integrates shared types from `packages/types`
  - Dashboard, playground, health monitoring

## 💡 Key Insights

1. **Modular Architecture**: Breaking down the 1314-line monolith improved maintainability without changing functionality
2. **Type Safety**: Centralized types prevent inconsistencies and make refactoring safer
3. **Testing Strategy**: 130 tests provide confidence in edge case handling
4. **Shared Types**: Both backend and frontend use types from `packages/types` for consistency
5. **pnpm Workspace**: Monorepo structure enables code sharing and coordinated updates
