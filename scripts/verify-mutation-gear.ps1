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
$mutCount = ([regex]::Matches($b, '"MUT-\d+"')).Count
$mtCount = ([regex]::Matches($b, '"MT\d+"')).Count

Test-Check 'bundle exists' (Test-Path $bundle)
Test-Check 'mutations v5 index' ($idx -match "m\.version='2026\.06-mutations-v5'")
Test-Check 'MUT-0001 present' ($b.Contains('MUT-0001'))
Test-Check '330+ MUT items in bundle' ($mutCount -ge 330)
Test-Check 'orange MT items retained' ($mtCount -ge 20)
Test-Check 'leftWing slot' ($b.Contains('leftWing'))
Test-Check 'rightFoot slot' ($b.Contains('rightFoot'))
Test-Check 'mutationEffects engine' ($b.Contains('mutationEffects'))
Test-Check 'itemAllowedForPlayer' ($b.Contains('itemAllowedForPlayer'))
Test-Check 'orange tier data' ($b.Contains('"tier":"orange"'))
Test-Check 'save schema v9' ($b.Contains('var TARGET = 9'))
Test-Check 'no legacy AA-1-0001' (-not $b.Contains('AA-1-0001'))
Test-Check 'tryMutationOnHitAilments' ($b.Contains('function tryMutationOnHitAilments'))
Test-Check 'getHeavyAccPenaltyReduction' ($b.Contains('getHeavyAccPenaltyReduction'))
Test-Check 'physicalDamageUpPct' ($b.Contains('physicalDamageUpPct'))
Test-Check 'statsPct rollup' ($b.Contains('_mutationStatsPct'))
Test-Check 'Shield Power display label' ($b.Contains('Shield Power'))
Test-Check 'statLine fallback helper' ($b.Contains('formatStatLineFallbackHtml'))

Write-Host "[verify] MUT id matches: $mutCount; MT orange matches: $mtCount"
if ($failed -gt 0) { exit 1 }
Write-Host '[verify] all checks passed'
