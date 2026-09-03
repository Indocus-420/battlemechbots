#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const [sourcePath, outputDir = path.dirname(sourcePath ?? "")] = process.argv.slice(2);
if (!sourcePath) throw new Error("Usage: node tools/build-hbs-vehicle-import.mjs <normalized-hbs.json> [output-directory]");

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const componentById = new Map([
  ...(source.items?.weapons ?? []),
  ...(source.items?.ammunition ?? []),
  ...(source.items?.ammunitionBoxes ?? []),
  ...(source.items?.equipment ?? [])
].map(component => [component.id, component]));

const clean = value => String(value ?? "").trim();
const locationName = value => ({ front: "front", rear: "rear", left: "left", right: "right", turret: "turret", body: "body" }[clean(value).toLowerCase()] ?? "body");
const motiveType = value => {
  const text = clean(value).toLowerCase();
  if (text.includes("wheel")) return "wheeled";
  if (text.includes("hover")) return "hover";
  if (text.includes("vtol")) return "vtol";
  return "tracked";
};
const presentationFor = vehicle => {
  const motive = motiveType(vehicle.movementType);
  const searchable = `${vehicle.name} ${vehicle.chassis?.name ?? ""}`.toLowerCase();
  let slug = "generic-medium-battle-tank";
  if (motive === "vtol") slug = "generic-vtol-gunship";
  else if (motive === "hover") slug = "generic-hover-skirmisher";
  else if (/lrm|srm|missile|carrier/.test(searchable)) slug = "generic-missile-support-carrier";
  else if (Number(vehicle.tonnage ?? 0) >= 70) slug = "generic-heavy-assault-tank";
  else if (Number(vehicle.tonnage ?? 0) <= 25 || /scout|swift|hq|apc/.test(searchable)) slug = "generic-light-scout-car";
  const root = "systems/battletech-foundry-system";
  return {
    image: `${root}/assets/vehicles/${slug}.svg`,
    sound: `${root}/assets/audio/vehicles/${slug}.wav`,
    slug
  };
};
const weaponType = component => {
  const text = `${component.category} ${component.type} ${component.subtype} ${component.name}`.toLowerCase();
  if (text.includes("missile") || /\b[ls]rm/.test(text)) return "missile";
  if (text.includes("ppc")) return "ppc";
  if (text.includes("laser") || text.includes("flamer")) return "laser";
  return "autocannon";
};
const tabletopDamage = component => Math.max(0, Math.round(Number(component.damage ?? 0) / 5));
const tabletopHeat = component => Math.max(0, Math.round(Number(component.heatGenerated ?? 0) / 3));
const rangeFor = component => {
  const splits = component.rangeSplitHexes ?? [];
  const long = Math.max(0, Number(component.maximumRangeHexes ?? 0));
  const medium = Math.max(0, Number(splits[0] ?? Math.ceil(long * 2 / 3)));
  const short = Math.max(0, Math.min(medium, Math.ceil(medium / 2)));
  return { minimum: Math.max(0, Number(component.minimumRangeHexes ?? 0)), short, medium, long };
};
const baseCriticals = component => ({
  slotStart: 1,
  slots: Math.max(1, Number(component.inventorySlots ?? 1)),
  damagedSlots: [],
  criticalHits: 0,
  destroyed: false
});

