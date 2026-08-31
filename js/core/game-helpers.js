/* Avian Ascent — pure helpers extracted from js/core/game.js (Step 7 Phase 1).
 *
 * Combat number formatting, reward tier normalization, and bird-class resolution.
 * Loaded before game.js; top-level declarations stay on globalThis for the shell.
 */
(function initGameHelpers() {
  'use strict';
  const Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.helpers = Avian.helpers || Object.create(null);
})();

function formatCombatNumber(n) {
  return (Number(n) || 0).toFixed(2);
}
Avian.helpers.formatCombatNumber = formatCombatNumber;
globalThis.formatCombatNumber = formatCombatNumber;

function roundCombatDamage(n) {
  return Math.max(0.01, Math.round(Number(n) * 100) / 100);
}
Avian.helpers.roundCombatDamage = roundCombatDamage;
globalThis.roundCombatDamage = roundCombatDamage;

function roundCombatStat(n, floor = 0) {
  return Math.max(floor, Math.round(Number(n) * 100) / 100);
}
Avian.helpers.roundCombatStat = roundCombatStat;
globalThis.roundCombatStat = roundCombatStat;

function rollCombatSpread(lo, hi) {
  const a = Number(lo) || 0;
  const b = Number(hi) || a;
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  const rolled = low + Math.random() * (high - low);
  return roundCombatDamage(Math.max(0.01, rolled));
}
Avian.helpers.rollCombatSpread = rollCombatSpread;
globalThis.rollCombatSpread = rollCombatSpread;

function applyFractionalHp(stats, delta) {
  stats.hp = Math.max(0, Math.round((Number(stats.hp) + delta) * 100) / 100);
}
Avian.helpers.applyFractionalHp = applyFractionalHp;
globalThis.applyFractionalHp = applyFractionalHp;

function normalizeCombatStats(stats) {
  if (!stats) return;
  for (const k of ['hp', 'maxHp', 'atk', 'def', 'matk', 'mdef', 'spd', 'acc', 'dodge', 'critChance', 'armorPen', 'magicPen']) {
    if (stats[k] != null) stats[k] = Math.round(Number(stats[k]) * 100) / 100;
  }
}
Avian.helpers.normalizeCombatStats = normalizeCombatStats;

function capPctStatValue(statKey, value) {
  const v = Number(value) || 0;
  if (statKey === 'critChance') {
    return typeof clampCritChancePct === 'function' ? clampCritChancePct(v) : Math.max(0, Math.min(50, v));
  }
  if (statKey === 'armorPen' || statKey === 'magicPen') return Math.max(0, Math.min(95, v));
  return Math.max(0, v);
}
Avian.helpers.capPctStatValue = capPctStatValue;

function dodgeBonusFromSpeed(spd) {
  const cfg = (typeof Avian !== 'undefined' && Avian.data && Avian.data.combatConfig) || null;
  if (cfg && cfg.weaponFirst && cfg.weaponFirst.enabled !== false) {
    const per = cfg.weaponFirst.agilityDodgePctPerPoint != null ? Number(cfg.weaponFirst.agilityDodgePctPerPoint) : 0.5;
    const cap = cfg.weaponFirst.dodgeCapPct != null ? Number(cfg.weaponFirst.dodgeCapPct) : 50;
    return Math.min(cap, Math.max(0, (Number(spd) || 0) * per));
  }
  return 0;
}
Avian.helpers.dodgeBonusFromSpeed = dodgeBonusFromSpeed;
globalThis.dodgeBonusFromSpeed = dodgeBonusFromSpeed;

function dodgeSpdAttributionNote(_player) {
  return '';
}
Avian.helpers.dodgeSpdAttributionNote = dodgeSpdAttributionNote;

function formatLedgerDelta(n) {
  return formatCombatNumber(n);
}
Avian.helpers.formatLedgerDelta = formatLedgerDelta;

const REWARD_TIERS = {
  grey: { label: 'Common', color: 'grey' },
  white: { label: 'Common', color: 'grey' },
  green: { label: 'Uncommon', color: 'green' },
  blue: { label: 'Rare', color: 'blue' },
  purple: { label: 'Epic', color: 'purple' },
  gold: { label: 'Legendary', color: 'gold' },
  orange: { label: 'Ancestral', color: 'orange' },
};
Avian.helpers.REWARD_TIERS = REWARD_TIERS;
globalThis.REWARD_TIERS = REWARD_TIERS;

function normalizeRewardTier(tier) {
  const t = String(tier || 'grey').toLowerCase();
  if (t === 'white') return 'grey';
  return REWARD_TIERS[t] ? t : 'grey';
}
Avian.helpers.normalizeRewardTier = normalizeRewardTier;
globalThis.normalizeRewardTier = normalizeRewardTier;

