import {
  AmmoDataModel,
  EquipmentDataModel,
  MechDataModel,
  WeaponDataModel
} from "../module/data-models.js";
import {
  addTerrainProfiles,
  calculateTerrainProfile,
  calculateMovementPlan,
  combineMovementSections,
  MOVEMENT_MODES,
  movementAllowance,
  REGION_TERRAINS,
  summarizeRegionTerrainPath,
  targetMovementModifier
} from "../module/movement.js";

const SYSTEM_ID = "battletech-foundry-system";
const SYSTEM_VERSION = "0.3.3-alpha.0";
const TARGET_FOUNDRY = "14.364";
const pendingTokenMovementPlans = new Map();
const terrainInputFields = [
  "roughHexes",
  "lightWoodsHexes",
  "heavyWoodsHexes",
  "rubbleHexes",
  "waterDepth1Hexes",
  "waterDepth2Hexes",
  "waterDepth3PlusHexes",
  "levelChanges",
  "facingChanges"
];

const { ActorSheetV2, ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { DocumentSheetConfig } = foundry.applications.apps;

class BMFSMechSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["bmfs", "bmfs-mech-sheet", "bmfs-sheet-form"],
    position: { width: 820, height: 760 },
    window: { resizable: true },
    form: {
      handler: BMFSMechSheet.onSubmitForm,
      closeOnSubmit: false,
      submitOnChange: true
    },
    actions: {
      applyMovement: BMFSMechSheet.onApplyMovement,
      resetMovement: BMFSMechSheet.onResetMovement,
      testRoll: BMFSMechSheet.onTestRoll,
      resetHeat: BMFSMechSheet.onResetHeat,
      editItem: BMFSMechSheet.onEditItem,
      deleteItem: BMFSMechSheet.onDeleteItem
    }
  };

  static PARTS = {
    main: {
      template: `systems/${SYSTEM_ID}/templates/mech-sheet.html`
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const movement = this.actor.system.movement;
    const availableMovement = movementAllowance(movement.mode, movement);
    return {
      ...context,
      actor: this.actor,
      system: this.actor.system,
      weapons: this.actor.items.filter(item => item.type === "weapon"),
      equipment: this.actor.items.filter(item => item.type === "equipment"),
      ammo: this.actor.items.filter(item => item.type === "ammo"),
      movementModes: MOVEMENT_MODES,
      availableMovement,
      bmfsVersion: SYSTEM_VERSION
    };
  }

  static async onSubmitForm(event, form, formData) {
    const submitData = this._prepareSubmitData(event, form, formData);
    await this._processSubmitData(event, form, submitData);
  }

  static async onTestRoll(event, target) {
    event.preventDefault();
    const roll = await new Roll("2d6").evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `${this.actor.name} Test 2D6 Roll`
    });
  }

  static async onResetHeat(event, target) {
    event.preventDefault();
    await this.actor.update({
      "system.heat.current": 0,
      "system.heat.overflow": 0,
      "system.heat.shutdown": false
    });
  }

  static async onApplyMovement(event, target) {
    event.preventDefault();
    const actor = this.actor;
    const movement = actor.system.movement;
    const form = target.closest("form") ?? this.element;
    const fieldValue = (name, fallback) =>
      form?.querySelector(`[name="${name}"]`)?.value ?? fallback;
    const mode = fieldValue("system.movement.mode", movement.mode);
    const hexesMoved = fieldValue("system.movement.hexesMoved", movement.hexesMoved);
    const mpSpent = fieldValue("system.movement.mpSpent", movement.mpSpent);
    const ratings = {
      walk: fieldValue("system.movement.walk", movement.walk),
      run: fieldValue("system.movement.run", movement.run),
      jump: fieldValue("system.movement.jump", movement.jump)
    };
    const terrain = Object.fromEntries(terrainInputFields.map(field => [
      field,
      fieldValue(`system.movement.terrain.${field}`, movement.terrain[field])
    ]));

    if (mode !== "stand" && actor.system.status.destroyed) {
      ui.notifications.warn(`${actor.name} is destroyed and cannot move.`);
      return;
    }
    if (mode !== "stand" && actor.system.heat.shutdown) {
      ui.notifications.warn(`${actor.name} is shut down and cannot move.`);
      return;
    }
    if (mode !== "stand" && actor.system.status.prone) {
      ui.notifications.warn(`${actor.name} is prone. Standing-up movement will be added in the next movement build.`);
      return;
    }

    let plan;
    try {
      plan = calculateMovementPlan({
        mode,
        hexesMoved,
        mpSpent,
        ratings,
        terrain
      });
    } catch (error) {
      ui.notifications.error(error.message);
      return;
    }

    const previousMovementHeat = Number(movement.heatGenerated) || 0;
    const currentHeat = Number(actor.system.heat.current) || 0;
    const nextHeat = Math.max(0, currentHeat - previousMovementHeat + plan.heatGenerated);

    await actor.update({
      "system.movement.mode": plan.mode,
      "system.movement.hexesMoved": plan.hexesMoved,
      "system.movement.mpSpent": plan.mpSpent,
      "system.movement.attackerModifier": plan.attackerModifier,
      "system.movement.targetModifier": plan.targetModifier,
      "system.movement.heatGenerated": plan.heatGenerated,
      ...Object.fromEntries(terrainInputFields.map(field => [
        `system.movement.terrain.${field}`,
        plan.terrain[field]
      ])),
      "system.movement.terrain.terrainCost": plan.terrain.terrainCost,
      "system.movement.terrain.requiredMp": plan.requiredMp,
      "system.movement.terrain.pilotingChecks": plan.terrain.pilotingChecks,
      "system.heat.current": nextHeat
    });

    const escape = foundry.utils.escapeHTML;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<section class="bmfs-chat-card">
        <h3>${escape(actor.name)}: ${plan.modeLabel}</h3>
        <p>${plan.hexesMoved} hexes; ${plan.mpSpent} / ${plan.allowance} MP spent (${plan.terrain.terrainCost} terrain/facing MP).</p>
        <p>Attacker modifier +${plan.attackerModifier}; target modifier +${plan.targetModifier}; heat +${plan.heatGenerated}.</p>
        ${plan.terrain.pilotingChecks
          ? `<p>Piloting checks: ${plan.terrain.pilotingChecks} (${escape(plan.terrain.pilotingSummary.join(", "))}).</p>`
          : ""}
      </section>`
    });

    ui.notifications.info(`${actor.name} movement applied.`);
  }

  static async onResetMovement(event, target) {
    event.preventDefault();
    const movementHeat = Number(this.actor.system.movement.heatGenerated) || 0;
    const currentHeat = Number(this.actor.system.heat.current) || 0;
    const terrainReset = Object.fromEntries([
      "roughHexes",
      "lightWoodsHexes",
      "heavyWoodsHexes",
      "rubbleHexes",
      "waterDepth1Hexes",
      "waterDepth2Hexes",
      "waterDepth3PlusHexes",
      "levelChanges",
      "facingChanges",
      "terrainCost",
      "requiredMp",
      "pilotingChecks"
    ].map(field => [`system.movement.terrain.${field}`, 0]));
    await this.actor.update({
      "system.movement.mode": "stand",
      "system.movement.hexesMoved": 0,
      "system.movement.mpSpent": 0,
      "system.movement.attackerModifier": 0,
      "system.movement.targetModifier": 0,
      "system.movement.heatGenerated": 0,
      ...terrainReset,
      "system.heat.current": Math.max(0, currentHeat - movementHeat)
    });
    for (const token of this.actor.getActiveTokens(true, true)) {
      const document = token.document ?? token;
      await document.clearMovementHistory?.();
    }
    ui.notifications.info(`${this.actor.name} movement reset.`);
  }

  static async onEditItem(event, target) {
    event.preventDefault();
    event.stopPropagation();

    const row = target?.closest?.("[data-item-id]");
    const itemId = row?.dataset?.itemId;
    const item = itemId ? this.actor.items.get(itemId) : null;
    if (!item) {
      ui.notifications.warn("The selected embedded item could not be found.");
      return;
    }

    await item.sheet.render({ force: true });
  }

  static async onDeleteItem(event, target) {
    event.preventDefault();
    event.stopPropagation();

    const row = target?.closest?.("[data-item-id]");
    const itemId = row?.dataset?.itemId;
    const item = itemId ? this.actor.items.get(itemId) : null;
    if (!item) {
      ui.notifications.warn("The selected embedded item could not be found.");
      return;
    }

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Remove Installed Item" },
      content: `<p>Remove <strong>${foundry.utils.escapeHTML(item.name)}</strong> from <strong>${foundry.utils.escapeHTML(this.actor.name)}</strong>?</p>`,
      yes: { label: "Remove", icon: "fa-solid fa-trash" },
      no: { label: "Cancel", icon: "fa-solid fa-xmark" },
      defaultYes: false
    });

    if (!confirmed) return;

    await this.actor.deleteEmbeddedDocuments("Item", [item.id]);
    ui.notifications.info(`${item.name} removed from ${this.actor.name}.`);
    await this.render({ force: true });
  }

}

function terrainKeysForWaypoint(token, waypoint) {
  const point = token.getCenterPoint(waypoint);
  const elevatedPoint = { ...point, elevation: waypoint.elevation ?? token.elevation };
  return [...(token.parent?.regions ?? [])]
    .filter(region => region.testPoint(elevatedPoint))
    .map(region => region.getFlag(SYSTEM_ID, "terrain"))
    .filter(Boolean);
}

function tokenMovementMode(actor) {
  const mode = actor.system.movement.mode === "stand" ? "walk" : actor.system.movement.mode;
  if (!(mode in MOVEMENT_MODES)) throw new RangeError(`Unknown movement mode: ${mode}`);
  return mode;
}

function calculateTokenMovementPlan(token, movement) {
  const actor = token.actor;
  if (actor.system.status.destroyed) throw new RangeError(`${actor.name} is destroyed and cannot move.`);
  if (actor.system.heat.shutdown) throw new RangeError(`${actor.name} is shut down and cannot move.`);
  if (actor.system.status.prone) {
    throw new RangeError(`${actor.name} is prone. Standing-up movement is not implemented yet.`);
  }
  const previous = actor.system.movement;
  const mode = tokenMovementMode(actor);
  const measured = combineMovementSections(movement.passed, movement.pending);
  if (measured.spaces === 0) return null;
  const operationWaypoints = measured.waypoints.length
    ? measured.waypoints
    : [movement.origin, movement.destination];
  const completePath = token.getCompleteMovementPath(operationWaypoints);
  const movedWaypoints = completePath.slice(1).slice(-measured.spaces);
  const regionTerrain = summarizeRegionTerrainPath(
    movedWaypoints.map(waypoint => terrainKeysForWaypoint(token, waypoint))
  );
  const terrain = addTerrainProfiles(previous.terrain, regionTerrain);
  const levelChanges = movedWaypoints.reduce((total, waypoint, index) => {
    const prior = completePath[index];
    return total + Math.abs((waypoint.elevation ?? 0) - (prior.elevation ?? 0));
  }, 0);
  if (mode !== "jump" && movedWaypoints.some((waypoint, index) =>
    Math.abs((waypoint.elevation ?? 0) - (completePath[index].elevation ?? 0)) > 2
  )) throw new RangeError("Ground movement cannot change more than 2 levels in one hex.");

  terrain.levelChanges = (Number(previous.terrain.levelChanges) || 0) + (mode === "jump" ? 0 : levelChanges);
  const addedHexes = measured.spaces;
  const addedTerrain = calculateTerrainProfile(regionTerrain).terrainCost + (mode === "jump" ? 0 : levelChanges);

  return calculateMovementPlan({
    mode,
    hexesMoved: (Number(previous.hexesMoved) || 0) + addedHexes,
    mpSpent: (Number(previous.mpSpent) || 0) + addedHexes + (mode === "jump" ? 0 : addedTerrain),
    ratings: previous,
    terrain
  });
}

async function applyTokenMovementPlan(token, plan) {
  const actor = token.actor;
  const movement = actor.system.movement;
  const previousMovementHeat = Number(movement.heatGenerated) || 0;
  const currentHeat = Number(actor.system.heat.current) || 0;
  const nextHeat = Math.max(0, currentHeat - previousMovementHeat + plan.heatGenerated);

  await actor.update({
    "system.movement.mode": plan.mode,
    "system.movement.hexesMoved": plan.hexesMoved,
    "system.movement.mpSpent": plan.mpSpent,
    "system.movement.attackerModifier": plan.attackerModifier,
    "system.movement.targetModifier": plan.targetModifier,
    "system.movement.heatGenerated": plan.heatGenerated,
    ...Object.fromEntries(terrainInputFields.map(field => [
      `system.movement.terrain.${field}`,
      plan.terrain[field]
    ])),
    "system.movement.terrain.terrainCost": plan.terrain.terrainCost,
    "system.movement.terrain.requiredMp": plan.requiredMp,
    "system.movement.terrain.pilotingChecks": plan.terrain.pilotingChecks,
    "system.heat.current": nextHeat
  });

  const escape = foundry.utils.escapeHTML;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<section class="bmfs-chat-card">
      <h3>${escape(actor.name)}: Token Movement Recorded</h3>
      <p>${plan.hexesMoved} total hexes; ${plan.mpSpent} / ${plan.allowance} MP spent.</p>
      <p>Terrain/facing MP +${plan.terrain.terrainCost}; attacker +${plan.attackerModifier}; target +${plan.targetModifier}; heat +${plan.heatGenerated}.</p>
      ${plan.terrain.pilotingChecks
        ? `<p>Piloting checks: ${plan.terrain.pilotingChecks} (${escape(plan.terrain.pilotingSummary.join(", "))}).</p>`
        : ""}
    </section>`
  });
}

