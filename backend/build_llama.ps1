<#
.SYNOPSIS
    Builds llama.cpp in the backend directory with GPU acceleration for detected devices.

.DESCRIPTION
    1. Clones or pulls the latest llama.cpp repository in backend/llama.cpp.
    2. Downloads and installs necessary build tools (CMake, MSVC, Vulkan/CUDA SDK) via winget if missing.
    3. Detects available GPU devices (Intel, AMD, NVIDIA) and configures CMake for supported accelerators.
    4. Compiles optimized Release binaries.
    5. Cleans up all source files and directories in llama.cpp, keeping ONLY the compiled 'build' directory.

.EXAMPLE
    .\build_llama.ps1
    .\build_llama.ps1 -ForceRebuild
    .\build_llama.ps1 -DeviceBackend vulkan
#>

[CmdletBinding()]
param(
    [ValidateSet("auto", "cuda", "vulkan", "cpu")]
    [string]$DeviceBackend = "auto",

    [switch]$ForceRebuild,
    [switch]$SkipPrereqs,
    [string]$CustomCmakeFlags = ""
)

$ErrorActionPreference = "Stop"

# -----------------------------------------------------------------------------
# 0. Helper Functions
# -----------------------------------------------------------------------------
function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host ("  {0}" -f $Message) -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host ("[OK] {0}" -f $Message) -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host ("[i] {0}" -f $Message) -ForegroundColor Yellow
}

function Write-Warn {
    param([string]$Message)
    Write-Host ("[!] {0}" -f $Message) -ForegroundColor DarkYellow
}

function Refresh-SessionPath {
    Write-Info "Refreshing environment PATH for current session..."
    $MachinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = $MachinePath + ";" + $UserPath
}

function Ensure-CommandViaWinget {
    param(
        [string]$CommandName,
        [string]$WingetId,
        [string]$FriendlyName,
        [string]$ExtraCheckPath = ""
    )

    if (Get-Command $CommandName -ErrorAction SilentlyContinue) {
        Write-Success ("{0} ({1}) is already available." -f $FriendlyName, $CommandName)
        return $true
    }

    if ($ExtraCheckPath -and (Test-Path $ExtraCheckPath)) {
        Write-Success ("{0} found at {1}" -f $FriendlyName, $ExtraCheckPath)
        $Dir = Split-Path -Path $ExtraCheckPath
        if ($env:Path -notlike ("*{0}*" -f $Dir)) {
            $env:Path = $Dir + ";" + $env:Path
        }
        return $true
    }

    Write-Info ("{0} not found. Installing via winget ({1})..." -f $FriendlyName, $WingetId)
    try {
        winget install --id $WingetId -e --accept-source-agreements --accept-package-agreements --silent
        Refresh-SessionPath
        if (Get-Command $CommandName -ErrorAction SilentlyContinue) {
            Write-Success ("{0} installed successfully." -f $FriendlyName)
            return $true
        }
    } catch {
        Write-Warn ("Winget installation of {0} encountered an issue: {1}" -f $WingetId, $_)
    }

    return $false
}

# -----------------------------------------------------------------------------
# 1. Path Resolution & Build Tools Prerequisites
# -----------------------------------------------------------------------------
$BackendDir = $PSScriptRoot
if (-not $BackendDir) {
    $BackendDir = (Get-Location).Path
}

$LlamaDir = Join-Path $BackendDir "llama.cpp"
$BuildDir = Join-Path $LlamaDir "build"

Write-Step "1. Resolving Prerequisites via Winget and Environment"

# Locate Visual Studio if installed
$VSWhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
$VSCmakePath = ""
$HasCompiler = $false

if (Test-Path $VSWhere) {
    $VSInstall = & $VSWhere -latest -products * -property installationPath
    if ($VSInstall) {
        $Candidate = Join-Path $VSInstall "Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
        if (Test-Path $Candidate) {
            $VSCmakePath = $Candidate
            $VSCmakeDir = Split-Path $Candidate
            if ($env:Path -notlike ("*{0}*" -f $VSCmakeDir)) {
                $env:Path = $VSCmakeDir + ";" + $env:Path
            }
        }
        $VCToolsPath = & $VSWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
        if ($VCToolsPath) {
            $HasCompiler = $true
            Write-Success ("Visual Studio C++ Build Tools detected at {0}" -f $VCToolsPath)
        }
    }
}

