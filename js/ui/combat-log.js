/* Touch-first history and calculation-detail views for canonical combat results. */
(function initCombatLog(global) {
  'use strict';
  var Avian = global.Avian = global.Avian || {};
  Avian.ui = Avian.ui || {};
  function service() { return Avian.systems && Avian.systems.combatBreakdown; }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }
  function number(value) { return Number.isInteger(Number(value)) ? String(Number(value)) : String(Math.round((Number(value) || 0) * 100) / 100); }
  function summary(result) {
    if (!result.hit) return 'MISS · 0 damage';
    var damage = result.damage || {};
    var effects = (result.effects || []).filter(function (e) { return e.applied; }).map(function (e) { return '+' + number(e.stacks || e.amount || 1) + ' ' + String(e.ailment || e.name || e.type).toUpperCase(); });
    return number(damage.totalDamage) + ' ' + String(damage.type || '').toUpperCase() + ' DAMAGE' + (result.critical ? ' · CRITICAL' : '') + (effects.length ? ' · ' + effects.join(', ') : '');
  }
  function row(label, value) { return '<div class="combat-breakdown-row"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>'; }
  function section(title, content) { return '<section class="combat-breakdown-section"><h3>' + escapeHtml(title) + '</h3>' + content + '</section>'; }
  function renderDetail(result) {
    var d = result.damage || {};
    var damageRows = row('Weapon roll', d.weaponRoll == null ? '—' : number(d.weaponRoll));
    if (d.scalingStat) damageRows += row(String(d.scalingStat).replace(/^./, function (c) { return c.toUpperCase(); }) + ' scaling', '+' + number(d.scalingContribution));
    damageRows += row('Skill Power', number(d.skillPowerPercent) + '%');
    damageRows += row('Pre-modifier damage', number(d.preModifierDamage));
    damageRows += row('Target ' + (d.penetration && d.penetration.stat || 'defence'), number(d.defenceValue));
    if (d.penetration && (d.penetration.amount || d.penetration.percent)) damageRows += row('Effective defence', number(d.effectiveDefence));
    if (d.affinityMultiplier !== 1) damageRows += row('Affinity', '×' + number(d.affinityMultiplier));
    if (result.critical) damageRows += row('Critical', '×' + number(d.criticalMultiplier));
    damageRows += row('Final damage', number(d.totalDamage));
    var routing = row('Armour absorbed', number(d.armourDamage)) + row('Magic Armour absorbed', number(d.magicArmourDamage)) + row('Health damage', number(d.healthDamage));
    if (d.blockedByProtection) routing += '<p class="combat-breakdown-note">Blocked by protection</p>';
    var effects = (result.effects || []).map(function (effect) {
      var label = effect.ailment || effect.name || effect.type || 'Effect';
      var value = effect.applied ? '+' + number(effect.stacks || effect.amount || 1) : 'Not applied — ' + (effect.reason || 'requirements failed');
      return row(label, value);
    }).join('') || '<p class="combat-breakdown-note">No additional effects</p>';
    var debug = '';
    if (global.AVIAN_COMBAT_DEBUG) debug = section('Debug stages', (result.calculationStages || []).map(function (stage) { return row(stage.stage, stage.value == null ? '—' : number(stage.value)); }).join(''));
    return '<h2 id="combat-breakdown-title">' + escapeHtml(result.actionName) + '</h2>' + row('Result', result.hit ? '✓ HIT' : 'MISS') + section('Damage', damageRows) + section('Damage routing', routing) + section('Effects', effects) + debug;
  }
  function refresh() {
    var list = document.getElementById('combat-history-list');
    if (!list || !service()) return;
    var history = service().getHistory().slice().reverse();
    list.innerHTML = history.length ? history.map(function (result) {
      return '<button type="button" class="combat-history-entry" data-action="openCombatBreakdown:' + Number(result.sequence) + '"><span>Turn ' + (Number(result.turn) || Number(global.G && global.G.turn) || 0) + ' · ' + escapeHtml(result.actionName) + '</span><strong>' + escapeHtml(summary(result)) + '</strong></button>';
    }).join('') : '<p class="combat-log-empty">Actions will appear here after combat begins.</p>';
  }
  global.openCombatHistory = function openCombatHistory() {
    refresh(); var modal = document.getElementById('combat-history-modal'); if (modal) { modal.hidden = false; modal.querySelector('button')?.focus(); }
  };
  global.closeCombatHistory = function closeCombatHistory() { var modal = document.getElementById('combat-history-modal'); if (modal) modal.hidden = true; };
  global.openCombatBreakdown = function openCombatBreakdown(sequence) {
    var result = service() && service().getHistory().find(function (item) { return Number(item.sequence) === Number(sequence); });
    if (!result) return;
    var body = document.getElementById('combat-breakdown-body'); if (body) body.innerHTML = renderDetail(result);
    var modal = document.getElementById('combat-breakdown-modal'); if (modal) { modal.hidden = false; modal.querySelector('button')?.focus(); }
  };
  global.closeCombatBreakdown = function closeCombatBreakdown() { var modal = document.getElementById('combat-breakdown-modal'); if (modal) modal.hidden = true; };
  Avian.ui.combatLog = { refresh: refresh, renderDetail: renderDetail, summary: summary };
})(globalThis);
