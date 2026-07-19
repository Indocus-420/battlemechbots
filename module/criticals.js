import { DAMAGE_TRANSFER, MECH_LOCATIONS } from "./damage.js";

export const CRITICAL_SLOT_COUNTS = Object.freeze({
  head: 6,
  centerTorso: 12,
  leftTorso: 12,
  rightTorso: 12,
  leftArm: 12,
  rightArm: 12,
  leftLeg: 6,
  rightLeg: 6
});

export const CRITICAL_EFFECTS = Object.freeze({
  general: "Weapon / Equipment",
  engine: "Fusion Engine",
  gyro: "Gyro",
  sensors: "Sensors",
  lifeSupport: "Life Support",
  cockpit: "Cockpit",
  heatSink: "Heat Sink",
  jumpJet: "Jump Jet",
  hip: "Hip Actuator",
  upperLeg: "Upper Leg Actuator",
  lowerLeg: "Lower Leg Actuator",
  foot: "Foot Actuator",
  shoulder: "Shoulder Actuator",
  upperArm: "Upper Arm Actuator",
  lowerArm: "Lower Arm Actuator",
  hand: "Hand Actuator"
});

function integer(value, label, { min = 0, max = Infinity } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RangeError(`${label} must be an integer from ${min} to ${max}.`);
  }
  return number;
}

export function criticalSlotFromRolls(location, firstRoll, secondRoll = null) {
  const count = CRITICAL_SLOT_COUNTS[location];
  if (!count) throw new RangeError(`Unknown critical location: ${location}`);
  const first = integer(firstRoll, "Critical slot roll", { min: 1, max: 6 });
  if (count === 6) return first;
  const second = integer(secondRoll, "Critical slot roll", { min: 1, max: 6 });
  return (first <= 3 ? 0 : 6) + second;
}

export function itemSlotNumbers(item) {
  const location = item?.system?.location;
  const capacity = CRITICAL_SLOT_COUNTS[location];
  if (!capacity) return [];
  const start = Number(item.system.slotStart ?? 1);
  const slots = Number(item.system.slots ?? 1);
  if (!Number.isInteger(start) || start < 1 || start > capacity) return [];
  if (!Number.isInteger(slots) || slots < 1 || slots > capacity) return [];
  return Array.from({ length: Math.min(slots, capacity - start + 1) }, (_, index) => start + index);
}

export function buildCriticalTable(items = [], location) {
  const capacity = CRITICAL_SLOT_COUNTS[location];
  if (!capacity) throw new RangeError(`Unknown critical location: ${location}`);
  const table = Array.from({ length: capacity }, (_, index) => ({
    location,
    slot: index + 1,
    item: null,
    itemId: null,
    label: "Empty - Roll Again",
    hit: false,
    conflict: false
  }));

  for (const item of items) {
    if (item?.system?.location !== location) continue;
    const damaged = new Set((item.system.damagedSlots ?? []).map(Number));
    for (const slot of itemSlotNumbers(item)) {
      const entry = table[slot - 1];
      if (entry.item) {
        entry.conflict = true;
        continue;
      }
      entry.item = item;
      entry.itemId = item.id;
      entry.label = item.name;
      entry.hit = damaged.has(slot);
    }
  }
  return table;
}

export function eligibleCriticalSlots(items, location) {
  return buildCriticalTable(items, location).filter(entry => entry.item && !entry.hit);
}

export function criticalTransferLocation(location) {
  if (!MECH_LOCATIONS.includes(location)) throw new RangeError(`Unknown critical location: ${location}`);
  return DAMAGE_TRANSFER[location];
}

export function applyCriticalComponentEffect(state, item) {
  const effect = item.type === "equipment" ? item.system.criticalEffect : "general";
  const firstComponentHit = !item.system.destroyed;
  let detail = `${item.name} disabled`;
  let ammoExplosion = false;

  item.system.criticalHits = (Number(item.system.criticalHits) || 0) + 1;
  if (item.type === "ammo") {
    ammoExplosion = firstComponentHit && Number(item.system.shots) > 0;
    item.system.destroyed = true;
    detail = ammoExplosion ? `${item.name} ammunition explosion` : `${item.name} empty bin hit`;
    return { detail, ammoExplosion };
  }
  if (item.type === "weapon" || effect === "general") {
    item.system.destroyed = true;
    return { detail, ammoExplosion };
  }

  if (effect === "engine") {
    state.criticals.engineHits = Math.min(3, state.criticals.engineHits + 1);
    item.system.destroyed = state.criticals.engineHits >= 3;
    state.status.destroyed ||= item.system.destroyed;
    detail = `Engine shielding hit ${state.criticals.engineHits}/3`;
  } else if (effect === "gyro") {
    state.criticals.gyroHits = Math.min(2, state.criticals.gyroHits + 1);
    item.system.destroyed = state.criticals.gyroHits >= 2;
    if (item.system.destroyed) state.status.prone = true;
    detail = `Gyro hit ${state.criticals.gyroHits}/2${item.system.destroyed ? "; BattleMech falls" : ""}`;
  } else if (effect === "sensors") {
    state.criticals.sensorHits = Math.min(2, state.criticals.sensorHits + 1);
    item.system.destroyed = state.criticals.sensorHits >= 2;
    detail = `Sensors hit ${state.criticals.sensorHits}/2`;
  } else if (effect === "lifeSupport") {
    state.criticals.lifeSupportHits = Math.min(2, state.criticals.lifeSupportHits + 1);
    item.system.destroyed = true;
    detail = `Life support hit ${state.criticals.lifeSupportHits}/2`;
  } else if (effect === "cockpit") {
    state.criticals.cockpitDestroyed = true;
    state.status.destroyed = true;
    item.system.destroyed = true;
    detail = "Cockpit destroyed; BattleMech destroyed";
  } else if (firstComponentHit && effect === "heatSink") {
    state.heat.sinks = Math.max(0, state.heat.sinks - 1);
    item.system.destroyed = true;
    detail = `Heat sink destroyed; ${state.heat.sinks} remain`;
  } else if (firstComponentHit && effect === "jumpJet") {
    state.movement.jump = Math.max(0, state.movement.jump - 1);
    item.system.destroyed = true;
    detail = `Jump jet destroyed; Jumping MP ${state.movement.jump}`;
  } else if (firstComponentHit && effect === "hip") {
    state.movement.walk = Math.floor(state.movement.walk / 2);
    state.movement.run = Math.ceil(state.movement.walk * 1.5);
    item.system.destroyed = true;
    detail = `Hip actuator destroyed; movement ${state.movement.walk}/${state.movement.run}`;
  } else if (firstComponentHit && ["upperLeg", "lowerLeg", "foot"].includes(effect)) {
    state.movement.walk = Math.max(0, state.movement.walk - 1);
    state.movement.run = Math.ceil(state.movement.walk * 1.5);
    item.system.destroyed = true;
    detail = `${CRITICAL_EFFECTS[effect]} destroyed; movement ${state.movement.walk}/${state.movement.run}`;
  } else {
    item.system.destroyed = true;
    detail = `${CRITICAL_EFFECTS[effect] ?? item.name} destroyed`;
  }

  return { detail, ammoExplosion };
}

export function weaponCriticalModifier(items = [], weaponLocation) {
  const effects = items
    .filter(item => item.type === "equipment"
      && item.system.destroyed
      && item.system.location === weaponLocation)
    .map(item => item.system.criticalEffect);
  if (effects.includes("shoulder")) return 4;
  return (effects.includes("upperArm") ? 1 : 0) + (effects.includes("lowerArm") ? 1 : 0);
}
