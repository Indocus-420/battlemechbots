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
    assert.equal(definition.scene.grid.alpha, 0.42);
    assert.equal(definition.scene.grid.thickness, 2);
    assert.equal(definition.scene.flags["battletech-foundry-system"].layoutRevision, 4);
    assert.ok(definition.regions.length >= 7);
    assert.ok(definition.regions.every(region => region.shapes.length > 0));
    assert.ok(definition.walls.length > 0);
    assert.ok(definition.walls.every(wall => [0, 10, 20].includes(wall.sight)));
    assert.ok(definition.walls.every(wall => [0, 10, 20].includes(wall.light)));
    assert.ok(definition.walls.every(wall => [0, 10, 20].includes(wall.sound)));
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

test("Gamemaster installer creates five scenes with embedded Regions and walls", async () => {
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
    assert.equal(result.installed.length, 5);
    assert.equal(created.length, 5);
    assert.deepEqual(created[0].embedded.map(entry => entry.type), ["Region", "Wall"]);
  } finally {
    globalThis.game = originals.game;
    globalThis.Scene = originals.Scene;
    globalThis.ui = originals.ui;
  }
});

test("active map replacement is activated before the previous scene is deleted", async () => {
  const originals = { game: globalThis.game, Scene: globalThis.Scene, ui: globalThis.ui };
  const events = [];
  const existing = {
    id: "old-map",
    active: true,
    regions: { size: 0 },
    walls: { size: 0 },
    getFlag: (_scope, key) => key === "mapSlug" ? "battletech" : 1,
    delete: async () => events.push("delete-old")
  };
  globalThis.game = {
    user: { isGM: true },
    scenes: { active: existing, find: predicate => predicate(existing) ? existing : null }
  };
  globalThis.ui = { notifications: { info: () => {} } };
  globalThis.Scene = {
    create: async () => ({
      createEmbeddedDocuments: async type => events.push(`create-${type}`),
      activate: async () => events.push("activate-new")
    })
  };
  try {
    await installWwe2018MapPack({
      replace: true,
      fetchImpl: async path => {
        const slug = path.match(/([^/]+)\.scene\.json$/)[1];
        const data = JSON.parse(
          await readFile(new URL(`../assets/maps/wwe2018/${slug}.scene.json`, import.meta.url), "utf8")
        );
        return { ok: true, json: async () => data };
      }
    });
    assert.ok(events.indexOf("activate-new") < events.indexOf("delete-old"));
    assert.ok(events.indexOf("create-Wall") < events.indexOf("activate-new"));
  } finally {
    globalThis.game = originals.game;
    globalThis.Scene = originals.Scene;
    globalThis.ui = originals.ui;
  }
});

test("combined terrain set preserves all four map datasets below the texture limit", async () => {
  const definition = JSON.parse(
    await readFile(
      new URL("../assets/maps/wwe2018/worldwide-event-2018-combined.scene.json", import.meta.url),
      "utf8"
    )
  );
  assert.equal(definition.scene.flags["battletech-foundry-system"].combinedMap, true);
  assert.equal(definition.scene.flags["battletech-foundry-system"].layoutRevision, 4);
  assert.deepEqual(Object.keys(definition.summary.sourceMaps), [
    "battletech", "large-lakes", "scattered-woods", "dig-site"
  ]);
  assert.equal(definition.summary.regionShapes, 511);
  assert.equal(definition.summary.walls, 598);
  assert.equal(definition.scene.width, 6398);
  assert.equal(definition.scene.height, 7825);
  assert.ok(definition.scene.width < 8192);
  assert.ok(definition.scene.height < 8192);
});
