import assert from "node:assert/strict";
import test from "node:test";

import { activeProbeProfile, longestWeaponRange, radarContact, radarSweepProfile, x1AreaSensorLockUpdate } from "../module/radar.js";

const weapon = (long, extra = {}) => ({ type: "weapon", system: { range: { long }, ...extra } });
const equipment = name => ({ name, type: "equipment", system: {} });

test("radar range follows the longest operational weapon", () => {
  assert.equal(longestWeaponRange([weapon(9), weapon(21), weapon(24, { destroyed: true })]), 21);
});

test("active probes use tabletop identification ranges", () => {
  assert.deepEqual(activeProbeProfile([equipment("Beagle Active Probe")]), { equipped: true, name: "Beagle Active Probe", range: 4, heat: 2 });
  assert.equal(activeProbeProfile([equipment("Clan Active Probe")]).range, 5);
  assert.equal(activeProbeProfile([equipment("Bloodhound Active Probe")]).range, 8);
});

test("Raven X-1 EW equipment provides automated area Sensor Lock and ECM", () => {
  const probe = activeProbeProfile([{ name: "X-1 EW Equipment", type: "equipment", system: {} }]);
  assert.deepEqual(probe, { equipped: true, name: "X-1 EW Equipment", range: 6, heat: 0, areaSensorLock: true, ecm: true });
  assert.deepEqual(x1AreaSensorLockUpdate(4), { targetModifier: 2, sensorLocked: true, evasiveChargesRemoved: 2 });
  assert.equal(x1AreaSensorLockUpdate(1).targetModifier, 0);
});

test("basic radar is approximate while a nearby probe is precise", () => {
  const basic = radarSweepProfile({ items: [weapon(15)] });
  assert.deepEqual(radarContact({ distance: 10, profile: basic }), { distance: 10, precision: "approximate", attackPenalty: 2, uncertaintyHexes: 1 });
  const probe = radarSweepProfile({ items: [weapon(15), equipment("Beagle Active Probe")] });
  assert.equal(radarContact({ distance: 4, profile: probe }).attackPenalty, 0);
  assert.equal(radarContact({ distance: 5, profile: probe }).attackPenalty, 2);
  assert.equal(radarContact({ distance: 16, profile: probe }), null);
});
