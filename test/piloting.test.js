import assert from "node:assert/strict";
import test from "node:test";

import { facingAfterFall, fallDamage, pilotingCheckProfile } from "../module/piloting.js";

test("piloting checks include gyro and leg actuator damage", () => {
  const check = pilotingCheckProfile({
    piloting: 5,
    gyroHits: 1,
    destroyedActuators: ["hip", "upperLeg", "foot"]
  });
  assert.equal(check.targetNumber, 12);
  assert.equal(check.gyroModifier, 3);
  assert.equal(check.legModifier, 0);
  assert.equal(check.shutdownModifier, 0);
  assert.equal(check.actuatorModifier, 4);
  assert.equal(check.automaticFall, false);
});

test("shutdown, a destroyed leg, or a destroyed gyro causes an automatic fall", () => {
  assert.deepEqual(
    pilotingCheckProfile({ piloting: 5, shutdown: true }),
    { base: 5, gyroModifier: 0, legModifier: 0, shutdownModifier: 3, actuatorModifier: 0, situationalModifier: 0, targetNumber: 8, automaticFall: true }
  );
  assert.equal(pilotingCheckProfile({ piloting: 5, leftLegDestroyed: true }).targetNumber, 10);
  assert.equal(pilotingCheckProfile({ piloting: 5, gyroHits: 2 }).automaticFall, true);
});

test("fall damage uses tonnage, level, five-point groups, and water reduction", () => {
  assert.deepEqual(fallDamage(65, 0), { levels: 0, total: 7, groups: [5, 2] });
  assert.deepEqual(fallDamage(65, 2), { levels: 2, total: 21, groups: [5, 5, 5, 5, 1] });
  assert.deepEqual(fallDamage(65, 0, { water: true }), { levels: 0, total: 3, groups: [3] });
});

test("facing after fall supplies damage arc and hexside rotation", () => {
  assert.deepEqual(facingAfterFall(1), { roll: 1, rotationDelta: 0, direction: "front" });
  assert.deepEqual(facingAfterFall(4), { roll: 4, rotationDelta: 180, direction: "rear" });
  assert.deepEqual(facingAfterFall(6), { roll: 6, rotationDelta: -60, direction: "left" });
});
