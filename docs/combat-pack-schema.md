# Combat Pack Schema

The `combat-pack` is the runtime data product of the May 2026 combat rewrite.
It is the single source of truth for every ability, family, perk, and shop item
in the game. Everything lives under `js/data/combat-pack/` and is consumed by
`js/systems/combat-pack-boot.js` at game startup.

## Files

| File                                | Source sheet                              | Rows  |
| ----------------------------------- | ----------------------------------------- | ----- |
| `combat-pack/classes.js`            | passive_perks.xlsx → `Class Rules`        | 6     |
| `combat-pack/birds-kits.js`         | passive_perks.xlsx → `Level 1 Kits`       | 44    |
| `combat-pack/families.js`           | both xlsx → `Ability Families`            | 238   |
| `combat-pack/skill-trees.js`        | both xlsx → `Skill Trees` / `Ability Upgrade Trees` | 2,380 |
| `combat-pack/bird-passives.js`      | passive_perks.xlsx → `Passive Perks`      | 44    |
| `combat-pack/endless-passives.js`   | passive_perks.xlsx → `Endless Passive Upgrades` + `Generic Endless` | 176 + 24 |
| `combat-pack/shop-pool.js`          | shop_learnable_abilities.xlsx → `Shop Ability Pool` | 150   |

Each file is frozen (`Object.freeze`) and assembled into `Avian.data.combatPack`
at startup. Re-run `node scripts/import-combat-content.mjs` to regenerate after
editing the spreadsheets.

## Row shapes

### `classes.js`

```js
{
  id: 'Striker',
  rangeBuckets: ['Small', 'Tiny', 'Medium'],
  utilityRule: 'Buff Self',
  notes: 'Free-text from the design sheet.',
}
```

### `birds-kits.js`

```js
{
  birdKey: 'Sparrow',          // canonical key used in BIRDS[…]
  className: 'Striker',
  slots: [                     // exactly two starter ability ids + two empty slots
    { type: 'starter', familyId: 'SPARROW_F1', abilityId: 'SPARROW_F1_L1_BASE' },
    { type: 'starter', familyId: 'SPARROW_F2', abilityId: 'SPARROW_F2_L1_BASE' },
    { type: 'empty' },
    { type: 'empty' },
  ],
}
```

### `families.js`

```js
{
  id: 'SPARROW_F1',
  birdKey: 'Sparrow' | null,   // null for shop families
  className: 'Striker',
  family: 'Physical' | 'Magic' | 'Utility' | 'Hybrid',
  tier: 'Starter' | 'White' | 'Green' | 'Blue' | 'Purple' | 'Gold',
  origin: 'bird' | 'shop',
  name: 'Quick Strike Family',
  description: 'Free-text.',
}
```

### `skill-trees.js`

This is the row shape consumed by `Avian.dispatcher.execute()` and used to
build `ABILITY_TEMPLATES[]`.

```js
{
  id: 'SPARROW_F1_L1_BASE',
  familyId: 'SPARROW_F1',
  level: 1 | 3 | 6 | 9,
  branch: null | 'Power' | 'Ailment' | 'Utility',
  name: 'Quick Strike',
  category: 'Physical' | 'Magic' | 'Utility',
  apCost: 1,
  target: 'Enemy' | 'Self' | 'Self and Enemy' | 'All Enemies',
  hits: 1,
  baseDmg: 2,                  // flat term in formula
  scaleStat: 'ATK' | 'MATK' | null,
  scalePct: 0.4,               // 40% scaling
  hpScalePct: 0,               // bonus from caster Max HP, if formula includes it
  pierce: { def: 0, mdef: 0 }, // expressed as decimals (0.05 = 5%)
  ailment: { id: 'Bleed' | 'Burning' | …, chance: 0.25 } | null,
  cooldown: 0,
  riders: [                    // see ability-dispatcher.js#riderHandlers
    { tag: 'gainSpeed', value: 20 },
    { tag: 'refundApOnCrit', value: 1, once: true },
  ],
  tags: ['Combo', 'Multi-Hit'],
}
```

`Avian.dispatcher.execute(ab)` does the following per row:

1. `computeRawHitDamage()` from `baseDmg + scalePct*stat + hpScalePct*maxHp`.
2. Calls existing `dealDamage()` / `doAttack()` for each hit, applying
   `pierce.def` / `pierce.mdef`.
3. Rolls `ailment.chance`; on success calls `applyAilment(ailment.id)`.
4. Iterates `riders[]`, dispatching to `riderHandlers[tag](value, ctx)` from
   `ability-dispatcher.js`. Unknown tags log a warning and skip — they never
   throw at runtime.

### `bird-passives.js`

```js
{
  id: 'PAS-001',
  birdKey: 'Sparrow',
  name: 'Pluck Streak',
  trigger: 'After using a multi-hit Physical, +20% Speed for 1 turn.',
  effect: '+20% Speed',
}
```

The `trigger` and `effect` strings are interpreted by
`passive-hooks.js#classifyTrigger` / `classifyEffect`. See
[bird-passives.md](bird-passives.md) for the supported phrases.

### `endless-passives.js`

```js
{
  bird: {                     // 176 entries
    Sparrow: [
      { rank: 1, name: 'Pluck Streak +', trigger: …, effect: '+30% Speed' },
      { rank: 2, … },
      { rank: 3, … },
      { rank: 4, … },
    ],
    …
  },
  generic: [                  // 24 entries, class-keyed
    { className: 'Striker', name: 'Crit Stack', trigger: …, effect: '+5% Crit' },
    …
  ],
}
```

### `shop-pool.js`

```js
{
  id: 'SHOP_GN03',            // remapped: Green and Gold tier collisions disambiguated
  familyId: 'SHOP_GN03',
  tier: 'White' | 'Green' | 'Blue' | 'Purple' | 'Gold',
  rarityWeight: 30,           // higher = more likely to roll into shop
  unlockStage: 1,             // overworld stage gate
  costStars: 4,               // ★ price at the Stork shop
  className: 'Striker' | …,
}
```

`Avian.shop.rollStockForMode(mode)` consumes this — see
`js/systems/shop-v2.js`.

## Versioning

`Avian.systems.COMBAT_PACK_VERSION` is exported by
`js/systems/save-migrations.js`. When the pack changes shape (new column, new
rider semantics) bump the constant and add a migration step in
`save-migrations.js`. The migration should wipe `player.abilities`,
`player.classPerks`, and `player.familyEvolutionState` so the new content gets
re-attached on next load.
