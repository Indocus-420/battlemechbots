import assert from "node:assert/strict";
import test from "node:test";

import {
  d6CheckOutcome,
  d6Formula,
  editActorTokenImage,
  FIRE_GROUPS,
  normalizeHudFaction,
  tokenActionHudModel,
  tokenizerIntegrationState,
  weaponFireGroup
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
    system: { pilot: { name: "Morgan", gunnery: 3, piloting: 4 }, heat: { current: 7 }, movement: { mode: "walk", mpSpent: 4 } },
    items: [
      { id: "w1", name: "Laser", img: "laser.svg", type: "weapon", flags: { "battletech-foundry-system": { fireGroup: "2" } }, system: { destroyed: false, damage: 5, heat: 3, ammoPerShot: 0, range: { short: 3, medium: 6, long: 9 } } },
      { id: "a1", name: "AC/10 Ammo", type: "ammo", system: { destroyed: false, shots: 8, maxShots: 10 } },
      { id: "w2", name: "Broken Laser", type: "weapon", system: { destroyed: true } }
    ]
  });
  assert.equal(model.gunnery, 3);
  assert.equal(model.piloting, 4);
  assert.equal(model.heat, 7);
  assert.equal(model.pilotName, "Morgan");
  assert.equal(model.heatSegments, 2);
  assert.equal(model.movement, "walk: 4 MP");
  assert.deepEqual(model.weapons.map(weapon => weapon.name), ["Laser"]);
  assert.equal(model.weapons[0].group, "2");
  assert.deepEqual(model.fireGroups["2"].map(weapon => weapon.name), ["Laser"]);
  assert.deepEqual(model.fireGroupSummaries["2"], { count: 1, damage: 5, heat: 3, ammunition: 0, ammunitionSufficient: true, short: 3, medium: 6, long: 9 });
  assert.deepEqual(model.ammunition, { current: 8, maximum: 10, bins: 1 });
  assert.deepEqual(FIRE_GROUPS, ["1", "2", "3", "alpha"]);
  assert.equal(weaponFireGroup({ flags: {} }), "alpha");
});

test("HUD factions normalize to the supported Great Houses", () => {
  for (const faction of ["davion", "kurita", "liao", "marik", "steiner"]) {
    assert.equal(normalizeHudFaction(faction), faction);
  }
  assert.equal(normalizeHudFaction("ComStar"), "independent");
  assert.equal(normalizeHudFaction(), "independent");
});

test("HUD ammunition reports compatible current and maximum stock", () => {
  const model = tokenActionHudModel({
    id: "m2", name: "Ammo Test", type: "mech",
    system: { mech: { faction: "davion" }, pilot: {}, heat: {}, movement: {} },
    items: [
      { id: "w1", name: "AC/10", type: "weapon", system: { weaponType: "AC/10", destroyed: false, ammoPerShot: 1, damage: 10, heat: 3, range: {} } },
      { id: "a1", name: "AC/10 Ammo", type: "ammo", system: { ammoType: "AC/10", destroyed: false, shots: 7, maxShots: 10 } }
    ]
  });
  assert.equal(model.faction, "davion");
  assert.deepEqual(model.weapons[0].ammunition, {
    type: "AC/10", current: 7, maximum: 10, bins: 1, required: 1, sufficient: true
  });
});