function itemFrom(entry) {
  const component = componentById.get(entry.componentId);
  if (!component) throw new Error(`Unresolved vehicle component: ${entry.componentId}`);
  const location = locationName(entry.location);
  const sourceNote = `Imported from HBS component ${entry.componentId}.`;
  if ((source.items?.weapons ?? []).some(item => item.id === component.id)) {
    const volleys = Math.max(1, Number(component.shotsWhenFired ?? 1));
    return {
      name: clean(component.name) || entry.name || component.id,
      type: "weapon",
      system: {
        weaponType: weaponType(component), location,
        damage: tabletopDamage(component), heat: tabletopHeat(component),
        ammoPerShot: clean(component.ammoCategory) && component.ammoCategory !== "NotSet" ? volleys : 0,
        shots: 0, ...baseCriticals(component),
        range: rangeFor(component), notes: sourceNote
      },
      flags: { "battletech-foundry-system": { hbsSourceId: component.id, hbsMass: Number(component.tonnage ?? 0) } }
    };
  }
  if ((source.items?.ammunitionBoxes ?? []).some(item => item.id === component.id)) {
    const ammunition = componentById.get(component.ammunitionId);
    const ammoType = clean(ammunition?.category ?? component.model ?? component.name).replace(/\s+Ammo$/i, "");
    return {
      name: clean(component.name) || entry.name || component.id,
      type: "ammo",
      system: {
        ammoType, location,
        shots: Math.max(0, Number(component.capacity ?? 0)),
        maxShots: Math.max(0, Number(component.capacity ?? 0)),
        damagePerShot: Math.max(0, Math.round(Number(ammunition?.damagePerShot ?? 0) / 5)),
        ...baseCriticals(component), notes: sourceNote
      },
      flags: { "battletech-foundry-system": { hbsSourceId: component.id, hbsMass: Number(component.tonnage ?? 0) } }
    };
  }
  return {
    name: clean(component.name) || entry.name || component.id,
    type: "equipment",
    system: { location, ...baseCriticals(component), criticalEffect: "general", notes: sourceNote },
    flags: { "battletech-foundry-system": { hbsSourceId: component.id, hbsMass: Number(component.tonnage ?? 0) } }
  };
}

const duplicateNames = new Map();
for (const vehicle of source.vehicles ?? []) duplicateNames.set(vehicle.name, (duplicateNames.get(vehicle.name) ?? 0) + 1);

const actors = (source.vehicles ?? []).map(vehicle => {
  const locations = vehicle.locations ?? {};
  const displayName = duplicateNames.get(vehicle.name) > 1 ? `${vehicle.name} (${vehicle.tonnage}t)` : vehicle.name;
  const structure = Math.max(0, ...Object.values(locations).map(location => Number(location.structure ?? 0)));
  const items = (vehicle.inventory ?? []).map(itemFrom);
  const presentation = presentationFor(vehicle);
  return {
    name: displayName,
    type: "vehicle",
    img: presentation.image,
    prototypeToken: {
      name: displayName,
      actorLink: true,
      disposition: 0,
      width: 1,
      height: 1,
      texture: { src: presentation.image, scaleX: 1, scaleY: 1 }
    },
    system: {
      schemaVersion: 1,
      vehicle: {
        chassis: clean(vehicle.chassis?.name ?? vehicle.name),
        variant: clean(vehicle.id).replace(/^vehicledef_/i, "") || "Standard",
        tonnage: Number(vehicle.tonnage ?? 1),
        motiveType: motiveType(vehicle.movementType),
        role: clean(vehicle.weightClass) ? `${vehicle.weightClass[0]}${vehicle.weightClass.slice(1).toLowerCase()} HBS Vehicle` : "HBS Vehicle"
      },
      crew: { name: "", gunnery: 4, driving: 5, hits: 0 },
      movement: { cruise: Number(vehicle.movement?.cruiseHexes ?? 0), flank: Number(vehicle.movement?.flankHexes ?? 0) },
      armor: Object.fromEntries(["front", "left", "right", "rear", "turret"].map(key => [key, Number(locations[key]?.armor ?? 0)])),
      structure,
      status: { immobilized: false, destroyed: false },
      notes: `Local import from user-owned HBS BattleTech data (${vehicle.id}).`
    },
    items,
    flags: { "battletech-foundry-system": { hbsSourceId: vehicle.id, hbsChassisId: vehicle.chassisId, hbsWeightClass: vehicle.weightClass, presentation } }
  };
});

const ids = actors.map(actor => actor.flags["battletech-foundry-system"].hbsSourceId);
const names = actors.map(actor => actor.name);
const errors = [];
if (new Set(ids).size !== ids.length) errors.push("Duplicate HBS vehicle IDs remain.");
if (new Set(names).size !== names.length) errors.push("Duplicate Foundry actor names remain.");
for (const actor of actors) {
  if (!["tracked", "wheeled", "hover", "vtol"].includes(actor.system.vehicle.motiveType)) errors.push(`${actor.name}: invalid motive type.`);
  if (actor.system.movement.cruise < 0 || actor.system.movement.flank < actor.system.movement.cruise) errors.push(`${actor.name}: invalid movement.`);
  if (Object.values(actor.system.armor).some(value => value < 0)) errors.push(`${actor.name}: invalid armor.`);
}

