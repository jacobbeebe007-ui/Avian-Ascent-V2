# Avian Ascent — Master Workbook importer (PowerShell)
# Usage: .\scripts\import-master-workbook.ps1 [-Verify] [-InspectHeaders]

param(
    [switch]$Verify,
    [switch]$InspectHeaders,
    [string]$WorkbookPath = $env:AA_MASTER_WORKBOOK
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\import-master-workbook-lib.ps1"

$Root = Split-Path -Parent $PSScriptRoot
if (-not $WorkbookPath) { $WorkbookPath = $script:MasterWorkbookDefault }
if (-not (Test-Path $WorkbookPath)) {
    Write-Error "[master-workbook] missing: $WorkbookPath"
    exit 1
}

Write-Host "[master-workbook] reading: $WorkbookPath"
$ctx = Open-MasterWorkbook $WorkbookPath
try {
    $sheets = @{}
    foreach ($name in $ctx.NameToFile.Keys) {
        $sheets[$name] = Get-SheetRowsFromCtx $ctx $name
    }

    if ($InspectHeaders) {
        foreach ($name in ($sheets.Keys | Sort-Object)) {
            $rows = $sheets[$name]
            $layout = Get-SheetLayout $name $rows @('Bird Name','Enemy ID','Class','Ability Name') 0 1
            Write-Host "`n=== $name rows=$($rows.Count) dataStart=$($layout.dataStart) ==="
            Write-Host (($layout.header.Keys | Select-Object -First 18) -join ' | ')
        }
        exit 0
    }

    # --- Birds ---
    $birdRows = $sheets['Player Bird Stats']
    $birdLayout = Get-SheetLayout 'Player Bird Stats' $birdRows @('Bird Name','Final HP')
    $birds = [ordered]@{}
    $passiveIdx = 1
    for ($i = $birdLayout.dataStart; $i -lt $birdRows.Count; $i++) {
        $row = $birdRows[$i]
        $name = Get-CellFuzzy $row $birdLayout.header @('Bird Name')
        if (-not $name -or $name -match '^bird name') { continue }
        $key = Get-BirdKey $name
        if (-not $key) { continue }
        $hp = Get-Num (Get-CellFuzzy $row $birdLayout.header @('Final HP'))
        if ($hp -le 0) { continue }
        $cls = Get-ClassId (Get-CellFuzzy $row $birdLayout.header @('Class'))
        $sz = Get-SizeId (Get-CellFuzzy $row $birdLayout.header @('Real Size Tier','Size'))
        $aspect = Get-AspectId (Get-CellFuzzy $row $birdLayout.header @('Primary Aspect'))
        $aspectTheme = Get-CellFuzzy $row $birdLayout.header @('Aspect Theme')
        $passiveName = Get-CellFuzzy $row $birdLayout.header @('Passive Name')
        $passiveSummary = Get-CellFuzzy $row $birdLayout.header @('Passive Summary')
        $classPerk = Get-CellFuzzy $row $birdLayout.header @('Class Perk')
        $classPerkSummary = Get-CellFuzzy $row $birdLayout.header @('Class Perk Summary')
        $passiveId = 'PAS-' + ('{0:D3}' -f $passiveIdx++)
        $preserve = if ($script:BIRD_PRESERVE.ContainsKey($key)) { $script:BIRD_PRESERVE[$key] } else { @{} }
        $entry = [ordered]@{
            name = $name
            portraitKey = $key
            size = $sz
            class = $cls
            aspect = $aspect
            aspectTheme = $aspectTheme
            stats = [ordered]@{
                hp = $hp; maxHp = $hp
                atk = Get-Num (Get-CellFuzzy $row $birdLayout.header @('Final ATK'))
                def = Get-Num (Get-CellFuzzy $row $birdLayout.header @('Final DEF'))
                spd = Get-Num (Get-CellFuzzy $row $birdLayout.header @('Final SPD'))
                dodge = Get-Num (Get-CellFuzzy $row $birdLayout.header @('Final Dodge'))
                acc = Get-Num (Get-CellFuzzy $row $birdLayout.header @('Final ACC'))
                mdef = Get-Num (Get-CellFuzzy $row $birdLayout.header @('Final MDEF'))
                matk = Get-Num (Get-CellFuzzy $row $birdLayout.header @('Final MATK'))
                critChance = 8
            }
            passive = [ordered]@{ id = $passiveId; name = $passiveName; desc = $passiveSummary }
            classPerk = $classPerk
            classPerkEffect = $classPerkSummary
        }
        foreach ($pk in @('tagline','color','unlockRequires','unlockHint','abilityPool')) {
            if ($preserve.ContainsKey($pk)) { $entry[$pk] = $preserve[$pk] }
        }
        $birds[$key] = $entry
    }

    # --- Classes ---
    $classRows = $sheets['Class Templates']
    $classLayout = Get-SheetLayout 'Class Templates' $classRows @('Class','Base HP')
    $classes = [ordered]@{}
    for ($i = $classLayout.dataStart; $i -lt $classRows.Count; $i++) {
        $row = $classRows[$i]
        $clsName = Get-Cell $row $classLayout.header 'Class'
        if (-not $clsName -or $clsName -eq 'Class') { continue }
        $id = Get-ClassId $clsName
        $classes[$id] = [ordered]@{
            id = $id
            name = $clsName
            coreIdentity = Get-CellFuzzy $row $classLayout.header @('Core Role','Core Identity')
            damageStyle = Get-CellFuzzy $row $classLayout.header @('Major Strengths','Damage Style')
            mainAilment = Get-CellFuzzy $row $classLayout.header @('Signature Rule','Main Ailment')
            defensiveAngle = Get-CellFuzzy $row $classLayout.header @('True Weaknesses','Defensive Angle')
            statHooks = Get-CellFuzzy $row $classLayout.header @('Balance Lock','Best Stat Hooks')
            balanceCaution = Get-CellFuzzy $row $classLayout.header @('Balance Lock')
            classPerk = Get-CellFuzzy $row $classLayout.header @('Class Perk')
            classPerkEffect = Get-CellFuzzy $row $classLayout.header @('Always Active Effect','Perk Clause','Class Perk Effect')
            baseStats = [ordered]@{
                hp = Get-Num (Get-CellFuzzy $row $classLayout.header @('Base HP'))
                atk = Get-Num (Get-CellFuzzy $row $classLayout.header @('Base ATK'))
                def = Get-Num (Get-CellFuzzy $row $classLayout.header @('Base DEF'))
                spd = Get-Num (Get-CellFuzzy $row $classLayout.header @('Base SPD','Base Speed'))
                dodge = Get-Num (Get-CellFuzzy $row $classLayout.header @('Base Dodge'))
                acc = Get-Num (Get-CellFuzzy $row $classLayout.header @('Base ACC','Base Accuracy'))
                mdef = Get-Num (Get-CellFuzzy $row $classLayout.header @('Base MDEF'))
                matk = Get-Num (Get-CellFuzzy $row $classLayout.header @('Base MATK'))
            }
        }
    }

    # --- Size chart ---
    $sizeRows = $sheets['Size Chart']
    $sizeLayout = Get-SheetLayout 'Size Chart' $sizeRows @('Real Size Tier')
    $sizeChart = [ordered]@{}
    for ($i = $sizeLayout.dataStart; $i -lt $sizeRows.Count; $i++) {
        $row = $sizeRows[$i]
        $tier = Get-Cell $row $sizeLayout.header 'Real Size Tier'
        if (-not $tier) { continue }
        $sizeChart[$tier] = [ordered]@{
            tier = $tier
            runtimeSize = Get-SizeId $tier
            hpMod = Get-Num (Get-CellFuzzy $row $sizeLayout.header @('HP Mod'))
            defMod = Get-Num (Get-CellFuzzy $row $sizeLayout.header @('DEF Mod'))
            spdMod = Get-Num (Get-CellFuzzy $row $sizeLayout.header @('SPD Mod'))
            dodgeMod = Get-Num (Get-CellFuzzy $row $sizeLayout.header @('Dodge Mod'))
            accMod = Get-Num (Get-CellFuzzy $row $sizeLayout.header @('ACC Mod'))
            hpSoftCap = Get-Num (Get-CellFuzzy $row $sizeLayout.header @('HP Soft Cap'))
        }
    }

    # --- Passives ---
    $passiveRows = $sheets['Passives & Perks']
    $passiveLayout = Get-SheetLayout 'Passives & Perks' $passiveRows @('Bird Name','Passive Name')
    $birdPassives = [ordered]@{}
    for ($i = $passiveLayout.dataStart; $i -lt $passiveRows.Count; $i++) {
        $row = $passiveRows[$i]
        $name = Get-CellFuzzy $row $passiveLayout.header @('Bird Name')
        if (-not $name) { continue }
        $key = Get-BirdKey $name
        $bird = $birds[$key]
        if (-not $bird) { continue }
        $passiveIdKey = $bird.passive.id
        $effect = Get-CellFuzzy $row $passiveLayout.header @('Simple Passive Effect','Passive Summary')
        if (-not $effect) { $effect = $bird.passive.desc }
        $birdPassives[$passiveIdKey] = [ordered]@{
            id = $passiveIdKey
            birdKey = $key
            birdName = $name
            class = $bird.class
            aspect = $bird.aspect
            name = (Get-CellFuzzy $row $passiveLayout.header @('Passive Name'))
            type = (Get-CellFuzzy $row $passiveLayout.header @('Benefit Type'))
            target = 'self'
            trigger = Get-CellFuzzy $row $passiveLayout.header @('Trigger / Timing','Trigger')
            effect = $effect
            numerical = $effect
            synergy = Get-CellFuzzy $row $passiveLayout.header @('Ability Alignment Notes','Balance Note')
            inspiration = ''
            balanceNote = Get-CellFuzzy $row $passiveLayout.header @('Balance Note','Timing')
            tags = @($bird.class, $bird.aspect) | Where-Object { $_ }
            classPerk = Get-CellFuzzy $row $passiveLayout.header @('Class Perk')
            classPerkEffect = Get-CellFuzzy $row $passiveLayout.header @('Class Perk Effect') 
            overflowRules = Get-CellFuzzy $row $passiveLayout.header @('Overflow Effect','Overflow')
        }
    }

    # --- Mother Goose tiers ---
    $mgRows = $sheets['Mother Goose Tiers']
    $mgLayout = Get-SheetLayout 'Mother Goose Tiers' $mgRows @('Bird Name','Mother Goose Species Tier')
    $byBirdKey = [ordered]@{}
    $tierOrder = @('grey','green','blue','purple','gold','orange')
    foreach ($t in $tierOrder) { $byBirdKey["tier_$t"] = @() }
    for ($i = $mgLayout.dataStart; $i -lt $mgRows.Count; $i++) {
        $row = $mgRows[$i]
        $name = Get-CellFuzzy $row $mgLayout.header @('Bird Name')
        if (-not $name) { continue }
        $key = Get-BirdKey $name
        $tierRaw = Get-CellFuzzy $row $mgLayout.header @('Mother Goose Species Tier')
        $speciesTier = ($tierRaw -replace '\s+','').ToLower()
        $eggGuidance = Get-CellFuzzy $row $mgLayout.header @('Egg Pool Guidance')
        $eggPools = @()
        if ($eggGuidance -match 'cracked') { $eggPools += 'cracked' }
        if ($eggGuidance -match 'feathered') { $eggPools += 'feathered' }
        if ($eggGuidance -match 'gleaming') { $eggPools += 'gleaming' }
        if ($eggGuidance -match 'royal') { $eggPools += 'royal' }
        if ($eggGuidance -match 'ancestral') { $eggPools += 'ancestral' }
        if ($eggPools.Count -eq 0 -and $speciesTier -eq 'orange') { $eggPools = @('ancestral') }
        if ($eggPools.Count -eq 0 -and $speciesTier -eq 'gold') { $eggPools = @('royal') }
        $starter = (Get-CellFuzzy $row $mgLayout.header @('Starter Bird?')) -match 'yes|true|1'
        $byBirdKey[$key] = [ordered]@{
            birdName = $name
            speciesTier = $speciesTier
            ownedCardStartingTier = ($speciesTier)
            class = Get-ClassId (Get-CellFuzzy $row $mgLayout.header @('Class'))
            aspect = Get-AspectId (Get-CellFuzzy $row $mgLayout.header @('Primary Aspect'))
            eggPools = $eggPools
            starterBird = $starter
            tierStatMultiplierWhenMutated = Get-Float (Get-CellFuzzy $row $mgLayout.header @('Tier Stat Multiplier When Mutated'))
        }
    }
    $motherGoose = [ordered]@{ byBirdKey = $byBirdKey }

    # --- Title pools ---
    $titleRows = $sheets['Bird Enemy Title Pools']
    $titleLayout = Get-SheetLayout 'Bird Enemy Title Pools' $titleRows @('Base Bird','Boss Title')
    $titlePools = [ordered]@{}
    for ($i = $titleLayout.dataStart; $i -lt $titleRows.Count; $i++) {
        $row = $titleRows[$i]
        $base = Get-CellFuzzy $row $titleLayout.header @('Base Bird')
        if (-not $base) { continue }
        $key = Get-BirdKey $base
        $titlePools[$key] = [ordered]@{
            birdKey = $key
            birdName = $base
            class = Get-ClassId (Get-CellFuzzy $row $titleLayout.header @('Class'))
            aspect = Get-AspectId (Get-CellFuzzy $row $titleLayout.header @('Primary Aspect'))
            rank1Title = Get-CellFuzzy $row $titleLayout.header @('Rank 1 Title')
            rank2Title = Get-CellFuzzy $row $titleLayout.header @('Rank 2 Title')
            rank3Title = Get-CellFuzzy $row $titleLayout.header @('Rank 3 Title')
            bossTitle = Get-CellFuzzy $row $titleLayout.header @('Boss Title')
            bossExtraStats = Get-CellFuzzy $row $titleLayout.header @('Boss Extra Stat Identity')
            bossMechanic = Get-CellFuzzy $row $titleLayout.header @('Boss Mechanic Summary')
        }
    }

    # --- Enemy roster ---
    $enemyRows = $sheets['Enemy Birds']
    $enemyLayout = Get-SheetLayout 'Enemy Birds' $enemyRows @('Enemy ID','Base Bird')
    $byId = [ordered]@{}
    $byBirdLevel = [ordered]@{}
    $bossesByBirdLevel = [ordered]@{}
    $normalByLevel = [ordered]@{}
    $bossesByLevel = [ordered]@{}
    $enemyCount = 0
    for ($i = $enemyLayout.dataStart; $i -lt $enemyRows.Count; $i++) {
        $row = $enemyRows[$i]
        $id = Get-CellFuzzy $row $enemyLayout.header @('Enemy ID')
        if (-not $id -or $id -match '^enemy id') { continue }
        $baseBird = Get-CellFuzzy $row $enemyLayout.header @('Base Bird')
        $bk = Get-BirdKey $baseBird
        $encType = (Get-CellFuzzy $row $enemyLayout.header @('Encounter Type')).ToLower()
        $isBoss = ($encType -eq 'boss') -or $id.StartsWith('BO-')
        $level = Get-Num (Get-CellFuzzy $row $enemyLayout.header @('Level'))
        if (-not $bk -or $level -le 0) { continue }
        $hp = Get-Num (Get-CellFuzzy $row $enemyLayout.header @('Enemy HP'))
        $entry = [ordered]@{
            id = $id
            birdKey = $bk
            name = (Get-CellFuzzy $row $enemyLayout.header @('Enemy Name'))
            fantasyTitle = Get-CellFuzzy $row $enemyLayout.header @('Fantasy Title')
            enemyVariant = Get-CellFuzzy $row $enemyLayout.header @('Enemy Variant')
            encounterType = if ($isBoss) { 'Boss' } else { 'Normal' }
            isBoss = $isBoss
            storyLevel = $level
            class = Get-ClassId (Get-CellFuzzy $row $enemyLayout.header @('Class'))
            aspect = Get-AspectId (Get-CellFuzzy $row $enemyLayout.header @('Primary Aspect'))
            size = Get-SizeId (Get-CellFuzzy $row $enemyLayout.header @('Real Size Tier','Size Tier'))
            stats = [ordered]@{
                hp = $hp; maxHp = $hp
                atk = Get-Num (Get-CellFuzzy $row $enemyLayout.header @('Enemy Attack','Enemy ATK'))
                def = Get-Num (Get-CellFuzzy $row $enemyLayout.header @('Enemy Defence','Enemy DEF'))
                spd = Get-Num (Get-CellFuzzy $row $enemyLayout.header @('Enemy Speed','Enemy SPD'))
                dodge = Get-Num (Get-CellFuzzy $row $enemyLayout.header @('Enemy Dodge'))
                acc = Get-Num (Get-CellFuzzy $row $enemyLayout.header @('Enemy Accuracy','Enemy ACC'))
                mdef = Get-Num (Get-CellFuzzy $row $enemyLayout.header @('Enemy Magic Defence','Enemy MDEF'))
                matk = Get-Num (Get-CellFuzzy $row $enemyLayout.header @('Enemy Magic Attack','Enemy MATK'))
                critChance = 5
                critMult = 1.5
            }
            aiProfile = Get-CellFuzzy $row $enemyLayout.header @('AI Profile')
            aiPriority = Get-CellFuzzy $row $enemyLayout.header @('AI Priority')
            healingRule = Get-CellFuzzy $row $enemyLayout.header @('Healing Rule')
            defenceRule = Get-CellFuzzy $row $enemyLayout.header @('Defence Rule')
            attackRule = Get-CellFuzzy $row $enemyLayout.header @('Attack Rule')
            abilityBias = Get-CellFuzzy $row $enemyLayout.header @('Ability Bias')
            aiStyle = Get-AiStyleFromProfile (Get-CellFuzzy $row $enemyLayout.header @('AI Profile'))
            bossMechanic = Get-CellFuzzy $row $enemyLayout.header @('Boss Mechanic')
            suggestedAbilityPack = Get-CellFuzzy $row $enemyLayout.header @('Suggested Ability Pack')
            lootShiny = Get-Num (Get-CellFuzzy $row $enemyLayout.header @('Loot Shiny'))
            xpWeight = Get-Num (Get-CellFuzzy $row $enemyLayout.header @('XP Weight'))
            threatScore = Get-Num (Get-CellFuzzy $row $enemyLayout.header @('Threat Score'))
            spawnRole = Get-CellFuzzy $row $enemyLayout.header @('Spawn Role')
        }
        $byId[$id] = $entry
        if (-not $byBirdLevel.Contains($bk)) { $byBirdLevel[$bk] = [ordered]@{} }
        if (-not $byBirdLevel[$bk].Contains("$level")) { $byBirdLevel[$bk]["$level"] = @() }
        $byBirdLevel[$bk]["$level"] = @($byBirdLevel[$bk]["$level"]) + @($id)
        if ($isBoss) {
            if (-not $bossesByBirdLevel.Contains($bk)) { $bossesByBirdLevel[$bk] = [ordered]@{} }
            if (-not $bossesByBirdLevel[$bk].Contains("$level")) { $bossesByBirdLevel[$bk]["$level"] = @() }
            $bossesByBirdLevel[$bk]["$level"] = @($bossesByBirdLevel[$bk]["$level"]) + @($id)
            if (-not $bossesByLevel.Contains("$level")) { $bossesByLevel["$level"] = @() }
            $bossesByLevel["$level"] = @($bossesByLevel["$level"]) + @($id)
        } else {
            if (-not $normalByLevel.Contains("$level")) { $normalByLevel["$level"] = @() }
            $normalByLevel["$level"] = @($normalByLevel["$level"]) + @($id)
        }
        $enemyCount++
    }
    $enemyRoster = [ordered]@{
        byId = $byId
        byBirdLevel = $byBirdLevel
        bossesByBirdLevel = $bossesByBirdLevel
        normalByLevel = $normalByLevel
        bossesByLevel = $bossesByLevel
    }

    # --- Abilities: families + skill trees + bird kits ---
    $mutRows = $sheets['Ability Mutation Trees']
    $mutLayout = Get-SheetLayout 'Ability Mutation Trees' $mutRows @('Family ID','Mutation Stage')
    $ablRows = $sheets['Bird Ability List']
    $ablLayout = Get-SheetLayout 'Bird Ability List' $ablRows @('Bird','Ability Name')

    $families = [ordered]@{}
    $skillTrees = [ordered]@{}
    $birdKits = [ordered]@{}

    $stageBranchLevel = @{ 1 = @{ branch='base'; level=1 }; 2 = @{ branch='power'; level=3 }; 3 = @{ branch='power'; level=6 } }

    for ($i = $mutLayout.dataStart; $i -lt $mutRows.Count; $i++) {
        $row = $mutRows[$i]
        $famId = Get-CellFuzzy $row $mutLayout.header @('Family ID')
        if (-not $famId) { continue }
        $stage = Get-Num (Get-CellFuzzy $row $mutLayout.header @('Mutation Stage'))
        if ($stage -le 0) { $stage = 1 }
        $slotNum = Get-Num (Get-CellFuzzy $row $mutLayout.header @('Ability Slot'))
        $birdName = Get-CellFuzzy $row $mutLayout.header @('Bird')
        $birdKey = Get-BirdKey $birdName
        $map = $stageBranchLevel[$stage]
        if (-not $map) { $map = @{ branch='power'; level=9 } }
        $abId = "$famId`_S$stage"
        $entry = Build-AbilityRowEntry $row $mutLayout.header $abId $famId $map.branch $map.level 'bird'
        $skillTrees[$abId] = $entry
        if (-not $families.Contains($famId)) {
            $kind = if ($slotNum -in 1,2) { 'starter' } else { 'unlock' }
            $families[$famId] = [ordered]@{
                id = $famId
                kind = $kind
                birdKey = $birdKey
                birdName = $birdName
                class = Get-ClassId (Get-CellFuzzy $row $mutLayout.header @('Class'))
                aspect = Get-AspectId (Get-CellFuzzy $row $mutLayout.header @('Aspect'))
                starterSlot = if ($slotNum -in 1,2) { $slotNum - 1 } else { $null }
                abilitySlot = if ($slotNum -gt 0) { $slotNum - 1 } else { $null }
                name = Get-CellFuzzy $row $mutLayout.header @('Ability Family','Ability Name')
                type = Get-CellFuzzy $row $mutLayout.header @('Damage Type')
                damageStyle = Get-CellFuzzy $row $mutLayout.header @('Role')
                scaleStat = (Get-CellFuzzy $row $mutLayout.header @('Scaling Stat')).ToUpper()
                defaultAilment = Get-NormalizedAilment (Get-CellFuzzy $row $mutLayout.header @('Ailment / Rider'))
                inspiration = ''
                role = Get-CellFuzzy $row $mutLayout.header @('Role')
                notes = Get-CellFuzzy $row $mutLayout.header @('Mutation Improvement')
                maxTier = 3
                unlockTier = Get-CellFuzzy $row $mutLayout.header @('Unlock Tier')
            }
        }
    }

    # Bird kits from ability list (starters)
    $kitStarters = [ordered]@{}
    for ($i = $ablLayout.dataStart; $i -lt $ablRows.Count; $i++) {
        $row = $ablRows[$i]
        $birdName = Get-CellFuzzy $row $ablLayout.header @('Bird')
        $key = Get-BirdKey $birdName
        if (-not $key) { continue }
        $role = Get-CellFuzzy $row $ablLayout.header @('Role')
        $slotNum = Get-Num (Get-CellFuzzy $row $ablLayout.header @('Ability Slot'))
        if ($slotNum -notin 1,2) { continue }
        if (-not $kitStarters.Contains($key)) { $kitStarters[$key] = @() }
        $kitStarters[$key] += ,@{
            slot = $slotNum - 1
            name = Get-CellFuzzy $row $ablLayout.header @('Ability Name')
            type = Get-CellFuzzy $row $ablLayout.header @('Damage Type')
            apCost = Get-Num (Get-CellFuzzy $row $ablLayout.header @('EN Cost'))
            formula = "Ability Power $(Get-Float (Get-CellFuzzy $row $ablLayout.header @('Ability Power'))) Uses $(Get-CellFuzzy $row $ablLayout.header @('Scaling Stat'))"
            pierce = 'None'
            ailment = Get-CellFuzzy $row $ablLayout.header @('Ailment / Rider')
            ailmentChance = Get-Num (Get-CellFuzzy $row $ablLayout.header @('Ailment Chance'))
            utility = Get-CellFuzzy $row $ablLayout.header @('Buff / Debuff / Utility','Effect Text')
            target = 'enemy'
            role = $role
            aspect = Get-AspectId (Get-CellFuzzy $row $ablLayout.header @('Aspect'))
        }
    }
    foreach ($key in $birds.Keys) {
        $bird = $birds[$key]
        $starters = if ($kitStarters.Contains($key)) { $kitStarters[$key] | Sort-Object { $_.slot } } else { @() }
        $birdKits[$key] = [ordered]@{
            birdKey = $key
            birdName = $bird.name
            class = $bird.class
            aspect = $bird.aspect
            gameplayIdentity = Get-CellFuzzy $birdRows[$birdLayout.dataStart] $birdLayout.header @('Identity / Size Reason')
            starters = $starters
            abilitySlotCount = 7
        }
    }

    # Canonical ability list rows also in skillTrees (slot unlock reference)
    for ($i = $ablLayout.dataStart; $i -lt $ablRows.Count; $i++) {
        $row = $ablRows[$i]
        $birdName = Get-CellFuzzy $row $ablLayout.header @('Bird')
        $slotNum = Get-Num (Get-CellFuzzy $row $ablLayout.header @('Ability Slot'))
        $abName = Get-CellFuzzy $row $ablLayout.header @('Ability Name')
        if (-not $abName) { continue }
        $slug = ($abName -replace '[^a-zA-Z0-9]+','_').ToUpper().Trim('_')
        $listId = "$(Get-BirdKey $birdName)_S${slotNum}_$slug"
        $famId = ($families.Keys | Where-Object { $families[$_].birdKey -eq (Get-BirdKey $birdName) -and $families[$_].abilitySlot -eq ($slotNum - 1) } | Select-Object -First 1)
        if (-not $famId) { $famId = $listId + '_FAMILY' }
        $entry = Build-AbilityRowEntry $row $ablLayout.header $listId $famId 'base' 1 'bird'
        if (-not $skillTrees.Contains($listId)) { $skillTrees[$listId] = $entry }
    }

    # --- Aspects data ---
    $aspects = [ordered]@{
        ids = @('terra','aeris','tempest','solis','lunae','maris')
        dominantMod = 1.20
        neutralMod = 1.00
        resistedMod = 0.80
        chart = [ordered]@{
            terra = [ordered]@{ terra='neutral'; aeris='dominant'; tempest='resisted'; solis='dominant'; lunae='neutral'; maris='resisted' }
            aeris = [ordered]@{ terra='dominant'; aeris='neutral'; tempest='resisted'; solis='resisted'; lunae='dominant'; maris='neutral' }
            tempest = [ordered]@{ terra='resisted'; aeris='dominant'; tempest='neutral'; solis='neutral'; lunae='resisted'; maris='dominant' }
            solis = [ordered]@{ terra='resisted'; aeris='dominant'; tempest='neutral'; lunae='dominant'; maris='resisted' }
            lunae = [ordered]@{ terra='neutral'; aeris='resisted'; tempest='dominant'; solis='resisted'; lunae='neutral'; maris='dominant' }
            maris = [ordered]@{ terra='dominant'; aeris='neutral'; tempest='resisted'; solis='dominant'; lunae='resisted'; maris='neutral' }
        }
        themes = [ordered]@{
            terra='Earth / Ground'; aeris='Sky / Wind'; tempest='Storm / Lightning'
            solis='Day / Sun'; lunae='Night / Moon'; maris='Water / Sea'
        }
    }

    # --- Effect tiers (subset from workbook) ---
    $effectTiers = [ordered]@{
        buff = [ordered]@{ minor=6; major=8; grand=12; epic=18; legendary=25 }
        debuff = [ordered]@{ minor=6; major=8; crippling=12; ruinous=18; fatal=25 }
        ailmentChance = [ordered]@{ minor=5; major=10; crippling=20; ruinous=30; fatal=40 }
    }

    # --- Ultimate meter rules ---
    $ultimateMeterRules = [ordered]@{
        maxMeter = 100
        damageAwards = [ordered]@{ '1'=8; '2'=12; '3'=16; '4'=22 }
        utilityAwards = [ordered]@{ '1'=6; '2'=10; '3'=14; '4'=20 }
    }

    # --- Write files ---
    $outBirds = Join-Path $Root 'js\data\birds.js'
    $birdsBody = ($birds.Keys | Sort-Object | ForEach-Object {
        $k = $_; $b = $birds[$k]
        $lines = @("  ${k}:{")
        $lines += "    name:$(ConvertTo-JsString $b.name), portraitKey:$(ConvertTo-JsString $b.portraitKey),"
        if ($b.tagline) { $lines += "    tagline:$(ConvertTo-JsString $b.tagline)," }
        $lines += "    size:$(ConvertTo-JsString $b.size), class:$(ConvertTo-JsString $b.class), aspect:$(ConvertTo-JsString $b.aspect), aspectTheme:$(ConvertTo-JsString $b.aspectTheme),"
        if ($b.unlockRequires) { $lines += "    unlockRequires:$(ConvertTo-JsString $b.unlockRequires)," }
        if ($b.unlockHint) { $lines += "    unlockHint:$(ConvertTo-JsString $b.unlockHint)," }
        $st = $b.stats
        $lines += "    stats:{hp:$($st.hp),maxHp:$($st.maxHp),atk:$($st.atk),def:$($st.def),spd:$($st.spd),dodge:$($st.dodge),acc:$($st.acc),mdef:$($st.mdef),matk:$($st.matk),critChance:$($st.critChance)},"
        if ($b.color) { $lines += "    color:$(ConvertTo-JsString $b.color)," }
        $pd = @("id:$(ConvertTo-JsString $b.passive.id)","name:$(ConvertTo-JsString $b.passive.name)")
        if ($b.passive.desc) { $pd += "desc:$(ConvertTo-JsString $b.passive.desc)" }
        $lines += "    passive:{$( $pd -join ',')},"
        if ($b.classPerk) { $lines += "    classPerk:$(ConvertTo-JsString $b.classPerk)," }
        if ($b.classPerkEffect) { $lines += "    classPerkEffect:$(ConvertTo-JsString $b.classPerkEffect)," }
        if ($b.abilityPool) { $lines += "    abilityPool:$(ConvertTo-JsString $b.abilityPool)," }
        $lines += '  },'
        $lines -join "`n"
    }) -join "`n"
    $birdsJs = "/* GENERATED by scripts/import-master-workbook.ps1 - do not edit by hand. */`n(function () {`n  'use strict';`n  var birds = {`n$birdsBody`n  };`n  globalThis.BIRDS = birds;`n})();`n"
    [System.IO.File]::WriteAllText($outBirds, $birdsJs, [Text.Encoding]::UTF8)

    Write-AvianDataFile (Join-Path $Root 'js\data\combat-pack\classes.js') '/* GENERATED classes */' 'classes' $classes 'combatPack'
    Write-AvianDataFile (Join-Path $Root 'js\data\combat-pack\bird-passives.js') '/* GENERATED bird passives */' 'birdPassives' $birdPassives 'combatPack'
    Write-AvianDataFile (Join-Path $Root 'js\data\size-chart.js') '/* GENERATED size chart */' 'sizeChart' $sizeChart 'data'
    Write-AvianDataFile (Join-Path $Root 'js\data\enemy-title-pools.js') '/* GENERATED title pools */' 'enemyTitlePools' $titlePools 'data'
    Write-AvianDataFile (Join-Path $Root 'js\data\enemy-roster.js') '/* GENERATED enemy roster */' 'enemyRoster' $enemyRoster 'data'
    Write-AvianDataFile (Join-Path $Root 'js\data\mother-goose-species-tiers.js') '/* GENERATED mother goose tiers */' 'motherGooseSpeciesTiers' $motherGoose 'data'
    Write-AvianDataFile (Join-Path $Root 'js\data\combat-pack\birds-kits.js') '/* GENERATED bird kits */' 'birdKits' $birdKits 'combatPack'
    Write-AvianDataFile (Join-Path $Root 'js\data\combat-pack\families.js') '/* GENERATED ability families */' 'families' $families 'combatPack'
    Write-AvianDataFile (Join-Path $Root 'js\data\combat-pack\skill-trees.js') '/* GENERATED skill trees */' 'skillTrees' $skillTrees 'combatPack'
    Write-AvianDataFile (Join-Path $Root 'js\data\aspects.js') '/* GENERATED aspect matchup */' 'aspects' $aspects 'data'
    Write-AvianDataFile (Join-Path $Root 'js\data\effect-tiers.js') '/* GENERATED effect tiers */' 'effectTiers' $effectTiers 'data'
    Write-AvianDataFile (Join-Path $Root 'js\data\ultimate-meter-rules.js') '/* GENERATED ultimate meter rules */' 'ultimateMeterRules' $ultimateMeterRules 'data'

    # Preserve empty shop/endless stubs
    Write-AvianDataFile (Join-Path $Root 'js\data\combat-pack\shop-pool.js') '/* GENERATED shop pool (empty - master workbook has no shop pool) */' 'shopPool' ([ordered]@{ tierRules = [ordered]@{}; entries = [ordered]@{} }) 'combatPack'
    Write-AvianDataFile (Join-Path $Root 'js\data\combat-pack\endless-passives.js') '/* GENERATED endless passives stub */' 'endlessPassives' ([ordered]@{ bird = [ordered]@{}; generic = [ordered]@{} }) 'combatPack'

    Write-Host "[master-workbook] birds: $($birds.Count)"
    Write-Host "[master-workbook] classes: $($classes.Count)"
    Write-Host "[master-workbook] passives: $($birdPassives.Count)"
    Write-Host "[master-workbook] enemy roster rows: $enemyCount"
    Write-Host "[master-workbook] families: $($families.Count)"
    Write-Host "[master-workbook] skill trees: $($skillTrees.Count)"

    if ($Verify) {
        $fail = ($birds.Count -lt 50) -or ($enemyCount -lt 500) -or ($skillTrees.Count -lt 300)
        exit $(if ($fail) { 2 } else { 0 })
    }
}
finally {
    Close-MasterWorkbook $ctx
}
