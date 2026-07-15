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
  tokenActionHudModel,
  tokenizerIntegrationState
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
import { mechPresentationProfile, playMechActivationEffect, playWeaponEffect, weaponEffectProfile } from "../module/effects.js";
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
  missileLauncherProfile,
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

const SYSTEM_ID = "battletech-foundry-system";
const SYSTEM_VERSION = "0.10.0-alpha.0";
const TARGET_FOUNDRY = "14.364";
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
      return;
    }
    if (weapon.system.destroyed) {
      ui.notifications.warn(`${weapon.name} is destroyed and cannot fire.`);
      return;
    }

    const targets = [...game.user.targets].filter(token => token.actor?.type === "mech");
    if (targets.length !== 1) {
      ui.notifications.warn("Target exactly one BattleMech token before making a weapon attack.");
      return;
    }

    let attack;
    try {
      attack = calculateTokenWeaponAttack(this.actor, weapon, targets[0]);
    } catch (error) {
      ui.notifications.error(error.message);
      return;
    }

    const escape = foundry.utils.escapeHTML;
    const targetActor = targets[0].actor;
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
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<section class="bmfs-chat-card">
          <h3>${escape(this.actor.name)} cannot attack ${escape(targetActor.name)}</h3>
          <p>${escape(attack.reason)}</p>
          <p>Range ${attack.distance} hexes; terrain: ${escape(terrainSummary)}.</p>
        </section>`
      });
      ui.notifications.warn(attack.reason);
      return;
    }

    let ammunitionBin = null;
    let ammunitionRemaining = null;
    if (Number(weapon.system.ammoPerShot) > 0) {
      ammunitionBin = selectAmmunitionBin(this.actor.items, weapon.name);
      if (!ammunitionBin) {
        const ammunitionType = ammunitionTypeForWeapon(weapon.name) ?? weapon.name;
        ui.notifications.warn(`${weapon.name} cannot fire: no loaded ${ammunitionType} ammunition bin is available.`);
        return;
      }
      ammunitionRemaining = Number(ammunitionBin.system.shots) - 1;
      await updateEmbeddedItemSystem(ammunitionBin, { shots: ammunitionRemaining });
    }

    const roll = await new Roll("2d6").evaluate();
    const hit = roll.total >= attack.targetNumber;
    if (game.settings.get(SYSTEM_ID, "weaponEffects")) {
      void playWeaponEffect(activeSceneToken(this.actor), targets[0], weapon, {
        hit,
        audio: game.settings.get(SYSTEM_ID, "weaponAudio"),
        jb2a: game.settings.get(SYSTEM_ID, "jb2aEffects")
      }).catch(error => console.warn("BMFS | Weapon effect failed", error));
    }
    const weaponHeat = Number(weapon.system.heat) || 0;
    await this.actor.update({
      "system.heat.current": (Number(this.actor.system.heat.current) || 0) + weaponHeat
    });
    await recordFiredWeaponLocation(this.actor, weapon.system.location);
    let cluster = null;
    let damageResults = [];
    if (hit) {
      const launcher = missileLauncherProfile(weapon.name);
      if (launcher) {
        const clusterRoll = await new Roll("2d6").evaluate();
        cluster = resolveMissileCluster(weapon.name, clusterRoll.total);
        for (const group of cluster.damageGroups) {
          damageResults.push(await resolveWeaponHit(this.actor, weapon, targets[0], group));
        }
      } else {
        damageResults = [await resolveWeaponHit(this.actor, weapon, targets[0])];
      }
    }
    const destroyedLocations = [...new Set(damageResults.flatMap(result => result.destroyedLocations))];
    const criticalSummaries = damageResults.map(result => result.criticalSummary).filter(Boolean);
    const damageSummary = damageResults.map((result, index) =>
      `Hit ${index + 1}: ${result.locationLabel} (${result.direction}, roll ${result.locationRoll}); ${result.damage} damage: ${result.armorDamage} armor, ${result.structureDamage} internal.`
    ).join("<br>");
    const signed = value => value >= 0 ? `+${value}` : String(value);
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<section class="bmfs-chat-card">
        <h3>${escape(weapon.name)} vs. ${escape(targetActor.name)}: ${hit ? "HIT" : "MISS"}</h3>
        <p>Target Number ${attack.targetNumber}; range ${attack.distance} (${escape(attack.range.bracket)}).</p>
        <p>GATOR: ${breakdown.gunnery} Gunnery, ${signed(breakdown.attackerMovement + breakdown.attackerStatus)} attacker, ${signed(breakdown.targetMovement + breakdown.targetStatus)} target, ${signed(breakdown.terrain)} terrain, ${signed(breakdown.heat)} heat, ${signed(breakdown.range)} range, ${signed(breakdown.sensors + breakdown.weaponDamage)} critical damage.</p>
        <p>Terrain: ${escape(terrainSummary)}.</p>
        <p>Weapon heat: +${weaponHeat}.</p>
        ${ammunitionBin ? `<p>Ammunition: 1 shot from ${escape(ammunitionBin.name)}; ${ammunitionRemaining} remaining.</p>` : ""}
        ${cluster ? `<p>Cluster roll ${cluster.roll}: ${cluster.missilesHit} of ${cluster.size} ${cluster.family} missiles hit in ${cluster.damageGroups.length} damage group(s).</p>` : ""}
        ${damageSummary ? `<p>${damageSummary}</p>` : ""}
        ${destroyedLocations.length ? `<p>Destroyed: ${escape(destroyedLocations.join(", "))}.</p>` : ""}
        ${criticalSummaries.length ? `<p>${escape(criticalSummaries.join("; "))}</p>` : ""}
      </section>`
    });
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

      await this.actor.setFlag(SYSTEM_ID, "physicalAttackDeclared", true);
      for (const attack of legal) {
        const roll = await new Roll("2d6").evaluate();
        const hit = attack.automaticHit || (!attack.automaticFailure && roll.total >= attack.targetNumber);
        const damage = hit ? await resolvePhysicalHit(this.actor, targets[0], attack) : null;
        const pilotingCheck = attack.type === "kick"
          ? hit
            ? `${targets[0].actor.name} makes an automatic Piloting Skill Roll after this kick.`
            : `${this.actor.name} makes an automatic Piloting Skill Roll after this missed kick.`
          : "No automatic Piloting Skill Roll is caused by this punch.";

        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          flavor: `<section class="bmfs-chat-card bmfs-physical-card">
            <h3>${escape(locationLabel(attack.limb))} ${escape(attack.label)} vs. ${escape(targets[0].actor.name)}: ${hit ? "HIT" : "MISS"}</h3>
            <p>Target Number ${attack.targetNumber}; rolled ${roll.total}. Damage ${attack.damage}.</p>
            <p>Physical attack: ${attack.components.piloting} Piloting, ${signed(attack.components.attackType)} type, ${signed(attack.components.attackerMovement)} attacker movement, ${signed(attack.components.targetMovement + attack.components.targetStatus)} target, ${signed(attack.components.terrain)} terrain, ${signed(attack.components.actuator)} actuator.</p>
            ${damage ? `<p>${escape(damage.locationLabel)} (${damage.direction}, ${escape(attack.locationTable)} roll ${damage.locationRoll}): ${damage.damage} damage; ${damage.armorDamage} armor, ${damage.structureDamage} internal.</p>` : ""}
            ${damage?.destroyedLocations.length ? `<p>Destroyed: ${escape(damage.destroyedLocations.join(", "))}.</p>` : ""}
            ${damage?.criticalSummary ? `<p>${escape(damage.criticalSummary)}</p>` : ""}
            <p>${escape(pilotingCheck)}</p>
          </section>`
        });
        if (attack.type === "kick") {
          const checkActor = hit ? targets[0].actor : this.actor;
          const checkToken = hit ? targets[0] : activeSceneToken(this.actor);
          await resolvePilotingSkillRoll(checkActor, checkToken, {
            reason: hit ? "kicked" : "missed kick"
          });
        }
      }
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
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<section class="bmfs-chat-card"><h3>${escape(actor.name)}: Piloting Skill Roll Passed</h3><p>${escape(reason)}; target ${profile.targetNumber}, rolled ${roll.total}.</p></section>`
    });
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
  if (roll) await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: content });
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

function calculateTokenPhysicalAttacks(actor, type, target, requestedLimb = null) {
  const source = activeSceneToken(actor);
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

function calculateTokenWeaponAttack(actor, weapon, target) {
  const source = activeSceneToken(actor);
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

async function synchronizeCompendium(pack, documents, { prune = false } = {}) {
  await pack.configure({ locked: false });
  try {
    const index = await pack.getIndex();
    if (prune) {
      const expectedNames = new Set(documents.map(document => document.name));
      const obsoleteIds = [...index].filter(entry => !expectedNames.has(entry.name)).map(entry => entry._id);
      if (obsoleteIds.length) await pack.documentClass.deleteDocuments(obsoleteIds, { pack: pack.collection });
    }
    for (const source of documents) {
      const data = foundry.utils.deepClone(source);
      const existing = index.find(entry => entry.name === data.name);
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
  await synchronizeCompendium(vehiclePack, CORE_VEHICLES);
  for (const [weightClass, pack] of Object.entries(mechPacks)) {
    await synchronizeCompendium(pack, CORE_MECHS_BY_CLASS[weightClass], { prune: true });
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
  const sides = groupCombatantsBySide(combatants, SYSTEM_ID);
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
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker(actor ? { actor } : {}),
    flavor: `<section class="bmfs-chat-card"><h3>${foundry.utils.escapeHTML(label)}${result}</h3>${outcome ? `<p>Target ${outcome.target}; rolled ${outcome.total}.</p>` : ""}</section>`
  });
  return { roll, outcome };
}

function removeTokenActionHud() {
  globalThis.document?.getElementById("bmfs-token-action-hud")?.remove();
}

function refreshTokenActionHud(preferredToken = null) {
  removeTokenActionHud();
  if (!game.settings.get(SYSTEM_ID, "tokenActionHud")) return;
  const token = preferredToken?.controlled
    ? preferredToken
    : canvas?.tokens?.controlled?.find(candidate => ["mech", "vehicle"].includes(candidate.actor?.type));
  const model = tokenActionHudModel(token?.actor);
  if (!model || !globalThis.document?.body) return;
  const escape = foundry.utils.escapeHTML;
  const element = document.createElement("section");
  element.id = "bmfs-token-action-hud";
  element.innerHTML = `<header><img src="${escape(model.actorImage)}" alt=""><strong>${escape(model.actorName)}</strong><button type="button" data-action="close" title="Hide HUD"><i class="fa-solid fa-xmark"></i></button></header>
    <div class="bmfs-hud-status"><span>${escape(model.movement)}</span>${model.heat === null ? "" : `<span>Heat ${model.heat}</span>`}</div>
    <div class="bmfs-hud-group"><strong>Dice</strong><button type="button" data-action="roll1d6">1D6</button><button type="button" data-action="roll2d6">2D6</button><button type="button" data-action="gunnery">Gunnery ${model.gunnery}+</button><button type="button" data-action="piloting">Piloting ${model.piloting}+</button></div>
    <div class="bmfs-hud-group"><strong>Unit</strong><button type="button" data-action="sheet">Record Sheet</button><button type="button" data-action="token">Edit Token</button>${model.actorType === "mech" ? `<button type="button" data-action="punch">Punch</button><button type="button" data-action="kick-left">Kick L</button><button type="button" data-action="kick-right">Kick R</button>` : ""}</div>
    ${model.weapons.length ? `<div class="bmfs-hud-group bmfs-hud-weapons"><strong>Weapons</strong>${model.weapons.map(weapon => `<button type="button" data-action="weapon" data-item-id="${escape(weapon.id)}">${escape(weapon.name)}</button>`).join("")}</div>` : ""}`;
  element.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const actor = token.actor;
    const run = async () => {
      if (action === "close") return removeTokenActionHud();
      if (action === "roll1d6") return rollBattleTechD6({ count: 1, actor, label: `${actor.name} 1D6 Roll` });
      if (action === "roll2d6") return rollBattleTechD6({ count: 2, actor, label: `${actor.name} 2D6 Roll` });
      if (action === "gunnery") return rollBattleTechD6({ count: 2, actor, target: model.gunnery, label: `${actor.name} Gunnery Check` });
      if (action === "piloting") return rollBattleTechD6({ count: 2, actor, target: model.piloting, label: `${actor.name} Piloting Check` });
      if (action === "sheet") return actor.sheet?.render({ force: true });
      if (action === "token") return editActorTokenImage(actor);
      if (action === "weapon") return BMFSMechSheet.onRollWeaponAttack.call({ actor }, event, { closest: () => ({ dataset: { itemId: button.dataset.itemId } }) });
      if (action === "punch") return BMFSMechSheet.onRollPhysicalAttack.call({ actor }, event, { dataset: { physicalType: "punch", physicalLimb: "" } });
      if (action === "kick-left") return BMFSMechSheet.onRollPhysicalAttack.call({ actor }, event, { dataset: { physicalType: "kick", physicalLimb: "leftLeg" } });
      if (action === "kick-right") return BMFSMechSheet.onRollPhysicalAttack.call({ actor }, event, { dataset: { physicalType: "kick", physicalLimb: "rightLeg" } });
    };
    void run().catch(error => ui.notifications.warn(error.message));
  });
  document.body.append(element);
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
    order,
    button: true,
    visible: true,
    onChange: () => runTurnControl(advanceBattleTechPhase)
  };
});

Hooks.on("controlToken", (token, controlled) => refreshTokenActionHud(controlled ? token : null));
Hooks.on("canvasReady", () => refreshTokenActionHud());
Hooks.on("canvasTearDown", removeTokenActionHud);

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
    hint: "Shows D6 checks, record sheet, token editing, physical attacks, and weapons for the controlled unit.",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: () => refreshTokenActionHud()
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
    missileLauncherProfile,
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
    playMechActivationEffect,
    mechPresentationProfile,
    rollBattleTechD6,
    editActorTokenImage,
    tokenActionHudModel,
    movementAllowance,
    targetMovementModifier,
    turnPhases: TURN_PHASES,
    alternatingTurnPhases: ALTERNATING_PHASES,
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

  console.log("BMFS | Ready", game.bmfs.runDiagnostics());
  ui.notifications.info(`BattleMech Foundry System ${SYSTEM_VERSION} loaded.`);
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
