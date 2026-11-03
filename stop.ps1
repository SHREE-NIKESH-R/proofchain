[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$StatePath = Join-Path $Root '.proofchain-runtime.json'

if (-not (Test-Path $StatePath)) {
    Write-Host '[ProofChain] No launcher state file found. No processes were stopped.'
    exit 0
}

try {
    $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
    foreach ($entry in @($state.processes)) {
        if ($null -eq $entry -or $entry.Pid -le 0) { continue }
        $process = Get-Process -Id ([int]$entry.Pid) -ErrorAction SilentlyContinue
        if ($null -eq $process) {
            Write-Host "[ProofChain] $($entry.Name) launcher PID $($entry.Pid) is already stopped."
            continue
        }
        Write-Host "[ProofChain] Stopping $($entry.Name) launcher tree (PID $($entry.Pid))..."
        & taskkill.exe /PID ([int]$entry.Pid) /T /F | Out-Host
        if ($LASTEXITCODE -ne 0) { Write-Warning "Could not stop $($entry.Name) launcher PID $($entry.Pid). It may have already exited." }
    }
} catch {
    Write-Error "[ProofChain] Could not read or process $StatePath. No broad process-name cleanup was attempted. $($_.Exception.Message)"
    exit 1
} finally {
    Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue
}

Write-Host '[ProofChain] Launcher-owned service windows stopped. MongoDB was left running.'
