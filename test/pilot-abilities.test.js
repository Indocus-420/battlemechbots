import test from "node:test";
import assert from "node:assert/strict";
import { PILOT_ABILITIES, resolveAfterRound, resolveCombatModifier, specialAttackModifier, spendResolve } from "../module/pilot-abilities.js";

test("manual pilot feats include two actions and five passive abilities", () => {
  assert.equal(Object.keys(PILOT_ABILITIES).length, 7);
  assert.equal(Object.values(PILOT_ABILITIES).filter(ability => ability.kind === "action").length, 2);
  assert.equal(Object.values(PILOT_ABILITIES).filter(ability => ability.kind === "passive").length, 5);
});

test("Resolve gains fifteen per round, caps at one hundred, and spends thirty", () => {
  assert.equal(resolveAfterRound(0), 15);
  assert.equal(resolveAfterRound(95), 100);
  assert.equal(spendResolve(45), 15);
  assert.throws(() => spendResolve(29), /30 Resolve/);
});

test("Inspired and Precision Strike lower attack target numbers", () => {
  assert.equal(resolveCombatModifier(49), 0);
  assert.equal(resolveCombatModifier(50), -1);
  assert.equal(specialAttackModifier({ precisionStrike: true, resolve: 75 }), -5);
});
