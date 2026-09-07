import { hitLocation } from "./damage.js";

export const PHYSICAL_ATTACK_TYPES = Object.freeze({
  punch: Object.freeze({ label: "Punch", modifier: 0 }),
  kick: Object.freeze({ label: "Kick", modifier: -2 })
});

const PUNCH_LOCATION_TABLE = Object.freeze({
  left: Object.freeze({
    1: "leftTorso", 2: "leftTorso", 3: "centerTorso",
    4: "leftArm", 5: "leftArm", 6: "head"
  }),
  front: Object.freeze({
    1: "leftArm", 2: "leftTorso", 3: "centerTorso",
    4: "rightTorso", 5: "rightArm", 6: "head"
  }),
  rear: Object.freeze({
    1: "leftArm", 2: "leftTorso", 3: "centerTorso",
    4: "rightTorso", 5: "rightArm", 6: "head"
  }),
  right: Object.freeze({
    1: "rightTorso", 2: "rightTorso", 3: "centerTorso",
    4: "rightArm", 5: "rightArm", 6: "head"
  })
});

const KICK_LOCATION_TABLE = Object.freeze({
  left: Object.freeze({ 1: "leftLeg", 2: "leftLeg", 3: "leftLeg", 4: "leftLeg", 5: "leftLeg", 6: "leftLeg" }),
  front: Object.freeze({ 1: "rightLeg", 2: "rightLeg", 3: "rightLeg", 4: "leftLeg", 5: "leftLeg", 6: "leftLeg" }),
  rear: Object.freeze({ 1: "rightLeg", 2: "rightLeg", 3: "rightLeg", 4: "leftLeg", 5: "leftLeg", 6: "leftLeg" }),
  right: Object.freeze({ 1: "rightLeg", 2: "rightLeg", 3: "rightLeg", 4: "rightLeg", 5: "rightLeg", 6: "rightLeg" })
});

function integer(value, label, { min = -Infinity, max = Infinity } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RangeError(`${label} must be an integer from ${min} to ${max}.`);
  }
  return number;
}

function attackDirection(direction) {
  if (!PUNCH_LOCATION_TABLE[direction]) throw new RangeError(`Unknown attack direction: ${direction}`);
  return direction;
}

function physicalTable(type, { targetProne, elevationDifference }) {
  if (targetProne) {
    if (type === "kick" && elevationDifference === 0) return "normal";
    if (type === "punch" && elevationDifference === 1) return "normal";
    return null;
  }
  if (elevationDifference === 0) return type;
  if (type === "punch" && elevationDifference === 1) return "kick";
  if (type === "kick" && elevationDifference === -1) return "punch";
  return null;
}

function actuatorProfile(type, state = {}) {
  if (type === "punch") {
    if (state.shoulder) return { usable: false, reason: "The punching arm has a destroyed shoulder actuator." };
    if (state.fired) return { usable: false, reason: "A weapon mounted in the punching arm fired this turn." };
    const upper = state.upperArm ? 1 : 0;
    const lower = state.lowerArm ? 1 : 0;
    return {
      usable: true,
      modifier: (upper * 2) + (lower * 2) + (state.hand ? 1 : 0),
      damageDivisor: 2 ** (upper + lower)
    };
  }

  if (state.hip) return { usable: false, reason: "A destroyed hip actuator prevents kicking." };
  if (state.fired) return { usable: false, reason: "A weapon mounted in the kicking leg fired this turn." };
  const upper = state.upperLeg ? 1 : 0;
  const lower = state.lowerLeg ? 1 : 0;
  return {
    usable: true,
    modifier: (upper * 2) + (lower * 2) + (state.foot ? 1 : 0),
    damageDivisor: 2 ** (upper + lower)
  };
}

