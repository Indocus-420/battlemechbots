import assert from "node:assert/strict";
import test from "node:test";

import {
  applyMechDamage,
  classifyAttackDirection,
  determineCriticalHits,
  hitLocation
} from "../module/damage.js";

function recordState() {
  const armor = {
    head: { front: 9 },
    centerTorso: { front: 20, rear: 6 },
    leftTorso: { front: 16, rear: 5 },
    rightTorso: { front: 16, rear: 5 },
    leftArm: { front: 12 },
    rightArm: { front: 12 },
    leftLeg: { front: 16 },
    rightLeg: { front: 16 }
  };
  const structure = {
    head: { value: 3 }, centerTorso: { value: 16 },
    leftTorso: { value: 12 }, rightTorso: { value: 12 },
    leftArm: { value: 8 }, rightArm: { value: 8 },
    leftLeg: { value: 12 }, rightLeg: { value: 12 }
  };
  return { armor, structure };
}

test("hit-location tables cover front, rear, left, and right attacks", () => {
  assert.equal(hitLocation(7, "front").location, "centerTorso");
  assert.equal(hitLocation(7, "left").location, "leftTorso");
  assert.equal(hitLocation(7, "right").location, "rightTorso");
  assert.equal(hitLocation(12, "rear").location, "head");
  assert.equal(hitLocation(2, "front").throughArmorCritical, true);
});

test("attack direction respects the target facing", () => {
  const target = { x: 0, y: 0 };
  assert.equal(classifyAttackDirection({ x: 0, y: -10 }, target, 0), "front");
  assert.equal(classifyAttackDirection({ x: 0, y: 10 }, target, 0), "rear");
  assert.equal(classifyAttackDirection({ x: -10, y: 5 }, target, 0), "left");
  assert.equal(classifyAttackDirection({ x: 10, y: 5 }, target, 0), "right");
});

test("critical determination table returns zero, one, two, or three hits", () => {
  assert.deepEqual(determineCriticalHits(7, "centerTorso"), { roll: 7, hits: 0, blownOff: false });
  assert.deepEqual(determineCriticalHits(8, "centerTorso"), { roll: 8, hits: 1, blownOff: false });
  assert.deepEqual(determineCriticalHits(10, "centerTorso"), { roll: 10, hits: 2, blownOff: false });
  assert.deepEqual(determineCriticalHits(12, "centerTorso"), { roll: 12, hits: 3, blownOff: false });
  assert.deepEqual(determineCriticalHits(12, "leftArm"), { roll: 12, hits: 0, blownOff: true });
});

test("damage strips armor before internal structure", () => {
  const result = applyMechDamage(recordState(), "leftArm", 15);
  assert.equal(result.armor.leftArm.front, 0);
  assert.equal(result.structure.leftArm.value, 5);
  assert.deepEqual(result.criticalLocations, ["leftArm"]);
});

test("rear attacks apply torso rear armor", () => {
  const result = applyMechDamage(recordState(), "centerTorso", 8, { rear: true });
  assert.equal(result.armor.centerTorso.rear, 0);
  assert.equal(result.structure.centerTorso.value, 14);
});

test("damage transfers inward after a location is destroyed", () => {
  const state = recordState();
  state.armor.leftArm.front = 0;
  state.structure.leftArm.value = 3;
  const result = applyMechDamage(state, "leftArm", 8);
  assert.equal(result.structure.leftArm.value, 0);
  assert.equal(result.armor.leftTorso.front, 11);
  assert.ok(result.destroyedLocations.includes("leftArm"));
});

test("destroying a side torso also destroys its attached arm", () => {
  const state = recordState();
  state.armor.leftTorso.front = 0;
  state.structure.leftTorso.value = 2;
  const result = applyMechDamage(state, "leftTorso", 2);
  assert.equal(result.structure.leftTorso.value, 0);
  assert.equal(result.structure.leftArm.value, 0);
  assert.ok(result.destroyedLocations.includes("leftArm"));
});

test("destroying the head or center torso destroys the mech", () => {
  const state = recordState();
  state.armor.head.front = 0;
  assert.equal(applyMechDamage(state, "head", 3).mechDestroyed, true);
});

test("ammunition damage can begin directly on internal structure", () => {
  const result = applyMechDamage(recordState(), "rightTorso", 5, { internalOnly: true });
  assert.equal(result.armor.rightTorso.front, 16);
  assert.equal(result.structure.rightTorso.value, 7);
  assert.deepEqual(result.criticalLocations, ["rightTorso"]);
});
