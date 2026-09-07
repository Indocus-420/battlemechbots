import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CORE_ITEMS, CORE_MECHS, CORE_VEHICLES, itemCatalogGroup } from "../module/content.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const imageDirectory = join(root, "assets", "mechs");
const soundDirectory = join(root, "assets", "audio", "mechs");
const itemDirectory = join(root, "assets", "items");
const vehicleDirectory = join(root, "assets", "vehicles");
const vehicleSoundDirectory = join(root, "assets", "audio", "vehicles");
await mkdir(imageDirectory, { recursive: true });
await mkdir(soundDirectory, { recursive: true });
await mkdir(itemDirectory, { recursive: true });
await mkdir(vehicleDirectory, { recursive: true });
await mkdir(vehicleSoundDirectory, { recursive: true });

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function hash(value) {
  return [...value].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 7);
}

function silhouette(actor) {
  const seed = hash(actor.name);
  const weightClass = actor.flags["battletech-foundry-system"].presentation.weightClass;
  const scale = { light: 0.78, medium: 0.9, heavy: 1.02, assault: 1.12 }[weightClass];
  const shoulder = 112 + (seed % 36);
  const torso = 104 + ((seed >>> 4) % 34);
  const head = 24 + ((seed >>> 8) % 14);
  const weaponLeft = seed % 2 === 0;
  const weaponRight = seed % 3 !== 0;
  const jumpJets = actor.system.movement.jump > 0;
  const transform = `translate(256 262) scale(${scale}) translate(-256 -262)`;
  return `<g transform="${transform}" fill="url(#armor)" stroke="#d7e3ea" stroke-width="6" stroke-linejoin="round">
    ${jumpJets ? '<path d="M174 310 145 382 192 350M338 310l29 72-47-32" fill="#e66b2e" opacity=".82"/>' : ""}
    <path d="M226 104 208 142 220 174 292 174 304 142 286 104Z"/>
    <rect x="${256-head}" y="126" width="${head*2}" height="54" rx="12" fill="#101a22"/>
    <path d="M${256-torso} 178 188 284 214 330 298 330 324 284 ${256+torso} 178Z"/>
    <path d="M188 196 ${188-shoulder} 226 ${102-(seed%22)} 326 142 342 208 262Z"/>
    <path d="M324 196 ${324+shoulder} 226 ${410+(seed%22)} 326 370 342 304 262Z"/>
    ${weaponLeft ? '<path d="M90 276 46 290 40 312 112 314Z" fill="#243746"/>' : ""}
    ${weaponRight ? '<path d="M422 276 466 290 472 312 400 314Z" fill="#243746"/>' : ""}
    <path d="M220 320 174 450 218 470 256 360 294 470 338 450 292 320Z"/>
    <path d="M164 446 142 476 226 486 222 462ZM348 446l22 30-84 10 4-24Z" fill="#182733"/>
  </g>`;
}

function svg(actor) {
  const presentation = actor.flags["battletech-foundry-system"].presentation;
  const hue = hash(actor.name) % 360;
  const abbreviation = actor.system.mech.variant.split("-")[0].slice(0, 4);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="title desc">
  <title id="title">${actor.name}</title><desc id="desc">Original ${presentation.weightClass} BattleMech token art.</desc>
  <defs>
    <radialGradient id="bg"><stop stop-color="hsl(${hue} 35% 24%)"/><stop offset="1" stop-color="#071017"/></radialGradient>
    <linearGradient id="armor" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 72% 60%)"/><stop offset=".5" stop-color="hsl(${(hue+28)%360} 58% 38%)"/><stop offset="1" stop-color="#17242d"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="512" height="512" rx="52" fill="url(#bg)"/>
  <path d="M256 18 462 137v238L256 494 50 375V137Z" fill="none" stroke="hsl(${hue} 80% 62%)" stroke-width="12" filter="url(#glow)"/>
  ${silhouette(actor)}
  <path d="M66 402h380v62H66z" fill="#050a0d" opacity=".88"/>
  <text x="256" y="431" fill="#f4f7f8" font-family="Arial,sans-serif" font-size="25" font-weight="700" text-anchor="middle">${actor.system.mech.chassis.toUpperCase()}</text>
  <text x="256" y="456" fill="hsl(${hue} 80% 70%)" font-family="Arial,sans-serif" font-size="18" text-anchor="middle">${abbreviation} - ${actor.system.mech.tonnage}T ${presentation.weightClass.toUpperCase()}</text>
