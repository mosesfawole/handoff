[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$nodeCommand = (Get-Command node -ErrorAction Stop).Source
$npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source

function Invoke-HandoffNpm {
    param([Parameter(Mandatory)][string[]]$NpmArguments)
    & $npmCommand @NpmArguments
    if ($LASTEXITCODE -ne 0) {
        throw "npm $($NpmArguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

Push-Location -LiteralPath $projectDirectory
try {
    $nodeVersion = & $nodeCommand --version
    if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+)\.') {
        throw 'Could not determine the Node.js version.'
    }
    if ([int]$Matches[1] -lt 24) {
        throw 'Handoff requires Node.js 24 or later; Node.js 24 is the verified runtime.'
    }
    if ($Install -or -not (Test-Path -LiteralPath 'node_modules' -PathType Container)) {
        Invoke-HandoffNpm -NpmArguments @('ci')
    }
    if (-not $SkipBuild) {
        Invoke-HandoffNpm -NpmArguments @('run', 'build')
    }
    if (-not (Test-Path -LiteralPath 'dist/index.html' -PathType Leaf)) {
        throw 'No production build found. Run without -SkipBuild first.'
    }
    Write-Host 'Starting Handoff on loopback. The server prints its actual port. Press Ctrl+C to stop.'
    Invoke-HandoffNpm -NpmArguments @('start')
}
finally {
    Pop-Location
}
