import assert from "node:assert/strict";
import test from "node:test";

import { CORE_ITEMS } from "../module/content.js";
import { applyMechDamage, MECH_LOCATIONS } from "../module/damage.js";
import { weaponEffectProfile } from "../module/effects.js";
import { tokenActionHudModel } from "../module/integrations.js";
import { ammunitionTypeForWeapon, missileLauncherProfile, resolveMissileCluster, selectAmmunitionBin } from "../module/missiles.js";

const weapons = CORE_ITEMS.filter(item => item.type === "weapon");

function pristineTarget() {
  return {
    armor: Object.fromEntries(MECH_LOCATIONS.map(location => [location, {
      front: 200,
      ...(["centerTorso", "leftTorso", "rightTorso"].includes(location) ? { rear: 100 } : {})
    }])),
    structure: Object.fromEntries(MECH_LOCATIONS.map(location => [location, { value: 100 }]))
  };
}

test("every catalog weapon is represented by an actionable HUD entry", () => {
  const actor = {
    id: "catalog-mech",
    name: "Catalog Test Mech",
    img: "catalog.svg",
    type: "mech",
    system: { pilot: { gunnery: 4, piloting: 5 }, heat: { current: 0 }, movement: { mode: "stand", mpSpent: 0 } },
    items: weapons.map((item, index) => ({ ...structuredClone(item), id: `weapon-${index}` }))
  };
  const hud = tokenActionHudModel(actor);
  assert.equal(hud.weapons.length, weapons.length);
  assert.deepEqual(hud.weapons.map(item => item.name), weapons.map(item => item.name));
});

test("every catalog weapon has visible/audio media and a valid damage output", () => {
  for (const weapon of weapons) {
    const profile = weaponEffectProfile(weapon);
    assert.match(profile.texture, /^systems\/battletech-foundry-system\/assets\/vfx\//, weapon.name);
    assert.match(profile.impact, /^systems\/battletech-foundry-system\/assets\/vfx\//, weapon.name);
    assert.match(profile.sound, /^systems\/battletech-foundry-system\/assets\/audio\/combat\//, weapon.name);

    const launcher = missileLauncherProfile(weapon.name);
    const groups = launcher ? resolveMissileCluster(weapon.name, 12).damageGroups : [Number(weapon.system.damage)];
    for (const damage of groups) {
      const result = applyMechDamage(pristineTarget(), "centerTorso", damage);
      const applied = result.events.reduce((sum, event) => sum + event.armorDamage + event.structureDamage, 0);
      assert.equal(applied, damage, `${weapon.name} damage group`);
    }
  }
});

test("every ammunition-using catalog weapon has enough compatible stock for one attack", () => {
  for (const weapon of weapons.filter(item => Number(item.system.ammoPerShot) > 0)) {
    const ammoType = ammunitionTypeForWeapon(weapon.name);
    const bin = selectAmmunitionBin(CORE_ITEMS, weapon.name);
    assert.ok(ammoType, weapon.name);
    assert.ok(bin, `${weapon.name} compatible bin`);
    assert.equal(bin.system.ammoType, ammoType);
    assert.ok(Number(bin.system.shots) - Number(weapon.system.ammoPerShot) >= 0);
  }
});
