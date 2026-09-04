/* Avian Ascent — Stork shop compare tooltips (Step 7 Phase 5). */
function _shopCompareDeltaClass(delta){
  if(!(delta>0 || delta<0)) return 'shop-tt-delta-flat';
  return delta>0?'shop-tt-delta-up':'shop-tt-delta-down';
}
function _shopCompareFmt(val, isPct){
  const n=Number(val)||0;
  if(isPct) return `${n>0?'+':''}${n}%`;
  return String(n);
}
function _shopCompareStatRow(label, shopVal, wornVal, isPct){
  const s=Number(shopVal)||0;
  const w=Number(wornVal)||0;
  const d=s-w;
  const sign=d>0?'+':d<0?'−':'=';
  const shown=d===0?'same':`${sign}${Math.abs(d)}${isPct?'%':''}`;
  return `<div class="shop-tt-row"><span class="shop-tt-lbl">${escapeHtmlRoster(label)}</span><span class="shop-tt-vals">${_shopCompareFmt(s,isPct)} vs ${_shopCompareFmt(w,isPct)}</span><span class="${_shopCompareDeltaClass(d)}">${shown}</span></div>`;
}
const SHOP_COMPARE_STAT_ORDER=['atk','matk','def','mdef','spd','hp','maxHp','dex','dodge','acc','critChance','critDamage','critMult'];
function _shopCompareRows(shop, worn){
  const rows=[];
  if(typeof itemHasDisplayableWeaponDamage==='function'
     && (itemHasDisplayableWeaponDamage(shop) || itemHasDisplayableWeaponDamage(worn))){
    const sMin=Number(shop.minDamage)||0, sMax=Number(shop.maxDamage)||0;
    const wMin=Number(worn.minDamage)||0, wMax=Number(worn.maxDamage)||0;
    const d=(sMin+sMax)-(wMin+wMax);
    rows.push(`<div class="shop-tt-row"><span class="shop-tt-lbl">Damage</span><span class="shop-tt-vals">${sMin}–${sMax} vs ${wMin}–${wMax}</span><span class="${_shopCompareDeltaClass(d)}">${d>0?'+':d<0?'−':'='}${d===0?'same':Math.abs(d)}</span></div>`);
  }
  const keys=new Set([...Object.keys(shop.stats||{}), ...Object.keys(worn.stats||{})]);
  const ordered=[
    ...SHOP_COMPARE_STAT_ORDER.filter((k)=>keys.has(k)),
    ...[...keys].filter((k)=>!SHOP_COMPARE_STAT_ORDER.includes(k)).sort(),
  ];
  for(const key of ordered){
    const s=Number(shop.stats?.[key])||0;
    const w=Number(worn.stats?.[key])||0;
    if(!s && !w) continue;
    const isPct=String(key).includes('Pct')||/Pct$/i.test(key);
    const lbl=typeof formatAnyStatLabel==='function'?formatAnyStatLabel(key):key;
    rows.push(_shopCompareStatRow(lbl, s, w, isPct));
  }
  return rows;
}

function _shopCompareCandidateSlots(item){
  const order=(typeof Avian?.equipment?.getSlotOrder==='function'
    ? Avian.equipment.getSlotOrder()
    : ['helmet','armour','mainHand','offHand','anklets','necklace']);
  if(typeof Avian?.equipment?.slotAcceptsItem==='function'){
    return order.filter((sk)=>Avian.equipment.slotAcceptsItem(sk, item));
  }
  const accepts=String(item?.slot||'');
  const meta=Avian.data?.equipment?.slots?.slots||{};
  if(!accepts) return order.slice();
  return order.filter((sk)=>String(meta[sk]?.accepts||'')===accepts || (sk==='offHand' && accepts==='Shield'));
}
function _shopCompareResolve(player, itemId){
  const shop=getEquipmentItem(itemId);
  const emptySlot=typeof Avian?.equipment?.findEmptyEquipSlotForItem==='function'
    ? Avian.equipment.findEmptyEquipSlotForItem(player, itemId)
    : null;
  if(emptySlot) return {slot:emptySlot, empty:true, shop};
  const legal=typeof Avian?.equipment?.findEquipSlotForItem==='function'
    ? Avian.equipment.findEquipSlotForItem(player, itemId)
    : null;
  if(legal) return {slot:legal, empty:!player.equipment?.[legal], shop};
  const candidates=_shopCompareCandidateSlots(shop);
  for(const sk of candidates){
    if(player.equipment?.[sk]) return {slot:sk, empty:false, shop};
  }
  return {slot:candidates[0]||null, empty:true, shop};
}

