const SYSTEM_ID = "battletech-foundry-system";
const WINDOW_ID = "bmfs-player-console";
const DEFAULT_STATE = Object.freeze({ left: 120, top: 90, width: 760, height: 560, tab: "overview", collapsed: {} });

function numeric(value) {
  return Number(value) || 0;
}

function collectionValues(collection) {
  return Array.isArray(collection) ? collection : [...(collection ?? [])];
}

export function unitReadiness(actor) {
  if (!actor) return { ready: false, label: "Unassigned", reason: "No unit assigned" };
  if (actor.system?.status?.destroyed) return { ready: false, label: "Destroyed", reason: "Unit is destroyed" };
  const heat = numeric(actor.system?.heat?.current);
  const ammo = collectionValues(actor.items).filter(item => item.type === "ammo" && !item.system?.destroyed);
  const empty = ammo.filter(item => numeric(item.system?.shots) === 0).length;
  const damaged = actor.type === "mech"
    ? Object.values(actor.system?.structure ?? {}).some(location => numeric(location?.value) < numeric(location?.max))
    : numeric(actor.system?.structure) <= 0;
  if (heat >= 30) return { ready: false, label: "Overheated", reason: `Heat ${heat}` };
  if (damaged) return { ready: false, label: "Damaged", reason: "Internal damage requires repair" };
  if (empty) return { ready: false, label: "Rearm", reason: `${empty} empty ammunition bin(s)` };
  return { ready: true, label: "Ready", reason: "Deployment ready" };
}

export function unitCondition(actor) {
  if (!actor) return null;
  const armorLocations = actor.type === "mech" ? Object.values(actor.system?.armor ?? {}) : [];
  const armorCurrent = actor.type === "mech"
    ? armorLocations.reduce((sum, location) => sum + numeric(location.front) + numeric(location.rear), 0)
    : ["front", "left", "right", "rear", "turret"].reduce((sum, key) => sum + numeric(actor.system?.armor?.[key]), 0);
  const armorMaximum = actor.type === "mech"
    ? armorLocations.reduce((sum, location) => sum + numeric(location.maxFront) + numeric(location.maxRear), 0)
    : armorCurrent;
  const structureLocations = actor.type === "mech" ? Object.values(actor.system?.structure ?? {}) : [];
  const structureCurrent = actor.type === "mech"
    ? structureLocations.reduce((sum, location) => sum + numeric(location.value), 0)
    : numeric(actor.system?.structure);
  const structureMaximum = actor.type === "mech"
    ? structureLocations.reduce((sum, location) => sum + numeric(location.max), 0)
    : structureCurrent;
  const bins = collectionValues(actor.items).filter(item => item.type === "ammo" && !item.system?.destroyed);
  const ammoCurrent = bins.reduce((sum, item) => sum + numeric(item.system?.shots), 0);
  const ammoMaximum = bins.reduce((sum, item) => sum + numeric(item.system?.maxShots ?? item.system?.shots), 0);
  const chassis = actor.type === "mech" ? actor.system?.mech?.chassis : actor.system?.vehicle?.chassis;
  const variant = actor.type === "mech" ? actor.system?.mech?.variant : actor.system?.vehicle?.variant;
  const pilot = actor.type === "mech" ? actor.system?.pilot?.name : actor.system?.crew?.name;
  return {
    id: actor.id,
    actor,
    name: actor.name,
    image: actor.img,
    type: actor.type,
    pilot: pilot || "Unassigned",
    chassis: chassis || actor.name,
    variant: variant || "",
    armorCurrent,
    armorMaximum,
    structureCurrent,
    structureMaximum,
    heat: actor.type === "mech" ? numeric(actor.system?.heat?.current) : null,
    ammoCurrent,
    ammoMaximum,
    readiness: unitReadiness(actor)
  };
}