</svg>`;
}

function wav(actor) {
  const profile = actor.flags["battletech-foundry-system"].presentation;
  const rate = 22050;
  const seconds = profile.duration / 1000;
  const samples = Math.floor(rate * seconds);
  const data = Buffer.alloc(samples * 2);
  const seed = hash(actor.name);
  const weightMultiplier = { light: 1.35, medium: 1.1, heavy: 0.88, assault: 0.72, vehicle: 0.76 }[profile.weightClass];
  const base = profile.frequency * weightMultiplier;
  for (let index = 0; index < samples; index += 1) {
    const time = index / rate;
    const envelope = Math.sin(Math.min(1, time * 18) * Math.PI / 2) * Math.exp(-time * 3.8);
    const engine = Math.sin(2 * Math.PI * base * time) * 0.54;
    const harmonic = Math.sin(2 * Math.PI * base * 1.5 * time + (seed % 7)) * 0.24;
    const servo = Math.sign(Math.sin(2 * Math.PI * (base * 0.5 + 13) * time)) * 0.12;
    const noise = (((seed * (index + 17)) % 997) / 997 - 0.5) * 0.08;
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round((engine + harmonic + servo + noise) * envelope * 32767))), index * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function itemSvg(item) {
  const seed = hash(item.name);
  const hue = seed % 360;
  const group = itemCatalogGroup(item);
  const symbol = group === "energy"
    ? '<circle cx="256" cy="238" r="92" fill="none" stroke-width="25"/><path d="M256 98v280M116 238h280"/>'
    : group === "ballistic"
      ? '<path d="M92 202h286l46 54-46 54H92z"/><rect x="168" y="310" width="98" height="88" rx="12"/>'
      : group === "missile"
        ? '<path d="M138 344 250 108l42 76 82 22-112 222z"/><path d="m164 326-54 74 88-36"/>'
        : '<circle cx="256" cy="246" r="104"/><circle cx="256" cy="246" r="44" fill="#0b141b"/><path d="M236 76h40l16 70-72 0zM236 346h40l16 70h-72zM86 226v40l70 16v-72zM356 210v72l70-16v-40z"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img"><title>${item.name}</title>
  <defs><radialGradient id="bg"><stop stop-color="hsl(${hue} 35% 25%)"/><stop offset="1" stop-color="#071017"/></radialGradient><linearGradient id="fg"><stop stop-color="hsl(${hue} 82% 66%)"/><stop offset="1" stop-color="hsl(${(hue+35)%360} 62% 34%)"/></linearGradient></defs>
  <rect width="512" height="512" rx="62" fill="url(#bg)"/><g fill="url(#fg)" stroke="#d9e6ed" stroke-width="8" stroke-linejoin="round">${symbol}</g>
  <path d="M38 404h436v72H38z" fill="#05090c" opacity=".9"/><text x="256" y="435" fill="#fff" font-family="Arial,sans-serif" font-size="22" font-weight="700" text-anchor="middle">${item.name.toUpperCase()}</text><text x="256" y="462" fill="hsl(${hue} 85% 72%)" font-family="Arial,sans-serif" font-size="18" text-anchor="middle">${group.toUpperCase()}</text></svg>`;
}

function vehicleSvg(actor) {
  const profile = actor.flags["battletech-foundry-system"].presentation;
  const hue = hash(actor.name) % 360;
  const motive = actor.system.vehicle.motiveType;
  const rotor = motive === "vtol" ? '<path d="M76 150h360M256 110v80" stroke-width="18"/>' : "";
  const skirt = motive === "hover" ? '<path d="M104 350q152 90 304 0l-30 70H134z"/>' : '<path d="M94 330h324v88H94z"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img"><title>${actor.name}</title>
  <defs><radialGradient id="bg"><stop stop-color="hsl(${hue} 30% 24%)"/><stop offset="1" stop-color="#071017"/></radialGradient><linearGradient id="armor"><stop stop-color="hsl(${hue} 72% 60%)"/><stop offset="1" stop-color="#17242d"/></linearGradient></defs>
  <rect width="512" height="512" rx="52" fill="url(#bg)"/><path d="M256 18 462 137v238L256 494 50 375V137Z" fill="none" stroke="hsl(${hue} 80% 62%)" stroke-width="12"/>
  <g fill="url(#armor)" stroke="#d7e3ea" stroke-width="7" stroke-linejoin="round">${rotor}<path d="M142 226 206 166h112l52 60 68 42-42 96H112l-38-96z"/><path d="M208 174h100v-48h-100z"/><path d="M256 126v-54" stroke-width="18"/><path d="M256 72h112" stroke-width="22"/>${skirt}</g>
  <path d="M56 402h400v64H56z" fill="#050a0d" opacity=".9"/><text x="256" y="431" fill="#fff" font-family="Arial,sans-serif" font-size="21" font-weight="700" text-anchor="middle">${actor.name.toUpperCase()}</text><text x="256" y="456" fill="hsl(${hue} 80% 70%)" font-family="Arial,sans-serif" font-size="17" text-anchor="middle">${profile.tonnage}T ${motive.toUpperCase()} VEHICLE</text></svg>`;
}

for (const actor of CORE_MECHS) {
  const filename = slug(actor.name);
  await writeFile(join(imageDirectory, `${filename}.svg`), svg(actor));
  await writeFile(join(soundDirectory, `${filename}.wav`), wav(actor));
}

for (const item of CORE_ITEMS) await writeFile(join(itemDirectory, `${slug(item.name)}.svg`), itemSvg(item));
for (const actor of CORE_VEHICLES) {
  await writeFile(join(vehicleDirectory, `${slug(actor.name)}.svg`), vehicleSvg(actor));
  await writeFile(join(vehicleSoundDirectory, `${slug(actor.name)}.wav`), wav(actor));
}

console.log(`Generated ${CORE_MECHS.length} mech portraits/sounds, ${CORE_ITEMS.length} item icons, and ${CORE_VEHICLES.length} vehicle portraits/sounds.`);
