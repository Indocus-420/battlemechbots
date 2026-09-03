const SYSTEM_ID = "battletech-foundry-system";
const GENERATED_MAP_DIRECTORY = "bmfs-generated-maps";

export const MAP_SIZES = Object.freeze([25, 50, 75, 100, 125]);
export const GENERATED_TERRAINS = Object.freeze({
  rough: { label: "Rough", color: "#8b7448", opacity: 0.58 },
  lightWoods: { label: "Light Woods", color: "#557a39", opacity: 0.55 },
  heavyWoods: { label: "Heavy Woods", color: "#264e2b", opacity: 0.64 },
  rubble: { label: "Rubble", color: "#706b64", opacity: 0.58 },
  waterDepth1: { label: "Water Depth 1", color: "#277da1", opacity: 0.6 },
  waterDepth2: { label: "Water Depth 2", color: "#155f86", opacity: 0.65 }
});
export const VISUAL_PRESETS = Object.freeze({
  temperate: {
    label: "Temperate Frontier",
    ground: "#647546",
    groundDark: "#3f5132",
    road: "#8b7658",
    grid: "#d7e1b7"
  },
  desert: {
    label: "Desert Frontier",
    ground: "#a17b49",
    groundDark: "#6d5031",
    road: "#715137",
    grid: "#ead3a1"
  }
});

export function normalizeMapSize(value) {
  const size = Number(value);
  if (!MAP_SIZES.includes(size)) throw new RangeError(`Map size must be ${MAP_SIZES.join(", ")} hexes.`);
  return size;
}

export function seededRandom(seed = "battlemech") {
  let state = 2166136261;
  for (const character of String(seed)) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function rectanglesOverlap(left, right, padding = 0) {
  return left.column < right.column + right.width + padding
    && left.column + left.width + padding > right.column
    && left.row < right.row + right.height + padding
    && left.row + left.height + padding > right.row;
}

function terrainDeck(prompt) {
  const text = String(prompt).toLowerCase();
  const deck = ["rough", "lightWoods", "heavyWoods", "rubble", "waterDepth1", "waterDepth2"];
  if (/forest|woods|trees|jungle|brush/.test(text)) deck.push("lightWoods", "heavyWoods", "heavyWoods");
  if (/river|lake|water|swamp|marsh|coast/.test(text)) deck.push("waterDepth1", "waterDepth1", "waterDepth2");
  if (/city|urban|base|industrial|ruin|reactor/.test(text)) deck.push("rubble", "rubble", "rough");
  if (/hill|ridge|valley|mountain|plateau/.test(text)) deck.push("rough", "rough", "lightWoods");
  return deck;
}

export function randomBattleTechMapPlan({
  size = 25,
  seed = Date.now(),
  hexSize = 50,
  environment = "temperate",
  prompt = "frontier battlefield with roads, hills, woods, and water",
  orientation = "square"
} = {}) {
  const hexes = normalizeMapSize(size);
  const grid = Math.max(32, Math.min(200, Math.round(Number(hexSize) || 50)));
  const random = seededRandom(`${seed}:${prompt}:${environment}`);
  const deck = terrainDeck(prompt);
  const widthHexes = orientation === "landscape" ? Math.round(hexes * 1.25) : hexes;
  const heightHexes = orientation === "portrait" ? Math.round(hexes * 1.25) : hexes;
  const zones = [];
  const reserved = [
    { column: Math.floor(widthHexes * 0.64), row: 1, width: Math.ceil(widthHexes * 0.23), height: Math.ceil(heightHexes * 0.18) },
    { column: 1, row: Math.floor(heightHexes * 0.64), width: Math.ceil(widthHexes * 0.15), height: Math.ceil(heightHexes * 0.15) },
    { column: Math.floor(widthHexes * 0.73), row: Math.floor(heightHexes * 0.7), width: Math.ceil(widthHexes * 0.16), height: Math.ceil(heightHexes * 0.16) }
  ];
  const count = Math.max(12, Math.round(hexes / 2));
  let attempts = 0;
  while (zones.length < count && attempts < count * 30) {
    attempts += 1;
    const radius = Math.max(2, Math.round(2 + random() * Math.max(3, hexes / 10)));
    const terrain = deck[Math.floor(random() * deck.length)];
    const water = terrain.startsWith("water");
    const zone = {
      id: `bmfs-${zones.length + 1}`,
      terrain,
      column: Math.floor(random() * Math.max(1, widthHexes - radius)),
      row: Math.floor(random() * Math.max(1, heightHexes - radius)),
      width: radius,
      height: Math.max(2, Math.min(heightHexes, Math.round(radius * (0.65 + random() * 0.7)))),
      elevation: water ? 0 : (random() > 0.77 ? 1 + Math.floor(random() * 3) : 0)
    };
    if ([...zones, ...reserved].some(existing => rectanglesOverlap(zone, existing, 1))) continue;
    zones.push(zone);
  }
  const roads = [{
    id: "primary-road",
    width: Math.max(1, Math.round(hexes / 35)),
    points: [
      [0, Math.round(heightHexes * (0.2 + random() * 0.18))],
      [Math.round(widthHexes * 0.35), Math.round(heightHexes * (0.42 + random() * 0.12))],
      [Math.round(widthHexes * 0.66), Math.round(heightHexes * (0.35 + random() * 0.2))],
      [widthHexes, Math.round(heightHexes * (0.58 + random() * 0.18))]
    ]
  }];
  return {
    seed: String(seed),
    prompt: String(prompt),
    orientation: ["square", "portrait", "landscape"].includes(orientation) ? orientation : "square",
    hexes,
    widthHexes,
    heightHexes,
    grid,
    width: widthHexes * grid,
    height: heightHexes * grid,
    zones,
    roads,
    environment: VISUAL_PRESETS[environment] ? environment : "temperate"
  };
}

function xml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
}

