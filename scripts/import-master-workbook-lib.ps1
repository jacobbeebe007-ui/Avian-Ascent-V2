# Shared xlsx + normalization helpers for import-master-workbook.ps1
# Dot-source: . "$PSScriptRoot\import-master-workbook-lib.ps1"

$script:MasterWorkbookDefault = @(
    $env:AA_MASTER_WORKBOOK_XLSX
    (Join-Path $env:HOME 'Documents/Avian Ascent/Avian Workbooks/Master workbook Avian_Ascent_Workbook_Master list of birds, abilities, passives, perks, Aspects etc.xlsx')
    (Join-Path $env:HOME 'Downloads/Avian Music bites/Avian Workbooks/Master workbook Avian_Ascent_Workbook_Master list of birds, abilities, passives, perks, Aspects etc.xlsx')
    'C:\Users\JaK_d\Desktop\Avian Ascent\New Sheets\Main\Master workbook Avian_Ascent_Workbook_Master list of birds, abilities, passives, perks, Aspects etc.xlsx'
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $script:MasterWorkbookDefault) {
    $script:MasterWorkbookDefault = (Join-Path $env:HOME 'Documents/Avian Ascent/Avian Workbooks/Master workbook Avian_Ascent_Workbook_Master list of birds, abilities, passives, perks, Aspects etc.xlsx')
}

$script:BIRD_NAME_TO_KEY = @{
    'Sparrow'='sparrow'; 'Goose'='goose'; 'Blackbird'='blackbird'; 'Crow'='crow'; 'Magpie'='magpie'
    'Hummingbird'='hummingbird'; 'Robin'='robin'; 'Peregrine Falcon'='peregrine'; 'Peregrine'='peregrine'
    'Kiwi'='kiwi'; 'Snowy Owl'='snowyOwl'; 'Macaw'='macaw'; 'Lyrebird'='lyrebird'; 'Black Cockatoo'='blackCockatoo'
    'Kookaburra'='kookaburra'; 'Raven'='raven'; 'Bowerbird'='bowerbird'; 'Toucan'='toucan'; 'Swan'='swan'
    'Flamingo'='flamingo'; 'Secretary Bird'='secretary'; 'Secretary'='secretary'; 'Albatross'='albatross'
    'Seagull'='seagull'; 'Shoebill'='shoebill'; 'Shoebill Stork'='shoebill'; 'Harpy Eagle'='harpy'; 'Harpy'='harpy'
    'Bald Eagle'='baldEagle'; 'Emperor Penguin'='penguin'; 'Penguin'='penguin'; 'Ostrich'='ostrich'
    'Cassowary'='cassowary'; 'Emu'='emu'; 'Duke Blakiston'='dukeBlakiston'; 'Wren'='wren'
    'Superb Fairywren'='fairywren'; 'Fairywren'='fairywren'; 'Firecrest'='firecrest'; 'Willie Wagtail'='wagtail'
    'Wagtail'='wagtail'; 'Galah'='galah'; 'Blue Jay'='bluejay'; 'Bluejay'='bluejay'; 'Cardinal'='cardinal'
    'Bush Turkey'='bushturkey'; 'Bushturkey'='bushturkey'; 'Vulture'='vulture'; 'Barn Owl'='barnowl'; 'Barnowl'='barnowl'
    'Bustard'='bustard'; 'Golden Eagle'='goldeneagle'; 'Australian Pelican'='pelican'; 'Pelican'='pelican'
    'Marabou Stork'='marabou'; 'Marabou'='marabou'
    'Chickadee'='chickadee'; 'Dodo'='dodo'; 'Dove'='dove'; 'Finch'='finch'; 'Kakapo'='kakapo'
    'Pigeon'='pigeon'; 'Rock Dove'='rockDove'; 'Rock Pigeon'='rockPigeon'
}

$script:LEGACY_CLASS_TO_NEW = @{
    striker='rogue'; singer='mage'; predator='inquisitor'; trickster='bard'; tank='knight'; bruiser='brute'
}

$script:KNOWN_CLASSES = [System.Collections.Generic.HashSet[string]]@(
    'knight','rogue','mage','siren','inquisitor','bard','brute','duke'
)

