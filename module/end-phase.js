export const END_PHASE_TERRAIN_RESET = Object.freeze({
  roughHexes: 0,
  lightWoodsHexes: 0,
  heavyWoodsHexes: 0,
  rubbleHexes: 0,
  waterDepth1Hexes: 0,
  waterDepth2Hexes: 0,
  waterDepth3PlusHexes: 0,
  levelChanges: 0,
  facingChanges: 0,
  terrainCost: 0,
  requiredMp: 0,
  pilotingChecks: 0
});

export function endPhaseActorState({ pilotHits = 0, lifeSupportHits = 0, submerged = false } = {}) {
  const pilotDamage = submerged && Number(lifeSupportHits) > 0 ? 1 : 0;
  const nextPilotHits = Math.min(6, Math.max(0, Number(pilotHits)) + pilotDamage);
  return {
    pilotDamage,
    pilotHits: nextPilotHits,
    pilotDestroyed: nextPilotHits >= 6,
    movement: {
      mode: "stand",
      hexesMoved: 0,
      mpSpent: 0,
      attackerModifier: 0,
      targetModifier: 0,
      heatGenerated: 0,
      terrain: { ...END_PHASE_TERRAIN_RESET }
    }
  };
}