# Discover Vulkan SDK if installed on machine
if (-not $env:VULKAN_SDK) {
    if (Test-Path "C:\VulkanSDK") {
        $LatestSdk = Get-ChildItem "C:\VulkanSDK" -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
        if ($LatestSdk) {
            $env:VULKAN_SDK = $LatestSdk.FullName
            Write-Success ("Vulkan SDK discovered at {0}" -f $env:VULKAN_SDK)
            $VulkanBin = Join-Path $env:VULKAN_SDK "bin"
            if (Test-Path $VulkanBin -and ($env:Path -notlike ("*{0}*" -f $VulkanBin))) {
                $env:Path = $VulkanBin + ";" + $env:Path
            }
        }
    }
}

if (-not $SkipPrereqs) {
    # Check for Git
    Ensure-CommandViaWinget -CommandName "git" -WingetId "Git.Git" -FriendlyName "Git Version Control"

    # Check for CMake
    Ensure-CommandViaWinget -CommandName "cmake" -WingetId "Kitware.CMake" -FriendlyName "CMake Build System" -ExtraCheckPath $VSCmakePath

    # Ensure C++ Compiler exists
    if (-not $HasCompiler -and -not (Get-Command "cl.exe" -ErrorAction SilentlyContinue)) {
        Write-Info "MSVC C++ compiler not detected. Installing Visual Studio Build Tools via winget..."
        try {
            winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--passive --config --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" --accept-source-agreements --accept-package-agreements
            Refresh-SessionPath
        } catch {
            Write-Warn ("Could not auto-install Visual Studio BuildTools: {0}" -f $_)
        }
    }
}

# -----------------------------------------------------------------------------
# 2. Git Pull / Clone llama.cpp in Backend Folder
# -----------------------------------------------------------------------------
Write-Step "2. Syncing llama.cpp Repository"

if (Test-Path $LlamaDir) {
    $GitMeta = Join-Path $LlamaDir ".git"
    if (Test-Path $GitMeta) {
        Write-Info ("Existing git repository found at {0}. Pulling latest commits..." -f $LlamaDir)
        git -C $LlamaDir pull --ff-only
        Write-Success "llama.cpp updated to latest commit."
    } else {
        Write-Warn "llama.cpp folder exists without .git metadata (likely cleaned up after previous build)."
        Write-Info "Preserving existing build artifacts while refreshing repository..."

        $TempBuild = Join-Path $BackendDir "llama_build_backup"
        if (Test-Path $BuildDir) {
            Move-Item -Path $BuildDir -Destination $TempBuild -Force
        }
        Remove-Item -Path $LlamaDir -Recurse -Force

        Write-Info "Cloning fresh llama.cpp from GitHub..."
        git clone --depth 1 https://github.com/ggerganov/llama.cpp.git $LlamaDir

        if (Test-Path $TempBuild) {
            Move-Item -Path $TempBuild -Destination $BuildDir -Force
        }
        Write-Success "llama.cpp cloned successfully."
    }
} else {
    Write-Info ("Cloning llama.cpp repository into {0}..." -f $LlamaDir)
    git clone --depth 1 https://github.com/ggerganov/llama.cpp.git $LlamaDir
    Write-Success "llama.cpp cloned successfully."
}

# -----------------------------------------------------------------------------
# 3. Detect GPU Hardware and Configure CMake
# -----------------------------------------------------------------------------
Write-Step "3. Detecting GPU Devices and Configuring Hardware Acceleration"

$VideoControllers = Get-CimInstance Win32_VideoController
$GpuNames = $VideoControllers | Select-Object -ExpandProperty Name

Write-Host "Detected Display / Compute Devices:" -ForegroundColor White
foreach ($gpu in $GpuNames) {
    Write-Host ("  -> {0}" -f $gpu) -ForegroundColor Green
}

$HasNvidia = ($GpuNames | Where-Object { $_ -match "NVIDIA|GeForce|RTX|Quadro|Tesla" }) -ne $null
$HasIntel = ($GpuNames | Where-Object { $_ -match "Intel" }) -ne $null
$HasAmd = ($GpuNames | Where-Object { $_ -match "AMD|Radeon" }) -ne $null

# Default Base CMake Arguments
$CmakeArgs = @(
    "-B", "build",
    "-DCMAKE_BUILD_TYPE=Release",
    "-DBUILD_SHARED_LIBS=OFF",
    "-DLLAMA_BUILD_EXAMPLES=ON",
    "-DLLAMA_BUILD_SERVER=ON"
)

