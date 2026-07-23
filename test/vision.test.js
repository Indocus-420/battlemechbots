import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SENSOR_RANGE, mechSensorRange, tokenVisionUpdate } from "../module/vision.js";

function mech(range, sensorHits = 0) {
  return { type: "mech", system: { sensors: { range }, criticals: { sensorHits } } };
}

test("BattleMech radar range defines native token vision", () => {
  assert.equal(mechSensorRange(mech(42)), 42);
  assert.equal(tokenVisionUpdate(mech(42))["sight.range"], 42);
  assert.equal(tokenVisionUpdate(mech(42))["sight.angle"], 360);
});

test("sensor critical damage reduces or disables radar vision", () => {
  assert.equal(mechSensorRange(mech(30, 1)), 15);
  assert.equal(mechSensorRange(mech(30, 2)), 0);
  assert.equal(tokenVisionUpdate(mech(30, 2))["sight.enabled"], false);
});

test("legacy BattleMechs receive the default sensor range", () => {
  assert.equal(mechSensorRange({ type: "mech", system: { criticals: {} } }), DEFAULT_SENSOR_RANGE);
  assert.equal(mechSensorRange({ type: "vehicle", system: {} }), null);
});
