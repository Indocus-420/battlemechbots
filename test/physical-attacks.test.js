import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePhysicalAttack,
  physicalAttackDamage,
  physicalHitLocation
} from "../module/physical-attacks.js";

const base = {
  piloting: 5,
  tonnage: 65,
  distance: 1,
  elevationDifference: 0,
  arc: "front"
};

test("punch and kick damage use Classic tonnage formulas", () => {
  assert.equal(physicalAttackDamage("punch", 65), 7);
  assert.equal(physicalAttackDamage("kick", 65), 13);
  assert.equal(physicalAttackDamage("punch", 65, 2), 3);
  assert.equal(physicalAttackDamage("kick", 65, 4), 3);
});

test("underwater physical attacks inflict half damage rounded down", () => {
  assert.equal(physicalAttackDamage("punch", 65, 1, { underwater: true }), 3);
  assert.equal(physicalAttackDamage("kick", 65, 1, { underwater: true }), 6);
});

test("physical target numbers exclude heat and sensors but include movement and terrain", () => {
  const attack = calculatePhysicalAttack({
    ...base,
    type: "punch",
    limb: "rightArm",
    attackerMovement: 1,
    targetMovement: 2,
    terrainModifier: 1
  });
  assert.equal(attack.targetNumber, 9);
  assert.deepEqual(attack.components, {
    piloting: 5,
    attackType: 0,
    attackerMovement: 1,
    targetMovement: 2,
    targetStatus: 0,
    terrain: 1,
    actuator: 0
  });
});

test("kick receives its minus two attack-type modifier", () => {
  const attack = calculatePhysicalAttack({ ...base, type: "kick", limb: "rightLeg" });
  assert.equal(attack.targetNumber, 3);
  assert.equal(attack.damage, 13);
  assert.equal(attack.locationTable, "kick");
});

test("arm actuator damage modifies accuracy and reduces punch damage cumulatively", () => {
  const attack = calculatePhysicalAttack({
    ...base,
    type: "punch",
    limb: "rightArm",
    limbState: { upperArm: true, lowerArm: true, hand: true }
  });
  assert.equal(attack.targetNumber, 10);
  assert.equal(attack.damage, 1);
  assert.equal(attack.components.actuator, 5);
});

test("shoulder damage and weapons fired from the limb prevent attacks", () => {
  assert.match(calculatePhysicalAttack({
    ...base, type: "punch", limb: "leftArm", limbState: { shoulder: true }
  }).reason, /shoulder/);
  assert.match(calculatePhysicalAttack({
    ...base, type: "kick", limb: "leftLeg", limbState: { fired: true }
  }).reason, /fired/);
});

test("leg actuator damage modifies kick accuracy and damage", () => {
  const attack = calculatePhysicalAttack({
    ...base,
    type: "kick",
    limb: "leftLeg",
    limbState: { upperLeg: true, lowerLeg: true, foot: true }
  });
  assert.equal(attack.targetNumber, 8);
  assert.equal(attack.damage, 3);
});

test("attack arcs restrict punches and kicks", () => {
  assert.equal(calculatePhysicalAttack({
    ...base, type: "punch", limb: "leftArm", arc: "right"
  }).canAttack, false);
  assert.equal(calculatePhysicalAttack({
    ...base, type: "punch", limb: "rightArm", arc: "right"
  }).canAttack, true);
  assert.equal(calculatePhysicalAttack({
    ...base, type: "kick", limb: "leftLeg", arc: "left"
  }).canAttack, false);
});

test("different elevations switch punch and kick hit-location tables", () => {
  assert.equal(calculatePhysicalAttack({
    ...base, type: "punch", limb: "leftArm", elevationDifference: 1
  }).locationTable, "kick");
  assert.equal(calculatePhysicalAttack({
    ...base, type: "kick", limb: "leftLeg", elevationDifference: -1
  }).locationTable, "punch");
});

test("prone targets use the regular table only for legal attacks", () => {
  assert.equal(calculatePhysicalAttack({
    ...base, type: "kick", limb: "leftLeg", targetProne: true
  }).locationTable, "normal");
  assert.equal(calculatePhysicalAttack({
    ...base, type: "punch", limb: "leftArm", targetProne: true
  }).canAttack, false);
});

test("physical hit-location tables reproduce punch and kick results", () => {
  assert.equal(physicalHitLocation("punch", 3, "front").location, "centerTorso");
  assert.equal(physicalHitLocation("punch", 6, "right").location, "head");
  assert.equal(physicalHitLocation("kick", 2, "front").location, "rightLeg");
  assert.equal(physicalHitLocation("kick", 5, "front").location, "leftLeg");
  assert.equal(physicalHitLocation("normal", 7, "rear").location, "centerTorso");
});

