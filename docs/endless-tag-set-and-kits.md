# Endless tag set + counter kits (Phase 11, B.5)

## Why bands

Endless mode rewards stacking the same tag (Bleed-only, Crit-only, etc.)
because the opponent pool stays generic. Counter-tag bands inject an
encounter every few stages that resists the player's dominant tag,
forcing a pivot or punishing over-commitment.

## The map

| Player dominant tag | Counter band |
|---|---|
| `bleed`     | `armored`        |
| `poison`    | `cleanser`       |
| `chill`     | `fireborn`       |
| `crit`      | `evader`         |
| `accuracy`  | `phaser`         |
| `defense`   | `piercer`        |
| `hp`        | `executioner`    |
| `spd`       | `lockdown`       |
| `dodge`     | `tracker`        |
| `magic`     | `spellbreaker`   |
| `physical`  | `reflective`     |

Live in [`js/systems/endless-bands.js`](../js/systems/endless-bands.js)
as `Avian.systems.endlessBands.counterMap`. Edit it there + here together.

## Activation

Off by default. Flip on when you're testing a build:

```js
Avian.flags.endlessBandsEnabled = true;
```

or load with `?endlessBands=1` once a URL flag is wired (TODO).

## Shape of a "band"

A band is a tag the next enemy roll prefers. The Phase 11 trigger
returns the counter tag string; consumers (currently TODO) pull a
matching enemy from the existing `ENEMIES` table by inspecting that
enemy's `aiStyle` / `enemyClass` / future `tags` field.

## What's wired today

- `recordTagPick(tags)` is the API for shop code to call when the player
  acquires an upgrade with tags. Wiring the call from shop.js' apply
  path is a follow-up commit; `dominantTag()` returns null until that
  hook lands, so `suggest()` is a no-op.
- `suggest(stage)` returns the counter tag (or null) per cadence rules
  but ONLY when `Avian.flags.endlessBandsEnabled` is true. Default false
  → no behavioral change.

## Cadence

Stages 3 / 4 / 5 apart (chosen randomly each window) so the player can't
metagame the trigger pattern. Configurable via `injectEvery`.
