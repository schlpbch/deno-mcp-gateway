# Makefile for Federated MCP Gateway Test Suite
# Cross-platform test runner shortcuts

.PHONY: test test-all test-backend test-ui test-e2e test-coverage test-watch help

# Default target
test: test-all

# Run all tests
test-all:
	@echo "Running all tests..."
	@bash run-tests.sh all

# Run specific test types  
test-backend:
	@echo "Running backend tests..."
	@bash run-tests.sh backend

test-ui:
	@echo "Running UI unit tests..."
	@bash run-tests.sh ui-unit

test-e2e:
	@echo "Running E2E tests..."
	@bash run-tests.sh e2e

# Run tests with coverage
test-coverage:
	@echo "Running all tests with coverage..."
	@bash run-tests.sh all --coverage

# Run tests in watch mode (backend and UI unit only)
test-watch:
	@echo "Running tests in watch mode..."
	@bash run-tests.sh all --watch

# Run tests in parallel
test-parallel:
	@echo "Running tests in parallel..."
	@bash run-tests.sh all --parallel

# CI-friendly test run
test-ci:
	@echo "Running CI test suite..."
	@bash run-tests.sh all --coverage --parallel

# Setup test environment
setup:
	@echo "Setting up test environment..."
	@echo "Installing UI dependencies..."
	@cd ../mcp-gateway-ui && pnpm install
	@echo "Installing Playwright browsers..."
	@cd ../mcp-gateway-ui && pnpm exec playwright install
	@echo "Test environment ready!"

# Clean test artifacts
clean:
	@echo "Cleaning test artifacts..."
	@rm -rf coverage/
	@cd ../mcp-gateway-ui && rm -rf coverage/ test-results/ playwright-report/
	@echo "Test artifacts cleaned!"

# Show help
help:
	@echo "Federated MCP Gateway Test Suite"
	@echo ""
	@echo "Available targets:"
	@echo "  test          - Run all tests (default)"
	@echo "  test-all      - Run all tests"
	@echo "  test-backend  - Run backend tests only"
	@echo "  test-ui       - Run UI unit tests only"
	@echo "  test-e2e      - Run E2E tests only"
	@echo "  test-coverage - Run all tests with coverage"
	@echo "  test-watch    - Run tests in watch mode"
	@echo "  test-parallel - Run tests in parallel"
	@echo "  test-ci       - Run CI test suite"
	@echo "  setup         - Setup test environment"
	@echo "  clean         - Clean test artifacts"
	@echo "  help          - Show this help"
	@echo ""
	@echo "Examples:"
	@echo "  make test"
	@echo "  make test-e2e"
	@echo "  make test-coverage"