# Determine GPU Backend
$SelectedBackend = $DeviceBackend

if ($SelectedBackend -eq "auto") {
    if ($HasNvidia) {
        $SelectedBackend = "cuda"
    } elseif ($HasIntel -or $HasAmd) {
        $SelectedBackend = "vulkan"
    } else {
        $SelectedBackend = "cpu"
    }
}

Write-Info ("Selected acceleration target: {0}" -f $SelectedBackend.ToUpper())

# A. NVIDIA CUDA Backend
if ($SelectedBackend -eq "cuda") {
    Write-Info "Checking for NVIDIA CUDA Toolkit (nvcc)..."
    $HasNvcc = (Get-Command "nvcc" -ErrorAction SilentlyContinue) -ne $null
    $CudaRoot = Join-Path ${env:ProgramFiles} "NVIDIA GPU Computing Toolkit\CUDA"
    if (-not $HasNvcc -and (Test-Path $CudaRoot)) {
        $CudaBin = (Get-ChildItem $CudaRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1)
        if ($CudaBin) {
            $NvccCandidate = Join-Path $CudaBin.FullName "bin\nvcc.exe"
            if (Test-Path $NvccCandidate) {
                $env:Path = (Join-Path $CudaBin.FullName "bin") + ";" + $env:Path
                $HasNvcc = $true
            }
        }
    }

    if (-not $HasNvcc -and -not $SkipPrereqs) {
        Write-Warn "CUDA Toolkit (nvcc) not found. Installing Nvidia.CUDA via winget..."
        try {
            winget install --id Nvidia.CUDA -e --accept-source-agreements --accept-package-agreements --silent
            Refresh-SessionPath
            $HasNvcc = (Get-Command "nvcc" -ErrorAction SilentlyContinue) -ne $null
        } catch {
            Write-Warn ("Could not auto-install CUDA: {0}" -f $_)
        }
    }

    if ($HasNvcc) {
        Write-Success "CUDA Toolkit confirmed. Adding -DGGML_CUDA=ON."
        $CmakeArgs += "-DGGML_CUDA=ON"
    } else {
        Write-Warn "CUDA Toolkit unavailable. Falling back to Vulkan / CPU."
        if ($HasIntel -or $HasAmd -or (Test-Path "C:\Windows\System32\vulkan-1.dll")) {
            $SelectedBackend = "vulkan"
        } else {
            $SelectedBackend = "cpu"
        }
    }
}

# B. Vulkan Acceleration (Intel HD/UHD/Iris/Arc, AMD Radeon, NVIDIA cross-vendor)
if ($SelectedBackend -eq "vulkan") {
    Write-Info "Verifying Vulkan SDK and runtime..."
    $HasVulkanSdk = ($env:VULKAN_SDK -and (Test-Path $env:VULKAN_SDK)) -or (Get-Command "glslc" -ErrorAction SilentlyContinue) -ne $null

    if (-not $HasVulkanSdk -and -not $SkipPrereqs) {
        Write-Info "Vulkan SDK not found. Installing KhronosGroup.VulkanSDK via winget..."
        try {
            winget install --id KhronosGroup.VulkanSDK -e --accept-source-agreements --accept-package-agreements --silent
            Refresh-SessionPath
            if (Test-Path "C:\VulkanSDK") {
                $LatestSdk = Get-ChildItem "C:\VulkanSDK" -Directory | Sort-Object Name -Descending | Select-Object -First 1
                if ($LatestSdk) {
                    $env:VULKAN_SDK = $LatestSdk.FullName
                    $env:Path = (Join-Path $LatestSdk.FullName "bin") + ";" + $env:Path
                    $HasVulkanSdk = $true
                }
            }
        } catch {
            Write-Warn ("Winget Vulkan SDK install warning: {0}" -f $_)
        }
    }

    if ($HasVulkanSdk) {
        Write-Success "Vulkan SDK detected. Enabling -DGGML_VULKAN=ON for GPU offloading."
        $CmakeArgs += "-DGGML_VULKAN=ON"
    } else {
        Write-Warn "Vulkan SDK is not installed or glslc is missing. Building with optimized CPU instructions."
        Write-Info "To enable Vulkan later, install 'KhronosGroup.VulkanSDK' via winget and re-run."
        $SelectedBackend = "cpu"
    }
}

