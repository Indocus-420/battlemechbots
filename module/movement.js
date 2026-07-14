export const MOVEMENT_MODES = Object.freeze({
  stand: Object.freeze({ label: "Standing Still", attackerModifier: 0, heat: 0 }),
  walk: Object.freeze({ label: "Walking", attackerModifier: 1, heat: 1 }),
  run: Object.freeze({ label: "Running", attackerModifier: 2, heat: 2 }),
  jump: Object.freeze({ label: "Jumping", attackerModifier: 3, heat: null })
});

export const TERRAIN_COSTS = Object.freeze({
  roughHexes: 1,
  lightWoodsHexes: 1,
  heavyWoodsHexes: 2,
  rubbleHexes: 1,
  waterDepth1Hexes: 1,
  waterDepth2Hexes: 3,
  waterDepth3PlusHexes: 3,
  levelChanges: 1,
  facingChanges: 1
});

export const REGION_TERRAINS = Object.freeze({
  rough: Object.freeze({ label: "Rough", field: "roughHexes", cost: 1, priority: 10, color: "#8b6f47" }),
  lightWoods: Object.freeze({ label: "Light Woods", field: "lightWoodsHexes", cost: 1, priority: 20, color: "#6f9b45" }),
  heavyWoods: Object.freeze({ label: "Heavy Woods", field: "heavyWoodsHexes", cost: 2, priority: 30, color: "#315f35" }),
  rubble: Object.freeze({ label: "Rubble", field: "rubbleHexes", cost: 1, priority: 40, color: "#777777" }),
  waterDepth1: Object.freeze({ label: "Depth 1 Water", field: "waterDepth1Hexes", cost: 1, priority: 50, color: "#3f8fc4" }),
  waterDepth2: Object.freeze({ label: "Depth 2 Water", field: "waterDepth2Hexes", cost: 3, priority: 60, color: "#24638f" }),
  waterDepth3Plus: Object.freeze({ label: "Depth 3+ Water", field: "waterDepth3PlusHexes", cost: 3, priority: 70, color: "#173f66" })
});

function nonNegativeInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new TypeError(`${label} must be a non-negative integer.`);
  }
  return number;
}

export function combineMovementSections(...sections) {
  const waypoints = [];
  let spaces = 0;

  for (const section of sections) {
    spaces += nonNegativeInteger(section?.spaces ?? 0, "Movement spaces");
    for (const waypoint of section?.waypoints ?? []) {
      const previous = waypoints.at(-1);
      if (previous
        && previous.x === waypoint.x
        && previous.y === waypoint.y
        && (previous.elevation ?? 0) === (waypoint.elevation ?? 0)
        && previous.action === waypoint.action) continue;
      waypoints.push(waypoint);
    }
  }

  return { spaces, waypoints };
}

export function targetMovementModifier(hexesMoved, jumped = false) {
  const hexes = nonNegativeInteger(hexesMoved, "Hexes moved");
  let modifier = 0;
  if (hexes >= 25) modifier = 6;
  else if (hexes >= 18) modifier = 5;
  else if (hexes >= 10) modifier = 4;
  else if (hexes >= 7) modifier = 3;
  else if (hexes >= 5) modifier = 2;
  else if (hexes >= 3) modifier = 1;
  return modifier + (jumped ? 1 : 0);
}

export function movementAllowance(mode, ratings) {
  if (!(mode in MOVEMENT_MODES)) throw new RangeError(`Unknown movement mode: ${mode}`);
  if (mode === "stand") return 0;
  return nonNegativeInteger(ratings[mode], `${MOVEMENT_MODES[mode].label} MP`);
}

