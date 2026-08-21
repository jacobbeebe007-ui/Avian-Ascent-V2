# Story Mode vertical-slice flow audit

## Route inspected

The playable route is `screen-start` → War Room (`screen-select`) → bird and difficulty confirmation → the Blackstone overworld → combat → nest reward → overworld. Shop nodes route through the Stork shop and return to the same map. Stages 10 and 20 are milestone bosses; stage 20 ends on the ascent result and returns to the War Room.

## Integration findings and corrections

- The combat save already owns combat/player data and map progress. A second combat model would create conflicting restoration paths, so the new Story Run ledger stores checkpoints only and explicitly marks mid-turn restoration as unsupported.
- Run start, node entry, victory, reward collection, shop purchase, boss victory, and ascent completion now have durable, idempotent checkpoints.
- Repeated victory/reward/shop callbacks are de-duplicated by map/node and reward identity. This prevents double-clicks from duplicating progression.
- A duplicated equipment-purchase branch in the Stork shop was removed. The first branch was reachable and the second was dead code that could drift from the real purchase implementation.
- The existing map already requires node inspection followed by a deliberate Enter action, distinguishes locked/available/completed nodes with both styling and labels, and provides Nest/settings navigation. Those working systems were retained.
- Existing equipment initialisation remains authoritative: bird construction calls `ensurePlayerEquipmentState` and synchronises equipment actions before the map is launched.

## Remaining intentional limitations

- Mid-combat reload resumes through the existing combat save when valid; the checkpoint ledger never attempts to reconstruct an incomplete combat turn.
- The first story campaign remains the authored 20-stage Blackstone route rather than introducing a separate demo-only four-fight campaign.
- Map Forge still contains historical authoring labels for legacy content. They are development tools, not part of the player-facing Story Mode route.
