import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  installWwe2018MapPack,
  loadWwe2018SceneData,
  WWE2018_MAPS,
  wwe2018ScenePath
} from "../module/wwe2018-map-pack.js";

test("WWE 2018 map definitions contain images, native Regions, walls, fog, and vision", async () => {
  for (const map of WWE2018_MAPS) {
    const definition = JSON.parse(
      await readFile(new URL(`../assets/maps/wwe2018/${map.slug}.scene.json`, import.meta.url), "utf8")
    );
    assert.match(definition.scene.levels[0].background.src, new RegExp(`${map.slug}\\.webp$`));
    assert.equal(definition.scene.tokenVision, true);
    assert.equal(definition.scene.fog.mode, 1);
    assert.ok(definition.regions.length >= 7);
    assert.ok(definition.regions.every(region => region.shapes.length > 0));
    assert.ok(definition.walls.length > 0);
    assert.ok(definition.walls.every(wall => [0, 1].includes(wall.sight)));
    assert.ok(definition.walls.every(wall => [0, 1].includes(wall.light)));
    assert.ok(definition.walls.every(wall => [0, 1].includes(wall.sound)));
  }
});

test("map definition loader validates the response", async () => {
  const definition = await loadWwe2018SceneData("large-lakes", {
    fetchImpl: async path => ({
      ok: path === wwe2018ScenePath("large-lakes"),
      json: async () => ({ scene: {}, regions: [], walls: [] })
    })
  });
  assert.deepEqual(definition.walls, []);
  assert.throws(() => wwe2018ScenePath("missing"), /Unknown WWE 2018 map/);
});

test("Gamemaster installer creates four scenes with embedded Regions and walls", async () => {
  const originals = {
    game: globalThis.game,
    Scene: globalThis.Scene,
    ui: globalThis.ui
  };
  const created = [];
  globalThis.game = { user: { isGM: true }, scenes: { find: () => null } };
  globalThis.ui = { notifications: { info: () => {} } };
  globalThis.Scene = {
    create: async source => {
      const scene = {
        source,
        embedded: [],
        createEmbeddedDocuments: async (type, documents) => scene.embedded.push({ type, documents }),
        activate: async () => {}
      };
      created.push(scene);
      return scene;
    }
  };
  try {
    const result = await installWwe2018MapPack({
      fetchImpl: async path => {
        const slug = path.match(/([^/]+)\.scene\.json$/)[1];
        const data = JSON.parse(
          await readFile(new URL(`../assets/maps/wwe2018/${slug}.scene.json`, import.meta.url), "utf8")
        );
        return { ok: true, json: async () => data };
      }
    });
    assert.equal(result.installed.length, 4);
    assert.equal(created.length, 4);
    assert.deepEqual(created[0].embedded.map(entry => entry.type), ["Region", "Wall"]);
  } finally {
    globalThis.game = originals.game;
    globalThis.Scene = originals.Scene;
    globalThis.ui = originals.ui;
  }
});
