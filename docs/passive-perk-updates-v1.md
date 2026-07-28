# Passive & Class Perk Updates (v1)

Authoritative content: `scripts/data/passive-perk-updates-v1.json`.

Apply with:

```bash
node scripts/apply-passive-perk-updates.mjs
node scripts/build-bundle.js
node scripts/verify-passives-perks.mjs
```

## Class perks

| Class | Perk | Combat behaviour |
| --- | --- | --- |
| Knight | Bulwark Oath | After Fortify / Armour Restoration → +4 Guard until next turn (once/turn) |
| Rogue | Rogue Tempo | First Weapon Skill 1 while acting first → +10 Precision; Armour break → +4 Agility |
| Mage | Arcane Pressure | First Magic weapon skill → +10% damage to Magic Armour only (not Health) |
| Siren | Cursed Call | After breaking Magic Armour → next ailment/debuff +10% app chance and +1 turn |
| Inquisitor | Judgement Leech | After Health damage to ailmented/debuffed/Marked → restore 2 to lower pool (or 5% Max HP) |
| Bard | Verse and Chorus | Martial↔Magic damaging alternation → restore 2 to lower pool (or +10 Skill Power) |
| Brute | Crushing Momentum | After Armour absorbs physical → next Strength weapon skill +10 Skill Power |
| Duke | Duke Ascension | On kill → restore 25% max Armour + Magic Armour and +5% all damage (stacks) |

## Species

All 52 bird passives and innate utilities were rewritten for protection pools, Skill Power, Marks, Fortify/Ward, and flat Precision points. Runtime hooks live in `js/systems/passive-hooks.js` and `js/systems/class-perk-runtime.js`.
