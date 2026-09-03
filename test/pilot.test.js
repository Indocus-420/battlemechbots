import assert from "node:assert/strict";
import test from "node:test";

import { consciousnessTarget, pilotConsciousnessState } from "../module/pilot.js";

test("pilot consciousness targets follow the wound track", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(consciousnessTarget), [3, 5, 7, 10, 11]);
});

test("consciousness checks knock out and recover pilots", () => {
  assert.equal(pilotConsciousnessState({ hits: 3, roll: 6 }).unconscious, true);
  const recovered = pilotConsciousnessState({ hits: 3, unconscious: true, roll: 7 });
  assert.equal(recovered.unconscious, false);
  assert.equal(recovered.recovered, true);
  assert.equal(pilotConsciousnessState({ hits: 6, roll: 12 }).dead, true);
});

