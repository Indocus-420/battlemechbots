import assert from "node:assert/strict";
import test from "node:test";

import { armorDiagramModel } from "../module/armor-diagram.js";

test("armor diagram contains every BattleMech location in record-sheet order", () => {
  const armor = Object.fromEntries(["head", "centerTorso", "leftTorso", "rightTorso", "leftArm", "rightArm", "leftLeg", "rightLeg"].map(key => [key, { front: 10, maxFront: 10 }]));
  const structure = Object.fromEntries(Object.keys(armor).map(key => [key, { value: 5, max: 5 }]));
  assert.deepEqual(armorDiagramModel({ armor, structure }).map(location => location.key), [
    "head", "leftArm", "leftTorso", "centerTorso", "rightTorso", "rightArm", "leftLeg", "rightLeg"
  ]);
});

test("armor diagram reports damage state and rear torso armor", () => {
  const armor = { centerTorso: { front: 4, maxFront: 20, rear: 3, maxRear: 6 } };
  const structure = { centerTorso: { value: 8, max: 16 } };
  const center = armorDiagramModel({ armor, structure }).find(location => location.key === "centerTorso");
  assert.equal(center.condition, "critical");
  assert.equal(center.hasRear, true);
  assert.equal(center.rear, 3);
});

test("armor diagram uses the worst front, rear, or internal percentage", () => {
  const armor = { centerTorso: { front: 20, maxFront: 20, rear: 1, maxRear: 6 } };
  const structure = { centerTorso: { value: 16, max: 16 } };
  const center = armorDiagramModel({ armor, structure }).find(location => location.key === "centerTorso");
  assert.equal(center.condition, "critical");
});
