# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.0] - 2026-01-13

### Added
- **Comprehensive MCP request validation and sanitization** - Input validation for tool names, URIs, and protocol requests with detailed error messages
- **Structured logging infrastructure** - Complete logging system for gateway calls with request/response tracking and performance metrics
- **Enhanced shared types package** - Comprehensive type definitions for health, metrics, tools, and resources (v0.2.0)
- **Dynamic server registration endpoints** - Runtime server registration via `/servers/register` endpoint
- **Server configuration upload** - Upload and manage server configurations with dedicated endpoints and scripts
- **Health and metrics enhancements** - Improved health check types and metrics collection interfaces
- **Comprehensive documentation** - Added CLAUDE.md for AI assistant context and Deno Deploy setup guide

### Changed
- **Modularized main.ts** - Split monolithic main.ts into focused, testable components for better maintainability
- **Centralized type definitions** - Moved all type definitions to shared types package for consistency
- **Stricter TypeScript configuration** - Enhanced type safety with stricter compiler options
- **Removed hardwired server URLs** - Enhanced configuration flexibility with dynamic server management

### Fixed
- **Validation compatibility** - Updated validation to use double underscore separator for better compatibility
- **Dynamic server discovery** - Fixed tools/prompts/resources endpoints to include dynamically registered servers
- **Server metadata** - Fixed resources showing 'UNKNOWN SERVER' by adding proper _server metadata
- **Health endpoint deduplication** - Removed duplicate servers in health endpoint responses
- **Cleaner REST API URLs** - Removed /mcp prefix from REST API endpoints for cleaner URLs
- **Undefined endpoint handling** - Resolved endpoint showing as 'undefined' in health response for dynamic servers

### Refactored
- Split main.ts into modular components with improved separation of concerns
- Improved test coverage with comprehensive unit tests for all major components
- Centralized type definitions in @mcp-gateway/types package

### Documentation
- Added comprehensive CLAUDE.md for AI assistant integration context
- Added Deno Deploy setup guide for complete MCP infrastructure
- Added quick start guide for server config upload feature
- Added implementation summaries documenting complete feature sets
- Added comprehensive documentation and integration test scripts

## [0.9.1] - 2025-12-XX

### Added
- Comprehensive unit test suite
- OpenMeteo server to backend configuration

### Fixed
- Export handler and simplify dev.ts

## [0.9.0] - 2025-12-XX

### Added
- Circuit Breaker Pattern for fault tolerance
- Strict CORS, rate limiting, and auth check for security hardening

### Changed
- Removed UI and Astro code (moved to mcp-gateway-ui repository)

## [0.1.0] - 2025-11-XX

### Added
- Initial release
- Federated MCP Gateway with Java records (Lombok-free)
- Server registry and namespace routing
- Backend HTTP client with retry logic
- Two-tier caching (memory + Deno Blobs)
- Health monitoring and circuit breaker
- Interactive web console

[0.10.0]: https://github.com/schlpbch/deno-mcp-gateway/compare/v0.9.1...v0.10.0
[0.9.1]: https://github.com/schlpbch/deno-mcp-gateway/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/schlpbch/deno-mcp-gateway/compare/v0.1.0...v0.9.0
[0.1.0]: https://github.com/schlpbch/deno-mcp-gateway/releases/tag/v0.1.0
