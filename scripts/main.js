import {
  AmmoDataModel,
  EquipmentDataModel,
  MechDataModel,
  VehicleDataModel,
  WeaponDataModel
} from "../module/data-models.js";
import { CORE_ITEMS, CORE_ITEMS_BY_GROUP, CORE_MECHS, CORE_MECHS_BY_CLASS, CORE_VEHICLES } from "../module/content.js";
import { endPhaseActorState } from "../module/end-phase.js";
import {
  d6CheckOutcome,
  d6Formula,
  editActorTokenImage,
  FIRE_GROUPS,
  tokenActionHudModel,
  tokenizerIntegrationState,
  weaponFireGroup
} from "../module/integrations.js";
import { mergeItemSystemSource } from "../module/document-updates.js";
import {
  ALTERNATING_PHASES,
  beginPhase,
  createTurnSequence,
  determineInitiative,
  groupCombatantsBySide,
  nextPhase,
  recordSelections,
  requiredSelectionCount,
  TURN_PHASES
} from "../module/turn-sequence.js";
import { meleeEffectProfile, mechPresentationProfile, movementEffectProfile, playMechActivationEffect, playMeleeEffect, playMovementEffect, playWeaponEffect, weaponEffectProfile } from "../module/effects.js";
import { createRandomBattleTechScene, promptRandomBattleTechMap, randomBattleTechMapPlan } from "../module/map-generator.js";
import { playerConsoleModel, renderPlayerConsole, unitCondition, unitReadiness } from "../module/player-console.js";
import { adjustMNotes, campaignLedger, configureEconomySocket, executePurchase, requestStorePurchase, STORE_CATALOG } from "../module/economy.js";
import { aerospaceFiringArcForBearing, aerospaceTargetingArc, registerTokenizerTargetingFrames, targetingArc, TOKENIZER_TARGETING_FRAMES } from "../module/targeting.js";
import {
  addTerrainProfiles,
  calculateTerrainProfile,
  calculateMovementPlan,
  combineMovementSections,
  MOVEMENT_MODES,
  movementAllowance,
  REGION_TERRAINS,
  summarizeElevationPath,
  summarizeRegionTerrainPath,
  targetMovementModifier
} from "../module/movement.js";
import {
  calculateAttackTargetNumber,
  summarizeCombatTerrainPath,
  terrainAttackModifiers
} from "../module/combat.js";
import {
  calculatePhysicalAttack,
  physicalHitLocation
} from "../module/physical-attacks.js";
import {
  ammunitionTypeForWeapon,
  ammunitionUnitsPerAttack,
  legacyAmmunitionMigration,
  missileLauncherProfile,
  planAmmunitionConsumption,
  resolveMissileCluster,
  selectAmmunitionBin
} from "../module/missiles.js";
import {
  facingAfterFall,
  fallDamage,
  pilotingCheckProfile
} from "../module/piloting.js";
import {
  applyMechDamage,
  classifyAttackDirection,
  determineCriticalHits,
  hitLocation,
  MECH_LOCATIONS
} from "../module/damage.js";
import {
  ammunitionExplosionDamage,
  ammoExplosionAvoidTarget,
  calculateHeatPhase,
  engineHeat,
  heatEffectProfile,
  shutdownAvoidTarget
} from "../module/heat.js";
import {
  applyCriticalComponentEffect,
  buildCriticalTable,
  CRITICAL_SLOT_COUNTS,
  criticalSlotFromRolls,
  criticalTransferLocation,
  eligibleCriticalSlots,
  itemSlotNumbers,
  weaponCriticalModifier
} from "../module/criticals.js";
import {
  combatTeamRoster,
  COMBAT_TEAMS,
  MAX_TEAM_SIZE,
  normalizeCombatTeam,
  validateCombatTeamRosters
} from "../module/teams.js";

const SYSTEM_ID = "battletech-foundry-system";
const SYSTEM_VERSION = "0.12.1-alpha.0";
const ACTION_HUD_POSITION_KEY = `${SYSTEM_ID}.tokenActionHudPosition`;
const GATOR_STEPS = Object.freeze([
  ["gunnery", "Gunnery"],
  ["attackerMovement", "Attacker Movement"],
  ["targetMovement", "Target Movement"],
  ["other", "Other Modifiers"],
  ["range", "Range"]
]);
const COMBAT_EFFECT_SOCKET = `system.${SYSTEM_ID}`;
const COMBAT_ACTION_TIMEOUT = 20000;
const DICE_ANIMATION_TIMEOUT = 4000;
const pendingCombatActions = new Map();
const combatActionLocks = new Set();
const DICE_GLYPHS = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const TARGET_FOUNDRY = "14.363+";
const WEAPON_DICE_THEMES = Object.freeze({
  laserShort: { id: "laser-short", label: "Short Laser (Red)", foreground: "#ffffff", background: "#c62828", outline: "#4a0909", edge: "#ef5350" },
  laserMedium: { id: "laser-medium", label: "Medium Laser (Green)", foreground: "#ffffff", background: "#15803d", outline: "#052e16", edge: "#4ade80" },
  laserLong: { id: "laser-long", label: "Long Laser (Blue)", foreground: "#ffffff", background: "#1d4ed8", outline: "#0f172a", edge: "#60a5fa" },
  missileShort: { id: "missile-short", label: "Short-Range Missile (Yellow)", foreground: "#241a00", background: "#facc15", outline: "#713f12", edge: "#fde68a" },
  missileMedium: { id: "missile-medium", label: "Medium-Range Missile (Orange)", foreground: "#ffffff", background: "#ea580c", outline: "#431407", edge: "#fdba74" },
  missileLong: { id: "missile-long", label: "Long-Range Missile (Brown)", foreground: "#fff7d6", background: "#7c4a21", outline: "#291507", edge: "#c08457" },
  ppc: { id: "ppc", label: "PPC (Blue-White)", foreground: "#ffffff", background: "#2563eb", outline: "#dbeafe", edge: "#93c5fd" },
  ballistic: { id: "ballistic", label: "Ballistic (White)", foreground: "#111827", background: "#f8fafc", outline: "#64748b", edge: "#d1d5db" }
});
const TURN_SEQUENCE_FLAG = "turnSequence";
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
      processHeatPhase: BMFSMechSheet.onProcessHeatPhase,
      resolvePendingCriticals: BMFSMechSheet.onResolvePendingCriticals,
      rollWeaponAttack: BMFSMechSheet.onRollWeaponAttack,
      rollPhysicalAttack: BMFSMechSheet.onRollPhysicalAttack,
      editTokenImage: BMFSMechSheet.onEditTokenImage,
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
    const availableMovement = movementAllowance(
      movement.mode,
      movement,
      this.actor.system.heat.current
    );
    return {
      ...context,
      actor: this.actor,
      system: this.actor.system,
      weapons: this.actor.items.filter(item => item.type === "weapon"),
      equipment: this.actor.items.filter(item => item.type === "equipment"),
      ammo: this.actor.items.filter(item => item.type === "ammo"),
      movementModes: MOVEMENT_MODES,
      availableMovement,
      heatEffects: heatEffectProfile(this.actor.system.heat.current),
      criticalTables: MECH_LOCATIONS.map(location => ({
        location,
        label: locationLabel(location),
        rows: buildCriticalTable(this.actor.items, location).map(entry => ({
          ...entry,
          status: entry.conflict ? "Conflict" : entry.hit ? "Hit" : entry.item ? "Ready" : "Roll Again"
        }))
      })),
      criticalAssignmentWarnings: this.actor.items
        .filter(item => itemSlotNumbers(item).length !== Number(item.system.slots ?? 1))
        .map(item => `${item.name}: ${item.system.location} start ${item.system.slotStart}, count ${item.system.slots}`),
      tokenizerAvailable: tokenizerIntegrationState().active && tokenizerIntegrationState().canUpload,
      bmfsVersion: SYSTEM_VERSION
    };
  }

  static async onSubmitForm(event, form, formData) {
    const submitData = this._prepareSubmitData(event, form, formData);
    await this._processSubmitData(event, form, submitData);
  }

  static async onTestRoll(event, target) {
    event.preventDefault();
    await rollBattleTechD6({ count: 2, actor: this.actor, label: `${this.actor.name} Test 2D6 Roll` });
  }

  static async onEditTokenImage(event) {
    event.preventDefault();
    try {
      await editActorTokenImage(this.actor);
    } catch (error) {
      ui.notifications.warn(error.message);
    }
  }

  static async onResetHeat(event, target) {
    event.preventDefault();
    await this.actor.update({
      "system.heat.current": 0,
      "system.heat.overflow": 0,
      "system.heat.shutdown": false
    });
  }

  static async onProcessHeatPhase(event, target) {
    event.preventDefault();
    event.stopPropagation();

    try {
      await processActorHeatPhase(this.actor);
      ui.notifications.info(`${this.actor.name} Heat Phase resolved.`);
      await this.render({ force: true });
    } catch (error) {
      console.error("BMFS | Heat Phase failed", error);
      ui.notifications.error(error.message);
    }
  }

  static async onResolvePendingCriticals(event, target) {
    event.preventDefault();
    event.stopPropagation();
    try {
      const result = await resolveActorPendingCriticals(this.actor);
      if (!result.resolved.length && !result.transferred.length && !result.lost) {
        ui.notifications.info(`${this.actor.name} has no pending critical hits.`);
      } else {
        ui.notifications.info(`${this.actor.name} critical hits resolved.`);
      }
      await this.render({ force: true });
    } catch (error) {
      console.error("BMFS | Critical resolution failed", error);
      ui.notifications.error(error.message);
    }
  }

  static async onRollWeaponAttack(event, target) {
    event.preventDefault();
    event.stopPropagation();

    const row = target?.closest?.("[data-item-id]");
    const weapon = row?.dataset?.itemId ? this.actor.items.get(row.dataset.itemId) : null;
    if (!weapon || weapon.type !== "weapon") {
      ui.notifications.warn("The selected weapon could not be found.");
      return weaponAttackFailure(null, "The selected weapon could not be found.");
    }
    if (weapon.system.destroyed) {
      const reason = `${weapon.name} is destroyed and cannot fire.`;
      ui.notifications.warn(reason);
      return weaponAttackFailure(weapon, reason);
    }

    const targets = [...game.user.targets].filter(token => token.actor?.type === "mech");
    if (targets.length !== 1) {
      const reason = "Target exactly one BattleMech token before making a weapon attack.";
      ui.notifications.warn(reason);
      return weaponAttackFailure(weapon, reason);
    }

    try {
      const report = await requestAuthoritativeWeaponAttack(this.actor, weapon, targets[0]);
      if (report?.failure) ui.notifications.warn(report.failure);
      return report;
    } catch (error) {
      ui.notifications.error(error.message);
      return weaponAttackFailure(weapon, error.message);
    }
  }

  static async onRollPhysicalAttack(event, target) {
    event.preventDefault();
    event.stopPropagation();

    const type = target?.dataset?.physicalType;
    const limb = target?.dataset?.physicalLimb || null;
    const targets = [...game.user.targets].filter(token => token.actor?.type === "mech");
    if (targets.length !== 1) {
      ui.notifications.warn("Target exactly one BattleMech token before making a physical attack.");
      return;
    }

    try {
      const combat = activeBattleTechCombat();
      const sequence = combat.getFlag(SYSTEM_ID, TURN_SEQUENCE_FLAG);
      if (sequence?.phase !== "physicalAttack") {
        throw new RangeError("Physical attacks may only be resolved during the Physical Attack Phase.");
      }
      if (this.actor.getFlag(SYSTEM_ID, "physicalAttackDeclared")) {
        throw new RangeError(`${this.actor.name} has already made its physical attack this turn.`);
      }

      const attacks = calculateTokenPhysicalAttacks(this.actor, type, targets[0], limb);
      const legal = attacks.filter(attack => attack.canAttack);
      if (!legal.length) throw new RangeError(attacks[0]?.reason ?? "No legal physical attack is available.");

      const escape = foundry.utils.escapeHTML;
      const signed = value => value >= 0 ? `+${value}` : String(value);
      const preview = legal.map(attack => `<li><strong>${escape(locationLabel(attack.limb))} ${escape(attack.label)}</strong>: TN ${attack.targetNumber}, ${attack.damage} damage; ${escape(attack.locationTable)} location table.<br><small>Piloting ${attack.components.piloting}, ${signed(attack.components.attackType)} type, ${signed(attack.components.attackerMovement)} attacker movement, ${signed(attack.components.targetMovement + attack.components.targetStatus)} target, ${signed(attack.components.terrain)} terrain, ${signed(attack.components.actuator)} actuator.</small></li>`).join("");
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: `${this.actor.name}: Physical Attack Preview` },
        content: `<section class="bmfs-attack-preview"><p>Target: <strong>${escape(targets[0].actor.name)}</strong></p><ul>${preview}</ul><p>This action cannot be changed after the dice are rolled.</p></section>`,
        yes: { label: "Roll Attack", icon: "fa-solid fa-hand-fist" },
        no: { label: "Cancel", icon: "fa-solid fa-xmark" },
        defaultYes: false
      });
      if (!confirmed) return;
      await requestAuthoritativePhysicalAttack(this.actor, type, limb, targets[0]);
    } catch (error) {
      console.error("BMFS | Physical attack failed", error);
      ui.notifications.error(error.message);
    }
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
        heat: actor.system.heat.current,
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

class BMFSVehicleSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["bmfs", "bmfs-vehicle-sheet", "bmfs-sheet-form"],
    position: { width: 720, height: 680 },
    window: { resizable: true },
    form: {
      handler: BMFSVehicleSheet.onSubmitForm,
      closeOnSubmit: false,
      submitOnChange: true
    },
    actions: {
      editItem: BMFSVehicleSheet.onEditItem,
      deleteItem: BMFSVehicleSheet.onDeleteItem
    }
  };

  static PARTS = {
    main: { template: `systems/${SYSTEM_ID}/templates/vehicle-sheet.html` }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      actor: this.actor,
      system: this.actor.system,
      weapons: this.actor.items.filter(item => item.type === "weapon"),
      equipment: this.actor.items.filter(item => item.type !== "weapon"),
      bmfsVersion: SYSTEM_VERSION
    };
  }

  static async onSubmitForm(event, form, formData) {
    const submitData = this._prepareSubmitData(event, form, formData);
    await this._processSubmitData(event, form, submitData);
  }

  static async onEditItem(event, target) {
    event.preventDefault();
    const item = this.actor.items.get(target?.closest?.("[data-item-id]")?.dataset?.itemId);
    if (item) await item.sheet.render({ force: true });
  }

  static async onDeleteItem(event, target) {
    event.preventDefault();
    const item = this.actor.items.get(target?.closest?.("[data-item-id]")?.dataset?.itemId);
    if (!item) return;
    await this.actor.deleteEmbeddedDocuments("Item", [item.id]);
    await this.render({ force: true });
  }
}

function locationLabel(location) {
  return location.replace(/([A-Z])/g, " $1").replace(/^./, character => character.toUpperCase());
}

function damageDocumentUpdates(result) {
  const updates = {};
  for (const [location, armor] of Object.entries(result.armor)) {
    updates[`system.armor.${location}.front`] = armor.front;
    if ("rear" in armor) updates[`system.armor.${location}.rear`] = armor.rear;
  }
  for (const [location, structure] of Object.entries(result.structure)) {
    updates[`system.structure.${location}.value`] = structure.value;
  }
  return updates;
}

function destroyLocationInResult(result, location) {
  result.structure[location].value = 0;
  result.armor[location].front = 0;
  if ("rear" in result.armor[location]) result.armor[location].rear = 0;
  if (!result.destroyedLocations.includes(location)) result.destroyedLocations.push(location);
  if (location === "head" || location === "centerTorso") result.mechDestroyed = true;
}

async function destroyItemsInLocations(actor, locations = []) {
  const destroyed = new Set(locations);
  const items = actor.items.filter(item => destroyed.has(item.system.location) && !item.system.destroyed);
  for (const item of items) await updateEmbeddedItemSystem(item, { destroyed: true });
  return items.map(item => item.name);
}

async function updateEmbeddedItemSystem(item, changes) {
  const source = item.toObject().system;
  return item.update({ system: mergeItemSystemSource(source, changes) });
}

function destroyedLocationActorUpdates(actor, result) {
  const destroyedLegs = ["leftLeg", "rightLeg"]
    .filter(location => result.destroyedLocations.includes(location)).length;
  if (!destroyedLegs) return {};
  return {
    "system.status.prone": true,
    "system.movement.walk": destroyedLegs >= 2 ? 0 : Math.min(1, Number(actor.system.movement.walk) || 0),
    "system.movement.run": 0
  };
}

async function resolveCriticalTriggers(actor, damageResult, triggerLocations = []) {
  const pending = Object.fromEntries(MECH_LOCATIONS.map(location => [
    location,
    Number(actor.system.criticals.pending[location]) || 0
  ]));
  const results = [];

  for (const location of triggerLocations) {
    const roll = await new Roll("2d6").evaluate();
    const critical = determineCriticalHits(roll.total, location);
    if (critical.blownOff) destroyLocationInResult(damageResult, location);
    else pending[location] += critical.hits;
    results.push({ location, ...critical });
  }

  return { pending, results };
}

