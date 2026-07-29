# Physical Ailments v1.5

Source workbook: `Avian_Ascent_Current_Master_v1.5_Physical_Ailments.xlsx`

## Pack stamp

- `Avian.data.combatConfig.packVersion` = `2026.07-equipment-v1.5-physical-ailments`
- Flag: `physicalAilmentsV15`

## New stacking families

| Base | Max | Per stack | Resolved @ 5 |
| --- | --- | --- | --- |
| Fracture | 5 | −2 Guard, −4% Armour restore | Shattered (2t: −10 Guard, −25% Armour/Fortify healing, +3 phys pen vs target) |
| Crippled | 5 | −2 Agility, −2 Dodge | Immobilised (1t: Dodge 0%, block mobility/evasive utilities) |
| Dazed | 5 | −4 Precision, −2 Skill Power | Concussed (−20 Precision, −15 Skill Power; next offensive +1 EN; Basic Attack stays 1 EN) |

All three are Physical / Armour-gated (same-hit Health damage required).

## Equipment riders

| Skill | Family | Change |
| --- | --- | --- |
| WSK-009 Crushing Peck | Beak Hammer | 100% power; apply 1 Dazed |
| WSK-020 Crippling Shot | Bow | 95% power; apply 2 Crippled |
| WSK-026 Sundering Wing | Greatblade | 125% power; apply 2 Fracture |

## Import

```bash
npm run import-equipment-v12
npm test
```
