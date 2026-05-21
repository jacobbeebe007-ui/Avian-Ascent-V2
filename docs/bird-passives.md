# Bird Passives

Replaces the older class-perk deck. With the May 2026 combat rewrite, each
playable bird carries exactly one **fixed normal-mode passive perk** plus up to
four **Endless ranks** of upgrades to that perk. Both layers are sourced from
`avian_ascent_passive_perks.xlsx` and authored as data, not hand-coded JS.

## Loading flow

```
avian_ascent_passive_perks.xlsx
   ↓ scripts/import-combat-content.mjs
js/data/combat-pack/bird-passives.js           // 44 normal-mode perks
js/data/combat-pack/endless-passives.js        // 176 bird Endless ranks + 24 generic
   ↓ js/systems/combat-pack-boot.js
BIRDS[birdKey].passive  = { id, name, desc, trigger }     // joined onto base bird stats
Avian.passives.onPlayerAbilityUse(ab, ctx)                // trigger router
```

`combat-pack-boot.js` runs after `game.js` and replaces every legacy
`BIRDS[*].passive` blob with the row from `Avian.data.combatPack.birdPassives`
that has `birdKey === <bird>`. The old `CLASS_PERK_DEFS` / `CLASS_PERK_BY_CLASS`
maps are emptied at boot so legacy perk lookups starve to no-ops.

## Trigger taxonomy

`js/systems/passive-hooks.js#classifyTrigger` maps the free-text "Trigger /
Condition" cell into a token the router can gate on. Matchers (see the function
for the authoritative list):

| Phrase fragment in spreadsheet                                    | Kind                          | Cap     |
| ----------------------------------------------------------------- | ----------------------------- | ------- |
| "Once per turn after using a multi-hit Physical"                  | `afterMultiHitPhysical`       | turn    |
| "Once per turn after using a 1 AP ability"                        | `after1ApAbility`             | turn    |
| "Once per turn after using a 2 AP"                                | `after2ApAbility`             | turn    |
| "First Magic Song used each battle"                               | `firstMagicSongBattle`        | battle  |
| "Once per turn when a Magic Song does not apply its ailment"      | `magicAilmentFailed`          | turn    |
| "Once per turn when the first hit of a Physical ability lands"    | `firstHitLanded`              | turn    |
| "First damaging Physical ability used against an enemy without Bleed" | `firstAttackVsNonBleeding` | battle  |
| "When using a Physical ability against a Bleeding enemy"          | `physicalVsBleeding`          | —       |
| "Once per turn when an ability lands a crit" / "on crit"          | `onCrit`                      | turn    |
| "Once per turn after using a Utility"                             | `afterUtility`                | turn    |
| "Once per turn at the start of your turn"                         | `turnStart`                   | turn    |
| "below 50% Health" / "low HP"                                     | `lowHp`                       | —       |
| "Once per turn when the player is hit"                            | `onHit`                       | turn    |
| "Once per battle"                                                 | `oncePerBattle`               | battle  |

Anything not matched produces `{ kind: 'unknown' }` and the passive simply
no-ops at runtime — the importer keeps the row around for the Codex and
display.

## Effect taxonomy

`classifyEffect()` recognises the numerical bonuses called out by the
spreadsheet's "Base Passive Effect":

* `+N% Dodge` → `gainDodge`
* `+N% Speed` → `gainSpeed`
* `+N% Crit Chance` → `gainCritChance`
* `+N% Crit Damage` → `gainCritDamage`
* `+N% Magic Attack` → `gainMatk`
* `+N% Physical Attack` → `gainAtk`
* `+N% Magic Ailment Chance` → `ailmentChanceBonus` (magic filter)
* `+N% Bleed chance` → `ailmentChanceBonus` (bleed filter)
* `deal +N% Physical damage` against bleeding → `bonusVsAilment` (bleed)

Effects are buffered onto `G.playerStatus` and decayed by
`Avian.passives.onPlayerTurnStart(player)`. Per-bird state is keyed in
`G.passiveState[birdKey:passiveId] = { firedThisTurn, firedThisBattle }`.

## Endless ranks

`bird-passives.js` covers normal-mode kits. Endless adds four ranks per bird
(`Avian.data.combatPack.endlessPassives.bird`) plus a class-wide pool of 24
generic upgrades (`endlessPassives.generic`). Today the boot file exposes the
data; the Endless-mode UI consumes it directly to populate choices and the
router routes the upgraded effect strings through the same `classifyEffect`
matchers. See [endless-mode-scaling.md](endless-mode-scaling.md) for how the
endless economy gates which ranks are offered.

## Authoring workflow

1. Edit `c:/Users/JaK_d/Desktop/Avian Ascent/avian_ascent_passive_perks.xlsx`.
2. Run `node scripts/import-combat-content.mjs` — emits 7 data-pack files.
3. Run `node scripts/build-bundle.js` — bundles the data into
   `js/avian-game.bundle.js`.
4. No JavaScript changes needed unless a new trigger / effect kind appears that
   `classifyTrigger` / `classifyEffect` can't pattern-match yet — add a matcher
   in `js/systems/passive-hooks.js` and document it here.
