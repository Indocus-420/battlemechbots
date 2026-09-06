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

async function postRoll(formula, flavor) {
  if (!formula) return ChatMessage.create({ speaker: ChatMessage.getSpeaker(), content: flavor });
  const roll = await new Roll(formula).evaluate();
  return roll.toMessage({ speaker: ChatMessage.getSpeaker(), flavor });
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
  return postRoll(formula, flavor);
}

async function useTechnique(item, config) {
  const preset = presetForSockets(config.sockets, config.preset);
  if (!preset?.technique) return ui.notifications.warn("This core configuration has no preset technique.");
  const t = preset.technique;
  const flavor = `<h3>${preset.name}: ${t.name} ${actionGlyph(t.actions)}</h3><p><b>Frequency:</b> ${t.frequency}</p><p><b>${t.defense}</b></p><p>${t.effect}</p>${t.formula ? `<p><b>Damage:</b> ${t.formula}</p>` : ""}`;
  return postRoll(t.formula, flavor);
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

Hooks.once("init", () => console.log(`${MODULE_ID} | Initializing`));
Hooks.once("ready", () => {
  game.modules.get(MODULE_ID).api = { PRESETS, rollDamage, useTechnique };
  console.log(`${MODULE_ID} | Ready with ${PRESETS.length} presets`);
});

for (const hook of ["renderItemSheet", "renderItemSheetPF2e", "renderWeaponSheetPF2e"]) {
  Hooks.on(hook, renderBroadblade);
}
