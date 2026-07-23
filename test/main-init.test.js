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
const socketHandlers = new Map();
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
  version: "14.363",
  release: { version: "14.363", generation: 14 },
  system: {
    id: "battletech-foundry-system",
    version: "0.14.1-alpha.0",
    documentTypes: { Actor: { mech: {}, vehicle: {} }, Item: { weapon: {}, equipment: {}, ammo: {} } }
  },
  user: { id: "player", isGM: false },
  users: [],
  socket: {
    on: (channel, callback) => socketHandlers.set(channel, callback),
    emit: () => {}
  },
  packs: new Map(),
  settings: {
    register: (namespace, key, data) => settings.set(`${namespace}.${key}`, data),
    get: () => "0.14.1-alpha.0"
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
  for (const key of ["coreContentVersion", "weaponEffects", "weaponAudio", "mechActivationEffects", "mechActivationAudio", "jb2aEffects", "tokenActionHud", "visualDice", "diceBodyColor", "dicePipColor", "diceSize"]) {
    assert.ok(settings.has(`battletech-foundry-system.${key}`));
  }
});

test("ready exposes diagnostics and the public BMFS API without installing content for a player", () => {
  onceHooks.get("ready")();
  assert.equal(game.bmfs.version, "0.14.1-alpha.0");
  assert.equal(game.bmfs.runDiagnostics().generation, 14);
  assert.equal(typeof game.bmfs.installCoreCompendiums, "function");
  assert.equal(typeof game.bmfs.playWeaponEffect, "function");
  assert.equal(typeof game.bmfs.playMeleeEffect, "function");
  assert.equal(typeof game.bmfs.scatterAdjacentHex, "function");
  assert.equal(typeof game.bmfs.collateralTokenAtOffset, "function");
  assert.equal(typeof game.bmfs.broadcastCombatEffect, "function");
  assert.equal(typeof game.bmfs.setWeaponFireGroup, "function");
  assert.equal(typeof game.bmfs.fireWeaponGroup, "function");
  assert.equal(typeof game.bmfs.weaponAttackFailure, "function");
  assert.equal(typeof game.bmfs.activeGamemaster, "function");
  assert.equal(typeof game.bmfs.validateWeaponAttackAuthority, "function");
  assert.equal(typeof game.bmfs.validatePhysicalAttackAuthority, "function");
  assert.equal(typeof game.bmfs.requestAuthoritativeWeaponAttack, "function");
  assert.equal(typeof game.bmfs.requestAuthoritativePhysicalAttack, "function");
  assert.equal(typeof game.bmfs.performWeaponAttack, "function");
  assert.equal(typeof game.bmfs.performPhysicalAttack, "function");
  assert.equal(typeof game.bmfs.withCombatActionLock, "function");
  assert.deepEqual(game.bmfs.combatTeams, ["Team A", "Team B"]);
  assert.equal(game.bmfs.maximumTeamSize, 4);
  assert.equal(typeof game.bmfs.normalizeCombatTeam, "function");
  assert.equal(typeof game.bmfs.validateCombatTeamRosters, "function");
  assert.equal(typeof game.bmfs.combatTeamRoster, "function");
  assert.equal(typeof game.bmfs.assignControlledCombatantsToTeam, "function");
  assert.equal(typeof game.bmfs.clearControlledCombatantTeams, "function");
  assert.equal(typeof game.bmfs.showBattleTechTeamRoster, "function");
  assert.equal(typeof socketHandlers.get("system.battletech-foundry-system"), "function");
  assert.equal(typeof game.bmfs.weaponFireGroup, "function");
  assert.deepEqual(game.bmfs.fireGroups, ["1", "2", "3", "alpha"]);
  assert.equal(typeof game.bmfs.startBattleTechTurn, "function");
  assert.equal(typeof game.bmfs.recordControlledBattleTechSelections, "function");
  assert.equal(typeof game.bmfs.advanceBattleTechPhase, "function");
  assert.equal(typeof game.bmfs.calculatePhysicalAttack, "function");
  assert.equal(typeof game.bmfs.calculateTokenPhysicalAttacks, "function");
  assert.equal(typeof game.bmfs.physicalHitLocation, "function");
  assert.equal(typeof game.bmfs.resolveMissileCluster, "function");
  assert.equal(typeof game.bmfs.selectAmmunitionBin, "function");
  assert.equal(typeof game.bmfs.ammunitionUnitsPerAttack, "function");
  assert.equal(typeof game.bmfs.planAmmunitionConsumption, "function");
  assert.equal(typeof game.bmfs.migrateLegacyAmmunitionBins, "function");
  assert.equal(typeof game.bmfs.pilotingCheckProfile, "function");
  assert.equal(typeof game.bmfs.fallDamage, "function");
  assert.equal(typeof game.bmfs.rollBattleTechD6, "function");
  assert.equal(typeof game.bmfs.weaponDiceTheme, "function");
  assert.equal(typeof game.bmfs.applyWeaponDiceAppearance, "function");
  assert.equal(typeof game.bmfs.diceSoNiceAvailable, "function");
  assert.equal(typeof game.bmfs.animateBattleTechRoll, "function");
  assert.equal(typeof game.bmfs.postBattleTechRoll, "function");
  assert.equal(typeof game.bmfs.showBattleTechDiceRoll, "function");
  assert.equal(typeof game.bmfs.configureBattleTechDice, "function");
  assert.equal(typeof game.bmfs.makeTokenActionHudDraggable, "function");
  assert.equal(typeof game.bmfs.gamemasterBypassesTokenMovementRestrictions, "function");
  assert.equal(typeof game.bmfs.editActorTokenImage, "function");
  assert.equal(typeof game.bmfs.tokenActionHudModel, "function");
});

