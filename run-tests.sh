#!/bin/bash

# Cross-platform test runner for MCP Gateway project
# Usage: ./run-tests.sh [backend|ui-unit|e2e|all] [--coverage] [--watch]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Default values
TEST_TYPE="all"
COVERAGE=false
WATCH=false
PARALLEL=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        backend|ui-unit|e2e|all)
            TEST_TYPE="$1"
            shift
            ;;
        --coverage)
            COVERAGE=true
            shift
            ;;
        --watch)
            WATCH=true
            shift
            ;;
        --parallel)
            PARALLEL=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [backend|ui-unit|e2e|all] [--coverage] [--watch] [--parallel]"
            echo ""
            echo "Arguments:"
            echo "  backend     Run only backend Deno tests"
            echo "  ui-unit     Run only UI unit tests (Vitest)"
            echo "  e2e         Run only end-to-end tests (Playwright)"
            echo "  all         Run all tests (default)"
            echo ""
            echo "Options:"
            echo "  --coverage  Run tests with coverage reporting"
            echo "  --watch     Run tests in watch mode"
            echo "  --parallel  Run compatible tests in parallel"
            echo "  -h, --help  Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

function print_header() {
    echo -e "${MAGENTA}\n=== $1 ===${NC}"
}

function print_result() {
    local test_name="$1"
    local success="$2"
    local details="$3"
    
    if [[ "$success" == "true" ]]; then
        echo -e "${GREEN}✅ PASSED${NC} $test_name"
    else
        echo -e "${RED}❌ FAILED${NC} $test_name"
    fi
    
    if [[ -n "$details" ]]; then
        echo -e "   ${CYAN}$details${NC}"
    fi
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR"
UI_DIR="$SCRIPT_DIR/../mcp-gateway-ui"

# Check if UI directory exists
if [[ ! -d "$UI_DIR" ]]; then
    echo -e "${RED}❌ UI directory not found: $UI_DIR${NC}"
    exit 1
fi

print_header "MCP Gateway Test Suite"
echo -e "${CYAN}Backend Directory: $BACKEND_DIR${NC}"
echo -e "${CYAN}UI Directory: $UI_DIR${NC}"
echo -e "${CYAN}Test Type: $TEST_TYPE${NC}"
echo -e "${CYAN}Coverage: $COVERAGE${NC}"
echo -e "${CYAN}Watch: $WATCH${NC}"

function run_backend_tests() {
    print_header "Running Backend Tests (Deno)"
    
    cd "$BACKEND_DIR"
    local start_time=$(date +%s)
    
    local deno_args="task test"
    if [[ "$COVERAGE" == "true" ]]; then
        deno_args="$deno_args --coverage"
    fi
    if [[ "$WATCH" == "true" ]]; then
        deno_args="$deno_args --watch"
    fi
    
    echo -e "${CYAN}Running: deno $deno_args${NC}"
    
    if eval "deno $deno_args"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_result "Backend Tests" "true" "Duration: ${duration}s"
        return 0
    else
        print_result "Backend Tests" "false" "Failed"
        return 1
    fi
}

function run_ui_unit_tests() {
    print_header "Running UI Unit Tests (Vitest)"
    
    cd "$UI_DIR"
    local start_time=$(date +%s)
    
    # Check if node_modules exists
    if [[ ! -d "node_modules" ]]; then
        echo -e "${YELLOW}Installing dependencies...${NC}"
        pnpm install || {
            echo -e "${RED}❌ Failed to install dependencies${NC}"
            return 1
        }
    fi
    
    local test_cmd="test"
    if [[ "$COVERAGE" == "true" ]]; then
        test_cmd="test:coverage"
    elif [[ "$WATCH" == "true" ]]; then
        test_cmd="test:watch"
    fi
    
    echo -e "${CYAN}Running: pnpm $test_cmd${NC}"
    
    if pnpm "$test_cmd"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_result "UI Unit Tests" "true" "Duration: ${duration}s"
        return 0
    else
        print_result "UI Unit Tests" "false" "Failed"
        return 1
    fi
}

function run_e2e_tests() {
    print_header "Running End-to-End Tests (Playwright)"
    
    if [[ "$WATCH" == "true" ]]; then
        echo -e "${YELLOW}⚠️  Watch mode not supported for e2e tests${NC}"
        return 0
    fi
    
    cd "$UI_DIR"
    local start_time=$(date +%s)
    
    # Check if node_modules exists
    if [[ ! -d "node_modules" ]]; then
        echo -e "${YELLOW}Installing dependencies...${NC}"
        pnpm install || {
            echo -e "${RED}❌ Failed to install dependencies${NC}"
            return 1
        }
    fi
    
    # Install playwright browsers if needed
    if [[ ! -d ".playwright" ]] && [[ ! -d "~/.cache/ms-playwright" ]]; then
        echo -e "${YELLOW}Installing Playwright browsers...${NC}"
        pnpm exec playwright install
    fi
    
    echo -e "${CYAN}Running: pnpm test:e2e${NC}"
    
    if pnpm test:e2e; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_result "E2E Tests" "true" "Duration: ${duration}s"
        return 0
    else
        print_result "E2E Tests" "false" "Failed"
        return 1
    fi
}

# Main execution
overall_success=true
start_time=$(date +%s)

case "$TEST_TYPE" in
    "backend")
        run_backend_tests || overall_success=false
        ;;
    "ui-unit")
        run_ui_unit_tests || overall_success=false
        ;;
    "e2e")
        run_e2e_tests || overall_success=false
        ;;
    "all")
        if [[ "$PARALLEL" == "true" && "$WATCH" != "true" ]]; then
            print_header "Running Tests in Parallel"
            
            # Run backend and UI tests in parallel
            (run_backend_tests) & backend_pid=$!
            (run_ui_unit_tests) & ui_pid=$!
            
            # Wait for parallel jobs
            wait $backend_pid || overall_success=false
            wait $ui_pid || overall_success=false
            
            # Run E2E tests sequentially
            run_e2e_tests || overall_success=false
        else
            # Sequential execution
            run_backend_tests || overall_success=false
            run_ui_unit_tests || overall_success=false
            run_e2e_tests || overall_success=false
        fi
        ;;
esac

# Summary
end_time=$(date +%s)
total_duration=$((end_time - start_time))

print_header "Test Summary"
echo -e "${CYAN}Total Duration: ${total_duration}s${NC}"

if [[ "$overall_success" == "true" ]]; then
    echo -e "\n${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}💥 Some tests failed!${NC}"
    exit 1
fi