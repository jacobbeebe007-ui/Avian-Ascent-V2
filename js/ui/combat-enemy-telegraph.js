/* Avian Ascent — enemy intent telegraph UI (Step 7 Phase 3). */
function isEnemyIntentVisible(){
  try{
    const cfg=typeof getAccessibilitySettings==='function'?getAccessibilitySettings():{};
    return cfg.showEnemyIntent!==false;
  }catch(_){
    return true;
  }
}
function applyEnemyIntentVisibility(){
  const show=isEnemyIntentVisible();
  document.body.classList.toggle('combat-hide-enemy-intent', !show);
  const dock=document.getElementById('enemy-telegraph');
  if(dock) dock.hidden=!show;
}
function enemyTelegraphActionLabel(action){
  if(!action) return '…';
  if(action.type==='ability') return getEnemyAbilityDisplayLabel(action.abilityId, G.enemy);
  return action.label||action.type||'Action';
}
function enemyTelegraphActionCost(action){
  if(!action) return 0;
  if(Number.isFinite(Number(action.energyCost))) return Math.max(0, Number(action.energyCost));
  if(typeof getEnemyActionEnergyCost==='function') return Math.max(0, Number(getEnemyActionEnergyCost(action))||0);
  return 0;
}
function enemyTelegraphTooltipHtml(plan){
  if(!plan) return '';
  if(plan.type==='plan'){
    const parts=(plan.actions||[]).slice(0,4);
    const blocks=parts.map(a=>{
      if(a.type==='ability') return buildEnemyAbilityTooltipHtml(a.abilityId, G.enemy?.stats);
      return `<div class="tt-name">${escapeEncounterPreviewHtml(a.label||a.type)}</div>`;
    }).filter(Boolean).join('<hr style="border:0;border-top:1px solid var(--border);margin:6px 0">');
    return (parts.length>1?`<div class="tt-desc" style="margin-bottom:6px;opacity:.9">Planned turn — ${parts.length} actions</div>`:'')+blocks;
  }
  if(plan.type==='ability') return buildEnemyAbilityTooltipHtml(plan.abilityId, G.enemy?.stats);
  return '';
}
function renderEnemyPlan(){
  applyEnemyIntentVisibility();
  const host=document.getElementById('enemy-telegraph-actions');
  const enEl=document.getElementById('enemy-telegraph-en');
  const dock=document.getElementById('enemy-telegraph');
  if(!host || !G.enemy) return;
  const maxE=Math.max(0,G.enemy.energyMax||3);
  const curE=Math.min(maxE, Math.max(0, Number(G.enemy.energy)||0));
  const plan=G.enemyNextAction;
  const actions=plan?.type==='plan'
    ? (plan.actions||[]).slice(0,4)
    : (plan ? [plan] : []);
  if(!actions.length){
    host.innerHTML='<span class="enemy-telegraph-chip"><span class="enemy-telegraph-chip-name">Thinking…</span></span>';
  } else {
    host.innerHTML=actions.map(a=>{
      const name=enemyTelegraphActionLabel(a);
      const cost=enemyTelegraphActionCost(a);
      const icon=escapeEncounterPreviewHtml(a.icon||'•');
      return `<button type="button" class="enemy-telegraph-chip" data-enemy-telegraph-chip><span class="enemy-telegraph-chip-icon">${icon}</span><span class="enemy-telegraph-chip-name">${escapeEncounterPreviewHtml(name)}</span>${cost?`<span class="enemy-telegraph-chip-cost">${cost} EN</span>`:''}</button>`;
    }).join('');
  }
  if(enEl) enEl.textContent=`EN ${curE}/${maxE}`;
  const title=enemyTelegraphTooltipHtml(plan);
  const tipTargets=[dock, ...host.querySelectorAll('[data-enemy-telegraph-chip]')].filter(Boolean);
  tipTargets.forEach(el=>{
    if(title){
      el.onmouseenter=(e)=>showTooltip(e,title,e.clientX+10,e.clientY+10);
      el.onmousemove=(e)=>moveTooltip(e.clientX+10,e.clientY+10);
      el.onmouseleave=()=>hideTooltip();
    } else {
      el.onmouseenter=null;
      el.onmousemove=null;
      el.onmouseleave=null;
    }
  });
}
globalThis.renderEnemyPlan=renderEnemyPlan;
globalThis.applyEnemyIntentVisibility=applyEnemyIntentVisibility;

Avian.ui = Avian.ui || Object.create(null);
Avian.ui.combatEnemyTelegraph = { renderEnemyPlan, applyEnemyIntentVisibility };
