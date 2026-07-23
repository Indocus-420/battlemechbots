import assert from "node:assert/strict";
import test from "node:test";

import {
  ammunitionTypeForWeapon,
  ammunitionUnitsPerAttack,
  legacyAmmunitionMigration,
  missileLauncherProfile,
  planAmmunitionConsumption,
  resolveMissileCluster,
  selectAmmunitionBin
} from "../module/missiles.js";

test("missile launcher names identify family and rack size", () => {
  assert.deepEqual(missileLauncherProfile("SRM 6"), { family: "SRM", size: 6 });
  assert.deepEqual(missileLauncherProfile("LRM-15 - Left"), { family: "LRM", size: 15 });
  assert.equal(missileLauncherProfile("Medium Laser"), null);
});

test("cluster table reproduces the rulebook examples", () => {
  assert.deepEqual(resolveMissileCluster("LRM 20", 8), {
    family: "LRM", size: 20, roll: 8, missilesHit: 12, damageGroups: [5, 5, 2]
  });
  assert.deepEqual(resolveMissileCluster("SRM 6", 11).damageGroups, [2, 2, 2, 2, 2, 2]);
  assert.equal(resolveMissileCluster("LRM 5", 2).missilesHit, 1);
});

test("ammunition matching distinguishes exact weapon types", () => {
  assert.equal(ammunitionTypeForWeapon("Autocannon/10 - Left"), "AC/10");
  assert.equal(ammunitionTypeForWeapon("LRM 15 - Left"), "LRM 15");
  assert.equal(ammunitionTypeForWeapon("Machine Gun"), "Machine Gun");
  assert.equal(ammunitionTypeForWeapon("Large Laser"), null);
});

test("ammunition selection uses a nonempty matching bin and empties small bins first", () => {
  const item = (name, ammoType, shots, destroyed = false) => ({ name, type: "ammo", system: { ammoType, shots, destroyed } });
  const bins = [item("Full", "AC/5", 20), item("Nearly Empty", "AC/5", 2), item("Wrong", "AC/10", 1), item("Destroyed", "AC/5", 1, true)];
  assert.equal(selectAmmunitionBin(bins, "Autocannon/5").name, "Nearly Empty");
  assert.equal(selectAmmunitionBin(bins, "Autocannon/20"), null);
});

test("ammunition usage follows rack, ballistic, and machine-gun rules", () => {
  assert.equal(ammunitionUnitsPerAttack({ name: "SRM 4", system: { ammoPerShot: 1 } }), 4);
  assert.equal(ammunitionUnitsPerAttack({ name: "LRM 20", system: { ammoPerShot: 1 } }), 20);
  assert.equal(ammunitionUnitsPerAttack({ name: "Machine Gun", system: { ammoPerShot: 1 } }), 200);
  assert.equal(ammunitionUnitsPerAttack({ name: "Autocannon/10", system: { ammoPerShot: 1 } }), 1);
  assert.equal(ammunitionUnitsPerAttack({ name: "Medium Laser", system: { ammoPerShot: 0 } }), 0);
});

test("weapon groups preflight shared ammunition before firing", () => {
  const weapons = [
    { id: "left", name: "LRM 10", type: "weapon", system: {} },
    { id: "right", name: "LRM 10 - Left", type: "weapon", system: {} }
  ];
  const bin = shots => ({ id: "bin", name: "LRM Bin", type: "ammo", system: { ammoType: "LRM 10", shots, destroyed: false } });
  assert.equal(planAmmunitionConsumption([bin(19)], weapons).ready, false);
  const ready = planAmmunitionConsumption([bin(20)], weapons);
  assert.equal(ready.ready, true);
  assert.equal(ready.remainingById.get("bin"), 0);
});

test("legacy salvo bins migrate to individual ammunition units once", () => {
  assert.deepEqual(legacyAmmunitionMigration({
    type: "ammo",
    system: { ammoType: "SRM 4", shots: 20, maxShots: 25, damagePerShot: 8, notes: "Shots are launcher salvos." }
  }), {
    shots: 80,
    maxShots: 100,
    damagePerShot: 2,
    notes: "Tracked as individual missiles; an SRM 4 volley consumes 4."
  });
  assert.equal(legacyAmmunitionMigration({
    type: "ammo",
    system: { ammoType: "SRM 4", shots: 80, maxShots: 100, damagePerShot: 2, notes: "Tracked as individual missiles." }
  }), null);
});
