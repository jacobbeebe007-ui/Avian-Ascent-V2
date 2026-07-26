# Weapon-First v0.9 Migration

Migrates Avian Ascent from Equipment Loot v0.7 to workbook
`Newest_Avian_Ascent_Master_v0.9_Base_Stats_Implemented.xlsx`.

## Pack stamp

- `Avian.data.combatConfig.packVersion` = `2026.07-weapon-first-v0.9`
- Save schema **v16** stamps `weaponFirstPackVersion` and wipes equipment loadouts
- Flags: `weaponFirstV09` (on), `equipmentLootV07` (off)

## What changed

| Area | v0.7 | v0.9 |
| --- | --- | --- |
| Core attributes | Hybrid flat + %; Vitality≈HP | Flat only; Dexterity added; Vitality→Max HP |
| Base Health | Shared +20 rebase, large baked HP | Size bands 8–18 (Boss 20) |
| Damage | BaseDamage + Stat×coeff×0.75 | Weapon range × ((SkillPower + Stat×2.5)÷100) |
| Natural Strike | 0.8 coeff EN path | Flat 1–2 + 100% Skill Power of weapon |
| Defence | C=150 constant | Rating=Def×2.5; mit%=rating/(100+rating); cap 75% |
| Dodge | Separate Evasion % (cap 20/35) | Agility×0.5%, cap 50% |
| Effect tiers | Core % 6/8/12 | Flat ±4 / ±10 / ±20 |
| NPC Standard | Same formulas; profile mults | Same formulas; Standard mults stay 1.0 |

## Import

```bash
AA_EQUIPMENT_WORKBOOK="$HOME/Documents/Avian Ascent/Avian Workbooks/Newest_Avian_Ascent_Master_v0.9_Base_Stats_Implemented.xlsx" \
  npm run import-equipment
npm test
```

Default path for `npm run import-equipment` is the v0.9 Implemented workbook above.

## Key files

- Data: `js/data/equipment/*`, `js/data/birds-v2.js`, `js/data/effect-tiers.js`, `js/data/combat-config.js`
- Runtime: `combat-formulas.js`, `bird-progression.js`, `equipment.js`, `equipment-actions.js`, `equipment-effects.js`
- Save: `js/systems/save-migrations.js` (schema 16)
- Verify: `scripts/verify-equipment-*.mjs`, `scripts/fixtures/equipment-damage-fixtures.json`

## Open decisions (locked for this ship)

- Natural Strike = flat **1–2** + **100%** weapon Skill Power
- Round damage once at the end
- Bosses stay at the **75%** mitigation cap
- Progression pace retained; equipment contributions are flat-only
