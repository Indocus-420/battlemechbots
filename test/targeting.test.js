import test from "node:test";
import assert from "node:assert/strict";
import {
  aerospaceFiringArcForBearing,
  aerospaceTargetingArc,
  firingArcForBearing,
  hitZoneForBearing,
  registerTokenizerTargetingFrames,
  targetingArc,
  TOKENIZER_TARGETING_FRAMES
} from "../module/targeting.js";

test("firing arcs and hit zones follow BattleMech facings", () => {
  assert.equal(firingArcForBearing(0), "front");
  assert.equal(firingArcForBearing(90), "rightArm");
  assert.equal(firingArcForBearing(180), "rear");
  assert.equal(firingArcForBearing(270), "leftArm");
  assert.equal(hitZoneForBearing(90), "rightSide");
  assert.equal(hitZoneForBearing(180), "rear");
  assert.deepEqual(targetingArc({ x: 0, y: 0 }, { x: 10, y: 0 }, 0), {
    bearing: 90, firingArc: "rightArm", hitZone: "rightSide"
  });
});

test("aerospace arcs distinguish nose, wing overlaps, wings, and aft", () => {
  assert.equal(aerospaceFiringArcForBearing(0), "nose");
  assert.equal(aerospaceFiringArcForBearing(60), "noseRightWing");
  assert.equal(aerospaceFiringArcForBearing(120), "rightWing");
  assert.equal(aerospaceFiringArcForBearing(165), "aftRightWing");
  assert.equal(aerospaceFiringArcForBearing(195), "aftLeftWing");
  assert.equal(aerospaceFiringArcForBearing(240), "leftWing");
  assert.equal(aerospaceFiringArcForBearing(300), "noseLeftWing");
  assert.equal(aerospaceTargetingArc({ x: 0, y: 0 }, { x: 0, y: -10 }).firingArc, "nose");
});

test("Tokenizer registration adds each targeting frame once", async () => {
  let saved = [];
  const modules = new Map([["vtta-tokenizer", { active: true }]]);
  const settings = {
    get: () => saved,
    set: async (_module, _key, value) => { saved = value; }
  };
  assert.equal(await registerTokenizerTargetingFrames({ modules, settings }), true);
  assert.deepEqual(saved, TOKENIZER_TARGETING_FRAMES);
  assert.equal(await registerTokenizerTargetingFrames({ modules, settings }), true);
  assert.equal(saved.length, 3);
});