$script:BIRD_PRESERVE = @{
    sparrow=@{ tagline='Swift as wind, strikes like needles.'; color='#6a8ae8' }
    hummingbird=@{ tagline='Blurred wings, needle beak. Zap & zip.'; color='#40e8c0'; unlockRequires='unlock_hummingbird'; unlockHint='Defeat Stage 10 with Sparrow.' }
    blackbird=@{ tagline='Songs that shatter minds. Eyes like embers.'; color='#9a6ae8' }
    macaw=@{ tagline='Every word is a weapon.'; color='#1a6aba' }
    peregrine=@{ tagline='Lock. Stoop. No survivors.'; color='#6a8ac8'; unlockRequires='unlock_peregrine'; unlockHint='Defeat Stage 20 with Hummingbird.' }
    snowyOwl=@{ tagline='The snow listens. Then it falls.'; color='#e8f0f8'; unlockRequires='juvenileWin'; unlockHint='Defeat Stage 20 on Normal mode to unlock.' }
    kiwi=@{ tagline='Nocturnal probe. Beak pierces armor like butter.'; color='#a0784a'; unlockRequires='unlock_kiwi'; unlockHint='Defeat Stage 20 with Magpie.' }
    blackCockatoo=@{ tagline='Booming crest. Resonant voice and crushing notes.'; color='#2a1a3a'; unlockRequires='juvenileWin'; unlockHint='Defeat Stage 20 on Normal mode to unlock.' }
    crow=@{ tagline='Clever. Coordinated. Unsettling.'; color='#c0c8d8' }
    kookaburra=@{ tagline='Bush trickster. Laughing pressure, feints, and sudden drops.'; color='#c8a060'; unlockRequires='unlock_kookaburra'; unlockHint='Defeat Stage 10 with Macaw.' }
    lyrebird=@{ tagline='The great deceiver. Master of all songs.'; color='#c8902a'; unlockRequires='unlock_lyrebird'; unlockHint='Defeat Stage 20 with Kookaburra.' }
    raven=@{ tagline='The field remembers. You only hurry the ending.'; color='#6030d0'; unlockRequires='juvenileWin'; unlockHint='Defeat Stage 20 on Normal mode to unlock.' }
    magpie=@{ tagline='Flashy thief. Swoops in, steals the moment, and slips away.'; color='#2a2a2a'; unlockRequires='unlock_magpie'; unlockHint='Defeat Stage 10 with Robin.' }
    robin=@{ tagline='Bright hedge-songster. Quick notes, light strikes, and uplifting refrains.'; color='#d86a4c' }
    bowerbird=@{ tagline='Stage-maker. Builds the bower, lures the eye, and cashes the display.'; color='#4a6a9a'; unlockRequires='juvenileWin'; unlockHint='Defeat Stage 20 on Normal mode to unlock.' }
    toucan=@{ tagline='Oversized bill, vivid pressure, odd reach.'; color='#60c840'; unlockRequires='unlock_toucan'; unlockHint='Enter: "Ahh Ahh Eee Eee Tookie Tookie"' }
    swan=@{ tagline='Regal bulwark. Grace, weight, and unbroken composure.'; color='#f0f4fc'; unlockRequires='unlock_swan'; unlockHint='Reach Endless Stage 30 with any Tank.' }
    flamingo=@{ tagline='Wading lines. Soft water, hard footing.'; color='#e8609a'; unlockRequires='unlock_flamingo'; unlockHint='Reach Endless Stage 30 with any Striker.' }
    secretary=@{ tagline='Stalking justice. The kick decides.'; color='#e0a060'; unlockRequires='unlock_secretary'; unlockHint='Defeat Stage 10 with Crow.' }
    albatross=@{ tagline='Vast ocean bruiser. Wide-wing blows and crushing returning sweeps.'; color='#9fb7c9'; unlockRequires='unlock_albatross'; unlockHint='Reach Endless Stage 50 with any bird.' }
    seagull=@{ tagline='Coastal pest. Harrying swoops, noisy cries, scavenger’s payoff.'; color='#b0c8d8'; unlockRequires='unlock_seagull'; unlockHint='Reach level 21 in Endless mode with any Trickster.' }
    goose=@{ tagline='Territorial bruiser. Honk, check, refuse to yield.'; color='#e8c96a' }
    shoebill=@{ tagline='Ancient. Patient. Inevitable.'; color='#5a7090'; unlockRequires='unlock_shoebill'; unlockHint='Defeat Stage 10 with Goose.' }
    harpy=@{ tagline='Warlord of the canopy. No mercy.'; color='#c84030'; unlockRequires='unlock_harpy'; unlockHint='Defeat Stage 20 with Hummingbird.'; abilityPool=@('physical') }
    baldEagle=@{ tagline='Unbreakable. Undying. Undefeated.'; color='#e8e4d8'; unlockRequires='juvenileWin'; unlockHint='Defeat Stage 20 on Normal mode to unlock.' }
    penguin=@{ tagline='Ice-clad waddler. Magic slides off its blubber.'; color='#3a5878'; unlockRequires='unlock_penguin'; unlockHint='Reach Endless Stage 30 with any Tank.' }
    ostrich=@{ tagline='Flightless thunder. Charges build to earth-shaking fury.'; color='#b89060'; unlockRequires='unlock_ostrich'; unlockHint='Defeat Stage 20 with Shoebill.' }
    cassowary=@{ tagline='Jungle juggernaut. Bone-crushing kicks and armored hide.'; color='#3b4a56'; unlockRequires='juvenileWin'; unlockHint='Defeat Stage 20 on Normal mode to unlock.' }
    emu=@{ tagline='Flightless brute. Kicks and stomps with terrifying force.'; color='#7a6040'; unlockRequires='unlock_emu'; unlockHint='Reach Endless Stage 40 with any Tank.' }
    dukeBlakiston=@{ tagline='Lord of the court. Boss-tier ruler with unique command, control, and execution skills.'; color='#6f88c2'; unlockRequires='unlock_duke_blakiston'; unlockHint="Enter code 'Blakiston' on the selection screen." }
    wren=@{ tagline='Tiny hedge striker. Fast feet, sharp pecks, no wasted motion.'; color='#6a9a6a'; unlockRequires='unlock_wren'; unlockHint='Coming soon.' }
    fairywren=@{ tagline='Brilliant songster. Small frame, bright notes, quick support.'; color='#4a7ae8'; unlockRequires='unlock_fairywren'; unlockHint='Coming soon.' }
    firecrest=@{ tagline='Flash of flame. Tiny striker built around speed and burning finishers.'; color='#e85a2a'; unlockRequires='unlock_firecrest'; unlockHint='Coming soon.' }
    wagtail=@{ tagline='Tail-flicking nuisance. Sharp feints, mocking calls, constant motion.'; color='#2a2a2a'; unlockRequires='unlock_wagtail'; unlockHint='Coming soon.' }
    galah=@{ tagline='Loud pink menace. Flashy disruption, misdirection, and staged payoffs.'; color='#e8a0c8'; unlockRequires='unlock_galah'; unlockHint='Coming soon.' }
    bluejay=@{ tagline='Territorial brawler. Harsh hits, loud pressure, and aggressive momentum.'; color='#3a5cb8'; unlockRequires='unlock_bluejay'; unlockHint='Coming soon.' }
    cardinal=@{ tagline='Crimson songbird. Strong clear notes and rallying support.'; color='#c02030'; unlockRequires='unlock_cardinal'; unlockHint='Coming soon.' }
    bushturkey=@{ tagline='Scrappy ground bruiser. Dirty hits, stubborn guard, and pressure.'; color='#5a5040'; unlockRequires='unlock_bushturkey'; unlockHint='Coming soon.' }
    vulture=@{ tagline='Grim scavenger bruiser. Heavy blows and lingering pressure.'; color='#6a5a50'; unlockRequires='unlock_vulture'; unlockHint='Coming soon.' }
    barnowl=@{ tagline='Silent dusk hunter. Clean set-up, precise dive, punishing finish.'; color='#c8b8a0'; unlockRequires='unlock_barnowl'; unlockHint='Coming soon.' }
    bustard=@{ tagline='Heavy plains bruiser. Wide body, crushing steps, relentless force.'; color='#8a7860'; unlockRequires='unlock_bustard'; unlockHint='Coming soon.' }
    goldeneagle=@{ tagline='Imperial hunter. High kill pressure and ruthless finishers.'; color='#c9a020'; unlockRequires='unlock_goldeneagle'; unlockHint='Coming soon.' }
    pelican=@{ tagline='Massive bill, massive body. Absorbs hits and refuses to yield.'; color='#a0b8c8'; unlockRequires='unlock_pelican'; unlockHint='Coming soon.' }
    marabou=@{ tagline='Corpse-field predator. Grim pressure and towering execution.'; color='#8a8a88'; unlockRequires='unlock_marabou'; unlockHint='Coming soon.' }
    chickadee=@{ tagline='Tiny nerve. Quick pecks and sharper openings.'; color='#8a9a6a'; unlockRequires='unlock_chickadee'; unlockHint='Coming soon.' }
    dodo=@{ tagline='Oblivious bulk. Too stubborn to fall quickly.'; color='#9a8a70'; unlockRequires='unlock_dodo'; unlockHint='Coming soon.' }
    dove=@{ tagline='Gentle chorus. Soft magic, steady support.'; color='#c8c0b0'; unlockRequires='unlock_dove'; unlockHint='Coming soon.' }
    finch=@{ tagline='Quick chirp. First strike, fast finish.'; color='#d8a840'; unlockRequires='unlock_finch'; unlockHint='Coming soon.' }
    kakapo=@{ tagline='Mossy ballad. Night-ground survivor with heavy magic.'; color='#6a8a50'; unlockRequires='unlock_kakapo'; unlockHint='Coming soon.' }
    pigeon=@{ tagline='Street scrapper. Scrappy rhythm, scrappier payoffs.'; color='#8a8a98'; unlockRequires='unlock_pigeon'; unlockHint='Coming soon.' }
    rockDove=@{ tagline='Cobbled rhythm. Alternating beats, rising damage.'; color='#7a8090'; unlockRequires='unlock_rockdove'; unlockHint='Coming soon.' }
    rockPigeon=@{ tagline='Rooftop bulk. Heavy guard above the city line.'; color='#6a7080'; unlockRequires='unlock_rockpigeon'; unlockHint='Coming soon.' }
}

