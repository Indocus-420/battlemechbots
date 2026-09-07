import assert from "node:assert/strict";
import test from "node:test";

import { endPhaseActorState } from "../module/end-phase.js";

test("End Phase clears transient movement and terrain state", () => {
  const result = endPhaseActorState({ pilotHits: 2 });
  assert.equal(result.pilotHits, 2);
  assert.equal(result.pilotDamage, 0);
  assert.deepEqual(
    [result.movement.mode, result.movement.hexesMoved, result.movement.mpSpent, result.movement.attackerModifier, result.movement.targetModifier, result.movement.heatGenerated],
    ["stand", 0, 0, 0, 0, 0]
  );
  assert.ok(Object.values(result.movement.terrain).every(value => value === 0));
});

test("damaged life support injures a fully submerged pilot and caps lethal hits", () => {
  assert.deepEqual(endPhaseActorState({ pilotHits: 4, lifeSupportHits: 1, submerged: true }).pilotHits, 5);
  const lethal = endPhaseActorState({ pilotHits: 5, lifeSupportHits: 2, submerged: true });
  assert.equal(lethal.pilotHits, 6);
  assert.equal(lethal.pilotDestroyed, true);
  assert.equal(endPhaseActorState({ pilotHits: 4, lifeSupportHits: 2, submerged: false }).pilotDamage, 0);
});
