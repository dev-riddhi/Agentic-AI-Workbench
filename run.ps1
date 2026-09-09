<#
.SYNOPSIS
    Agentic AI Workbench - Full Production Build & Serving
.DESCRIPTION
    Compiles production build artifacts and runs both Backend (FastAPI) and Frontend (Next.js)
    production servers concurrently.
.PARAMETER SeparateWindows
    Launch the backend and frontend in separate, dedicated PowerShell terminal windows
.PARAMETER SkipBuild
    Skip running 'npm run build' before starting the production servers
.PARAMETER KillExisting
    Forcefully terminate any existing processes running on target ports (8000, 3000)
.PARAMETER BackendPort
    Port for the backend FastAPI server (default: 8000)
.PARAMETER FrontendPort
    Port for the frontend Next.js server (default: 3000)
#>
[CmdletBinding()]
param(
    [switch]$SeparateWindows,
    [switch]$SkipBuild,
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
Write-Host "   AGENTIC AI WORKBENCH - PRODUCTION SERVING                     " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " Root Dir      : $RootDir" -ForegroundColor DarkGray
Write-Host " Frontend URL  : http://localhost:$FrontendPort" -ForegroundColor Green
Write-Host " Backend URL   : http://localhost:$BackendPort" -ForegroundColor Green
Write-Host " API Docs URL  : http://localhost:$BackendPort/docs" -ForegroundColor Green
Write-Host " Mode          : Production $(if ($SeparateWindows) { '(Separate Windows)' } else { '(Unified Console)' })" -ForegroundColor DarkGray
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

# Function to free ports if KillExisting is specified
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

# Ensure Backend environment
if (-not (Test-Path (Join-Path $BackendDir ".venv"))) {
    Write-Host "[*] Syncing Python dependencies in backend..." -ForegroundColor Yellow
    Push-Location $BackendDir
    try {
        uv sync
    } finally {
        Pop-Location
    }
}

# Ensure outputs directory exists
$OutputsDir = Join-Path $BackendDir "outputs"
if (-not (Test-Path $OutputsDir)) {
    New-Item -ItemType Directory -Path $OutputsDir -Force | Out-Null
}

# Compile Frontend Production Build
if (-not $SkipBuild -or -not (Test-Path (Join-Path $FrontendDir ".next"))) {
    Write-Host "[*] Compiling frontend production bundle (npm run build)..." -ForegroundColor Yellow
    Push-Location $FrontendDir
    try {
        if (-not (Test-Path "node_modules")) {
            Write-Host "[*] Running npm install..." -ForegroundColor Yellow
            npm install
        }
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Frontend production build compilation failed."
            exit $LASTEXITCODE
        }
        Write-Host "[+] Frontend build compilation completed successfully." -ForegroundColor Green
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[i] Skipping frontend build step (existing .next build detected)." -ForegroundColor DarkGray
}

# Launch Servers
if ($SeparateWindows) {
    Write-Host ""
    Write-Host "[+] Launching Backend production server in a dedicated window..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "
        `$host.UI.RawUI.WindowTitle = 'Agentic AI Workbench [Backend - Production]';
        Set-Location '$BackendDir';
        `$env:PYTHONIOENCODING = 'utf-8';
        Write-Host '=====================================================' -ForegroundColor Cyan;
        Write-Host '  Production Backend Server (FastAPI + Uvicorn)      ' -ForegroundColor Cyan;
        Write-Host '  URL: http://localhost:$BackendPort                 ' -ForegroundColor Green;
        Write-Host '=====================================================' -ForegroundColor Cyan;
        uv run uvicorn main:app --host 0.0.0.0 --port $BackendPort
    "

    Write-Host "[+] Launching Frontend production server in a dedicated window..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "
        `$host.UI.RawUI.WindowTitle = 'Agentic AI Workbench [Frontend - Production]';
        Set-Location '$FrontendDir';
        Write-Host '=====================================================' -ForegroundColor Cyan;
        Write-Host '  Production Frontend Server (Next.js)               ' -ForegroundColor Cyan;
        Write-Host '  URL: http://localhost:$FrontendPort                ' -ForegroundColor Green;
        Write-Host '=====================================================' -ForegroundColor Cyan;
        npx next start -p $FrontendPort
    "

    Write-Host ""
    Write-Host "[+] Production servers launched in dedicated windows." -ForegroundColor Green
    Write-Host "    Frontend: http://localhost:$FrontendPort" -ForegroundColor Green
    Write-Host "    Backend:  http://localhost:$BackendPort" -ForegroundColor Green
    Write-Host "    Docs:     http://localhost:$BackendPort/docs" -ForegroundColor Green
    Write-Host ""
    exit 0
}

# Unified console mode using PowerShell Jobs
Write-Host ""
Write-Host "[+] Starting production servers (Unified Output)..." -ForegroundColor Cyan
Write-Host "    Press Ctrl+C at any time to gracefully terminate both servers." -ForegroundColor DarkGray
Write-Host ""

$backendJob = Start-Job -ScriptBlock {
    param($dir, $port)
    Set-Location $dir
    $env:PYTHONIOENCODING = "utf-8"
    uv run uvicorn main:app --host 0.0.0.0 --port $port
} -ArgumentList $BackendDir, $BackendPort

$frontendJob = Start-Job -ScriptBlock {
    param($dir, $port)
    Set-Location $dir
    npx next start -p $port
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
        Write-Host "[!] Backend server stopped unexpectedly." -ForegroundColor Red
        Receive-Job -Job $backendJob | Write-Host
    }
    if ($frontendJob.State -ne 'Running') {
        Write-Host "[!] Frontend server stopped unexpectedly." -ForegroundColor Red
        Receive-Job -Job $frontendJob | Write-Host
    }
}
finally {
    Write-Host ""
    Write-Host "[!] Terminating production servers..." -ForegroundColor Yellow
    
    if ($backendJob) {
        Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
        Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
    }
    if ($frontendJob) {
        Stop-Job -Job $frontendJob -ErrorAction SilentlyContinue
        Remove-Job -Job $frontendJob -Force -ErrorAction SilentlyContinue
    }

    # Ensure any detached child processes on ports are cleaned up
    foreach ($p in @($BackendPort, $FrontendPort)) {
        $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($c) {
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }

    Write-Host "[+] All production servers stopped." -ForegroundColor Green
}