async function applyRegionTerrainPreset(key) {
  const preset = REGION_TERRAINS[key];
  const controlled = canvas?.regions?.controlled ?? [];
  if (!controlled.length) {
    ui.notifications.warn("Select one or more Regions before assigning BattleTech terrain.");
    return;
  }
  await Promise.all(controlled.map(region => region.document.update({
    [`flags.${SYSTEM_ID}.terrain`]: key ?? null,
    ...(preset ? { color: preset.color } : {})
  })));
  ui.notifications.info(preset
    ? `${controlled.length} Region(s) set to ${preset.label}.`
    : `BattleTech terrain cleared from ${controlled.length} Region(s).`);
}

Hooks.on("getSceneControlButtons", controls => {
  const tools = controls.regions?.tools;
  if (!tools || !game.user.isGM) return;
  let order = Math.max(0, ...Object.values(tools).map(tool => tool.order ?? 0)) + 1;
  for (const [key, preset] of Object.entries(REGION_TERRAINS)) {
    tools[`bmfsTerrain${key}`] = {
      name: `bmfsTerrain${key}`,
      title: `Set BattleTech Terrain: ${preset.label}`,
      icon: key.startsWith("water") ? "fa-solid fa-water" : "fa-solid fa-mountain-sun",
      order: order++,
      button: true,
      visible: true,
      onChange: () => void applyRegionTerrainPreset(key)
    };
  }
  tools.bmfsTerrainClear = {
    name: "bmfsTerrainClear",
    title: "Clear BattleTech Terrain",
    icon: "fa-solid fa-eraser",
    order,
    button: true,
    visible: true,
    onChange: () => void applyRegionTerrainPreset(null)
  };
});

