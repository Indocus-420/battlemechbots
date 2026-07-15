import assert from "node:assert/strict";
import test from "node:test";

import { CORE_MECHS } from "../module/content.js";
import { jb2aWeaponEffectProfile, mechPresentationProfile, playJB2AWeaponEffect, weaponEffectProfile } from "../module/effects.js";

const weapon = (name, weaponType) => ({ name, system: { weaponType } });

test("weapon visual profiles select the requested BattleMech colors and paths", () => {
  assert.match(weaponEffectProfile(weapon("Small Laser", "laser")).texture, /beam-red/);
  assert.match(weaponEffectProfile(weapon("Medium Laser", "laser")).texture, /beam-green/);
  assert.match(weaponEffectProfile(weapon("Large Laser", "laser")).texture, /beam-blue/);
  assert.equal(weaponEffectProfile(weapon("Particle Projection Cannon", "ppc")).pathType, "weave");
  assert.equal(weaponEffectProfile(weapon("LRM 10", "missile")).pathType, "arc");
  assert.match(weaponEffectProfile(weapon("Autocannon/5", "autocannon")).texture, /tracer/);
});

test("JB2A mappings use paths present in the free Sequencer database", () => {
  assert.equal(jb2aWeaponEffectProfile(weapon("Small Laser", "laser")).projectile, "jb2a.lasershot.red");
  assert.equal(jb2aWeaponEffectProfile(weapon("Medium Laser", "laser")).projectile, "jb2a.lasershot.green");
  assert.equal(jb2aWeaponEffectProfile(weapon("Large Laser", "laser")).projectile, "jb2a.lasershot.blue");
  assert.equal(jb2aWeaponEffectProfile(weapon("PPC", "ppc")).projectile, "jb2a.lightning_bolt.narrow.blue");
  assert.equal(jb2aWeaponEffectProfile(weapon("LRM 10", "missile")).projectile, "jb2a.magic_missile.purple");
  assert.equal(jb2aWeaponEffectProfile(weapon("Autocannon/10", "autocannon")).projectile, "jb2a.bullet.01.orange");
});

test("JB2A integration plays through Sequencer when both optional modules are active", async () => {
  const calls = [];
  class FakeSequence {
    effect() { calls.push("effect"); return this; }
    file(value) { calls.push(value); return this; }
    atLocation() { return this; }
    stretchTo() { return this; }
    async play() { calls.push("play"); }
  }
  globalThis.game = { modules: new Map([["sequencer", { active: true }], ["JB2A_DnD5e", { active: true }]]) };
  globalThis.Sequence = FakeSequence;
  globalThis.Sequencer = { Database: { getEntry: () => ["asset.webm"] } };
  assert.equal(await playJB2AWeaponEffect({}, {}, weapon("Autocannon/10", "autocannon"), { hit: true }), true);
  assert.ok(calls.includes("jb2a.bullet.01.orange"));
  assert.ok(calls.includes("jb2a.explosion.01.orange"));
  assert.ok(calls.includes("play"));
  delete globalThis.game;
  delete globalThis.Sequence;
  delete globalThis.Sequencer;
});

test("the 20 BattleMechs expose distinct activation media profiles", () => {
  const profiles = CORE_MECHS.map(mechPresentationProfile);
  assert.equal(new Set(profiles.map(profile => profile.image)).size, 20);
  assert.equal(new Set(profiles.map(profile => profile.sound)).size, 20);
  assert.ok(profiles.every(profile => ["light", "medium", "heavy", "assault"].includes(profile.weightClass)));
});

test("effect profiles use only packaged system assets", () => {
  for (const sample of [
    weapon("Small Laser", "laser"),
    weapon("Medium Laser", "laser"),
    weapon("Large Laser", "laser"),
    weapon("PPC", "ppc"),
    weapon("SRM 6", "missile"),
    weapon("Autocannon/20", "autocannon")
  ]) {
    const profile = weaponEffectProfile(sample);
    assert.ok(profile.texture.startsWith("systems/battletech-foundry-system/assets/vfx/"));
    assert.ok(profile.impact.startsWith("systems/battletech-foundry-system/assets/vfx/"));
  }
});
