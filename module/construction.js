import { CRITICAL_SLOT_COUNTS, buildCriticalTable, itemSlotNumbers } from "./criticals.js";
import { ammunitionTypeForWeapon } from "./missiles.js";

const SYSTEM_ID = "battletech-foundry-system";

const WEAPON_TONS = Object.freeze({
  "Small Laser": 0.5,
  "Medium Laser": 1,
  "Large Laser": 5,
  "Particle Projection Cannon": 7,
  "Machine Gun": 0.5,
  "Flamer": 1,
  "Autocannon/2": 6,
  "Autocannon/5": 8,
  "Autocannon/10": 12,
  "Autocannon/20": 14,
  "SRM 2": 1,
  "SRM 4": 2,
  "SRM 6": 3,
  "LRM 5": 2,
  "LRM 10": 5,
  "LRM 15": 7,
  "LRM 20": 10
});

const EQUIPMENT_TONS = Object.freeze({
  "Heat Sink": 1,
  Hatchet: 5,
  "Fusion Engine": 0,
  Gyro: 0,
  Sensors: 0,
  "Life Support": 0,
  Cockpit: 0,
  "Shoulder Actuator": 0,
  "Upper Arm Actuator": 0,
  "Lower Arm Actuator": 0,
  "Hand Actuator": 0,
  "Hip Actuator": 0,
  "Upper Leg Actuator": 0,
  "Lower Leg Actuator": 0,
  "Foot Actuator": 0
});

const INTEGRAL_COMPONENT_EFFECTS = new Set([
  "engine", "gyro", "sensors", "lifeSupport", "cockpit", "shoulder", "upperArm",
  "lowerArm", "hand", "hip", "upperLeg", "lowerLeg", "foot"
]);

export const STANDARD_INTERNAL_STRUCTURE = Object.freeze({
  20: [6, 5, 3, 4], 25: [8, 6, 4, 6], 30: [10, 7, 5, 7], 35: [11, 8, 6, 8],
  40: [12, 10, 6, 10], 45: [14, 11, 7, 11], 50: [16, 12, 8, 12], 55: [18, 13, 9, 13],
  60: [20, 14, 10, 14], 65: [21, 15, 10, 15], 70: [22, 15, 11, 15], 75: [23, 16, 12, 16],
  80: [25, 17, 13, 17], 85: [27, 18, 14, 18], 90: [29, 19, 15, 19], 95: [30, 20, 16, 20],
  100: [31, 21, 17, 21]
});

// Indexed in five-point rating steps. Values through rating 400 are used by
// standard BattleMechs; higher large-engine entries are intentionally omitted.
export const STANDARD_FUSION_ENGINE_TONS = Object.freeze([
  0, 0.25, 0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1, 1.5, 1.5, 1.5, 2, 2, 2, 2.5,
  2.5, 3, 3, 3, 3.5, 3.5, 4, 4, 4, 4.5, 4.5, 5, 5, 5.5, 5.5, 6, 6, 6, 7,
  7, 7.5, 7.5, 8, 8.5, 8.5, 9, 9.5, 10, 10, 10.5, 11, 11.5, 12, 12.5, 13,
  13.5, 14, 14.5, 15.5, 16, 16.5, 17.5, 18, 19, 19.5, 20.5, 21.5, 22.5, 23.5,
  24.5, 25.5, 27, 28.5, 29.5, 31.5, 33, 34.5, 36.5, 38.5, 41, 43.5, 46, 49, 52.5
]);

const STRUCTURE_PROFILE_KEYS = Object.freeze({
  head: 3,
  centerTorso: 0,
  leftTorso: 1,
  rightTorso: 1,
  leftArm: 2,
  rightArm: 2,
  leftLeg: 3,
  rightLeg: 3
});

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function armorPoints(system) {
  return Object.values(system?.armor ?? {}).reduce((total, location) =>
    total + number(location.front) + number(location.rear), 0);
}