export function playerConsoleModel({ game = globalThis.game, controlled = globalThis.canvas?.tokens?.controlled ?? [] } = {}) {
  const user = game?.user;
  const actors = collectionValues(game?.actors);
  const owned = actors.filter(actor => ["mech", "vehicle"].includes(actor.type)
    && (user?.isGM || actor.isOwner || actor.testUserPermission?.(user, "OWNER")));
  const selected = collectionValues(controlled).map(token => token.actor).find(actor => actor?.type === "mech");
  const assigned = selected ?? (user?.character?.type === "mech" ? user.character : null) ?? owned.find(actor => actor.type === "mech") ?? null;
  const campaign = user?.getFlag?.(SYSTEM_ID, "campaign") ?? {};
  const lanceFlag = user?.getFlag?.(SYSTEM_ID, "lance") ?? {};
  const actorById = id => actors.find(actor => actor.id === id);
  const mechs = (lanceFlag.mechs ?? []).map(actorById).filter(Boolean);
  const vehicles = (lanceFlag.vehicles ?? []).map(actorById).filter(Boolean);
  for (const actor of owned.filter(actor => actor.type === "mech")) if (mechs.length < 4 && !mechs.includes(actor)) mechs.push(actor);
  for (const actor of owned.filter(actor => actor.type === "vehicle")) if (vehicles.length < 3 && !vehicles.includes(actor)) vehicles.push(actor);
  let mission = {};
  try {
    mission = game?.settings?.get?.(SYSTEM_ID, "missionData") ?? {};
  } catch {}
  const pilot = assigned?.system?.pilot ?? {};
  return {
    userName: user?.name ?? "Player",
    assigned,
    pilot: {
      portrait: campaign.portrait || assigned?.img || "icons/svg/mystery-man.svg",
      callsign: campaign.callsign || pilot.name || user?.name || "Unassigned",
      faction: campaign.faction || assigned?.system?.mech?.faction || "independent",
      gunnery: numeric(pilot.gunnery || 4),
      piloting: numeric(pilot.piloting || 5),
      injuries: numeric(campaign.injuries ?? pilot.hits),
      experience: numeric(campaign.experience),
      mNotes: numeric(campaign.mNotes),
      readiness: unitReadiness(assigned)
    },
    lance: {
      mechs: Array.from({ length: 4 }, (_, index) => unitCondition(mechs[index])),
      vehicles: Array.from({ length: 3 }, (_, index) => unitCondition(vehicles[index]))
    },
    mission: {
      name: mission.name || "No active mission",
      state: mission.state || "Planning",
      result: mission.result || "Pending",
      objectives: Array.isArray(mission.objectives) ? mission.objectives : [],
      reward: numeric(mission.reward),
      expenses: numeric(mission.expenses),
      loot: Array.isArray(mission.loot) ? mission.loot : [],
      salvage: Array.isArray(mission.salvage) ? mission.salvage : [],
      history: Array.isArray(mission.history) ? mission.history : []
    },
    bay: owned.map(unitCondition),
    inventory: {
      weapons: owned.flatMap(actor => collectionValues(actor.items).filter(item => item.type === "weapon")),
      ammunition: owned.flatMap(actor => collectionValues(actor.items).filter(item => item.type === "ammo")),
      equipment: owned.flatMap(actor => collectionValues(actor.items).filter(item => item.type === "equipment")),
      salvage: Array.isArray(campaign.salvage) ? campaign.salvage : [],
      transactions: Array.isArray(campaign.transactions) ? campaign.transactions : []
    }
  };
}

