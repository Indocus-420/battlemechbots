import test from "node:test";
import assert from "node:assert/strict";
import { activationActionState, activationActionUpdate, guardedDamage } from "../module/action-hotbar.js";
import { firingArcSectors, hexClusterBoundary, visualFacingRotation } from "../module/firing-arc-overlay.js";
import { snapTokenChangeToHexCenter } from "../module/token-grid.js";

const mech = jump => ({ type: "mech", system: { movement: { jump } } });

test("activation hotbar actions expose movement, firing, and defensive tradeoffs", () => {
  assert.equal(activationActionState(mech(4), "move").consumesFire, false);
  assert.equal(activationActionState(mech(4), "sprint").consumesFire, true);
  assert.equal(activationActionState(mech(4), "jump").enabled, true);
  assert.equal(activationActionState(mech(0), "jump").enabled, false);
  assert.equal(activationActionUpdate("brace").flags.guarded, true);
  assert.equal(activationActionUpdate("brace").flags.firingActionConsumed, true);
});

test("Guarded halves front and side damage but not rear damage", () => {
  assert.equal(guardedDamage(11, { guarded: true, rear: false }), 6);
  assert.equal(guardedDamage(11, { guarded: true, rear: true }), 11);
  assert.equal(guardedDamage(11), 11);
});

test("firing arc overlay rotates all colored sectors with token facing", () => {
  const sectors = firingArcSectors(60);
  assert.deepEqual(sectors.map(sector => sector.id), ["front", "right", "rear", "left"]);
  assert.deepEqual(sectors.map(sector => [sector.start, sector.end]), [[0, 120], [120, 210], [210, 270], [270, 360]]);
});

test("firing arc boundary follows the outer edges of a two-hex cluster", () => {
  const boundary = hexClusterBoundary(100, 100, 2);
  const x = boundary.filter((_, index) => index % 2 === 0);
  const y = boundary.filter((_, index) => index % 2 === 1);
  assert.equal(boundary.length / 2, 30);
  assert.deepEqual([Math.min(...x), Math.max(...x)], [-200, 200]);
  assert.deepEqual([Math.min(...y), Math.max(...y)], [-250, 250]);
});

test("visible token nose and firing arc share the same facing", () => {
  assert.equal(visualFacingRotation(0), 90);
  assert.equal(visualFacingRotation(60), 150);
  assert.equal(visualFacingRotation(300), 30);
});

test("token movement ends at a whole hex center", () => {
  const grid = {
    size: 100,
    getOffset: ({ x, y }) => ({ i: Math.round(x / 75), j: Math.round(y / 100) }),
    getCenterPoint: ({ i, j }) => ({ x: i * 75, y: j * 100 })
  };
  const document = { x: 0, y: 0, width: 1, height: 1 };
  assert.deepEqual(snapTokenChangeToHexCenter(document, { x: 116, y: 63 }, grid), { x: 100, y: 50 });
});