# C. CPU Optimization Fallback
if ($SelectedBackend -eq "cpu") {
    Write-Info "Configuring optimized CPU build (AVX2 / native instructions)."
    $CmakeArgs += "-DGGML_AVX2=ON"
}

if ($CustomCmakeFlags) {
    $CmakeArgs += $CustomCmakeFlags.Split(" ")
}

# -----------------------------------------------------------------------------
# 4. Build llama.cpp
# -----------------------------------------------------------------------------
Write-Step "4. Compiling llama.cpp"

if ($ForceRebuild -and (Test-Path $BuildDir)) {
    Write-Info "Force rebuild requested. Removing previous build directory..."
    Remove-Item -Path $BuildDir -Recurse -Force
}

Push-Location $LlamaDir
try {
    Write-Host ("Running: cmake {0}" -f ($CmakeArgs -join ' ')) -ForegroundColor White
    & cmake @CmakeArgs

    Write-Info "Compiling binaries using available CPU threads (Release mode)..."
    & cmake --build build --config Release -j
    Write-Success "Compilation finished successfully!"
} catch {
    Write-Error ("Build failed: {0}" -f $_)
    Pop-Location
    exit 1
}
Pop-Location

# -----------------------------------------------------------------------------
# 5. Clean up source files and keep ONLY the 'build' folder
# -----------------------------------------------------------------------------
Write-Step "5. Cleaning llama.cpp (Retaining ONLY 'build' directory)"

if (-not (Test-Path $BuildDir)) {
    Write-Error "Build directory does not exist! Aborting cleanup to protect files."
    exit 1
}

$ItemsToDelete = Get-ChildItem -Path $LlamaDir -Force | Where-Object { $_.Name -ne "build" }

foreach ($item in $ItemsToDelete) {
    Write-Host ("  Removing: {0}" -f $item.Name) -ForegroundColor DarkGray
    try {
        # Unset ReadOnly attribute if present (common in .git objects)
        if ($item.PSIsContainer) {
            Get-ChildItem -Path $item.FullName -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
                if ($_.IsReadOnly) { $_.IsReadOnly = $false }
            }
        } elseif ($item.IsReadOnly) {
            $item.IsReadOnly = $false
        }
        Remove-Item -Path $item.FullName -Recurse -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Warn ("Could not remove {0}: {1}" -f $item.Name, $_)
    }
}

Write-Success "All source files and auxiliary directories removed."
Write-Success ("ONLY the 'build' directory is preserved at: {0}" -f $BuildDir)

# Ensure backend/llama.cpp/bin links to backend/llama.cpp/build/bin for direct path access
$BinDir = Join-Path $LlamaDir "bin"
$BuildBinDir = Join-Path $BuildDir "bin"
if ((Test-Path $BuildBinDir) -and (-not (Test-Path $BinDir))) {
    try {
        New-Item -ItemType Junction -Path $BinDir -Target $BuildBinDir -Force -ErrorAction SilentlyContinue | Out-Null
        Write-Info "Created directory link: llama.cpp/bin -> llama.cpp/build/bin"
    } catch {}
}

# -----------------------------------------------------------------------------
# 6. Build Output Verification
# -----------------------------------------------------------------------------
Write-Step "6. Build Output Verification"

$BinCandidates = @(
    (Join-Path $BuildDir "bin\Release"),
    (Join-Path $BuildDir "bin"),
    $BuildDir
)

$FoundBinaries = @()
foreach ($cand in $BinCandidates) {
    if (Test-Path $cand) {
        $exes = Get-ChildItem -Path $cand -Filter "llama-*.exe" -ErrorAction SilentlyContinue
        if ($exes) {
            $FoundBinaries += $exes
        }
    }
}

if ($FoundBinaries) {
    Write-Host ""
    Write-Host "Compiled Executables Ready for Inference:" -ForegroundColor Green
    foreach ($bin in $FoundBinaries) {
        $sizeMB = [math]::Round($bin.Length / 1MB, 2)
        Write-Host ("  - {0} ({1} MB) -> {2}" -f $bin.Name, $sizeMB, $bin.FullName) -ForegroundColor White
    }
} else {
    Write-Warn ("No llama-*.exe binaries found in standard output paths. Check {0}." -f $BuildDir)
}

Write-Step "DONE: llama.cpp build and cleanup completed successfully."