Hooks.on("preMoveToken", (token, movement) => {
  if (token.actor?.type !== "mech" || !token.isOwner) return;
  pendingTokenMovementPlans.delete(movement.id);
  try {
    const plan = calculateTokenMovementPlan(token, movement);
    if (plan) pendingTokenMovementPlans.set(movement.id, plan);
  } catch (error) {
    ui.notifications.error(error.message);
    return false;
  }
});

Hooks.on("moveToken", (token, movement, operation, user) => {
  if (!user.isSelf) return;
  const plan = pendingTokenMovementPlans.get(movement.id);
  pendingTokenMovementPlans.delete(movement.id);
  if (!plan) return;
  void applyTokenMovementPlan(token, plan).catch(error => {
    console.error("BMFS | Failed to record token movement", error);
    ui.notifications.error(`Token moved, but its BattleMech record could not be updated: ${error.message}`);
  });
});

class BMFSItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["bmfs", "bmfs-item-sheet", "bmfs-sheet-form"],
    position: { width: 560, height: 600 },
    window: { resizable: true },
    form: {
      handler: BMFSItemSheet.onSubmitForm,
      closeOnSubmit: false,
      submitOnChange: true
    }
  };

  static PARTS = {
    main: {
      template: `systems/${SYSTEM_ID}/templates/item-sheet.html`
    }
  };

  static async onSubmitForm(event, form, formData) {
    const submitData = this._prepareSubmitData(event, form, formData);
    await this._processSubmitData(event, form, submitData);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      item: this.item,
      system: this.item.system,
      isWeapon: this.item.type === "weapon",
      isEquipment: this.item.type === "equipment",
      isAmmo: this.item.type === "ammo",
      bmfsVersion: SYSTEM_VERSION
    };
  }
}