function buildShopCompareTooltipHtml(shopItem){
  if(!shopItem) return '';
  const itemId=shopItem.equipmentItemId||shopItem.id;
  if(!itemId || !getEquipmentItem(itemId)) return '';
  const body=buildEquipmentTooltipHTML(itemId, {omitClose:true})||'';
  if(!body) return '';
  const player=G.player||null;
  if(!player) return body+richTooltipCloseBtn();
  const resolved=_shopCompareResolve(player, itemId);
  const slot=resolved.slot;
  const slotLbl=slot && typeof getEquipmentNestSlotLabel==='function'
    ? getEquipmentNestSlotLabel(slot)
    : (slot||'worn gear');
  let compare='';
  if(resolved.empty){
    compare=`<div class="shop-tt-compare"><div class="shop-tt-compare-h">Compare · ${escapeHtmlRoster(slotLbl)}</div><div class="shop-tt-empty">No item equipped in this slot.</div></div>`;
  } else {
    const wornId=slot?player.equipment?.[slot]:null;
    const worn=wornId?getEquipmentItem(wornId):null;
    const shop=resolved.shop||getEquipmentItem(itemId);
    if(worn && shop && worn.id!==shop.id){
      const rows=_shopCompareRows(shop, worn);
      const bodyRows=rows.length?rows.join(''):'<div class="shop-tt-empty">No overlapping stats to compare.</div>';
      compare=`<div class="shop-tt-compare"><div class="shop-tt-compare-h">vs equipped ${escapeHtmlRoster(worn.name)}</div>${bodyRows}</div>`;
    } else if(worn && shop && worn.id===shop.id){
      compare=`<div class="shop-tt-compare"><div class="shop-tt-compare-h">Compare · ${escapeHtmlRoster(slotLbl)}</div><div class="shop-tt-empty">Same piece as currently equipped.</div></div>`;
    } else {
      compare=`<div class="shop-tt-compare"><div class="shop-tt-compare-h">Compare · ${escapeHtmlRoster(slotLbl)}</div><div class="shop-tt-empty">No item equipped in this slot.</div></div>`;
    }
  }
  return body+compare+richTooltipCloseBtn();
}

function _shopSuppressHoldClick(el){
  el.addEventListener('touchend', ()=>{
    const tt=document.getElementById('action-tooltip');
    if(tt && tt.classList.contains('is-touch-open') && tt.style.display==='block'){
      el._shopHoldTooltip=true;
    }
  }, {passive:true});
  el.addEventListener('click', (e)=>{
    if(!el._shopHoldTooltip) return;
    el._shopHoldTooltip=false;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
}

function bindShopItemCompareTooltips(){
  const shop=document.getElementById('screen-stork-shop');
  if(!shop || typeof bindRichTooltip!=='function') return;
  shop.querySelectorAll('.shop-item[data-shop-item-id]').forEach((el)=>{
    const sid=el.getAttribute('data-shop-item-id');
    const idx=Number(el.dataset.shopIdx);
    const item=(_shopItems||[])[idx] || (_shopItems||[]).find((i)=>i && i.id===sid);
    if(!item || (item.type!=='equipment' && !item.equipmentItemId)) return;
    el.removeAttribute('title');
    el._richTooltipBound=false;
    bindRichTooltip(el, ()=>buildShopCompareTooltipHtml(item), {delay:280, interactive:true, category:'items'});
    _shopSuppressHoldClick(el);
  });
  shop.querySelectorAll('.shop-item[data-shop-eq-item]').forEach((el)=>{
    if(el._richTooltipBound) return;
    const itemId=el.getAttribute('data-shop-eq-item');
    if(!itemId) return;
    bindRichTooltip(el, ()=>buildShopCompareTooltipHtml({id:itemId, equipmentItemId:itemId, type:'equipment'}), {delay:280, interactive:true, category:'items'});
    _shopSuppressHoldClick(el);
  });
}
