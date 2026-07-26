import test from "node:test";
import assert from "node:assert/strict";
import { analyzeMechConstruction, itemConstructionMass } from "../module/construction.js";

const item = (name, type, location, slotStart, slots, extra = {}) => ({
  id: `${name}-${slotStart}`,
  name,
  type,
  system: { location, slotStart, slots, destroyed: false, ...extra }
});

test("MechLab reports tracked armor and equipment mass", () => {
  const actor = {
    system: {
      mech: { tonnage: 50 },
      movement: { jump: 0 },
      armor: { head: { front: 9, rear: 0 }, centerTorso: { front: 30, rear: 10 } }
    },
    items: [
      item("Medium Laser", "weapon", "rightArm", 1, 1),
      item("Autocannon/10", "weapon", "rightTorso", 1, 7),
      item("Autocannon/10 Ammunition", "ammo", "leftTorso", 1, 1, { ammoType: "AC/10" })
    ]
  };
  const result = analyzeMechConstruction(actor);
  assert.equal(result.armorPoints, 49);
  assert.equal(result.armorMass, 3.5);
  assert.equal(result.equipmentMass, 14);
  assert.equal(result.ready, true);
});

test("MechLab blocks slot conflicts, missing ammunition, and missing jump jets", () => {
  const actor = {
    system: { mech: { tonnage: 45 }, movement: { jump: 4 }, armor: {} },
    items: [
      item("LRM 10", "weapon", "rightTorso", 1, 2),
      item("Medium Laser", "weapon", "rightTorso", 2, 1),
      item("Jump Jet", "equipment", "leftTorso", 1, 1, { criticalEffect: "jumpJet" })
    ]
  };
  const result = analyzeMechConstruction(actor);
  assert.equal(result.ready, false);
  assert.deepEqual(new Set(result.errors.map(error => error.code)), new Set(["SLOT_CONFLICT", "AMMO", "JUMP_JETS"]));
});

test("jump jet construction mass follows BattleMech weight class", () => {
  const jet = item("Jump Jet", "equipment", "leftTorso", 1, 1);
  assert.equal(itemConstructionMass(jet, 35), 0.5);
  assert.equal(itemConstructionMass(jet, 65), 1);
  assert.equal(itemConstructionMass(jet, 100), 2);
});
