import test from "node:test";
import assert from "node:assert/strict";
import { analyzeMechConstruction, itemConstructionMass, standardEngineRating, standardFusionEngineMass, standardGyroMass, standardInternalStructure } from "../module/construction.js";
import { CORE_MECHS, CORE_MECHS_BY_CLASS } from "../module/content.js";

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

test("renamed integral components and external heat sinks retain their construction mass", () => {
  assert.equal(itemConstructionMass(item("Medium Laser 2", "weapon", "leftArm", 1, 1)), 1);
  assert.equal(itemConstructionMass(item("Particle Projection Cannon - Left", "weapon", "leftArm", 1, 3)), 7);
  assert.equal(itemConstructionMass(item("Medium Laser - Left", "weapon", "leftArm", 4, 1)), 1);
  assert.equal(itemConstructionMass(item("Life Support - Upper", "equipment", "head", 1, 1, { criticalEffect: "lifeSupport" })), 0);
  assert.equal(itemConstructionMass(item("External Heat Sink 1", "equipment", "leftTorso", 1, 1, { criticalEffect: "heatSink" })), 1);
  assert.equal(itemConstructionMass(item("Jump Jet 5", "equipment", "rightLeg", 5, 1, { criticalEffect: "jumpJet" }), 35), 0.5);
});

test("all packaged BattleMechs pass MechLab deployment", () => {
  const summary = {};
  for (const [weightClass, actors] of Object.entries(CORE_MECHS_BY_CLASS)) {
    assert.ok(actors.length >= 5, `${weightClass} roster size`);
    summary[weightClass] = actors.map(actor => {
      const result = analyzeMechConstruction(actor);
      assert.equal(result.ready, true, `${actor.name}: ${result.errors.map(error => error.message).join("; ")}`);
      assert.equal(result.warnings.length, 0, `${actor.name}: ${result.warnings.map(warning => warning.message).join("; ")}`);
      assert.equal(result.status, "DEPLOYMENT READY", actor.name);
      return actor.name;
    });
  }
  assert.equal(Object.values(summary).flat().length, CORE_MECHS.length);
});

test("standard engine rating and internal structure follow chassis tonnage", () => {
  assert.equal(standardEngineRating(50, 4), 200);
  assert.equal(standardEngineRating(100, 5), 500);
  assert.deepEqual(standardInternalStructure(50), {
    head: 3, centerTorso: 16, leftTorso: 12, rightTorso: 12,
    leftArm: 8, rightArm: 8, leftLeg: 12, rightLeg: 12
  });
});

test("standard fusion engine and gyro masses follow engine rating", () => {
  assert.equal(standardFusionEngineMass(160), 6);
  assert.equal(standardGyroMass(160), 2);
  assert.equal(standardFusionEngineMass(200), 8.5);
  assert.equal(standardGyroMass(300), 3);
  assert.equal(standardFusionEngineMass(400), 52.5);
  assert.equal(standardFusionEngineMass(405), null);
});

test("MechLab includes standard chassis components in tracked mass", () => {
  const section = max => ({ value: max, max });
  const actor = {
    system: {
      mech: { tonnage: 50 }, movement: { walk: 4, run: 6, jump: 0 }, armor: {},
      structure: {
        head: section(3), centerTorso: section(16), leftTorso: section(12), rightTorso: section(12),
        leftArm: section(8), rightArm: section(8), leftLeg: section(12), rightLeg: section(12)
      }
    }, items: []
  };
  const result = analyzeMechConstruction(actor);
  assert.equal(result.engineMass, 8.5);
  assert.equal(result.gyroMass, 2);
  assert.equal(result.structureMass, 5);
  assert.equal(result.cockpitMass, 3);
  assert.equal(result.chassisMass, 18.5);
  assert.equal(result.trackedMass, 18.5);
  assert.equal(result.untrackedMass, 31.5);
});

test("MechLab rejects impossible engines, mismatched run MP, and invalid structure", () => {
  const section = max => ({ value: max, max });
  const actor = {
    system: {
      mech: { tonnage: 100 }, movement: { walk: 5, run: 7, jump: 0 }, armor: {},
      structure: {
        head: section(3), centerTorso: section(30), leftTorso: section(21), rightTorso: section(21),
        leftArm: section(17), rightArm: section(17), leftLeg: section(21), rightLeg: section(21)
      }
    },
    items: []
  };
  const result = analyzeMechConstruction(actor);
  assert.equal(result.ready, false);
  assert.equal(result.engineRating, 500);
  assert.deepEqual(new Set(result.errors.map(error => error.code)), new Set(["ENGINE_RATING", "RUN_MP", "INTERNAL_STRUCTURE"]));
});