function Open-MasterWorkbook {
    param([string]$Path)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
    $ss = New-Object System.Collections.Generic.List[string]
    $ssEntry = $zip.GetEntry('xl/sharedStrings.xml')
    if ($ssEntry) {
        $r = New-Object System.IO.StreamReader($ssEntry.Open())
        try {
            $ssXml = $r.ReadToEnd()
        } finally { $r.Close() }
        foreach ($m in [regex]::Matches($ssXml, '(?s)<x:si>(.*?)</x:si>')) {
            $txt = -join ([regex]::Matches($m.Groups[1].Value, '(?s)<x:t[^>]*>(.*?)</x:t>') | ForEach-Object { $_.Groups[1].Value })
            [void]$ss.Add($txt)
        }
    }
    $relsEntry = $zip.GetEntry('xl/_rels/workbook.xml.rels')
    $rels = ''
    if ($relsEntry) {
        $r = New-Object System.IO.StreamReader($relsEntry.Open())
        try { $rels = $r.ReadToEnd() } finally { $r.Close() }
    }
    $relmap = @{}
    foreach ($m in [regex]::Matches($rels, '<Relationship\s+([^>]+?)/>')) {
        $a = $m.Groups[1].Value
        $id = [regex]::Match($a, 'Id="([^"]+)"').Groups[1].Value
        $tg = [regex]::Match($a, 'Target="([^"]+)"').Groups[1].Value
        if ($id) { $relmap[$id] = ($tg -replace '^/', '') }
    }
    $name2file = @{}
    $wbEntry = $zip.GetEntry('xl/workbook.xml')
    $wb = ''
    if ($wbEntry) {
        $r = New-Object System.IO.StreamReader($wbEntry.Open())
        try { $wb = $r.ReadToEnd() } finally { $r.Close() }
    }
    foreach ($m in [regex]::Matches($wb, 'name="([^"]+)"[^>]*?r:id="([^"]+)"')) {
        $nm = ($m.Groups[1].Value -replace '&amp;', '&')
        $tg = $relmap[$m.Groups[2].Value]
        if ($tg) { $name2file[$nm] = $tg }
    }
    return @{
        Zip = $zip
        SharedStrings = $ss
        NameToFile = $name2file
    }
}

