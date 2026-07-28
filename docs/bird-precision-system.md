# Bird Precision System

Pack stamp: `2026.07-bird-precision`

## Summary

Precision is restored as a derived bird combat stat, separate from the seven core attributes. Every bird has an individual Base Precision from class, size, and species. Runtime continues to store the value on `stats.acc` for compatibility; the player-facing name is **Precision**. Nest and combat Stats show the value again (no longer forced to 0).

## What changed

| Area | Before | After |
| --- | --- | --- |
| Bird Base Precision | v0.6 `acc: 0` (skill-owned only) | Class + Size + Species (65–95) |
| Hit baseline | LEG-022: `100 − Dodge − skillPenalty` | `Final Attack Precision − Dodge − skillPenalty` |
| Class baselines | Unused / invent fallbacks | 8 authoritative Class Precision values |
| Size | Optional miss adj | Once in Base Precision only |
| Rogue Tempo | +6% damage on first Basic | +10 Precision on first Weapon Skill 1; Armour break → +4 Agility |
| Passive wording | Minor/Major Precision Up | Exact ±5 / ±10 / ±20 |
| Runtime field | `acc` (shown as Precision) | Still `acc` (rename to `precision` deferred) |

## Formulas

```
Base Precision = Class Precision + Size Modifier + Species Modifier
Final Attack Precision = Base Precision + Equipment + Weapon + Skill + Active Up − Active Down
```

## Import

Authoritative table: `scripts/data/bird-precision-system.json`

```bash
npm run apply-precision   # patches birds-v2 / birds.js / roster / classes / size / families + workbook
npm run verify-precision
npm test
```

When the master / equipment workbook includes `Base Precision` (or Class/Size/Species Precision columns), `import-equipment-workbook.mjs` and `import-master-workbook.ps1` prefer those columns and fall back to the JSON table.

Workbook artifact: `Avian_Ascent_Bird_Precision_System.xlsx` (Class / Size / Bird Stats / Weapon Families / Loadout Builder / Audit / Change Log).

## Key files

- Data: `scripts/data/bird-precision-system.json`, `js/data/precision-system.js`, `js/data/birds-v2.js`, `js/data/birds.js`, `js/data/size-chart.js`, `js/data/enemy-roster.js`
- Import: `scripts/apply-bird-precision.mjs`, `scripts/import-equipment-workbook.mjs`, `scripts/import-master-workbook.ps1`, `scripts/import-master-bird-content.mjs`
- Runtime: `js/core/game.js`, `js/systems/combat-formulas.js`, `js/systems/class-perk-runtime.js`, `js/systems/enemy-ai.js`
- Verify: `scripts/verify-bird-precision.mjs`

## Deferred

A later migration may rename runtime `acc` → `precision` across bird data, combat, AI, UI, saves, and tests in one pass. Until then, `acc` remains the compatibility field.