function zoneSvg(zone, plan) {
  const terrain = GENERATED_TERRAINS[zone.terrain];
  const x = zone.column * plan.grid;
  const y = zone.row * plan.grid;
  const width = zone.width * plan.grid;
  const height = zone.height * plan.grid;
  const radius = Math.max(plan.grid, Math.min(width, height) * 0.3);
  const pattern = zone.terrain === "heavyWoods" ? "woods-heavy"
    : zone.terrain === "lightWoods" ? "woods-light"
      : zone.terrain === "rubble" ? "rubble"
        : zone.terrain.startsWith("water") ? "water"
          : "ground-detail";
  const contour = zone.elevation
    ? `<rect x="${x + plan.grid * 0.24}" y="${y + plan.grid * 0.24}" width="${Math.max(1, width - plan.grid * 0.48)}" height="${Math.max(1, height - plan.grid * 0.48)}" rx="${radius * 0.8}" fill="none" stroke="#ead9a0" stroke-width="${Math.max(3, plan.grid * 0.1)}" opacity=".6"/>`
    : "";
  return `<g data-zone="${xml(zone.id)}" data-terrain="${xml(zone.terrain)}" data-elevation="${zone.elevation}">
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${terrain.color}"/>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="url(#${pattern})" opacity=".82"/>
    ${contour}
  </g>`;
}