function Read-WorkbookEntry {
    param($Ctx, [string]$Name)
    $e = $Ctx.Zip.GetEntry($Name)
    if (-not $e) { return '' }
    $r = New-Object System.IO.StreamReader($e.Open())
    try { return $r.ReadToEnd() } finally { $r.Close() }
}

function Close-MasterWorkbook { param($Ctx) if ($Ctx.Zip) { $Ctx.Zip.Dispose() } }

function Get-SheetRowsFromCtx {
    param($Ctx, [string]$SheetName)
    $file = $Ctx.NameToFile[$SheetName]
    if (-not $file) { return @() }
    $xml = Read-WorkbookEntry $Ctx $file
    $ss = $Ctx.SharedStrings
    $rows = New-Object System.Collections.Generic.List[object]
    foreach ($rm in [regex]::Matches($xml, '(?s)<x:row[^>]*?>(.*?)</x:row>')) {
        $cells = New-Object System.Collections.Generic.List[string]
        foreach ($cm in [regex]::Matches($rm.Groups[1].Value, '(?s)<x:c\s+([^>]*?)(?:/>|>(.*?)</x:c>)')) {
            $attrs = $cm.Groups[1].Value; $body = $cm.Groups[2].Value
            $t = ''; $tm = [regex]::Match($attrs, 't="([^"]+)"'); if ($tm.Success) { $t = $tm.Groups[1].Value }
            $val = ''
            $vm = [regex]::Match($body, '(?s)<x:v>(.*?)</x:v>')
            if ($t -eq 's' -and $vm.Success) { $val = $ss[[int]$vm.Groups[1].Value] }
            elseif ($t -eq 'inlineStr') {
                $val = -join ([regex]::Matches($body, '(?s)<x:t[^>]*>(.*?)</x:t>') | ForEach-Object { $_.Groups[1].Value })
            }
            elseif ($vm.Success) { $val = $vm.Groups[1].Value }
            [void]$cells.Add([string]$val)
        }
        [void]$rows.Add([string[]]$cells.ToArray())
    }
    return $rows.ToArray()
}

function New-HeaderMap { param([string[]]$HeaderRow)
    $map = @{}
    for ($i = 0; $i -lt $HeaderRow.Count; $i++) { if ($HeaderRow[$i]) { $map[$HeaderRow[$i].Trim()] = $i } }
    return $map
}

function Get-SheetLayout {
    param([string]$SheetName, $Rows, [string[]]$MustHave, [int]$DefaultHeaderRow = 0, [int]$DefaultDataStart = 1)
    $layouts = @{
        'Player Bird Stats' = @{ headerRow = 3; dataStart = 4 }
        'Passives & Perks' = @{ headerRow = 3; dataStart = 4 }
        'Class Templates' = @{ headerRow = 3; dataStart = 4 }
        'Size Chart' = @{ headerRow = 3; dataStart = 4 }
        'Bird Enemy Title Pools' = @{ headerRow = 3; dataStart = 4 }
        'Enemy Birds' = @{ headerRow = 3; dataStart = 4 }
        'Mother Goose Tiers' = @{ headerRow = 3; dataStart = 4 }
        'Bird Ability List' = @{ headerRow = 0; dataStart = 1 }
        'Ability Mutation Trees' = @{ headerRow = 0; dataStart = 1 }
        'Ability Tag Glossary' = @{ headerRow = 0; dataStart = 1 }
        'Bird Ability Summary' = @{ headerRow = 0; dataStart = 1 }
    }
    if ($layouts.ContainsKey($SheetName)) {
        $l = $layouts[$SheetName]
        return @{ header = (New-HeaderMap $Rows[$l.headerRow]); dataStart = $l.dataStart }
    }
    for ($i = 0; $i -lt [Math]::Min(10, $Rows.Count); $i++) {
        $joined = ($Rows[$i] -join '|').ToLower()
        $ok = $true
        foreach ($k in $MustHave) { if ($joined -notmatch [regex]::Escape($k.ToLower())) { $ok = $false; break } }
        if ($ok) { return @{ header = (New-HeaderMap $Rows[$i]); dataStart = $i + 1 } }
    }
    return @{ header = (New-HeaderMap $Rows[$DefaultHeaderRow]); dataStart = $DefaultDataStart }
}

function Get-Cell {
    param($Row, $Header, [string]$Name)
    if (-not $Header.ContainsKey($Name)) { return '' }
    $i = $Header[$Name]
    if ($null -eq $i -or $i -ge $Row.Count) { return '' }
    return ([string]$Row[$i]).Trim()
}

