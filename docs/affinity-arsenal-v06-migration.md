# Affinity Arsenal v0.6 Migration

Migrates Avian Ascent from equipment v0.3 combat identity to workbook
`Newest Avian_Ascent_Master_Affinity_Ailments_and_Arsenal_v0.6.xlsx`.

## Pack stamp

- `Avian.data.combatConfig.packVersion` = `2026.07-affinity-arsenal-v0.6`
- Save schema **v14** stamps `affinityArsenalPackVersion`
- Flag: `Avian.flags.affinityArsenalV06` (default on)

## What changed

| Area | v0.3 | v0.6 |
| --- | --- | --- |
| Typing | Aspect terra/aeris/… | Affinity Earth/Sky/… with aliases |
| Effect tiers | 10/25/50 | 6/8/12 (+ point tiers 3/5/8) |
| Damage | EN×AP×StatMod(/50) | Base + FinalStat×fixed coeff |
| Defence | 100/(100+3×Def) | C/(C+EffDef), C=100 WD |
| Ailments | Burn→Scorched@3 | Burn→Incinerating→Scorched@5; Shock→Paralysed; Control Resistance |
| Orbs | Generic Focus Orb | 6 focuses + 18 COMBO_* techniques |
| Skills | 64 | 82 |
| Language | Guard=DR | Guard=Martial DEF; Brace=temp DR; Barrier=temp HP |

## Import

```bash
# Dump workbook sheets to JSON (once), then:
AA_V06_DUMP_DIR=/tmp/aa_wb_v06 npm run import-affinity-arsenal
npm run verify-affinity-arsenal
```

## Explicit deferrals

- Bow / Hand Crossbow six-rarity item rows are **not** invented (`familyConfirmedContentPending`).
- Working Draft numerics live only in `js/data/combat-config.js`.

## Key files

- Data: `js/data/aspects.js`, `affinities.js`, `effect-tiers.js`, `ailment-families.js`,
  `equipment/{orb-focuses,combinations,weapon-access}.js`, `progression/*`,
  `enemy-scaling-profiles.js`, `display-glossary.js`
- Runtime: `affinity.js`, `bird-progression.js`, `combat-formulas.js`, `ailment-engine.js`,
  `equipment-actions.js`, `equipment-effects.js`, `equipment.js`, `ability-display.js`
- Verify: `scripts/verify-affinity-arsenal-content.mjs`
