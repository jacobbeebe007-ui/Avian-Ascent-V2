# Class-perk deck (Phase 10, B.4)

## What it does today

- After `startGame` runs, draws 4 candidate perk ids for the active
  bird's class via `Avian.systems.classPerks.draw()`.
- Calls `onPickRequested(hand)` — the UI hook — with the hand.
- When committed, pushes the chosen perks onto `G.runClassPerks` so the
  existing perk effect code (untouched by Phase 10) applies them.
- Persists alongside the rest of the player object via `saveRun`.

## What it doesn't do yet

- **No modal UI**. The default `onPickRequested` commits an empty pick
  list so existing balance is unchanged.

## API

```js
Avian.systems.classPerks.handsize         // 4
Avian.systems.classPerks.picksAllowed     // 2
Avian.systems.classPerks.draw()           // [perkId, perkId, perkId, perkId]
Avian.systems.classPerks.isPending()      // true at run start, false after commit
Avian.systems.classPerks.commit([id1, id2])
Avian.systems.classPerks.onPickRequested = function (hand) { … }
Avian.systems.classPerks.inspect()
```

## Wiring the modal

```js
Avian.systems.classPerks.onPickRequested = function (hand) {
  // populate <div id="class-perk-deck-modal">…</div>
  // attach data-action="toggleClassPerkPick:<id>" on each card
  // attach data-action="confirmClassPerkPicks" on the submit button
};

Avian.actions.register('confirmClassPerkPicks', function () {
  const picks = readSelectedClassPerkIds(); // up to picksAllowed
  Avian.systems.classPerks.commit(picks);
  closeClassPerkModal();
});
```

## Pool customisation

By default the deck pulls from `bird.defaultClassPerks`. You can also
register class-level pools:

```js
Avian.data.classPerkPool = {
  predator: ['stalker', 'gore-fang', 'finisher', 'fearmonger', 'second-bite'],
  caster: ['focus', 'cantrip', 'mana-flow', 'arcane-shield', 'spell-pierce'],
  // …
};
```

Pools merge: bird-level entries take precedence over class-level ones.
