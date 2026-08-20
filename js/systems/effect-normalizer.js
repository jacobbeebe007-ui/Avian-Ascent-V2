/* Normalise authored workbook vocabulary without interpreting prose. */
function structuredEffectToken(value) { return String(value == null ? '' : value).trim(); }
function structuredEffectNumber(value) { if (value === '' || value == null) return undefined; var n = Number(value); return Number.isFinite(n) ? n : undefined; }
function normalizeStructuredAlias(value, aliases) { var raw = structuredEffectToken(value); return aliases[raw.toLowerCase()] || raw; }
function normalizeEffect(rawEffect, sourceSkill) {
  var raw = rawEffect || {}, out = {}, numeric = ['order','powerPercent','hitCount','stacks','chancePercent','amount','durationTurns','modifierValue','penetrationAmount'];
  Object.keys(raw).forEach(function (key) { if (raw[key] !== '' && raw[key] != null && key !== 'skillId') out[key] = raw[key]; });
  numeric.forEach(function (key) { if (out[key] != null) out[key] = structuredEffectNumber(out[key]); });
  out.type = normalizeStructuredAlias(out.type, { 'apply ailment':'applyAilment', 'restore protection':'restoreProtection', 'temporary protection':'temporaryProtection', 'modify stat':'modifyStat' });
  out.trigger = normalizeStructuredAlias(out.trigger || 'onUse', { 'on use':'onUse', 'on hit':'onHit', 'on health damage':'onHealthDamage', 'after health damage':'afterHealthDamage', 'after all hits':'afterAllHits' });
  out.target = normalizeStructuredAlias(out.target || (out.type === 'damage' || out.type === 'applyAilment' ? 'enemy' : 'self'), {} ).toLowerCase();
  if (out.damageType) out.damageType = normalizeStructuredAlias(out.damageType, { 'physical strength':'martial', 'physical finesse':'martial', physical:'martial', magical:'magic' }).toLowerCase();
  if (out.scalingStat) out.scalingStat = normalizeStructuredAlias(out.scalingStat, { atk:'might', strength:'might', dex:'dexterity', finesse:'dexterity', matk:'focus', magic:'focus' }).toLowerCase();
  if (out.protectionPool) out.protectionPool = normalizeStructuredAlias(out.protectionPool, { armour:'armour', armor:'armour', 'magic armour':'magicArmour', 'magic armor':'magicArmour', 'lowest protection':'lowestProtection' });
  if (out.ailmentId && out.ailmentId !== 'sourceAilment') out.ailmentId = structuredEffectToken(out.ailmentId).toLowerCase().replace(/\s+/g, '');
  if (Array.isArray(out.conditions)) out.conditions = out.conditions.map(function (c) { return { type: structuredEffectToken(c.type), value: /^(true|false)$/i.test(String(c.value)) ? /^true$/i.test(String(c.value)) : c.value }; });
  out.sourceSkillId = sourceSkill && sourceSkill.id || raw.skillId;
  return out;
}
function normalizeSkillEffects(skill) { return (skill && Array.isArray(skill.effects) ? skill.effects : []).map(function (e) { return normalizeEffect(e, skill); }).sort(function (a,b) { return (a.order || 0) - (b.order || 0); }); }
Avian.effects = Avian.effects || Object.create(null); Object.assign(Avian.effects, { normalizeEffect: normalizeEffect, normalizeSkillEffects: normalizeSkillEffects });