const payloadPath = path.join(outputDir, "hbs-vehicles-foundry-actors.json");
const reportPath = path.join(outputDir, "hbs-vehicles-validation.json");
const macroPath = path.join(outputDir, "import-hbs-vehicles-foundry-macro.js");
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(payloadPath, `${JSON.stringify({ actors }, null, 2)}\n`);
fs.writeFileSync(reportPath, `${JSON.stringify({
  passed: errors.length === 0,
  actorCount: actors.length,
  embeddedItemCount: actors.reduce((sum, actor) => sum + actor.items.length, 0),
  uniqueSourceIds: new Set(ids).size,
  uniqueActorNames: new Set(names).size,
  unresolvedComponents: 0,
  errors
}, null, 2)}\n`);

const macro = `// BattleMechBots local HBS vehicle importer. Generated from user-owned data.\nconst ACTORS = ${JSON.stringify(actors)};\nconst SYSTEM_FLAG = "battlemechbots";\nconst folder = game.folders.find(f => f.type === "Actor" && f.name === "Vehicles") ?? await Folder.create({name:"Vehicles", type:"Actor"});\nconst existingBySource = new Map(game.actors.filter(a => a.type === "vehicle" && a.getFlag(SYSTEM_FLAG,"hbsSourceId")).map(a => [a.getFlag(SYSTEM_FLAG,"hbsSourceId"), a]));\nconst conflicts = []; const created = []; const updated = [];\nfor (const source of ACTORS) {\n  const sourceId = source.flags[SYSTEM_FLAG].hbsSourceId;\n  const managed = existingBySource.get(sourceId);\n  if (managed) { await managed.update({folder:folder.id, name:source.name, system:source.system, flags:source.flags}); updated.push(source.name); continue; }\n  const nameConflict = game.actors.find(a => a.name === source.name);\n  if (nameConflict) { conflicts.push(source.name); continue; }\n  const actor = await Actor.create({...source, folder:folder.id}); created.push(actor.name);\n}\nconst managed = game.actors.filter(a => a.type === "vehicle" && a.folder?.id === folder.id && a.getFlag(SYSTEM_FLAG,"hbsSourceId"));\nconst summary = {created:created.length, updated:updated.length, conflicts, managedVehicles:managed.length, embeddedItems:managed.reduce((n,a)=>n+a.items.size,0)};\nconsole.table(summary); ui.notifications.info(\`HBS vehicles: \${created.length} created, \${updated.length} updated, \${conflicts.length} conflicts.\`, {permanent:true});\nsummary;\n`;
const emittedMacro = macro
  .replace('const SYSTEM_FLAG = "battlemechbots";', 'const SYSTEM_FLAG = "battletech-foundry-system";')
  .replace(
    'if (managed) { await managed.update({folder:folder.id, name:source.name, system:source.system, flags:source.flags}); updated.push(source.name); continue; }',
    'if (managed) { await managed.update({folder:folder.id, name:source.name, img:source.img, prototypeToken:source.prototypeToken, system:source.system, flags:source.flags}); updated.push(source.name); continue; }'
  )
  .replace(
    'if (nameConflict) { conflicts.push(source.name); continue; }',
    'if (nameConflict?.type === "vehicle") { await nameConflict.update({folder:folder.id, img:source.img, prototypeToken:source.prototypeToken, system:source.system, flags:source.flags}); updated.push(source.name); continue; }\n  if (nameConflict) { conflicts.push(source.name); continue; }'
  );
fs.writeFileSync(macroPath, emittedMacro);
console.log(JSON.stringify({ payloadPath, reportPath, macroPath, actors: actors.length, items: actors.reduce((sum, actor) => sum + actor.items.length, 0), passed: errors.length === 0 }, null, 2));
if (errors.length) process.exitCode = 1;