Hooks.once("init", () => {
  console.log(`BMFS | Initializing ${SYSTEM_VERSION} for Foundry ${TARGET_FOUNDRY}`);

  CONFIG.Actor.dataModels.mech = MechDataModel;
  CONFIG.Item.dataModels.weapon = WeaponDataModel;
  CONFIG.Item.dataModels.equipment = EquipmentDataModel;
  CONFIG.Item.dataModels.ammo = AmmoDataModel;

  CONFIG.Actor.trackableAttributes = {
    mech: {
      bar: [],
      value: ["heat.current", "pilot.hits"]
    }
  };

  DocumentSheetConfig.registerSheet(foundry.documents.Actor, SYSTEM_ID, BMFSMechSheet, {
    types: ["mech"],
    makeDefault: true,
    label: "BattleMech Sheet"
  });

  DocumentSheetConfig.registerSheet(foundry.documents.Item, SYSTEM_ID, BMFSItemSheet, {
    types: ["weapon", "equipment", "ammo"],
    makeDefault: true,
    label: "BattleMech Item Sheet"
  });
});

Hooks.once("ready", () => {
  const foundryVersion = game.version ?? game.release?.version ?? "unknown";
  const generation = game.release?.generation ?? "unknown";

  game.bmfs = {
    version: SYSTEM_VERSION,
    targetFoundry: TARGET_FOUNDRY,
    movementModes: MOVEMENT_MODES,
    regionTerrains: REGION_TERRAINS,
    calculateMovementPlan,
    calculateTerrainProfile,
    summarizeRegionTerrainPath,
    applyRegionTerrainPreset,
    movementAllowance,
    targetMovementModifier,
    runDiagnostics() {
      return {
        systemId: game.system.id,
        systemVersion: game.system.version,
        foundryVersion,
        generation,
        actorTypes: Object.keys(game.system.documentTypes?.Actor ?? {}),
        itemTypes: Object.keys(game.system.documentTypes?.Item ?? {}),
        actorDataModels: Object.keys(CONFIG.Actor.dataModels ?? {}),
        itemDataModels: Object.keys(CONFIG.Item.dataModels ?? {}),
        actorSheets: Object.keys(CONFIG.Actor.sheetClasses?.mech ?? {}),
        itemSheets: Object.keys(CONFIG.Item.sheetClasses?.weapon ?? {})
      };
    }
  };

  console.log("BMFS | Ready", game.bmfs.runDiagnostics());
  ui.notifications.info(`BattleMech Foundry System ${SYSTEM_VERSION} loaded.`);
});
