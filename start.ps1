[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$Root = 'D:\proofchain-phase1-2'
$StatePath = Join-Path $Root '.proofchain-runtime.json'
$TimeoutSeconds = 60

function Write-Info([string]$Message) { Write-Host "[ProofChain] $Message" }
function Write-Failure([string]$Message) { Write-Error "[ProofChain] $Message" }

function Test-Port([int]$Port) {
    try {
        return $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1)
    } catch {
        return $false
    }
}

function Wait-Port([int]$Port, [string]$Service, [int]$Timeout = $TimeoutSeconds) {
    $deadline = (Get-Date).AddSeconds($Timeout)
    do {
        if (Test-Port $Port) { return $true }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)
    Write-Failure "$Service did not become ready on port $Port within $Timeout seconds. Check its terminal window."
    return $false
}

function Wait-Http([string]$Uri, [string]$Service, [int]$Timeout = $TimeoutSeconds) {
    $deadline = (Get-Date).AddSeconds($Timeout)
    do {
        try {
            $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { return $true }
        } catch {}
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)
    Write-Failure "$Service did not respond at $Uri within $Timeout seconds. Check its terminal window."
    return $false
}

function Wait-HardhatRpc([int]$Timeout = $TimeoutSeconds) {
    $deadline = (Get-Date).AddSeconds($Timeout)
    $body = '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
    do {
        try {
            $response = Invoke-RestMethod -Uri 'http://127.0.0.1:8545' -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 3 -ErrorAction Stop
            if ($response.result -eq '0x7a69') { return $true }
        } catch {}
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)
    Write-Failure 'Hardhat RPC did not report chain ID 31337 at 127.0.0.1:8545. Deployment was not attempted.'
    return $false
}

function Assert-Command([string]$Command, [string]$Hint) {
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "$Command was not found on PATH. $Hint"
    }
}

function Start-ServiceWindow([string]$Name, [string]$WorkingDirectory, [string]$Command, [int]$Port) {
    if (Test-Port $Port) {
        Write-Host "[ProofChain] $Name already running on port $Port"
        return $null
    }
    $escapedDirectory = $WorkingDirectory.Replace("'", "''")
    $windowCommand = "Set-Location -LiteralPath '$escapedDirectory'; $Command"
    $process = Start-Process -FilePath 'powershell.exe' -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $windowCommand) -PassThru
    Write-Info "$Name started in the background (PID $($process.Id)); waiting for port $Port..."
    return [pscustomobject]@{ Name = $Name; Port = $Port; Pid = $process.Id }
}

function Invoke-ProjectCommand([string]$WorkingDirectory, [string]$FilePath, [string[]]$Arguments, [string]$FailureMessage) {
    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) { throw "$FailureMessage Exit code: $LASTEXITCODE" }
    } catch {
        throw "$FailureMessage $($_.Exception.Message)"
    } finally {
        Pop-Location
    }
}

function Save-State($State) {
    $State | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $StatePath -Encoding UTF8
}