export function physicalAttackDamage(type, tonnage, actuatorDamageDivisor = 1, { underwater = false } = {}) {
  if (!PHYSICAL_ATTACK_TYPES[type]) throw new RangeError(`Unknown physical attack type: ${type}`);
  const weight = integer(tonnage, "BattleMech tonnage", { min: 1 });
  const divisor = integer(actuatorDamageDivisor, "Actuator damage divisor", { min: 1 });
  const base = type === "punch" ? Math.ceil(weight / 10) : Math.ceil(weight / 5);
  const actuatorAdjusted = Math.max(1, Math.floor(base / divisor));
  return underwater ? Math.floor(actuatorAdjusted / 2) : actuatorAdjusted;
}

export function calculatePhysicalAttack({
  type,
  limb,
  piloting,
  tonnage,
  attackerMovement = 0,
  targetMovement = 0,
  terrainModifier = 0,
  attackerProne = false,
  targetProne = false,
  targetImmobile = false,
  distance = 1,
  elevationDifference = 0,
  arc = "front",
  limbState = {},
  underwater = false
}) {
  const profile = PHYSICAL_ATTACK_TYPES[type];
  if (!profile) throw new RangeError(`Unknown physical attack type: ${type}`);
  const base = integer(piloting, "Piloting skill", { min: 0 });
  const weight = integer(tonnage, "BattleMech tonnage", { min: 1 });
  const hexes = integer(distance, "Physical attack range", { min: 0 });
  const levelDifference = integer(elevationDifference, "Elevation difference");
  const direction = attackDirection(arc);
  const attackerMove = integer(attackerMovement, "Attacker movement modifier");
  const targetMove = integer(targetMovement, "Target movement modifier");
  const terrain = integer(terrainModifier, "Terrain modifier");

  let reason = null;
  if (attackerProne) reason = "A prone BattleMech cannot make physical attacks.";
  else if (hexes !== 1) reason = "Punch and kick attacks require an adjacent target.";
  else if (Math.abs(levelDifference) > 1) reason = "Physical attacks require attacker and target elevations within one level.";
  else if (type === "kick" && direction !== "front") reason = "Kick targets must be in the BattleMech's forward arc.";
  else if (type === "punch" && direction === "rear") reason = "Punch targets must be in a forward or side arc.";
  else if (type === "punch" && direction === "left" && limb !== "leftArm") reason = "Only the left arm may punch into the left side arc.";
  else if (type === "punch" && direction === "right" && limb !== "rightArm") reason = "Only the right arm may punch into the right side arc.";

  const table = physicalTable(type, { targetProne, elevationDifference: levelDifference });
  if (!reason && !table) reason = "That physical attack is not legal for the target's elevation and prone state.";

  const actuator = actuatorProfile(type, limbState);
  if (!reason && !actuator.usable) reason = actuator.reason;

  const targetStatus = targetImmobile ? -4 : (targetProne ? -2 : 0);
  const actuatorModifier = actuator.modifier ?? 0;
  const targetNumber = base + profile.modifier + attackerMove + targetMove + targetStatus + terrain + actuatorModifier;
  const damage = physicalAttackDamage(type, weight, actuator.damageDivisor ?? 1, { underwater });

  return {
    type,
    label: profile.label,
    limb,
    canAttack: reason === null,
    reason,
    targetNumber,
    automaticHit: targetNumber <= 2,
    automaticFailure: targetNumber > 12,
    damage,
    locationTable: table,
    components: {
      piloting: base,
      attackType: profile.modifier,
      attackerMovement: attackerMove,
      targetMovement: targetMove,
      targetStatus,
      terrain,
      actuator: actuatorModifier
    }
  };
}

export function physicalHitLocation(table, roll, direction = "front") {
  const attackSide = attackDirection(direction);
  if (table === "normal") return hitLocation(roll, attackSide);
  const total = integer(roll, "Physical hit-location roll", { min: 1, max: 6 });
  const locations = table === "punch" ? PUNCH_LOCATION_TABLE : table === "kick" ? KICK_LOCATION_TABLE : null;
  if (!locations) throw new RangeError(`Unknown physical hit-location table: ${table}`);
  return {
    roll: total,
    direction: attackSide,
    location: locations[attackSide][total],
    rear: attackSide === "rear",
    throughArmorCritical: false
  };
}

