export const MECH_LOCATIONS = Object.freeze([
  "head",
  "centerTorso",
  "leftTorso",
  "rightTorso",
  "leftArm",
  "rightArm",
  "leftLeg",
  "rightLeg"
]);

export const DAMAGE_TRANSFER = Object.freeze({
  leftArm: "leftTorso",
  rightArm: "rightTorso",
  leftLeg: "leftTorso",
  rightLeg: "rightTorso",
  leftTorso: "centerTorso",
  rightTorso: "centerTorso",
  head: null,
  centerTorso: null
});

const HIT_LOCATION_TABLE = Object.freeze({
  left: Object.freeze({
    2: "leftTorso", 3: "leftLeg", 4: "leftArm", 5: "leftArm", 6: "leftLeg",
    7: "leftTorso", 8: "centerTorso", 9: "rightTorso", 10: "rightArm",
    11: "rightLeg", 12: "head"
  }),
  front: Object.freeze({
    2: "centerTorso", 3: "rightArm", 4: "rightArm", 5: "rightLeg", 6: "rightTorso",
    7: "centerTorso", 8: "leftTorso", 9: "leftLeg", 10: "leftArm",
    11: "leftArm", 12: "head"
  }),
  rear: Object.freeze({
    2: "centerTorso", 3: "rightArm", 4: "rightArm", 5: "rightLeg", 6: "rightTorso",
    7: "centerTorso", 8: "leftTorso", 9: "leftLeg", 10: "leftArm",
    11: "leftArm", 12: "head"
  }),
  right: Object.freeze({
    2: "rightTorso", 3: "rightLeg", 4: "rightArm", 5: "rightArm", 6: "rightLeg",
    7: "rightTorso", 8: "centerTorso", 9: "leftTorso", 10: "leftArm",
    11: "leftLeg", 12: "head"
  })
});

function integer(value, label, { min = 0, max = Infinity } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RangeError(`${label} must be an integer from ${min} to ${max}.`);
  }
  return number;
}

export function hitLocation(roll, direction = "front") {
  const total = integer(roll, "Hit-location roll", { min: 2, max: 12 });
  const table = HIT_LOCATION_TABLE[direction];
  if (!table) throw new RangeError(`Unknown attack direction: ${direction}`);
  return {
    roll: total,
    direction,
    location: table[total],
    rear: direction === "rear",
    throughArmorCritical: total === 2
  };
}

export function classifyAttackDirection(attacker, target, targetRotation = 0) {
  const dx = Number(attacker.x) - Number(target.x);
  const dy = Number(attacker.y) - Number(target.y);
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) {
    throw new RangeError("Attack direction requires two different finite points.");
  }
  const bearing = Math.atan2(dx, -dy) * (180 / Math.PI);
  const relative = ((bearing - Number(targetRotation) + 540) % 360) - 180;
  const absolute = Math.abs(relative);
  if (absolute <= 90) return "front";
  if (absolute >= 150) return "rear";
  return relative < 0 ? "left" : "right";
}

export function determineCriticalHits(roll, location) {
  const total = integer(roll, "Critical-hit roll", { min: 2, max: 12 });
  if (!MECH_LOCATIONS.includes(location)) throw new RangeError(`Unknown location: ${location}`);
  if (total <= 7) return { roll: total, hits: 0, blownOff: false };
  if (total <= 9) return { roll: total, hits: 1, blownOff: false };
  if (total <= 11) return { roll: total, hits: 2, blownOff: false };
  const limbOrHead = location === "head" || location.endsWith("Arm") || location.endsWith("Leg");
  return { roll: total, hits: limbOrHead ? 0 : 3, blownOff: limbOrHead };
}

function cloneMechState(armor, structure) {
  return {
    armor: Object.fromEntries(Object.entries(armor).map(([key, value]) => [key, { ...value }])),
    structure: Object.fromEntries(Object.entries(structure).map(([key, value]) => [key, { ...value }]))
  };
}

export function applyMechDamage({ armor, structure }, initialLocation, damage, {
  rear = false,
  internalOnly = false
} = {}) {
  if (!MECH_LOCATIONS.includes(initialLocation)) {
    throw new RangeError(`Unknown damage location: ${initialLocation}`);
  }
  let remaining = integer(damage, "Damage");
  const state = cloneMechState(armor, structure);
  const events = [];
  const criticalLocations = [];
  const destroyedLocations = [];
  let location = initialLocation;

  while (location && remaining > 0) {
    const armorLocation = state.armor[location];
    const structureLocation = state.structure[location];
    if (!armorLocation || !structureLocation) throw new RangeError(`Missing record data for ${location}.`);

    if (structureLocation.value <= 0) {
      events.push({ location, transferred: remaining, reason: "alreadyDestroyed" });
      location = DAMAGE_TRANSFER[location];
      internalOnly = false;
      rear = false;
      continue;
    }

    const armorField = rear && "rear" in armorLocation ? "rear" : "front";
    let armorDamage = 0;
    if (!internalOnly) {
      armorDamage = Math.min(remaining, armorLocation[armorField]);
      armorLocation[armorField] -= armorDamage;
      remaining -= armorDamage;
    }

    const structureBefore = structureLocation.value;
    const structureDamage = Math.min(remaining, structureBefore);
    structureLocation.value -= structureDamage;
    remaining -= structureDamage;
    const destroyed = structureBefore > 0 && structureLocation.value === 0;
    if (structureDamage > 0 && !destroyed) criticalLocations.push(location);
    if (destroyed) destroyedLocations.push(location);
    events.push({ location, armorField, armorDamage, structureDamage, destroyed });

    if (!destroyed || remaining <= 0) break;
    location = DAMAGE_TRANSFER[location];
    internalOnly = false;
    rear = false;
  }

  for (const torso of ["leftTorso", "rightTorso"]) {
    if (!destroyedLocations.includes(torso)) continue;
    const arm = torso.replace("Torso", "Arm");
    if (state.structure[arm].value > 0) {
      state.structure[arm].value = 0;
      state.armor[arm].front = 0;
      destroyedLocations.push(arm);
    }
  }

  return {
    ...state,
    events,
    criticalLocations,
    destroyedLocations,
    damageLost: remaining,
    mechDestroyed: state.structure.head.value === 0 || state.structure.centerTorso.value === 0
  };
}