export function calculateTerrainProfile(terrain = {}) {
  const profile = {};
  for (const field of Object.keys(TERRAIN_COSTS)) {
    profile[field] = nonNegativeInteger(terrain[field] ?? 0, field);
  }

  const terrainHexes = profile.roughHexes
    + profile.lightWoodsHexes
    + profile.heavyWoodsHexes
    + profile.rubbleHexes
    + profile.waterDepth1Hexes
    + profile.waterDepth2Hexes
    + profile.waterDepth3PlusHexes;
  const terrainCost = Object.entries(TERRAIN_COSTS)
    .reduce((total, [field, cost]) => total + (profile[field] * cost), 0);
  const pilotingChecks = profile.rubbleHexes
    + profile.waterDepth1Hexes
    + profile.waterDepth2Hexes
    + profile.waterDepth3PlusHexes;

  return {
    ...profile,
    terrainHexes,
    terrainCost,
    pilotingChecks,
    pilotingSummary: [
      profile.rubbleHexes ? `${profile.rubbleHexes} rubble (+0)` : null,
      profile.waterDepth1Hexes ? `${profile.waterDepth1Hexes} Depth 1 water (-1)` : null,
      profile.waterDepth2Hexes ? `${profile.waterDepth2Hexes} Depth 2 water (+0)` : null,
      profile.waterDepth3PlusHexes ? `${profile.waterDepth3PlusHexes} Depth 3+ water (+1)` : null
    ].filter(Boolean)
  };
}

export function summarizeRegionTerrainPath(regionKeysByHex = []) {
  const profile = Object.fromEntries(Object.keys(TERRAIN_COSTS).map(field => [field, 0]));

  for (const regionKeys of regionKeysByHex) {
    const terrain = [...new Set(regionKeys ?? [])]
      .map(key => REGION_TERRAINS[key])
      .filter(Boolean)
      .sort((a, b) => (b.cost - a.cost) || (b.priority - a.priority))[0];
    if (terrain) profile[terrain.field] += 1;
  }

  return profile;
}

export function addTerrainProfiles(base = {}, added = {}) {
  return Object.fromEntries(Object.keys(TERRAIN_COSTS).map(field => [
    field,
    nonNegativeInteger(base[field] ?? 0, field) + nonNegativeInteger(added[field] ?? 0, field)
  ]));
}

export function calculateMovementPlan({
  mode,
  hexesMoved,
  mpSpent,
  ratings,
  terrain = {}
}) {
  if (!(mode in MOVEMENT_MODES)) throw new RangeError(`Unknown movement mode: ${mode}`);

  const hexes = nonNegativeInteger(hexesMoved, "Hexes moved");
  const spent = nonNegativeInteger(mpSpent, "MP spent");
  const allowance = movementAllowance(mode, ratings);
  const terrainProfile = calculateTerrainProfile(terrain);
  const terrainApplies = mode === "walk" || mode === "run";
  const terrainCost = terrainApplies ? terrainProfile.terrainCost : 0;
  const requiredMp = hexes + terrainCost;

  if (mode === "stand" && (hexes !== 0 || spent !== 0)) {
    throw new RangeError("A BattleMech standing still cannot move or spend MP.");
  }
  if (mode !== "stand" && spent > allowance) {
    throw new RangeError(`${MOVEMENT_MODES[mode].label} movement cannot exceed ${allowance} MP.`);
  }
  if (mode !== "stand" && spent < requiredMp) {
    throw new RangeError(
      `${MOVEMENT_MODES[mode].label} movement requires at least ${requiredMp} MP `
      + `(${hexes} hex MP + ${terrainCost} terrain/facing MP).`
    );
  }
  if (mode === "jump" && allowance === 0) {
    throw new RangeError("This BattleMech has no Jumping MP.");
  }
  if (terrainApplies && terrainProfile.terrainHexes > hexes) {
    throw new RangeError("Terrain hex entries cannot exceed the number of hexes moved.");
  }
  if (mode === "run" && (
    terrainProfile.waterDepth1Hexes
    || terrainProfile.waterDepth2Hexes
    || terrainProfile.waterDepth3PlusHexes
  )) {
    throw new RangeError("A BattleMech cannot enter Depth 1 or deeper water while running.");
  }

  const jumped = mode === "jump";
  return {
    mode,
    modeLabel: MOVEMENT_MODES[mode].label,
    allowance,
    hexesMoved: hexes,
    mpSpent: spent,
    requiredMp,
    terrain: {
      ...terrainProfile,
      terrainCost,
      pilotingChecks: terrainApplies ? terrainProfile.pilotingChecks : 0,
      pilotingSummary: terrainApplies ? terrainProfile.pilotingSummary : []
    },
    attackerModifier: MOVEMENT_MODES[mode].attackerModifier,
    targetModifier: targetMovementModifier(hexes, jumped),
    heatGenerated: jumped ? Math.max(3, spent) : MOVEMENT_MODES[mode].heat
  };
}