async function rollCriticalSlot(shadowItems, location) {
  const eligible = eligibleCriticalSlots(shadowItems, location);
  if (!eligible.length) return null;
  const eligibleNumbers = new Set(eligible.map(entry => entry.slot));

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const first = await new Roll("1d6").evaluate();
    const second = CRITICAL_SLOT_COUNTS[location] === 12
      ? await new Roll("1d6").evaluate()
      : null;
    const slot = criticalSlotFromRolls(location, first.total, second?.total ?? null);
    if (!eligibleNumbers.has(slot)) continue;
    return {
      slot,
      rolls: second ? [first.total, second.total] : [first.total],
      entry: buildCriticalTable(shadowItems, location)[slot - 1]
    };
  }
  throw new Error(`Could not roll an applicable critical slot in ${location}.`);
}

async function resolveAmmoCriticalExplosion(actor, item) {
  const shots = Number(item.system.shots) || 0;
  const damage = ammunitionExplosionDamage(shots, item.system.damagePerShot);
  await updateEmbeddedItemSystem(item, { shots: 0, destroyed: true });
  if (!damage) return { name: item.name, damage: 0, location: item.system.location };

  const result = applyMechDamage(actor.system, item.system.location, damage, { internalOnly: true });
  const criticals = await resolveCriticalTriggers(actor, result, result.criticalLocations);
  await actor.update({
    ...damageDocumentUpdates(result),
    ...destroyedLocationActorUpdates(actor, result),
    ...Object.fromEntries(MECH_LOCATIONS.map(location => [
      `system.criticals.pending.${location}`,
      criticals.pending[location]
    ])),
    "system.pilot.hits": Math.min(6, (Number(actor.system.pilot.hits) || 0) + 2),
    "system.status.destroyed": actor.system.status.destroyed || result.mechDestroyed
  });
  await destroyItemsInLocations(actor, result.destroyedLocations);
  return { name: item.name, damage, location: item.system.location };
}

async function resolveActorPendingCriticals(actor) {
  const shadowItems = actor.items.map(item => ({
    id: item.id,
    name: item.name,
    type: item.type,
    document: item,
    system: foundry.utils.deepClone(item.system)
  }));
  const pending = Object.fromEntries(MECH_LOCATIONS.map(location => [
    location,
    Number(actor.system.criticals.pending[location]) || 0
  ]));
  const state = {
    criticals: {
      engineHits: Number(actor.system.criticals.engineHits) || 0,
      gyroHits: Number(actor.system.criticals.gyroHits) || 0,
      sensorHits: Number(actor.system.criticals.sensorHits) || 0,
      lifeSupportHits: Number(actor.system.criticals.lifeSupportHits) || 0,
      cockpitDestroyed: Boolean(actor.system.criticals.cockpitDestroyed)
    },
    movement: {
      walk: Number(actor.system.movement.walk) || 0,
      run: Number(actor.system.movement.run) || 0,
      jump: Number(actor.system.movement.jump) || 0
    },
    heat: { sinks: Number(actor.system.heat.sinks) || 0 },
    status: {
      prone: Boolean(actor.system.status.prone),
      destroyed: Boolean(actor.system.status.destroyed)
    }
  };
  const queue = MECH_LOCATIONS
    .filter(location => pending[location] > 0)
    .map(location => ({ location, hits: pending[location] }));
  for (const location of MECH_LOCATIONS) pending[location] = 0;
  const resolved = [];
  const transferred = [];
  const ammoItems = new Set();
  let lost = 0;

  while (queue.length) {
    const { location, hits } = queue.shift();
    const initialEligible = eligibleCriticalSlots(shadowItems, location);
    if (!initialEligible.length) {
      const transfer = criticalTransferLocation(location);
      if (transfer && Number(actor.system.structure[location].value) > 0) {
        queue.push({ location: transfer, hits });
        transferred.push({ from: location, to: transfer, hits });
      } else lost += hits;
      continue;
    }

    for (let index = 0; index < hits; index += 1) {
      if (!eligibleCriticalSlots(shadowItems, location).length) {
        lost += hits - index;
        break;
      }
      const selection = await rollCriticalSlot(shadowItems, location);
      const item = selection.entry.item;
      item.system.damagedSlots = [...new Set([
        ...(item.system.damagedSlots ?? []).map(Number),
        selection.slot
      ])].sort((a, b) => a - b);
      const effect = applyCriticalComponentEffect(state, item);
      if (effect.ammoExplosion) ammoItems.add(item);
      resolved.push({
        location,
        slot: selection.slot,
        rolls: selection.rolls,
        item: item.name,
        detail: effect.detail
      });
    }
  }

  await actor.update({
    ...Object.fromEntries(MECH_LOCATIONS.map(location => [
      `system.criticals.pending.${location}`,
      pending[location]
    ])),
    "system.criticals.engineHits": state.criticals.engineHits,
    "system.criticals.gyroHits": state.criticals.gyroHits,
    "system.criticals.sensorHits": state.criticals.sensorHits,
    "system.criticals.lifeSupportHits": state.criticals.lifeSupportHits,
    "system.criticals.cockpitDestroyed": state.criticals.cockpitDestroyed,
    "system.movement.walk": state.movement.walk,
    "system.movement.run": state.movement.run,
    "system.movement.jump": state.movement.jump,
    "system.heat.sinks": state.heat.sinks,
    "system.status.prone": state.status.prone,
    "system.status.destroyed": state.status.destroyed
  });
  for (const item of shadowItems) {
    await updateEmbeddedItemSystem(item.document, {
      damagedSlots: item.system.damagedSlots,
      criticalHits: item.system.criticalHits,
      destroyed: item.system.destroyed
    });
  }
  const explosions = [];
  for (const item of ammoItems) explosions.push(await resolveAmmoCriticalExplosion(actor, item.document));

  const escape = foundry.utils.escapeHTML;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<section class="bmfs-chat-card">
      <h3>${escape(actor.name)}: Critical Resolution</h3>
      ${resolved.length ? resolved.map(result => `<p>${escape(locationLabel(result.location))} slot ${result.slot} (${result.rolls.join("/")}): ${escape(result.detail)}.</p>`).join("") : "<p>No applicable critical slots were hit.</p>"}
      ${transferred.length ? `<p>Transferred: ${escape(transferred.map(result => `${result.hits} ${locationLabel(result.from)} to ${locationLabel(result.to)}`).join("; "))}.</p>` : ""}
      ${lost ? `<p>${lost} critical hit(s) were lost because no applicable slot remained.</p>` : ""}
      ${explosions.length ? `<p>Ammunition: ${escape(explosions.map(result => `${result.name} exploded for ${result.damage} internal damage`).join("; "))}.</p>` : ""}
    </section>`
  });
  return { resolved, transferred, lost, explosions };
}

async function resolveDamageGroup(targetActor, damage, direction) {
  const locationRoll = await new Roll("2d6").evaluate();
  const hit = hitLocation(locationRoll.total, direction);
  const result = applyMechDamage(targetActor.system, hit.location, damage, { rear: hit.rear });
  const triggers = [...result.criticalLocations];
  if (hit.throughArmorCritical) triggers.push(hit.location);
  const criticals = await resolveCriticalTriggers(targetActor, result, triggers);

  await targetActor.update({
    ...damageDocumentUpdates(result),
    ...destroyedLocationActorUpdates(targetActor, result),
    ...Object.fromEntries(MECH_LOCATIONS.map(location => [
      `system.criticals.pending.${location}`,
      criticals.pending[location]
    ])),
    "system.status.destroyed": targetActor.system.status.destroyed || result.mechDestroyed
  });
  await destroyItemsInLocations(targetActor, result.destroyedLocations);

  const armorDamage = result.events.reduce((sum, event) => sum + (event.armorDamage || 0), 0);
  const structureDamage = result.events.reduce((sum, event) => sum + (event.structureDamage || 0), 0);
  const criticalSummary = criticals.results.length
    ? criticals.results.map(critical => critical.blownOff
      ? `${locationLabel(critical.location)} blown off (critical roll ${critical.roll})`
      : `${locationLabel(critical.location)} critical roll ${critical.roll}: ${critical.hits} pending hit(s)`
    ).join("; ")
    : "";

  return {
    damage,
    direction,
    location: hit.location,
    locationLabel: locationLabel(hit.location),
    locationRoll: hit.roll,
    throughArmorCritical: hit.throughArmorCritical,
    armorDamage,
    structureDamage,
    destroyedLocations: result.destroyedLocations.map(locationLabel),
    criticalSummary
  };
}

async function resolveWeaponHit(attackerActor, weapon, target, damageOverride = null) {
  const source = activeSceneToken(attackerActor);
  if (!source) throw new RangeError(`${attackerActor.name} needs an active token on this scene.`);
  const targetDocument = target.document ?? target;
  const direction = classifyAttackDirection(
    tokenCenter(source),
    tokenCenter(target),
    targetDocument.rotation ?? 0
  );
  const damage = damageOverride ?? (Number(weapon.system.damage) || 0);
  return resolveDamageGroup(target.actor, damage, direction);
}

function actorPilotingProfile(actor, situationalModifier = 0) {
  const destroyedActuators = actor.items
    .filter(item => item.type === "equipment"
      && item.system.destroyed
      && ["leftLeg", "rightLeg"].includes(item.system.location))
    .map(item => item.system.criticalEffect);
  return pilotingCheckProfile({
    piloting: actor.system.pilot.piloting,
    gyroHits: actor.system.criticals.gyroHits,
    shutdown: actor.system.heat.shutdown,
    leftLegDestroyed: Number(actor.system.structure.leftLeg.value) <= 0,
    rightLegDestroyed: Number(actor.system.structure.rightLeg.value) <= 0,
    destroyedActuators,
    situationalModifier
  });
}

async function resolvePilotingSkillRoll(actor, token, { reason, situationalModifier = 0, levels = 0, water = false } = {}) {
  if (!actor || actor.system.status.destroyed) return { skipped: true, reason: "destroyed" };
  const escape = foundry.utils.escapeHTML;
  const profile = actorPilotingProfile(actor, situationalModifier);
  const roll = profile.automaticFall ? null : await new Roll("2d6").evaluate();
  const passed = !profile.automaticFall && roll.total >= profile.targetNumber;
  if (passed) {
    await postBattleTechRoll(roll, {
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<section class="bmfs-chat-card"><h3>${escape(actor.name)}: Piloting Skill Roll Passed</h3><p>${escape(reason)}; target ${profile.targetNumber}, rolled ${roll.total}.</p></section>`
    }, `${actor.name} Piloting Skill Roll`);
    return { passed: true, profile, roll: roll.total };
  }

  const facingRoll = await new Roll("1d6").evaluate();
  const facing = facingAfterFall(facingRoll.total);
  const falling = fallDamage(actor.system.mech.tonnage, levels, { water });
  const damageResults = [];
  for (const group of falling.groups) damageResults.push(await resolveDamageGroup(actor, group, facing.direction));

  const seatbeltTarget = profile.targetNumber + Math.max(0, levels - 1);
  const automaticPilotDamage = actor.system.heat.shutdown || seatbeltTarget > 12;
  const seatbeltRoll = automaticPilotDamage ? null : await new Roll("2d6").evaluate();
  const pilotInjured = automaticPilotDamage || seatbeltRoll.total < seatbeltTarget;
  await actor.update({
    "system.status.prone": true,
    "system.pilot.hits": Math.min(6, Number(actor.system.pilot.hits) + (pilotInjured ? 1 : 0))
  });

  const tokenDocument = token?.document ?? token;
  if (tokenDocument?.update) {
    const rotation = ((Number(tokenDocument.rotation) + facing.rotationDelta) % 360 + 360) % 360;
    await tokenDocument.update({ rotation });
  }

  const damageSummary = damageResults.map((result, index) =>
    `Group ${index + 1}: ${result.damage} to ${result.locationLabel} (${result.direction})`
  ).join("; ");
  const content = `<section class="bmfs-chat-card">
    <h3>${escape(actor.name)}: Fall</h3>
    <p>${escape(reason)}; ${profile.automaticFall ? "automatic fall" : `PSR target ${profile.targetNumber}, rolled ${roll.total}`}.</p>
    <p>Facing roll ${facing.roll}; ${facing.direction} damage arc. ${falling.total} falling damage: ${escape(damageSummary || "no damage")}.</p>
    <p>Seat-belt check ${automaticPilotDamage ? "automatically failed" : `target ${seatbeltTarget}, rolled ${seatbeltRoll.total}`}; pilot ${pilotInjured ? "takes 1 hit" : "is uninjured"}.</p>
  </section>`;
  if (roll) await postBattleTechRoll(roll, { speaker: ChatMessage.getSpeaker({ actor }), flavor: content }, `${actor.name} Piloting Skill Roll`);
  else await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
  return {
    passed: false,
    automaticFall: profile.automaticFall,
    profile,
    roll: roll?.total ?? null,
    facing,
    falling,
    damageResults,
    seatbeltRoll: seatbeltRoll?.total ?? null,
    pilotInjured
  };
}

async function recordFiredWeaponLocation(actor, location) {
  const previous = actor.getFlag(SYSTEM_ID, "firedLocations") ?? [];
  const locations = [...new Set([...previous, location].filter(Boolean))];
  await actor.setFlag(SYSTEM_ID, "firedLocations", locations);
  return locations;
}

function destroyedActuatorEffects(actor, location) {
  return new Set(actor.items
    .filter(item => item.type === "equipment"
      && item.system.destroyed
      && item.system.location === location)
    .map(item => item.system.criticalEffect));
}

function physicalLimbState(actor, limb) {
  const effects = destroyedActuatorEffects(actor, limb);
  const fired = (actor.getFlag(SYSTEM_ID, "firedLocations") ?? []).includes(limb);
  const locationDestroyed = Number(actor.system.structure?.[limb]?.value) <= 0;
  if (limb.endsWith("Arm")) {
    return {
      fired,
      shoulder: locationDestroyed || effects.has("shoulder"),
      upperArm: effects.has("upperArm"),
      lowerArm: effects.has("lowerArm"),
      hand: effects.has("hand")
    };
  }

  const eitherHipDestroyed = ["leftLeg", "rightLeg"]
    .some(location => destroyedActuatorEffects(actor, location).has("hip"));
  return {
    fired,
    hip: locationDestroyed || eitherHipDestroyed,
    upperLeg: effects.has("upperLeg"),
    lowerLeg: effects.has("lowerLeg"),
    foot: effects.has("foot")
  };
}

function calculateTokenPhysicalAttacks(actor, type, target, requestedLimb = null, attackerToken = null) {
  const source = attackerToken ?? activeSceneToken(actor);
  if (!source) throw new RangeError(`${actor.name} needs an active token on this scene.`);
  if (actor.system.status.destroyed) throw new RangeError(`${actor.name} is destroyed and cannot attack.`);
  if (actor.system.heat.shutdown) throw new RangeError(`${actor.name} is shut down and cannot attack.`);
  if (target.actor?.id === actor.id) throw new RangeError("A BattleMech cannot target itself.");
  if (target.actor?.system.status.destroyed) throw new RangeError(`${target.actor.name} is already destroyed.`);

  const sourceDocument = source.document ?? source;
  const targetDocument = target.document ?? target;
  const sourcePoint = tokenCenter(source);
  const targetPoint = tokenCenter(target);
  const distance = Number(canvas.grid.measurePath([sourcePoint, targetPoint]).spaces) || 0;
  const attackArc = classifyAttackDirection(targetPoint, sourcePoint, sourceDocument.rotation ?? 0);
  const impactDirection = classifyAttackDirection(sourcePoint, targetPoint, targetDocument.rotation ?? 0);
  const levelSize = Number(canvas.scene?.grid?.distance) || 1;
  const elevationDifference = Math.round(((Number(targetPoint.elevation) || 0) - (Number(sourcePoint.elevation) || 0)) / levelSize);
  const terrainSummary = summarizeCombatTerrainPath({
    targetRegionKeys: terrainKeysAtPoint(target, targetPoint),
    attackerRegionKeys: terrainKeysAtPoint(source, sourcePoint)
  });
  const terrain = terrainAttackModifiers(terrainSummary);
  if (terrain.underwaterMismatch) {
    throw new RangeError("A submerged unit cannot make a physical attack against a unit that is not submerged.");
  }

  let limbs;
  if (type === "punch") {
    if (requestedLimb) limbs = [requestedLimb];
    else if (attackArc === "left") limbs = ["leftArm"];
    else if (attackArc === "right") limbs = ["rightArm"];
    else limbs = ["leftArm", "rightArm"];
  } else {
    limbs = [requestedLimb];
  }

  return limbs.filter(Boolean).map(limb => ({
    ...calculatePhysicalAttack({
      type,
      limb,
      piloting: actor.system.pilot.piloting,
      tonnage: actor.system.mech.tonnage,
      attackerMovement: actor.system.movement.attackerModifier,
      targetMovement: target.actor.system.movement.targetModifier,
      terrainModifier: terrain.targetWoods + (type === "kick" ? 0 : terrain.partialCover),
      attackerProne: actor.system.status.prone,
      targetProne: target.actor.system.status.prone,
      targetImmobile: target.actor.system.heat.shutdown,
      distance,
      elevationDifference,
      arc: attackArc,
      limbState: physicalLimbState(actor, limb),
      underwater: terrain.attackerWaterDepth >= 2 && terrain.targetWaterDepth >= 2
    }),
    attackArc,
    direction: impactDirection,
    terrain
  }));
}

