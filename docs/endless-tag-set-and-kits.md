# Ability Tags, Kit Plan, and Swap Recommendations

## Energy model used for this balance pass

| Bird Size | Starting EN | Max EN |
|---|---:|---:|
| Small | 5 | 8 |
| Medium | 4 | 7 |
| Large | 2 | 5 |
| X-Large | 2 | 5 |

Design implication:
- Small = tempo/spam-friendly
- Large/XL = efficient heavy-value casts

---

## 1) Final Displayable Ability Tag Set

- `BASIC` reliable low-cost attack
- `HEAVY` high damage strike
- `SPELL` MATK scaling ability
- `UTILITY` buff / tactical effect
- `CONTROL` fear, stun, debuff
- `GUARD` defensive skill
- `HEAL` restore HP
- `MULTI` multiple hits
- `FINISH` stronger vs low HP
- `SIGNATURE` species-defining ability

---

## 2) Ability → Tag Assignments (canonical mapping used)

- Peck / Rapid Peck: `[BASIC]`
- Talon Strike: `[HEAVY]`
- Wind Slash: `[SPELL]`
- Shriekwave: `[SPELL][CONTROL]`
- Murder Murmuration: `[MULTI][SIGNATURE]`
- Stick Lance: `[HEAVY][SIGNATURE]`
- Mud Lash: `[SPELL][CONTROL][SIGNATURE]`
- Sit and Wait: `[UTILITY][CONTROL][SIGNATURE]`
- Owl's Psyche: `[SPELL][CONTROL][SIGNATURE]`
- Shoebill Clamp: `[HEAVY][CONTROL][SIGNATURE]`
- Fish Snatcher: `[UTILITY][HEAL][SIGNATURE]`
- Roost: `[HEAL]`
- Preen: `[UTILITY][HEAL]`
- Defend / Guard: `[GUARD]`
- Evade / Grace Step / Feather Flick: `[UTILITY]`
- Intimidate / Threat Display: `[CONTROL]`
- Victory Chant / Battle Chirp / Battle Focus: `[UTILITY]`
- Dread Call: `[SPELL][CONTROL]`

---

## 3) Bird-by-bird starting kit rewrites (target)

- Sparrow: Peck, Talon Strike, Battle Chirp, Wind Slash
- Crow: Peck, Murder Murmuration, Dread Call, Battle Focus
- Macaw: Echo Note, Mimic Song, Feather Taunt, Chorus Mark
- Lyrebird: Echo Note, Mimic Chorus, Display Step, Refrain Mark (family evolution; singer)
- Black Cockatoo: Beak Crack, Boom Call, Wing Beat, Resonance Mark (family evolution; bruiser)
- Kookaburra: Beak Chop, Laugh Call, Perch Watch, Drop Strike (family evolution; bruiser)
- Hummingbird: Needle Jab, Dash, Blink Flutter, Combo Strike
- Peregrine Falcon: Talon Jab, Dive, Keen Eye, Aerial Pace
- Snowy Owl: Talon Snap, Silent Dive, Owl Eye, Frost Glide
- Magpie: Swoop, Steal Shine, Feather Flick, Dart
- Seagull: Peck, Dive Snatch, Wind Slash, Mob Swarm
- Flamingo: Peck, Mud Lash, Preen, Grace Step
- Goose: Peck, Territorial Honk, Guard, Talon Slam
- Emperor Penguin: Peck, Ice Guard, Body Slam, Rally Call
- Ostrich: Kick, Trample, Guard, Threat Display
- Emu: Kick, Savage Kick, Threat Display, Dust Kick
- Cassowary: Raptor Kick, Raptor Kick Frenzy, Intimidating Stare, Guard
- Bald Eagle: Peck, Sky Strike, Focus Sight, Wind Slash
- Secretary Bird: Peck, Stick Lance, Battle Rhythm, Guard
- Toucan: Beak Jab, Beak Slam, Fruit Toss, Color Mark (family evolution; striker — long-beak reach, 2 EN slam line, fruit toss control, color setup; delayed afterbill on slam branch). Template id for the neutral jab is `toucan_beak_jab` (global `beak_jab` stays Kiwi/Raven → `probeStrike`). Legacy flat ids (`fruitSpit`, `sunCall`, `jungleChorus`, `echoScreech`) are not live `registerAbilityAlias` targets; save migration maps them into slot-state.
- Shoebill: Peck, Shoebill Clamp, Sit and Wait, Fish Snatcher
- Kiwi: Beak Jab, Night Probe, Scent Hunt, Scrape
- Raven: Beak Jab, Omen Call, Dark Watch, Fate Mark (family evolution; trickster — omen magic + physical beak)
- Robin: Quick Peck, Dart Rush, Bright Chirp, Hop Step (family evolution; striker — field tempo, expose/ACC-shaken payoff, hop/chirp setup, dart-line burst + optional delayed echo)
- Bowerbird: Trinket Toss, Lure Call, Bower Build, Display Mark (family evolution; trickster — setup trinkets, 2 EN lure line with fear/confuse/delayed trap payoffs, build amp/break/guard, display expose/read/execute). Old flat-kit ids (`decorate`, `inspireSong`, `charmDisplay`, `focusCall`, etc.) are migration-only and are not live aliases.
- Swan: Neck Jab, Wing Sweep, Grace Glide, Poise Mark (family evolution; striker — neck precision, 2 EN sweep burst, glide posture/ACC tempo, poise setup; delayed after-wing on sweep return path). Bleed branch uses ids `swan_razor_jab` / `swan_razor_lunge` / `swan_razor_pierce` (global `razor_jab` is Hummingbird). Glide dodge tier 2–3 use `swan_ghost_drift` / `swan_white_waltz` (global `ghost_drift` is Snowy Owl). Poise break/execute use `swan_crack_mark`, `swan_death_mark`, `swan_finale_strike`, etc. Pre-overhaul flat display ids (`wingShield`, `royalGuard`, `calmingSong`) are not live `registerAbilityAlias` targets; `bracePeck` remains the shared tank basic (e.g. Shoebill). Save migration maps old Swan slots (including resolved `guard` on sweep/glide) into slot-state.

---

## 4) Exact swap/replacement recommendations

- Remove **Roost** from Goose and Ostrich (replace with Guard)
- Remove **Intimidate** from Penguin/Cassowary/Emu (replace with Threat Display)
- Remove **Shriekwave** from Magpie and Seagull
- Toucan uses the family-evolution kit above (not Owl's Psyche / Fruit Bomb as the live starter).
- Remove generic **Defend** from Bald Eagle and Secretary Bird (replace with aggressive utility)

---

## 5) New species-specific abilities to add next

- Fruit Bomb (Toucan) — optional legacy concept; live Toucan uses `fruit_toss` family line instead `[SPELL][SIGNATURE]`
- Territorial Honk (Goose) `[CONTROL][SIGNATURE]`
- Dive Snatch (Seagull) `[UTILITY][SIGNATURE]`
- Savage Kick (Emu) `[HEAVY][SIGNATURE]`
- Sky Strike (Eagle) `[HEAVY][SIGNATURE]`
- Raptor Kick Frenzy (Cassowary) `[HEAVY][MULTI][SIGNATURE]`
