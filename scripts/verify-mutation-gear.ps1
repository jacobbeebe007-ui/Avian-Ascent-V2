# Quick mutation gear bundle checks (no Node required)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$bundle = Join-Path $Root 'js\avian-game.bundle.js'
$index = Join-Path $Root 'js\data\mutations\index.js'
$failed = 0

function Test-Check([string]$Name, [bool]$Ok) {
    if ($Ok) { Write-Host "[verify] ok   $Name" -ForegroundColor Green }
    else { Write-Host "[verify] FAIL $Name" -ForegroundColor Red; $script:failed++ }
}

$b = [System.IO.File]::ReadAllText($bundle, [Text.Encoding]::UTF8)
$idx = [System.IO.File]::ReadAllText($index, [Text.Encoding]::UTF8)
$mtCount = ([regex]::Matches($b, '"MT\d+"')).Count

Test-Check 'bundle exists' (Test-Path $bundle)
Test-Check 'mutations v4 index' ($idx -match "m\.version='2026\.06-mutations-v4'")
Test-Check 'MT0001 present' ($b.Contains('MT0001'))
Test-Check '400+ MT items in bundle' ($mtCount -ge 400)
Test-Check 'leftWing slot' ($b.Contains('leftWing'))
Test-Check 'rightFoot slot' ($b.Contains('rightFoot'))
Test-Check 'mutationEffects engine' ($b.Contains('mutationEffects'))
Test-Check 'itemAllowedForPlayer' ($b.Contains('itemAllowedForPlayer'))
Test-Check 'orange tier data' ($b.Contains('"tier":"orange"'))
Test-Check 'save schema v8' ($b.Contains('var TARGET = 8'))
Test-Check 'no legacy AA-1-0001' (-not $b.Contains('AA-1-0001'))
Test-Check 'tryMutationOnHitAilments' ($b.Contains('function tryMutationOnHitAilments'))
Test-Check 'getHeavyAccPenaltyReduction' ($b.Contains('getHeavyAccPenaltyReduction'))

Write-Host "[verify] MT id matches: $mtCount"
if ($failed -gt 0) { exit 1 }
Write-Host '[verify] all checks passed'
