const SYSTEM_ID = "battletech-foundry-system";

export const WWE2018_MAPS = Object.freeze([
  Object.freeze({ slug: "battletech", name: "BattleTech" }),
  Object.freeze({ slug: "large-lakes", name: "Large Lakes" }),
  Object.freeze({ slug: "scattered-woods", name: "Scattered Woods" }),
  Object.freeze({ slug: "dig-site", name: "Dig Site" }),
  Object.freeze({ slug: "worldwide-event-2018-combined", name: "Combined Terrain Set" })
]);

export function wwe2018ScenePath(slug) {
  if (!WWE2018_MAPS.some(map => map.slug === slug)) {
    throw new RangeError(`Unknown WWE 2018 map: ${slug}`);
  }
  return `systems/${SYSTEM_ID}/assets/maps/wwe2018/${slug}.scene.json`;
}

export async function loadWwe2018SceneData(slug, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Map-pack JSON loading is unavailable.");
  const response = await fetchImpl(wwe2018ScenePath(slug));
  if (!response?.ok) throw new Error(`Could not load the ${slug} map definition.`);
  const data = await response.json();
  if (!data?.scene || !Array.isArray(data.regions) || !Array.isArray(data.walls)) {
    throw new Error(`The ${slug} map definition is incomplete.`);
  }
  return data;
}

function existingMapScene(slug) {
  return globalThis.game?.scenes?.find?.(
    scene => scene.getFlag?.(SYSTEM_ID, "mapSlug") === slug
  ) ?? null;
}

export async function installWwe2018MapPack({
  replace = false,
  activateFirst = false,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!globalThis.game?.user?.isGM) {
    throw new Error("Only a Gamemaster can install the WWE 2018 map pack.");
  }
  if (!globalThis.Scene?.create) throw new Error("Foundry Scene creation is unavailable.");

  const installed = [];
  const skipped = [];
  for (const map of WWE2018_MAPS) {
    const existing = existingMapScene(map.slug);
    const definition = await loadWwe2018SceneData(map.slug, { fetchImpl });
    const expectedRevision = definition.scene.flags?.[SYSTEM_ID]?.layoutRevision ?? 1;
    const installedRevision = existing?.getFlag?.(SYSTEM_ID, "layoutRevision") ?? 1;
    const complete = existing
      && existing.regions?.size === definition.regions.length
      && existing.walls?.size === definition.walls.length
      && installedRevision === expectedRevision;
    if (complete && !replace) {
      skipped.push(existing);
      continue;
    }
    const replaceActiveScene = Boolean(existing?.active || globalThis.game?.scenes?.active?.id === existing?.id);
    const scene = await globalThis.Scene.create(definition.scene);
    const activateBeforeEmbeds = !globalThis.game?.scenes?.active;
    if (activateBeforeEmbeds) await scene.activate();
    await scene.createEmbeddedDocuments("Region", definition.regions);
    await scene.createEmbeddedDocuments("Wall", definition.walls);
    if (replaceActiveScene && !activateBeforeEmbeds) await scene.activate();
    if (existing) await existing.delete();
    installed.push(scene);
  }

  if (activateFirst && installed[0]) await installed[0].activate();
  globalThis.ui?.notifications?.info?.(
    `WWE 2018 map pack ready: ${installed.length} installed, ${skipped.length} already present.`
  );
  return { installed, skipped, total: WWE2018_MAPS.length };
}
