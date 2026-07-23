import test from "node:test";
import assert from "node:assert/strict";
import { generatedWallSources, MAP_SIZES, normalizeMapSize, randomBattleTechMapPlan } from "../module/map-generator.js";

test("random map generator accepts each requested map size", () => {
  for (const size of MAP_SIZES) {
    const plan = randomBattleTechMapPlan({ size, seed: "same", hexSize: 50 });
    assert.equal(plan.hexes, size);
    assert.equal(plan.width, size * 50);
    assert.ok(plan.zones.length >= 12);
  }
  assert.throws(() => normalizeMapSize(30), /Map size/);
});

test("generated battlefields include native sight-blocking terrain walls", () => {
  const plan = randomBattleTechMapPlan({ size: 50, seed: "wall-test" });
  const walls = generatedWallSources(plan);
  assert.ok(walls.length > 0);
  assert.equal(walls.length % 4, 0);
  assert.ok(walls.every(wall => wall.sight === 1 && wall.move === 1 && wall.c.length === 4));
});

test("random map plans are reproducible by seed", () => {
  assert.deepEqual(
    randomBattleTechMapPlan({ size: 50, seed: "test-seed" }),
    randomBattleTechMapPlan({ size: 50, seed: "test-seed" })
  );
});
