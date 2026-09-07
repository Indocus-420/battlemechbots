import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAttackTargetNumber,
  heatModifier,
  rangeModifier,
  summarizeCombatTerrainPath,
  terrainAttackModifiers
} from "../module/combat.js";

test("heat modifiers match the attack modifiers table", () => {
  assert.equal(heatModifier(7), 0);
  assert.equal(heatModifier(8), 1);
  assert.equal(heatModifier(13), 2);
  assert.equal(heatModifier(17), 3);
  assert.equal(heatModifier(24), 4);
});

test("range brackets apply short, medium, and long modifiers", () => {
  const range = { minimum: 0, short: 3, medium: 6, long: 9 };
  assert.deepEqual(rangeModifier(3, range), { bracket: "short", modifier: 0 });
  assert.deepEqual(rangeModifier(4, range), { bracket: "medium", modifier: 2 });
  assert.deepEqual(rangeModifier(9, range), { bracket: "long", modifier: 4 });
  assert.throws(() => rangeModifier(10, range), /beyond long range/);
});

test("minimum range uses minimum minus target range plus one", () => {
  assert.deepEqual(
    rangeModifier(3, { minimum: 4, short: 6, medium: 12, long: 18 }),
    { bracket: "minimum", modifier: 2 }
  );
});

test("combat terrain selects one woods type per intervening hex", () => {
  const terrain = summarizeCombatTerrainPath({
    interveningRegionKeys: [
      ["lightWoods"],
      ["lightWoods", "heavyWoods"],
      ["rough"]
    ],
    targetRegionKeys: ["lightWoods", "waterDepth1"],
    attackerRegionKeys: []
  });
  assert.equal(terrain.interveningLightWoods, 1);
  assert.equal(terrain.interveningHeavyWoods, 1);
  assert.equal(terrain.targetLightWoods, true);
  assert.equal(terrain.targetWaterDepth, 1);
});

test("more than two intervening woods points block line of sight", () => {
  const terrain = terrainAttackModifiers({
    interveningLightWoods: 1,
    interveningHeavyWoods: 1
  });
  assert.equal(terrain.interveningWoods, 3);
  assert.equal(terrain.losBlocked, true);
});

test("target woods and Depth 1 water cover add modifiers without blocking LOS", () => {
  const terrain = terrainAttackModifiers({
    interveningLightWoods: 1,
    targetHeavyWoods: true,
    targetWaterDepth: 1
  });
  assert.equal(terrain.modifier, 4);
  assert.equal(terrain.partialCover, 1);
  assert.equal(terrain.losBlocked, false);
});

test("GATOR example combines movement, terrain, partial cover, and range", () => {
  const attack = calculateAttackTargetNumber({
    gunnery: 4,
    attackerMovement: 2,
    targetMovement: 1,
    heat: 0,
    distance: 4,
    weaponRange: { minimum: 0, short: 3, medium: 6, long: 9 },
    terrain: { interveningLightWoods: 1, partialCover: true }
  });
  assert.equal(attack.targetNumber, 11);
  assert.deepEqual(attack.components, {
    gunnery: 4,
    attackerMovement: 2,
    attackerStatus: 0,
    sensors: 0,
    weaponDamage: 0,
    targetMovement: 1,
    targetStatus: 0,
    heat: 0,
    terrain: 2,
    range: 2
  });
});

test("sensor and arm critical damage modifiers apply to weapon attacks", () => {
  const attack = calculateAttackTargetNumber({
    gunnery: 4,
    sensorHits: 1,
    weaponDamageModifier: 1,
    distance: 2,
    weaponRange: { short: 3, medium: 6, long: 9 }
  });
  assert.equal(attack.targetNumber, 7);
  assert.equal(attack.components.sensors, 2);
  assert.equal(attack.components.weaponDamage, 1);
  assert.equal(calculateAttackTargetNumber({
    gunnery: 4,
    sensorHits: 2,
    distance: 2,
    weaponRange: { short: 3, medium: 6, long: 9 }
  }).canAttack, false);
});

test("movement and heat modifiers remain cumulative", () => {
  const attack = calculateAttackTargetNumber({
    gunnery: 3,
    attackerMovement: 3,
    targetMovement: 2,
    heat: 14,
    distance: 2,
    weaponRange: { short: 3, medium: 6, long: 9 }
  });
  assert.equal(attack.targetNumber, 10);
});

test("submerged and surface units cannot target each other", () => {
  const attack = calculateAttackTargetNumber({
    gunnery: 4,
    distance: 2,
    weaponRange: { short: 3, medium: 6, long: 9 },
    terrain: { attackerWaterDepth: 2, targetWaterDepth: 0 }
  });
  assert.equal(attack.canAttack, false);
  assert.match(attack.reason, /submerged/);
});

test("prone target modifiers depend on adjacency", () => {
  const base = {
    gunnery: 4,
    weaponRange: { short: 3, medium: 6, long: 9 },
    targetProne: true
  };
  assert.equal(calculateAttackTargetNumber({ ...base, distance: 1 }).components.targetStatus, -2);
  assert.equal(calculateAttackTargetNumber({ ...base, distance: 2 }).components.targetStatus, 1);
});

test("a native sight-blocking wall prevents an attack", () => {
  const attack = calculateAttackTargetNumber({
    gunnery: 4,
    distance: 2,
    weaponRange: { short: 3, medium: 6, long: 9 },
    lineOfSightBlocked: true
  });
  assert.equal(attack.canAttack, false);
  assert.match(attack.reason, /wall blocks line of sight/);
});