function Get-CellFuzzy {
    param($Row, $Header, [string[]]$Names)
    foreach ($n in $Names) {
        $v = Get-Cell $Row $Header $n
        if ($v) { return $v }
    }
    foreach ($key in $Header.Keys) {
        foreach ($n in $Names) {
            if ($key -match [regex]::Escape($n)) { return ([string]$Row[$Header[$key]]).Trim() }
        }
    }
    return ''
}

function Get-Num {
    param([string]$S)
    if ([string]::IsNullOrWhiteSpace($S)) { return 0 }
    $m = [regex]::Match($S, '-?\d+(?:\.\d+)?')
    if (-not $m.Success) { return 0 }
    return [int][Math]::Round([double]$m.Value)
}

function Get-Float {
    param([string]$S)
    if ([string]::IsNullOrWhiteSpace($S)) { return 0.0 }
    $m = [regex]::Match($S, '-?\d+(?:\.\d+)?')
    if (-not $m.Success) { return 0.0 }
    return [double]$m.Value
}

function Get-BirdKey {
    param([string]$Name)
    if ([string]::IsNullOrWhiteSpace($Name)) { return '' }
    $t = $Name.Trim()
    if ($script:BIRD_NAME_TO_KEY.ContainsKey($t)) { return $script:BIRD_NAME_TO_KEY[$t] }
    return ($t -replace '[^a-zA-Z0-9]', '').Substring(0,1).ToLower() + ($t -replace '[^a-zA-Z0-9]', '').Substring(1)
}

function Get-ClassId {
    param([string]$S)
    $raw = ([string]$S).Trim().ToLower()
    $first = ($raw -split '\s+')[0]
    if ($script:KNOWN_CLASSES.Contains($first)) { return $first }
    if ($script:LEGACY_CLASS_TO_NEW.ContainsKey($first)) { return $script:LEGACY_CLASS_TO_NEW[$first] }
    return 'rogue'
}

function Get-SizeId {
    param([string]$S)
    $x = ([string]$S).Trim().ToLower()
    if ($x -match 'very\s*large|verylarge|giant|boss') { return 'xl' }
    if ($x -eq 'tiny') { return 'tiny' }
    if ($x -eq 'small') { return 'small' }
    if ($x -eq 'medium') { return 'medium' }
    if ($x -eq 'large') { return 'large' }
    return 'medium'
}

function Get-AspectId {
    param([string]$S)
    $x = ([string]$S).Trim().ToLower()
    if ($x -match '^(terra|aeris|tempest|solis|lunae|maris)$') { return $matches[1] }
    return ''
}

$script:ASPECT_COLORS = @{
    terra = '#8a7860'
    aeris = '#6a8ae8'
    tempest = '#9a6ae8'
    solis = '#e8c020'
    lunae = '#6030d0'
    maris = '#3a5878'
}

function Parse-AspectNameList {
    param([string]$Text)
    if (-not $Text) { return @() }
    $out = @()
    foreach ($part in ($Text -split '[,;/]')) {
        $id = Get-AspectId $part.Trim()
        if ($id -and ($out -notcontains $id)) { $out += $id }
    }
    return $out
}

function Parse-AspectModValue {
    param([string]$Text, [double]$Fallback)
    if ($Text -match '([\d.]+)') { return [double]$matches[1] }
    return $Fallback
}

function Normalize-MatrixRelation {
    param([string]$Cell)
    $v = ([string]$Cell).Trim().ToLower()
    if ($v -eq 'dominant') { return 'dominant' }
    if ($v -eq 'resisted') { return 'resisted' }
    if ($v -eq 'neutral') { return 'neutral' }
    return ''
}

