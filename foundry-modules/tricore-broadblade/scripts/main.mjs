const MODULE_ID = "tricore-broadblade";
const FLAG = "configuration";
const CORE_ORDER = ["empty", "red", "blue", "green", "yellow"];
const CORE = {
  empty: { icon: "◇", label: "Empty", damage: "" },
  red: { icon: "🔥", label: "Ruby / Fire", damage: "1d6[fire]" },
  blue: { icon: "❄️", label: "Sapphire / Water-Ice", damage: "1d6[cold]" },
  green: { icon: "⚡", label: "Emerald / Wind-Electricity", damage: "1d6[electricity]" },
  yellow: { icon: "🪨", label: "Topaz / Earth", damage: "1d6[bludgeoning]" }
};

const C = (id, name, sockets, passive, damage, technique) => ({ id, name, sockets, passive, damage, technique });
const T = (name, actions, frequency, formula, defense, effect, kind = "damage") => ({ name, actions, frequency, formula, defense, effect, kind });

const PRESETS = [
  C("inferno", "Inferno", ["red","red","red"], "Primary damage becomes 2d6 fire.", "2d6[fire]", T("Inferno Cleave",2,"once per day","4d6[fire]","Make one Strike against every enemy within reach.","Each Strike gains this fire damage; a critically hit creature also takes 2d6 persistent fire.")),
  C("absolute-zero", "Absolute Zero", ["blue","blue","blue"], "Primary damage becomes 2d6 cold.", "2d6[cold]", T("Frozen Moment",2,"once per day","","DC 34 Fortitude; enemies in a 20-foot emanation.","Critical Success unaffected; Success slowed 1 for 1 round; Failure slowed 1 for 1 minute; Critical Failure slowed 2 for 1 round, then slowed 1 for 1 minute.","effect")),
  C("tempest", "Tempest", ["green","green","green"], "Primary damage becomes 2d6 electricity; Speed bonus becomes +10 feet.", "2d6[electricity]", T("Tempest Dance",2,"once per day","","Stride up to three times your Speed.","Make up to three Strikes against different creatures; MAP does not increase until the activity ends.","effect")),
  C("worldbreaker", "Worldbreaker", ["yellow","yellow","yellow"], "Primary damage becomes 2d6 bludgeoning.", "2d6[bludgeoning]", T("Worldbreaker",2,"once per day","12d6[bludgeoning]","DC 34 basic Reflex; 30-foot emanation.","Failure prone; critical failure also stunned 1.")),

  C("primal-storm", "Primal Storm", ["red","blue","green"], "Unstable fire, cold, and electricity coexist in the blade.", "1d6[fire]", T("Primal Storm",2,"once per day","4d6[fire]+4d6[cold]+4d6[electricity]","DC 34 basic Reflex; 20-foot burst at a point within 60 feet.","")),
  C("elemental-paradox", "Elemental Paradox (RGB alternate)", ["red","blue","green"], "For 3 rounds, each Strike chooses fire, cold, or electricity and deals +2d6; this damage ignores resistance equal to your level.", "2d6[fire]", T("Elemental Paradox",1,"once per day","","Self; lasts 3 rounds.","Choose fire, cold, or electricity for each Strike; +2d6 of that type and ignore resistance equal to your level.","effect")),
  C("obsidian-forge", "Obsidian Forge", ["red","blue","yellow"], "For 1 minute the sword gains deadly d12 and ignores 10 physical resistance; object Hardness is 10 lower.", "", T("Obsidian Forge",1,"once per day","","Self; lasts 1 minute.","Gain deadly d12; ignore 10 physical resistance and reduce object/structure Hardness by 10.","effect")),
  C("volcanic-tempest", "Volcanic Tempest", ["red","green","yellow"], "Fire, wind, and earth gather beneath the edge.", "", T("Volcanic Tempest",2,"once per day","12d6[fire]","DC 34 basic Reflex; 60-foot line.","Damage is fire/bludgeoning. Failure also causes 2d6 persistent fire. The line is difficult terrain until the beginning of your next turn.")),
  C("raging-sea", "Raging Sea", ["blue","green","yellow"], "The blade summons a crushing surge of elemental water.", "", T("Raging Sea",2,"once per day","10d6[bludgeoning]","DC 34 Reflex; 60-foot line.","Damage is bludgeoning/cold. Failure pushes 20 feet and knocks prone; critical failure pushes 40 feet, knocks prone, and deals +2d6 cold.")),

  C("thermal-shock", "Crimson Frost / Thermal Shock", ["red","red","blue"], "Thermal Edge: Strikes deal +1d6 fire +1d6 cold; reduce either resistance by 5.", "1d6[fire]+1d6[cold]", T("Thermal Shock",2,"once per 10 minutes","4d6[fire]+4d6[cold]","DC 34 Fortitude after a Broadblade Strike.","Success enfeebled 1 until end of next turn; Failure enfeebled 1 and off-guard 1 round; Critical Failure enfeebled 2, off-guard 1 round, stunned 1. Ignore 10 Hardness/physical resistance against objects, shields, constructs, or metal armor.")),
  C("firestorm", "Firestorm", ["red","red","green"], "Strikes deal +2d6 fire; critical hits cause 1d6 persistent fire.", "2d6[fire]", T("Firestorm Cyclone",2,"once per 10 minutes","8d6[fire]+2d6[slashing]","DC 34 basic Reflex; 15-foot cone.","Failure also causes 1d6 persistent fire.")),
  C("magma-blade", "Magma Blade", ["red","red","yellow"], "Strikes deal +1d6 fire +1d6 bludgeoning.", "1d6[fire]+1d6[bludgeoning]", T("Molten Rupture",2,"once per 10 minutes","6d6[fire]+4d6[bludgeoning]","DC 34 basic Reflex; 20-foot burst within 60 feet.","Failure prone; critical failure prone and 2d6 persistent fire. Ground becomes difficult terrain for 1 minute.")),
  C("frostfire", "Frostfire", ["blue","blue","red"], "Strikes deal +2d6 cold; critical hits give –10-foot Speed for 1 round.", "2d6[cold]", T("Frostfire Prison",2,"once per 10 minutes","6d6[cold]+2d6[fire]","DC 34 Reflex after a Strike.","Failure immobilized in ice, Escape DC 34. Prison Hardness 10, 40 HP. Target takes 2d6 fire at the end of each turn until escape.")),
  C("blizzard", "Blizzard", ["blue","blue","green"], "Strikes deal +2d6 cold.", "2d6[cold]", T("Whiteout",2,"once per 10 minutes","3d6[cold]","20-foot emanation for 3 rounds.","Enemies entering or starting inside take damage; difficult terrain; creatures over 10 feet away are concealed. You see normally through the storm.")),
  C("glacier", "Glacier", ["blue","blue","yellow"], "Strikes deal +1d6 cold +1d6 bludgeoning.", "1d6[cold]+1d6[bludgeoning]", T("Glacial Wall",2,"once per 10 minutes","","Wall up to 30 feet long × 15 feet high × 5 feet thick; lasts 1 minute.","Each 10-foot section: AC 10, Hardness 15, HP 60.","effect")),
  C("lightning-flame", "Lightning Flame", ["green","green","red"], "Strikes deal +1d6 electricity +1d6 fire.", "1d6[electricity]+1d6[fire]", T("Plasma Dash",2,"once per 10 minutes","4d6[electricity]+4d6[fire]","DC 34 basic Reflex for up to three creatures passed.","Stride up to twice Speed without triggering reactions; move through enemy spaces.")),
  C("stormfrost", "Stormfrost", ["green","green","blue"], "Strikes deal +2d6 electricity and you gain +10 feet Speed.", "2d6[electricity]", T("Flash Freeze",2,"once per 10 minutes","8d6[cold]","DC 34 basic Reflex; 30-foot cone.","Failure pushes 10 feet; critical failure pushes 20 feet and knocks prone.")),
  C("thunderstrike", "Thunderstrike", ["green","green","yellow"], "Strikes deal +1d6 electricity +1d6 bludgeoning.", "1d6[electricity]+1d6[bludgeoning]", T("Thunderclap",2,"once per 10 minutes","6d6[electricity]+4d6[sonic]","DC 34 Fortitude; 20-foot emanation.","Failure deafened 1 minute and pushed 10 feet; critical failure stunned 1, deafened, pushed 20 feet, prone.")),
  C("meteor", "Meteor", ["yellow","yellow","red"], "Strikes deal +1d6 bludgeoning +1d6 fire.", "1d6[bludgeoning]+1d6[fire]", T("Meteor Strike",2,"once per 10 minutes","8d6[bludgeoning]+4d6[fire]","DC 34 basic Reflex; enemies within 15 feet of landing.","Leap up to 30 feet horizontally and 20 feet vertically; failure prone; no falling damage from the leap.")),
  C("permafrost", "Permafrost", ["yellow","yellow","blue"], "While wielding, resistance 5 physical; Strikes deal +1d6 bludgeoning +1d6 cold.", "1d6[bludgeoning]+1d6[cold]", T("Frozen Bastion",1,"once per 10 minutes","","Self; 3 rounds.","Resistance 10 physical and cold; +1 status AC; Speed –10 feet.","effect")),
  C("seismic-edge", "Seismic Edge", ["yellow","yellow","green"], "Strikes deal +2d6 bludgeoning.", "2d6[bludgeoning]", T("Seismic Cleave",2,"once per 10 minutes","8d6[bludgeoning]","DC 34 basic Reflex in a 30-foot line behind the struck target.","Original target takes +4d6 bludgeoning; failure in the line also pushes 10 feet."))
];

