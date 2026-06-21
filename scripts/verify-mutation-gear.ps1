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
Test-Check 'no legacy mut_blood_moon' (-not $b.Contains('mut_blood_moon'))
Test-Check 'no ENDLESS_MUTATIONS' (-not $b.Contains('ENDLESS_MUTATIONS'))
Test-Check 'grove goldenGoose outcome' ($b.Contains("'goldenGoose'"))
Test-Check 'grantGroveGearMutation helper' ($b.Contains('function grantGroveGearMutation'))
Test-Check 'rollGroveMutationTier helper' ($b.Contains('function rollGroveMutationTier'))
Test-Check 'getFamilyEvolutionBirdDataStore' ($b.Contains('getFamilyEvolutionBirdDataStore'))
Test-Check 'Shield Power display label' ($b.Contains('Shield Power'))
Test-Check 'statLine fallback helper' ($b.Contains('formatStatLineFallbackHtml'))
Test-Check 'MT0347 in catalog' ($b.Contains('MT0347'))
Test-Check 'mechanics armorPen rollup' ($b.Contains('m.armorPen'))

Write-Host "[verify] MT id matches: $mtCount"
if ($failed -gt 0) { exit 1 }
Write-Host '[verify] all checks passed'