function Build-AspectsFromSheet {
    param($Rows)
    if (-not $Rows -or $Rows.Count -lt 18) {
        throw '[master-workbook] Master Aspects sheet missing or incomplete (need rows through matrix).'
    }
    $defHeader = New-HeaderMap $Rows[3]
    if (-not $defHeader.ContainsKey('Aspect')) {
        throw '[master-workbook] Master Aspects definitions header row not found.'
    }
    $ids = @()
    $definitions = [ordered]@{}
    $themes = [ordered]@{}
    for ($i = 4; $i -le 9; $i++) {
        $row = $Rows[$i]
        $displayName = Get-CellFuzzy $row $defHeader @('Aspect')
        if (-not $displayName) { continue }
        $id = Get-AspectId $displayName
        if (-not $id) { continue }
        $theme = Get-CellFuzzy $row $defHeader @('Theme')
        $strongRaw = Get-CellFuzzy $row $defHeader @('Strong Against')
        $weakRaw = Get-CellFuzzy $row $defHeader @('Weak Against')
        $habitat = Get-CellFuzzy $row $defHeader @('Habitat / Design Rule')
        $strongIds = Parse-AspectNameList $strongRaw
        $weakIds = Parse-AspectNameList $weakRaw
        $desc = if ($theme) { "$theme-aligned aspect." } else { "$displayName aspect." }
        $ids += $id
        $themes[$id] = $theme
        $definitions[$id] = [ordered]@{
            name = $displayName
            theme = $theme
            description = $desc
            strongAgainst = $strongIds
            weakAgainst = $weakIds
            habitatRule = $habitat
            color = $script:ASPECT_COLORS[$id]
        }
    }
    if ($ids.Count -lt 6) {
        throw "[master-workbook] Expected 6 aspect definitions, found $($ids.Count)."
    }
    $matrixHeader = $Rows[12]
    $targetIds = @()
    for ($c = 6; $c -lt $matrixHeader.Count; $c++) {
        $tid = Get-AspectId $matrixHeader[$c]
        if ($tid) { $targetIds += $tid }
    }
    if ($targetIds.Count -lt 6) {
        throw '[master-workbook] Master Aspects matrix header missing target columns.'
    }
    $dominantMod = 1.20
    $neutralMod = 1.00
    $resistedMod = 0.80
    if ($Rows[13][1]) { $dominantMod = Parse-AspectModValue $Rows[13][1] 1.20 }
    if ($Rows[14][1]) { $neutralMod = Parse-AspectModValue $Rows[14][1] 1.00 }
    if ($Rows[15][1]) { $resistedMod = Parse-AspectModValue $Rows[15][1] 0.80 }
    $chart = [ordered]@{}
    for ($r = 13; $r -le 18; $r++) {
        $row = $Rows[$r]
        $attackerName = $row[5]
        if (-not $attackerName) { continue }
        $attId = Get-AspectId $attackerName
        if (-not $attId) { continue }
        $relRow = [ordered]@{}
        for ($ti = 0; $ti -lt $targetIds.Count; $ti++) {
            $col = 6 + $ti
            if ($col -ge $row.Count) { break }
            $rel = Normalize-MatrixRelation $row[$col]
            if ($rel) { $relRow[$targetIds[$ti]] = $rel }
        }
        if ($relRow.Count -ge 6) { $chart[$attId] = $relRow }
    }
    if ($chart.Count -lt 6) {
        throw "[master-workbook] Master Aspects matrix incomplete (got $($chart.Count) attacker rows)."
    }
    return [ordered]@{
        ids = $ids
        dominantMod = $dominantMod
        neutralMod = $neutralMod
        resistedMod = $resistedMod
        chart = $chart
        themes = $themes
        definitions = $definitions
    }
}

function ConvertTo-JsString {
    param($Value)
    if ($null -eq $Value) { return 'null' }
    if ($Value -is [bool]) { return $(if ($Value) { 'true' } else { 'false' }) }
    if ($Value -is [byte] -or $Value -is [sbyte] -or $Value -is [int16] -or $Value -is [uint16] -or $Value -is [int32] -or $Value -is [uint32] -or $Value -is [int64] -or $Value -is [uint64] -or $Value -is [single] -or $Value -is [double] -or $Value -is [decimal]) {
        $s = [string]$Value
        if ($s -match '^-?\d+\.0+$') { return [string][int]$Value }
        return $s
    }
    if ($Value -is [string]) { return (ConvertTo-Json $Value -Compress) }
    if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [hashtable]) -and -not ($Value -is [System.Collections.Specialized.OrderedDictionary])) {
        $items = @($Value | ForEach-Object { ConvertTo-JsString $_ })
        return '[' + ($items -join ',') + ']'
    }
    if ($Value -is [hashtable] -or $Value -is [System.Collections.Specialized.OrderedDictionary]) {
        $pairs = @()
        foreach ($k in @($Value.Keys)) {
            $pairs += (ConvertTo-Json ([string]$k) -Compress) + ':' + (ConvertTo-JsString $Value[$k])
        }
        return '{' + ($pairs -join ',') + '}'
    }
    return (ConvertTo-Json ([string]$Value) -Compress)
}

function Write-AvianDataFile {
    param([string]$Path, [string]$Header, [string]$VarName, $Payload, [string]$Namespace = 'data')
    $json = ConvertTo-JsString $Payload
    $body = if ($Namespace -eq 'combatPack') {
@"
$Header
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);
  Avian.data.combatPack = Avian.data.combatPack || Object.create(null);
  Avian.data.combatPack.$VarName = Object.freeze($json);
})();
"@
    } else {
@"
$Header
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);
  Avian.data.$VarName = Object.freeze($json);
})();
"@
    }
    $dir = Split-Path $Path -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText($Path, $body, [Text.Encoding]::UTF8)
}

function Get-AiStyleFromProfile {
    param([string]$P)
    $s = $P.ToLower()
    if ($s -match 'berserk|aggress|strike') { return 'berserker' }
    if ($s -match 'cautious|patient|guard|defen') { return 'cautious' }
    if ($s -match 'trick|feint|harass') { return 'trickster' }
    if ($s -match 'predat|hunt|execute') { return 'predator' }
    return 'aggressive'
}

function Get-NormalizedAilment {
    param([string]$Name)
    $k = $Name.Trim().ToLower()
    if (-not $k -or $k -eq 'none') { return $null }
    if ($k -match '^bleed') { return 'bleed' }
    if ($k -match '^burn') { return 'burning' }
    if ($k -match '^chill') { return 'chilled' }
    if ($k -match '^delay') { return 'delayed' }
    if ($k -match '^paralys') { return 'paralyzed' }
    if ($k -match '^poison') { return 'poison' }
    if ($k -match '^weaken') { return 'weaken' }
    if ($k -match '^blind') { return 'blinded' }
    if ($k -match '^decre') { return 'decreed' }
    return $null
}