function rewardTierMeta(tier) {
  const key = normalizeRewardTier(tier);
  return REWARD_TIERS[key] || REWARD_TIERS.grey;
}
Avian.helpers.rewardTierMeta = rewardTierMeta;
globalThis.rewardTierMeta = rewardTierMeta;

function nestTierCssClass(tier) {
  return normalizeRewardTier(tier);
}
Avian.helpers.nestTierCssClass = nestTierCssClass;

function nestTierColorVar(tier) {
  const key = nestTierCssClass(tier);
  return { grey: 'var(--tier-grey)', green: 'var(--tier-green)', blue: 'var(--tier-blue)', purple: 'var(--tier-purple)', gold: 'var(--gold)', orange: 'var(--tier-orange)' }[key] || 'var(--gold)';
}
Avian.helpers.nestTierColorVar = nestTierColorVar;

const CLASS_ROLE_BY_CLASS = {
  knight: 'knight', rogue: 'rogue', mage: 'mage', siren: 'siren', inquisitor: 'inquisitor', bard: 'bard', brute: 'brute',
  striker: 'rogue', bruiser: 'knight', tank: 'knight', trickster: 'bard', predator: 'inquisitor', singer: 'mage',
};
Avian.helpers.CLASS_ROLE_BY_CLASS = CLASS_ROLE_BY_CLASS;

const FINAL_BIRD_CLASS_BY_KEY = Object.freeze({});
Avian.helpers.FINAL_BIRD_CLASS_BY_KEY = FINAL_BIRD_CLASS_BY_KEY;

const LEGACY_CLASS_FALLBACK = {
  support: 'mage', summoner: 'bard', defender: 'knight', vanguard: 'knight',
  skirmisher: 'rogue', assassin: 'rogue', ranger: 'bard', tyrant: 'inquisitor',
};
Avian.helpers.LEGACY_CLASS_FALLBACK = LEGACY_CLASS_FALLBACK;

function normalizeBirdClassKey(birdKey = '') {
  return String(birdKey || '').toLowerCase().replace(/[^a-z_]/g, '');
}
Avian.helpers.normalizeBirdClassKey = normalizeBirdClassKey;

function getFinalBirdClass(birdKey = '', fallback = '') {
  const normalizedKey = normalizeBirdClassKey(birdKey);
  if (normalizedKey && FINAL_BIRD_CLASS_BY_KEY[normalizedKey]) return FINAL_BIRD_CLASS_BY_KEY[normalizedKey];
  const rawFallback = String(fallback || '').toLowerCase();
  return CLASS_ROLE_BY_CLASS[rawFallback] || '';
}
Avian.helpers.getFinalBirdClass = getFinalBirdClass;

function resolveFinalClass(rawClass = '', birdKey = '') {
  const cls = String(rawClass || '').toLowerCase().split(/\s+/)[0];
  const key = String(birdKey || '');
  const birdCls = BIRDS?.[key]?.class;
  if (birdCls) return CLASS_ROLE_BY_CLASS[String(birdCls).toLowerCase().split(/\s+/)[0]] || birdCls;
  const mappedBirdClass = getFinalBirdClass(key, cls);
  if (mappedBirdClass) return mappedBirdClass;
  return CLASS_ROLE_BY_CLASS[cls] || LEGACY_CLASS_FALLBACK[cls] || 'rogue';
}
Avian.helpers.resolveFinalClass = resolveFinalClass;
globalThis.resolveFinalClass = resolveFinalClass;

function normalizeAllowedClassList(list = []) {
  if (!Array.isArray(list)) return [];
  const out = [];
  list.forEach((cls) => {
    const normalized = resolveFinalClass(cls);
    if (normalized && !out.includes(normalized)) out.push(normalized);
  });
  return out;
}
Avian.helpers.normalizeAllowedClassList = normalizeAllowedClassList;

function sanitizeAbilityClassRouting(store) {
  if (!store || typeof store !== 'object') return;
  Object.values(store).forEach((tmpl) => {
    if (Array.isArray(tmpl?.allowedClasses)) {
      tmpl.allowedClasses = normalizeAllowedClassList(tmpl.allowedClasses);
    }
  });
}
Avian.helpers.sanitizeAbilityClassRouting = sanitizeAbilityClassRouting;

function escapeEncounterPreviewHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
Avian.helpers.escapeEncounterPreviewHtml = escapeEncounterPreviewHtml;
globalThis.escapeEncounterPreviewHtml = escapeEncounterPreviewHtml;

function formatSignedCombatStat(n, pct = false) {
  const v = Number(n) || 0;
  const body = formatCombatNumber(Math.abs(v));
  const sign = v < 0 ? '-' : '+';
  return pct ? `${sign}${body}%` : `${sign}${body}`;
}
Avian.helpers.formatSignedCombatStat = formatSignedCombatStat;