async function resolvePhysicalHit(attackerActor, target, attack) {
  const locationRoll = await new Roll(attack.locationTable === "normal" ? "2d6" : "1d6").evaluate();
  const hit = physicalHitLocation(attack.locationTable, locationRoll.total, attack.direction);
  const result = applyMechDamage(target.actor.system, hit.location, attack.damage, { rear: hit.rear });
  const triggers = [...result.criticalLocations];
  if (hit.throughArmorCritical) triggers.push(hit.location);
  const criticals = await resolveCriticalTriggers(target.actor, result, triggers);

  await target.actor.update({
    ...damageDocumentUpdates(result),
    ...destroyedLocationActorUpdates(target.actor, result),
    ...Object.fromEntries(MECH_LOCATIONS.map(location => [
      `system.criticals.pending.${location}`,
      criticals.pending[location]
    ])),
    "system.status.destroyed": target.actor.system.status.destroyed || result.mechDestroyed
  });
  await destroyItemsInLocations(target.actor, result.destroyedLocations);

  const armorDamage = result.events.reduce((sum, event) => sum + (event.armorDamage || 0), 0);
  const structureDamage = result.events.reduce((sum, event) => sum + (event.structureDamage || 0), 0);
  const criticalSummary = criticals.results.length
    ? criticals.results.map(critical => critical.blownOff
      ? `${locationLabel(critical.location)} blown off (critical roll ${critical.roll})`
      : `${locationLabel(critical.location)} critical roll ${critical.roll}: ${critical.hits} pending hit(s)`
    ).join("; ")
    : "";

  return {
    damage: attack.damage,
    direction: attack.direction,
    location: hit.location,
    locationLabel: locationLabel(hit.location),
    locationRoll: hit.roll,
    throughArmorCritical: hit.throughArmorCritical,
    armorDamage,
    structureDamage,
    destroyedLocations: result.destroyedLocations.map(locationLabel),
    criticalSummary
  };
}

