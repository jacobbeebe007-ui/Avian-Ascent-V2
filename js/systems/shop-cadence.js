/* Avian Ascent — shop visit cadence after battles (Step 7 Phase 5). */
function isGreyShopStage(stage){
  const s = Math.max(1, Math.floor(Number(stage) || 0));
  const endlessBattle = getEndlessEffectiveBattleNumber(s);
  if (G.endlessMode && endlessBattle > 0) {
    return endlessBattle % ENDLESS_SHOP_CADENCE === 0;
  }
  const storyBoss = s === STORY_MILESTONE_BOSS_STAGE || s === STORY_DUKE_STAGE;
  return (s % 4 === 0) && !storyBoss;
}

function isShopDueAfterBattle({ stage, endlessMode, endlessBattle, lastEnemyWasBoss } = {}){
  if(endlessMode){
    // Map merchants replace cadence shops while the endless node map is active.
    if(isEndlessMapActive()) return false;
    const eb = Math.max(0, Math.floor(Number(endlessBattle) || 0));
    return eb > 0 && eb % ENDLESS_SHOP_CADENCE === 0;
  }
  return !!lastEnemyWasBoss || isGreyShopStage(stage);
}
globalThis.isGreyShopStage = isGreyShopStage;
globalThis.isShopDueAfterBattle = isShopDueAfterBattle;
