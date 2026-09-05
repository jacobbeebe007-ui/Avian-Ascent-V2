# Combat Foundation v2.1 — Merged Master

Authoritative workbook: `Avian_Ascent_Current_Master_v2.1.xlsx`

Merged from:

- `Avian_Ascent_Combat_Workbookv2.1.xlsx`
- `Avian_Ascent_Bird_Precision_System.xlsx`
- `Avian_Ascent_Current_Master_v1.6_Structured_Effects Updated.xlsm`

Rebuild: `npm run build-master-v21`  
Verify: `npm run verify-v21-foundation`

## Live now (current runtime)

| System | Rule |
| --- | --- |
| Hybrid damage | Mean-pool Health gate. Portions still chip matching pools. A 50/50 hybrid vs 20/20 deals 20 Health, not 0. |
| Affinity | Dominant ×1.10 / Neutral ×1.00 / Resisted ×0.90. |
| Ultimate Meter | 6 × AP, once per landed action, not per hit. Utility 0. Cap 24/turn. |
| Sequential encounters | Health, AP, buffs, player ailments and meter persist. Protection refills to normal max. Fortify/Ward overflow expires. |
| Energy / AP max | 6 (matches `PLAYER_ENERGY_MAX`). |

## Locked in the workbook, not yet switching live formulas

| System | Rule | Why it waits |
| --- | --- | --- |
| Attack Power | Weapon roll + 2 × scaling stat | Replacing weapon-first 2.5% without the new Health band one-shots or stalls every fight. |
| Health | Size 125–140 + 5×VIT + 5×(Level−1) | Must land with Attack Power. |
| Ordinary cooldowns | 0 (AP is the limiter) | Unsafe on the old damage curve. Set `combatConfig.v21.ordinaryCooldownsRuntime` when Phase 1 is live. |
| 3 AP coefficient | 1.50 (was 1.55) | Applies when Attack Power coefficients replace Skill Power %. |
| 52-bird identity pass | Barn Owl → Rogue locked; passives/loadouts still required | Foundation table is in Bird Recalibration. |

## AP expectation tests (Attack Power 21.5)

- Four 1 AP (38.7) lose to one 4 AP (45.15). Packed damage also overflows protection better.
- Two 2 AP (43.0) lose slightly to one 4 AP.
- Repeating 3 AP is 0.50 damage/AP — same as 2 AP. The old 1.55 coeff is rejected.
- Alternating 2 and 4 is 33.3/turn, slightly above 3 AP spam.
- One Major buff then three attack turns beats 3 AP spam.
- Rogue 1 AP refund is once/turn, first-actor, non-Basic, no chain.
- 4×1 AP and one 4 AP both grant 24 meter.
- Fortify/Ward (4 AP) cannot repeat after a normal 3 AP recovery.

## Next telemetry

At least **200 runs per matchup**. Required counters: `actionChosen`, `unusedAP`, `fortify`, `ward`, `ailmentAttempt`, `ailmentOk`, `ailmentGated`. Do not use the old 50-run Story pack to validate v2.1.