function escape(value) {
  const utility = globalThis.foundry?.utils?.escapeHTML;
  return utility ? utility(String(value ?? "")) : String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function savedState() {
  try {
    return { ...DEFAULT_STATE, ...JSON.parse(globalThis.localStorage?.getItem(`${SYSTEM_ID}.playerConsole.${globalThis.game?.user?.id}`) ?? "{}") };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(element, extra = {}) {
  const rect = element.getBoundingClientRect();
  const active = element.querySelector('[role="tab"][aria-selected="true"]')?.dataset.tab ?? "overview";
  const collapsed = Object.fromEntries([...element.querySelectorAll("details[data-section]")].map(details => [details.dataset.section, !details.open]));
  globalThis.localStorage?.setItem(`${SYSTEM_ID}.playerConsole.${globalThis.game?.user?.id}`, JSON.stringify({
    left: rect.left, top: rect.top, width: rect.width, height: rect.height, tab: active, collapsed, ...extra
  }));
}

function unitCard(unit, slot, kind) {
  if (!unit) return `<article class="bmfs-lance-card is-empty"><strong>${kind} ${slot}</strong><span>Empty deployment slot</span></article>`;
  return `<article class="bmfs-lance-card ${unit.readiness.ready ? "is-ready" : "is-warning"}" data-actor-id="${escape(unit.id)}">
    <img src="${escape(unit.image)}" alt=""><div><strong>${escape(unit.chassis)} ${escape(unit.variant)}</strong><span>${escape(unit.pilot)}</span>
    <small>Armor ${unit.armorCurrent}/${unit.armorMaximum} · Internal ${unit.structureCurrent}/${unit.structureMaximum}${unit.heat === null ? "" : ` · Heat ${unit.heat}`} · Ammo ${unit.ammoCurrent}/${unit.ammoMaximum}</small>
    <b>${escape(unit.readiness.label)}</b></div><button type="button" data-console-action="sheet" data-actor-id="${escape(unit.id)}" title="Open record sheet"><i class="fa-solid fa-clipboard-list"></i></button>
  </article>`;
}

function list(values, empty = "None") {
  return values.length ? `<ul>${values.map(value => `<li>${escape(value?.name ?? value)}</li>`).join("")}</ul>` : `<p class="bmfs-console-empty">${escape(empty)}</p>`;
}

export function closePlayerConsole() {
  globalThis.document?.getElementById(WINDOW_ID)?.remove();
}

export function renderPlayerConsole() {
  const existing = globalThis.document?.getElementById(WINDOW_ID);
  if (existing) {
    existing.remove();
    return false;
  }
  const model = playerConsoleModel();
  const state = savedState();
  const element = document.createElement("section");
  element.id = WINDOW_ID;
  element.style.left = `${state.left}px`;
  element.style.top = `${state.top}px`;
  element.style.width = `${state.width}px`;
  element.style.height = `${state.height}px`;
  element.innerHTML = `<header class="bmfs-console-handle"><div><span>BATTLEMECH PILOT COMMAND</span><strong>${escape(model.userName)}</strong></div><button type="button" data-console-action="close" title="Close"><i class="fa-solid fa-xmark"></i></button></header>
    <nav role="tablist">${[
      ["overview", "Overview", "user-astronaut"], ["lance", "Lance", "people-group"], ["mission", "Mission", "bullseye"], ["bay", "Mech Bay", "warehouse"]
    ].map(([id, label, icon]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${state.tab === id}"><i class="fa-solid fa-${icon}"></i> ${label}</button>`).join("")}</nav>
    <main>
      <section role="tabpanel" data-panel="overview" ${state.tab === "overview" ? "" : "hidden"}>
        <div class="bmfs-pilot-overview"><img src="${escape(model.pilot.portrait)}" alt=""><div><h2>${escape(model.pilot.callsign)}</h2><p>${escape(model.pilot.faction)} · ${model.pilot.readiness.label}</p>
        <dl><dt>Gunnery</dt><dd>${model.pilot.gunnery}</dd><dt>Piloting</dt><dd>${model.pilot.piloting}</dd><dt>Injuries</dt><dd>${model.pilot.injuries}/6</dd><dt>Experience</dt><dd>${model.pilot.experience}</dd><dt>M-Notes</dt><dd>${model.pilot.mNotes.toLocaleString()}</dd><dt>Assigned Unit</dt><dd>${escape(model.assigned?.name || "Unassigned")}</dd></dl></div></div>
      </section>
      <section role="tabpanel" data-panel="lance" ${state.tab === "lance" ? "" : "hidden"}>
        <details data-section="mechs" ${state.collapsed?.mechs ? "" : "open"}><summary>BattleMech Lance · 4 slots</summary><div class="bmfs-lance-grid">${model.lance.mechs.map((unit, index) => unitCard(unit, index + 1, "Mech")).join("")}</div></details>
        <details data-section="vehicles" ${state.collapsed?.vehicles ? "" : "open"}><summary>Vehicle Support · 3 slots</summary><div class="bmfs-lance-grid">${model.lance.vehicles.map((unit, index) => unitCard(unit, index + 1, "Vehicle")).join("")}</div></details>
      </section>
      <section role="tabpanel" data-panel="mission" ${state.tab === "mission" ? "" : "hidden"}>
        <div class="bmfs-mission-heading"><h2>${escape(model.mission.name)}</h2><b>${escape(model.mission.state)} · ${escape(model.mission.result)}</b></div>
        <details data-section="objectives" ${state.collapsed?.objectives ? "" : "open"}><summary>Objectives</summary>${list(model.mission.objectives, "No objectives assigned")}</details>
        <div class="bmfs-mission-ledger"><span>Reward <b>${model.mission.reward.toLocaleString()}</b></span><span>Expenses <b>${model.mission.expenses.toLocaleString()}</b></span><span>Net <b>${(model.mission.reward - model.mission.expenses).toLocaleString()}</b></span></div>
        <details data-section="loot" ${state.collapsed?.loot ? "" : "open"}><summary>Loot and Salvage Choices</summary>${list([...model.mission.loot, ...model.mission.salvage], "No loot or salvage recorded")}</details>
        <details data-section="history" ${state.collapsed?.history ? "" : "open"}><summary>Mission History</summary>${list(model.mission.history, "No completed missions")}</details>
      </section>
      <section role="tabpanel" data-panel="bay" ${state.tab === "bay" ? "" : "hidden"}>
        <div class="bmfs-bay-ledger"><strong>M-Notes ${model.pilot.mNotes.toLocaleString()}</strong><span>${model.bay.length} owned unit(s)</span></div>
        <details data-section="owned" ${state.collapsed?.owned ? "" : "open"}><summary>Owned Chassis and Repair / Refit</summary><div class="bmfs-lance-grid">${model.bay.map((unit, index) => unitCard(unit, index + 1, "Unit")).join("")}</div></details>
        <div class="bmfs-inventory-grid"><details data-section="weapons" open><summary>Weapons (${model.inventory.weapons.length})</summary>${list(model.inventory.weapons)}</details><details data-section="ammo" open><summary>Ammunition (${model.inventory.ammunition.length})</summary>${list(model.inventory.ammunition)}</details><details data-section="equipment" open><summary>Equipment (${model.inventory.equipment.length})</summary>${list(model.inventory.equipment)}</details><details data-section="salvage" open><summary>Parts and Salvage</summary>${list(model.inventory.salvage)}</details></div>
        <details data-section="transactions" ${state.collapsed?.transactions ? "" : "open"}><summary>Transaction History</summary>${list(model.inventory.transactions, "No transactions")}</details>
      </section>
    </main>`;
  document.body.append(element);
  element.addEventListener("click", event => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) {
      for (const button of element.querySelectorAll('[role="tab"]')) button.setAttribute("aria-selected", String(button === tab));
      for (const panel of element.querySelectorAll('[role="tabpanel"]')) panel.hidden = panel.dataset.panel !== tab.dataset.tab;
      saveState(element);
      return;
    }
    const action = event.target.closest("[data-console-action]")?.dataset.consoleAction;
    if (action === "close") {
      saveState(element);
      element.remove();
    }
    if (action === "sheet") globalThis.game?.actors?.get?.(event.target.closest("[data-actor-id]")?.dataset.actorId)?.sheet?.render?.({ force: true });
  });
  element.addEventListener("toggle", () => saveState(element), true);
  const handle = element.querySelector(".bmfs-console-handle");
  handle.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.target.closest("button")) return;
    const rect = element.getBoundingClientRect();
    const dx = event.clientX - rect.left;
    const dy = event.clientY - rect.top;
    const move = moveEvent => {
      element.style.left = `${Math.max(0, Math.min(globalThis.innerWidth - 240, moveEvent.clientX - dx))}px`;
      element.style.top = `${Math.max(0, Math.min(globalThis.innerHeight - 80, moveEvent.clientY - dy))}px`;
    };
    const stop = () => {
      globalThis.removeEventListener("pointermove", move);
      saveState(element);
    };
    globalThis.addEventListener("pointermove", move);
    globalThis.addEventListener("pointerup", stop, { once: true });
  });
  if (globalThis.ResizeObserver) {
    const observer = new ResizeObserver(() => saveState(element));
    observer.observe(element);
  }
  return true;
}
