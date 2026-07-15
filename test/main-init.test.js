import assert from "node:assert/strict";
import test from "node:test";

class Field { constructor(options = {}) { this.options = options; } }
class SchemaField extends Field { constructor(schema, options = {}) { super(options); this.schema = schema; } }
class ArrayField extends Field { constructor(element, options = {}) { super(options); this.element = element; } }
class TypeDataModel { static migrateData(source) { return source; } static validateJoint() {} }
class BaseSheet {}
const createdCompendiumDocuments = new Map();
class MockCompendiumDocument {
  static async createDocuments(documents, { pack }) {
    const existing = createdCompendiumDocuments.get(pack) ?? [];
    existing.push(...documents.map((document, index) => ({ ...document, _id: `${pack}-${existing.length + index}` })));
    createdCompendiumDocuments.set(pack, existing);
    return documents;
  }
  static async updateDocuments() { return []; }
  static async deleteDocuments(ids, { pack }) {
    const existing = createdCompendiumDocuments.get(pack) ?? [];
    createdCompendiumDocuments.set(pack, existing.filter(document => !ids.includes(document._id)));
    return ids;
  }
}
class MockCompendiumCollection {
  static async createCompendium(metadata) {
    const collection = `world.${metadata.name}`;
    const pack = {
      collection,
      metadata: { ...metadata },
      documentClass: MockCompendiumDocument,
      configure: async changes => Object.assign(pack.metadata, changes),
      getIndex: async () => (createdCompendiumDocuments.get(collection) ?? []).map((document, index) => ({
        _id: document._id ?? `${collection}-${index}`,
        name: document.name
      }))
    };
    game.packs.set(collection, pack);
    return pack;
  }
}

const onceHooks = new Map();
const onHooks = new Map();
globalThis.Hooks = {
  once: (name, callback) => onceHooks.set(name, callback),
  on: (name, callback) => onHooks.set(name, callback)
};
const registrations = [];
const settings = new Map();
globalThis.foundry = {
  data: { fields: { ArrayField, BooleanField: Field, NumberField: Field, SchemaField, StringField: Field } },
  abstract: { TypeDataModel },
  applications: {
    sheets: { ActorSheetV2: BaseSheet, ItemSheetV2: BaseSheet },
    api: { HandlebarsApplicationMixin: Base => Base },
    apps: { DocumentSheetConfig: { registerSheet: (...args) => registrations.push(args) } }
  },
  documents: { Actor: class {}, Item: class {}, collections: { CompendiumCollection: MockCompendiumCollection } },
  canvas: { vfx: { VFXEffect: class {} } },
  utils: { deepClone: structuredClone, escapeHTML: String }
};
globalThis.CONFIG = {
  Actor: { dataModels: {}, sheetClasses: { mech: {}, vehicle: {} } },
  Item: { dataModels: {}, sheetClasses: { weapon: {} } },
  Canvas: { vfx: { enabled: false } }
};
globalThis.game = {
  version: "14.364",
  release: { version: "14.364", generation: 14 },
  system: {
    id: "battletech-foundry-system",
    version: "0.10.0-alpha.0",
    documentTypes: { Actor: { mech: {}, vehicle: {} }, Item: { weapon: {}, equipment: {}, ammo: {} } }
  },
  user: { isGM: false },
  packs: new Map(),
  settings: {
    register: (namespace, key, data) => settings.set(`${namespace}.${key}`, data),
    get: () => "0.10.0-alpha.0"
  }
};
globalThis.ui = { notifications: { info: () => {}, error: () => {}, warn: () => {} } };

await import("../scripts/main.js");

test("system entrypoint registers init, ready, and movement hooks", () => {
  assert.ok(onceHooks.has("init"));
  assert.ok(onceHooks.has("ready"));
  for (const hook of ["getSceneControlButtons", "preMoveToken", "moveToken"]) assert.ok(onHooks.has(hook));
});

test("init registers all data models, sheets, settings, and VFX opt-in", () => {
  onceHooks.get("init")();
  assert.deepEqual(Object.keys(CONFIG.Actor.dataModels).sort(), ["mech", "vehicle"]);
  assert.deepEqual(Object.keys(CONFIG.Item.dataModels).sort(), ["ammo", "equipment", "weapon"]);
  assert.equal(registrations.length, 3);
  assert.equal(CONFIG.Canvas.vfx.enabled, true);
  for (const key of ["coreContentVersion", "weaponEffects", "weaponAudio", "mechActivationEffects", "mechActivationAudio", "jb2aEffects", "tokenActionHud"]) {
    assert.ok(settings.has(`battletech-foundry-system.${key}`));
  }
});

