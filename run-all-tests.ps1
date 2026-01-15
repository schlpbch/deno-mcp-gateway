#!/usr/bin/env powershell
<#
.SYNOPSIS
    Comprehensive test runner for Federated MCP Gateway project
    
.DESCRIPTION
    Runs all tests for the Federated MCP Gateway project including:
    - Backend Deno tests (unit/integration)
    - UI unit tests (Vitest)
    - End-to-end tests (Playwright)
    
.PARAMETER TestType
    Specify which tests to run: backend, ui-unit, e2e, or all (default)
    
.PARAMETER Coverage
    Run tests with coverage reporting
    
.PARAMETER Parallel
    Run tests in parallel where supported
    
.PARAMETER Watch
    Run tests in watch mode (not supported for e2e tests)
    
.EXAMPLE
    .\run-all-tests.ps1
    Run all tests
    
.EXAMPLE
    .\run-all-tests.ps1 -TestType e2e
    Run only e2e tests
    
.EXAMPLE
    .\run-all-tests.ps1 -Coverage
    Run all tests with coverage
#>

param(
    [ValidateSet("backend", "ui-unit", "e2e", "all")]
    [string]$TestType = "all",
    
    [switch]$Coverage,
    
    [switch]$Parallel,
    
    [switch]$Watch
)

# Colors for output
$Colors = @{
    Success = "Green"
    Error = "Red"
    Warning = "Yellow"
    Info = "Cyan"
    Header = "Magenta"
}

function Write-TestHeader {
    param([string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor $Colors.Header
}

function Write-TestResult {
    param(
        [string]$TestName,
        [bool]$Success,
        [string]$Details = ""
    )
    
    $status = if ($Success) { "✅ PASSED" } else { "❌ FAILED" }
    $color = if ($Success) { $Colors.Success } else { $Colors.Error }
    
    Write-Host "$status $TestName" -ForegroundColor $color
    if ($Details) {
        Write-Host "   $Details" -ForegroundColor $Colors.Info
    }
}

# Track test results
$TestResults = @{
    Backend = @{ Passed = $false; Duration = 0 }
    UIUnit = @{ Passed = $false; Duration = 0 }
    E2E = @{ Passed = $false; Duration = 0 }
}

# Get script directory for relative paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BackendDir = $ScriptDir
$UIDir = Join-Path $ScriptDir ".." "mcp-gateway-ui"

# Ensure UI directory exists
if (-not (Test-Path $UIDir)) {
    Write-Host "❌ UI directory not found: $UIDir" -ForegroundColor $Colors.Error
    exit 1
}

Write-TestHeader "Federated MCP Gateway Test Suite"
Write-Host "Backend Directory: $BackendDir" -ForegroundColor $Colors.Info
Write-Host "UI Directory: $UIDir" -ForegroundColor $Colors.Info
Write-Host "Test Type: $TestType" -ForegroundColor $Colors.Info
Write-Host "Coverage: $($Coverage.IsPresent)" -ForegroundColor $Colors.Info
Write-Host "Watch: $($Watch.IsPresent)" -ForegroundColor $Colors.Info

function Run-BackendTests {
    Write-TestHeader "Running Backend Tests (Deno)"
    
    try {
        Push-Location $BackendDir
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        
        $denoArgs = @("task", "test")
        if ($Coverage) {
            $denoArgs += "--coverage"
        }
        if ($Watch) {
            $denoArgs += "--watch"
        }
        
        Write-Host "Running: deno $($denoArgs -join ' ')" -ForegroundColor $Colors.Info
        & deno @denoArgs
        
        $success = $LASTEXITCODE -eq 0
        $stopwatch.Stop()
        $TestResults.Backend.Passed = $success
        $TestResults.Backend.Duration = $stopwatch.Elapsed.TotalSeconds
        
        Write-TestResult "Backend Tests" $success "Duration: $([math]::Round($TestResults.Backend.Duration, 2))s"
        return $success
    }
    catch {
        Write-Host "❌ Backend tests failed: $_" -ForegroundColor $Colors.Error
        return $false
    }
    finally {
        Pop-Location
    }
}

function Run-UIUnitTests {
    Write-TestHeader "Running UI Unit Tests (Vitest)"
    
    try {
        Push-Location $UIDir
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        
        # Check if node_modules exists
        if (-not (Test-Path "node_modules")) {
            Write-Host "Installing dependencies..." -ForegroundColor $Colors.Warning
            & pnpm install
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to install dependencies"
            }
        }
        
        $testArgs = if ($Coverage) { @("test:coverage") } elseif ($Watch) { @("test:watch") } else { @("test") }
        
        Write-Host "Running: pnpm $($testArgs -join ' ')" -ForegroundColor $Colors.Info
        & pnpm @testArgs
        
        $success = $LASTEXITCODE -eq 0
        $stopwatch.Stop()
        $TestResults.UIUnit.Passed = $success
        $TestResults.UIUnit.Duration = $stopwatch.Elapsed.TotalSeconds
        
        Write-TestResult "UI Unit Tests" $success "Duration: $([math]::Round($TestResults.UIUnit.Duration, 2))s"
        return $success
    }
    catch {
        Write-Host "❌ UI unit tests failed: $_" -ForegroundColor $Colors.Error
        return $false
    }
    finally {
        Pop-Location
    }
}

function Run-E2ETests {
    Write-TestHeader "Running End-to-End Tests (Playwright)"
    
    if ($Watch) {
        Write-Host "⚠️  Watch mode not supported for e2e tests" -ForegroundColor $Colors.Warning
        return $true
    }
    
    try {
        Push-Location $UIDir
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        
        # Check if node_modules exists
        if (-not (Test-Path "node_modules")) {
            Write-Host "Installing dependencies..." -ForegroundColor $Colors.Warning
            & pnpm install
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to install dependencies"
            }
        }
        
        # Install playwright browsers if needed
        if (-not (Test-Path ".playwright")) {
            Write-Host "Installing Playwright browsers..." -ForegroundColor $Colors.Warning
            & pnpm exec playwright install
        }
        
        Write-Host "Running: pnpm test:e2e" -ForegroundColor $Colors.Info
        & pnpm test:e2e
        
        $success = $LASTEXITCODE -eq 0
        $stopwatch.Stop()
        $TestResults.E2E.Passed = $success
        $TestResults.E2E.Duration = $stopwatch.Elapsed.TotalSeconds
        
        Write-TestResult "E2E Tests" $success "Duration: $([math]::Round($TestResults.E2E.Duration, 2))s"
        return $success
    }
    catch {
        Write-Host "❌ E2E tests failed: $_" -ForegroundColor $Colors.Error
        return $false
    }
    finally {
        Pop-Location
    }
}