function Get-NormalizedUnlockTier {
    param([string]$S)
    $x = ([string]$S).Trim().ToLower()
    if (-not $x) { return 'Starter' }
    if ($x -match 'starter|basic') { return 'Starter' }
    if ($x -match 'green|aspect') { return 'Green Aspect' }
    if ($x -match 'blue|class') { return 'Blue Class' }
    if ($x -match 'purple|utility') { return 'Purple Utility' }
    if ($x -match 'gold|special') { return 'Gold Special' }
    if ($x -match 'orange|ultimate') { return 'Orange Ultimate' }
    return (Get-Culture).TextInfo.ToTitleCase($x)
}

function Get-UnlockTierSlotIndex {
    param([string]$Tier)
    switch -Regex (([string]$Tier).ToLower()) {
        'starter|basic' { return @(0, 1) }
        'green|aspect' { return @(2) }
        'blue|class' { return @(3) }
        'purple|utility' { return @(4) }
        'gold|special' { return @(5) }
        'orange|ultimate' { return @(6) }
        default { return @() }
    }
}

function Get-AbilityTagsFromRow {
    param($Row, $Header)
    $tags = New-Object System.Collections.Generic.List[string]
    $role = (Get-Cell $Row $Header 'Role').ToLower()
    $dmgType = (Get-Cell $Row $Header 'Damage Type').ToLower()
    $utility = (Get-Cell $Row $Header 'Buff / Debuff / Utility')
    $ailment = (Get-Cell $Row $Header 'Ailment / Rider')
    $cooldown = Get-Cell $Row $Header 'Cooldown'
    $en = Get-Num (Get-Cell $Row $Header 'EN Cost')
    if ($dmgType -and $dmgType -ne 'none') { [void]$tags.Add('Damage') }
    if ($utility) { [void]$tags.Add('Utility') }
    if ($ailment) { [void]$tags.Add('Ailment') }
    if ($role -match 'ultimate') { [void]$tags.Add('Ultimate') }
    if ($en -ge 4 -or $role -match 'special') { [void]$tags.Add('Special') }
    if ((Get-Num (Get-Cell $Row $Header 'Hit Count')) -gt 1) { [void]$tags.Add('Multi-Hit') }
    if ($utility -match 'lifesteal|heals from damage') { [void]$tags.Add('Lifesteal Rider') }
    if ($utility -match 'cleanse') { [void]$tags.Add('Cleanse') }
    if ($utility -match 'purge') { [void]$tags.Add('Purge') }
    if ($utility -match 'marked') { [void]$tags.Add('Marked') }
    if ($utility -match 'bloodied|50%') { [void]$tags.Add('Bloodied') }
    if ($utility -match 'finisher') { [void]$tags.Add('Finisher') }
    if ($cooldown -and $cooldown -notmatch '^(n/a|none|0)$') { [void]$tags.Add('Cooldown') }
    return $tags.ToArray()
}

function Get-LifestealTierPct {
    param([string]$Tier)
    $map = @{ minor = 6; major = 8; grand = 12; epic = 18; legendary = 25 }
    $k = ([string]$Tier).ToLower().Trim()
    if ($map.ContainsKey($k)) { return $map[$k] }
    return 0
}

function Parse-HybridScalingFromText {
    param([string]$Text)
    if ([string]$Text -match 'Uses\s+(\d+)%\s+ATK\s+and\s+(\d+)%\s+MATK') {
        return [ordered]@{
            ATK = [double]$Matches[1] / 100.0
            MATK = [double]$Matches[2] / 100.0
        }
    }
    return $null
}

function Parse-HybridPerHitFromText {
    param([string]$Text)
    return [bool]([string]$Text -match 'First hit uses ATK,\s*second uses MATK')
}

function Parse-LifestealPctFromText {
    param([string]$Text)
    if ([string]$Text -match '(Minor|Major|Grand|Epic|Legendary)\s+Lifesteal') {
        return Get-LifestealTierPct $Matches[1]
    }
    return 0
}

