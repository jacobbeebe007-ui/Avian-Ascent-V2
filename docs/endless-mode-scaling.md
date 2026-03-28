# Endless Mode Scaling & Cadence

This document defines the intended Endless-mode progression behavior used by `js/core/game.js`.

## Core scaling contract

- Endless uses the same story-derived base scaling curve as Story battles.
- After Story completion (`Stage 20`), Endless applies an additional ramp to effective enemy level as endless battles increase.
- Enemy growth is intentionally **not capped at level 10** (or any Story-end cap). Endless scaling continues indefinitely.

## Endless battle numbering

- Endless battle number is computed as:
  - `endlessBattle = stage - 20`
  - `Stage 21 => Endless Battle 1`
  - `Stage 30 => Endless Battle 10`

## Cadence rules

- **Boss cadence:** every 10 endless battles (`10, 20, 30, ...`).
- **Shop cadence:** every 5 endless battles (`5, 10, 15, ...`).

## Stage 20 semantics

- In Endless runs, `Stage 20` is a normal stage checkpoint in run progression semantics and is **not** treated as an Endless Duke-specific battle.
- Duke Blakiston remains a Story milestone/final-boss concept; endless cadence is driven by endless battle number after Stage 20.

## Flow consistency with Story

- The level-up screen flow and reward flow are shared between Story and Endless.
- Endless mode reuses the same post-combat pipeline (EXP, rewards, level-up handling), with cadence/offer content varying by endless battle milestones.