function catalogMass(catalog, name) {
  const value = String(name ?? "").trim();
  if (catalog[value] !== undefined) return catalog[value];
  const withoutNumber = value.replace(/ \d+$/, "");
  if (catalog[withoutNumber] !== undefined) return catalog[withoutNumber];
  const withoutLocation = withoutNumber.replace(/ - (?:Left|Right|Center|Front|Rear|Upper|Lower|Torso|Arm|Leg)$/i, "");
  return catalog[withoutLocation] ?? null;
}

export function itemConstructionMass(item, tonnage = 50) {
  const importedMass = Number(item.flags?.[SYSTEM_ID]?.hbsImport?.tonnage);
  if (Number.isFinite(importedMass) && importedMass >= 0) return importedMass;
  if (item.type === "ammo") return 1;
  if (item.type === "weapon") return catalogMass(WEAPON_TONS, item.name);
  if (INTEGRAL_COMPONENT_EFFECTS.has(item.system?.criticalEffect)) return 0;
  if (item.system?.criticalEffect === "heatSink") return 1;
  if (item.system?.criticalEffect === "jumpJet" || /^Jump Jet(?: \d+)?$/i.test(item.name ?? "")) {
    if (tonnage <= 55) return 0.5;
    if (tonnage <= 85) return 1;
    return 2;
  }
  if (item.type === "equipment") return catalogMass(EQUIPMENT_TONS, item.name);
  return null;
}

export function standardEngineRating(tonnage, walkingMp) {
  const weight = number(tonnage);
  const walk = number(walkingMp);
  if (!Number.isInteger(weight) || !Number.isInteger(walk) || weight <= 0 || walk <= 0) return null;
  return weight * walk;
}

export function standardInternalStructure(tonnage) {
  const profile = STANDARD_INTERNAL_STRUCTURE[number(tonnage)];
  if (!profile) return null;
  return Object.fromEntries(Object.entries(STRUCTURE_PROFILE_KEYS).map(([location, index]) =>
    [location, index === 3 && location === "head" ? 3 : profile[index]]));
}

export function standardFusionEngineMass(rating) {
  const value = number(rating);
  if (!Number.isInteger(value) || value < 10 || value > 400) return null;
  return STANDARD_FUSION_ENGINE_TONS[Math.ceil(value / 5)] ?? null;
}

export function standardGyroMass(rating) {
  const value = number(rating);
  if (!Number.isInteger(value) || value < 10 || value > 400) return null;
  return Math.ceil(value / 100);
}