function selectMostDestructiveAmmo(actor) {
  const bins = actor.items.filter(item => item.type === "ammo"
    && !item.system.destroyed
    && Number(item.system.shots) > 0);
  if (!bins.length) return null;
  const maximum = Math.max(...bins.map(item => Number(item.system.damagePerShot) || 0));
  const candidates = bins.filter(item => (Number(item.system.damagePerShot) || 0) === maximum);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

async function processActorHeatPhase(actor) {
  const ammoBin = selectMostDestructiveAmmo(actor);
  const startingHeat = Number(actor.system.heat.current) || 0;
  const hits = Number(actor.system.criticals.engineHits) || 0;
  const generatedByEngine = actor.system.heat.shutdown ? 0 : engineHeat(hits);
  const heatAfterSinks = Math.max(0, startingHeat + generatedByEngine - (Number(actor.system.heat.sinks) || 0));
  const shutdownTarget = shutdownAvoidTarget(heatAfterSinks);
  const ammoTarget = ammoBin ? ammoExplosionAvoidTarget(heatAfterSinks) : 0;
  const shutdownRoll = shutdownTarget && shutdownTarget > 0
    ? await new Roll("2d6").evaluate()
    : null;
  const ammoRoll = ammoTarget > 0 ? await new Roll("2d6").evaluate() : null;
  const phase = calculateHeatPhase({
    current: startingHeat,
    sinks: actor.system.heat.sinks,
    engineHits: hits,
    shutdown: actor.system.heat.shutdown,
    shutdownRoll: shutdownRoll?.total ?? null,
    ammoRoll: ammoRoll?.total ?? null,
    hasAmmo: Boolean(ammoBin)
  });
  const lifeSupportDamage = Number(actor.system.criticals.lifeSupportHits) > 0
    ? phase.current >= 26 ? 2 : phase.current >= 15 ? 1 : 0
    : 0;

  let ammoExplosion = null;
  let damageResult = null;
  let criticals = null;
  if (phase.ammoCheck?.exploded && ammoBin) {
    const damage = ammunitionExplosionDamage(ammoBin.system.shots, ammoBin.system.damagePerShot);
    damageResult = applyMechDamage(actor.system, ammoBin.system.location, damage, { internalOnly: true });
    criticals = await resolveCriticalTriggers(actor, damageResult, damageResult.criticalLocations);
    ammoExplosion = {
      name: ammoBin.name,
      location: ammoBin.system.location,
      damage
    };
  }

  const updates = {
    "system.heat.current": phase.current,
    "system.heat.overflow": phase.overflow,
    "system.heat.shutdown": phase.shutdown,
    "system.movement.heatGenerated": 0,
    "system.pilot.hits": Math.min(6, (Number(actor.system.pilot.hits) || 0) + lifeSupportDamage),
    "system.status.destroyed": actor.system.status.destroyed
      || hits >= 3
      || actor.system.criticals.cockpitDestroyed
      || Boolean(damageResult?.mechDestroyed)
  };
  if (damageResult) Object.assign(updates, damageDocumentUpdates(damageResult));
  if (criticals) Object.assign(updates, Object.fromEntries(MECH_LOCATIONS.map(location => [
    `system.criticals.pending.${location}`,
    criticals.pending[location]
  ])));
  await actor.update(updates);
  if (ammoExplosion) {
    await ammoBin.update({
      "system.shots": 0,
      "system.destroyed": true,
      "system.criticalHits": (Number(ammoBin.system.criticalHits) || 0) + 1
    });
  }

  const escape = foundry.utils.escapeHTML;
  const checkText = phase.shutdownCheck
    ? phase.shutdownCheck.automatic
      ? "Automatic shutdown at 30+ heat."
      : `Shutdown check ${phase.shutdownCheck.roll} vs. ${phase.shutdownCheck.target}: ${phase.shutdownCheck.success ? "passed" : "failed"}.`
    : "No shutdown check required.";
  const ammoText = phase.ammoCheck
    ? `Ammo check ${phase.ammoCheck.roll} vs. ${phase.ammoCheck.target}: ${phase.ammoCheck.success ? "passed" : "failed"}.`
    : "No ammunition check required.";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<section class="bmfs-chat-card">
      <h3>${escape(actor.name)}: Heat Phase</h3>
      <p>${phase.startingHeat} starting + ${phase.engineHeat} engine - ${phase.dissipated} sinks = ${phase.current} heat${phase.overflow ? ` (${phase.overflow} overflow)` : ""}.</p>
      <p>Effects: -${phase.effects.movementPenalty} Walking MP; +${phase.effects.weaponModifier} weapon attacks.</p>
      <p>${escape(checkText)} ${escape(ammoText)}</p>
      ${lifeSupportDamage ? `<p>Damaged life support caused ${lifeSupportDamage} pilot hit(s).</p>` : ""}
      ${ammoExplosion ? `<p>${escape(ammoExplosion.name)} exploded in ${escape(locationLabel(ammoExplosion.location))} for ${ammoExplosion.damage} internal damage.</p>` : ""}
    </section>`
  });

  return { ...phase, ammoExplosion };
}

function terrainKeysForWaypoint(token, waypoint) {
  const point = token.getCenterPoint(waypoint);
  const elevatedPoint = { ...point, elevation: waypoint.elevation ?? token.elevation };
  return [...(token.parent?.regions ?? [])]
    .filter(region => region.testPoint(elevatedPoint))
    .map(region => region.getFlag(SYSTEM_ID, "terrain"))
    .filter(Boolean);
}

function terrainKeysAtPoint(token, point) {
  const document = token.document ?? token;
  const elevatedPoint = {
    ...point,
    elevation: point.elevation ?? document.elevation ?? 0
  };
  return [...(document.parent?.regions ?? [])]
    .filter(region => region.testPoint(elevatedPoint))
    .map(region => region.getFlag(SYSTEM_ID, "terrain"))
    .filter(Boolean);
}

function activeSceneToken(actor) {
  // Do not request only actor-linked tokens here. Foundry's default synthetic
  // tokens are unlinked, but they are still valid attackers on the active scene.
  const tokens = actor.getActiveTokens();
  return tokens.find(token => token.controlled)
    ?? tokens.find(token => (token.document ?? token).parent?.id === canvas.scene?.id)
    ?? null;
}

function tokenCenter(token) {
  const center = token.center ?? token.getCenterPoint?.();
  if (!center) throw new RangeError("Token center could not be measured.");
  const document = token.document ?? token;
  return { ...center, elevation: document.elevation ?? 0 };
}

function scatterAdjacentHex(targetPoint, roll, grid = globalThis.canvas?.grid) {
  const direction = Number(roll);
  if (!Number.isInteger(direction) || direction < 1 || direction > 6) throw new RangeError("Scatter direction must be a D6 result from 1 to 6.");
  if (!grid?.getOffset || !grid?.getAdjacentOffsets || !grid?.getCenterPoint) throw new RangeError("Miss scatter requires an active gridded scene.");
  const originOffset = grid.getOffset(targetPoint);
  const adjacent = grid.getAdjacentOffsets(originOffset);
  if (!adjacent.length) throw new RangeError("No adjacent hex is available for miss scatter.");
  const offset = adjacent[(direction - 1) % adjacent.length];
  const center = grid.getCenterPoint(offset);
  return {
    roll: direction,
    direction,
    offset,
    point: { ...center, elevation: targetPoint.elevation ?? 0 }
  };
}

function collateralTokenAtOffset(offset, { exclude = [], tokens = globalThis.canvas?.tokens?.placeables ?? [], grid = globalThis.canvas?.grid } = {}) {
  const excluded = new Set(exclude.filter(Boolean));
  return [...tokens]
    .filter(token => token.actor?.type === "mech" && !token.actor.system?.status?.destroyed && !excluded.has(token.id ?? token.document?.id))
    .sort((left, right) => String(left.id ?? left.document?.id).localeCompare(String(right.id ?? right.document?.id)))
    .find(token => {
      const candidate = grid.getOffset(tokenCenter(token));
      return Number(candidate.i) === Number(offset.i) && Number(candidate.j) === Number(offset.j);
    }) ?? null;
}

async function playCombatEffectPayload(payload, { remote = false } = {}) {
  if (!globalThis.canvas?.ready || payload?.sceneId !== canvas.scene?.id) return false;
  const origin = canvas.tokens?.get?.(payload.originTokenId);
  const tokenTarget = payload.targetTokenId ? canvas.tokens?.get?.(payload.targetTokenId) : null;
  const target = tokenTarget ?? (payload.targetPoint ? { center: payload.targetPoint } : null);
  if (!origin || !target) return false;
  if (payload.kind === "movement") {
    return playMovementEffect(payload.mode, { audio: payload.audio !== false });
  }
  if (payload.kind === "melee") {
    return playMeleeEffect(origin, target, {
      type: payload.attackType,
      hit: payload.hit,
      audio: payload.audio !== false,
      audioBroadcast: false
    });
  }
  return playWeaponEffect(origin, target, payload.weapon, {
    hit: payload.hit,
    impact: payload.impact,
    audio: payload.audio !== false,
    audioBroadcast: false,
    jb2a: Boolean(game.settings.get(SYSTEM_ID, "jb2aEffects"))
  });
}

async function broadcastCombatEffect(payload) {
  const message = { ...payload, messageType: "combat-effect", sceneId: canvas.scene?.id };
  const played = await playCombatEffectPayload(message);
  game.socket?.emit?.(COMBAT_EFFECT_SOCKET, message);
  return played;
}

async function handleAuthoritativeCombatAction(payload, senderId) {
  const gm = activeGamemaster();
  if (!game.user.isGM || !gm || game.user.id !== gm.id) return;
  const response = {
    messageType: "combat-action-response",
    requestId: payload.requestId,
    recipientUserId: senderId
  };
  try {
    const requester = game.users.get(senderId);
    const attacker = game.actors.get(payload.attackerActorId);
    const attackerToken = canvas.tokens?.get?.(payload.attackerTokenId);
    const target = canvas.tokens?.get?.(payload.targetTokenId);
    if (payload.action === "weapon") {
      const weapon = attacker?.items?.get(payload.weaponId);
      validateWeaponAttackAuthority({
        requester,
        attacker,
        attackerToken,
        weapon,
        target,
        sceneId: payload.sceneId
      });
      response.result = await withCombatActionLock(attacker, () =>
        performWeaponAttack(attacker, weapon, target, attackerToken)
      );
    } else if (payload.action === "physical") {
      validatePhysicalAttackAuthority({
        requester,
        attacker,
        attackerToken,
        target,
        sceneId: payload.sceneId
      });
      response.result = await withCombatActionLock(attacker, () =>
        performPhysicalAttack(attacker, payload.attackType, payload.limb, target, attackerToken)
      );
    } else {
      throw new Error(`Unknown combat action: ${payload.action}.`);
    }
  } catch (error) {
    console.warn("BMFS | Authoritative combat action rejected", error);
    response.error = error.message;
  }
  game.socket.emit(COMBAT_EFFECT_SOCKET, response);
}

function configureCombatEffectSocket() {
  game.socket?.on?.(COMBAT_EFFECT_SOCKET, (payload, senderId) => {
    if (!payload) return;
    if (payload.messageType === "combat-action-request") {
      void handleAuthoritativeCombatAction(payload, senderId);
      return;
    }
    if (payload.messageType === "combat-action-response") {
      if (payload.recipientUserId !== game.user?.id) return;
      const pending = pendingCombatActions.get(payload.requestId);
      if (!pending || pending.gmId !== senderId) return;
      pendingCombatActions.delete(payload.requestId);
      if (payload.error) pending.reject(new Error(payload.error));
      else pending.resolve(payload.result);
      return;
    }
    if (senderId === game.user?.id) return;
    if (payload.messageType && payload.messageType !== "combat-effect") return;
    void playCombatEffectPayload(payload, { remote: true }).catch(error => console.warn("BMFS | Remote combat effect failed", error));
  });
}

function nativeWallBlocksSight(source, origin, destination) {
  const backend = CONFIG.Canvas?.polygonBackends?.sight;
  if (!backend?.testCollision) return false;

  try {
    return Boolean(backend.testCollision(origin, destination, {
      type: "sight",
      mode: "any",
      source: source.vision ?? source
    }));
  } catch (error) {
    console.warn("BMFS | Native wall sight test failed; continuing without a wall result", error);
    return false;
  }
}

function calculateTokenWeaponAttack(actor, weapon, target, attackerToken = null) {
  const source = attackerToken ?? activeSceneToken(actor);
  if (!source) throw new RangeError(`${actor.name} needs an active token on this scene.`);
  if (target.actor?.id === actor.id) throw new RangeError("A BattleMech cannot target itself.");
  if (target.actor?.system.status.destroyed) throw new RangeError(`${target.actor.name} is already destroyed.`);

  const grid = canvas.grid;
  const sourcePoint = tokenCenter(source);
  const targetPoint = tokenCenter(target);
  const measurement = grid.measurePath([sourcePoint, targetPoint]);
  const distance = Number(measurement.spaces) || 0;
  if (distance < 1) throw new RangeError("Attacker and target must occupy different hexes.");

  const directPath = grid.getDirectPath([sourcePoint, targetPoint]);
  const pathCenters = directPath.map(offset => ({
    ...grid.getCenterPoint(offset),
    elevation: targetPoint.elevation
  }));
  const terrain = summarizeCombatTerrainPath({
    interveningRegionKeys: pathCenters.slice(1, -1).map(point => terrainKeysAtPoint(source, point)),
    targetRegionKeys: terrainKeysAtPoint(target, targetPoint),
    attackerRegionKeys: terrainKeysAtPoint(source, sourcePoint)
  });
  const lineOfSightBlocked = nativeWallBlocksSight(source, sourcePoint, targetPoint);

  if (terrain.attackerWaterDepth === 1 && /leg/i.test(weapon.system.location)) {
    throw new RangeError("Leg-mounted weapons cannot fire while the attacker stands in Depth 1 water.");
  }

  return calculateAttackTargetNumber({
    gunnery: actor.system.pilot.gunnery,
    attackerMovement: actor.system.movement.attackerModifier,
    targetMovement: target.actor.system.movement.targetModifier,
    heat: actor.system.heat.current,
    distance,
    weaponRange: weapon.system.range,
    terrain,
    attackerProne: actor.system.status.prone,
    targetProne: target.actor.system.status.prone,
    targetImmobile: target.actor.system.heat.shutdown,
    sensorHits: actor.system.criticals.sensorHits,
    weaponDamageModifier: weaponCriticalModifier(actor.items, weapon.system.location),
    lineOfSightBlocked
  });
}

function tokenMovementMode(actor) {
  const mode = actor.system.movement.mode === "stand" ? "walk" : actor.system.movement.mode;
  if (!(mode in MOVEMENT_MODES)) throw new RangeError(`Unknown movement mode: ${mode}`);
  return mode;
}

function gamemasterBypassesTokenMovementRestrictions(user = game.user) {
  return Boolean(user?.isGM);
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
  const movementPath = completePath.slice(-(measured.spaces + 1));
  const movedWaypoints = movementPath.slice(1);
  const regionTerrain = summarizeRegionTerrainPath(
    movedWaypoints.map(waypoint => terrainKeysForWaypoint(token, waypoint))
  );
  const terrain = addTerrainProfiles(previous.terrain, regionTerrain);
  const elevation = summarizeElevationPath(movementPath);
  const levelChanges = elevation.levelChanges;
  if (mode !== "jump" && elevation.maximumStep > 2) {
    throw new RangeError("Ground movement cannot change more than 2 levels in one hex.");
  }

  terrain.levelChanges = (Number(previous.terrain.levelChanges) || 0) + (mode === "jump" ? 0 : levelChanges);
  const addedHexes = measured.spaces;
  const addedTerrain = calculateTerrainProfile(regionTerrain).terrainCost + (mode === "jump" ? 0 : levelChanges);

  return calculateMovementPlan({
    mode,
    hexesMoved: (Number(previous.hexesMoved) || 0) + addedHexes,
    mpSpent: (Number(previous.mpSpent) || 0) + addedHexes + (mode === "jump" ? 0 : addedTerrain),
    ratings: previous,
    heat: actor.system.heat.current,
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

async function getOrCreateWorldCompendium(name, label, type) {
  const collection = `world.${name}`;
  const existing = game.packs.get(collection);
  if (existing) {
    if (existing.metadata?.label !== label) await existing.configure({ label });
    return existing;
  }
  return foundry.documents.collections.CompendiumCollection.createCompendium({
    name,
    label,
    type,
    package: "world",
    system: SYSTEM_ID
  });
}

async function synchronizeCompendium(pack, documents, { prune = false, replaceExisting = false } = {}) {
  await pack.configure({ locked: false });
  try {
    const index = [...await pack.getIndex()];
    const expectedNames = new Set(documents.map(document => document.name));
    const entriesByName = new Map();
    for (const entry of index) {
      const entries = entriesByName.get(entry.name) ?? [];
      entries.push(entry);
      entriesByName.set(entry.name, entries);
    }
    const deleteIds = new Set();
    for (const entry of index) {
      if (prune && !expectedNames.has(entry.name)) deleteIds.add(entry._id);
    }
    for (const [name, entries] of entriesByName) {
      if (!expectedNames.has(name)) continue;
      if (replaceExisting) {
        for (const entry of entries) deleteIds.add(entry._id);
      } else {
        for (const duplicate of entries.slice(1)) deleteIds.add(duplicate._id);
      }
    }
    if (deleteIds.size) await pack.documentClass.deleteDocuments([...deleteIds], { pack: pack.collection });
    const retainedIndex = index.filter(entry => !deleteIds.has(entry._id));
    for (const source of documents) {
      const data = foundry.utils.deepClone(source);
      const existing = retainedIndex.find(entry => entry.name === data.name);
      if (existing) {
        await pack.documentClass.updateDocuments([{ ...data, _id: existing._id }], { pack: pack.collection });
      } else {
        await pack.documentClass.createDocuments([data], { pack: pack.collection });
      }
    }
  } finally {
    await pack.configure({ locked: true });
  }
  return pack;
}

async function installCoreCompendiums() {
  if (!game.user.isGM) throw new Error("Only a Gamemaster can install the core compendiums.");
  const itemPacks = {
    energy: await getOrCreateWorldCompendium("bmfs-core-items", "BMFS Energy Weapons", "Item"),
    ballistic: await getOrCreateWorldCompendium("bmfs-ballistic-items", "BMFS Ballistic Weapons and Ammunition", "Item"),
    missile: await getOrCreateWorldCompendium("bmfs-missile-items", "BMFS Missile Weapons and Ammunition", "Item"),
    equipment: await getOrCreateWorldCompendium("bmfs-equipment-items", "BMFS Equipment", "Item")
  };
  const vehiclePack = await getOrCreateWorldCompendium("bmfs-core-vehicles", "BMFS Generic Combat Vehicles", "Actor");
  const mechPacks = {
    light: await getOrCreateWorldCompendium("bmfs-core-mechs", "BMFS Light BattleMechs", "Actor"),
    medium: await getOrCreateWorldCompendium("bmfs-medium-mechs", "BMFS Medium BattleMechs", "Actor"),
    heavy: await getOrCreateWorldCompendium("bmfs-heavy-mechs", "BMFS Heavy BattleMechs", "Actor"),
    assault: await getOrCreateWorldCompendium("bmfs-assault-mechs", "BMFS Assault BattleMechs", "Actor")
  };
  for (const [group, pack] of Object.entries(itemPacks)) {
    await synchronizeCompendium(pack, CORE_ITEMS_BY_GROUP[group], { prune: true });
  }
  await synchronizeCompendium(vehiclePack, CORE_VEHICLES, { prune: true, replaceExisting: true });
  for (const [weightClass, pack] of Object.entries(mechPacks)) {
    await synchronizeCompendium(pack, CORE_MECHS_BY_CLASS[weightClass], { prune: true, replaceExisting: true });
  }
  return {
    itemPacks, vehiclePack, mechPacks,
    items: CORE_ITEMS.length, vehicles: CORE_VEHICLES.length, mechs: CORE_MECHS.length
  };
}

function eligibleCombatants(combat) {
  return [...(combat?.combatants ?? [])].filter(combatant =>
    ["mech", "vehicle"].includes(combatant.actor?.type)
    && !combatant.actor?.system?.status?.destroyed
  );
}

function activeBattleTechCombat() {
  const combat = game.combats?.active ?? game.combat;
  if (!combat) throw new RangeError("Create and activate a Combat Encounter before starting a BattleTech turn.");
  return combat;
}

async function ensureControlledCombatants(combat) {
  const controlled = (canvas?.tokens?.controlled ?? [])
    .filter(token => ["mech", "vehicle"].includes(token.actor?.type));
  if (!controlled.length) throw new RangeError("Control one or more BattleMech or vehicle tokens first.");
  const missing = controlled.filter(token =>
    !combat.getCombatantsByToken(token.document ?? token).length
  );
  if (missing.length) {
    await combat.createEmbeddedDocuments("Combatant", missing.map(token => ({
      tokenId: token.id ?? token.document?.id,
      actorId: token.actor?.id,
      sceneId: canvas.scene?.id,
      hidden: Boolean(token.document?.hidden)
    })));
  }
  return controlled.flatMap(token =>
    combat.getCombatantsByToken(token.document ?? token)
  );
}

async function assignControlledCombatantsToTeam(team) {
  if (!game.user.isGM) throw new Error("Only a Gamemaster can assign BattleTech teams.");
  const normalized = normalizeCombatTeam(team);
  const combat = activeBattleTechCombat();
  const selected = await ensureControlledCombatants(combat);
  const selectedIds = new Set(selected.map(combatant => combatant.id));
  const current = eligibleCombatants(combat);
  const existing = current.filter(combatant =>
    combatant.getFlag(SYSTEM_ID, "side") === normalized && !selectedIds.has(combatant.id)
  );
  if (existing.length + selected.length > MAX_TEAM_SIZE) {
    throw new RangeError(`${normalized} cannot contain more than ${MAX_TEAM_SIZE} units.`);
  }
  for (const combatant of selected) await combatant.setFlag(SYSTEM_ID, "side", normalized);
  const names = selected.map(combatant => combatant.name).join(", ");
  ui.notifications.info(`${names} assigned to ${normalized}.`);
  return showBattleTechTeamRoster(combat);
}

async function clearControlledCombatantTeams() {
  if (!game.user.isGM) throw new Error("Only a Gamemaster can clear BattleTech teams.");
  const combat = activeBattleTechCombat();
  const selected = await ensureControlledCombatants(combat);
  for (const combatant of selected) await combatant.unsetFlag(SYSTEM_ID, "side");
  ui.notifications.info(`Cleared BattleTech team assignments for ${selected.map(combatant => combatant.name).join(", ")}.`);
  return showBattleTechTeamRoster(combat);
}

async function showBattleTechTeamRoster(combat = activeBattleTechCombat()) {
  const { roster, unassigned } = combatTeamRoster(eligibleCombatants(combat), SYSTEM_ID);
  const escape = foundry.utils.escapeHTML;
  const content = `<section class="bmfs-team-roster">
    ${COMBAT_TEAMS.map(team => `<h3>${team} (${roster[team].length}/${MAX_TEAM_SIZE})</h3><ul>${roster[team].length
      ? roster[team].map(combatant => `<li>${escape(combatant.name)}</li>`).join("")
      : "<li>Empty</li>"}</ul>`).join("")}
    ${unassigned.length ? `<h3>Unassigned</h3><ul>${unassigned.map(combatant => `<li>${escape(combatant.name)}</li>`).join("")}</ul>` : ""}
    <p>Supported encounter sizes: 1v1 through 4v4, including 2v2, 3v3, and 4v4.</p>
  </section>`;
  await foundry.applications.api.DialogV2.prompt({
    window: { title: "BattleTech Team Rosters" },
    content,
    ok: { label: "Close", icon: "fa-solid fa-check" }
  });
  return { roster, unassigned };
}

async function rollBattleTechInitiative(sides) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const rolls = {};
    for (const side of Object.keys(sides)) rolls[side] = (await new Roll("2d6").evaluate()).total;
    const result = determineInitiative(rolls);
    if (result.winner) return rolls;
  }
  throw new Error("Initiative remained tied after 100 rerolls.");
}

function sequencePhaseLabel(phase) {
  return {
    initiative: "Initiative",
    movement: "Movement",
    weaponAttack: "Weapon Attack",
    physicalAttack: "Physical Attack",
    heat: "Heat",
    end: "End"
  }[phase] ?? phase;
}

async function postTurnSequenceCard(sequence, heading, detail = "") {
  const escape = foundry.utils.escapeHTML;
  const selection = sequence.sideToAct
    ? `${sequence.sideToAct} must select ${requiredSelectionCount(sequence)} unit(s).`
    : "No alternating selection is currently required.";
  await ChatMessage.create({
    content: `<section class="bmfs-chat-card bmfs-turn-card">
      <h3>${escape(heading)}</h3>
      <p>Round ${sequence.round}; ${escape(sequencePhaseLabel(sequence.phase))} Phase.</p>
      <p>Initiative: ${escape(Object.entries(sequence.rolls).map(([side, roll]) => `${side} ${roll}`).join("; "))}. Winner: ${escape(sequence.winner)}.</p>
      <p>${escape(selection)}</p>
      ${detail ? `<p>${escape(detail)}</p>` : ""}
    </section>`
  });
}

async function saveTurnSequence(combat, sequence) {
  await combat.setFlag(SYSTEM_ID, TURN_SEQUENCE_FLAG, sequence);
  return sequence;
}

async function startBattleTechTurn() {
  if (!game.user.isGM) throw new Error("Only a Gamemaster can start a BattleTech turn.");
  const combat = activeBattleTechCombat();
  const combatants = eligibleCombatants(combat);
  if (combatants.length < 2) throw new RangeError("The Combat Tracker needs at least two operational BattleTech units.");
  let sides;
  try {
    sides = groupCombatantsBySide(combatants, SYSTEM_ID);
    validateCombatTeamRosters(sides);
  } catch (error) {
    const assignments = combatants.map(combatant => {
      const explicit = combatant.flags?.[SYSTEM_ID]?.side?.trim?.();
      const disposition = Number(combatant.token?.disposition);
      const side = explicit || (disposition > 0 ? "Friendly" : disposition < 0 ? "Hostile" : "Unassigned");
      return `${combatant.name}: ${side}`;
    }).join("; ");
    throw new RangeError(`${error.message} Current assignments: ${assignments}. Set opposing token dispositions or flags.${SYSTEM_ID}.side before starting the turn.`);
  }
  if (!combat.started) await combat.startCombat();
  else if (combat.getFlag(SYSTEM_ID, TURN_SEQUENCE_FLAG)) await combat.nextRound();
  const actors = [...new Set(combatants.map(combatant => combatant.actor).filter(Boolean))];
  for (const actor of actors) {
    await actor.setFlag(SYSTEM_ID, "firedLocations", []);
    await actor.setFlag(SYSTEM_ID, "physicalAttackDeclared", false);
  }
  const rolls = await rollBattleTechInitiative(sides);
  const sequence = beginPhase(createTurnSequence({ round: combat.round || 1, sides, rolls }), "movement");
  await saveTurnSequence(combat, sequence);
  await postTurnSequenceCard(sequence, "BattleTech Turn Started", `${sequence.loser} lost Initiative and acts first.`);
  ui.notifications.info(`Round ${sequence.round}: ${sequencePhaseLabel(sequence.phase)} Phase.`);
  return sequence;
}

async function recordControlledBattleTechSelections() {
  if (!game.user.isGM) throw new Error("Only a Gamemaster can record BattleTech selections.");
  const combat = activeBattleTechCombat();
  const sequence = combat.getFlag(SYSTEM_ID, TURN_SEQUENCE_FLAG);
  if (!sequence) throw new RangeError("Start a BattleTech turn before recording selections.");
  const controlled = canvas?.tokens?.controlled ?? [];
  const selected = [...new Set(controlled.flatMap(token =>
    combat.getCombatantsByToken(token.document ?? token).map(combatant => combatant.id)
  ))];
  if (!selected.length) throw new RangeError("Control the acting token or tokens before recording their selection.");
  const updated = recordSelections(sequence, selected);
  await saveTurnSequence(combat, updated);
  const names = selected.map(id => combat.combatants.get(id)?.name ?? id).join(", ");
  await postTurnSequenceCard(updated, `${sequencePhaseLabel(sequence.phase)} Selection Recorded`, names);
  const visual = game.settings.get(SYSTEM_ID, "mechActivationEffects");
  const audio = game.settings.get(SYSTEM_ID, "mechActivationAudio");
  for (const token of controlled) {
    if (!selected.some(id => combat.getCombatantsByToken(token.document ?? token).some(combatant => combatant.id === id))) continue;
    if (!["mech", "vehicle"].includes(token.actor?.type)) continue;
    try {
      await playMechActivationEffect(token, token.actor, { visual, audio });
    } catch (error) {
      console.warn("BMFS | BattleMech activation effect failed", error);
    }
  }
  ui.notifications.info(`${names} recorded for the ${sequencePhaseLabel(sequence.phase)} Phase.`);
  return updated;
}

async function processCombatEndPhase(combat) {
  const summaries = [];
  for (const combatant of eligibleCombatants(combat)) {
    const actor = combatant.actor;
    if (actor?.type !== "mech") continue;
    const token = activeSceneToken(actor);
    let submerged = false;
    if (token) {
      const point = tokenCenter(token);
      const keys = terrainKeysAtPoint(token, point);
      submerged = terrainAttackModifiers(summarizeCombatTerrainPath({
        targetRegionKeys: keys,
        attackerRegionKeys: keys
      })).targetWaterDepth >= 2;
    }
    const result = endPhaseActorState({
      pilotHits: actor.system.pilot.hits,
      lifeSupportHits: actor.system.criticals.lifeSupportHits,
      submerged
    });
    await actor.update({
      "system.movement.mode": result.movement.mode,
      "system.movement.hexesMoved": result.movement.hexesMoved,
      "system.movement.mpSpent": result.movement.mpSpent,
      "system.movement.attackerModifier": result.movement.attackerModifier,
      "system.movement.targetModifier": result.movement.targetModifier,
      "system.movement.heatGenerated": result.movement.heatGenerated,
      "system.movement.terrain": result.movement.terrain,
      "system.pilot.hits": result.pilotHits,
      ...(result.pilotDestroyed ? { "system.status.destroyed": true } : {})
    });
    await actor.setFlag(SYSTEM_ID, "firedLocations", []);
    await actor.setFlag(SYSTEM_ID, "physicalAttackDeclared", false);
    summaries.push(`${actor.name}: movement cleared${result.pilotDamage ? "; pilot suffered 1 life-support hit underwater" : ""}.`);
  }
  if (summaries.length) await ChatMessage.create({
    content: `<section class="bmfs-chat-card"><h3>End Phase</h3><p>${summaries.map(foundry.utils.escapeHTML).join("<br>")}</p></section>`
  });
  return summaries;
}

async function advanceBattleTechPhase() {
  if (!game.user.isGM) throw new Error("Only a Gamemaster can advance the BattleTech phase.");
  const combat = activeBattleTechCombat();
  const sequence = combat.getFlag(SYSTEM_ID, TURN_SEQUENCE_FLAG);
  if (!sequence) throw new RangeError("Start a BattleTech turn before advancing phases.");
  if (sequence.phase === "end") throw new RangeError("Use Start BattleTech Turn to roll new Initiative for the next round.");
  const updated = nextPhase(sequence);
  if (updated.phase === "end") await processCombatEndPhase(combat);
  await saveTurnSequence(combat, updated);
  await postTurnSequenceCard(updated, `${sequencePhaseLabel(updated.phase)} Phase Started`);
  ui.notifications.info(`Round ${updated.round}: ${sequencePhaseLabel(updated.phase)} Phase.`);
  return updated;
}

async function rollBattleTechD6({ count = 2, modifier = 0, actor = null, target = null, label = "BattleTech D6 Roll" } = {}) {
  const formula = d6Formula(count, modifier);
  const roll = await new Roll(formula).evaluate();
  const outcome = target === null ? null : d6CheckOutcome(roll.total, target);
  const result = outcome ? `: ${outcome.success ? "SUCCESS" : "FAILURE"} by ${Math.abs(outcome.margin)}` : "";
  await postBattleTechRoll(roll, {
    speaker: ChatMessage.getSpeaker(actor ? { actor } : {}),
    flavor: `<section class="bmfs-chat-card"><h3>${foundry.utils.escapeHTML(label)}${result}</h3>${outcome ? `<p>Target ${outcome.target}; rolled ${outcome.total}.</p>` : ""}</section>`
  }, label);
  return { roll, outcome };
}

function diceSoNiceAvailable() {
  return game.modules?.get?.("dice-so-nice")?.active === true
    && typeof game.dice3d?.showForRoll === "function";
}

function weaponDiceTheme(weapon, rangeBracket = null) {
  const name = String(weapon?.name ?? "").toLowerCase();
  const type = String(weapon?.system?.weaponType ?? "").toLowerCase();
  const bracket = String(rangeBracket ?? "").toLowerCase();
  const byRange = (shortTheme, mediumTheme, longTheme) => {
    if (bracket.startsWith("long")) return longTheme;
    if (bracket.startsWith("medium")) return mediumTheme;
    return shortTheme;
  };

  if (type === "ppc" || /\bppc\b|particle projection cannon/.test(name)) return WEAPON_DICE_THEMES.ppc;
  if (type === "autocannon" || type === "ballistic" || /autocannon|machine gun|gauss|rifle/.test(name)) {
    return WEAPON_DICE_THEMES.ballistic;
  }
  if (type === "missile" || /\b[slm]rm\b|missile/.test(name)) {
    if (/\bsrm\b|short[ -]?range/.test(name)) return WEAPON_DICE_THEMES.missileShort;
    if (/\bmrm\b|medium[ -]?range/.test(name)) return WEAPON_DICE_THEMES.missileMedium;
    if (/\blrm\b|long[ -]?range/.test(name)) return WEAPON_DICE_THEMES.missileLong;
    return byRange(WEAPON_DICE_THEMES.missileShort, WEAPON_DICE_THEMES.missileMedium, WEAPON_DICE_THEMES.missileLong);
  }
  if (type === "laser" || /laser/.test(name)) {
    if (/\bsmall\b|\bshort\b/.test(name)) return WEAPON_DICE_THEMES.laserShort;
    if (/\bmedium\b/.test(name)) return WEAPON_DICE_THEMES.laserMedium;
    if (/\blarge\b|\blong\b/.test(name)) return WEAPON_DICE_THEMES.laserLong;
    return byRange(WEAPON_DICE_THEMES.laserShort, WEAPON_DICE_THEMES.laserMedium, WEAPON_DICE_THEMES.laserLong);
  }
  return null;
}

function applyWeaponDiceAppearance(roll, weapon, rangeBracket = null) {
  const theme = weaponDiceTheme(weapon, rangeBracket);
  if (!roll || !theme) return theme;
  roll.options ??= {};
  roll.options.appearance = {
    colorset: "custom",
    foreground: theme.foreground,
    background: theme.background,
    outline: theme.outline,
    edge: theme.edge
  };
  return theme;
}

async function animateBattleTechRoll(roll, label = "BattleTech D6 Roll") {
  if (diceSoNiceAvailable()) {
    try {
      await Promise.race([
        game.dice3d.showForRoll(roll, game.user, true),
        new Promise(resolve => globalThis.setTimeout(resolve, DICE_ANIMATION_TIMEOUT))
      ]);
      return "dice-so-nice";
    } catch (error) {
      console.warn("BMFS | Dice So Nice animation failed; using the built-in dice fallback.", error);
    }
  }
  return showBattleTechDiceRoll(roll, label) ? "built-in" : "none";
}

async function postBattleTechRoll(roll, messageData = {}, label = "BattleTech D6 Roll") {
  const provider = await animateBattleTechRoll(roll, label);
  const flags = provider === "dice-so-nice"
    ? {
        ...(messageData.flags ?? {}),
        "dice-so-nice": {
          ...(messageData.flags?.["dice-so-nice"] ?? {}),
          skip: true
        }
      }
    : messageData.flags;
  const data = flags === undefined ? messageData : { ...messageData, flags };
  const message = await roll.toMessage(data);
  return { provider, message };
}

function validDiceColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value ?? "")) ? String(value) : fallback;
}

function battleTechDiceAppearance() {
  return {
    enabled: game.settings.get(SYSTEM_ID, "visualDice"),
    body: validDiceColor(game.settings.get(SYSTEM_ID, "diceBodyColor"), "#1c6dd0"),
    pips: validDiceColor(game.settings.get(SYSTEM_ID, "dicePipColor"), "#ffffff"),
    size: Math.min(110, Math.max(48, Number(game.settings.get(SYSTEM_ID, "diceSize")) || 72))
  };
}

function battleTechD6Results(roll) {
  return (roll?.dice ?? [])
    .filter(die => Number(die.faces) === 6)
    .flatMap(die => (die.results ?? []).filter(result => result.active !== false).map(result => Number(result.result)))
    .filter(result => Number.isInteger(result) && result >= 1 && result <= 6);
}

function showBattleTechDiceRoll(roll, label = "BattleTech D6 Roll") {
  const appearance = battleTechDiceAppearance();
  const results = battleTechD6Results(roll);
  if (!appearance.enabled || !results.length || !globalThis.document?.body) return null;

  document.querySelectorAll(".bmfs-dice-overlay").forEach(existing => existing.remove());
  const overlay = document.createElement("section");
  overlay.className = "bmfs-dice-overlay";
  overlay.style.setProperty("--bmfs-die-body", appearance.body);
  overlay.style.setProperty("--bmfs-die-pips", appearance.pips);
  overlay.style.setProperty("--bmfs-die-size", `${appearance.size}px`);
  overlay.setAttribute("aria-label", `${label}: ${results.join(", ")}`);
  overlay.innerHTML = `<div class="bmfs-dice-label">${foundry.utils.escapeHTML(label)}</div><div class="bmfs-dice-row">${results.map((result, index) => `<div class="bmfs-visual-die" style="--bmfs-die-index:${index}" data-result="${result}"><span>${DICE_GLYPHS[result - 1]}</span></div>`).join("")}</div><div class="bmfs-dice-total">Total ${Number(roll.total)}</div>`;
  document.body.append(overlay);
  globalThis.setTimeout?.(() => overlay.classList.add("bmfs-dice-finished"), 1050);
  globalThis.setTimeout?.(() => overlay.remove(), 2800);
  return overlay;
}

async function configureBattleTechDice() {
  if (diceSoNiceAvailable()) {
    const findConfigButton = () => globalThis.document?.querySelector?.('button[data-action="openConfig"]')
      ?? [...(globalThis.document?.querySelectorAll?.("button") ?? [])]
        .find(button => [button.getAttribute?.("aria-label"), button.getAttribute?.("title"), button.textContent?.trim()]
          .includes("Open 3D Dice Config"));
    let configButton = findConfigButton();
    if (!configButton) {
      const sidebarTab = globalThis.document?.querySelector?.('button[data-action="tab"][data-tab="dice-so-nice"]');
      sidebarTab?.click();
      if (sidebarTab) await new Promise(resolve => {
        if (typeof globalThis.setTimeout === "function") globalThis.setTimeout(resolve, 100);
        else resolve();
      });
      configButton = findConfigButton();
    }
    if (configButton) configButton.click();
    else ui.notifications.info("Dice So Nice controls dice appearance. Open its sidebar tab or Module Settings to customize your dice.");
    return "dice-so-nice";
  }
  const appearance = battleTechDiceAppearance();
  const result = await foundry.applications.api.DialogV2.input({
    window: { title: "BattleTech Visual Dice" },
    content: `<div class="bmfs-dice-config"><p>Choose the appearance used by the built-in animated D6 rolls.</p><label><input type="checkbox" name="enabled" ${appearance.enabled ? "checked" : ""}> Show visual dice</label><label>Dice color <input type="color" name="body" value="${appearance.body}"></label><label>Pip color <input type="color" name="pips" value="${appearance.pips}"></label><label>Dice size <input type="range" name="size" min="48" max="110" step="2" value="${appearance.size}"></label></div>`,
    ok: { label: "Save and Preview" },
    rejectClose: false,
    modal: true
  });
  if (!result) return;
  const value = key => {
    if (typeof result.get === "function") return result.get(key);
    if (result.object && Object.hasOwn(result.object, key)) return result.object[key];
    return result[key];
  };
  const enabled = value("enabled");
  await game.settings.set(SYSTEM_ID, "visualDice", enabled === true || ["on", "true", "1"].includes(String(enabled).toLowerCase()));
  await game.settings.set(SYSTEM_ID, "diceBodyColor", validDiceColor(value("body"), appearance.body));
  await game.settings.set(SYSTEM_ID, "dicePipColor", validDiceColor(value("pips"), appearance.pips));
  await game.settings.set(SYSTEM_ID, "diceSize", Math.min(110, Math.max(48, Number(value("size")) || appearance.size)));
  if (game.settings.get(SYSTEM_ID, "visualDice")) {
    showBattleTechDiceRoll({ dice: [{ faces: 6, results: [{ result: 2 }, { result: 5 }] }], total: 7 }, "Dice Preview");
  }
}

function tokenActionHudStorageKey() {
  return `${ACTION_HUD_POSITION_KEY}.${game.user?.id ?? "anonymous"}`;
}

function savedTokenActionHudPosition() {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(tokenActionHudStorageKey()) ?? "null");
    return Number.isFinite(saved?.left) && Number.isFinite(saved?.top) ? saved : null;
  } catch {
    return null;
  }
}

function positionTokenActionHud(element, position) {
  if (!position) return;
  if (Number.isFinite(position.width)) element.style.width = `${Math.max(420, position.width)}px`;
  if (Number.isFinite(position.height)) element.style.height = `${Math.max(190, position.height)}px`;
  const width = element.offsetWidth || 540;
  const height = element.offsetHeight || 240;
  const left = Math.max(0, Math.min(position.left, globalThis.innerWidth - width));
  const top = Math.max(0, Math.min(position.top, globalThis.innerHeight - height));
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  element.style.bottom = "auto";
}

function saveTokenActionHudGeometry(element) {
  const rect = element.getBoundingClientRect();
  globalThis.localStorage?.setItem(tokenActionHudStorageKey(), JSON.stringify({
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  }));
}

function makeTokenActionHudDraggable(element) {
  const handle = element.querySelector(".bmfs-hud-drag-handle");
  if (!handle) return;
  positionTokenActionHud(element, savedTokenActionHudPosition());
  handle.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.target.closest("button")) return;
    event.preventDefault();
    const rect = element.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    element.classList.add("bmfs-hud-dragging");
    const move = moveEvent => positionTokenActionHud(element, {
      left: moveEvent.clientX - offsetX,
      top: moveEvent.clientY - offsetY
    });
    const end = () => {
      globalThis.removeEventListener("pointermove", move);
      element.classList.remove("bmfs-hud-dragging");
      saveTokenActionHudGeometry(element);
    };
    globalThis.addEventListener("pointermove", move);
    globalThis.addEventListener("pointerup", end, { once: true });
  });
  if (globalThis.ResizeObserver) {
    let initialized = false;
    const observer = new globalThis.ResizeObserver(() => {
      if (!initialized) {
        initialized = true;
        return;
      }
      saveTokenActionHudGeometry(element);
    });
    observer.observe(element);
  }
}

function removeTokenActionHud() {
  globalThis.document?.getElementById("bmfs-token-action-hud")?.remove();
}

function activeGatorStepIndex(combat = game.combats?.active ?? game.combat) {
  const stored = Number(combat?.getFlag?.(SYSTEM_ID, "gatorStep"));
  return Number.isInteger(stored) && stored >= 0 && stored < GATOR_STEPS.length ? stored : 0;
}

function gatorHudModel(actor, token) {
  const target = [...(game.user?.targets ?? [])][0] ?? null;
  const weapon = [...(actor.items ?? [])].find(item => item.type === "weapon" && !item.system?.destroyed);
  let components = {
    gunnery: Number(actor.system?.pilot?.gunnery ?? 4),
    attackerMovement: Number(actor.system?.movement?.attackerModifier ?? 0),
    attackerStatus: 0,
    targetMovement: Number(target?.actor?.system?.movement?.targetModifier ?? 0),
    targetStatus: 0,
    terrain: 0,
    heat: Number(heatEffectProfile(actor.system?.heat?.current ?? 0).attackModifier ?? 0),
    range: 0,
    sensors: 0,
    weaponDamage: 0
  };
  if (weapon && target) {
    try {
      components = calculateTokenWeaponAttack(actor, weapon, target, token).components;
    } catch {}
  }
  const values = {
    gunnery: Number(components.gunnery) || 0,
    attackerMovement: (Number(components.attackerMovement) || 0) + (Number(components.attackerStatus) || 0),
    targetMovement: (Number(components.targetMovement) || 0) + (Number(components.targetStatus) || 0),
    other: (Number(components.terrain) || 0) + (Number(components.heat) || 0)
      + (Number(components.sensors) || 0) + (Number(components.weaponDamage) || 0),
    range: Number(components.range) || 0
  };
  const current = activeGatorStepIndex();
  let arcs = null;
  if (target && token) {
    try {
      arcs = targetingArc(tokenCenter(token), tokenCenter(target), token.document?.rotation ?? token.rotation ?? 0);
    } catch {}
  }
  return {
    current,
    activeUnit: (game.combats?.active ?? game.combat)?.combatant?.name ?? actor.name,
    targetName: target?.name ?? target?.actor?.name ?? "No target",
    arcs,
    combined: Object.values(values).reduce((sum, value) => sum + value, 0),
    steps: GATOR_STEPS.map(([key, label], index) => ({ key, label, value: values[key], index, completed: index < current, active: index === current }))
  };
}

async function setGatorStep(index, { announce = true } = {}) {
  if (!game.user.isGM) throw new Error("Only a Gamemaster can change the GATOR sequence.");
  const combat = game.combats?.active ?? game.combat;
  if (!combat) throw new RangeError("Create or activate a Combat encounter before changing GATOR steps.");
  const normalized = Math.max(0, Math.min(GATOR_STEPS.length - 1, Number(index) || 0));
  await combat.setFlag(SYSTEM_ID, "gatorStep", normalized);
  const label = GATOR_STEPS[normalized][1];
  if (announce) ui.notifications.info(`GATOR Phase: ${label}`);
  refreshTokenActionHud();
  return normalized;
}

function shiftGatorStep(delta) {
  return setGatorStep(activeGatorStepIndex() + Number(delta));
}

async function setWeaponFireGroup(actor, itemId, group) {
  const normalized = String(group).toLowerCase();
  if (!FIRE_GROUPS.includes(normalized)) throw new RangeError(`Unknown weapon group: ${group}.`);
  const weapon = actor?.items?.get?.(itemId);
  if (!weapon || weapon.type !== "weapon") throw new RangeError("The selected weapon could not be assigned.");
  await weapon.setFlag(SYSTEM_ID, "fireGroup", normalized);
  ui.notifications.info(`${weapon.name} assigned to ${normalized === "alpha" ? "Alpha" : `Group ${normalized}`}.`);
  refreshTokenActionHud();
  return normalized;
}

function activeGamemaster() {
  return game.users?.activeGM
    ?? [...(game.users ?? [])]
      .filter(user => user.active && (user.isGM || Number(user.role) === 4))
      .sort((left, right) => String(left.id).localeCompare(String(right.id)))[0]
    ?? null;
}

function validateAttackTokenAuthority({ attacker, attackerToken, sceneId }) {
  if (!attackerToken || attackerToken.actor?.id !== attacker.id) {
    throw new Error("The requested attacking token does not represent the attacking BattleMech.");
  }
  const tokenSceneId = (attackerToken.document ?? attackerToken).parent?.id;
  if (tokenSceneId && tokenSceneId !== sceneId) {
    throw new Error("The requested attacking token is not on the active Scene.");
  }
  return true;
}

function validateWeaponAttackAuthority({ requester, attacker, attackerToken, weapon, target, sceneId }) {
  if (!requester?.active) throw new Error("The requesting player is no longer connected.");
  if (!attacker || attacker.type !== "mech") throw new Error("The attacking BattleMech could not be found.");
  if (typeof attacker.testUserPermission === "function" && !attacker.testUserPermission(requester, "OWNER")) {
    throw new Error(`${requester.name} does not own ${attacker.name}.`);
  }
  if (!weapon || weapon.parent?.id !== attacker.id || weapon.type !== "weapon") {
    throw new Error("The requested embedded weapon does not belong to the attacking BattleMech.");
  }
  if (sceneId !== canvas.scene?.id) throw new Error("The requested attack is not on the active Scene.");
  validateAttackTokenAuthority({ attacker, attackerToken, sceneId });
  if (!target || target.actor?.type !== "mech") throw new Error("The requested target BattleMech could not be found.");
  return true;
}

function validatePhysicalAttackAuthority({ requester, attacker, attackerToken, target, sceneId }) {
  if (!requester?.active) throw new Error("The requesting player is no longer connected.");
  if (!attacker || attacker.type !== "mech") throw new Error("The attacking BattleMech could not be found.");
  if (typeof attacker.testUserPermission === "function" && !attacker.testUserPermission(requester, "OWNER")) {
    throw new Error(`${requester.name} does not own ${attacker.name}.`);
  }
  if (sceneId !== canvas.scene?.id) throw new Error("The requested attack is not on the active Scene.");
  validateAttackTokenAuthority({ attacker, attackerToken, sceneId });
  if (!target || target.actor?.type !== "mech") throw new Error("The requested target BattleMech could not be found.");
  return true;
}

function requestGamemasterCombatAction(request) {
  const gm = activeGamemaster();
  if (!gm) return Promise.reject(new Error("A connected Gamemaster is required to resolve attacks against Actors the player does not own."));
  if (!game.socket?.emit) return Promise.reject(new Error("The BattleTech combat socket is unavailable."));
  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      pendingCombatActions.delete(request.requestId);
      reject(new Error("The Gamemaster did not answer the combat-action request."));
    }, COMBAT_ACTION_TIMEOUT);
    pendingCombatActions.set(request.requestId, {
      gmId: gm.id,
      resolve: result => {
        globalThis.clearTimeout(timeout);
        resolve(result);
      },
      reject: error => {
        globalThis.clearTimeout(timeout);
        reject(error);
      }
    });
    game.socket.emit(COMBAT_EFFECT_SOCKET, request);
  });
}

async function requestAuthoritativeWeaponAttack(actor, weapon, target) {
  if (game.user.isGM) return withCombatActionLock(actor, () => performWeaponAttack(actor, weapon, target));
  if (!actor?.isOwner) throw new Error(`You do not own ${actor?.name ?? "the attacking BattleMech"}.`);
  const attackerToken = activeSceneToken(actor);
  if (!attackerToken) throw new Error(`${actor.name} needs an active token on this scene.`);

  const requestId = globalThis.crypto?.randomUUID?.() ?? foundry.utils.randomID();
  return requestGamemasterCombatAction({
    messageType: "combat-action-request",
    action: "weapon",
    requestId,
    sceneId: canvas.scene?.id,
    attackerActorId: actor.id,
    attackerTokenId: attackerToken.id ?? attackerToken.document?.id,
    weaponId: weapon.id,
    targetTokenId: target.id ?? target.document?.id
  });
}

async function requestAuthoritativePhysicalAttack(actor, type, limb, target) {
  if (game.user.isGM) return withCombatActionLock(actor, () => performPhysicalAttack(actor, type, limb, target));
  if (!actor?.isOwner) throw new Error(`You do not own ${actor?.name ?? "the attacking BattleMech"}.`);
  const attackerToken = activeSceneToken(actor);
  if (!attackerToken) throw new Error(`${actor.name} needs an active token on this scene.`);
  const requestId = globalThis.crypto?.randomUUID?.() ?? foundry.utils.randomID();
  return requestGamemasterCombatAction({
    messageType: "combat-action-request",
    action: "physical",
    requestId,
    sceneId: canvas.scene?.id,
    attackerActorId: actor.id,
    attackerTokenId: attackerToken.id ?? attackerToken.document?.id,
    attackType: type,
    limb,
    targetTokenId: target.id ?? target.document?.id
  });
}

async function withCombatActionLock(actor, action) {
  const key = actor?.id;
  if (!key) throw new Error("The attacking Actor could not be locked for combat resolution.");
  if (combatActionLocks.has(key)) throw new Error(`${actor.name} already has a combat action being resolved.`);
  combatActionLocks.add(key);
  try {
    return await action();
  } finally {
    combatActionLocks.delete(key);
  }
}

async function performWeaponAttack(actor, weapon, target, attackerToken = null) {
  let attack;
  try {
    attack = calculateTokenWeaponAttack(actor, weapon, target, attackerToken);
  } catch (error) {
    return weaponAttackFailure(weapon, error.message);
  }

  const escape = foundry.utils.escapeHTML;
  const targetActor = target.actor;
  const breakdown = attack.components;
  const terrain = attack.terrain;
  const terrainSummary = [
    terrain.interveningLightWoods ? `${terrain.interveningLightWoods} light woods` : null,
    terrain.interveningHeavyWoods ? `${terrain.interveningHeavyWoods} heavy woods` : null,
    terrain.targetWoods ? `target woods +${terrain.targetWoods}` : null,
    terrain.partialCover ? "partial cover +1" : null
  ].filter(Boolean).join(", ") || "clear";

  if (!attack.canAttack) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<section class="bmfs-chat-card">
        <h3>${escape(actor.name)} cannot attack ${escape(targetActor.name)}</h3>
        <p>${escape(attack.reason)}</p>
        <p>Range ${attack.distance} hexes; terrain: ${escape(terrainSummary)}.</p>
      </section>`
    });
    return weaponAttackFailure(weapon, attack.reason);
  }

  let ammunitionBin = null;
  let ammunitionBefore = null;
  let ammunitionRemaining = null;
  const ammunitionRequired = ammunitionUnitsPerAttack(weapon);
  if (ammunitionRequired > 0) {
    ammunitionBin = selectAmmunitionBin(actor.items, weapon.name, ammunitionRequired);
    if (!ammunitionBin) {
      const ammunitionType = ammunitionTypeForWeapon(weapon.name) ?? weapon.name;
      return weaponAttackFailure(weapon, `${weapon.name} cannot fire: no loaded ${ammunitionType} ammunition bin contains the required ${ammunitionRequired} units.`);
    }
    ammunitionBefore = Number(ammunitionBin.system.shots);
    ammunitionRemaining = ammunitionBefore - ammunitionRequired;
  }

  const roll = await new Roll("2d6").evaluate();
  const diceTheme = applyWeaponDiceAppearance(roll, weapon, attack.range.bracket);
  const hit = roll.total >= attack.targetNumber;
  const weaponHeat = Number(weapon.system.heat) || 0;
  let cluster = null;
  let scatter = null;
  let collateralTarget = null;
  let damageResults = [];
  let damageTarget = hit ? target : null;
  if (!hit) {
    const scatterRoll = await new Roll("1d6").evaluate();
    scatter = scatterAdjacentHex(tokenCenter(target), scatterRoll.total);
    collateralTarget = collateralTokenAtOffset(scatter.offset, {
      exclude: [target.id ?? target.document?.id, activeSceneToken(actor)?.id]
    });
    damageTarget = collateralTarget;
  }

  if (damageTarget) {
    const launcher = missileLauncherProfile(weapon.name);
    if (launcher) {
      const clusterRoll = await new Roll("2d6").evaluate();
      cluster = resolveMissileCluster(weapon.name, clusterRoll.total);
      for (const group of cluster.damageGroups) damageResults.push(await resolveWeaponHit(actor, weapon, damageTarget, group));
    } else {
      damageResults = [await resolveWeaponHit(actor, weapon, damageTarget)];
    }
  }

  if (ammunitionBin) await updateEmbeddedItemSystem(ammunitionBin, { shots: ammunitionRemaining });
  await actor.update({
    "system.heat.current": (Number(actor.system.heat.current) || 0) + weaponHeat
  });
  await recordFiredWeaponLocation(actor, weapon.system.location);

  const sourceToken = activeSceneToken(actor);
  const effectToken = hit ? target : collateralTarget;
  if (game.settings.get(SYSTEM_ID, "weaponEffects")) {
    void broadcastCombatEffect({
      kind: "weapon",
      originTokenId: sourceToken?.id ?? sourceToken?.document?.id,
      targetTokenId: effectToken?.id ?? effectToken?.document?.id ?? null,
      targetPoint: scatter?.point ?? null,
      weapon: { name: weapon.name, system: { weaponType: weapon.system.weaponType } },
      hit: hit || Boolean(collateralTarget),
      impact: true,
      audio: game.settings.get(SYSTEM_ID, "weaponAudio")
    }).catch(error => console.warn("BMFS | Weapon effect failed", error));
  }

  const destroyedLocations = [...new Set(damageResults.flatMap(result => result.destroyedLocations))];
  const criticalSummaries = damageResults.map(result => result.criticalSummary).filter(Boolean);
  const damageSummary = damageResults.map((result, index) =>
    `Hit ${index + 1}: ${result.locationLabel} (${result.direction}, roll ${result.locationRoll}); ${result.damage} damage: ${result.armorDamage} armor, ${result.structureDamage} internal.`
  ).join("<br>");
  const totalDamage = damageResults.reduce((sum, result) => sum + result.armorDamage + result.structureDamage, 0);
  const totalArmorDamage = damageResults.reduce((sum, result) => sum + result.armorDamage, 0);
  const totalStructureDamage = damageResults.reduce((sum, result) => sum + result.structureDamage, 0);
  const signed = value => value >= 0 ? `+${value}` : String(value);
  const outcomeLabel = hit ? "HIT" : collateralTarget ? `MISS → COLLATERAL HIT: ${collateralTarget.actor.name}` : "MISS";
  const ranges = weapon.system.range ?? {};
  await postBattleTechRoll(roll, {
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `<section class="bmfs-chat-card">
      <h3>${escape(weapon.name)} vs. ${escape(targetActor.name)}: ${escape(outcomeLabel)}</h3>
      <p><strong>Attack roll ${roll.total}</strong> vs. Target Number ${attack.targetNumber}; range ${attack.distance} (${escape(attack.range.bracket)}).</p>
      <p>Weapon: ${escape(weapon.system.weaponType)}; base damage ${Number(weapon.system.damage) || 0}; heat ${weaponHeat}; location ${escape(locationLabel(weapon.system.location))}; ranges ${Number(ranges.minimum) || 0}/${Number(ranges.short) || 0}/${Number(ranges.medium) || 0}/${Number(ranges.long) || 0} (minimum/short/medium/long).</p>
      <p>GATOR: ${breakdown.gunnery} Gunnery, ${signed(breakdown.attackerMovement + breakdown.attackerStatus)} attacker, ${signed(breakdown.targetMovement + breakdown.targetStatus)} target, ${signed(breakdown.terrain)} terrain, ${signed(breakdown.heat)} heat, ${signed(breakdown.range)} range, ${signed(breakdown.sensors + breakdown.weaponDamage)} critical damage.</p>
      <p>Terrain: ${escape(terrainSummary)}.</p>
      <p>Weapon heat: +${weaponHeat}.</p>
      ${diceTheme ? `<p>Dice theme: ${escape(diceTheme.label)}.</p>` : ""}
      ${ammunitionBin ? `<p>Ammunition: ${escape(ammunitionTypeForWeapon(weapon.name) ?? weapon.name)}; ${ammunitionBefore} → ${ammunitionRemaining} shots in ${escape(ammunitionBin.name)}.</p>` : `<p>Ammunition: not required.</p>`}
      ${scatter ? `<p>Miss scatter: direction ${scatter.roll} into adjacent hex [${scatter.offset.i}, ${scatter.offset.j}]; ${collateralTarget ? `${escape(collateralTarget.actor.name)} occupies the impact hex and receives damage` : "impact hex empty; no collateral damage applied"}.</p>` : ""}
      ${cluster ? `<p>Cluster roll ${cluster.roll}: ${cluster.missilesHit} of ${cluster.size} ${cluster.family} missiles hit in ${cluster.damageGroups.length} damage group(s) (${cluster.damageGroups.join(" + ")} damage).</p>` : ""}
      <p>Damage output: ${totalDamage} total; ${totalArmorDamage} armor and ${totalStructureDamage} internal. ${damageTarget ? `${escape(damageTarget.actor.name)} received this damage.` : "No unit received damage."}</p>
      ${damageSummary ? `<p>${damageSummary}</p>` : ""}
      ${destroyedLocations.length ? `<p>Destroyed: ${escape(destroyedLocations.join(", "))}.</p>` : ""}
      ${criticalSummaries.length ? `<p>${escape(criticalSummaries.join("; "))}</p>` : ""}
    </section>`
  }, `${weapon.name} Attack`);
  return {
    weaponId: weapon.id,
    weaponName: weapon.name,
    hit,
    collateral: Boolean(collateralTarget),
    collateralTarget: collateralTarget?.actor?.name ?? null,
    outcome: outcomeLabel,
    roll: roll.total,
    targetNumber: attack.targetNumber,
    distance: attack.distance,
    rangeBracket: attack.range.bracket,
    heat: weaponHeat,
    ammunitionType: ammunitionTypeForWeapon(weapon.name),
    ammunitionSpent: ammunitionBefore === null ? 0 : ammunitionBefore - ammunitionRemaining,
    ammunitionRemaining,
    damage: totalDamage,
    armorDamage: totalArmorDamage,
    structureDamage: totalStructureDamage
  };
}