function normalizedSockets(sockets) {
  return [...sockets].filter(s => s !== "empty").sort().join("|");
}

function presetForSockets(sockets, preferred = null) {
  const key = normalizedSockets(sockets);
  if (preferred) {
    const selected = PRESETS.find(p => p.id === preferred);
    if (selected && normalizedSockets(selected.sockets) === key) return selected;
  }
  return PRESETS.find(p => normalizedSockets(p.sockets) === key) ?? null;
}

function isBroadblade(item) {
  return item?.type === "weapon" && (item.name?.trim().toLowerCase() === "tri-core broadblade" || item.getFlag(MODULE_ID, "enabled"));
}

function rootElement(html) {
  return html instanceof HTMLElement ? html : html?.[0] ?? null;
}

function optionsHtml(selectedId) {
  return `<option value="">— choose a preset —</option>${PRESETS.map(p => `<option value="${p.id}" ${p.id === selectedId ? "selected" : ""}>${p.name}</option>`).join("")}`;
}

function panelHtml(config) {
  const sockets = config.sockets ?? ["empty","empty","empty"];
  const preset = presetForSockets(sockets, config.preset);
  const bubbles = sockets.map((core, i) => `<button type="button" class="tricore-socket" data-index="${i}" data-core="${core}" data-tooltip="Click to cycle; right-click to clear">${CORE[core].icon}</button>`).join("");
  return `<section class="tricore-panel" data-tricore-panel>
    <div class="tricore-heading"><strong>Tri-Core Matrix</strong><span class="tricore-hint">Click bubbles to cycle cores</span></div>
    <div class="tricore-sockets">${bubbles}</div>
    <select class="tricore-select">${optionsHtml(preset?.id ?? "")}</select>
    <div class="tricore-summary"><b>${preset?.name ?? "No complete preset"}</b><br>${preset?.passive ?? "Choose three cores or select a preset."}</div>
    <div class="tricore-actions"><button type="button" data-action="tricore-damage"><i class="fa-solid fa-dice-d20"></i> Roll Damage</button><button type="button" data-action="tricore-technique"><i class="fa-solid fa-burst"></i> Use Technique</button></div>
  </section>`;
}