test("ready exposes diagnostics and the public BMFS API without installing content for a player", () => {
  onceHooks.get("ready")();
  assert.equal(game.bmfs.version, "0.10.0-alpha.0");
  assert.equal(game.bmfs.runDiagnostics().generation, 14);
  assert.equal(typeof game.bmfs.installCoreCompendiums, "function");
  assert.equal(typeof game.bmfs.playWeaponEffect, "function");
  assert.equal(typeof game.bmfs.startBattleTechTurn, "function");
  assert.equal(typeof game.bmfs.recordControlledBattleTechSelections, "function");
  assert.equal(typeof game.bmfs.advanceBattleTechPhase, "function");
  assert.equal(typeof game.bmfs.calculatePhysicalAttack, "function");
  assert.equal(typeof game.bmfs.calculateTokenPhysicalAttacks, "function");
  assert.equal(typeof game.bmfs.physicalHitLocation, "function");
  assert.equal(typeof game.bmfs.resolveMissileCluster, "function");
  assert.equal(typeof game.bmfs.selectAmmunitionBin, "function");
  assert.equal(typeof game.bmfs.pilotingCheckProfile, "function");
  assert.equal(typeof game.bmfs.fallDamage, "function");
  assert.equal(typeof game.bmfs.rollBattleTechD6, "function");
  assert.equal(typeof game.bmfs.editActorTokenImage, "function");
  assert.equal(typeof game.bmfs.tokenActionHudModel, "function");
});

test("D6 scene controls remain available to non-GM players", () => {
  game.user.isGM = false;
  const controls = { tokens: { tools: {} }, regions: { tools: {} } };
  onHooks.get("getSceneControlButtons")(controls);
  assert.deepEqual(Object.keys(controls.tokens.tools), ["bmfsRoll1D6", "bmfsRoll2D6"]);
});

test("token controls expose the BattleTech turn-sequence actions to a Gamemaster", () => {
  game.user.isGM = true;
  const controls = { tokens: { tools: {} }, regions: { tools: {} } };
  onHooks.get("getSceneControlButtons")(controls);
  assert.deepEqual(Object.keys(controls.tokens.tools), ["bmfsRoll1D6", "bmfsRoll2D6", "bmfsStartTurn", "bmfsRecordSelection", "bmfsAdvancePhase"]);
});

test("turn state follows the active encounter instead of a differently viewed encounter", () => {
  game.combat = { getFlag: () => ({ source: "viewed" }) };
  game.combats = { active: { getFlag: () => ({ source: "active" }) } };
  assert.deepEqual(game.bmfs.currentTurnSequence(), { source: "active" });
});

test("core compendium installer separates five mechs into each weight-class pack", async () => {
  game.user.isGM = true;
  const result = await game.bmfs.installCoreCompendiums();
  assert.equal(result.items, 44);
  assert.equal(result.vehicles, 6);
  assert.equal(result.mechs, 20);
  assert.equal(createdCompendiumDocuments.get("world.bmfs-core-items").length, 5);
  assert.equal(createdCompendiumDocuments.get("world.bmfs-ballistic-items").length, 10);
  assert.equal(createdCompendiumDocuments.get("world.bmfs-missile-items").length, 14);
  assert.equal(createdCompendiumDocuments.get("world.bmfs-equipment-items").length, 15);
  assert.equal(createdCompendiumDocuments.get("world.bmfs-core-vehicles").length, 6);
  for (const collection of ["world.bmfs-core-mechs", "world.bmfs-medium-mechs", "world.bmfs-heavy-mechs", "world.bmfs-assault-mechs"]) {
    assert.equal(createdCompendiumDocuments.get(collection).length, 5);
  }
  createdCompendiumDocuments.get("world.bmfs-core-mechs").push({ _id: "legacy-heavy", name: "Legacy Heavy" });
  createdCompendiumDocuments.get("world.bmfs-core-items").push({ _id: "legacy-ballistic", name: "Legacy Ballistic" });
  await game.bmfs.installCoreCompendiums();
  assert.equal(createdCompendiumDocuments.get("world.bmfs-core-mechs").length, 5, "obsolete entries are pruned from migrated Light pack");
  assert.equal(createdCompendiumDocuments.get("world.bmfs-core-items").length, 5, "obsolete entries are pruned from migrated Energy pack");
  assert.equal(game.packs.get("world.bmfs-core-mechs").metadata.label, "BMFS Light BattleMechs");
  assert.equal(game.packs.get("world.bmfs-core-items").metadata.label, "BMFS Energy Weapons");
});