async function performPhysicalAttack(actor, type, limb, target, attackerToken = null) {
  const combat = activeBattleTechCombat();
  const sequence = combat.getFlag(SYSTEM_ID, TURN_SEQUENCE_FLAG);
  if (sequence?.phase !== "physicalAttack") {
    throw new RangeError("Physical attacks may only be resolved during the Physical Attack Phase.");
  }
  if (actor.getFlag(SYSTEM_ID, "physicalAttackDeclared")) {
    throw new RangeError(`${actor.name} has already made its physical attack this turn.`);
  }

  const attacks = calculateTokenPhysicalAttacks(actor, type, target, limb, attackerToken);
  const legal = attacks.filter(attack => attack.canAttack);
  if (!legal.length) throw new RangeError(attacks[0]?.reason ?? "No legal physical attack is available.");

  await actor.setFlag(SYSTEM_ID, "physicalAttackDeclared", true);
  const escape = foundry.utils.escapeHTML;
  const signed = value => value >= 0 ? `+${value}` : String(value);
  const results = [];
  for (const attack of legal) {
    const roll = await new Roll("2d6").evaluate();
    const hit = attack.automaticHit || (!attack.automaticFailure && roll.total >= attack.targetNumber);
    const damage = hit ? await resolvePhysicalHit(actor, target, attack) : null;
    if (game.settings.get(SYSTEM_ID, "weaponEffects")) {
      const sourceToken = attackerToken ?? activeSceneToken(actor);
      void broadcastCombatEffect({
        kind: "melee",
        originTokenId: sourceToken?.id ?? sourceToken?.document?.id,
        targetTokenId: target.id ?? target.document?.id,
        attackType: attack.type,
        hit,
        audio: game.settings.get(SYSTEM_ID, "weaponAudio")
      }).catch(error => console.warn("BMFS | Melee effect failed", error));
    }
    const pilotingCheck = attack.type === "kick"
      ? hit
        ? `${target.actor.name} makes an automatic Piloting Skill Roll after this kick.`
        : `${actor.name} makes an automatic Piloting Skill Roll after this missed kick.`
      : "No automatic Piloting Skill Roll is caused by this punch.";

    await postBattleTechRoll(roll, {
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<section class="bmfs-chat-card bmfs-physical-card">
        <h3>${escape(locationLabel(attack.limb))} ${escape(attack.label)} vs. ${escape(target.actor.name)}: ${hit ? "HIT" : "MISS"}</h3>
        <p>Target Number ${attack.targetNumber}; rolled ${roll.total}. Damage ${attack.damage}.</p>
        <p>Physical attack: ${attack.components.piloting} Piloting, ${signed(attack.components.attackType)} type, ${signed(attack.components.attackerMovement)} attacker movement, ${signed(attack.components.targetMovement + attack.components.targetStatus)} target, ${signed(attack.components.terrain)} terrain, ${signed(attack.components.actuator)} actuator.</p>
        ${damage ? `<p>${escape(damage.locationLabel)} (${damage.direction}, ${escape(attack.locationTable)} roll ${damage.locationRoll}): ${damage.damage} damage; ${damage.armorDamage} armor, ${damage.structureDamage} internal.</p>` : ""}
        ${damage?.destroyedLocations.length ? `<p>Destroyed: ${escape(damage.destroyedLocations.join(", "))}.</p>` : ""}
        ${damage?.criticalSummary ? `<p>${escape(damage.criticalSummary)}</p>` : ""}
        <p>${escape(pilotingCheck)}</p>
      </section>`
    }, `${locationLabel(attack.limb)} ${attack.label}`);
    if (attack.type === "kick") {
      const checkActor = hit ? target.actor : actor;
      const checkToken = hit ? target : activeSceneToken(actor);
      await resolvePilotingSkillRoll(checkActor, checkToken, {
        reason: hit ? "kicked" : "missed kick"
      });
    }
    results.push({
      type: attack.type,
      limb: attack.limb,
      hit,
      roll: roll.total,
      targetNumber: attack.targetNumber,
      damage: damage?.damage ?? 0
    });
  }
  return results;
}

function weaponAttackFailure(weapon, reason) {
  return {
    weaponId: weapon?.id ?? null,
    weaponName: weapon?.name ?? "Unknown Weapon",
    hit: false,
    collateral: false,
    outcome: `NOT FIRED: ${reason}`,
    failure: reason,
    heat: 0,
    ammunitionSpent: 0,
    ammunitionRemaining: null,
    damage: 0,
    armorDamage: 0,
    structureDamage: 0
  };
}

async function migrateLegacyAmmunitionBins() {
  if (!game.user.isGM) return 0;
  let migrated = 0;
  for (const actor of game.actors ?? []) {
    for (const item of actor.items ?? []) {
      const changes = legacyAmmunitionMigration(item);
      if (!changes) continue;
      await updateEmbeddedItemSystem(item, changes);
      migrated += 1;
    }
  }
  if (migrated) {
    ui.notifications.info(`BattleMech ammunition accounting updated in ${migrated} installed bin(s).`);
  }
  return migrated;
}

async function fireWeaponGroup(actor, group) {
  const normalized = String(group).toLowerCase();
  if (!FIRE_GROUPS.includes(normalized)) throw new RangeError(`Unknown weapon group: ${group}.`);
  const weapons = [...actor.items].filter(item => item.type === "weapon" && !item.system.destroyed && weaponFireGroup(item) === normalized);
  if (!weapons.length) throw new RangeError(`${normalized === "alpha" ? "Alpha" : `Weapon Group ${normalized}`} has no operational weapons.`);
  const ammunitionPlan = planAmmunitionConsumption(actor.items, weapons);
  if (!ammunitionPlan.ready) {
    throw new RangeError(`${normalized === "alpha" ? "Alpha" : `Weapon Group ${normalized}`} cannot fire: ${ammunitionPlan.reason}`);
  }
  if ([...game.user.targets].filter(token => token.actor?.type === "mech").length !== 1) {
    throw new RangeError("Target exactly one BattleMech token before firing a weapon group.");
  }

  const event = { preventDefault() {}, stopPropagation() {} };
  const results = [];
  for (const weapon of weapons) {
    try {
      const report = await BMFSMechSheet.onRollWeaponAttack.call({ actor }, event, {
        closest: () => ({ dataset: { itemId: weapon.id } })
      });
      results.push(report ?? { weaponName: weapon.name, outcome: "NOT FIRED", heat: 0, ammunitionSpent: 0, damage: 0 });
    } catch (error) {
      results.push({ weaponName: weapon.name, outcome: `ERROR: ${error.message}`, heat: 0, ammunitionSpent: 0, damage: 0 });
    }
  }

  const escape = foundry.utils.escapeHTML;
  const label = normalized === "alpha" ? "Alpha" : normalized;
  const pilot = actor.system?.pilot?.name || actor.name;
  const totalHeat = results.reduce((sum, result) => sum + Number(result.heat || 0), 0);
  const totalAmmo = results.reduce((sum, result) => sum + Number(result.ammunitionSpent || 0), 0);
  const totalDamage = results.reduce((sum, result) => sum + Number(result.damage || 0), 0);
  const failures = results.filter(result => result.failure);
  const baseDamage = weapons.reduce((sum, weapon) => sum + Number(weapon.system.damage || 0), 0);
  const ranges = weapons.map(weapon => `${weapon.name} ${Number(weapon.system.range?.short) || 0}/${Number(weapon.system.range?.medium) || 0}/${Number(weapon.system.range?.long) || 0}`).join("; ");
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<section class="bmfs-chat-card bmfs-fire-group-card">
      <h3>${escape(pilot)} fired Weapon Group ${escape(label)}</h3>
      <p>${weapons.length} weapon(s); combined base damage ${baseDamage}; generated heat ${totalHeat}; ammunition spent ${totalAmmo}.</p>
      <p>Weapon ranges (short/medium/long): ${escape(ranges)}.</p>
      <ul>${results.map(result => `<li><strong>${escape(result.weaponName)}</strong>: ${escape(result.outcome)}${result.roll === undefined ? "" : ` — roll ${result.roll} vs. ${result.targetNumber}, ${result.distance} hexes (${escape(result.rangeBracket)}), ${result.damage} damage, +${result.heat} heat${result.ammunitionRemaining === null ? "" : `, ${result.ammunitionRemaining} ammo remaining`}`}</li>`).join("")}</ul>
      <p>Group result: ${results.filter(result => result.hit).length} primary hit(s), ${results.filter(result => !result.hit && result.collateral).length} collateral hit(s), ${results.filter(result => result.outcome === "MISS").length} clean miss(es), ${totalDamage} applied damage.</p>
      ${failures.length ? `<p><strong>Not fired:</strong> ${failures.map(result => `${escape(result.weaponName)} — ${escape(result.failure)}`).join("; ")}.</p>` : ""}
    </section>`
  });
  return { group: normalized, weapons: weapons.length, results, totalHeat, totalAmmo, totalDamage };
}

function refreshTokenActionHud(preferredToken = null) {
  removeTokenActionHud();
  if (!game.settings.get(SYSTEM_ID, "tokenActionHud")) return;
  const token = preferredToken?.controlled
    ? preferredToken
    : canvas?.tokens?.controlled?.find(candidate => ["mech", "vehicle"].includes(candidate.actor?.type));
  const model = tokenActionHudModel(token?.actor);
  if (!model || !globalThis.document?.body) return;
  model.gator = gatorHudModel(token.actor, token);
  Hooks.callAll("bmfs.actionHudModel", model, token.actor, token);
  const escape = foundry.utils.escapeHTML;
  const diceStyleTitle = diceSoNiceAvailable() ? "Open Dice So Nice 3D dice settings" : "Customize built-in visual dice";
  const effectModuleNames = [
    ["sequencer", "Sequencer"],
    ["JB2A_DnD5e", "JB2A"],
    ["autoanimations", "Automated Animations"],
    ["eskie-effects-free", "Eskie Effects"],
    ["ggg", "GGG SoundFX"]
  ].filter(([id]) => game.modules?.get?.(id)?.active).map(([, name]) => name);
  const enhancedEffects = game.modules?.get?.("sequencer")?.active && game.modules?.get?.("JB2A_DnD5e")?.active;
  const heatSegments = model.heat === null ? "" : [5, 4, 3, 2, 1]
    .map(level => `<span class="bmfs-heat-segment${level <= model.heatSegments ? " is-active" : ""}" data-level="${level}"></span>`).join("");
  const ammunitionPercent = model.ammunition.maximum > 0
    ? Math.max(0, Math.min(100, Math.round((model.ammunition.current / model.ammunition.maximum) * 100)))
    : 0;
  const fireGroupMarkup = FIRE_GROUPS.map(group => {
    const summary = model.fireGroupSummaries[group];
    const label = group === "alpha" ? "ALPHA" : `WG${group}`;
    const title = `${summary.count} weapon(s); damage ${summary.damage}; heat ${summary.heat}; ammo ${summary.ammunition}; range ${summary.short}/${summary.medium}/${summary.long}; ${summary.ammunitionSufficient ? "ammunition ready" : "insufficient ammunition"}`;
    return `<button type="button" class="bmfs-fire-group-command${summary.ammunitionSufficient ? "" : " bmfs-ammo-warning"}" data-action="fire-group" data-fire-group="${group}" title="${escape(title)}"${summary.count && summary.ammunitionSufficient ? "" : " disabled"}>
      <span>${label}</span><small>${summary.count}W · D${summary.damage} · H${summary.heat}${summary.ammunition ? ` · A${summary.ammunition}` : ""}</small>
    </button>`;
  }).join("");
  const gatorMarkup = model.gator.steps.map(step => `<li class="${step.active ? "is-active" : step.completed ? "is-complete" : ""}"><span>${step.index + 1}. ${escape(step.label)}</span><strong>${step.value >= 0 ? "+" : ""}${step.value}</strong></li>`).join("");
  const weaponMenu = category => {
    const weapons = model.weapons.filter(weapon => weapon.category === category);
    return weapons.length
      ? weapons.map(weapon => `<button type="button" data-action="weapon" data-item-id="${escape(weapon.id)}" title="${escape(weapon.name)} · Damage ${weapon.damage} · Heat ${weapon.heat} · Range ${Number(weapon.range.short) || 0}/${Number(weapon.range.medium) || 0}/${Number(weapon.range.long) || 0}${weapon.ammoPerShot ? ` · Ammo ${weapon.ammunition.current}/${weapon.ammunition.maximum}` : ""}"${weapon.ammunition.sufficient ? "" : " disabled"}><img src="${escape(weapon.img || "icons/svg/item-bag.svg")}" alt="">${escape(weapon.name)}</button>`).join("")
      : `<span class="bmfs-hud-menu-empty">None installed</span>`;
  };
  const categoryDefinitions = [
    ["weapons", "crosshairs", "Weapons", `<details open><summary>Energy</summary>${weaponMenu("energy")}</details><details><summary>Ballistic</summary>${weaponMenu("ballistic")}</details><details><summary>Missile</summary>${weaponMenu("missile")}</details><details><summary>Equipment</summary><button type="button" data-action="sheet">Open equipment list</button></details>`],
    ["groups", "layer-group", "Fire Groups", fireGroupMarkup],
    ["physical", "hand-fist", "Physical", model.actorType === "mech" ? `<button type="button" data-action="punch">Punches</button><button type="button" data-action="kick-left">Left Kick</button><button type="button" data-action="kick-right">Right Kick</button>` : `<span class="bmfs-hud-menu-empty">No BattleMech physical attacks</span>`],
    ["movement", "person-walking", "Movement", model.actorType === "mech" ? `<button type="button" data-action="movement" data-mode="stand">Stand</button><button type="button" data-action="movement" data-mode="walk">Walk</button><button type="button" data-action="movement" data-mode="run">Run</button><button type="button" data-action="movement" data-mode="jump">Jump</button>` : `<span class="bmfs-hud-menu-empty">${escape(model.movement)}</span>`],
    ["systems", "microchip", "Systems", `<button type="button" data-action="sheet">Heat · ammunition · armor · internals · criticals</button><span class="bmfs-hud-menu-empty">Ammo ${model.ammunition.current}/${model.ammunition.maximum}${model.heat === null ? "" : ` · Heat ${model.heat}`}</span>`],
    ["pilot", "user-astronaut", "Pilot", `<button type="button" data-action="gunnery">Gunnery Check</button><button type="button" data-action="piloting">Piloting Check</button><button type="button" data-action="player-console">Pilot & Lance Window</button>`],
    ["utility", "toolbox", "Utility", `<button type="button" data-action="sheet">Record Sheet</button><button type="button" data-action="token">Edit Token / Arc Ring</button><button type="button" data-action="dice-style">Dice Appearance</button><button type="button" data-action="roll2d6">Roll 2D6</button>${game.user.isGM ? `<button type="button" data-action="map-generator">Random Hex Map</button>` : ""}`]
  ];
  try {
    const storedOrder = JSON.parse(globalThis.localStorage?.getItem(`${SYSTEM_ID}.hudCategoryOrder.${game.user?.id}`) ?? "[]");
    if (Array.isArray(storedOrder)) categoryDefinitions.sort((left, right) => {
      const leftIndex = storedOrder.indexOf(left[0]);
      const rightIndex = storedOrder.indexOf(right[0]);
      return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
    });
  } catch {}
  const categoryMarkup = categoryDefinitions.map(([id, icon, label, content]) => `<details class="bmfs-hud-category" data-category="${id}" draggable="false"><summary><i class="fa-solid fa-${icon}"></i> ${label}</summary><div class="bmfs-hud-category-menu">${content}</div></details>`).join("");
  const element = document.createElement("section");
  element.id = "bmfs-token-action-hud";
  element.className = `${enhancedEffects ? "bmfs-hud-enhanced-fx" : "bmfs-hud-fallback-fx"} bmfs-theme-${model.faction}`;
  element.dataset.faction = model.faction;
  element.innerHTML = `<button type="button" class="bmfs-hud-portrait" data-action="token" title="Edit ${escape(model.actorName)} token image"><img src="${escape(model.actorImage)}" alt="${escape(model.actorName)}"></button>
    <header class="bmfs-hud-drag-handle" title="Drag to move the action hub">
      <div class="bmfs-hud-identity"><span class="bmfs-hud-kicker">${escape(model.actorType === "mech" ? "BATTLEMECH COMMAND" : "COMBAT VEHICLE COMMAND")}</span><strong>${escape(model.actorName)}</strong><span>${escape(model.pilotName)}</span></div>
      <div class="bmfs-hud-badges"><span title="Current movement">${escape(model.movement)}</span><span title="Gunnery skill">G${model.gunnery}</span><span title="Piloting or driving skill">P${model.piloting}</span><span class="bmfs-hud-fx" title="${escape(effectModuleNames.length ? `Active effect modules: ${effectModuleNames.join(", ")}` : "Built-in BattleMech effects")}"><i class="fa-solid fa-bolt"></i> FX ${effectModuleNames.length || "CORE"}</span></div>
      <div class="bmfs-hud-window-tools"><button type="button" data-action="hud-lock" title="Unlock and reorganize HUD categories"><i class="fa-solid fa-lock"></i></button><button type="button" data-action="dice-style" title="${diceStyleTitle}"><i class="fa-solid fa-dice-d6"></i></button><button type="button" data-action="sheet" title="Open record sheet"><i class="fa-solid fa-clipboard-list"></i></button><button type="button" data-action="close" title="Hide HUD"><i class="fa-solid fa-xmark"></i></button></div>
    </header>
    <div class="bmfs-hud-console">
      <main class="bmfs-hud-command-deck">
        <div class="bmfs-hud-category-bar">${categoryMarkup}</div>
      </main>
      <aside class="bmfs-hud-telemetry">
        <section class="bmfs-ammo-telemetry" title="${model.ammunition.bins} operational ammunition bin(s)"><span>AMMO</span><strong>${model.ammunition.current}/${model.ammunition.maximum}</strong><div class="bmfs-ammo-gauge"><i style="--bmfs-ammo:${ammunitionPercent}%"></i></div></section>
        ${model.heat === null ? "" : `<section class="bmfs-heat-telemetry" title="Current heat ${model.heat} of ${model.heatMaximum}"><span>HEAT</span><strong>${model.heat}</strong><div class="bmfs-heat-ladder">${heatSegments}</div></section>`}
      </aside>
    </div>
    <section class="bmfs-gator-panel" aria-label="GATOR sequence"><div class="bmfs-gator-heading"><strong>GATOR</strong><span>${escape(model.gator.activeUnit)} · ${escape(model.gator.targetName)}${model.gator.arcs ? ` · ${escape(model.gator.arcs.firingArc)} fire / ${escape(model.gator.arcs.hitZone)} hit zone` : ""} · Combined ${model.gator.combined >= 0 ? "+" : ""}${model.gator.combined}</span></div><ol>${gatorMarkup}</ol></section>
    ${model.weapons.length ? `<div class="bmfs-hud-weapons" hidden><div class="bmfs-hud-weapons-heading"><strong>WEAPON ROSTER</strong><span>Click to fire · assign each weapon to a group</span></div>${model.weapons.map(weapon => `<div class="bmfs-hud-weapon-row"><button type="button" data-action="weapon" data-item-id="${escape(weapon.id)}" title="Fire ${escape(weapon.name)}"${weapon.ammunition.sufficient ? "" : " disabled"}><img src="${escape(weapon.img || "icons/svg/item-bag.svg")}" alt=""><span>${escape(weapon.name)}</span><small>D${weapon.damage} · H${weapon.heat} · R ${Number(weapon.range.short) || 0}/${Number(weapon.range.medium) || 0}/${Number(weapon.range.long) || 0}${weapon.ammoPerShot ? ` · A ${weapon.ammunition.current}/${weapon.ammunition.maximum}` : ""}</small></button><select data-action="assign-fire-group" data-item-id="${escape(weapon.id)}" aria-label="${escape(weapon.name)} fire group">${FIRE_GROUPS.map(group => `<option value="${group}"${weapon.group === group ? " selected" : ""}>${group === "alpha" ? "Alpha" : `Group ${group}`}</option>`).join("")}</select></div>`).join("")}</div>` : ""}`;
  element.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const actor = token.actor;
    const run = async () => {
      if (action === "close") return removeTokenActionHud();
      if (action === "hud-lock") {
        const unlocked = element.classList.toggle("bmfs-hud-unlocked");
        for (const category of element.querySelectorAll(".bmfs-hud-category")) category.draggable = unlocked;
        button.innerHTML = `<i class="fa-solid fa-${unlocked ? "lock-open" : "lock"}"></i>`;
        button.title = unlocked ? "Lock HUD category order" : "Unlock and reorganize HUD categories";
        return;
      }
      if (action === "toggle-weapons") {
        const drawer = element.querySelector(".bmfs-hud-weapons");
        if (!drawer) return;
        const opening = drawer.hidden;
        drawer.hidden = !opening;
        button.setAttribute("aria-expanded", String(opening));
        element.classList.toggle("bmfs-hud-weapons-open", opening);
        return;
      }
      if (action === "dice-style") return configureBattleTechDice();
      if (action === "player-console") return renderPlayerConsole();
      if (action === "map-generator") return promptRandomBattleTechMap();
      if (action === "movement") {
        await actor.update({ "system.movement.mode": button.dataset.mode });
        ui.notifications.info(`${actor.name} movement mode: ${button.dataset.mode}.`);
        return;
      }
      if (action === "roll1d6") return rollBattleTechD6({ count: 1, actor, label: `${actor.name} 1D6 Roll` });
      if (action === "roll2d6") return rollBattleTechD6({ count: 2, actor, label: `${actor.name} 2D6 Roll` });
      if (action === "gunnery") return rollBattleTechD6({ count: 2, actor, target: model.gunnery, label: `${actor.name} Gunnery Check` });
      if (action === "piloting") return rollBattleTechD6({ count: 2, actor, target: model.piloting, label: `${actor.name} Piloting Check` });
      if (action === "sheet") return actor.sheet?.render({ force: true });
      if (action === "token") return editActorTokenImage(actor);
      if (action === "weapon") return BMFSMechSheet.onRollWeaponAttack.call({ actor }, event, { closest: () => ({ dataset: { itemId: button.dataset.itemId } }) });
      if (action === "fire-group") return fireWeaponGroup(actor, button.dataset.fireGroup);
      if (action === "punch") return BMFSMechSheet.onRollPhysicalAttack.call({ actor }, event, { dataset: { physicalType: "punch", physicalLimb: "" } });
      if (action === "kick-left") return BMFSMechSheet.onRollPhysicalAttack.call({ actor }, event, { dataset: { physicalType: "kick", physicalLimb: "leftLeg" } });
      if (action === "kick-right") return BMFSMechSheet.onRollPhysicalAttack.call({ actor }, event, { dataset: { physicalType: "kick", physicalLimb: "rightLeg" } });
    };
    void run().then(() => {
      if (["weapon", "fire-group"].includes(action)) refreshTokenActionHud(token);
    }).catch(error => ui.notifications.warn(error.message));
  });
  element.addEventListener("change", event => {
    const select = event.target.closest('select[data-action="assign-fire-group"]');
    if (!select) return;
    void setWeaponFireGroup(token.actor, select.dataset.itemId, select.value).catch(error => ui.notifications.warn(error.message));
  });
  element.addEventListener("contextmenu", event => {
    const button = event.target.closest('button[data-action="weapon"][data-item-id]');
    if (!button) return;
    event.preventDefault();
    token.actor.items.get(button.dataset.itemId)?.sheet?.render?.({ force: true });
  });
  let draggedCategory = null;
  element.addEventListener("dragstart", event => {
    const category = event.target.closest(".bmfs-hud-category");
    if (!category || !element.classList.contains("bmfs-hud-unlocked")) return event.preventDefault();
    draggedCategory = category;
  });
  element.addEventListener("dragover", event => {
    const category = event.target.closest(".bmfs-hud-category");
    if (!draggedCategory || !category || category === draggedCategory) return;
    event.preventDefault();
    category.parentElement.insertBefore(draggedCategory, category);
  });
  element.addEventListener("dragend", () => {
    if (!draggedCategory) return;
    globalThis.localStorage?.setItem(`${SYSTEM_ID}.hudCategoryOrder.${game.user?.id}`, JSON.stringify(
      [...element.querySelectorAll(".bmfs-hud-category")].map(category => category.dataset.category)
    ));
    draggedCategory = null;
  });
  document.body.append(element);
  makeTokenActionHudDraggable(element);
  Hooks.callAll("bmfs.actionHudRendered", element, model, token.actor, token);
}

