# Endless Mode Scaling & Cadence

This document defines the intended Endless-mode progression behavior used by `js/core/game.js`.

## Core scaling contract

- Endless uses the same story-derived base scaling curve as Story battles.
- After Story completion (`Stage 20`), Endless applies an additional ramp to effective enemy level as endless battles increase.
- Enemy growth is intentionally **not capped at level 10** (or any Story-end cap). Endless scaling continues indefinitely.
- Difficulty multiplier (`DIFFICULTIES.*.mult`) scales **all** enemy combat stats (HP, ATK, MATK, DEF, MDEF, SPD, ACC, dodge).
- After player bird level ≥ 20 and enemy effective level ≥ 20, an extra **+5% all combat stats** ramp applies every 3 endless battles (`floor(endlessBattle / 3)` steps).

## Endless battle numbering

- Endless battle number is computed as:
  - `endlessBattle = stage - 20`
  - `Stage 21 => Endless Battle 1`
  - `Stage 30 => Endless Battle 10`

## Cadence rules

- **Boss cadence:** every 20 endless battles (`20, 40, 60, ...`).
- **Shop cadence:** every 10 endless battles (`10, 20, 30, ...`). Battle 20 can be both shop and boss.

## Enemy roster & mutations (endless)

- Normal endless enemies are picked from `normalByLevel` at the player's bird level (±1 for variety), clamped 1–20.
- Boss endless enemies use `bossesByLevel` at the nearest boss tier (10 / 20 / 30) with effective level at player level or player level + 1.
- Enemy mutations mirror the player's equipped mutation **count** exactly and reuse player mutation **tiers** in order; if the player has none, tier comes from `getEndlessNormalFightTier(endlessBattle)`.

## Rewards (endless stage 21+)

- Each defeated enemy grants **1 heal** and **1 mutation** (2 drops per bird), via `buildEndlessClearRewardDrops`.

## Stage 20 semantics

- In Endless runs, `Stage 20` is a normal stage checkpoint in run progression semantics and is **not** treated as an Endless Duke-specific battle.
- Duke Blakiston remains a Story milestone/final-boss concept; endless cadence is driven by endless battle number after Stage 20.

## Flow consistency with Story

- The level-up screen flow and reward flow are shared between Story and Endless.
- Endless mode reuses the same post-combat pipeline (EXP, rewards, level-up handling), with cadence/offer content varying by endless battle milestones.
