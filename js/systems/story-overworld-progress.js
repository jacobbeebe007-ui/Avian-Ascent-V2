/* Avian Ascent — overworld progress state (Step 7 Phase 6). */
function normalizeOverworldProgress(progress=null, fallbackStage=1) {
  const maxStage = getStoryMaxStage();
  const impl = globalThis.normalizeOverworldProgressShared;
  if(typeof impl === 'function') return impl(progress, fallbackStage, maxStage);
  const nextStage = Math.max(1, Math.floor(Number(fallbackStage) || 1));
  const rawCompleted = Number(progress?.completedStage);
  const ceiling = Math.max(0, nextStage - 1);
  const merged = Math.min(maxStage, Math.max(
    ceiling,
    Number.isFinite(rawCompleted) ? Math.floor(rawCompleted) : 0
  ));
  const completedStage = Math.min(merged, ceiling);
  const rawNodeId = Number(progress?.currentNodeId);
  const currentNodeId = Number.isFinite(rawNodeId) ? Math.max(0, Math.floor(rawNodeId)) : 0;
  const lastSummary = (progress?.lastSummary && typeof progress.lastSummary === 'object')
    ? JSON.parse(JSON.stringify(progress.lastSummary))
    : null;
  return {completedStage, currentNodeId, lastSummary};
}

function ensureOverworldProgress(fallbackStage=G.stage||1) {
  G._overworldProgress = normalizeOverworldProgress(G._overworldProgress, fallbackStage);
  return G._overworldProgress;
}

function setOverworldCurrentNode(nodeId) {
  const rawNodeId = Number(nodeId);
  if(!Number.isFinite(rawNodeId)) return;
  const progress = ensureOverworldProgress();
  progress.currentNodeId = Math.max(0, Math.floor(rawNodeId));
}

function finalizeOverworldStageClear(clearedStage, nodeId, summary={}) {
  const stageNum = Math.max(1, Math.floor(Number(clearedStage) || 1));
  const progress = ensureOverworldProgress(stageNum);
  progress.completedStage = Math.max(progress.completedStage || 0, stageNum);
  const owNodes = getActiveOwNodesForProgress();
  const nextCursor =
    typeof globalThis.resolveOverworldCursorNodeIdAfterClear === 'function'
      ? globalThis.resolveOverworldCursorNodeIdAfterClear(progress.completedStage, owNodes)
      : null;
  if (nextCursor != null) progress.currentNodeId = nextCursor;
  else if (Number.isFinite(Number(nodeId))) progress.currentNodeId = Math.max(0, Math.floor(Number(nodeId)));
  progress.lastSummary = {
    stage: stageNum,
    nodeId: Number.isFinite(Number(nodeId)) ? Math.max(0, Math.floor(Number(nodeId))) : progress.currentNodeId,
    shinyGain: Math.max(0, Math.floor(Number(summary?.shinyGain) || 0)),
    enemiesDefeated: Math.max(1, Math.floor(Number(summary?.enemiesDefeated) || 1)),
    nextStage: Math.min(getStoryMaxStage(), stageNum + 1),
  };
  G.stage = Math.max(1, progress.completedStage + 1);
  return progress;
}

function clearOverworldPendingBattle() {
  G._owPendingBattleStage = null;
  G._owPendingNodeId = null;
  G._owEnemyCount = 0;
  G._owSequenceShiny = 0;
  G._owEnemyIndex = 0;
  G._owStageEnemies = null;
  G._owEncounterDrafts = null;
  G._owEncounterDraftsSig = null;
  G._owEncounterMaterialized = null;
  G._owEncounterMaterializedSig = null;
  G._battleTerrain = null;
  G._encounterPreviewCollapsed = null;
  G._owEncounterRollStage = null;
  resetStageBattleStats();
}
