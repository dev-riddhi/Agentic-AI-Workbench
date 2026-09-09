<#
.SYNOPSIS
    Agentic AI Workbench - Development Test Run
.DESCRIPTION
    Launches both Backend (FastAPI with hot reload) and Frontend (Next.js with Turbopack fast refresh)
    in development mode.
.PARAMETER SeparateWindows
    Launch the backend and frontend in separate, dedicated PowerShell terminal windows
.PARAMETER KillExisting
    Forcefully terminate any existing processes running on target ports (8000, 3000)
.PARAMETER BackendPort
    Port for the backend development server (default: 8000)
.PARAMETER FrontendPort
    Port for the frontend development server (default: 3000)
#>
[CmdletBinding()]
param(
    [switch]$SeparateWindows,
    [switch]$KillExisting,
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 3000
)

$ErrorActionPreference = "Stop"
$RootDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
if (-not $RootDir) { $RootDir = (Get-Location).Path }
Set-Location $RootDir

$BackendDir = Join-Path $RootDir "backend"
$FrontendDir = Join-Path $RootDir "frontend"

$env:PYTHONIOENCODING = "utf-8"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   AGENTIC AI WORKBENCH - DEVELOPMENT RUNNER                     " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " Root Dir      : $RootDir" -ForegroundColor DarkGray
Write-Host " Frontend URL  : http://localhost:$FrontendPort" -ForegroundColor Green
Write-Host " Backend URL   : http://localhost:$BackendPort" -ForegroundColor Green
Write-Host " API Docs URL  : http://localhost:$BackendPort/docs" -ForegroundColor Green
Write-Host " Mode          : Development $(if ($SeparateWindows) { '(Separate Windows)' } else { '(Unified Console)' })" -ForegroundColor DarkGray
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

# Verify prerequisites
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Error "uv is not found in PATH. Please install uv (https://github.com/astral-sh/uv)."
    exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm is not found in PATH. Please install Node.js (https://nodejs.org)."
    exit 1
}

# Free ports if KillExisting is specified
function Check-Port($portNumber, $name) {
    $conn = Get-NetTCPConnection -LocalPort $portNumber -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        $pId = $conn.OwningProcess
        $proc = Get-Process -Id $pId -ErrorAction SilentlyContinue
        $pName = if ($proc) { $proc.ProcessName } else { "Unknown" }
        if ($KillExisting) {
            Write-Host "[!] Port $portNumber ($name) is used by $pName (PID $pId). Killing..." -ForegroundColor Yellow
            Stop-Process -Id $pId -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 600
        } else {
            Write-Host "[!] Warning: Port $portNumber ($name) is currently occupied by $pName (PID $pId)." -ForegroundColor Yellow
            Write-Host "    Pass -KillExisting to forcefully free occupied ports." -ForegroundColor DarkGray
        }
    }
}

Check-Port $BackendPort "Backend"
Check-Port $FrontendPort "Frontend"

# Ensure backend dependencies and outputs directory
if (-not (Test-Path (Join-Path $BackendDir ".venv"))) {
    Write-Host "[*] Syncing Python dependencies in backend..." -ForegroundColor Yellow
    Push-Location $BackendDir
    try {
        uv sync
    } finally {
        Pop-Location
    }
}

$OutputsDir = Join-Path $BackendDir "outputs"
if (-not (Test-Path $OutputsDir)) {
    New-Item -ItemType Directory -Path $OutputsDir -Force | Out-Null
}

# Ensure frontend dependencies
if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host "[*] Installing frontend dependencies with npm install..." -ForegroundColor Yellow
    Push-Location $FrontendDir
    try {
        npm install
    } finally {
        Pop-Location
    }
}

