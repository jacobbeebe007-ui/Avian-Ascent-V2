# Avian Ascent — Mutation Gear Workbook importer (PowerShell)
# Usage: .\scripts\import-mutation-gear-workbook.ps1 [-Verify]
# Env: AA_MUTATION_GEAR_WORKBOOK (path to xlsx)

param(
    [switch]$Verify,
    [string]$WorkbookPath = $env:AA_MUTATION_GEAR_WORKBOOK
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\import-master-workbook-lib.ps1"

$Root = Split-Path -Parent $PSScriptRoot
$DefaultWorkbook = 'C:\Users\JaK_d\Desktop\Avian Ascent\New Sheets\Main\Master Mutation list Avian_Ascent_Mutation_Gear_Workbook_Expanded.xlsx'
if (-not $WorkbookPath) { $WorkbookPath = $DefaultWorkbook }
if (-not (Test-Path $WorkbookPath)) {
    Write-Error "[mutation-gear] missing: $WorkbookPath"
    exit 1
}

$script:SLOT_MAP = @{
    'Left Wing' = 'leftWing'; 'Right Wing' = 'rightWing'
    'Left Foot' = 'leftFoot'; 'Right Foot' = 'rightFoot'
    'Beak' = 'beak'; 'Syrinx' = 'syrinx'; 'Chest' = 'chest'
    'Plumage' = 'plumage'; 'Eye' = 'eyes'; 'Head' = 'head'; 'Tail' = 'tail'
}

$script:TIER_MAP = @{
    'Grey' = 'white'; 'Green' = 'green'; 'Blue' = 'blue'
    'Purple' = 'purple'; 'Gold' = 'gold'; 'Orange' = 'orange'
}

$script:ITEM_TYPE_MAP = @{
    'Normal' = 'normal'; 'Class Only' = 'classOnly'
    'Set Piece' = 'set'; 'Unique' = 'unique'
}

$script:STAT_MAP = @{
    'HP' = 'maxHp'; 'ATK' = 'atk'; 'MATK' = 'matk'; 'DEF' = 'def'; 'MDEF' = 'mdef'
    'SPD' = 'spd'; 'Accuracy' = 'acc'; 'Dodge' = 'dodge'; 'Crit Chance' = 'critChance'
}

$script:MECH_MAP = @{
    'Crit Damage' = 'critDamageBonusPct'
    'DEF Penetration' = 'armorPen'; 'MDEF Penetration' = 'magicPen'
    'Light Attack' = 'lightAttackDmgPct'; 'Medium Attack' = 'mediumAttackDmgPct'
    'Heavy Attack' = 'heavyAttackDmgPct'
    'Heavy Accuracy Penalty Reduction' = 'heavyAccPenaltyReductionPct'
    'Lifesteal' = 'lifestealPct'; 'Healing Done' = 'healingDonePct'
    'Healing Received' = 'healingReceivedPct'; 'Shield Power' = 'shieldPowerPct'
    'Status Resist' = 'statusResistPct'; 'Ultimate Meter Gain' = 'ultimateMeterGainPct'
}

$script:AILMENT_MAP = @{
    'Poison Chance' = @{ id = 'poison'; school = 'physical' }
    'Burn Chance' = @{ id = 'burning'; school = 'magic' }
    'Chilled Chance' = @{ id = 'chilled'; school = 'magic' }
    'Bleed Chance' = @{ id = 'bleed'; school = 'physical' }
    'Weaken Chance' = @{ id = 'weaken'; school = 'magic' }
    'Paralyse Chance' = @{ id = 'paralyzed'; school = 'physical' }
    'Marked Chance' = @{ id = 'marked'; school = 'magic' }
}

$script:SLOT_ORDER = @(
    'leftWing', 'rightWing', 'leftFoot', 'rightFoot', 'beak', 'syrinx',
    'chest', 'plumage', 'eyes', 'head', 'tail'
)

$script:SLOT_LIMITS = [ordered]@{}
foreach ($s in $script:SLOT_ORDER) { $script:SLOT_LIMITS[$s] = 1 }

$script:TIER_KEYS = @('white', 'green', 'blue', 'purple', 'gold', 'orange')

$script:DROP_WEIGHTS = [ordered]@{
    white = 40; green = 24; blue = 16; purple = 10; gold = 6; orange = 4
}

$script:MUTATIONS_VERSION = '2026.06-mutations-v4'

function Get-SlotKey {
    param([string]$Raw)
    $t = ([string]$Raw).Trim()
    if ($script:SLOT_MAP.ContainsKey($t)) { return $script:SLOT_MAP[$t] }
    return ($t -replace '\s+', '').Substring(0, 1).ToLower() + ($t -replace '\s+', '').Substring(1)
}

function Get-TierKey {
    param([string]$Raw)
    $t = ([string]$Raw).Trim()
    if ($script:TIER_MAP.ContainsKey($t)) { return $script:TIER_MAP[$t] }
    return 'white'
}

function Get-ItemTypeKey {
    param([string]$Raw)
    $t = ([string]$Raw).Trim()
    if ($script:ITEM_TYPE_MAP.ContainsKey($t)) { return $script:ITEM_TYPE_MAP[$t] }
    return 'normal'
}

function Get-ClassRequired {
    param([string]$Raw)
    $t = ([string]$Raw).Trim()
    if (-not $t -or $t -eq 'None') { return $null }
    return Get-ClassId $t
}

function Get-SetName {
    param([string]$Raw)
    $t = ([string]$Raw).Trim()
    if (-not $t -or $t -eq 'None') { return $null }
    return $t
}

function Get-BonusId {
    param([string]$Name)
    if (-not $Name) { return '' }
    return ($Name -replace '[^a-zA-Z0-9]+', '_').Trim('_').ToLower()
}

function Add-AttrToItem {
    param($Item, [string]$AttrName, [string]$ValRaw)
    if (-not $AttrName -or -not $ValRaw) { return }
    $n = [Math]::Round([double](Get-Float $ValRaw), 2)
    if ($n -eq 0) { return }
    if ($script:STAT_MAP.ContainsKey($AttrName)) {
        $k = $script:STAT_MAP[$AttrName]
        $Item.stats[$k] = [Math]::Round((($Item.stats[$k] | ForEach-Object { $_ }) + $n), 2)
        return
    }
    if ($script:MECH_MAP.ContainsKey($AttrName)) {
        $k = $script:MECH_MAP[$AttrName]
        if (-not $Item.mechanics) { $Item.mechanics = [ordered]@{} }
        $Item.mechanics[$k] = [Math]::Round((($Item.mechanics[$k] | ForEach-Object { $_ }) + $n), 2)
        return
    }
    if ($script:AILMENT_MAP.ContainsKey($AttrName)) {
        $info = $script:AILMENT_MAP[$AttrName]
        if (-not $Item.mechanics) { $Item.mechanics = [ordered]@{} }
        if (-not $Item.mechanics.ailmentChances) { $Item.mechanics.ailmentChances = @() }
        $Item.mechanics.ailmentChances += ,@{
            id = $info.id; chance = $n; school = $info.school
        }
    }
}

function Build-StatLine {
    param($Item)
    $parts = @()
    foreach ($k in @($Item.stats.Keys | Sort-Object)) {
        $v = $Item.stats[$k]
        if (-not $v) { continue }
        $label = switch ($k) {
            'maxHp' { 'HP' }; 'atk' { 'ATK' }; 'matk' { 'MATK' }; 'def' { 'DEF' }
            'mdef' { 'MDEF' }; 'spd' { 'SPD' }; 'acc' { 'Accuracy' }; 'dodge' { 'Dodge' }
            'critChance' { 'Crit Chance' }; default { $k }
        }
        $suffix = if ($k -in @('acc', 'dodge', 'critChance')) { '%' } else { '' }
        $parts += "+$v $label$suffix"
    }
    if ($Item.mechanics) {
        foreach ($mk in @($Item.mechanics.Keys | Sort-Object)) {
            if ($mk -eq 'ailmentChances') {
                foreach ($ac in $Item.mechanics.ailmentChances) {
                    $parts += "+$($ac.chance)% $($ac.id) chance"
                }
                continue
            }
            $mv = $Item.mechanics[$mk]
            if (-not $mv) { continue }
            $ml = switch ($mk) {
                'critDamageBonusPct' { 'Crit Damage' }
                'armorPen' { 'DEF Penetration' }; 'magicPen' { 'MDEF Penetration' }
                'lightAttackDmgPct' { 'Light Attack' }; 'mediumAttackDmgPct' { 'Medium Attack' }
                'heavyAttackDmgPct' { 'Heavy Attack' }
                'heavyAccPenaltyReductionPct' { 'Heavy ACC Penalty Reduction' }
                'lifestealPct' { 'Lifesteal' }; 'healingDonePct' { 'Healing Done' }
                'healingReceivedPct' { 'Healing Received' }; 'shieldPowerPct' { 'Shield Power' }
                'statusResistPct' { 'Status Resist' }; 'ultimateMeterGainPct' { 'Ultimate Meter Gain' }
                default { $mk }
            }
            $parts += "+$mv% $ml"
        }
    }
    if ($Item.bonuses -and $Item.bonuses.Count) {
        foreach ($b in $Item.bonuses) {
            $bv = if ($b.value) { " ($($b.value))" } else { '' }
            $parts += $b.name + $bv
        }
    }
    return ($parts -join '; ')
}

function Parse-CatalogRow {
    param($Row, $Header)
    $id = Get-CellFuzzy $Row $Header @('ID')
    if (-not $id -or $id -match '^ID$') { return $null }
    $slot = Get-SlotKey (Get-CellFuzzy $Row $Header @('Slot'))
    $tier = Get-TierKey (Get-CellFuzzy $Row $Header @('Rarity'))
    $item = [ordered]@{
        id = $id
        tier = $tier
        name = Get-CellFuzzy $Row $Header @('Mutation Name')
        slot = $slot
        slotLimit = 1
        itemType = Get-ItemTypeKey (Get-CellFuzzy $Row $Header @('Item Type'))
        classRequired = Get-ClassRequired (Get-CellFuzzy $Row $Header @('Class Required'))
        setName = Get-SetName (Get-CellFuzzy $Row $Header @('Set Name'))
        stats = [ordered]@{}
        bonuses = @()
    }
    for ($ai = 1; $ai -le 4; $ai++) {
        Add-AttrToItem $item (Get-CellFuzzy $Row $Header @("Attr $ai")) (Get-CellFuzzy $Row $Header @("Val $ai"))
    }
    for ($bi = 1; $bi -le 2; $bi++) {
        $bName = Get-CellFuzzy $Row $Header @("Bonus $bi")
        if (-not $bName) { continue }
        $bVal = Get-Num (Get-CellFuzzy $Row $Header @("Bonus Val $bi"))
        $item.bonuses += ,@{
            id = Get-BonusId $bName
            name = $bName
            value = $bVal
        }
    }
    if ($item.stats.Count -eq 0) { $item.stats = [ordered]@{} }
    if ($item.mechanics -and $item.mechanics.Count -eq 0) { $item.Remove('mechanics') }
    if ($item.bonuses.Count -eq 0) { $item.Remove('bonuses') }
    $item.statLine = Build-StatLine $item
    return $item
}

function Write-MutationDataFile {
    param([string]$Path, [string]$Header, [string]$VarName, $Payload)
    $json = ConvertTo-JsString $Payload
    $body = @"
$Header
(function(){'use strict';
globalThis.Avian||(globalThis.Avian={});Avian.data=Avian.data||Object.create(null);Avian.data.mutations=Avian.data.mutations||Object.create(null);Avian.data.mutations.$VarName=Object.freeze($json);
})();
"@
    $dir = Split-Path $Path -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText($Path, $body, [Text.Encoding]::UTF8)
}

Write-Host "[mutation-gear] reading: $WorkbookPath"
$ctx = Open-MasterWorkbook $WorkbookPath
try {
    $catalogRows = Get-SheetRowsFromCtx $ctx 'Mutation Catalog'
    $setRows = Get-SheetRowsFromCtx $ctx 'Set Bonuses'
    $bonusRows = Get-SheetRowsFromCtx $ctx 'Bonus Library'

    $catLayout = Get-SheetLayout 'Mutation Catalog' $catalogRows @('ID', 'Mutation Name', 'Slot')
    $setLayout = Get-SheetLayout 'Set Bonuses' $setRows @('Set Name')
    $bonusLayout = Get-SheetLayout 'Bonus Library' $bonusRows @('Bonus')

    $byTier = [ordered]@{}
    foreach ($t in $script:TIER_KEYS) { $byTier[$t] = [ordered]@{} }
    $byId = [ordered]@{}
    $count = 0

    for ($i = $catLayout.dataStart; $i -lt $catalogRows.Count; $i++) {
        $item = Parse-CatalogRow $catalogRows[$i] $catLayout.header
        if (-not $item) { continue }
        $byId[$item.id] = $item
        $byTier[$item.tier][$item.id] = $item
        $count++
    }

    # Set bonuses catalog
    $sets = [ordered]@{}
    for ($i = $setLayout.dataStart; $i -lt $setRows.Count; $i++) {
        $row = $setRows[$i]
        $setName = Get-CellFuzzy $row $setLayout.header @('Set Name')
        if (-not $setName -or $setName -eq 'Set Name') { continue }
        $setId = ($setName -replace '[^a-zA-Z0-9]+', '_').Trim('_').ToLower()
        $classesRaw = Get-CellFuzzy $row $setLayout.header @('Recommended Classes')
        $classes = @()
        if ($classesRaw -and $classesRaw -ne 'Any') {
            foreach ($part in ($classesRaw -split '[,/]')) {
                $cid = Get-ClassId $part.Trim()
                if ($cid -and ($classes -notcontains $cid)) { $classes += $cid }
            }
        }
        $sets[$setId] = [ordered]@{
            id = $setId
            name = $setName
            theme = Get-CellFuzzy $row $setLayout.header @('Theme')
            piece2 = Get-CellFuzzy $row $setLayout.header @('2-Piece Bonus')
            piece4 = Get-CellFuzzy $row $setLayout.header @('4-Piece Bonus')
            piece6 = Get-CellFuzzy $row $setLayout.header @('6-Piece Bonus')
            recommendedClasses = $classes
            notes = Get-CellFuzzy $row $setLayout.header @('Notes')
        }
    }

    # Bonus library (for effects engine reference)
    $bonusLib = [ordered]@{}
    for ($i = $bonusLayout.dataStart; $i -lt $bonusRows.Count; $i++) {
        $row = $bonusRows[$i]
        $bName = Get-CellFuzzy $row $bonusLayout.header @('Bonus')
        if (-not $bName -or $bName -eq 'Bonus') { continue }
        $bid = Get-BonusId $bName
        $allowedRaw = Get-CellFuzzy $row $bonusLayout.header @('Allowed Class')
        $allowed = @()
        if ($allowedRaw -and $allowedRaw -ne 'Any') {
            foreach ($part in ($allowedRaw -split '[,/]')) {
                $cid = Get-ClassId $part.Trim()
                if ($cid -and ($allowed -notcontains $cid)) { $allowed += $cid }
            }
        }
        $bonusLib[$bid] = [ordered]@{
            id = $bid
            name = $bName
            category = Get-CellFuzzy $row $bonusLayout.header @('Category')
            baseCost = Get-Num (Get-CellFuzzy $row $bonusLayout.header @('Base Cost'))
            minRarity = Get-TierKey (Get-CellFuzzy $row $bonusLayout.header @('Minimum Rarity'))
            allowedClasses = $allowed
            notes = Get-CellFuzzy $row $bonusLayout.header @('Notes')
        }
    }

    $outDir = Join-Path $Root 'js\data\mutations'

    Write-MutationDataFile (Join-Path $outDir 'slots.js') '/* GENERATED slots — mutation gear workbook */' 'slots' ([ordered]@{
        limits = $script:SLOT_LIMITS
        order = $script:SLOT_ORDER
    })

    foreach ($tier in $script:TIER_KEYS) {
        $n = $byTier[$tier].Count
        Write-MutationDataFile (Join-Path $outDir "items-$tier.js") "/* GENERATED items-$tier — $n items */" "items_$tier" $byTier[$tier]
        Write-Host "[mutation-gear] $tier`: $n items"
    }

    Write-MutationDataFile (Join-Path $outDir 'sets.js') '/* GENERATED set bonuses */' 'sets' $sets
    Write-MutationDataFile (Join-Path $outDir 'bonus-library.js') '/* GENERATED bonus library */' 'bonusLibrary' $bonusLib

    # index.js
    $indexBody = @"
/* Avian Ascent — index.js
 * Mutations catalog index — byId lookup and drop weights.
 * Generated by scripts/import-mutation-gear-workbook.ps1 — do not edit by hand.
 */
(function(){'use strict';
var Avian=globalThis.Avian||(globalThis.Avian={});Avian.data=Avian.data||Object.create(null);
var m=Avian.data.mutations=Avian.data.mutations||Object.create(null);
var byId=Object.create(null);
"@
    foreach ($tier in $script:TIER_KEYS) {
        $indexBody += "if(m.items_$tier){for(var k in m.items_$tier)byId[k]=m.items_$tier[k];}`n"
    }
    $dwJson = ConvertTo-JsString $script:DROP_WEIGHTS
    $indexBody += @"
m.byId=Object.freeze(byId);
m.dropWeights=Object.freeze($dwJson);
m.version='$($script:MUTATIONS_VERSION)';
})();
"@
    [System.IO.File]::WriteAllText((Join-Path $outDir 'index.js'), $indexBody, [Text.Encoding]::UTF8)

    Write-Host "[mutation-gear] total items: $count"
    Write-Host "[mutation-gear] sets: $($sets.Count)"
    Write-Host "[mutation-gear] bonus library: $($bonusLib.Count)"

    if ($Verify) {
        $fail = ($count -lt 400) -or ($sets.Count -lt 8)
        if ($fail) {
            Write-Host "[mutation-gear] VERIFY FAIL count=$count sets=$($sets.Count)"
            exit 2
        }
        Write-Host "[mutation-gear] VERIFY OK"
    }
}
finally {
    Close-MasterWorkbook $ctx
}