test("active Dice So Nice receives each roll directly and the chat message suppresses its automatic duplicate", async () => {
  const originalModules = game.modules;
  const originalDice3d = game.dice3d;
  const calls = [];
  let messageData;
  const roll = {
    toMessage: async data => {
      messageData = data;
      return { id: "message-1" };
    }
  };
  game.modules = new Map([["dice-so-nice", { active: true }]]);
  game.dice3d = {
    showForRoll: async (...args) => calls.push(args)
  };
  try {
    const result = await game.bmfs.postBattleTechRoll(roll, {
      flavor: "Gunnery Check",
      flags: { "battletech-foundry-system": { test: true } }
    }, "Gunnery Check");
    assert.equal(result.provider, "dice-so-nice");
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], roll);
    assert.equal(calls[0][1], game.user);
    assert.equal(calls[0][2], true);
    assert.deepEqual(messageData.flags, {
      "battletech-foundry-system": { test: true },
      "dice-so-nice": { skip: true }
    });
  } finally {
    game.modules = originalModules;
    game.dice3d = originalDice3d;
  }
});

test("a stalled Dice So Nice animation cannot block chat or authoritative combat responses", async () => {
  const originalModules = game.modules;
  const originalDice3d = game.dice3d;
  const originalSetTimeout = globalThis.setTimeout;
  let messageCreated = false;
  game.modules = new Map([["dice-so-nice", { active: true }]]);
  game.dice3d = { showForRoll: () => new Promise(() => {}) };
  globalThis.setTimeout = callback => {
    queueMicrotask(callback);
    return 1;
  };
  try {
    const result = await game.bmfs.postBattleTechRoll({
      toMessage: async () => {
        messageCreated = true;
        return { id: "message-after-timeout" };
      }
    }, { flavor: "Authoritative Attack" }, "Authoritative Attack");
    assert.equal(result.provider, "dice-so-nice");
    assert.equal(messageCreated, true);
  } finally {
    game.modules = originalModules;
    game.dice3d = originalDice3d;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("weapon attack dice use the requested Dice So Nice color scheme", () => {
  const theme = (name, weaponType, bracket = "short") => game.bmfs.weaponDiceTheme({
    name,
    system: { weaponType }
  }, bracket);

  assert.equal(theme("Small Laser", "laser").background, "#c62828");
  assert.equal(theme("Medium Laser", "laser").background, "#15803d");
  assert.equal(theme("Large Laser", "laser").background, "#1d4ed8");
  assert.equal(theme("SRM 6", "missile").background, "#facc15");
  assert.equal(theme("MRM 20", "missile").background, "#ea580c");
  assert.equal(theme("LRM 15", "missile").background, "#7c4a21");
  assert.equal(theme("Particle Projection Cannon", "ppc").background, "#2563eb");
  assert.equal(theme("Autocannon/20", "autocannon").background, "#f8fafc");
  assert.equal(theme("Future Laser", "laser", "long").background, "#1d4ed8");
  assert.equal(theme("Future Missile Rack", "missile", "medium").background, "#ea580c");
});

test("weapon dice appearance is attached to the Roll without replacing unrelated Roll options", () => {
  const roll = { options: { critical: true } };
  const selected = game.bmfs.applyWeaponDiceAppearance(roll, {
    name: "Medium Laser",
    system: { weaponType: "laser" }
  }, "short");
  assert.equal(selected.id, "laser-medium");
  assert.equal(roll.options.critical, true);
  assert.deepEqual(roll.options.appearance, {
    colorset: "custom",
    foreground: "#ffffff",
    background: "#15803d",
    outline: "#052e16",
    edge: "#4ade80"
  });
});

test("missed attacks scatter by D6 direction and identify an adjacent collateral BattleMech", () => {
  const adjacent = [
    { i: 9, j: 10 }, { i: 10, j: 11 }, { i: 11, j: 10 },
    { i: 11, j: 9 }, { i: 10, j: 9 }, { i: 9, j: 9 }
  ];
  const grid = {
    getOffset: point => point.offset ?? { i: point.x, j: point.y },
    getAdjacentOffsets: () => adjacent,
    getCenterPoint: offset => ({ x: offset.i * 100, y: offset.j * 100 })
  };
  const scatter = game.bmfs.scatterAdjacentHex({ x: 10, y: 10, elevation: 2 }, 3, grid);
  assert.deepEqual(scatter.offset, { i: 11, j: 10 });
  assert.deepEqual(scatter.point, { x: 1100, y: 1000, elevation: 2 });

  const collateral = game.bmfs.collateralTokenAtOffset(scatter.offset, {
    grid,
    exclude: ["primary"],
    tokens: [
      { id: "primary", center: { offset: scatter.offset }, actor: { type: "mech", system: { status: { destroyed: false } } } },
      { id: "collateral", center: { offset: scatter.offset }, actor: { type: "mech", system: { status: { destroyed: false } } } }
    ]
  });
  assert.equal(collateral.id, "collateral");
});

test("inactive Dice So Nice uses the built-in renderer without adding a skip flag", async () => {
  const originalModules = game.modules;
  const originalDice3d = game.dice3d;
  const originalGet = game.settings.get;
  const originalDocument = globalThis.document;
  const originalSetTimeout = globalThis.setTimeout;
  let messageData;
  const overlay = {
    className: "",
    innerHTML: "",
    style: { setProperty: () => {} },
    setAttribute: () => {},
    classList: { add: () => {} },
    remove: () => {}
  };
  game.modules = new Map([["dice-so-nice", { active: false }]]);
  game.dice3d = { showForRoll: async () => assert.fail("inactive Dice So Nice must not receive the roll") };
  game.settings.get = (_namespace, key) => ({
    visualDice: true,
    diceBodyColor: "#1c6dd0",
    dicePipColor: "#ffffff",
    diceSize: 72
  })[key];
  globalThis.document = {
    body: { append: value => assert.equal(value, overlay) },
    querySelectorAll: () => [],
    createElement: () => overlay
  };
  globalThis.setTimeout = () => 0;
  try {
    const result = await game.bmfs.postBattleTechRoll({
      dice: [{ faces: 6, results: [{ result: 4 }] }],
      total: 4,
      toMessage: async data => {
        messageData = data;
        return { id: "message-2" };
      }
    }, { flavor: "Fallback" }, "Fallback");
    assert.equal(result.provider, "built-in");
    assert.equal(messageData.flags, undefined);
    assert.match(overlay.innerHTML, /Total 4/);
  } finally {
    game.modules = originalModules;
    game.dice3d = originalDice3d;
    game.settings.get = originalGet;
    globalThis.document = originalDocument;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("Dice So Nice remains the appearance controller when active", async () => {
  const originalModules = game.modules;
  const originalDice3d = game.dice3d;
  const originalDocument = globalThis.document;
  let clicked = 0;
  game.modules = new Map([["dice-so-nice", { active: true }]]);
  game.dice3d = { showForRoll: async () => {} };
  globalThis.document = {
    querySelectorAll: () => [{
      getAttribute: key => key === "aria-label" ? "Open 3D Dice Config" : null,
      textContent: "",
      click: () => clicked++
    }]
  };
  try {
    const controller = await game.bmfs.configureBattleTechDice();
    assert.equal(controller, "dice-so-nice");
    assert.equal(clicked, 1);
  } finally {
    game.modules = originalModules;
    game.dice3d = originalDice3d;
    globalThis.document = originalDocument;
  }
});

test("dice palette activates an unrendered Dice So Nice sidebar before opening its configuration", async () => {
  const originalModules = game.modules;
  const originalDice3d = game.dice3d;
  const originalDocument = globalThis.document;
  const originalSetTimeout = globalThis.setTimeout;
  let sidebarActivated = false;
  let configOpened = 0;
  const sidebarTab = { click: () => { sidebarActivated = true; } };
  const configButton = { click: () => configOpened++ };
  game.modules = new Map([["dice-so-nice", { active: true }]]);
  game.dice3d = { showForRoll: async () => {} };
  globalThis.setTimeout = callback => { callback(); return 0; };
  globalThis.document = {
    querySelector: selector => {
      if (selector === 'button[data-action="tab"][data-tab="dice-so-nice"]') return sidebarTab;
      if (selector === 'button[data-action="openConfig"]') return sidebarActivated ? configButton : null;
      return null;
    },
    querySelectorAll: () => []
  };
  try {
    const controller = await game.bmfs.configureBattleTechDice();
    assert.equal(controller, "dice-so-nice");
    assert.equal(sidebarActivated, true);
    assert.equal(configOpened, 1);
  } finally {
    game.modules = originalModules;
    game.dice3d = originalDice3d;
    globalThis.document = originalDocument;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("built-in visual dice render D6 results using client appearance settings", () => {
  const originalGet = game.settings.get;
  const originalDocument = globalThis.document;
  const originalSetTimeout = globalThis.setTimeout;
  const style = new Map();
  const attributes = new Map();
  const overlay = {
    className: "",
    innerHTML: "",
    style: { setProperty: (key, value) => style.set(key, value) },
    setAttribute: (key, value) => attributes.set(key, value),
    classList: { add: () => {} },
    remove: () => {}
  };
  game.settings.get = (_namespace, key) => ({
    visualDice: true,
    diceBodyColor: "#123456",
    dicePipColor: "#fedcba",
    diceSize: 84
  })[key];
  globalThis.document = {
    body: { append: value => assert.equal(value, overlay) },
    querySelectorAll: () => [],
    createElement: () => overlay
  };
  globalThis.setTimeout = () => 0;
  try {
    const rendered = game.bmfs.showBattleTechDiceRoll({
      dice: [{ faces: 6, results: [{ result: 2 }, { result: 5 }] }],
      total: 7
    }, "Piloting Check");
    assert.equal(rendered, overlay);
    assert.equal(style.get("--bmfs-die-body"), "#123456");
    assert.equal(style.get("--bmfs-die-pips"), "#fedcba");
    assert.equal(style.get("--bmfs-die-size"), "84px");
    assert.equal(attributes.get("aria-label"), "Piloting Check: 2, 5");
    assert.match(overlay.innerHTML, /Total 7/);
  } finally {
    game.settings.get = originalGet;
    globalThis.document = originalDocument;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("dice customization persists Foundry FormDataExtended values and displays a preview", async () => {
  const originalGet = game.settings.get;
  const originalSet = game.settings.set;
  const originalDialogV2 = foundry.applications.api.DialogV2;
  const originalDocument = globalThis.document;
  const originalSetTimeout = globalThis.setTimeout;
  const values = new Map([
    ["visualDice", true],
    ["diceBodyColor", "#1c6dd0"],
    ["dicePipColor", "#ffffff"],
    ["diceSize", 72]
  ]);
  const overlay = {
    className: "",
    innerHTML: "",
    style: { setProperty: () => {} },
    setAttribute: () => {},
    classList: { add: () => {} },
    remove: () => {}
  };
  game.settings.get = (_namespace, key) => values.get(key);
  game.settings.set = async (_namespace, key, value) => values.set(key, value);
  foundry.applications.api.DialogV2 = {
    input: async () => ({
      get: key => ({ enabled: "on", body: "#9b1c31", pips: "#f5d76e", size: "90" })[key]
    })
  };
  globalThis.document = {
    body: { append: value => assert.equal(value, overlay) },
    querySelectorAll: () => [],
    createElement: () => overlay
  };
  globalThis.setTimeout = () => 0;
  try {
    await game.bmfs.configureBattleTechDice();
    assert.equal(values.get("visualDice"), true);
    assert.equal(values.get("diceBodyColor"), "#9b1c31");
    assert.equal(values.get("dicePipColor"), "#f5d76e");
    assert.equal(values.get("diceSize"), 90);
    assert.match(overlay.innerHTML, /Dice Preview/);
  } finally {
    game.settings.get = originalGet;
    game.settings.set = originalSet;
    foundry.applications.api.DialogV2 = originalDialogV2;
    globalThis.document = originalDocument;
    globalThis.setTimeout = originalSetTimeout;
  }
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
  assert.deepEqual(Object.keys(controls.tokens.tools), [
    "bmfsRoll1D6", "bmfsRoll2D6",
    "bmfsTeamA", "bmfsTeamB", "bmfsTeamClear", "bmfsTeamRoster",
    "bmfsStartTurn", "bmfsRecordSelection", "bmfsAdvancePhase",
    "bmfsGatorPrevious", "bmfsGatorNext", "bmfsGatorReset"
  ]);
});

test("Gamemasters bypass BattleTech token movement restrictions", () => {
  game.user.isGM = true;
  assert.equal(game.bmfs.gamemasterBypassesTokenMovementRestrictions(), true);
  const token = {
    get actor() {
      throw new Error("GM movement must not inspect BattleTech movement state.");
    }
  };
  assert.equal(onHooks.get("preMoveToken")(token, { id: "gm-free-move" }), undefined);
  game.user.isGM = false;
  assert.equal(game.bmfs.gamemasterBypassesTokenMovementRestrictions(), false);
});

test("turn state follows the active encounter instead of a differently viewed encounter", () => {
  game.combat = { getFlag: () => ({ source: "viewed" }) };
  game.combats = { active: { getFlag: () => ({ source: "active" }) } };
  assert.deepEqual(game.bmfs.currentTurnSequence(), { source: "active" });
});

test("core compendium installer separates five mechs into each weight-class pack", async () => {
  game.user.isGM = true;
  const result = await game.bmfs.installCoreCompendiums();
  assert.equal(result.items, 45);
  assert.equal(result.vehicles, 6);
  assert.equal(result.mechs, 20);
  assert.equal(createdCompendiumDocuments.get("world.bmfs-core-items").length, 5);
  assert.equal(createdCompendiumDocuments.get("world.bmfs-ballistic-items").length, 10);
  assert.equal(createdCompendiumDocuments.get("world.bmfs-missile-items").length, 14);
  assert.equal(createdCompendiumDocuments.get("world.bmfs-equipment-items").length, 16);
  assert.equal(createdCompendiumDocuments.get("world.bmfs-core-vehicles").length, 6);
  for (const collection of ["world.bmfs-core-mechs", "world.bmfs-medium-mechs", "world.bmfs-heavy-mechs", "world.bmfs-assault-mechs"]) {
    assert.equal(createdCompendiumDocuments.get(collection).length, 5);
  }
  createdCompendiumDocuments.get("world.bmfs-core-mechs").push({ _id: "legacy-heavy", name: "Legacy Heavy" });
  createdCompendiumDocuments.get("world.bmfs-core-items").push({ _id: "legacy-ballistic", name: "Legacy Ballistic" });
  const lightPack = createdCompendiumDocuments.get("world.bmfs-core-mechs");
  lightPack.push({
    ...structuredClone(lightPack[0]),
    _id: "duplicate-light",
    items: [...lightPack[0].items, ...lightPack[0].items]
  });
  await game.bmfs.installCoreCompendiums();
  assert.equal(createdCompendiumDocuments.get("world.bmfs-core-mechs").length, 5, "obsolete entries are pruned from migrated Light pack");
  assert.equal(createdCompendiumDocuments.get("world.bmfs-core-items").length, 5, "obsolete entries are pruned from migrated Energy pack");
  assert.equal(new Set(createdCompendiumDocuments.get("world.bmfs-core-mechs").map(actor => actor.name)).size, 5, "same-name packed Actors are replaced by one clean catalog Actor");
  for (const actor of createdCompendiumDocuments.get("world.bmfs-core-mechs")) {
    assert.equal(new Set(actor.items.map(item => `${item.type}:${item.name}:${item.system.location ?? ""}`)).size, actor.items.length, `${actor.name} has no duplicated embedded Items`);
  }
  assert.equal(game.packs.get("world.bmfs-core-mechs").metadata.label, "BMFS Light BattleMechs");
  assert.equal(game.packs.get("world.bmfs-core-items").metadata.label, "BMFS Energy Weapons");
});

test("weapon attack failures retain an exact group-fire reason without heat, ammunition, or damage", () => {
  const report = game.bmfs.weaponAttackFailure({ id: "w1", name: "AC/20" }, "No loaded AC/20 ammunition bin is available.");
  assert.deepEqual(report, {
    weaponId: "w1",
    weaponName: "AC/20",
    hit: false,
    collateral: false,
    outcome: "NOT FIRED: No loaded AC/20 ammunition bin is available.",
    failure: "No loaded AC/20 ammunition bin is available.",
    heat: 0,
    ammunitionSpent: 0,
    ammunitionRemaining: null,
    damage: 0,
    armorDamage: 0,
    structureDamage: 0
  });
});

test("GM combat authority accepts only the real connected owner and embedded weapon", () => {
  const originalCanvas = globalThis.canvas;
  globalThis.canvas = { scene: { id: "scene-1" } };
  const requester = { id: "player-3", name: "Player3", active: true };
  const attacker = {
    id: "attacker",
    name: "Player Mech",
    type: "mech",
    testUserPermission: user => user.id === "player-3"
  };
  const weapon = { id: "weapon-1", name: "Medium Laser", type: "weapon", parent: attacker };
  const attackerToken = {
    id: "attacker-token",
    actor: attacker,
    document: { parent: { id: "scene-1" } }
  };
  const target = { id: "target-token", actor: { type: "mech" } };
  try {
    assert.equal(game.bmfs.validateWeaponAttackAuthority({
      requester, attacker, attackerToken, weapon, target, sceneId: "scene-1"
    }), true);
    assert.throws(() => game.bmfs.validateWeaponAttackAuthority({
      requester: { ...requester, id: "intruder" }, attacker, attackerToken, weapon, target, sceneId: "scene-1"
    }), /does not own/);
    assert.throws(() => game.bmfs.validateWeaponAttackAuthority({
      requester, attacker, attackerToken, weapon: { ...weapon, parent: { id: "other" } }, target, sceneId: "scene-1"
    }), /does not belong/);
    assert.throws(() => game.bmfs.validateWeaponAttackAuthority({
      requester, attacker, attackerToken, weapon, target, sceneId: "other-scene"
    }), /active Scene/);
    assert.throws(() => game.bmfs.validateWeaponAttackAuthority({
      requester,
      attacker,
      attackerToken: { ...attackerToken, actor: { id: "other" } },
      weapon,
      target,
      sceneId: "scene-1"
    }), /does not represent/);
  } finally {
    globalThis.canvas = originalCanvas;
  }
});

test("physical combat authority enforces the same connected-owner and Scene boundary", () => {
  const originalCanvas = globalThis.canvas;
  globalThis.canvas = { scene: { id: "scene-1" } };
  const requester = { id: "player-3", name: "Player3", active: true };
  const attacker = {
    id: "attacker",
    name: "Player Mech",
    type: "mech",
    testUserPermission: user => user.id === "player-3"
  };
  const attackerToken = {
    id: "attacker-token",
    actor: attacker,
    document: { parent: { id: "scene-1" } }
  };
  const target = { id: "target-token", actor: { type: "mech" } };
  try {
    assert.equal(game.bmfs.validatePhysicalAttackAuthority({
      requester, attacker, attackerToken, target, sceneId: "scene-1"
    }), true);
    assert.throws(() => game.bmfs.validatePhysicalAttackAuthority({
      requester: { ...requester, active: false }, attacker, attackerToken, target, sceneId: "scene-1"
    }), /no longer connected/);
    assert.throws(() => game.bmfs.validatePhysicalAttackAuthority({
      requester, attacker, attackerToken, target: { actor: { type: "vehicle" } }, sceneId: "scene-1"
    }), /target BattleMech/);
  } finally {
    globalThis.canvas = originalCanvas;
  }
});

test("authoritative combat locks reject overlapping actions for the same attacker", async () => {
  const actor = { id: "attacker", name: "Player Mech" };
  let release;
  const first = game.bmfs.withCombatActionLock(actor, () => new Promise(resolve => {
    release = resolve;
  }));
  await assert.rejects(
    game.bmfs.withCombatActionLock(actor, async () => "second"),
    /already has a combat action/
  );
  release("first");
  assert.equal(await first, "first");
  assert.equal(await game.bmfs.withCombatActionLock(actor, async () => "third"), "third");
});