function runTurnControl(action) {
  void action().catch(error => {
    console.error("BMFS | Turn sequence action failed", error);
    ui.notifications.error(error.message);
  });
}

Hooks.on("getSceneControlButtons", controls => {
  const tokenTools = controls.tokens?.tools;
  if (tokenTools) {
    let diceOrder = Math.max(0, ...Object.values(tokenTools).map(tool => tool.order ?? 0)) + 1;
    tokenTools.bmfsRoll1D6 = {
      name: "bmfsRoll1D6", title: "Roll 1D6", icon: "fa-solid fa-dice-one",
      order: diceOrder++, button: true, visible: true,
      onChange: () => void rollBattleTechD6({ count: 1 })
    };
    tokenTools.bmfsRoll2D6 = {
      name: "bmfsRoll2D6", title: "Roll 2D6", icon: "fa-solid fa-dice",
      order: diceOrder, button: true, visible: true,
      onChange: () => void rollBattleTechD6({ count: 2 })
    };
  }
  if (!game.user.isGM) return;
  const sceneTools = controls.tiles?.tools ?? controls.drawings?.tools;
  if (sceneTools) {
    const mapOrder = Math.max(0, ...Object.values(sceneTools).map(tool => tool.order ?? 0)) + 1;
    sceneTools.bmfsGenerateMap = {
      name: "bmfsGenerateMap",
      title: "Generate Random BattleTech Hex Map",
      icon: "fa-solid fa-map",
      order: mapOrder,
      button: true,
      visible: true,
      onChange: () => runTurnControl(promptRandomBattleTechMap)
    };
  }
  const regionTools = controls.regions?.tools;
  if (regionTools) {
    let order = Math.max(0, ...Object.values(regionTools).map(tool => tool.order ?? 0)) + 1;
    for (const [key, preset] of Object.entries(REGION_TERRAINS)) {
      regionTools[`bmfsTerrain${key}`] = {
        name: `bmfsTerrain${key}`,
        title: `Set BattleTech Terrain: ${preset.label}`,
        icon: key.startsWith("water") ? "fa-solid fa-water" : "fa-solid fa-mountain-sun",
        order: order++,
        button: true,
        visible: true,
        onChange: () => void applyRegionTerrainPreset(key)
      };
    }
    regionTools.bmfsTerrainClear = {
      name: "bmfsTerrainClear",
      title: "Clear BattleTech Terrain",
      icon: "fa-solid fa-eraser",
      order,
      button: true,
      visible: true,
      onChange: () => void applyRegionTerrainPreset(null)
    };
  }

  if (!tokenTools) return;
  let order = Math.max(0, ...Object.values(tokenTools).map(tool => tool.order ?? 0)) + 1;
  tokenTools.bmfsTeamA = {
    name: "bmfsTeamA",
    title: "Assign Controlled Tokens to Team A",
    icon: "fa-solid fa-shield-halved",
    order: order++,
    button: true,
    visible: true,
    onChange: () => runTurnControl(() => assignControlledCombatantsToTeam("Team A"))
  };
  tokenTools.bmfsTeamB = {
    name: "bmfsTeamB",
    title: "Assign Controlled Tokens to Team B",
    icon: "fa-solid fa-shield",
    order: order++,
    button: true,
    visible: true,
    onChange: () => runTurnControl(() => assignControlledCombatantsToTeam("Team B"))
  };
  tokenTools.bmfsTeamClear = {
    name: "bmfsTeamClear",
    title: "Clear Controlled Token Team Assignments",
    icon: "fa-solid fa-user-slash",
    order: order++,
    button: true,
    visible: true,
    onChange: () => runTurnControl(clearControlledCombatantTeams)
  };
  tokenTools.bmfsTeamRoster = {
    name: "bmfsTeamRoster",
    title: "Show BattleTech Team Rosters",
    icon: "fa-solid fa-people-group",
    order: order++,
    button: true,
    visible: true,
    onChange: () => runTurnControl(showBattleTechTeamRoster)
  };
  tokenTools.bmfsStartTurn = {
    name: "bmfsStartTurn",
    title: "Start BattleTech Turn",
    icon: "fa-solid fa-dice",
    order: order++,
    button: true,
    visible: true,
    onChange: () => runTurnControl(startBattleTechTurn)
  };
  tokenTools.bmfsRecordSelection = {
    name: "bmfsRecordSelection",
    title: "Record Controlled BattleTech Selection",
    icon: "fa-solid fa-list-check",
    order: order++,
    button: true,
    visible: true,
    onChange: () => runTurnControl(recordControlledBattleTechSelections)
  };
  tokenTools.bmfsAdvancePhase = {
    name: "bmfsAdvancePhase",
    title: "Advance BattleTech Phase",
    icon: "fa-solid fa-forward-step",
    order: order++,
    button: true,
    visible: true,
    onChange: () => runTurnControl(advanceBattleTechPhase)
  };
  tokenTools.bmfsGatorPrevious = {
    name: "bmfsGatorPrevious", title: "Previous GATOR Step", icon: "fa-solid fa-backward-step",
    order: order++, button: true, visible: true,
    onChange: () => runTurnControl(() => shiftGatorStep(-1))
  };
  tokenTools.bmfsGatorNext = {
    name: "bmfsGatorNext", title: "Advance GATOR Step", icon: "fa-solid fa-forward",
    order: order++, button: true, visible: true,
    onChange: () => runTurnControl(() => shiftGatorStep(1))
  };
  tokenTools.bmfsGatorReset = {
    name: "bmfsGatorReset", title: "Reset GATOR Sequence", icon: "fa-solid fa-rotate-left",
    order, button: true, visible: true,
    onChange: () => runTurnControl(() => setGatorStep(0))
  };
});

