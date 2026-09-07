import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { CORE_ITEMS, CORE_MECHS, CORE_VEHICLES } from "../module/content.js";

const root = path.resolve(import.meta.dirname, "..");
const packagedPath = source => path.join(root, source.replace("systems/battletech-foundry-system/", ""));

test("all mech portrait and activation-sound files are present and valid", async () => {
  const imageHashes = new Set();
  const soundHashes = new Set();
  for (const actor of CORE_MECHS) {
    const profile = actor.flags["battletech-foundry-system"].presentation;
    const image = await readFile(packagedPath(profile.image));
    const sound = await readFile(packagedPath(profile.sound));
    assert.match(image.toString("utf8"), /^<svg[\s\S]*<title[^>]*>.+<\/title>/);
    assert.equal(sound.toString("ascii", 0, 4), "RIFF");
    assert.equal(sound.toString("ascii", 8, 12), "WAVE");
    assert.equal(sound.readUInt16LE(20), 1, "PCM format");
    assert.equal(sound.readUInt16LE(22), 1, "mono channel");
    assert.equal(sound.readUInt32LE(24), 22050, "sample rate");
    assert.equal(sound.readUInt16LE(34), 16, "bit depth");
    assert.equal(sound.readUInt32LE(40), sound.length - 44, "data chunk length");
    imageHashes.add(createHash("sha256").update(image).digest("hex"));
    soundHashes.add(createHash("sha256").update(sound).digest("hex"));
  }
  assert.equal(imageHashes.size, 20);
  assert.equal(soundHashes.size, 20);
});

test("all catalog item icons and vehicle media are present, unique, and valid", async () => {
  const itemHashes = new Set();
  for (const item of CORE_ITEMS) {
    const image = await readFile(packagedPath(item.img));
    assert.match(image.toString("utf8"), /^<svg[\s\S]*<title[^>]*>.+<\/title>/);
    itemHashes.add(createHash("sha256").update(image).digest("hex"));
  }
  assert.equal(itemHashes.size, CORE_ITEMS.length);

  const vehicleImages = new Set();
  const vehicleSounds = new Set();
  for (const actor of CORE_VEHICLES) {
    const profile = actor.flags["battletech-foundry-system"].presentation;
    const image = await readFile(packagedPath(profile.image));
    const sound = await readFile(packagedPath(profile.sound));
    assert.match(image.toString("utf8"), /^<svg[\s\S]*<title[^>]*>.+<\/title>/);
    assert.equal(sound.toString("ascii", 0, 4), "RIFF");
    assert.equal(sound.toString("ascii", 8, 12), "WAVE");
    assert.equal(sound.readUInt32LE(40), sound.length - 44);
    vehicleImages.add(createHash("sha256").update(image).digest("hex"));
    vehicleSounds.add(createHash("sha256").update(sound).digest("hex"));
  }
  assert.equal(vehicleImages.size, CORE_VEHICLES.length);
  assert.equal(vehicleSounds.size, CORE_VEHICLES.length);
});
