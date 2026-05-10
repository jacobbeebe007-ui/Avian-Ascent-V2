# Mid-run tier picks (Phase 9, B.1)

## What it does today

- Detects when the player enters stage 4, 8, or 14.
- Reads the active bird's [`js/data/ability_family_tree.js`](../js/data/ability_family_tree.js)
  entry and produces a list of tier picks for that stage.
- Calls `Avian.systems.tierPick.onPickRequested(stage, options)` so a UI
  layer can render a modal.
- Stores picks on `G.player._tierPicksMade[stage]` so they persist with
  the save (no schema change needed; the field is additive).

## What it intentionally doesn't do yet

- **No modal UI**. The default `onPickRequested` auto-skips, which keeps
  today's balance unchanged (every existing run continues to play
  identically). When the modal lands, override `onPickRequested` to
  render the existing skill-slot UI and call `commit(stage, pickId)`
  on confirm.

## API

```js
Avian.systems.tierPick.pickStages          // [4, 8, 14] — mutable
Avian.systems.tierPick.isStageDue(4)       // true once per run
Avian.systems.tierPick.optionsForStage(4)  // [{ id, label, ability }, …]
Avian.systems.tierPick.commit(4, 'family:path:1')
Avian.systems.tierPick.onPickRequested = function (stage, options) { … }
Avian.systems.tierPick.inspect()
```

The trigger fires from `systems.js` by wrapping `applyBiomeModifiers`
(which already runs once per stage change). No other game-loop changes.

## Wiring the modal (next session)

1. Add a modal in [`index.html`](../index.html) (`<div id="tier-pick-modal">…`).
2. Register a renderer:

   ```js
   Avian.systems.tierPick.onPickRequested = function (stage, options) {
     // populate modal, show it, attach data-action="confirmTierPick:<id>"
   };
   Avian.actions.register('confirmTierPick', function (pickId) {
     const stage = G && G.stage;
     Avian.systems.tierPick.commit(stage, pickId);
     // close modal, apply pick to player.familyEvolutionState
   });
   ```

3. Persist the pick into the existing `familyEvolutionState` shape so
   `syncPlayerAbilitiesFromSkillSlots` picks it up automatically.
