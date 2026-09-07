import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCriticalComponentEffect,
  buildCriticalTable,
  criticalSlotFromRolls,
  criticalTransferLocation,
  eligibleCriticalSlots,
  itemSlotNumbers,
  weaponCriticalModifier
} from "../module/criticals.js";

function mechState() {
  return {
    criticals: { engineHits: 0, gyroHits: 0, sensorHits: 0, lifeSupportHits: 0, cockpitDestroyed: false },
    movement: { walk: 5, run: 8, jump: 3 },
    heat: { sinks: 10 },
    status: { prone: false, destroyed: false }
  };
}

function item({ id, name, type = "equipment", location, slotStart, slots, damagedSlots = [], destroyed = false, criticalEffect = "general" }) {
  return { id, name, type, system: { location, slotStart, slots, damagedSlots, destroyed, criticalEffect } };
}

test("head and leg criticals use one die while arm and torso criticals use two blocks", () => {
  assert.equal(criticalSlotFromRolls("head", 4), 4);
  assert.equal(criticalSlotFromRolls("leftLeg", 6), 6);
  assert.equal(criticalSlotFromRolls("rightArm", 2, 6), 6);
  assert.equal(criticalSlotFromRolls("centerTorso", 5, 4), 10);
});

test("multi-slot items fill consecutive critical slots", () => {
  const weapon = item({ id: "w1", name: "PPC", type: "weapon", location: "rightArm", slotStart: 5, slots: 3 });
  assert.deepEqual(itemSlotNumbers(weapon), [5, 6, 7]);
  const table = buildCriticalTable([weapon], "rightArm");
  assert.equal(table[4].label, "PPC");
  assert.equal(table[7].item, null);
});

test("empty and previously damaged slots are inapplicable", () => {
  const engine = item({ id: "e1", name: "Engine", location: "centerTorso", slotStart: 1, slots: 3, damagedSlots: [2], criticalEffect: "engine" });
  assert.deepEqual(eligibleCriticalSlots([engine], "centerTorso").map(entry => entry.slot), [1, 3]);
});

test("critical transfers follow the damage transfer diagram", () => {
  assert.equal(criticalTransferLocation("leftArm"), "leftTorso");
  assert.equal(criticalTransferLocation("leftTorso"), "centerTorso");
  assert.equal(criticalTransferLocation("centerTorso"), null);
});

test("shoulder damage overrides other arm weapon modifiers", () => {
  const upper = item({ id: "u", name: "Upper", location: "rightArm", slotStart: 1, slots: 1, destroyed: true, criticalEffect: "upperArm" });
  const lower = item({ id: "l", name: "Lower", location: "rightArm", slotStart: 2, slots: 1, destroyed: true, criticalEffect: "lowerArm" });
  const shoulder = item({ id: "s", name: "Shoulder", location: "rightArm", slotStart: 3, slots: 1, destroyed: true, criticalEffect: "shoulder" });
  assert.equal(weaponCriticalModifier([upper, lower], "rightArm"), 2);
  assert.equal(weaponCriticalModifier([upper, lower, shoulder], "rightArm"), 4);
});

test("engine and gyro effects use their multi-hit destruction thresholds", () => {
  const state = mechState();
  const engine = item({ id: "e", name: "Engine", location: "centerTorso", slotStart: 1, slots: 6, criticalEffect: "engine" });
  engine.system.criticalHits = 0;
  applyCriticalComponentEffect(state, engine);
  applyCriticalComponentEffect(state, engine);
  assert.equal(state.criticals.engineHits, 2);
  assert.equal(state.status.destroyed, false);
  applyCriticalComponentEffect(state, engine);
  assert.equal(state.status.destroyed, true);

  const gyroState = mechState();
  const gyro = item({ id: "g", name: "Gyro", location: "centerTorso", slotStart: 7, slots: 4, criticalEffect: "gyro" });
  gyro.system.criticalHits = 0;
  applyCriticalComponentEffect(gyroState, gyro);
  assert.equal(gyroState.status.prone, false);
  applyCriticalComponentEffect(gyroState, gyro);
  assert.equal(gyroState.status.prone, true);
});

test("heat sinks, jump jets, and leg actuators reduce the appropriate ratings once", () => {
  const state = mechState();
  for (const [effect, expected] of [
    ["heatSink", { sinks: 9, jump: 3, walk: 5, run: 8 }],
    ["jumpJet", { sinks: 9, jump: 2, walk: 5, run: 8 }],
    ["lowerLeg", { sinks: 9, jump: 2, walk: 4, run: 6 }]
  ]) {
    const component = item({ id: effect, name: effect, location: "leftLeg", slotStart: 1, slots: 1, criticalEffect: effect });
    component.system.criticalHits = 0;
    applyCriticalComponentEffect(state, component);
    assert.deepEqual({ sinks: state.heat.sinks, jump: state.movement.jump, walk: state.movement.walk, run: state.movement.run }, expected);
    applyCriticalComponentEffect(state, component);
    assert.deepEqual({ sinks: state.heat.sinks, jump: state.movement.jump, walk: state.movement.walk, run: state.movement.run }, expected);
  }
});

test("loaded ammunition explodes while an empty bin only absorbs the hit", () => {
  const state = mechState();
  const loaded = item({ id: "a", name: "Ammo", type: "ammo", location: "leftTorso", slotStart: 1, slots: 1 });
  Object.assign(loaded.system, { shots: 10, criticalHits: 0 });
  assert.equal(applyCriticalComponentEffect(state, loaded).ammoExplosion, true);
  const empty = item({ id: "b", name: "Empty", type: "ammo", location: "leftTorso", slotStart: 2, slots: 1 });
  Object.assign(empty.system, { shots: 0, criticalHits: 0 });
  assert.equal(applyCriticalComponentEffect(state, empty).ammoExplosion, false);
});
