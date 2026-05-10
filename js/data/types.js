/* Avian Ascent — JSDoc typedefs for the public data surfaces.
 *
 * Pure documentation: this file is loaded into the bundle so editors
 * pick up the @typedef declarations, but it adds no runtime behavior.
 *
 * Usage from another file:
 *   /** @type {Bird} *\/ const b = BIRDS.sparrow;
 *
 * Keep typedefs intentionally loose — the legacy code mutates many of
 * these shapes in flight, and overly strict types create false noise.
 * Tighten over time as fields stabilize.
 */

/**
 * @typedef {Object} StatBlock
 * @property {number} [hp]
 * @property {number} [atk]
 * @property {number} [def]
 * @property {number} [matk]
 * @property {number} [mdef]
 * @property {number} [spd]
 * @property {number} [acc]
 * @property {number} [dodge]
 * @property {number} [crit]
 */

/**
 * @typedef {Object} Bird
 * @property {string} name
 * @property {string} [emoji]
 * @property {string} [class]
 * @property {string} [role]
 * @property {StatBlock} stats
 * @property {string[]} [abilities]
 * @property {string} [portraitKey]
 */

/**
 * @typedef {Object} Enemy
 * @property {string} name
 * @property {string} [emoji]
 * @property {string} [birdKey]
 * @property {number[]} [tier]
 * @property {string} [enemyClass]
 * @property {string} [size]
 * @property {string} [aiStyle]
 * @property {number} hp
 * @property {number} atk
 * @property {number} def
 * @property {number} [matk]
 * @property {number} [mdef]
 * @property {number} spd
 * @property {number} acc
 * @property {number} [dodge]
 * @property {string[]} [abilities]
 */

/**
 * @typedef {Object} Biome
 * @property {string} id
 * @property {string} name
 * @property {number} stageMin
 * @property {number} stageMax
 * @property {Object<string, number>} [mod]
 */

/**
 * @typedef {Object} Status
 * @property {string} id
 * @property {string} name
 * @property {string} [icon]
 * @property {string} [color]
 * @property {string} desc
 * @property {(who: any, stacks: number) => number} [tick]
 */

/**
 * @typedef {Object} AbilityLevel
 * @property {number} lv
 * @property {string} desc
 * @property {string} [newAilment]
 * @property {number} [ailChance]
 */

/**
 * @typedef {Object} AbilityTemplate
 * @property {string} id
 * @property {string} name
 * @property {boolean} [isBasic]
 * @property {string} type
 * @property {string} [btnType]
 * @property {string} desc
 * @property {string[]} [ailments]
 * @property {number} [baseMissChance]
 * @property {number} [baseDmgMult]
 * @property {number} [pierceDef]
 * @property {number[]} [energyByLevel]
 * @property {number} [energyCost]
 * @property {number[]} [cooldownByLevel]
 * @property {AbilityLevel[]} levels
 */

/**
 * @typedef {Object} UpgradeCard
 * @property {string} id
 * @property {string} name
 * @property {string} [tier]
 * @property {string[]} [tags]
 * @property {string} [desc]
 */

/* IIFE keeps this file's syntax aligned with the rest of the classic shell. */
(function () {
  'use strict';
})();
