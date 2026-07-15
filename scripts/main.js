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
const SYSTEM_VERSION = "0.10.1-alpha.0";
const ACTION_HUD_POSITION_KEY = `${SYSTEM_ID}.tokenActionHudPosition`;
const DICE_GLYPHS = ["âš€", "âš", "âš‚", "âšƒ", "âš„", "âš…"];
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

    const …13452 tokens truncated…tils.escapeHTML(label)}</div><div class="bmfs-dice-row">${results.map((result, index) => `<div class="bmfs-visual-die" style="--bmfs-die-index:${index}" data-result="${result}"><span>${DICE_GLYPHS[result - 1]}</span></div>`).join("")}</div><div class="bmfs-dice-total">Total ${Number(roll.total)}</div>`;
  document.body.append(overlay);
  globalThis.setTimeout?.(() => overlay.classList.add("bmfs-dice-finished"), 1050);
  globalThis.setTimeout?.(() => overlay.remove(), 2800);
  return overlay;
}

async function configureBattleTechDice() {
  const appearance = battleTechDiceAppearance();
  const result = await foundry.applications.api.DialogV2.input({
    window: { title: "BattleTech Visual Dice" },
    content: `<div class="bmfs-dice-config"><p>Choose the appearance used by the built-in animated D6 rolls.</p><label><input type="checkbox" name="enabled" ${appearance.enabled ? "checked" : ""}> Show visual dice</label><label>Dice color <input type="color" name="body" value="${appearance.body}"></label><label>Pip color <input type="color" name="pips" value="${appearance.pips}"></label><label>Dice size <input type="range" name="size" min="48" max="110" step="2" value="${appearance.size}"></label></div>`,
    ok: { label: "Save and Preview" },
    rejectClose: false,
    modal: true
  });
  if (!result) return;
  const values = result.object ?? Object.fromEntries(result.entries?.() ?? []);
  await game.settings.set(SYSTEM_ID, "visualDice", values.enabled === true || values.enabled === "on");
  await game.settings.set(SYSTEM_ID, "diceBodyColor", validDiceColor(values.body, appearance.body));
  await game.settings.set(SYSTEM_ID, "dicePipColor", validDiceColor(values.pips, appearance.pips));
  await game.settings.set(SYSTEM_ID, "diceSize", Math.min(110, Math.max(48, Number(values.size) || appearance.size)));
  if (game.settings.get(SYSTEM_ID, "visualDice")) {
    showBattleTechDiceRoll({ dice: [{ faces: 6, results: [{ result: 2 }, { result: 5 }] }], total: 7 }, "Dice Preview");
  }
}

function savedTokenActionHudPosition() {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(ACTION_HUD_POSITION_KEY) ?? "null");
    return Number.isFinite(saved?.left) && Number.isFinite(saved?.top) ? saved : null;
  } catch {
    return null;
  }
}

function positionTokenActionHud(element, position) {
  if (!position) return;
  const width = element.offsetWidth || 540;
  const height = element.offsetHeight || 240;
  const left = Math.max(0, Math.min(position.left, globalThis.innerWidth - width));
  const top = Math.max(0, Math.min(position.top, globalThis.innerHeight - height));
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  element.style.bottom = "auto";
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
      const finalRect = element.getBoundingClientRect();
      globalThis.localStorage?.setItem(ACTION_HUD_POSITION_KEY, JSON.stringify({ left: finalRect.left, top: finalRect.top }));
    };
    globalThis.addEventListener("pointermove", move);
    globalThis.addEventListener("pointerup", end, { once: true });
  });
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
  element.innerHTML = `<header class="bmfs-hud-drag-handle" title="Drag to move the action hub"><img src="${escape(model.actorImage)}" alt=""><strong>${escape(model.actorName)}</strong><button type="button" data-action="dice-style" title="Customize visual dice"><i class="fa-solid fa-palette"></i></button><button type="button" data-action="close" title="Hide HUD"><i class="fa-solid fa-xmark"></i></button></header>
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
      if (action === "dice-style") return configureBattleTechDice();
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
  makeTokenActionHudDraggable(element);
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
    showBattleTechDiceRoll,
    configureBattleTechDice,
    makeTokenActionHudDraggable,
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

