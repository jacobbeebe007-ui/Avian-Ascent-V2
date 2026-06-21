# Aspect Audit Report

Generated: 2026-06-21 (implementation pass)

## All Aspects

- **Terra** (`terra`) — Earth / Ground
- **Aeris** (`aeris`) — Sky / Wind
- **Tempest** (`tempest`) — Storm / Lightning
- **Solis** (`solis`) — Day / Sun
- **Lunae** (`lunae`) — Night / Moon
- **Maris** (`maris`) — Water / Sea

## Matchup modifiers

| Result | Multiplier |
|--------|------------|
| Strong (Dominant) | 1.2× |
| Neutral / Same | 1× |
| Weak (Resisted) | 0.8× |

Source: Master Workbook `Master Aspects` sheet (workbook values override generic 1.25/0.75 defaults).

## Matchup table (attacker → target)

| ↓ / → | Terra | Aeris | Tempest | Solis | Lunae | Maris |
|-------|-------|-------|---------|-------|-------|-------|
| **Terra** | neutral | resisted | dominant | dominant | neutral | resisted |
| **Aeris** | dominant | neutral | resisted | resisted | dominant | neutral |
| **Tempest** | resisted | dominant | neutral | neutral | resisted | dominant |
| **Solis** | resisted | dominant | neutral | neutral | dominant | resisted |
| **Lunae** | neutral | resisted | dominant | resisted | neutral | dominant |
| **Maris** | dominant | neutral | resisted | dominant | resisted | neutral |

## Birds missing aspects

None — all 52 playable birds in `js/data/birds.js` have a valid `aspect` and `aspectTheme`.

## Birds with invalid aspect names

None.

## Damaging abilities with no resolvable aspect

None expected at runtime — damaging abilities use `aspect` from `Bird Ability List` / `Ability Mutation Trees`, or fall back to bird primary aspect when `aspectAffinity` is class-neutral.

Workbook audit: 258 damaging abilities with `Aspect` set; 0 missing; 106 utility/non-damage rows (aspect optional).

## Abilities missing aspect fields (raw data)

Mutation-tree rows store `aspectAffinity` (often `None / Class-Neutral`) rather than a dedicated `aspect` column on every row. Runtime resolves via `resolveAttackAspect()` → bird aspect fallback. This is by design.

## Enemy rows with unresolvable aspect

Enemy roster rows store `"aspect":""` because the `Enemy Birds` sheet has no `Primary Aspect` column. Runtime inherits via `getEntityAspect()` → `BIRDS[birdKey].aspect`. No manual fixes required unless a birdKey is missing from `birds.js`.

## Chart vs definition mismatches

None — `js/data/aspects.js` chart and `definitions.*.strongAgainst` / `weakAgainst` are parsed from the same `Master Aspects` sheet.

## Runtime multiplier sanity checks

- Strong (aeris vs terra): 1.2×
- Weak (terra vs aeris): 0.8×
- Neutral / same: 1×
- Invalid aspect: 1× (no crash)

Verified in `scripts/test-aspects.mjs`.

## Direct damage vs DoT

- Aspect modifier applied inside `calculateDamage()` only (`aspectMod` / `typeMod` on direct hits).
- Poison, bleed, burning, and delayed ticks use `js/systems/ailment-engine.js` — no aspect multiplier.
- Healing, shielding, ultimate meter, and passive damage are not aspect-modified.

## Hard-coded aspect logic (centralized)

| Location | Status |
|----------|--------|
| `js/data/aspects.js` | Central chart + definitions (generated) |
| `js/systems/combat-formulas.js` | `getAspectMultiplier`, `getAspectRelationship`, `resolveAttackAspect` |
| `scripts/import-master-workbook.ps1` | Parses `Master Aspects` sheet |
| Legacy hard-coded chart block | **Removed** — now sheet-driven |

## Manual review

- Re-import after workbook edits: `.\scripts\import-master-workbook.ps1`
- Legacy Node importers do not emit aspects — use PowerShell master workbook importer only.
- Eight filler birds (chickadee, dodo, dove, finch, kakapo, pigeon, rockDove, rockPigeon) have bird aspects but limited combat-pack kits.
