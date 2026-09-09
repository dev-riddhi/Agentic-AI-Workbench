<#
.SYNOPSIS
    Agentic AI Workbench - Backend Production Server
.DESCRIPTION
    Builds environment and starts the production Uvicorn server for the FastAPI backend.
.PARAMETER HostAddress
    Bind IP address (default: 0.0.0.0)
.PARAMETER Port
    Port to listen on (default: 8000)
.PARAMETER KillExisting
    Forcefully terminate any existing process occupying the target port before starting
#>
[CmdletBinding()]
param(
    [string]$HostAddress = "0.0.0.0",
    [int]$Port = 8000,
    [switch]$KillExisting
)

$ErrorActionPreference = "Stop"
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }
Set-Location $ScriptDir

# Enforce UTF-8 console output encoding to prevent charmap errors on Windows
$env:PYTHONIOENCODING = "utf-8"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   AGENTIC AI WORKBENCH - BACKEND PRODUCTION SERVER              " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " Directory : $ScriptDir" -ForegroundColor DarkGray
Write-Host " Host      : $HostAddress" -ForegroundColor DarkGray
Write-Host " Port      : $Port" -ForegroundColor DarkGray
Write-Host " API URL   : http://localhost:$Port" -ForegroundColor Green
Write-Host " API Docs  : http://localhost:$Port/docs" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

# Verify uv is installed
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Error "uv was not found in PATH. Please install uv (https://github.com/astral-sh/uv) and try again."
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

# Ensure virtual environment and dependencies are synced
if (-not (Test-Path ".venv")) {
    Write-Host "[*] Initializing Python virtual environment with uv sync..." -ForegroundColor Yellow
    uv sync
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to synchronize backend dependencies."
        exit $LASTEXITCODE
    }
}

# Ensure outputs directory exists
$OutputsDir = Join-Path $ScriptDir "outputs"
if (-not (Test-Path $OutputsDir)) {
    New-Item -ItemType Directory -Path $OutputsDir -Force | Out-Null
}

Write-Host "[+] Starting production Uvicorn server..." -ForegroundColor Cyan
Write-Host "    Press Ctrl+C to stop the server." -ForegroundColor DarkGray
Write-Host ""

# Execute production Uvicorn server directly
uv run uvicorn main:app --host $HostAddress --port $Port
