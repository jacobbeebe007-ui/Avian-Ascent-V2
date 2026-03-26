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
- Shoebill Stork: `sbl_still_stance` `[GUARD]`, `sbl_dread_mark` `[UTILITY]`, plus `[BASIC]` / `[HEAVY][SIGNATURE]` on `sbl_beak_chop` / `sbl_skull_crack`. Pre-overhaul **Shoebill Clamp** (`shoebillClamp`) was removed from live templates/actions; save migration still recognizes the id string when rewriting old slots.
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
- Macaw: Echo Note, Mimic Song, Feather Taunt, Chorus Mark (sonic families: Echo-line third path is **Resonance**; Chorus third path is **Afterbeat** in UI)
- Lyrebird: Echo Note, Mimic Chorus, Display Step, Refrain Mark (family evolution; singer; Refrain third path **Stage Return**, distinct tier labels vs Macaw)
- Black Cockatoo: Beak Crack, Boom Call, Wing Beat, Resonance Mark (family evolution; bruiser)
- Kookaburra: Beak Chop, Laugh Call, Perch Watch, Drop Strike (family evolution; bruiser)
- Hummingbird: Needle Jab, Dash, Blink Flutter, Combo Strike (family evolution; **dash** third branch is **rend** with bleed riders; combo path keeps afterbeat resonance)
- Peregrine Falcon: Talon Jab, Dive, Keen Eye, Aerial Pace
- Snowy Owl: Talon Snap, Silent Dive, Owl Eye, Frost Glide
- Magpie: Swoop, Steal Shine, Feather Flick, Dart
- Seagull: Snap Peck, Swoop Pass, Raucous Cry, Scavenge Mark (family evolution; trickster — canonical ids `sgl_snap_peck`, `sgl_swoop_pass`, `sgl_raucous_cry`, `sgl_scavenge_mark`; snap bleed/pierce/expose, 2 EN swoop crit/blindside/slow, cry ACC break/weaken/speed, scavenge amp/break/read). Passive **Scavenger's Instinct** (+20% vs &lt;60% HP; mob ATK→SPD steal; Fear immune). Pre-overhaul flat ids (`featherFlick`, `diveSnatch`, `blindScreech`, `distractingChorus`, …) are **not** live `registerAbilityAlias` → `sgl_*` targets (shared globals like `diveSnatch`→`fishSnatcher` remain for other legacy/codex paths); save/load rewrites Seagull slots to `sgl_*` via `legacyBaseAbilityIds` + `migrateSeagullLegacyFamilySkillSlots`. Unlock: any **Trickster** at Endless Lv.21.
- Flamingo: Leg Jab, Marsh Sweep, Balance Pose, Mire Mark (family evolution; striker — leg precision, 2 EN marsh sweep with weaken vs **redwake** (bleed) third branch, balance stance dodge/guard/ACC break, mire amp/break/read; same evolution flow as Swan/Toucan/Bowerbird; unlock Endless stage 30 as a Striker). Weaken sweep branch uses `flm_pressing_sweep` / `flm_pressing_surge` / `flm_crushing_crest`; redwake branch uses `flm_reed_cut` / `flm_bog_surge` / `flm_crimson_crest` (legacy `flm_echo_sweep` / `flm_return_surge` / `flm_wake_crest` migrate into these). Bleed/expose leg branches use `flm_razor_*` / `flm_spot_*` / `flm_open_pierce` (global `razor_jab`, `spot_jab`, `open_pierce` are other birds). Old flat ids (`mudshot`, `marshCall`, `bogWhisper`, `rotChorus`) are migration-only; some remain `registerAbilityAlias` targets for unrelated legacy strings.
- Goose: Beak Snap (`gos_beak_snap`), Body Check (`gos_body_check`), Honk Blast (`gos_honk_blast`), Brace Up (`gos_brace_up`) — family evolution (**tank / territorial bruiser** — beak pierce/bleed/weaken, body crit/weaken/break at 2 EN, honk fear/ACC break/speed, brace guard/amp/read).
- Emperor Penguin: Peck, Ice Guard, Body Slam, Rally Call
- Ostrich: Kick, Trample, Guard, Threat Display
- Emu: Kick, Savage Kick, Threat Display, Dust Kick
- Cassowary: Raptor Kick, Raptor Kick Frenzy, Intimidating Stare, Guard
- Bald Eagle: Peck, Sky Strike, Focus Sight, Wind Slash
- Secretary Bird: Leg Jab (`sec_leg_jab`), Crushing Kick, Hunter Stride, Prey Mark (family evolution; **predator** — grounded leg line, 2 EN kick execution with crit / paralysis / low-HP execute branches, stride speed/dodge/amp, prey amp/break/read). Leg and kick ids use `sec_` prefix so they do not collide with Flamingo `leg_jab`, Toucan `lock_crush`, or shared legacy `execution_crush` (Kiwi probes / migrations). Prey read tier 2 is id `read_sight` (Raven uses `rav_read_sight`). Old flat kit and legacy stomp-line ids (`headWhip`, `serratedSlash`, `guard`, `threatDisplay`, `serpentCrusher`, `trample`, `warCharge`, …) are **migration-only**, not live starters.
- Toucan: Beak Jab, Beak Slam, Fruit Toss, Color Mark (family evolution; striker — long-beak reach, 2 EN slam line, fruit toss control, color setup; delayed afterbill on slam branch). Template id for the neutral jab is `toucan_beak_jab` (global `beak_jab` stays Kiwi/Raven → `probeStrike`). Legacy flat ids (`fruitSpit`, `sunCall`, `jungleChorus`, `echoScreech`) are not live `registerAbilityAlias` targets; save migration maps them into slot-state.
- Shoebill: Beak Chop (`sbl_beak_chop`), Skull Crack (`sbl_skull_crack`), Still Stance (`sbl_still_stance`), Dread Mark (`sbl_dread_mark`) — family evolution (**tank / swamp execution bruiser** — beak pierce/bleed/weaken at 1 EN, crack crit/fear/execute at 2 EN, stance guard/dodge/amp, dread amp/break/read). Old flat kit ids (`bracePeck`, `shoebillClamp`, `guard`, `huntersCry`, …) are **save-migration-only** strings in `legacyBaseAbilityIds` / `migrateShoebillLegacyFamilySkillSlots`; `shoebillClamp` is no longer a player-facing template or `ACTIONS` handler.
- Kiwi: Beak Jab, Night Probe, Scent Hunt, Scrape
- Raven: Beak Jab, Omen Call, Dark Watch, Fate Mark (family evolution; trickster — omen magic + physical beak)
- Robin: Quick Peck, Dart Rush, Bright Chirp, Hop Step (family evolution; striker — field tempo, expose/ACC-shaken payoff, hop/chirp setup, dart-line burst + optional **afterbeat** on return / trigger routes)
- Bowerbird: Trinket Toss, Lure Call, Bower Build, Display Mark (family evolution; trickster — setup trinkets, 2 EN lure line with fear/confuse/**toxic** (poison) third branch, build amp/break/guard, display expose/read/execute). Old flat-kit ids (`decorate`, `inspireSong`, `charmDisplay`, `focusCall`, etc.) are migration-only and are not live aliases.
- Swan: Neck Jab, Wing Sweep, Grace Glide, Poise Mark (family evolution; striker — neck precision, 2 EN sweep burst, glide posture/ACC tempo, poise setup; delayed after-wing on sweep return path). Bleed branch uses ids `swan_razor_jab` / `swan_razor_lunge` / `swan_razor_pierce` (global `razor_jab` is Hummingbird). Glide dodge tier 2–3 use `swan_ghost_drift` / `swan_white_waltz` (global `ghost_drift` is Snowy Owl). Poise break/execute use `swan_crack_mark`, `swan_death_mark`, `swan_finale_strike`, etc. Pre-overhaul flat display ids (`wingShield`, `royalGuard`, `calmingSong`) are not live `registerAbilityAlias` targets; `bracePeck` remains a shared tank-basic alias for some legacy kits. Save migration maps old Swan slots (including resolved `guard` on sweep/glide) into slot-state.
- Albatross: Wing Jab, Ocean Sweep, Glide Line, Current Mark (family evolution; striker — canonical ids `alb_wing_jab`, `alb_ocean_sweep`, `alb_glide_line`, `alb_current_mark`; wing pierce/bleed/expose, 2 EN ocean sweep slow/weaken/**return** delayed wake, glide speed/dodge/guard, current amp/break/read). Class/passive: **Trade-Wind Patience** (+1 SPD every 2 turns to max 20; +6% physical vs slowed). Pre-overhaul flat ids (`galeStrike`, `oceanCall`, `windChorus`, `stormSong`, `supersonic`, `wingStorm`, `sonicDirge`, etc.) are **not** live `registerAbilityAlias` targets (those globals stay pool/legacy spells); save/load rewrites them to `alb_*` via `legacyBaseAbilityIds` + `migrateAlbatrossLegacyFamilySkillSlots`.

---

## 4) Exact swap/replacement recommendations

- Remove **Roost** from Goose and Ostrich (replace with Guard)
- Remove **Intimidate** from Penguin/Cassowary/Emu (replace with Threat Display)
- Remove **Shriekwave** from Magpie (Seagull uses family cry line, not Shriekwave)
- Toucan uses the family-evolution kit above (not Owl's Psyche / Fruit Bomb as the live starter).
- Remove generic **Defend** from Bald Eagle and Secretary Bird (replace with aggressive utility)

---

## 5) New species-specific abilities to add next

- Fruit Bomb (Toucan) — optional legacy concept; live Toucan uses `fruit_toss` family line instead `[SPELL][SIGNATURE]`
- Territorial Honk (Goose) `[CONTROL][SIGNATURE]`
- Swoop Pass / Swoop line (Seagull) `[HEAVY][SIGNATURE]` (2 EN harrier family slot)
- Savage Kick (Emu) `[HEAVY][SIGNATURE]`
- Sky Strike (Eagle) `[HEAVY][SIGNATURE]`
- Raptor Kick Frenzy (Cassowary) `[HEAVY][MULTI][SIGNATURE]`
