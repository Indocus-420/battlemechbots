import { CRITICAL_SLOT_COUNTS, buildCriticalTable, itemSlotNumbers } from "./criticals.js";
import { ammunitionTypeForWeapon } from "./missiles.js";

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

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function armorPoints(system) {
  return Object.values(system?.armor ?? {}).reduce((total, location) =>
    total + number(location.front) + number(location.rear), 0);
}

export function itemConstructionMass(item, tonnage = 50) {
  if (item.type === "ammo") return 1;
  if (item.type === "weapon") return WEAPON_TONS[item.name] ?? null;
  if (item.name === "Jump Jet") {
    if (tonnage <= 55) return 0.5;
    if (tonnage <= 85) return 1;
    return 2;
  }
  if (item.type === "equipment") return EQUIPMENT_TONS[item.name] ?? null;
  return null;
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
    if (required && !ammoTypes.has(required)) add("error", "AMMO", `${weapon.name} has no compatible ${required} ammunition bin.`);
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
  const errors = diagnostics.filter(entry => entry.severity === "error");
  const warnings = diagnostics.filter(entry => entry.severity === "warning");

  return {
    ready: errors.length === 0,
    status: errors.length ? "BLOCKED" : warnings.length ? "READY WITH WARNINGS" : "DEPLOYMENT READY",
    tonnage,
    armorPoints: armor,
    armorMass,
    equipmentMass,
    trackedMass: armorMass + equipmentMass,
    untrackedMass: Math.max(0, tonnage - armorMass - equipmentMass),
    slotsUsed: items.reduce((total, item) => total + itemSlotNumbers(item).length, 0),
    slotsAvailable: Object.values(CRITICAL_SLOT_COUNTS).reduce((total, slots) => total + slots, 0),
    jumpJets,
    diagnostics,
    errors,
    warnings
  };
}
