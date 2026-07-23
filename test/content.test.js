import assert from "node:assert/strict";
import test from "node:test";

import { CORE_ITEMS, CORE_ITEMS_BY_GROUP, CORE_MECHS, CORE_MECHS_BY_CLASS, CORE_VEHICLES } from "../module/content.js";
import { ammunitionTypeForWeapon } from "../module/missiles.js";

test("core item catalog contains unique weapons, ammunition, and equipment", () => {
  assert.ok(CORE_ITEMS.length >= 40);
  assert.equal(new Set(CORE_ITEMS.map(item => item.name)).size, CORE_ITEMS.length);
  assert.deepEqual([...new Set(CORE_ITEMS.map(item => item.type))].sort(), ["ammo", "equipment", "weapon"]);
});

test("every equipment critical effect is accepted by the Foundry data model", () => {
  const accepted = new Set([
    "general", "engine", "gyro", "sensors", "lifeSupport", "cockpit",
    "heatSink", "jumpJet", "hip", "upperLeg", "lowerLeg", "foot",
    "shoulder", "upperArm", "lowerArm", "hand"
  ]);
  for (const item of CORE_ITEMS.filter(item => item.type === "equipment")) {
    assert.ok(accepted.has(item.system.criticalEffect), `${item.name} has invalid critical effect ${item.system.criticalEffect}`);
  }
});

test("core item catalog is separated into energy, ballistic, missile, and equipment groups", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(CORE_ITEMS_BY_GROUP).map(([key, items]) => [key, items.length])), {
    energy: 5, ballistic: 10, missile: 14, equipment: 16
  });
  assert.equal(Object.values(CORE_ITEMS_BY_GROUP).flat().length, CORE_ITEMS.length);
  assert.ok(CORE_ITEMS.every(item => item.img.startsWith("systems/battletech-foundry-system/assets/items/")));
});

test("catalog weapon ranges and critical assignments are valid", () => {
  for (const item of CORE_ITEMS) {
    assert.ok(Number.isInteger(item.system.slotStart) && item.system.slotStart >= 1);
    assert.ok(Number.isInteger(item.system.slots) && item.system.slots >= 1);
    assert.deepEqual(item.system.damagedSlots, []);
    if (item.type !== "weapon") continue;
    const { minimum, short, medium, long } = item.system.range;
    assert.ok(minimum <= long);
    assert.ok(short <= medium && medium <= long);
  }
});

test("generic vehicle catalog is original, complete, and importable", () => {
  assert.equal(CORE_VEHICLES.length, 6);
  assert.equal(new Set(CORE_VEHICLES.map(actor => actor.name)).size, CORE_VEHICLES.length);
  for (const actor of CORE_VEHICLES) {
    assert.equal(actor.type, "vehicle");
    assert.ok(actor.name.startsWith("Generic "));
    assert.ok(actor.system.structure > 0);
    assert.ok(actor.items.length > 0);
    assert.equal(actor.img, actor.prototypeToken.texture.src);
    assert.match(actor.flags["battletech-foundry-system"].presentation.sound, /assets\/audio\/vehicles\/.+\.wav$/);
  }
});

test("requested BattleMech catalog contains five units in every weight class", () => {
  assert.equal(CORE_MECHS.length, 20);
  assert.equal(new Set(CORE_MECHS.map(actor => actor.name)).size, 20);
  assert.deepEqual(CORE_MECHS.map(actor => actor.system.mech.chassis), [
    "Jenner", "Firestarter", "Javelin", "Commando", "UrbanMech",
    "Assassin", "Blackjack", "Hatchetman", "Phoenix Hawk", "Hunchback",
    "Catapult", "JagerMech", "Archer", "Thunderbolt", "Marauder",
    "Atlas", "Banshee", "Stalker", "Awesome", "Zeus"
  ]);
  const weightClass = tonnage => tonnage <= 35 ? "light" : tonnage <= 55 ? "medium" : tonnage <= 75 ? "heavy" : "assault";
  const counts = { light: 0, medium: 0, heavy: 0, assault: 0 };
  for (const actor of CORE_MECHS) counts[weightClass(actor.system.mech.tonnage)] += 1;
  assert.deepEqual(counts, { light: 5, medium: 5, heavy: 5, assault: 5 });
  assert.deepEqual(Object.fromEntries(Object.entries(CORE_MECHS_BY_CLASS).map(([key, actors]) => [key, actors.length])), counts);
});

