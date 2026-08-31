# Status verbs (Phase 7, ailment migration)

## What it solves

The legacy `js/data/ailments.js` table is shape-only metadata; the actual
behavior of every ailment lives scattered across `tickStatuses` (in
[`js/core/game.js`](../js/core/game.js)) and 80+ ad-hoc `if (status.bleed)`
flag checks across combat code. New ailments are nearly impossible to
add without touching ten unrelated files.

The verb system gives every status a single owner: a registration with
`onApply`, `onTick`, and (optionally) `onConsume` hooks. Combat code
calls a few well-named entry points; anything not registered keeps the
old behavior (additive, non-breaking).

## API

Registered in [`js/systems/systems.js`](../js/systems/systems.js):

```js
Avian.statuses.register('bleed', {
  onApply  (target, { ability }) { /* fires after tryApplyAilment succeeds */ },
  onTick   (target, stacks)      { /* fires after tickStatuses() */ },
  onConsume(target, stacks, src) { /* fires from Avian.statuses.consume() */ },
});

Avian.statuses.consume(target, 'bleed', { ability });
Avian.statuses.peek(target, 'bleed');
```

## Migration order (per the plan)

`delayed` → `bleed` → `poison` → `burning` → `weaken` → `paralyzed` →
`chilled`. One per commit; revert that single commit if the smoke/run-balance
diff regresses.

## Per-ailment migration recipe

1. Add a registration in a new file `js/data/statuses/<id>.js` (or inline
   in `js/systems/systems.js` if it stays small):

   ```js
   Avian.statuses.register('bleed', {
     onTick(target, value) {
       const stacks = (value && value.stacks) || 0;
       const maxHp = /* target stats.maxHp */;
       const dmg = calcBleedTickDmg(maxHp, stacks);
       applyAilmentDamage(target, dmg, {
         ailmentId: 'bleed',
         icon: '🩸',
         floatClass: 'fn-dmg',
         logText: '🩸 Bleed deals {dmg} to {name}!',
       });
     },
     onConsume(target, stacks, src) {
       return { bonusMult: 0.5 + Math.min(0.5, stacks * 0.05) };
     },
   });
   ```

2. Find the legacy boundary tick code in `tickStatuses` (around line 11775)
   that handles this ailment and **shrink** it: leave the bookkeeping
   (decrement, removal) where it is, but move the *damage / debuff* logic
   into `onTick`. The dispatcher fires `onTick` AFTER the legacy code, so
   the math runs the same way.
3. Update one or two abilities that "consume" the status to call
   `Avian.statuses.consume(...)` and read the returned `bonusMult`.
4. Run the per-phase ritual:
   ```bash
   node scripts/build-bundle.js
   node --check js/avian-game.bundle.js
   node scripts/ci-check.js
   node scripts/smoke.js
   node scripts/run-balance.js   # once a real simulator lands
   ```
5. Manually play a battle with the migrated ailment.
6. **Revert this commit** if anything regresses; migration is per-commit
   for exactly this reason.

## Why one ailment at a time

Combat math has implicit cross-effects (e.g. Bleed's damage feeds
Resonance which feeds player passives). Migrating two at once makes
attribution impossible when win-rates shift. Single-commit migrations
keep the bisect window tiny.

## Status quo (today)

- `Avian.statuses.register / consume / peek` are wired.
- The dispatcher fires `onApply` after every successful
  `tryApplyAilment` and `onTick` after `tickStatuses` per side.
- Zero ailments are migrated yet — current combat is byte-identical to
  pre-Phase-7. Migration commits land later as Phase 7.X.
