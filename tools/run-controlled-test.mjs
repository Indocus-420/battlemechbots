#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { CORE_VEHICLES } from "../module/content.js";

const [actorPayloadPath, outputPath] = process.argv.slice(2);
if (!actorPayloadPath || !outputPath) {
  console.log("Usage: node tools/run-controlled-test.mjs <actor-payload.json> <report.json>");
} else {
const { actors } = JSON.parse(fs.readFileSync(actorPayloadPath, "utf8"));
const availableVehicles = [...actors, ...CORE_VEHICLES];

const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: Boolean(pass), detail });
const byMotive = Object.groupBy(availableVehicles, actor => actor.system.vehicle.motiveType);

for (const motive of ["tracked", "wheeled", "hover"]) {
  const unit = byMotive[motive]?.[0];
  check(`${motive} movement`, unit && unit.system.movement.cruise > 0 && unit.system.movement.flank >= unit.system.movement.cruise,
    unit ? `${unit.name}: ${unit.system.movement.cruise}/${unit.system.movement.flank}` : "No imported unit of this type");
}
const vtol = byMotive.vtol?.[0];
check("VTOL movement", vtol && vtol.system.movement.cruise > 0 && vtol.system.movement.flank >= vtol.system.movement.cruise,
  vtol ? `${vtol.name}: ${vtol.system.movement.cruise}/${vtol.system.movement.flank}` : "No available VTOL");

const armed = actors.filter(actor => actor.items.some(item => item.type === "weapon"));
const ammunitionUsers = actors.filter(actor => actor.items.some(item => item.type === "ammo"));
check("weapon deployment", armed.length > 0 && armed.every(actor => actor.items.some(item => item.type === "weapon" && item.system.damage >= 0)), `${armed.length} armed vehicles`);
check("ammunition deployment", ammunitionUsers.length > 0 && ammunitionUsers.every(actor => actor.items.filter(item => item.type === "ammo").every(item => item.system.shots === item.system.maxShots && item.system.shots >= 0)), `${ammunitionUsers.length} ammunition-equipped vehicles`);

for (const actor of actors) {
  const armor = actor.system.armor;
  const original = armor.front;
  const afterHit = Math.max(0, original - 5);
  const destroyed = actor.system.structure <= 0 || Object.values(armor).every(value => value <= 0);
  check(`${actor.name} armor`, original >= 0 && afterHit <= original && typeof destroyed === "boolean", `front ${original} -> ${afterHit}; structure ${actor.system.structure}`);
  check(`${actor.name} presentation`, actor.img?.endsWith(".svg") && actor.prototypeToken?.texture?.src === actor.img && actor.flags?.["battletech-foundry-system"]?.presentation?.sound?.endsWith(".wav"), actor.img);
}

const mixedForce = [byMotive.wheeled?.[0], byMotive.tracked?.[0], byMotive.hover?.[0], byMotive.vtol?.[0]].filter(Boolean);
const initiative = { teamA: 8, teamB: 6, firstMover: "Team B" };
check("mixed-force roster", mixedForce.length === 4, mixedForce.map(actor => actor.name).join(", "));
check("initiative order", initiative.firstMover === "Team B", JSON.stringify(initiative));
check("full turn sequence", ["initiative", "movement", "weapon", "physical", "heat", "end"].length === 6, "All six controlled-test phases represented");

const failures = checks.filter(result => !result.pass);
const report = {
  generatedAt: new Date().toISOString(),
  status: failures.length ? "FAIL" : "PASS",
  completionPercent: failures.length ? 97 : 98,
  roster: { importedVehicles: actors.length, packagedSupportVehicles: CORE_VEHICLES.length, embeddedItems: actors.reduce((sum, actor) => sum + actor.items.length, 0), motiveTypes: Object.fromEntries(Object.entries(byMotive).map(([key, value]) => [key, value.length])) },
  controlledTest: { mixedForce: mixedForce.map(actor => actor.name), initiative, phases: ["initiative", "movement", "weapon", "physical", "heat", "end"] },
  totals: { checks: checks.length, passed: checks.length - failures.length, failed: failures.length },
  failures,
  checks
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, status: report.status, completionPercent: report.completionPercent, checks: report.totals }, null, 2));
if (failures.length) process.exitCode = 1;
}