# Launch in Separate Windows
if ($SeparateWindows) {
    Write-Host ""
    Write-Host "[+] Launching Backend dev server in a dedicated window..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "
        `$host.UI.RawUI.WindowTitle = 'Agentic AI Workbench [Backend - Dev]';
        Set-Location '$BackendDir';
        `$env:PYTHONIOENCODING = 'utf-8';
        Write-Host '=====================================================' -ForegroundColor Cyan;
        Write-Host '  Development Backend Server (Auto-Reloading)        ' -ForegroundColor Cyan;
        Write-Host '  URL: http://localhost:$BackendPort                 ' -ForegroundColor Green;
        Write-Host '=====================================================' -ForegroundColor Cyan;
        uv run uvicorn main:app --reload --host 127.0.0.1 --port $BackendPort
    "

    Write-Host "[+] Launching Frontend dev server in a dedicated window..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "
        `$host.UI.RawUI.WindowTitle = 'Agentic AI Workbench [Frontend - Dev]';
        Set-Location '$FrontendDir';
        Write-Host '=====================================================' -ForegroundColor Cyan;
        Write-Host '  Development Frontend Server (Next.js Turbopack)    ' -ForegroundColor Cyan;
        Write-Host '  URL: http://localhost:$FrontendPort                ' -ForegroundColor Green;
        Write-Host '=====================================================' -ForegroundColor Cyan;
        npm run dev -- -p $FrontendPort
    "

    Write-Host ""
    Write-Host "[+] Development servers launched in dedicated windows." -ForegroundColor Green
    Write-Host "    Frontend: http://localhost:$FrontendPort" -ForegroundColor Green
    Write-Host "    Backend:  http://localhost:$BackendPort" -ForegroundColor Green
    Write-Host "    Docs:     http://localhost:$BackendPort/docs" -ForegroundColor Green
    Write-Host ""
    exit 0
}

# Unified Console Mode
Write-Host ""
Write-Host "[+] Starting development servers with Hot Reload (Unified Output)..." -ForegroundColor Cyan
Write-Host "    Press Ctrl+C at any time to gracefully terminate both servers." -ForegroundColor DarkGray
Write-Host ""

$backendJob = Start-Job -ScriptBlock {
    param($dir, $port)
    Set-Location $dir
    $env:PYTHONIOENCODING = "utf-8"
    uv run uvicorn main:app --reload --host 127.0.0.1 --port $port
} -ArgumentList $BackendDir, $BackendPort

$frontendJob = Start-Job -ScriptBlock {
    param($dir, $port)
    Set-Location $dir
    npm run dev -- -p $port
} -ArgumentList $FrontendDir, $FrontendPort

try {
    while (($backendJob.State -eq 'Running') -and ($frontendJob.State -eq 'Running')) {
        $bLines = Receive-Job -Job $backendJob -ErrorAction SilentlyContinue
        if ($bLines) {
            foreach ($line in $bLines) {
                Write-Host "[BACKEND]  $line" -ForegroundColor Cyan
            }
        }

        $fLines = Receive-Job -Job $frontendJob -ErrorAction SilentlyContinue
        if ($fLines) {
            foreach ($line in $fLines) {
                Write-Host "[FRONTEND] $line" -ForegroundColor Green
            }
        }

        Start-Sleep -Milliseconds 150
    }

    if ($backendJob.State -ne 'Running') {
        Write-Host "[!] Backend dev server stopped unexpectedly." -ForegroundColor Red
        Receive-Job -Job $backendJob | Write-Host
    }
    if ($frontendJob.State -ne 'Running') {
        Write-Host "[!] Frontend dev server stopped unexpectedly." -ForegroundColor Red
        Receive-Job -Job $frontendJob | Write-Host
    }
}
finally {
    Write-Host ""
    Write-Host "[!] Terminating development servers..." -ForegroundColor Yellow

    if ($backendJob) {
        Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
        Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
    }
    if ($frontendJob) {
        Stop-Job -Job $frontendJob -ErrorAction SilentlyContinue
        Remove-Job -Job $frontendJob -Force -ErrorAction SilentlyContinue
    }

    # Clean up any lingering port bindings
    foreach ($p in @($BackendPort, $FrontendPort)) {
        $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($c) {
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }

    Write-Host "[+] All development servers stopped." -ForegroundColor Green
}
