/* Shiny miscellaneous items — tiered nest drops sold at the Stork Shop. */
(function initShinyMiscCatalog() {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || {};

  /** @type {ReadonlyArray<{id:string,kind:string,tier:string,name:string,icon:string,amount:number,dropWeight:number,desc:string}>} */
  var SHINY_MISC_ITEMS = Object.freeze([
    {
      id: 'dull_trinket',
      kind: 'bonus_shines',
      tier: 'grey',
      name: 'Dull Trinket',
      icon: '🪙',
      amount: 4,
      dropWeight: 42,
      desc: 'Faint sparkles (+4). Sell at the Stork Shop.',
    },
    {
      id: 'polished_bauble',
      kind: 'bonus_shines',
      tier: 'green',
      name: 'Polished Bauble',
      icon: '💎',
      amount: 8,
      dropWeight: 30,
      desc: 'Modest shinies (+8). Sell at the Stork Shop.',
    },
    {
      id: 'glimmering_relic',
      kind: 'bonus_shines',
      tier: 'blue',
      name: 'Glimmering Relic',
      icon: '🔷',
      amount: 14,
      dropWeight: 18,
      desc: 'Worthwhile shinies (+14). Sell at the Stork Shop.',
    },
    {
      id: 'radiant_curio',
      kind: 'bonus_shines',
      tier: 'purple',
      name: 'Radiant Curio',
      icon: '💜',
      amount: 22,
      dropWeight: 8,
      desc: 'Rich shinies (+22). Sell at the Stork Shop.',
    },
    {
      id: 'shiny_hoard',
      kind: 'bonus_shines',
      tier: 'gold',
      name: 'Shiny Hoard',
      icon: '✨',
      amount: 35,
      dropWeight: 2,
      desc: 'Legendary shinies (+35). Sell at the Stork Shop.',
    },
  ]);

  /** Base chance any shiny misc item drops (endless: per defeated bird). */
  var NEST_SHINY_DROP_CHANCE = 0.20;

  var byId = Object.create(null);
  SHINY_MISC_ITEMS.forEach(function (item) {
    byId[item.id] = item;
  });

  function pickWeighted(entries) {
    var total = 0;
    for (var i = 0; i < entries.length; i++) total += Math.max(0, Number(entries[i].w) || 0);
    if (total <= 0) return entries[0] ? entries[0].item : null;
    var r = Math.random() * total;
    for (var j = 0; j < entries.length; j++) {
      r -= Math.max(0, Number(entries[j].w) || 0);
      if (r <= 0) return entries[j].item;
    }
    return entries[entries.length - 1] ? entries[entries.length - 1].item : null;
  }

  function getShinyMiscDef(id) {
    return byId[String(id || '')] || null;
  }

  function getDefaultShinyMiscDef() {
    return SHINY_MISC_ITEMS[SHINY_MISC_ITEMS.length - 1] || SHINY_MISC_ITEMS[0];
  }

  function rollShinyMiscItem(force) {
    if (!force && Math.random() > NEST_SHINY_DROP_CHANCE) return null;
    var picked = pickWeighted(SHINY_MISC_ITEMS.map(function (item) {
      return { item: item, w: item.dropWeight };
    }));
    return picked || getDefaultShinyMiscDef();
  }

  function shinyMiscToNestDrop(def) {
    if (!def) return null;
    return {
      type: 'shiny',
      shinyMiscId: def.id,
      kind: def.kind,
      amount: def.amount,
      tier: def.tier,
      icon: def.icon,
      name: def.name,
      desc: def.desc,
    };
  }

  Avian.data.shinyMiscCatalog = {
    items: SHINY_MISC_ITEMS,
    nestShinyDropChance: NEST_SHINY_DROP_CHANCE,
    getShinyMiscDef: getShinyMiscDef,
    getDefaultShinyMiscDef: getDefaultShinyMiscDef,
    rollShinyMiscItem: rollShinyMiscItem,
    shinyMiscToNestDrop: shinyMiscToNestDrop,
  };

  globalThis.getShinyMiscDef = getShinyMiscDef;
  globalThis.rollShinyMiscItem = rollShinyMiscItem;
})();