try {
    Set-Location $Root
    Assert-Command 'node' 'Install Node.js 18+ and reopen PowerShell.'
    Assert-Command 'npm' 'Install Node.js/npm and reopen PowerShell.'
    Assert-Command 'npx' 'Install Node.js/npm and reopen PowerShell.'

    $state = [ordered]@{ root = $Root; startedAt = (Get-Date).ToString('o'); processes = @() }
    Save-State $state

    $mongoPortReady = Test-Port 27017
    $mongoService = Get-Service -Name 'MongoDB' -ErrorAction SilentlyContinue
    if (-not $mongoPortReady) {
        if ($null -eq $mongoService) {
            Write-Failure 'MongoDB Windows service does not exist and port 27017 is not listening. Install MongoDB or start an equivalent MongoDB instance manually.'
        } elseif ($mongoService.Status -ne 'Running') {
            Write-Info 'Starting MongoDB service...'
            try { Start-Service -Name 'MongoDB' -ErrorAction Stop } catch { throw "Could not start MongoDB service. Run PowerShell as Administrator or start MongoDB manually. $($_.Exception.Message)" }
        }
        if (-not (Wait-Port 27017 'MongoDB' 30)) { throw 'MongoDB readiness check failed.' }
        Write-Host '✓ MongoDB ready on port 27017'
    } else { Write-Host '✓ MongoDB already running on port 27017' }

    $hardhat = Start-ServiceWindow 'Blockchain' (Join-Path $Root 'blockchain') 'npx hardhat node' 8545
    if ($null -ne $hardhat) {
        $state.processes += $hardhat
        Save-State $state
        if (-not (Wait-HardhatRpc)) { throw 'Hardhat startup failed.' }
        Write-Host '✓ Blockchain RPC ready on port 8545'
    } else {
        if (-not (Wait-HardhatRpc 10)) { throw 'Port 8545 is occupied, but it is not a ready ProofChain Hardhat RPC.' }
        Write-Host '✓ Blockchain already running on port 8545'
    }

    if (-not (Test-Path (Join-Path $Root 'blockchain\node_modules'))) { throw 'Blockchain npm dependencies are missing. Run npm install in blockchain first.' }
    Write-Info 'Deploying ProofChain contract to localhost...'
    Invoke-ProjectCommand (Join-Path $Root 'blockchain') 'npx.cmd' @('hardhat', 'run', 'scripts/deploy.js', '--network', 'localhost') 'Contract deployment failed.'
    Write-Host '✓ Contract deployed to localhost'

    if (-not (Test-Path (Join-Path $Root 'client\node_modules'))) { throw 'Client npm dependencies are missing. Run npm install in client first.' }
    Invoke-ProjectCommand (Join-Path $Root 'client') 'npm.cmd' @('run', 'sync:contract') 'Client contract synchronization failed.'
    Write-Host '✓ Client contract synchronized'

    $backend = Start-ServiceWindow 'Backend' (Join-Path $Root 'server') 'npm run dev' 5000
    if ($null -ne $backend) { $state.processes += $backend; Save-State $state }
    if (-not (Wait-Port 5000 'Backend')) { throw 'Backend startup failed.' }
    if (-not (Wait-Http 'http://127.0.0.1:5000/health' 'Backend health endpoint')) { throw 'Backend health check failed.' }
    if ($null -eq $backend) { Write-Host '✓ Backend already running on port 5000' } else { Write-Host '✓ Backend ready on port 5000' }

    $python = Join-Path $Root 'ai-service\venv\Scripts\python.exe'
    if (-not (Test-Path $python)) { throw "Python virtual environment is missing: $python. Create it and install ai-service requirements first." }
    if (-not (Test-Path (Join-Path $Root 'ai-service\requirements.txt'))) { throw 'AI service requirements.txt is missing.' }
    $ai = Start-ServiceWindow 'AI service' (Join-Path $Root 'ai-service') 'venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000' 8000
    if ($null -ne $ai) { $state.processes += $ai; Save-State $state }
    if (-not (Wait-Port 8000 'AI service')) { throw 'AI service startup failed.' }
    if (-not (Wait-Http 'http://127.0.0.1:8000/health' 'AI service health endpoint')) { throw 'AI service health check failed.' }
    if ($null -eq $ai) { Write-Host '✓ AI Service already running on port 8000' } else { Write-Host '✓ AI Service ready on port 8000' }

    $frontend = Start-ServiceWindow 'Frontend' (Join-Path $Root 'client') 'npm.cmd run dev -- --host 127.0.0.1' 5173
    if ($null -ne $frontend) { $state.processes += $frontend; Save-State $state }
    if (-not (Wait-Port 5173 'Frontend')) { throw 'Frontend startup failed.' }
    if (-not (Wait-Http 'http://127.0.0.1:5173/' 'Frontend')) { throw 'Frontend readiness check failed.' }
    if ($null -eq $frontend) { Write-Host '✓ Frontend already running on port 5173' } else { Write-Host '✓ Frontend ready on port 5173' }

    Save-State $state
    Write-Host ''
    Write-Host '========================================'
    Write-Host '     ProofChain Development Environment'
    Write-Host '========================================'
    Write-Host ''
    Write-Host '✓ MongoDB       : 27017'
    Write-Host '✓ Blockchain    : 8545'
    Write-Host '✓ Backend       : 5000'
    Write-Host '✓ AI Service    : 8000'
    Write-Host '✓ Frontend      : 5173'
    Write-Host ''
    Write-Host 'Frontend : http://localhost:5173'
    Write-Host 'Backend  : http://localhost:5000'
    Write-Host 'AI       : http://localhost:8000'
    Write-Host ''
    Write-Host '========================================'
    Write-Host "Runtime state: $StatePath"
} catch {
    Write-Failure $_.Exception.Message
    Write-Host 'Startup stopped. Existing services were not killed. Use .\stop-proofchain.ps1 only for launcher-owned windows recorded after a successful startup.' -ForegroundColor Yellow
    exit 1
}
