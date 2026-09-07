import test from "node:test";
import assert from "node:assert/strict";
import { MAP_SIZES, normalizeMapSize, randomBattleTechMapPlan } from "../module/map-generator.js";

test("random map generator accepts each requested map size", () => {
  for (const size of MAP_SIZES) {
    const plan = randomBattleTechMapPlan({ size, seed: "same", hexSize: 50 });
    assert.equal(plan.hexes, size);
    assert.equal(plan.width, size * 50);
    assert.ok(plan.zones.length >= 12);
  }
  assert.throws(() => normalizeMapSize(30), /Map size/);
});

test("random map plans are reproducible by seed", () => {
  assert.deepEqual(
    randomBattleTechMapPlan({ size: 50, seed: "test-seed" }),
    randomBattleTechMapPlan({ size: 50, seed: "test-seed" })
  );
});