Hooks.on("renderCombatTracker", (_application, html) => {
  const root = html?.querySelector ? html : html?.[0];
  if (!root) return;
  root.querySelector(".bmfs-combat-gator")?.remove();
  const index = activeGatorStepIndex();
  const indicator = document.createElement("section");
  indicator.className = "bmfs-combat-gator";
  indicator.innerHTML = `<strong>GATOR</strong><span>${index + 1}/5 · ${foundry.utils.escapeHTML(GATOR_STEPS[index][1])}</span>`;
  root.prepend(indicator);
});

Hooks.on("controlToken", (token, controlled) => refreshTokenActionHud(controlled ? token : null));
Hooks.on("updateActor", actor => {
  const controlled = canvas?.tokens?.controlled?.find(token => token.actor?.id === actor.id);
  if (controlled) refreshTokenActionHud(controlled);
});
Hooks.on("updateItem", item => {
  const actor = item.parent;
  const controlled = canvas?.tokens?.controlled?.find(token => token.actor?.id === actor?.id);
  if (controlled) refreshTokenActionHud(controlled);
});
Hooks.on("canvasReady", () => refreshTokenActionHud());
Hooks.on("canvasTearDown", removeTokenActionHud);

Hooks.on("preMoveToken", (token, movement) => {
  pendingTokenMovementPlans.delete(movement.id);
  if (gamemasterBypassesTokenMovementRestrictions()) return;
  if (token.actor?.type !== "mech" || !token.isOwner) return;
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
  if (token.actor?.type === "mech") {
    const mode = plan?.mode ?? token.actor.system?.movement?.mode ?? "walk";
    void broadcastCombatEffect({
      kind: "movement",
      originTokenId: token.id ?? token.document?.id,
      targetTokenId: token.id ?? token.document?.id,
      mode,
      audio: game.settings.get(SYSTEM_ID, "movementAudio")
    });
  }
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
  CONFIG.Actor.dataModels.vehicle = VehicleDataModel;
  CONFIG.Item.dataModels.weapon = WeaponDataModel;
  CONFIG.Item.dataModels.equipment = EquipmentDataModel;
  CONFIG.Item.dataModels.ammo = AmmoDataModel;
  if (CONFIG.Canvas?.vfx) CONFIG.Canvas.vfx.enabled = true;

  game.settings.register(SYSTEM_ID, "coreContentVersion", {
    name: "BMFS Core Content Version",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
  game.settings.register(SYSTEM_ID, "weaponEffects", {
    name: "Enable BattleMech weapon visual effects",
    hint: "Uses Foundry VTT 14's built-in VFX framework for weapon projectiles and impacts.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(SYSTEM_ID, "weaponAudio", {
    name: "Enable BattleMech procedural weapon audio",
    hint: "Plays lightweight locally generated weapon tones without third-party audio files.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(SYSTEM_ID, "movementAudio", {
    name: "Enable synchronized BattleMech movement audio",
    hint: "Plays distinct heavy walking, faster running, and jump movement sounds for every connected client.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(SYSTEM_ID, "missionData", {
    name: "BattleMech mission data",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });
  game.settings.register(SYSTEM_ID, "mechActivationEffects", {
    name: "Enable BattleMech activation visual effects",
    hint: "Shows each original BattleMech's unique portrait pulse when its phase selection is recorded.",
    scope: "client", config: true, type: Boolean, default: true
  });
  game.settings.register(SYSTEM_ID, "mechActivationAudio", {
    name: "Enable BattleMech activation audio",
    hint: "Plays each original BattleMech's packaged activation sound when its phase selection is recorded.",
    scope: "client", config: true, type: Boolean, default: true
  });
  game.settings.register(SYSTEM_ID, "jb2aEffects", {
    name: "Prefer JB2A weapon effects when available",
    hint: "Uses the JB2A Free and Sequencer module APIs when both are active, with the built-in effects as a fallback.",
    scope: "client", config: true, type: Boolean, default: true
  });
  game.settings.register(SYSTEM_ID, "tokenActionHud", {
    name: "Show BattleTech token action HUD",
    hint: "Shows a movable action hub with D6 checks, record sheet, token editing, physical attacks, and weapons for the controlled unit.",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: () => refreshTokenActionHud()
  });
  game.settings.register(SYSTEM_ID, "visualDice", {
    name: "Show animated BattleTech D6 rolls",
    hint: "Displays built-in animated D6 results on screen without requiring an additional module.",
    scope: "client", config: true, type: Boolean, default: true
  });
  game.settings.register(SYSTEM_ID, "diceBodyColor", {
    name: "BattleTech visual dice color",
    hint: "Six-digit HTML color used for the animated dice body. The action hub palette button provides a color picker.",
    scope: "client", config: true, type: String, default: "#1c6dd0"
  });
  game.settings.register(SYSTEM_ID, "dicePipColor", {
    name: "BattleTech visual dice pip color",
    hint: "Six-digit HTML color used for the animated dice pips.",
    scope: "client", config: true, type: String, default: "#ffffff"
  });
  game.settings.register(SYSTEM_ID, "diceSize", {
    name: "BattleTech visual dice size",
    hint: "Pixel size of each animated die, from 48 to 110.",
    scope: "client", config: true, type: Number, default: 72,
    range: { min: 48, max: 110, step: 2 }
  });
  game.keybindings?.register?.(SYSTEM_ID, "togglePlayerConsole", {
    name: "Open Pilot and Lance Window",
    hint: "Opens the resizable Overview, Lance, Mission, and Mech Bay player window.",
    editable: [{ key: "KeyP" }],
    onDown: () => {
      renderPlayerConsole();
      return true;
    },
    restricted: false,
    precedence: globalThis.CONST?.KEYBINDING_PRECEDENCE?.NORMAL ?? 0
  });

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

  DocumentSheetConfig.registerSheet(foundry.documents.Actor, SYSTEM_ID, BMFSVehicleSheet, {
    types: ["vehicle"],
    makeDefault: true,
    label: "Combat Vehicle Sheet"
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
    calculateAttackTargetNumber,
    calculatePhysicalAttack,
    calculateTokenPhysicalAttacks,
    physicalHitLocation,
    ammunitionTypeForWeapon,
    ammunitionUnitsPerAttack,
    legacyAmmunitionMigration,
    missileLauncherProfile,
    planAmmunitionConsumption,
    resolveMissileCluster,
    selectAmmunitionBin,
    pilotingCheckProfile,
    fallDamage,
    facingAfterFall,
    calculateHeatPhase,
    heatEffectProfile,
    hitLocation,
    determineCriticalHits,
    applyMechDamage,
    criticalSlotFromRolls,
    buildCriticalTable,
    eligibleCriticalSlots,
    itemSlotNumbers,
    weaponCriticalModifier,
    calculateTerrainProfile,
    calculateTokenWeaponAttack,
    summarizeRegionTerrainPath,
    summarizeElevationPath,
    summarizeCombatTerrainPath,
    applyRegionTerrainPreset,
    installCoreCompendiums,
    playWeaponEffect,
    weaponEffectProfile,
    playMeleeEffect,
    meleeEffectProfile,
    playMovementEffect,
    movementEffectProfile,
    scatterAdjacentHex,
    collateralTokenAtOffset,
    broadcastCombatEffect,
    playMechActivationEffect,
    mechPresentationProfile,
    rollBattleTechD6,
    weaponDiceTheme,
    applyWeaponDiceAppearance,
    diceSoNiceAvailable,
    animateBattleTechRoll,
    postBattleTechRoll,
    showBattleTechDiceRoll,
    configureBattleTechDice,
    renderPlayerConsole,
    playerConsoleModel,
    unitCondition,
    unitReadiness,
    promptRandomBattleTechMap,
    createRandomBattleTechScene,
    randomBattleTechMapPlan,
    targetingArc,
    aerospaceFiringArcForBearing,
    aerospaceTargetingArc,
    tokenizerTargetingFrames: TOKENIZER_TARGETING_FRAMES,
    makeTokenActionHudDraggable,
    activeGatorStepIndex,
    gatorHudModel,
    setGatorStep,
    shiftGatorStep,
    gatorSteps: GATOR_STEPS,
    setWeaponFireGroup,
    fireWeaponGroup,
    migrateLegacyAmmunitionBins,
    weaponAttackFailure,
    activeGamemaster,
    validateWeaponAttackAuthority,
    validatePhysicalAttackAuthority,
    requestAuthoritativeWeaponAttack,
    requestAuthoritativePhysicalAttack,
    performWeaponAttack,
    performPhysicalAttack,
    withCombatActionLock,
    editActorTokenImage,
    tokenActionHudModel,
    weaponFireGroup,
    fireGroups: FIRE_GROUPS,
    movementAllowance,
    gamemasterBypassesTokenMovementRestrictions,
    targetMovementModifier,
    turnPhases: TURN_PHASES,
    alternatingTurnPhases: ALTERNATING_PHASES,
    combatTeams: COMBAT_TEAMS,
    maximumTeamSize: MAX_TEAM_SIZE,
    normalizeCombatTeam,
    validateCombatTeamRosters,
    storeCatalog: STORE_CATALOG,
    campaignLedger,
    adjustMNotes,
    executePurchase,
    requestStorePurchase,
    combatTeamRoster,
    assignControlledCombatantsToTeam,
    clearControlledCombatantTeams,
    showBattleTechTeamRoster,
    startBattleTechTurn,
    recordControlledBattleTechSelections,
    advanceBattleTechPhase,
    processCombatEndPhase,
    currentTurnSequence: () => (game.combats?.active ?? game.combat)?.getFlag(SYSTEM_ID, TURN_SEQUENCE_FLAG) ?? null,
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
  void registerTokenizerTargetingFrames().catch(error => console.warn("BMFS | Tokenizer targeting frames could not be registered", error));

  configureCombatEffectSocket();
  configureEconomySocket();

  console.log("BMFS | Ready", game.bmfs.runDiagnostics());
  ui.notifications.info(`BattleMech Foundry System ${SYSTEM_VERSION} loaded.`);
  if (game.user.isGM) {
    void migrateLegacyAmmunitionBins().catch(error => {
      console.error("BMFS | Ammunition migration failed", error);
      ui.notifications.error(`BattleMech ammunition migration failed: ${error.message}`);
    });
  }
  if (game.user.isGM && game.settings.get(SYSTEM_ID, "coreContentVersion") !== SYSTEM_VERSION) {
    void installCoreCompendiums()
      .then(result => game.settings.set(SYSTEM_ID, "coreContentVersion", SYSTEM_VERSION)
        .then(() => ui.notifications.info(`BMFS core compendiums ready: ${result.items} items, ${result.vehicles} vehicles, and ${result.mechs} BattleMechs.`)))
      .catch(error => {
        console.error("BMFS | Core compendium installation failed", error);
        ui.notifications.error(`BMFS core compendiums could not be installed: ${error.message}`);
      });
  }
});
