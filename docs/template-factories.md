# Ability template factories (Phase 13, A.6)

Reduce the per-template boilerplate from ~30 lines to ~3.

```js
const beakSlam = Avian.data.factories.striker({
  id: 'beakSlam',
  name: 'Beak Slam',
  baseDmgMult: 1.15,
  cooldownByLevel: [1, 1, 2, 2],
});
```

## Available factories

| Factory   | Use for                                         | Output type |
|-----------|--------------------------------------------------|-------------|
| `striker` | Single-target physical hit                       | `physical`  |
| `caster`  | Single-target spell with mana cost               | `magic`     |
| `flurry`  | Multi-hit physical, light damage per hit         | `physical`  |
| `applier` | Low-damage hit that primarily applies an ailment | `physical`  |
| `guard`   | Defensive brace / heal / thorns                  | `support`   |

All factories take an `overrides` partial and return a fully-formed
`ABILITY_TEMPLATES` entry. Always pass `id` and `name`. Other defaults
(level-up curves, cooldowns, miss chance) are tuned for "the 80% case";
override anything that needs to differ.

## Why this comes after Phase 3

The factories live in `js/data/template-factories.js` — a leaf data file
loaded BEFORE `js/core/game.js`. Today's templates still live as one
giant literal inside `game.js`; once they're extracted (Phase 3
deferred follow-up), every plain striker / caster / flurry can be
rewritten as a one-liner here.

## Verifying byte-equivalent output

Run:

```bash
node scripts/diff-templates.js HEAD~1 HEAD
```

A successful refactor emits the SAME JSON shape as the previous version
of the entry (just with less source). The diff-templates tool prints
which template ids changed shape vs which only moved.

## Don't use factories for

- Boss / unique abilities with custom callbacks. Their special-case
  handlers live in `ACTIONS` and don't fit a factory shape.
- Multi-effect chains (e.g. "hit + heal + buff in one"). Hand-author
  these and pull only the level curves through a factory if needed.
