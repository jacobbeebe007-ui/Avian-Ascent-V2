# Basic Starting Weapons (Equipment v1.3)

Source workbook: `Avian_Ascent_Current_Master_v1.5_Physical_Ailments.xlsx` (supersedes v1.4 Basic Starting Weapons)

## Pack stamp

- `Avian.data.combatConfig.packVersion` = `2026.07-equipment-v1.5-physical-ailments`
- Save schema **v18** grants class Basic starters when `mainHand` is empty
- Data: `js/data/equipment/starting-weapons.js`

## Class → starting weapon

| Class | Item ID | Name | Category | Scaling | Range |
| --- | --- | --- | --- | --- | --- |
| Mage, Siren | WPN-B01 | Tail Wand | Magical | Focus | 1–2 |
| Knight, Brute | WPN-B02 | Beak Stab | Physical Strength | Might | 2–3 |
| Bard | WPN-B03 | Broken Song | Magical | Focus | 1–2 |
| Rogue | WPN-B04 | Talon Scratch | Physical Finesse | Dexterity | 1–2 |
| Inquisitor | WPN-B05 | Plume Syphon | Magical | Focus | 1–2 |

Basic starters grant **no** Weapon Skill 1 / Skill 2. They only supply the equipped Basic Attack.

## Enemy parity

Enemy birds of each class receive the **same** Basic starting weapon and named Basic Attack as their player counterparts:

- Combat: `assignEnemyEquipmentLoadout` → `ensureStartingWeapon` when `mainHand` is empty (story stages 1–3 empty bag, or any loadout missing a main hand).
- Preview / nest tooltips: `ensureEnemyPreviewEquipmentState` rolls the same recipe and grants the class starter so UI matches combat.

## Basic Attack rule

- Every equipped weapon provides a **1 EN, 100% weapon-damage** Basic Attack.
- This replaces the old universal Natural Strike / Beak Jab flat 1–2 while a weapon is equipped.
- Unarmed fallback (no main hand) remains flat 1–2 for edge cases.

## Import

```bash
npm run import-equipment-v12
npm test
```
