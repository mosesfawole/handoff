[CmdletBinding()]
param(
    [switch]$Install,
    [switch]$SkipBrowser
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
    Invoke-HandoffNpm -NpmArguments @('test', '--', '--run')
    Invoke-HandoffNpm -NpmArguments @('run', 'build')
    if ($SkipBrowser) {
        Write-Host 'Unit tests and build passed. Browser verification was explicitly skipped.'
    }
    else {
        Write-Host 'Browser tests use their isolated replay server/database. Install Playwright Chromium or set PLAYWRIGHT_CHROMIUM_EXECUTABLE if needed.'
        # Never reuse an unidentified service on the browser-test port.
        $previousCi = [Environment]::GetEnvironmentVariable('CI', 'Process')
        try {
            $env:CI = 'true'
            Invoke-HandoffNpm -NpmArguments @('run', 'test:e2e')
        }
        finally {
            [Environment]::SetEnvironmentVariable('CI', $previousCi, 'Process')
        }
        Write-Host 'Unit tests, build and browser checks passed.'
    }
}
finally {
    Pop-Location
}
