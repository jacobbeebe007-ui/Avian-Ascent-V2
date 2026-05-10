# QoL: replay seeds, personal bests, action queue (Phase 12, B.6)

Three small additions, all live in
[`js/systems/qol.js`](../js/systems/qol.js). All default-passive — they
expose data; UI plumbing is a follow-up.

## Replay seeds

```js
Avian.systems.replaySeed.start();              // call at run start (auto via systems.js hook)
Avian.systems.replaySeed.current();            // 'a1b2c3d4e5f6-deadbeef'
Avian.systems.replaySeed.shareString();        // 'avian:story:sparrow:stage7:a1b2c3d4e5f6-deadbeef'
Avian.systems.replaySeed.parseShareString(s);  // → { mode, bird, stage, seed }
```

The seed is hash-prefixed with the bundle hash so seeds embed the code
version (avoids cross-build "why doesn't this replay work" confusion).

UI hookup: add a "Share run code" button on the run-summary screen with
`data-action="copyRunSeed"`; register the action with:

```js
Avian.actions.register('copyRunSeed', function () {
  const s = Avian.systems.replaySeed.shareString();
  if (s && navigator.clipboard) navigator.clipboard.writeText(s);
});
```

## Personal bests

```js
Avian.systems.personalBest.get('sparrow');                // null or { stages, durationSec, recordedAt }
Avian.systems.personalBest.record('sparrow', 12, 920);    // → { isPersonalBest, deltaStages, deltaSeconds, previous }
```

Stored in localStorage under `avianAscent_personal_bests`. Wire `record`
into the existing run-end summary (`renderUnlockPopupsOnGameover` is the
likely call site) and surface the returned diff in a small `+/-` badge.

## Action queue preview

```js
Avian.systems.actionQueue.preview();
// → { player: { id, name } | null, enemy: { id, name } | null, stage, turn }
```

The player half reads `G.player._queuedAbilityId`; the battle UI is
expected to set that whenever the player selects an ability before
confirming. The enemy half reads the existing `G.enemyNextAction`.

UI hookup: add a "Next" row above the action grid that shows both
icons / names. No combat-loop changes required.

## Why default-passive

Replay seeds and personal bests are write-only without UI; they grow a
clean dataset starting today even if the front-end hasn't shipped yet.
When the UI lands later, every run already has a seed + PB record to
display.
