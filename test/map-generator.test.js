import test from "node:test";
import assert from "node:assert/strict";
import { generatedWallSources, MAP_SIZES, normalizeMapSize, randomBattleTechMapPlan, renderBattlefieldSvg, scenicTileSources, VISUAL_PRESETS } from "../module/map-generator.js";

test("random map generator accepts each requested map size", () => {
  for (const size of MAP_SIZES) {
    const plan = randomBattleTechMapPlan({ size, seed: "same", hexSize: 50 });
    assert.equal(plan.hexes, size);
    assert.equal(plan.width, size * 50);
    assert.ok(plan.zones.length >= 12);
  }
  assert.throws(() => normalizeMapSize(30), /Map size/);
});

test("generated battlefields include native sight-blocking terrain walls", () => {
  const plan = randomBattleTechMapPlan({ size: 50, seed: "wall-test" });
  const walls = generatedWallSources(plan);
  assert.ok(walls.length > 0);
  assert.equal(walls.length % 4, 0);
  assert.ok(walls.every(wall => wall.sight === 1 && wall.move === 1 && wall.c.length === 4));
});

test("layered maps include scalable landscape presets and facility tiles", () => {
  const plan = randomBattleTechMapPlan({ size: 75, seed: "layered", environment: "desert" });
  const tiles = scenicTileSources(plan);
  assert.equal(plan.environment, "desert");
  assert.equal(tiles.length, 3);
  assert.deepEqual(tiles.map(tile => tile.name), ["Frontier Base", "Air Control Tower", "Fusion Reactor"]);
  assert.ok(tiles.every(tile => tile.texture.src.startsWith("systems/battletech-foundry-system/assets/scenery/")));
  assert.ok(Object.values(VISUAL_PRESETS).every(preset => preset.ground.startsWith("#")));
});

test("random map plans are reproducible by seed", () => {
  assert.deepEqual(
    randomBattleTechMapPlan({ size: 50, seed: "test-seed" }),
    randomBattleTechMapPlan({ size: 50, seed: "test-seed" })
  );
});

test("shared plan keeps water at ground level and terrain zones separate", () => {
  const plan = randomBattleTechMapPlan({ size: 50, seed: "aligned", prompt: "river through wooded plateaus" });
  assert.ok(plan.zones.filter(zone => zone.terrain.startsWith("water")).every(zone => zone.elevation === 0));
  for (let left = 0; left < plan.zones.length; left += 1) {
    for (let right = left + 1; right < plan.zones.length; right += 1) {
      const a = plan.zones[left];
      const b = plan.zones[right];
      assert.ok(a.column + a.width <= b.column || b.column + b.width <= a.column || a.row + a.height <= b.row || b.row + b.height <= a.row);
    }
  }
});

test("battlefield image is rendered from the same terrain plan", () => {
  const plan = randomBattleTechMapPlan({ size: 25, seed: "svg-plan", prompt: "industrial river valley" });
  const svg = renderBattlefieldSvg(plan);
  assert.match(svg, /^<svg/);
  assert.match(svg, /data-zone="bmfs-1"/);
  for (const zone of plan.zones) {
    assert.match(svg, new RegExp(`data-zone="${zone.id}"`));
    assert.match(svg, new RegExp(`data-terrain="${zone.terrain}"`));
  }
});
