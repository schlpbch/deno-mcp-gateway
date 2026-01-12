# MCP Gateway Test Suite

This document outlines the comprehensive testing strategy for the MCP Gateway project, which includes both backend (Deno) and frontend (Astro) components with end-to-end integration tests.

## Test Structure

```
deno-mcp-gateway/
├── run-all-tests.ps1           # PowerShell test runner
├── run-tests.sh               # Cross-platform bash test runner
├── main_test.ts              # Backend unit tests
└── src/
    └── **/*_test.ts          # Component tests

mcp-gateway-ui/
├── tests/
│   ├── e2e/                  # End-to-end tests
│   │   ├── gateway-api.spec.ts    # API integration tests
│   │   └── smoke.spec.ts          # UI smoke tests
│   ├── unit/                 # Unit tests
│   └── global-setup.ts       # Test setup
├── playwright.config.ts      # E2E test configuration
└── vitest.config.ts         # Unit test configuration
```

## Test Categories

### 1. Backend Tests (Deno)
- **Location**: `deno-mcp-gateway/src/**/*_test.ts`
- **Runner**: Deno's built-in test runner
- **Purpose**: Unit and integration tests for the MCP Gateway backend
- **Command**: `deno task test`

**Features tested:**
- API endpoints and routing
- MCP protocol implementation
- Server registration and management
- Tool execution and responses
- Error handling

### 2. UI Unit Tests (Vitest)
- **Location**: `mcp-gateway-ui/tests/unit/`
- **Runner**: Vitest
- **Purpose**: Component and utility function testing
- **Command**: `pnpm test`

**Features tested:**
- React components
- API client functions
- Utility functions
- State management

### 3. End-to-End Tests (Playwright)
- **Location**: `mcp-gateway-ui/tests/e2e/`
- **Runner**: Playwright
- **Purpose**: Full application integration and user flow testing
- **Command**: `pnpm test:e2e`

**Features tested:**
- Complete user workflows
- Backend-frontend integration
- API functionality through UI
- Cross-browser compatibility
- Real gateway interactions

## Running Tests

### Quick Commands

```bash
# Run all tests
./run-tests.sh all

# Run specific test types
./run-tests.sh backend
./run-tests.sh ui-unit
./run-tests.sh e2e

# Run with coverage
./run-tests.sh all --coverage

# Run in watch mode (backend and ui-unit only)
./run-tests.sh backend --watch

# Run tests in parallel (where supported)
./run-tests.sh all --parallel
```

### Individual Test Suites

#### Backend Tests
```bash
cd deno-mcp-gateway
deno task test                    # Run tests
deno task test:coverage          # With coverage
deno task test:watch            # Watch mode
```

#### UI Unit Tests
```bash
cd mcp-gateway-ui
pnpm test                       # Run tests
pnpm test:coverage             # With coverage
pnpm test:watch               # Watch mode
```

#### E2E Tests
```bash
cd mcp-gateway-ui
pnpm test:e2e                  # Run all e2e tests
pnpm test:e2e:ui              # Run with UI interface
pnpm test:e2e:headed          # Run in headed mode
pnpm test:e2e:api             # Run API tests only
```

## Test Configuration

### Environment Variables

- `GATEWAY_URL`: Backend gateway URL for e2e tests (default: https://deno-mcp-gateway.deno.dev)
- `UI_URL`: Frontend URL for e2e tests (default: http://localhost:8888)

### CI/CD Integration

For continuous integration, use:
```bash
# Install dependencies and run all tests
./run-tests.sh all --coverage

# Or use the CI-specific scripts
pnpm test:ci  # In UI directory (runs unit + e2e with coverage)
```

## Test Development Guidelines

### Backend Tests
- Place test files alongside source files with `_test.ts` suffix
- Use Deno's built-in assertions
- Test API endpoints with real HTTP requests when needed
- Mock external dependencies appropriately

### UI Unit Tests
- Use Vitest for fast unit testing
- Test components in isolation
- Mock API calls and external dependencies
- Focus on business logic and user interactions

### E2E Tests
- Test complete user workflows
- Use realistic data and scenarios
- Test error conditions and edge cases
- Ensure tests are independent and can run in any order
- Use proper waiting strategies (avoid hard sleeps)

## Debugging Tests

### Backend Tests
```bash
deno test --inspect-brk src/specific_test.ts
```

### UI Tests
```bash
# Unit tests with debugging
pnpm test:watch --reporter=verbose

# E2E tests with UI
pnpm test:e2e:ui

# E2E tests in headed mode
pnpm test:e2e:headed
```

## Coverage Reports

Coverage reports are generated in:
- **Backend**: `coverage/` directory (lcov format)
- **UI**: `coverage/` directory (HTML reports)

View coverage:
```bash
# Backend coverage (after running with --coverage)
deno coverage coverage --lcov

# UI coverage (opens HTML report)
cd mcp-gateway-ui/coverage && open index.html
```

## Performance Considerations

- **Parallel Execution**: Backend and UI unit tests can run in parallel
- **E2E Isolation**: E2E tests run sequentially to avoid conflicts
- **Resource Management**: Tests clean up after themselves
- **Timeouts**: Appropriate timeouts set for different test types

## Troubleshooting

### Common Issues

1. **Port Conflicts**: Ensure test ports don't conflict with dev servers
2. **Browser Installation**: Playwright may need `pnpm exec playwright install`
3. **Dependencies**: Run `pnpm install` in UI directory if tests fail
4. **Gateway Connection**: Check GATEWAY_URL for e2e tests

### Debug Commands
```bash
# Verbose test output
./run-tests.sh all --verbose

# Check test environment
./run-tests.sh --help

# Individual test debugging
cd mcp-gateway-ui && pnpm test:e2e --debug
```