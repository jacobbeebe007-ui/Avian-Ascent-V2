# Bird Rework Rules (Source Notes)

This file records the implemented design rules used by the bird registry rework and reference guide updates.

## Class skill-shape guides

- **Trickster:** Usually 1 mixed ATK+MATK skill, 1 song/call debuff/ailment, 1 physical attack, 1 utility.
- **Singer:** Usually 1 main song/call, 1 heavier song/call, 1 physical attack, 1 utility.
- **Tank:** 2 attacks (1 EN + 2 EN), 1 defense utility (1 EN), 1 heal utility (2 EN, scales from Max HP%).
- **Striker:** Usually 1 multi-attack, 1 premium precision attack, 1 dodge/mdodge utility, 1 speed/setup utility.
- **Bruiser:** Usually 2 physical attacks (1 EN + 2 EN), 1 defense utility, 1 debuff utility/call.
- **Predator:** 3 physical attacks + 1 utility; large/XL finishers adapt to 2 EN.

## Shared implementation guidance

- Fear/Confusion/Weaken are reserved primarily for songs/calls.
- Attack branches can evolve toward damage, partial SPD scaling, pierce, crit focus, Bleed, Poison, Burning, Chilled, or Delayed.
- Utility branches can improve evasion, speed, accuracy, anti-dodge, or duration; utilities should not become songs/calls.
- Skill evolution structure: each base skill branches once into 1 of 3 options; later tiers stay in that chosen branch.

## Status/ailment model targets

- **Fear:** refresh-only control/disruption.
- **Weaken:** refresh-only, -25% damage and -40% Dodge.
- **Chilled:** stacks to 5, -8% SPD per stack; at 5 converts to Frozen.
- **Frozen:** refresh-only; active skills cost +1 EN for 1 turn; Chilled resets afterward.
- **Poison:** stacks to 5, deals 2 damage per stack, ticks at end of both turns.
- **Burning:** non-stacking, 7 flat damage end of enemy turn, -20% DEF/-20% MDEF while active.
- **Bleed:** non-stacking, refresh-only, healing reduced by 30%.
- **Delayed:** non-stacking, detonates end of target's next turn, reapply refreshes/replaces.

## Unlock policy for newly added birds

- Newly added birds without sprites remain sprite-less and are locked for normal progression.
- These birds are unlockable through the `birdwatching` code path.

## Striker family tree cadence

- Striker skill family trees upgrade at **Lv 3 / Lv 6 / Lv 9** milestones.
- The in-game reference guide keeps a synchronized tree summary under Mechanics.
