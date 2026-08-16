import assert from "node:assert/strict";
import test from "node:test";

import { mergeItemSystemSource } from "../module/document-updates.js";

test("critical persistence preserves the complete embedded Item system", () => {
  const original = {
    location: "centerTorso",
    slotStart: 1,
    slots: 6,
    damagedSlots: [],
    criticalEffect: "engine",
    criticalHits: 0,
    destroyed: false,
    notes: "Fusion engine"
  };

  const updated = mergeItemSystemSource(original, {
    damagedSlots: [6],
    criticalHits: 1,
    destroyed: false
  });

  assert.deepEqual(updated, {
    ...original,
    damagedSlots: [6],
    criticalHits: 1
  });
  assert.deepEqual(original.damagedSlots, []);
});

test("ammunition and location destruction updates retain unrelated fields", () => {
  const original = {
    ammoType: "AC/5",
    location: "leftTorso",
    slotStart: 4,
    slots: 2,
    damagedSlots: [],
    shots: 20,
    damagePerShot: 5,
    destroyed: false
  };

  const updated = mergeItemSystemSource(original, { shots: 0, destroyed: true });

  assert.equal(updated.shots, 0);
  assert.equal(updated.destroyed, true);
  assert.equal(updated.slotStart, 4);
  assert.equal(updated.slots, 2);
  assert.equal(updated.damagePerShot, 5);
});
