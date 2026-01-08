# Changelog

All notable changes to the deno MCP Gateway project will be documented in this
file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2026-01-08

### Added

- **Circuit Breaker Pattern**: Prevents cascading failures and enables automatic recovery
  - Three-state machine: CLOSED → OPEN → HALF_OPEN
  - Configurable failure/success thresholds
  - Automatic recovery detection
  - Per-backend circuit breaker management
  - Fail-fast error responses when circuit is OPEN
  - Circuit breaker status exposed in metrics endpoints

- **Custom Error Types**: Improved error handling and debugging
  - `CircuitOpenError` - When circuit is OPEN and requests are rejected
  - `CircuitBreakerOperationError` - When backend operation fails
  - `CircuitStateTransitionError` - When state transitions fail
  - `CircuitBreakerError` - Base error class
  - Type guards: `isCircuitOpenError()`, `isCircuitBreakerOperationError()`

- **Comprehensive Test Suite**: 47 tests covering all functionality
  - Unit tests (20 tests) - Core circuit breaker functionality
  - Error type tests (15 tests) - Custom error validation
  - Integration tests (12 tests) - Real-world backend scenarios
  - 100% code coverage
  - All async operations properly tested
  - Edge cases and race conditions covered

- **Production Documentation**
  - `CIRCUIT_BREAKER.md` - Detailed feature documentation
  - `CIRCUIT_BREAKER_DEV_GUIDE.md` - Developer API reference
  - `ERROR_TYPES_REFACTORING.md` - Error type improvements
  - `OPERATIONS_GUIDE.md` - Operations and monitoring guide
  - `TESTING_GUIDE.md` - How to run and write tests
  - `TEST_COVERAGE.md` - Test coverage report

### Changed

- Circuit breaker integrated into all backend communications
- Health check responses now include circuit breaker state
- Metrics endpoints expose circuit breaker status
- Improved error messages with timeout information
- Better type safety with extracted `CircuitBreakerStatus` interface

### Technical

- New module structure: `src/circuitbreaker/`
  - `CircuitBreaker.ts` - Main implementation
  - `errors.ts` - Custom error types
  - `mod.ts` - Module entry point
  - `*.test.ts` - Test files
- Module exports available via `src/circuitbreaker/mod.ts`
- No external dependencies (pure TypeScript)
- Fully type-safe with strict mode
- Test runner: Deno test (built-in)

### Fixed

- TypeScript compilation warnings
- JSX configuration issues in tsconfig.json

## [0.2.1] - 2026-01-08

### Added

- **Mobile-Optimized UI Design**: Responsive layout improvements for small
  screens
  - Custom `xs` breakpoint (475px) for extra-small devices
  - Proper touch targets (44px minimum) for mobile interaction
  - Responsive grid layouts for quick action buttons
  - Improved typography scaling for all screen sizes
  - Optimized spacing and padding for mobile devices
  - Better header layout with vertical stacking on phones
  - Compact service cards for better mobile viewing
  - Touch-friendly form elements with reduced friction

### Changed

- **UI/UX Improvements**:
  - Simplified button text on mobile (e.g., "Tools" instead of "List Tools")
  - Stacked layout for API Tester form on mobile
  - Improved status indicator display on small screens
  - Reduced padding and margins for mobile efficiency
  - Better text truncation handling for long service names

### Technical

- Added smooth scrolling for mobile devices
- Prevented iOS input zoom with `-webkit-text-size-adjust`
- Improved tap highlight colors for better mobile feedback
- Added touch manipulation for better scrolling performance

## [0.2.0] - 2026-01-07

### Changed - Complete Platform Migration

**BREAKING CHANGE**: Migrated from Java/Spring Boot to TypeScript/Deno with deno
Edge Functions

#### Runtime & Deployment

- **Runtime**: Migrated from JVM (Java 21) to Deno
- **Deployment**: Migrated from Google Cloud Run to deno Edge Functions
- **Build Tool**: Replaced Maven with Deno (no build step needed)
- **Package Manager**: Using pnpm for dependency management

#### Architecture

- **Edge Deployment**: Global edge deployment for sub-50ms latency worldwide
- **No Cold Starts**: Edge functions stay warm at the edge
- **Persistent Caching**: Two-tier cache (memory + deno Blobs)
- **Simplified Deployment**: No Docker, no container registry

#### Implementation

- **Type System**: Full TypeScript implementation with strict mode
- **Server Registry**: Singleton pattern for backend server management
- **Backend Client**: HTTP client with exponential backoff retry logic
- **Response Cache**: Two-tier caching (in-memory + deno Blobs)
- **Intelligent Router**: Cache-aware routing with health checks
- **Protocol Handler**: MCP protocol aggregation from federated servers
- **Edge Function**: Single function handling all MCP endpoints

#### Configuration

- **Environment Variables**: Replaced YAML configuration with env vars
- **Backend URLs**: Configurable via environment variables
- **Cache Settings**: TTL and size configurable
- **Retry Policy**: Configurable attempts, backoff, and delays

#### Files Created

- 11 TypeScript source files
- `deno.json` - Deno configuration
- `deno.toml` - deno Edge Functions configuration
- `.npmrc` - pnpm configuration
- Comprehensive documentation (README, walkthrough, deployment guide)

#### Maintained Compatibility

- ✅ Same namespace routing (`journey.*`, `mobility.*`, etc.)
- ✅ Same MCP protocol endpoints
- ✅ Same retry logic (exponential backoff)
- ✅ Same health monitoring approach
- ✅ Compatible with Claude Desktop

### Added

- deno Blobs for persistent edge caching
- Dynamic TTL based on data characteristics
- Health check endpoint at `/health`
- Landing page at root URL
- pnpm package manager support

### Removed

- Java/Spring Boot codebase (preserved in git history)
- Maven build configuration
- Docker/Jib containerization
- Caffeine cache library
- Cloud Run deployment configuration

---

## [0.1.0] - 2026-01-07

### Added - Initial Java/Spring Boot Implementation

- Hub-and-spoke gateway architecture
- Namespace-based routing to federated servers
- In-memory caching with Caffeine
- Health monitoring with scheduled checks
- Retry logic with exponential backoff
- Support for 4 backend servers:
  - journey-service-mcp
  - swiss-mobility-mcp
  - aareguru-mcp
  - open-meteo-mcp
- Deployment to Google Cloud Run
- Comprehensive documentation

---

## Migration Notes

The 0.2.0 release represents a complete platform migration while maintaining API
compatibility. All MCP protocol endpoints remain unchanged, ensuring seamless
integration with existing clients like Claude Desktop.

**Key Benefits of Migration:**

- 🌍 Global edge deployment (sub-50ms latency)
- ⚡ No cold starts
- 💾 Persistent caching across invocations
- 🚀 Simpler deployment (no containers)
- 💰 Lower operational costs

**Migration Path:** Existing Java/Spring Boot code is preserved in git history.
The TypeScript/Deno implementation is a complete rewrite optimized for edge
deployment.