export function analyzeMechConstruction(actorOrData) {
  const system = actorOrData?.system ?? {};
  const items = [...(actorOrData?.items ?? [])];
  const tonnage = number(system.mech?.tonnage);
  const diagnostics = [];
  const add = (severity, code, message) => diagnostics.push({ severity, code, message });

  if (!Number.isInteger(tonnage) || tonnage < 20 || tonnage > 100 || tonnage % 5 !== 0) {
    add("error", "TONNAGE", "Declared tonnage must be a 20–100 ton value in five-ton increments.");
  }

  const walk = number(system.movement?.walk);
  const run = number(system.movement?.run);
  const engineRating = standardEngineRating(tonnage, walk);
  if (engineRating !== null && engineRating > 400) {
    add("error", "ENGINE_RATING", `Walking MP ${walk} requires a ${engineRating}-rated engine; standard BattleMech engines cannot exceed rating 400.`);
  }
  const expectedRun = walk > 0 ? Math.ceil(walk * 1.5) : 0;
  if (walk > 0 && run !== expectedRun) {
    add("error", "RUN_MP", `Walking MP ${walk} requires Running MP ${expectedRun}; ${run} is recorded.`);
  }

  const expectedStructure = standardInternalStructure(tonnage);
  if (expectedStructure && system.structure) {
    for (const [location, expected] of Object.entries(expectedStructure)) {
      const actual = number(system.structure?.[location]?.max);
      if (actual !== expected) {
        add("error", "INTERNAL_STRUCTURE", `${location} internal structure must be ${expected} for a ${tonnage}-ton standard BattleMech; ${actual} is recorded.`);
      }
    }
  }
  const engineMass = standardFusionEngineMass(engineRating);
  const gyroMass = standardGyroMass(engineRating);
  const structureMass = expectedStructure ? tonnage / 10 : 0;
  const cockpitMass = expectedStructure ? 3 : 0;

  for (const item of items) {
    const assigned = itemSlotNumbers(item);
    const expected = number(item.system?.slots || 1);
    if (assigned.length !== expected) {
      add("error", "SLOT_RANGE", `${item.name} extends outside ${item.system?.location ?? "an unknown location"}.`);
    }
  }

  for (const location of Object.keys(CRITICAL_SLOT_COUNTS)) {
    const conflicts = buildCriticalTable(items, location).filter(entry => entry.conflict);
    for (const entry of conflicts) add("error", "SLOT_CONFLICT", `${location} critical slot ${entry.slot} is assigned more than once.`);
  }

  const ammoTypes = new Set(items.filter(item => item.type === "ammo" && !item.system?.destroyed).map(item => item.system?.ammoType));
  for (const weapon of items.filter(item => item.type === "weapon")) {
    const required = ammunitionTypeForWeapon(weapon.name);
    const family = required?.split(" ")[0];
    if (required && !ammoTypes.has(required) && !ammoTypes.has(family)) add("error", "AMMO", `${weapon.name} has no compatible ${required} ammunition bin.`);
  }

  const jumpJets = items.filter(item => item.type === "equipment" && item.system?.criticalEffect === "jumpJet").length;
  if (number(system.movement?.jump) > jumpJets) {
    add("error", "JUMP_JETS", `Jumping MP ${number(system.movement?.jump)} requires at least ${number(system.movement?.jump)} installed jump jets; ${jumpJets} are assigned.`);
  }

  const knownItems = items.map(item => ({ item, mass: itemConstructionMass(item, tonnage) }));
  for (const { item, mass } of knownItems) {
    if (mass === null) add("warning", "UNKNOWN_MASS", `${item.name} has no verified construction mass.`);
  }
  const equipmentMass = knownItems.reduce((total, entry) => total + (entry.mass ?? 0), 0);
  const armor = armorPoints(system);
  const armorMass = Math.ceil((armor / 16) * 2) / 2;
  const chassisMass = structureMass + (engineMass ?? 0) + (gyroMass ?? 0) + cockpitMass;
  const trackedMass = armorMass + equipmentMass + chassisMass;
  if (tonnage > 0 && trackedMass > tonnage) {
    add("error", "OVERWEIGHT", `Tracked construction mass is ${trackedMass} tons, exceeding the ${tonnage}-ton chassis by ${trackedMass - tonnage} tons.`);
  }
  const errors = diagnostics.filter(entry => entry.severity === "error");
  const warnings = diagnostics.filter(entry => entry.severity === "warning");

  return {
    ready: errors.length === 0,
    status: errors.length ? "BLOCKED" : warnings.length ? "READY WITH WARNINGS" : "DEPLOYMENT READY",
    tonnage,
    engineRating,
    engineMass,
    gyroMass,
    structureMass,
    cockpitMass,
    chassisMass,
    expectedRun,
    internalStructure: expectedStructure,
    armorPoints: armor,
    armorMass,
    equipmentMass,
    trackedMass,
    untrackedMass: Math.max(0, tonnage - trackedMass),
    slotsUsed: items.reduce((total, item) => total + itemSlotNumbers(item).length, 0),
    slotsAvailable: Object.values(CRITICAL_SLOT_COUNTS).reduce((total, slots) => total + slots, 0),
    jumpJets,
    diagnostics,
    errors,
    warnings
  };
}