# Main execution
$overallSuccess = $true
$startTime = Get-Date

switch ($TestType) {
    "backend" {
        $overallSuccess = Run-BackendTests
    }
    "ui-unit" {
        $overallSuccess = Run-UIUnitTests
    }
    "e2e" {
        $overallSuccess = Run-E2ETests
    }
    "all" {
        if ($Parallel -and -not $Watch) {
            Write-TestHeader "Running Tests in Parallel"
            
            # Run backend and UI unit tests in parallel
            $backendJob = Start-Job -ScriptBlock ${function:Run-BackendTests}
            $uiUnitJob = Start-Job -ScriptBlock ${function:Run-UIUnitTests}
            
            # Wait for parallel jobs
            $backendResult = Receive-Job -Job $backendJob -Wait
            $uiUnitResult = Receive-Job -Job $uiUnitJob -Wait
            
            Remove-Job $backendJob, $uiUnitJob
            
            # Run E2E tests sequentially (they need the app running)
            $e2eResult = Run-E2ETests
            
            $overallSuccess = $backendResult -and $uiUnitResult -and $e2eResult
        }
        else {
            # Sequential execution
            $backendResult = Run-BackendTests
            $uiUnitResult = Run-UIUnitTests
            $e2eResult = Run-E2ETests
            
            $overallSuccess = $backendResult -and $uiUnitResult -and $e2eResult
        }
    }
}

# Summary
$endTime = Get-Date
$totalDuration = ($endTime - $startTime).TotalSeconds

Write-TestHeader "Test Summary"
Write-Host "Total Duration: $([math]::Round($totalDuration, 2))s" -ForegroundColor $Colors.Info

if ($TestType -eq "all") {
    Write-TestResult "Backend Tests" $TestResults.Backend.Passed
    Write-TestResult "UI Unit Tests" $TestResults.UIUnit.Passed  
    Write-TestResult "E2E Tests" $TestResults.E2E.Passed
}

if ($overallSuccess) {
    Write-Host "`n🎉 All tests passed!" -ForegroundColor $Colors.Success
    exit 0
}
else {
    Write-Host "`n💥 Some tests failed!" -ForegroundColor $Colors.Error
    exit 1
}