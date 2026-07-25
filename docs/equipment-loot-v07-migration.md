# Equipment Loot v0.7 Migration

Migrates Avian Ascent from Affinity Arsenal v0.6 percentage-only equipment to
workbook `v7Newest_Avian_Ascent_Master_v0.7_Equipment_Loot_SyncReady.xlsx`.

## Pack stamp

- `Avian.data.combatConfig.packVersion` = `2026.07-equipment-loot-v0.7`
- Save schema **v15** stamps `equipmentLootPackVersion` (+ retains affinity arsenal stamps)
- Flag: `Avian.data.combatConfig.equipmentLootV07` (default on)

## What changed

| Area | v0.6 | v0.7 |
| --- | --- | --- |
| Equipment core | Percentage only | Hybrid flat + percentage |
| Calc order | … → Tier → Equipment % → Temp | … → Tier → Equipment Flat → Equipment % → Temp |
| Skills | 82 | 96 (expanded pairs/combos) |
| Combinations | 18 Orb COMBO_* | 25 COMBO_* + matching Focus / martial pairs |
| Cooldown | Varied; sometimes budget | Fixed by EN (1–2→0, 3→1, 4→2, 6 Ultimate) |
| Damage bands | v0.6 coefficients | R-EN-005 (1 EN 70–90% … 6 EN 235–280%) |
| Penetration | Ignore Guard (+ incomplete Resolve) | Separate Ignore Guard / Ignore Resolve; 40% shared cap |

## Import

```bash
AA_EQUIPMENT_WORKBOOK="$HOME/Documents/Avian Ascent/Avian Workbooks/v7Newest_Avian_Ascent_Master_v0.7_Equipment_Loot_SyncReady.xlsx" \
  npm run import-equipment
npm test
```

## Explicit deferrals

- Bow / Hand Crossbow / Hook Axe / War Pick / Ailment Reliquary named catalogue rows are **not** invented (`familyConfirmedContentPending`).
- Energy carryover remains Working Draft (`R-EN-004`).
- Flat/percentage budget cost proxies may warn during import when sheet Stat Cost formulas are uncached.

## Key files

- Data: `js/data/equipment/{items,skills,families,combinations,weapon-access,reference-loadouts,slots}.js`,
  `js/data/progression/rules.js`, `js/data/combat-config.js`, `js/data/effect-tiers.js`
- Runtime: `bird-progression.js` (`equipmentFlat` then `%`), `equipment.js`, `equipment-actions.js`
- Verify: `scripts/verify-equipment-content.mjs`, `scripts/verify-affinity-arsenal-content.mjs`
- Workbook patch helper: `scripts/patch-v07-workbook.py`
