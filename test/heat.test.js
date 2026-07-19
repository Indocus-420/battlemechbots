import assert from "node:assert/strict";
import test from "node:test";

import {
  ammunitionExplosionDamage,
  ammoExplosionAvoidTarget,
  calculateHeatPhase,
  engineHeat,
  heatEffectProfile,
  heatMovementPenalty,
  heatWeaponModifier,
  shutdownAvoidTarget
} from "../module/heat.js";

test("heat scale movement and weapon modifiers match the rulebook", () => {
  assert.equal(heatMovementPenalty(4), 0);
  assert.equal(heatMovementPenalty(5), 1);
  assert.equal(heatMovementPenalty(25), 5);
  assert.equal(heatWeaponModifier(7), 0);
  assert.equal(heatWeaponModifier(8), 1);
  assert.equal(heatWeaponModifier(24), 4);
});

test("shutdown and ammunition avoid targets match the heat scale", () => {
  assert.equal(shutdownAvoidTarget(13), 0);
  assert.equal(shutdownAvoidTarget(14), 4);
  assert.equal(shutdownAvoidTarget(26), 10);
  assert.equal(shutdownAvoidTarget(30), null);
  assert.equal(ammoExplosionAvoidTarget(18), 0);
  assert.equal(ammoExplosionAvoidTarget(19), 4);
  assert.equal(ammoExplosionAvoidTarget(28), 8);
});

test("engine critical hits add five then ten heat per turn", () => {
  assert.equal(engineHeat(0), 0);
  assert.equal(engineHeat(1), 5);
  assert.equal(engineHeat(2), 10);
  assert.equal(engineHeat(3), 10);
});

test("heat phase adds engine heat and dissipates operational sinks", () => {
  const phase = calculateHeatPhase({
    current: 17,
    sinks: 10,
    engineHits: 1,
    shutdownRoll: 8,
    ammoRoll: 7,
    hasAmmo: true
  });
  assert.equal(phase.heatBeforeDissipation, 22);
  assert.equal(phase.dissipated, 10);
  assert.equal(phase.current, 12);
  assert.equal(phase.shutdown, false);
  assert.equal(phase.ammoCheck, null);
  assert.deepEqual(phase.effects, heatEffectProfile(12));
});

test("failed shutdown and ammunition checks apply at the final heat level", () => {
  const phase = calculateHeatPhase({
    current: 29,
    sinks: 5,
    engineHits: 1,
    shutdownRoll: 7,
    ammoRoll: 5,
    hasAmmo: true
  });
  assert.equal(phase.current, 29);
  assert.equal(phase.shutdownCheck.target, 10);
  assert.equal(phase.shutdown, true);
  assert.equal(phase.ammoCheck.target, 8);
  assert.equal(phase.ammoCheck.exploded, true);
});

test("thirty heat causes automatic shutdown and tracks overflow", () => {
  const phase = calculateHeatPhase({ current: 35, sinks: 2 });
  assert.equal(phase.current, 33);
  assert.equal(phase.overflow, 3);
  assert.equal(phase.shutdown, true);
  assert.equal(phase.shutdownCheck.automatic, true);
});

test("engine critical hits do not add heat while the mech is shut down", () => {
  const phase = calculateHeatPhase({
    current: 20,
    sinks: 10,
    engineHits: 2,
    shutdown: true
  });
  assert.equal(phase.engineHeat, 0);
  assert.equal(phase.current, 10);
  assert.equal(phase.shutdown, false);
});

test("ammunition explosion damage is shots times damage per shot", () => {
  assert.equal(ammunitionExplosionDamage(20, 5), 100);
});
