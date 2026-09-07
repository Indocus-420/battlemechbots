import test from "node:test";
import assert from "node:assert/strict";
import {
  mechActionBlockReason,
  mechDestructionReason,
  operationalStateUpdates,
  reactorControlState
} from "../module/operational-state.js";

function system(overrides = {}) {
  return {
    status: { destroyed: false },
    pilot: { hits: 0, unconscious: false },
    heat: { current: 0, shutdown: false },
    criticals: { engineHits: 0, sensorHits: 0, cockpitDestroyed: false },
    ...overrides
  };
}

test("engine, cockpit, pilot, and explicit destruction share one result", () => {
  assert.equal(mechDestructionReason(system({ criticals: { engineHits: 3 } })), "engine destroyed");
  assert.equal(mechDestructionReason(system({ criticals: { cockpitDestroyed: true } })), "cockpit destroyed");
  assert.equal(mechDestructionReason(system({ pilot: { hits: 6 } })), "pilot killed");
  assert.equal(mechDestructionReason(system({ status: { destroyed: true } })), "destroyed");
});

test("actions are blocked consistently by destruction, pilot state, shutdown, and sensors", () => {
  assert.match(mechActionBlockReason(system({ criticals: { engineHits: 3 } }), "move"), /engine destroyed/);
  assert.match(mechActionBlockReason(system({ pilot: { unconscious: true } }), "attack"), /unconscious/);
  assert.match(mechActionBlockReason(system({ heat: { shutdown: true } }), "move"), /shut down/);
  assert.match(mechActionBlockReason(system({ criticals: { sensorHits: 2 } }), "operate sensors"), /destroyed sensors/);
  assert.equal(mechActionBlockReason(system(), "attack"), null);
});

test("reactor controls reject unsafe restart and destroyed or unconscious units", () => {
  assert.deepEqual(
    { canShutdown: reactorControlState(system()).canShutdown, canRestart: reactorControlState(system()).canRestart },
    { canShutdown: true, canRestart: false }
  );
  assert.equal(reactorControlState(system({ heat: { current: 30, shutdown: true } })).reason, "heat 30+");
  assert.equal(reactorControlState(system({ pilot: { unconscious: true }, heat: { shutdown: true } })).reason, "pilot unconscious");
  assert.equal(reactorControlState(system({ criticals: { engineHits: 3 }, heat: { shutdown: true } })).canRestart, false);
});

test("destroyed units are persisted as destroyed and shut down", () => {
  assert.deepEqual(operationalStateUpdates(system({ criticals: { cockpitDestroyed: true } })), {
    "system.status.destroyed": true,
    "system.heat.shutdown": true
  });
  assert.deepEqual(operationalStateUpdates(system()), {});
});
