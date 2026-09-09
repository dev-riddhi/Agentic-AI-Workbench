<#
.SYNOPSIS
    Agentic AI Workbench - Frontend Production Build & Server
.DESCRIPTION
    Builds the production Next.js application and starts the production HTTP server.
.PARAMETER Port
    Port to listen on (default: 3000)
.PARAMETER SkipBuild
    Skip running 'npm run build' and start the server using existing build artifacts in .next
.PARAMETER KillExisting
    Forcefully terminate any existing process occupying the target port before starting
#>
[CmdletBinding()]
param(
    [int]$Port = 3000,
    [switch]$SkipBuild,
    [switch]$KillExisting
)

$ErrorActionPreference = "Stop"
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }
Set-Location $ScriptDir

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   AGENTIC AI WORKBENCH - FRONTEND PRODUCTION SERVER             " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " Directory : $ScriptDir" -ForegroundColor DarkGray
Write-Host " Port      : $Port" -ForegroundColor DarkGray
Write-Host " URL       : http://localhost:$Port" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

# Verify npm and node are installed
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm was not found in PATH. Please install Node.js (https://nodejs.org) and try again."
    exit 1
}

# Check if port is already in use
$conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) {
    $procId = $conn.OwningProcess
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    $procName = if ($proc) { $proc.ProcessName } else { "Unknown" }
    
    if ($KillExisting) {
        Write-Host "[!] Port $Port is currently in use by $procName (PID $procId). Terminating..." -ForegroundColor Yellow
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 800
    } else {
        Write-Host "[!] Warning: Port $Port is currently occupied by $procName (PID $procId)." -ForegroundColor Yellow
        Write-Host "    Pass -KillExisting to forcefully terminate it, or choose a different port." -ForegroundColor DarkGray
    }
}

# Ensure node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "[*] Installing dependencies with npm install..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install failed."
        exit $LASTEXITCODE
    }
}

# Compile production bundle unless -SkipBuild is passed
if (-not $SkipBuild -or -not (Test-Path ".next")) {
    Write-Host "[*] Compiling optimized Next.js production bundle..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Next.js production build failed."
        exit $LASTEXITCODE
    }
    Write-Host "[+] Production build compilation succeeded." -ForegroundColor Green
} else {
    Write-Host "[i] Skipping build step (using existing .next artifacts)." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "[+] Starting production Next.js server on http://localhost:$Port..." -ForegroundColor Cyan
Write-Host "    Press Ctrl+C to stop the server." -ForegroundColor DarkGray
Write-Host ""

# Start production server
npx next start -p $Port