async function saveConfig(item, config) {
  await item.setFlag(MODULE_ID, FLAG, config);
}

function actionGlyph(count) {
  return count === 1 ? "◆" : count === 2 ? "◆◆" : count === 3 ? "◆◆◆" : "";
}

function escapeHtml(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function nativeDamageFormula(formula) {
  // PF2e renders each comma-separated damage instance independently. This is
  // what gives every damage type its own line, die color, subtotal, and damage
  // application controls in chat.
  return String(formula ?? "")
    .split("+")
    .map(part => part.trim())
    .filter(Boolean)
    .join(",");
}

function checkLink(defense) {
  const match = String(defense ?? "").match(/DC\s+(\d+)\s+(basic\s+)?(Fortitude|Reflex|Will)/i);
  if (!match) return "";
  const [, dc, basic, statistic] = match;
  const params = [statistic.toLowerCase(), `dc:${dc}`];
  if (basic) params.push("basic");
  else params.push("options:damaging-effect");
  return `<div class="tricore-save"><strong>Saving Throw</strong><span>@Check[${params.join("|")}]{Roll ${statistic} Save}</span></div>`;
}

function areaTemplateLink(defense) {
  const match = String(defense ?? "").match(/(\d+)-foot\s+(burst|cone|emanation|line)/i);
  return match ? `<span class="tricore-template">@Template[type:${match[2].toLowerCase()}|distance:${match[1]}]</span>` : "";
}

function effectList(effect) {
  const entries = String(effect ?? "").split(/;\s*/).map(entry => entry.trim()).filter(Boolean);
  if (!entries.length) return "";
  return `<section class="tricore-chat-section"><h4>Effects</h4><ul>${entries.map(entry => `<li>${escapeHtml(entry)}</li>`).join("")}</ul></section>`;
}

function techniqueFlavor(item, presetName, technique) {
  const defense = escapeHtml(technique.defense);
  return `<div class="tricore-chat-card">
    <header><img src="${escapeHtml(item.img)}" alt=""><div><h3>${escapeHtml(presetName)}: ${escapeHtml(technique.name)}</h3><span class="tricore-action-glyph">${actionGlyph(technique.actions)}</span></div></header>
    <div class="tricore-chat-tags"><span>Frequency: ${escapeHtml(technique.frequency)}</span></div>
    <section class="tricore-chat-section"><h4>Defense & Area</h4><p>${defense}</p>${areaTemplateLink(technique.defense)}</section>
    ${checkLink(technique.defense)}
    ${effectList(technique.effect)}
    ${technique.formula ? `<section class="tricore-chat-section"><h4>Damage</h4><p>${escapeHtml(nativeDamageFormula(technique.formula))}</p></section>` : ""}
  </div>`;
}

async function enrichChatHtml(content, item) {
  return TextEditor.enrichHTML(content, { async: true, relativeTo: item });
}

async function postRoll(formula, flavor, item = null) {
  const speaker = ChatMessage.getSpeaker({ actor: item?.actor ?? null });
  const enrichedFlavor = await enrichChatHtml(flavor, item);
  if (!formula) return ChatMessage.create({ speaker, content: enrichedFlavor });

  const DamageRoll = CONFIG.Dice.rolls.find(RollClass => RollClass.name === "DamageRoll");
  if (!DamageRoll) {
    ui.notifications.warn("PF2e's native DamageRoll was not available; using a standard roll card.");
    const fallbackRoll = await new Roll(formula).evaluate();
    return fallbackRoll.toMessage({ speaker, flavor: enrichedFlavor });
  }

  const roll = new DamageRoll(nativeDamageFormula(formula));
  await roll.evaluate();
  return roll.toMessage({
    speaker,
    flavor: enrichedFlavor,
    flags: { pf2e: { origin: { uuid: item?.uuid ?? null, type: item?.type ?? "weapon" } } }
  });
}

async function rollDamage(item, config) {
  const preset = presetForSockets(config.sockets, config.preset);
  let extra = preset?.damage ?? "";
  if (!preset) {
    const primary = (config.sockets ?? []).find(s => s !== "empty");
    extra = CORE[primary]?.damage ?? "";
  }
  const formula = ["3d8[slashing]", extra].filter(Boolean).join("+");
  const flavor = `<h3>${item.name}: ${preset?.name ?? "Elemental Conduction"}</h3><p>${preset?.passive ?? "Primary-core damage applied."}</p><p><b>Damage:</b> ${formula}</p>`;
  return postRoll(formula, flavor, item);
}

async function useTechnique(item, config) {
  const preset = presetForSockets(config.sockets, config.preset);
  if (!preset?.technique) return ui.notifications.warn("This core configuration has no preset technique.");
  const t = preset.technique;
  return postRoll(t.formula, techniqueFlavor(item, preset.name, t), item);
}

async function wirePanel(app, item, panel) {
  const getConfig = () => item.getFlag(MODULE_ID, FLAG) ?? { sockets: ["empty","empty","empty"], preset: null };
  panel.querySelectorAll(".tricore-socket").forEach(button => {
    button.addEventListener("click", async () => {
      const config = foundry.utils.deepClone(getConfig());
      const index = Number(button.dataset.index);
      const current = config.sockets[index] ?? "empty";
      config.sockets[index] = CORE_ORDER[(CORE_ORDER.indexOf(current) + 1) % CORE_ORDER.length];
      config.preset = presetForSockets(config.sockets)?.id ?? null;
      await saveConfig(item, config);
      app.render({ force: true });
    });
    button.addEventListener("contextmenu", async event => {
      event.preventDefault();
      const config = foundry.utils.deepClone(getConfig());
      config.sockets[Number(button.dataset.index)] = "empty";
      config.preset = null;
      await saveConfig(item, config);
      app.render({ force: true });
    });
  });
  panel.querySelector(".tricore-select")?.addEventListener("change", async event => {
    const preset = PRESETS.find(p => p.id === event.currentTarget.value);
    if (!preset) return;
    await saveConfig(item, { sockets: [...preset.sockets], preset: preset.id });
    app.render({ force: true });
  });
  panel.querySelector('[data-action="tricore-damage"]')?.addEventListener("click", () => rollDamage(item, getConfig()));
  panel.querySelector('[data-action="tricore-technique"]')?.addEventListener("click", () => useTechnique(item, getConfig()));
}

function renderBroadblade(app, html) {
  const item = app.document ?? app.item ?? app.object;
  if (!isBroadblade(item)) return;
  const root = rootElement(html);
  if (!root) return;
  // PF2e can render only the form body while leaving elements injected beside
  // it in place. Clear any earlier matrix from this window before rebuilding.
  const windowRoot = root.closest(".application") ?? app.element?.[0] ?? app.element ?? root;
  windowRoot.querySelectorAll?.("[data-tricore-panel]").forEach(panel => panel.remove());
  const config = item.getFlag(MODULE_ID, FLAG) ?? { sockets: ["empty","empty","empty"], preset: null };
  const wrapper = document.createElement("div");
  wrapper.innerHTML = panelHtml(config);
  const panel = wrapper.firstElementChild;
  const header = root.querySelector(".sheet-header, header");
  const nav = root.querySelector("nav.sheet-navigation, nav");
  if (header?.parentElement) header.insertAdjacentElement("afterend", panel);
  else if (nav?.parentElement) nav.insertAdjacentElement("beforebegin", panel);
  else root.prepend(panel);
  wirePanel(app, item, panel);
  app.setPosition?.({ height: "auto" });
}

const CROSS_TAIL_FLAG = "crossTailConfiguration";
const CROSS_TAIL_MONTH = 30 * 24 * 60 * 60;
const CROSS_TAIL_FORMS = [
  {
    id: "free-threads",
    name: "Free Threads",
    icon: "🧵",
    passive: "10d4 slashing; agile, finesse, reach, trip, and versatile P. Use the threads for ordinary Strikes and combat maneuvers.",
    damage: "10d4[slashing]",
    technique: T("Thread Snare", 1, "at will", "", "Athletics check against the target's Fortitude DC; target within 15 feet.", "Use the PF2e Grapple action with Cross Tail's reach and grapple trait. Critical Success restrains; Success grabs; Failure releases an existing wire-grab; Critical Failure uses the standard Grapple consequences.", "grapple")
  },
  {
    id: "dragon-hair-armor",
    name: "Dragon-Hair Armor",
    icon: "🛡️",
    passive: "The threads wrap your body. Gain a +2 circumstance bonus to AC, but Cross Tail can't make Strikes in this form.",
    damage: "",
    technique: T("Cocoon the Impact", 0, "once per hour", "", "Reaction; trigger: you would take physical damage.", "Reduce the triggering bludgeoning, piercing, or slashing damage by 15. If this reduces the damage to 0, Step after the effect resolves.", "effect")
  },
  {
    id: "long-spear",
    name: "Long Spear",
    icon: "🔱",
    passive: "5d6 piercing; reach 30 feet. Cross Tail loses agile and trip while shaped into the spear.",
    damage: "5d6[piercing]",
    technique: T("Internal Unraveling", 2, "once per 10 minutes", "2d6[bleed]", "Make a Long Spear Strike; the target then attempts a DC 30 Fortitude save.", "On a failed save, the target takes 2d6 persistent bleed damage; on a critical failure, it is also enfeebled 1 until the bleeding ends. A success prevents the persistent damage.")
  },
  {
    id: "thread-barrier",
    name: "Thread Barrier",
    icon: "🕸️",
    passive: "You weave a mobile screen of thread. Raise the barrier as 1 action to gain +2 circumstance AC until your next turn. The barrier has Hardness 10, 40 HP, and BT 20.",
    damage: "",
    technique: T("Barrier Intercept", 0, "once per round", "", "Reaction; trigger: you or an adjacent ally would take physical damage while the barrier is raised.", "Reduce the triggering damage by the barrier's Hardness. Any remaining damage is dealt to both the protected creature and Cross Tail's barrier HP.", "effect")
  },
  {
    id: "orbiting-axes",
    name: "Orbiting Axes",
    icon: "🪓",
    passive: "Five or six axe heads orbit on controlled wires. Your melee Strikes deal 4d8 slashing, have reach 15 feet, and lose agile and finesse.",
    damage: "4d8[slashing]",
    technique: T("Axe-Wheel Tempest", 2, "once per 10 minutes", "10d6[slashing]", "DC 30 basic Reflex; enemies in a 20-foot emanation.", "On a critical failure, a creature is also knocked prone. You can exclude a number of creatures equal to your Dexterity modifier (minimum 0).")
  },
  {
    id: "heart-entanglement",
    name: "Heart Entanglement",
    icon: "🫀",
    passive: "The finest threads seek a living creature's pulse. This form is used only for the Heartbreaker execution and can't make ordinary Strikes.",
    damage: "",
    technique: T("Heartbreaker", 2, "once per 30 days", "14d6[piercing]", "DC 30 Fortitude; incapacitation and death; one living creature grabbed or restrained by Cross Tail's Thread Snare, within 15 feet, and at half its maximum HP or fewer.", "Critical Success: unaffected and temporarily immune for 1 month. Success: 7d6 piercing and the wire-grab ends. Failure: 14d6 piercing, drained 2, and the wire-grab ends; if reduced to 0 HP, the target dies. Critical Failure: the threads crush the target's heart and it dies. A creature without a functioning heart is immune.")
  },
  {
    id: "guided-blades",
    name: "Guided Twin Blades",
    icon: "🗡️",
    passive: "Two blades ride nearly invisible wires. Each blade deals 4d6 slashing and can curve around cover.",
    damage: "4d6[slashing]+4d6[slashing]",
    technique: T("Twin-Blade Pursuit", 2, "once per round", "8d6[slashing]", "DC 32 basic Reflex when both blades focus on one creature within 60 feet.", "Focused target: both blades automatically hit one creature for 8d6 slashing, subject to its basic Reflex save. Split focus: choose two creatures and make one attack roll for each blade with a +4 bonus; each hit deals 4d6 slashing. A critical failure on either split attack triggers Tangled Recoil.")
  }
];

const CROSS_TAIL_DESCRIPTION_VERSION = 2;
const CROSS_TAIL_DESCRIPTION = `<p><strong>Infinite Uses:</strong> Cross Tail is a spool of nearly unbreakable silver thread linked to metal caps worn over the wielder's fingers. Its threads can become weapons, snares, an alarm web, or a protective cocoon.</p>
<hr>
<p><strong>Cross Tail Matrix</strong> <span class="action-glyph">1</span> (<em>concentrate, manipulate</em>) Reshape Cross Tail into any form below. The selected form remains until you reshape it again. Each damage entry and required check is clickable and can be posted or rolled from chat.</p>
<h3>Free Threads</h3><p>@Damage[10d4[slashing]]{10d4 slashing}; agile, finesse, reach, grapple, trip, and versatile P. Use [[/act grapple]]{Grapple} against the target's Fortitude DC or [[/act trip]]{Trip} with Cross Tail's reach and potency bonus. Grapple uses the complete PF2e degree-of-success rules. A creature grabbed or restrained by this form satisfies Heartbreaker's wire-grab requirement.</p>
<h3>Dragon-Hair Armor</h3><p>Gain a +2 circumstance bonus to AC, but Cross Tail can't Strike. Once per hour, its reaction reduces triggering physical damage by 15.</p>
<h3>Long Spear</h3><p>@Damage[5d6[piercing]]{5d6 piercing} with reach 30 feet. <strong>Internal Unraveling:</strong> after a Strike, the target attempts @Check[fortitude|dc:30|options:damaging-effect]{DC 30 Fortitude}; on a failure it takes @Damage[2d6[persistent,bleed]]{2d6 persistent bleed}.</p>
<h3>Thread Barrier</h3><p>Raise the barrier for +2 circumstance AC. It has Hardness 10, 40 HP, and BT 20, and can intercept damage for you or an adjacent ally once per round.</p>
<h3>Orbiting Axes</h3><p>@Damage[4d8[slashing]]{4d8 slashing} with reach 15 feet. <strong>Axe-Wheel Tempest:</strong> @Template[type:emanation|distance:20]{20-foot emanation}; @Damage[10d6[slashing]|options:area-damage]{10d6 slashing}; @Check[reflex|dc:30|basic]{DC 30 basic Reflex}.</p>
<h3>Heart Entanglement—Heartbreaker</h3><p><span class="action-glyph">2</span> (<em>death, incapacitation</em>) <strong>Frequency</strong> once per 30 days; <strong>Requirements</strong> one living creature grabbed or restrained by Cross Tail's Free Threads within 15 feet and at half its maximum HP or fewer. The target attempts @Check[fortitude|dc:30|options:damaging-effect]{DC 30 Fortitude}. Critical Success: unaffected and temporarily immune for 1 month. Success: @Damage[7d6[piercing]]{7d6 piercing} and the wire-grab ends. Failure: @Damage[14d6[piercing]]{14d6 piercing}, drained 2, and the wire-grab ends; if reduced to 0 HP, it dies. Critical Failure: it dies. Creatures without functioning hearts are immune.</p>
<h3>Guided Twin Blades</h3><p><span class="action-glyph">2</span> (<em>attack, manipulate</em>) <strong>Frequency</strong> once per round. <strong>Focused:</strong> both blades automatically hit one creature within 60 feet for @Damage[8d6[slashing]]{8d6 slashing}; the target attempts @Check[reflex|dc:32|basic]{DC 32 basic Reflex}. <strong>Split:</strong> choose two creatures; roll [[/r 1d20+4 # Guided Twin Blade 1 Attack]]{Blade 1 attack (+4)} and [[/r 1d20+4 # Guided Twin Blade 2 Attack]]{Blade 2 attack (+4)}. Each hit deals @Damage[4d6[slashing]]{4d6 slashing}. On a critical failure, attempt @Check[reflex|dc:32]{DC 32 Reflex}; on a failure, Tangled Recoil prevents use of Cross Tail until the end of your next turn.</p>
<h3>Lay the Perimeter</h3><p>(10 minutes) Arrange nearly invisible threads in a contiguous @Template[type:burst|distance:20]{20-foot burst}. You automatically detect corporeal creatures moving within it. @Check[perception|dc:30|traits:secret]{Search DC 30}.</p>
<h3>Realm-Cutting Thread</h3><p><span class="action-glyph">2</span> (<em>magical, manipulate</em>) <strong>Frequency</strong> once per day; @Template[type:line|distance:60]{60-foot line}; @Damage[10d6[slashing]|options:area-damage]{10d6 slashing}; @Check[reflex|dc:30|basic]{DC 30 basic Reflex}. A critical failure also takes @Damage[2d6[persistent,bleed]]{2d6 persistent bleed}. This damage ignores 10 Hardness.</p>
<h3>Wet Threads</h3><p>If Cross Tail is fully immersed in liquid or critically fails @Check[arcana|dc:30]{DC 30 Arcana}, its special activations can't be used until the end of your next turn.</p>`;

function isCrossTail(item) {
  return item?.type === "weapon" && (item.name?.trim().toLowerCase() === "cross tail" || item.getFlag(MODULE_ID, "crossTailEnabled"));
}

function crossTailForm(id) {
  return CROSS_TAIL_FORMS.find(form => form.id === id) ?? CROSS_TAIL_FORMS[0];
}

function crossTailPanelHtml(config) {
  const form = crossTailForm(config.form);
  const options = CROSS_TAIL_FORMS.map(candidate => `<option value="${candidate.id}" ${candidate.id === form.id ? "selected" : ""}>${candidate.icon} ${candidate.name}</option>`).join("");
  const actions = form.id === "guided-blades"
    ? `<button type="button" data-action="guided-focus"><i class="fa-solid fa-bullseye"></i> Focus One Target</button><button type="button" data-action="guided-split"><i class="fa-solid fa-code-fork"></i> Split Two Targets</button>`
    : `<button type="button" data-action="crosstail-damage"><i class="fa-solid fa-dice-d20"></i> Roll Form Damage</button><button type="button" data-action="crosstail-technique"><i class="fa-solid fa-burst"></i> Use Form Power</button>`;
  return `<section class="tricore-panel crosstail-panel" data-crosstail-panel>
    <div class="tricore-heading"><strong>Cross Tail Matrix</strong><span class="tricore-hint">Reshape the dragon-hair threads</span></div>
    <div class="crosstail-form-icon" aria-hidden="true">${form.icon}</div>
    <select class="tricore-select crosstail-select">${options}</select>
    <div class="tricore-summary crosstail-summary"><b>${form.name}</b><br>${form.passive}</div>
    <div class="tricore-actions">${actions}</div>
  </section>`;
}

async function saveCrossTailConfig(item, config) {
  await item.setFlag(MODULE_ID, CROSS_TAIL_FLAG, config);
}

async function rollCrossTailDamage(item, config) {
  const form = crossTailForm(config.form);
  const flavor = `<h3>${item.name}: ${form.name}</h3><p>${form.passive}</p>${form.damage ? `<p><b>Damage:</b> ${form.damage}</p>` : ""}`;
  return postRoll(form.damage, flavor, item);
}

async function useThreadSnare(item) {
  const content = `<div class="tricore-chat-card">
    <header><img src="${escapeHtml(item.img)}" alt=""><div><h3>Free Threads: Thread Snare</h3><span class="tricore-action-glyph">◆</span></div></header>
    <div class="tricore-chat-tags"><span>Attack · Grapple · Reach 15 feet</span></div>
    <section class="tricore-chat-section"><h4>PF2e Grapple</h4><p>@UUID[Compendium.pf2e.actionspf2e.Item.PMbdMWc2QroouFGD]{View the Grapple rules}</p><p>Target a creature, then use [[/act grapple]]{Grapple with Free Threads}. PF2e rolls Athletics against the target's Fortitude DC and applies Cross Tail's grapple trait and available item bonus.</p></section>
    <section class="tricore-chat-section"><h4>Degree of Success</h4><ul><li><strong>Critical Success:</strong> the target is restrained until the end of your next turn.</li><li><strong>Success:</strong> the target is grabbed until the end of your next turn.</li><li><strong>Failure:</strong> the attempt fails and any existing wire-grab ends.</li><li><strong>Critical Failure:</strong> use the standard Grapple critical-failure result shown in the linked action.</li></ul></section>
    <section class="tricore-chat-section"><h4>Heartbreaker Link</h4><p>A target grabbed or restrained by this action satisfies Heartbreaker's wire-grab requirement.</p></section>
  </div>`;
  return postRoll("", content, item);
}

async function useGuidedTwinBlades(item, mode) {
  if (mode === "focused") {
    const technique = crossTailForm("guided-blades").technique;
    return postRoll("4d6[slashing]+4d6[slashing]", techniqueFlavor(item, "Guided Twin Blades — Focused", technique), item);
  }

  const content = `<div class="tricore-chat-card">
    <header><img src="${escapeHtml(item.img)}" alt=""><div><h3>Guided Twin Blades — Split Targets</h3><span class="tricore-action-glyph">◆◆</span></div></header>
    <div class="tricore-chat-tags"><span>Attack · Manipulate · Two targets within 60 feet</span></div>
    <section class="tricore-chat-section"><h4>Attack Rolls</h4><p>Choose two targets. Roll once for each blade with a +4 bonus:</p><ul><li>[[/r 1d20+4 # Guided Twin Blade 1 Attack]]{Blade 1 attack (+4)} — @Damage[4d6[slashing]]{4d6 slashing}</li><li>[[/r 1d20+4 # Guided Twin Blade 2 Attack]]{Blade 2 attack (+4)} — @Damage[4d6[slashing]]{4d6 slashing}</li></ul></section>
    <div class="tricore-save"><strong>Critical Failure — Tangled Recoil</strong><span>@Check[reflex|dc:32]{DC 32 Reflex}</span></div>
    <section class="tricore-chat-section"><h4>Tangled Recoil</h4><p>When either split attack critically fails, roll the Reflex check above. On a failure, Cross Tail can't be used until the end of your next turn.</p></section>
  </div>`;
  return postRoll("", content, item);
}

async function useCrossTailTechnique(item, config) {
  const form = crossTailForm(config.form);
  const technique = form.technique;
  if (form.id === "free-threads") return useThreadSnare(item);
  if (form.id === "heart-entanglement") {
    const now = Number(game.time?.worldTime ?? 0);
    const lastUse = Number.isFinite(config.heartLastUsedWorldTime) ? config.heartLastUsedWorldTime : null;
    if (lastUse !== null && now - lastUse < CROSS_TAIL_MONTH) {
      const remainingDays = Math.ceil((CROSS_TAIL_MONTH - (now - lastUse)) / 86400);
      return ui.notifications.warn(`Heartbreaker is unavailable for ${remainingDays} more in-game day${remainingDays === 1 ? "" : "s"}.`);
    }
    await saveCrossTailConfig(item, { ...config, heartLastUsedWorldTime: now });
  }
  return postRoll(technique.formula, techniqueFlavor(item, form.name, technique), item);
}

async function wireCrossTailPanel(app, item, panel) {
  const getConfig = () => item.getFlag(MODULE_ID, CROSS_TAIL_FLAG) ?? { form: "free-threads", heartLastUsedWorldTime: null };
  panel.querySelector(".crosstail-select")?.addEventListener("change", async event => {
    const config = foundry.utils.deepClone(getConfig());
    config.form = event.currentTarget.value;
    await saveCrossTailConfig(item, config);
    app.render({ force: true });
  });
  panel.querySelector('[data-action="crosstail-damage"]')?.addEventListener("click", () => rollCrossTailDamage(item, getConfig()));
  panel.querySelector('[data-action="crosstail-technique"]')?.addEventListener("click", () => useCrossTailTechnique(item, getConfig()));
  panel.querySelector('[data-action="guided-focus"]')?.addEventListener("click", () => useGuidedTwinBlades(item, "focused"));
  panel.querySelector('[data-action="guided-split"]')?.addEventListener("click", () => useGuidedTwinBlades(item, "split"));
}

function renderCrossTail(app, html) {
  const item = app.document ?? app.item ?? app.object;
  if (!isCrossTail(item)) return;
  const root = rootElement(html);
  if (!root) return;
  const windowRoot = root.closest(".application") ?? app.element?.[0] ?? app.element ?? root;
  windowRoot.querySelectorAll?.("[data-crosstail-panel]").forEach(panel => panel.remove());
  const config = item.getFlag(MODULE_ID, CROSS_TAIL_FLAG) ?? { form: "free-threads", heartLastUsedWorldTime: null };
  const wrapper = document.createElement("div");
  wrapper.innerHTML = crossTailPanelHtml(config);
  const panel = wrapper.firstElementChild;
  const header = root.querySelector(".sheet-header, header");
  const nav = root.querySelector("nav.sheet-navigation, nav");
  if (header?.parentElement) header.insertAdjacentElement("afterend", panel);
  else if (nav?.parentElement) nav.insertAdjacentElement("beforebegin", panel);
  else root.prepend(panel);
  wireCrossTailPanel(app, item, panel);
  // Keep Cross Tail at the same compact footprint as the Tri-Core sheet. This
  // runs after every form change so longer descriptions cannot expand it back
  // to the full viewport height.
  app.setPosition?.({ width: 700, height: 757 });
}

function renderWeaponMatrices(app, html) {
  renderBroadblade(app, html);
  renderCrossTail(app, html);
}

async function migrateCrossTailDescriptions() {
  if (!game.user.isGM) return;
  const worldItems = Array.from(game.items ?? []);
  const actorItems = Array.from(game.actors ?? []).flatMap(actor => Array.from(actor.items ?? []));
  const crossTails = [...worldItems, ...actorItems].filter(isCrossTail);
  for (const item of crossTails) {
    const currentVersion = Number(item.getFlag(MODULE_ID, "descriptionVersion") ?? 0);
    if (currentVersion >= CROSS_TAIL_DESCRIPTION_VERSION) continue;
    await item.update({
      "system.description.value": CROSS_TAIL_DESCRIPTION,
      [`flags.${MODULE_ID}.descriptionVersion`]: CROSS_TAIL_DESCRIPTION_VERSION
    });
  }
}

Hooks.once("init", () => console.log(`${MODULE_ID} | Initializing`));
Hooks.once("ready", () => {
  game.modules.get(MODULE_ID).api = { PRESETS, CROSS_TAIL_FORMS, rollDamage, useTechnique, rollCrossTailDamage, useCrossTailTechnique, useGuidedTwinBlades };
  migrateCrossTailDescriptions();
  console.log(`${MODULE_ID} | Ready with ${PRESETS.length} Tri-Core presets and ${CROSS_TAIL_FORMS.length} Cross Tail forms`);
});

for (const hook of ["renderItemSheet", "renderItemSheetPF2e", "renderWeaponSheetPF2e"]) {
  Hooks.on(hook, renderWeaponMatrices);
}
