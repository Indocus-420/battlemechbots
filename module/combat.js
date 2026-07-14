function integer(value, label, { min = 0 } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min) {
    throw new RangeError(`${label} must be an integer of at least ${min}.`);
  }
  return number;
}

function terrainPriority(keys = []) {
  const unique = new Set(keys ?? []);
  if (unique.has("heavyWoods")) return "heavyWoods";
  if (unique.has("lightWoods")) return "lightWoods";
  return null;
}

function waterDepth(keys = []) {
  const unique = new Set(keys ?? []);
  if (unique.has("waterDepth3Plus")) return 3;
  if (unique.has("waterDepth2")) return 2;
  if (unique.has("waterDepth1")) return 1;
  return 0;
}

export function heatModifier(heat) {
  const value = integer(heat, "Heat");
  if (value >= 24) return 4;
  if (value >= 17) return 3;
  if (value >= 13) return 2;
  if (value >= 8) return 1;
  return 0;
}

export function rangeModifier(distance, range = {}) {
  const hexes = integer(distance, "Range", { min: 1 });
  const minimum = integer(range.minimum ?? 0, "Minimum range");
  const short = integer(range.short ?? 0, "Short range");
  const medium = integer(range.medium ?? 0, "Medium range");
  const long = integer(range.long ?? 0, "Long range");

  if (short > medium || medium > long) {
    throw new RangeError("Weapon ranges must be ordered from short to medium to long.");
  }
  if (hexes > long) throw new RangeError(`Target is beyond long range (${hexes} > ${long}).`);
  if (minimum > 0 && hexes < minimum) {
    return { bracket: "minimum", modifier: minimum - hexes + 1 };
  }
  if (hexes <= short) return { bracket: "short", modifier: 0 };
  if (hexes <= medium) return { bracket: "medium", modifier: 2 };
  return { bracket: "long", modifier: 4 };
}

export function summarizeCombatTerrainPath({
  interveningRegionKeys = [],
  targetRegionKeys = [],
  attackerRegionKeys = []
} = {}) {
  let interveningLightWoods = 0;
  let interveningHeavyWoods = 0;

  for (const keys of interveningRegionKeys) {
    const terrain = terrainPriority(keys);
    if (terrain === "lightWoods") interveningLightWoods += 1;
    if (terrain === "heavyWoods") interveningHeavyWoods += 1;
  }

  const targetWoods = terrainPriority(targetRegionKeys);
  return {
    interveningLightWoods,
    interveningHeavyWoods,
    targetLightWoods: targetWoods === "lightWoods",
    targetHeavyWoods: targetWoods === "heavyWoods",
    targetWaterDepth: waterDepth(targetRegionKeys),
    attackerWaterDepth: waterDepth(attackerRegionKeys)
  };
}

export function terrainAttackModifiers({
  interveningLightWoods = 0,
  interveningHeavyWoods = 0,
  targetLightWoods = false,
  targetHeavyWoods = false,
  partialCover = false,
  targetWaterDepth = 0,
  attackerWaterDepth = 0
} = {}) {
  const light = integer(interveningLightWoods, "Intervening light woods");
  const heavy = integer(interveningHeavyWoods, "Intervening heavy woods");
  const targetDepth = integer(targetWaterDepth, "Target water depth");
  const attackerDepth = integer(attackerWaterDepth, "Attacker water depth");
  const interveningWoods = light + (heavy * 2);
  const targetWoods = targetHeavyWoods ? 2 : (targetLightWoods ? 1 : 0);
  const cover = Boolean(partialCover) || targetDepth === 1 ? 1 : 0;
  const losBlocked = interveningWoods > 2;
  const underwaterMismatch = (attackerDepth >= 2) !== (targetDepth >= 2);

  return {
    interveningLightWoods: light,
    interveningHeavyWoods: heavy,
    interveningWoods,
    targetWoods,
    partialCover: cover,
    targetWaterDepth: targetDepth,
    attackerWaterDepth: attackerDepth,
    modifier: interveningWoods + targetWoods + cover,
    losBlocked,
    underwaterMismatch
  };
}

export function calculateAttackTargetNumber({
  gunnery,
  attackerMovement = 0,
  targetMovement = 0,
  heat = 0,
  distance,
  weaponRange,
  terrain = {},
  attackerProne = false,
  targetProne = false,
  targetImmobile = false
}) {
  const base = integer(gunnery, "Gunnery skill");
  const attackerMove = integer(attackerMovement, "Attacker movement modifier");
  const targetMove = integer(targetMovement, "Target movement modifier");
  const hexes = integer(distance, "Range", { min: 1 });
  const heatMod = heatModifier(heat);
  const range = rangeModifier(hexes, weaponRange);
  const terrainResult = terrainAttackModifiers(terrain);
  const attackerStatus = attackerProne ? 2 : 0;
  const targetStatus = targetImmobile ? -4 : (targetProne ? (hexes === 1 ? -2 : 1) : 0);
  const targetNumber = base
    + attackerMove
    + attackerStatus
    + targetMove
    + targetStatus
    + heatMod
    + terrainResult.modifier
    + range.modifier;

  let reason = null;
  if (terrainResult.losBlocked) reason = "Intervening woods block line of sight.";
  else if (terrainResult.underwaterMismatch) {
    reason = "A submerged unit cannot target a unit that is not submerged.";
  }

  return {
    canAttack: reason === null,
    reason,
    distance: hexes,
    targetNumber,
    automaticFailure: targetNumber > 12,
    components: {
      gunnery: base,
      attackerMovement: attackerMove,
      attackerStatus,
      targetMovement: targetMove,
      targetStatus,
      heat: heatMod,
      terrain: terrainResult.modifier,
      range: range.modifier
    },
    range,
    terrain: terrainResult
  };
}