test("every BattleMech has unique packaged image, audio, and presentation metadata", () => {
  const images = new Set();
  const sounds = new Set();
  for (const actor of CORE_MECHS) {
    const profile = actor.flags["battletech-foundry-system"].presentation;
    assert.equal(actor.img, profile.image);
    assert.equal(actor.prototypeToken.texture.src, profile.image);
    assert.match(profile.image, /^systems\/battletech-foundry-system\/assets\/mechs\/.+\.svg$/);
    assert.match(profile.sound, /^systems\/battletech-foundry-system\/assets\/audio\/mechs\/.+\.wav$/);
    images.add(profile.image);
    sounds.add(profile.sound);
  }
  assert.equal(images.size, 20);
  assert.equal(sounds.size, 20);
});

test("every catalog BattleMech is immediately playable", () => {
  const locations = ["head", "centerTorso", "leftTorso", "rightTorso", "leftArm", "rightArm", "leftLeg", "rightLeg"];
  for (const actor of CORE_MECHS) {
    assert.equal(actor.type, "mech");
    assert.ok(actor.prototypeToken.actorLink);
    assert.ok(actor.system.mech.chassis);
    assert.ok(actor.system.mech.variant);
    assert.ok(actor.system.mech.role);
    assert.ok(actor.system.movement.walk > 0);
    assert.ok(actor.system.movement.run >= actor.system.movement.walk);
    assert.ok(actor.system.heat.sinks >= 10);
    assert.ok(actor.items.some(item => item.type === "weapon"));
    const jumpJets = actor.items.filter(item => item.system.criticalEffect === "jumpJet");
    const externalHeatSinks = actor.items.filter(item => item.system.criticalEffect === "heatSink");
    assert.equal(jumpJets.length, actor.system.movement.jump, `${actor.name}: jump-jet count`);
    assert.equal(externalHeatSinks.length, Math.max(0, actor.system.heat.sinks - 10), `${actor.name}: external heat-sink count`);
    const ammunition = actor.items.filter(item => item.type === "ammo");
    for (const weapon of actor.items.filter(item => item.type === "weapon" && item.system.ammoPerShot > 0)) {
      const ammoType = ammunitionTypeForWeapon(weapon.name);
      assert.ok(ammunition.some(item => item.system.ammoType === ammoType), `${actor.name}: ammunition for ${weapon.name}`);
    }
    for (const location of locations) {
      assert.ok(actor.system.structure[location].value > 0);
      assert.equal(actor.system.structure[location].value, actor.system.structure[location].max);
      assert.ok(actor.system.armor[location].front > 0);
    }
  }
});

test("catalog BattleMech critical assignments fit without collisions", () => {
  const capacity = {
    head: 6, centerTorso: 12, leftTorso: 12, rightTorso: 12,
    leftArm: 12, rightArm: 12, leftLeg: 6, rightLeg: 6
  };
  for (const actor of CORE_MECHS) {
    const occupied = new Set();
    for (const item of actor.items) {
      const { location, slotStart, slots } = item.system;
      assert.ok(capacity[location], `${actor.name}: unknown location ${location}`);
      assert.ok(slotStart >= 1 && slotStart + slots - 1 <= capacity[location], `${actor.name}: ${item.name} exceeds ${location}`);
      for (let slot = slotStart; slot < slotStart + slots; slot += 1) {
        const key = `${location}:${slot}`;
        assert.ok(!occupied.has(key), `${actor.name}: ${item.name} collides at ${key}`);
        occupied.add(key);
      }
    }
  }
});
