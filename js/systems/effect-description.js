function structuredEffectLabel(value) { var labels={magicArmour:'Magic Armour',lowestProtection:'lower protection pool',sourceAilment:'source-selected ailment',armourBroken:'Armour broken'}; return labels[value] || String(value||'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,function(c){return c.toUpperCase();}); }
function describeStructuredEffect(effect, context) {
  var e=effect||{}, mode=context&&context.mode||'full', compact=mode==='compact', debug=mode==='debug', trigger=e.trigger;
  if(debug){ var bits=[]; if(e.damageType)bits.push(structuredEffectLabel(e.damageType)); if(e.powerPercent!=null)bits.push(e.powerPercent+'%'); if(e.scalingStat)bits.push(structuredEffectLabel(e.scalingStat)); if(e.ailmentId)bits.push(structuredEffectLabel(e.ailmentId)); if(e.stacks!=null)bits.push(e.stacks); if(e.chancePercent!=null)bits.push(e.chancePercent+'%'); if(trigger)bits.push(trigger); return structuredEffectLabel(e.type).replace(/\s/g,'')+'['+bits.join(',')+']'; }
  if(e.type==='damage') return (compact?'':'Deal ')+e.powerPercent+'% '+structuredEffectLabel(e.damageType)+(compact?' damage.':' weapon damage.');
  if(e.type==='applyAilment'){ var lead=trigger==='onHealthDamage'||trigger==='afterHealthDamage'?(compact?'Health hit: ':'If this damages Health, '):trigger==='afterAllHits'?(compact?'All hits: ':'After all hits land, '):''; return lead+(compact?'+':'apply ')+(e.stacks||1)+' '+structuredEffectLabel(e.ailmentId)+(e.chancePercent!=null&&e.chancePercent<100?' ('+e.chancePercent+'%)':'')+'.'; }
  if(e.type==='restoreProtection') return 'Restore '+e.amount+' '+structuredEffectLabel(e.protectionPool)+'.';
  if(e.type==='temporaryProtection') return 'Gain '+e.amount+' temporary '+structuredEffectLabel(e.protectionPool)+' for '+e.durationTurns+' turns.';
  if(e.type==='lifesteal') return 'Heal for '+e.modifierValue+'% of Health damage dealt.';
  if(e.type==='penetration') return 'Ignore '+e.penetrationAmount+' '+structuredEffectLabel(e.penetrationStat)+' for '+structuredEffectLabel(e.restriction)+'.';
  if(e.type==='cleanse') return 'Remove '+(e.amount||e.stacks||1)+' '+structuredEffectLabel(e.ailmentId)+' stack.';
  if(e.type==='chooseStatModifier') return 'Choose Might, Dexterity, or Focus to modify.';
  if(e.type==='armNextSkill') return 'Arm the next matching '+structuredEffectLabel((e.restriction||'skill').replace('skillCategory:',''))+' skill.';
  if(e.type==='resolveSourceRider') return 'Apply the equipped source rider.';
  if(/^modify/.test(e.type)) return (e.target==='enemy'?'Reduce ':'Modify ')+structuredEffectLabel(e.stat||e.ailmentId||'status')+(e.modifierValue!=null?' by '+e.modifierValue:'')+(e.durationTurns?' for '+e.durationTurns+' turns':'')+'.';
  return e.notes || structuredEffectLabel(e.type)+'.';
}
function describeStructuredAbility(ability, options){ options=options||{}; var effects=normalizeSkillEffects(ability), mode=options.mode||'full', join=mode==='debug'?' → ':' '; var text=effects.map(function(e){return describeStructuredEffect(e,{mode:mode,ability:ability});}).join(join).trim(); if(options.includeEnergy&&ability.cost)text+=' '+ability.cost.energy+' EN.'; if(options.includeCooldown&&ability.cost&&ability.cost.cooldown)text+=' Cooldown '+ability.cost.cooldown+'.'; return text; }
Avian.effects=Avian.effects||Object.create(null); Object.assign(Avian.effects,{describeStructuredEffect:describeStructuredEffect,describeStructuredAbility:describeStructuredAbility}); globalThis.describeStructuredAbility=describeStructuredAbility; globalThis.describeStructuredEffect=describeStructuredEffect;

