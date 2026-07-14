import test from "node:test";
import assert from "node:assert/strict";

import {
  addTerrainProfiles,
  calculateMovementPlan,
  calculateTerrainProfile,
  combineMovementSections,
  summarizeRegionTerrainPath,
  targetMovementModifier
} from "../module/movement.js";

const ratings = { walk: 12, run: 12, jump: 6 };

test("terrain table supplements match the rulebook", () => {
  const terrain = calculateTerrainProfile({
    roughHexes: 1,
    lightWoodsHexes: 1,
    heavyWoodsHexes: 1,
    rubbleHexes: 1,
    waterDepth1Hexes: 1,
    waterDepth2Hexes: 1,
    waterDepth3PlusHexes: 1,
    levelChanges: 2,
    facingChanges: 3
  });
  assert.equal(terrain.terrainCost, 17);
  assert.equal(terrain.pilotingChecks, 4);
});

test("walking adds base hex and terrain costs", () => {
  const plan = calculateMovementPlan({
    mode: "walk",
    hexesMoved: 3,
    mpSpent: 7,
    ratings,
    terrain: { roughHexes: 1, lightWoodsHexes: 1, heavyWoodsHexes: 1 }
  });
  assert.equal(plan.requiredMp, 7);
  assert.equal(plan.terrain.terrainCost, 4);
});

test("water adds terrain and level cost and requires a piloting check", () => {
  const plan = calculateMovementPlan({
    mode: "walk",
    hexesMoved: 1,
    mpSpent: 3,
    ratings,
    terrain: { waterDepth1Hexes: 1, levelChanges: 1 }
  });
  assert.equal(plan.requiredMp, 3);
  assert.equal(plan.terrain.pilotingChecks, 1);
  assert.deepEqual(plan.terrain.pilotingSummary, ["1 Depth 1 water (-1)"]);
});

test("running cannot enter water", () => {
  assert.throws(() => calculateMovementPlan({
    mode: "run",
    hexesMoved: 1,
    mpSpent: 2,
    ratings,
    terrain: { waterDepth1Hexes: 1 }
  }), /cannot enter Depth 1 or deeper water while running/);
});

test("jumping ignores terrain, level, and facing costs", () => {
  const plan = calculateMovementPlan({
    mode: "jump",
    hexesMoved: 3,
    mpSpent: 3,
    ratings,
    terrain: { heavyWoodsHexes: 3, levelChanges: 4, facingChanges: 2 }
  });
  assert.equal(plan.requiredMp, 3);
  assert.equal(plan.terrain.terrainCost, 0);
  assert.equal(plan.terrain.pilotingChecks, 0);
});

test("terrain entries cannot exceed ground hexes moved", () => {
  assert.throws(() => calculateMovementPlan({
    mode: "walk",
    hexesMoved: 1,
    mpSpent: 3,
    ratings,
    terrain: { roughHexes: 2 }
  }), /cannot exceed the number of hexes moved/);
});

test("movement rejects insufficient MP for the entered path", () => {
  assert.throws(() => calculateMovementPlan({
    mode: "walk",
    hexesMoved: 2,
    mpSpent: 2,
    ratings,
    terrain: { heavyWoodsHexes: 1 }
  }), /requires at least 4 MP/);
});

test("target modifier retains jumping adjustment", () => {
  assert.equal(targetMovementModifier(5, false), 2);
  assert.equal(targetMovementModifier(5, true), 3);
});

test("region path selects one highest-cost terrain type per entered hex", () => {
  const terrain = summarizeRegionTerrainPath([
    ["rough"],
    ["lightWoods", "heavyWoods"],
    ["waterDepth1"],
    [],
    ["unknown"]
  ]);
  assert.equal(terrain.roughHexes, 1);
  assert.equal(terrain.lightWoodsHexes, 0);
  assert.equal(terrain.heavyWoodsHexes, 1);
  assert.equal(terrain.waterDepth1Hexes, 1);
  assert.equal(calculateTerrainProfile(terrain).terrainCost, 4);
});

test("region path uses deterministic priority when terrain costs tie", () => {
  const terrain = summarizeRegionTerrainPath([["rubble", "waterDepth1"]]);
  assert.equal(terrain.rubbleHexes, 0);
  assert.equal(terrain.waterDepth1Hexes, 1);
});

test("terrain profiles accumulate movement checkpoints without mutating inputs", () => {
  const previous = { roughHexes: 1, facingChanges: 2 };
  const added = { heavyWoodsHexes: 1, levelChanges: 1 };
  const combined = addTerrainProfiles(previous, added);
  assert.deepEqual(
    {
      roughHexes: combined.roughHexes,
      heavyWoodsHexes: combined.heavyWoodsHexes,
      levelChanges: combined.levelChanges,
      facingChanges: combined.facingChanges
    },
    { roughHexes: 1, heavyWoodsHexes: 1, levelChanges: 1, facingChanges: 2 }
  );
  assert.deepEqual(previous, { roughHexes: 1, facingChanges: 2 });
});

test("completed and pending movement sections are combined without duplicate joins", () => {
  const origin = { x: 0, y: 0, elevation: 0, action: "walk" };
  const checkpoint = { x: 100, y: 0, elevation: 0, action: "walk" };
  const destination = { x: 200, y: 0, elevation: 0, action: "walk" };
  const movement = combineMovementSections(
    { spaces: 1, waypoints: [origin, checkpoint] },
    { spaces: 1, waypoints: [checkpoint, destination] }
  );
  assert.equal(movement.spaces, 2);
  assert.deepEqual(movement.waypoints, [origin, checkpoint, destination]);
});

test("a completed movement is retained when the pending section is empty", () => {
  const movement = combineMovementSections(
    { spaces: 5, waypoints: [{ x: 0, y: 0 }, { x: 500, y: 0 }] },
    { spaces: 0, waypoints: [] }
  );
  assert.equal(movement.spaces, 5);
  assert.equal(movement.waypoints.length, 2);
});