function Build-AbilityRowEntry {
    param($Row, $Header, [string]$Id, [string]$FamilyId, [string]$Branch, [int]$Level, [string]$Source = 'bird')
    $en = Get-Num (Get-CellFuzzy $Row $Header @('EN Cost'))
    if ($en -le 0) { $en = 1 }
    $hits = Get-Num (Get-CellFuzzy $Row $Header @('Hit Count'))
    if ($hits -le 0) { $hits = 1 }
    $ap = Get-Float (Get-CellFuzzy $Row $Header @('Ability Power'))
    $heavyAcc = Get-Num (Get-CellFuzzy $Row $Header @('Heavy ACC Penalty'))
    $recoilRaw = Get-CellFuzzy $Row $Header @('Recoil')
    $recoil = if ($recoilRaw -match '\d') { Get-Float $recoilRaw / 100.0 } else { 0.0 }
    $scaleStat = (Get-CellFuzzy $Row $Header @('Scaling Stat')).ToUpper()
    if (-not $scaleStat) { $scaleStat = 'ATK' }
    $dmgType = Get-CellFuzzy $Row $Header @('Damage Type')
    $role = Get-CellFuzzy $Row $Header @('Role')
    $roleLower = ([string]$role).ToLower()
    $isHybrid = $dmgType -match 'hybrid'
    if ($isHybrid) {
        $scaleStat = 'HYBRID'
    }
    $category = if ($dmgType -match 'magic|song') { 'magic' } elseif ($dmgType -match 'true') { 'true' } elseif ($isHybrid) { 'hybrid' } else { 'physical' }
    $ailRaw = Get-CellFuzzy $Row $Header @('Ailment / Rider','Ailment')
    $ail = Get-NormalizedAilment $ailRaw
    $ailChance = Get-Num (Get-CellFuzzy $Row $Header @('Ailment Chance'))
    $slotNum = Get-Num (Get-CellFuzzy $Row $Header @('Ability Slot'))
    $cooldownRaw = Get-CellFuzzy $Row $Header @('Cooldown')
    $cooldown = if ($cooldownRaw -match '^\d') { Get-Num $cooldownRaw } else { 0 }
    $utility = Get-CellFuzzy $Row $Header @('Buff / Debuff / Utility','Effect Text')
    $display = Get-CellFuzzy $Row $Header @('Display Text','Effect Text')
    $shortDesc = ($display -replace "`r`n|`n", ' ').Trim()
    if ($shortDesc.Length -gt 240) { $shortDesc = $shortDesc.Substring(0, 240) }
    $aspectAffinity = Get-CellFuzzy $Row $Header @('Aspect Affinity')
    $birdName = Get-CellFuzzy $Row $Header @('Bird')
    $birdKey = Get-BirdKey $birdName
    $isUltimate = ($role -match 'Ultimate') -or ($en -ge 6)
    $isSpecial = ($role -match 'Special') -or ($en -eq 4)
    $unlockTierNorm = Get-NormalizedUnlockTier (Get-CellFuzzy $Row $Header @('Unlock Tier'))
    if (-not $unlockTierNorm -and $role -match 'Basic 1|Basic 2') { $unlockTierNorm = 'Starter' }
    if (-not $unlockTierNorm -and $role -match 'Green') { $unlockTierNorm = 'Green Aspect' }
    if (-not $unlockTierNorm -and $role -match 'Blue') { $unlockTierNorm = 'Blue Class' }
    if (-not $unlockTierNorm -and $role -match 'Purple') { $unlockTierNorm = 'Purple Utility' }
    if (-not $unlockTierNorm -and $role -match 'Gold') { $unlockTierNorm = 'Gold Special' }
    if (-not $unlockTierNorm -and $role -match 'Orange|Ultimate') { $unlockTierNorm = 'Orange Ultimate' }
    $utilityLower = ([string]$utility).ToLower()
    $isUtilityRole = $roleLower -match 'utility|guard|heal|aspect|class|special|ultimate|basic' -and ($utility -or $ap -le 0 -or $dmgType -match 'none')
    $noDamage = ($ap -le 0 -and ($utility -or $isUtilityRole -or $dmgType -match 'none'))
    if ($utilityLower -match 'guard|heal|cleanse|purge|shield|dodge|acc|mdef|lifesteal|marked|none' -and $ap -le 0.01) {
        $noDamage = $true
    }
    if ($dmgType -match '^none$' -and $utility) { $noDamage = $true }
    $mergedText = "$display $utility"
    $hybridScaling = Parse-HybridScalingFromText $mergedText
    $hybridPerHit = Parse-HybridPerHitFromText $mergedText
    $lifestealPct = Parse-LifestealPctFromText $mergedText
    return @{
        id = $Id
        familyId = $FamilyId
        source = $Source
        bird = $birdName
        birdKey = $birdKey
        class = Get-ClassId (Get-CellFuzzy $Row $Header @('Class'))
        aspect = Get-AspectId (Get-CellFuzzy $Row $Header @('Aspect'))
        starterSlot = if ($slotNum -in 1,2) { $slotNum - 1 } else { $null }
        abilitySlot = if ($slotNum -gt 0) { $slotNum - 1 } else { $null }
        role = $role
        level = $Level
        branch = $Branch
        name = (Get-CellFuzzy $Row $Header @('Ability Name'))
        category = $category
        apCost = $en
        enCost = $en
        target = 'enemy'
        hits = $hits
        hitCount = $hits
        baseFlat = 0
        scaleStat = $scaleStat
        scalePct = 0
        damageStat = if ($isHybrid) { 'HYBRID' } else { $scaleStat }
        damageType = $dmgType
        abilityPower = $ap
        heavyAccuracyPenalty = $heavyAcc
        recoilPercent = $recoil
        pierceDef = 0
        pierceMdef = 0
        piercePercent = 0
        ailment = $ail
        ailmentChance = $ailChance
        cooldown = $cooldown
        riderText = $utility
        riders = @()
        tags = @(Get-AbilityTagsFromRow $Row $Header)
        replaces = ''
        shortDesc = $shortDesc
        displayText = $display
        designNote = Get-CellFuzzy $Row $Header @('Design Check','Mutation Improvement')
        aspectAffinity = $aspectAffinity
        unlockTier = $unlockTierNorm
        mutationStage = if ($Branch -eq 'base') { 1 } elseif ($Level -eq 3) { 2 } elseif ($Level -eq 6) { 3 } else { 0 }
        isUltimate = $isUltimate
        isSpecial = $isSpecial
        noDamage = $noDamage
        hybridScaling = $hybridScaling
        hybridPerHit = $hybridPerHit
        lifestealPct = if ($lifestealPct -gt 0) { $lifestealPct } else { 0 }
    }
}