export function renderBattlefieldSvg(plan) {
  const preset = VISUAL_PRESETS[plan.environment];
  const gridStroke = Math.max(1, plan.grid * 0.025);
  const zones = [...plan.zones].sort((left, right) => Number(left.terrain.startsWith("water")) - Number(right.terrain.startsWith("water")));
  const roads = plan.roads.map(road => {
    const points = road.points.map(([x, y]) => `${x * plan.grid},${y * plan.grid}`).join(" ");
    return `<polyline points="${points}" fill="none" stroke="#352d25" stroke-width="${road.width * plan.grid * 1.45}" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/>
      <polyline points="${points}" fill="none" stroke="${preset.road}" stroke-width="${road.width * plan.grid}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${plan.width}" height="${plan.height}" viewBox="0 0 ${plan.width} ${plan.height}">
    <defs>
      <linearGradient id="ground" x2="0" y2="1"><stop stop-color="${preset.ground}"/><stop offset="1" stop-color="${preset.groundDark}"/></linearGradient>
      <pattern id="ground-detail" width="${plan.grid}" height="${plan.grid}" patternUnits="userSpaceOnUse"><circle cx="${plan.grid * 0.2}" cy="${plan.grid * 0.3}" r="${plan.grid * 0.05}" fill="#2f3827" opacity=".3"/><path d="M0 ${plan.grid * 0.8}L${plan.grid} ${plan.grid * 0.2}" stroke="#d8c991" opacity=".08"/></pattern>
      <pattern id="water" width="${plan.grid * 1.4}" height="${plan.grid * 0.55}" patternUnits="userSpaceOnUse"><path d="M0 ${plan.grid * 0.25} Q${plan.grid * 0.35} 0 ${plan.grid * 0.7} ${plan.grid * 0.25} T${plan.grid * 1.4} ${plan.grid * 0.25}" fill="none" stroke="#8ed8e6" stroke-width="${Math.max(2, plan.grid * 0.045)}" opacity=".42"/></pattern>
      <pattern id="woods-light" width="${plan.grid}" height="${plan.grid}" patternUnits="userSpaceOnUse"><circle cx="${plan.grid * 0.25}" cy="${plan.grid * 0.32}" r="${plan.grid * 0.16}" fill="#243f26"/><circle cx="${plan.grid * 0.7}" cy="${plan.grid * 0.67}" r="${plan.grid * 0.2}" fill="#315b31"/></pattern>
      <pattern id="woods-heavy" width="${plan.grid * 0.8}" height="${plan.grid * 0.8}" patternUnits="userSpaceOnUse"><circle cx="${plan.grid * 0.2}" cy="${plan.grid * 0.22}" r="${plan.grid * 0.2}" fill="#142c1d"/><circle cx="${plan.grid * 0.57}" cy="${plan.grid * 0.53}" r="${plan.grid * 0.23}" fill="#1f4325"/></pattern>
      <pattern id="rubble" width="${plan.grid}" height="${plan.grid}" patternUnits="userSpaceOnUse"><path d="M5 5l${plan.grid * 0.3} ${plan.grid * 0.08}-${plan.grid * 0.1} ${plan.grid * 0.26}zM${plan.grid * 0.55} ${plan.grid * 0.5}l${plan.grid * 0.32} ${plan.grid * 0.2}-${plan.grid * 0.25} ${plan.grid * 0.18}z" fill="#35383a" opacity=".68"/></pattern>
      <pattern id="hexgrid" width="${plan.grid * 1.5}" height="${plan.grid * 1.732}" patternUnits="userSpaceOnUse"><path d="M${plan.grid * 0.5} 0L${plan.grid * 1.5} 0L${plan.grid * 2} ${plan.grid * 0.866}L${plan.grid * 1.5} ${plan.grid * 1.732}L${plan.grid * 0.5} ${plan.grid * 1.732}L0 ${plan.grid * 0.866}Z" fill="none" stroke="${preset.grid}" stroke-width="${gridStroke}" opacity=".22"/></pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#ground)"/>
    <rect width="100%" height="100%" fill="url(#ground-detail)" opacity=".7"/>
    ${zones.map(zone => zoneSvg(zone, plan)).join("")}
    ${roads}
    <rect width="100%" height="100%" fill="url(#hexgrid)"/>
    <g fill="#eef5dc" font-family="sans-serif" font-size="${Math.max(16, plan.grid * 0.34)}" paint-order="stroke" stroke="#142015" stroke-width="${Math.max(2, plan.grid * 0.05)}">
      ${zones.map(zone => `<text x="${(zone.column + zone.width / 2) * plan.grid}" y="${(zone.row + zone.height / 2) * plan.grid}" text-anchor="middle">${xml(GENERATED_TERRAINS[zone.terrain].label)}${zone.elevation ? ` · L${zone.elevation}` : ""}</text>`).join("")}
    </g>
  </svg>`;
}

export async function uploadBattlefieldImage(plan, { directory = GENERATED_MAP_DIRECTORY } = {}) {
  const FilePicker = globalThis.foundry?.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
  if (!FilePicker?.upload) throw new Error("Foundry file upload is unavailable.");
  try {
    await FilePicker.createDirectory?.("data", directory, {});
  } catch (error) {
    if (!/exist/i.test(String(error?.message))) console.warn("BMFS | Generated-map directory could not be created.", error);
  }
  const safeSeed = plan.seed.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 48) || "battlefield";
  const file = new File([renderBattlefieldSvg(plan)], `battlefield-${safeSeed}.svg`, { type: "image/svg+xml" });
  const uploaded = await FilePicker.upload("data", directory, file, {}, { notify: false });
  const path = uploaded?.path ?? uploaded;
  if (!path || typeof path !== "string") throw new Error("Foundry did not return the generated map image path.");
  return path;
}

export function scenicTileSources(plan) {
  const structures = [
    { name: "Frontier Base", src: "assets/scenery/frontier-base.svg", x: 0.67, y: 0.08, width: 0.19, height: 0.14 },
    { name: "Air Control Tower", src: "assets/scenery/air-control-tower.svg", x: 0.09, y: 0.67, width: 0.09, height: 0.09 },
    { name: "Fusion Reactor", src: "assets/scenery/fusion-reactor.svg", x: 0.76, y: 0.73, width: 0.11, height: 0.11 }
  ];
  return structures.map((structure, index) => ({
    name: structure.name,
    x: Math.round(plan.width * structure.x),
    y: Math.round(plan.height * structure.y),
    width: Math.round(plan.width * structure.width),
    height: Math.round(plan.height * structure.height),
    z: 100 + index,
    overhead: false,
    hidden: false,
    texture: { src: `systems/${SYSTEM_ID}/${structure.src}`, scaleX: 1, scaleY: 1, tint: "#ffffff" },
    flags: { [SYSTEM_ID]: { generated: true, scenic: true, seed: plan.seed } }
  }));
}

export function generatedWallSources(plan) {
  const normal = globalThis.CONST?.WALL_SENSE_TYPES?.NORMAL ?? 1;
  return plan.zones
    .filter(zone => zone.elevation > 0 || zone.terrain === "rubble")
    .flatMap(zone => {
      const x1 = zone.column * plan.grid;
      const y1 = zone.row * plan.grid;
      const x2 = x1 + zone.width * plan.grid;
      const y2 = y1 + zone.height * plan.grid;
      const common = {
        move: normal, sight: normal, light: normal, sound: normal, door: 0, dir: 0,
        flags: { [SYSTEM_ID]: { generated: true, terrain: zone.terrain, seed: plan.seed } }
      };
      return [
        { ...common, c: [x1, y1, x2, y1] },
        { ...common, c: [x2, y1, x2, y2] },
        { ...common, c: [x2, y2, x1, y2] },
        { ...common, c: [x1, y2, x1, y1] }
      ];
    });
}

function regionSource(zone, plan) {
  const terrain = GENERATED_TERRAINS[zone.terrain];
  return {
    name: `${terrain.label} ${zone.id}`,
    color: terrain.color,
    elevation: { bottom: zone.elevation, top: zone.elevation + 1 },
    shapes: [{
      type: "rectangle",
      x: zone.column * plan.grid,
      y: zone.row * plan.grid,
      width: zone.width * plan.grid,
      height: zone.height * plan.grid,
      rotation: 0
    }],
    flags: { [SYSTEM_ID]: { generated: true, terrain: zone.terrain, elevation: zone.elevation, seed: plan.seed } }
  };
}

function drawingSource(zone, plan) {
  const terrain = GENERATED_TERRAINS[zone.terrain];
  return {
    shape: { type: "r", width: zone.width * plan.grid, height: zone.height * plan.grid },
    x: zone.column * plan.grid,
    y: zone.row * plan.grid,
    fillType: 1,
    fillColor: terrain.color,
    fillAlpha: 0.04,
    strokeWidth: 1,
    strokeColor: terrain.color,
    text: zone.elevation ? `${terrain.label} · L${zone.elevation}` : terrain.label,
    fontSize: Math.max(18, Math.round(plan.grid * 0.38)),
    textColor: "#ffffff",
    flags: { [SYSTEM_ID]: { generated: true, terrain: zone.terrain, elevation: zone.elevation, seed: plan.seed, massEditGroup: `BMFS ${terrain.label}` } }
  };
}

export async function createRandomBattleTechScene(options = {}) {
  if (!globalThis.game?.user?.isGM) throw new Error("Only a Gamemaster can generate a BattleTech map.");
  const plan = randomBattleTechMapPlan(options);
  globalThis.ui?.notifications?.info?.("Rendering aligned battlefield image and terrain data…");
  const backgroundPath = await uploadBattlefieldImage(plan);
  const hexType = globalThis.CONST?.GRID_TYPES?.HEXODDR ?? 2;
  const scene = await globalThis.Scene.create({
    name: options.name || `Generated Battlefield ${plan.hexes}x${plan.hexes}`,
    width: plan.width,
    height: plan.height,
    padding: 0,
    grid: { type: hexType, size: plan.grid, distance: 1, units: "hex" },
    backgroundColor: VISUAL_PRESETS[plan.environment].groundDark,
    initialLevel: "defaultLevel0000",
    levels: [{
      _id: "defaultLevel0000",
      name: "Ground",
      elevation: { bottom: 0, top: 20 },
      background: { src: backgroundPath, tint: "#ffffff" }
    }],
    tokenVision: true,
    fog: { mode: globalThis.CONST?.FOG_EXPLORATION_MODES?.INDIVIDUAL ?? 1 },
    environment: { darknessLevel: 0, globalLight: { enabled: false } },
    flags: {
      [SYSTEM_ID]: {
        generatedMap: true,
        seed: plan.seed,
        prompt: plan.prompt,
        hexes: plan.hexes,
        backgroundPath,
        plan
      }
    }
  });
  await scene.createEmbeddedDocuments("Drawing", plan.zones.map(zone => drawingSource(zone, plan)));
  await scene.createEmbeddedDocuments("Tile", scenicTileSources(plan));
  await scene.createEmbeddedDocuments("Wall", generatedWallSources(plan));
  try {
    await scene.createEmbeddedDocuments("Region", plan.zones.map(zone => regionSource(zone, plan)));
  } catch (error) {
    console.warn("BMFS | Native terrain Regions could not be created; generated Drawings remain available.", error);
  }
  await scene.activate();
  globalThis.ui?.notifications?.info?.(`Generated aligned ${plan.hexes}x${plan.hexes} battlefield from seed ${plan.seed}.`);
  return { scene, plan, backgroundPath };
}

export async function promptRandomBattleTechMap() {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.input) throw new Error("Foundry's map generator dialog is unavailable.");
  const result = await DialogV2.input({
    window: { title: "BattleTech Battlefield Studio" },
    content: `<div class="bmfs-map-generator">
      <p>Describe a battlefield. One shared plan will generate the visible map, terrain Regions, elevations, walls, fog, and Scene data.</p>
      <label>Battlefield description<textarea name="prompt" rows="3">frontier battlefield with a winding road, wooded hills, shallow river, industrial base, and scattered rubble</textarea></label>
      <label>Map size <select name="size">${MAP_SIZES.map(size => `<option value="${size}">${size} × ${size} hexes</option>`).join("")}</select></label>
      <label>Environment <select name="environment">${Object.entries(VISUAL_PRESETS).map(([key, preset]) => `<option value="${key}">${preset.label}</option>`).join("")}</select></label>
      <label>Orientation <select name="orientation"><option value="square">Square</option><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label>
      <label>Hex pixel size <input name="hexSize" type="number" min="32" max="200" value="50"></label>
      <label>Seed <input name="seed" type="text" value="${Date.now()}"></label>
      <label>Scene name <input name="name" type="text" value="Generated Battlefield"></label>
    </div>`,
    ok: { label: "Generate Image, Data, and Scene" },
    rejectClose: false,
    modal: true
  });
  if (!result) return null;
  const value = key => typeof result.get === "function" ? result.get(key) : result.object?.[key] ?? result[key];
  return createRandomBattleTechScene({
    size: Number(value("size")),
    hexSize: Number(value("hexSize")),
    seed: value("seed"),
    name: value("name"),
    environment: value("environment"),
    orientation: value("orientation"),
    prompt: value("prompt")
  });
}
