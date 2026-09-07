import assert from "node:assert/strict";
import test from "node:test";

import {
  d6CheckOutcome,
  d6Formula,
  editActorTokenImage,
  tokenActionHudModel,
  tokenizerIntegrationState
} from "../module/integrations.js";

test("the dice roller accepts only bounded pools of six-sided dice", () => {
  assert.equal(d6Formula(1), "1d6");
  assert.equal(d6Formula(2, 3), "2d6+3");
  assert.equal(d6Formula(4, -2), "4d6-2");
  assert.throws(() => d6Formula(0), /between 1 and 20/);
  assert.throws(() => d6Formula(2.5), /whole number/);
});

test("D6 checks report success, failure, and margin", () => {
  assert.deepEqual(d6CheckOutcome(8, 7), { total: 8, target: 7, margin: 1, success: true });
  assert.deepEqual(d6CheckOutcome(5, 7), { total: 5, target: 7, margin: -2, success: false });
});

test("Tokenizer integration requires an active API and upload permission", async () => {
  const calls = [];
  const api = { tokenizeActor: actor => calls.push(actor.id) };
  const modules = new Map([["vtta-tokenizer", { active: true, api }]]);
  const user = { can: permission => permission === "FILES_UPLOAD" };
  assert.deepEqual(tokenizerIntegrationState({ modules, user }), { active: true, canUpload: true, api });
  await editActorTokenImage({ id: "mech-1" }, { modules, user });
  assert.deepEqual(calls, ["mech-1"]);
  await assert.rejects(() => editActorTokenImage({ id: "mech-2" }, { modules, user: { can: () => false } }), /file-upload permission/);
});

test("BattleTech token HUD model exposes D6 skills and operational weapons", () => {
  const model = tokenActionHudModel({
    id: "m1", name: "Test Mech", img: "mech.svg", type: "mech",
    system: { pilot: { gunnery: 3, piloting: 4 }, heat: { current: 7 }, movement: { mode: "walk", mpSpent: 4 } },
    items: [
      { id: "w1", name: "Laser", img: "laser.svg", type: "weapon", system: { destroyed: false } },
      { id: "w2", name: "Broken Laser", type: "weapon", system: { destroyed: true } }
    ]
  });
  assert.equal(model.gunnery, 3);
  assert.equal(model.piloting, 4);
  assert.equal(model.heat, 7);
  assert.equal(model.movement, "walk: 4 MP");
  assert.deepEqual(model.weapons.map(weapon => weapon.name), ["Laser"]);
});
