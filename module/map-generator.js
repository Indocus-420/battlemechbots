const SYSTEM_ID = "battletech-foundry-system";
export const MAP_SIZES = Object.freeze([25, 50, 75, 100, 125]);
export const GENERATED_TERRAINS = Object.freeze({
  rough: { label: "Rough", color: "#8b7448", opacity: 0.58 },
  lightWoods: { label: "Light Woods", color: "#557a39", opacity: 0.55 },
  heavyWoods: { label: "Heavy Woods", color: "#264e2b", opacity: 0.64 },
  rubble: { label: "Rubble", color: "#706b64", opacity: 0.58 },
  waterDepth1: { label: "Water Depth 1", color: "#277da1", opacity: 0.6 },
  waterDepth2: { label: "Water Depth 2", color: "#155f86", opacity: 0.65 }
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

export function randomBattleTechMapPlan({ size = 25, seed = Date.now(), hexSize = 50 } = {}) {
  const hexes = normalizeMapSize(size);
  const grid = Math.max(32, Math.min(200, Math.round(Number(hexSize) || 50)));
  const random = seededRandom(seed);
  const terrainKeys = Object.keys(GENERATED_TERRAINS);
  const zones = [];
  const count = Math.max(12, Math.round(hexes / 2));
  for (let index = 0; index < count; index += 1) {
    const radius = Math.max(2, Math.round(2 + random() * Math.max(3, hexes / 10)));
    zones.push({
      id: `bmfs-${index + 1}`,
      terrain: terrainKeys[Math.floor(random() * terrainKeys.length)],
      column: Math.floor(random() * Math.max(1, hexes - radius)),
      row: Math.floor(random() * Math.max(1, hexes - radius)),
      width: radius,
      height: Math.max(2, Math.round(radius * (0.65 + random() * 0.7))),
      elevation: random() > 0.84 ? 1 + Math.floor(random() * 3) : 0
    });
  }
  return {
    seed: String(seed),
    hexes,
    grid,
    width: hexes * grid,
    height: hexes * grid,
    zones
  };
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
    flags: {
      [SYSTEM_ID]: {
        generated: true,
        terrain: zone.terrain,
        elevation: zone.elevation,
        seed: plan.seed
      }
    }
  };
}

function drawingSource(zone, plan) {
  const terrain = GENERATED_TERRAINS[zone.terrain];
  return {
    shape: {
      type: "r",
      width: zone.width * plan.grid,
      height: zone.height * plan.grid
    },
    x: zone.column * plan.grid,
    y: zone.row * plan.grid,
    fillType: 1,
    fillColor: terrain.color,
    fillAlpha: terrain.opacity,
    strokeWidth: 2,
    strokeColor: terrain.color,
    text: zone.elevation ? `${terrain.label} · L${zone.elevation}` : terrain.label,
    fontSize: Math.max(18, Math.round(plan.grid * 0.38)),
    textColor: "#ffffff",
    flags: {
      [SYSTEM_ID]: {
        generated: true,
        terrain: zone.terrain,
        elevation: zone.elevation,
        seed: plan.seed,
        massEditGroup: `BMFS ${terrain.label}`
      }
    }
  };
}

export async function createRandomBattleTechScene(options = {}) {
  if (!globalThis.game?.user?.isGM) throw new Error("Only a Gamemaster can generate a BattleTech map.");
  const plan = randomBattleTechMapPlan(options);
  const hexType = globalThis.CONST?.GRID_TYPES?.HEXODDR ?? 2;
  const scene = await globalThis.Scene.create({
    name: options.name || `Generated Battlefield ${plan.hexes}x${plan.hexes}`,
    width: plan.width,
    height: plan.height,
    padding: 0,
    grid: { type: hexType, size: plan.grid, distance: 1, units: "hex" },
    backgroundColor: "#9a924e",
    flags: {
      [SYSTEM_ID]: {
        generatedMap: true,
        seed: plan.seed,
        hexes: plan.hexes
      }
    }
  });
  await scene.createEmbeddedDocuments("Drawing", plan.zones.map(zone => drawingSource(zone, plan)));
  try {
    await scene.createEmbeddedDocuments("Region", plan.zones.map(zone => regionSource(zone, plan)));
  } catch (error) {
    console.warn("BMFS | Native terrain Regions could not be created; generated Drawings remain available.", error);
  }
  await scene.activate();
  globalThis.ui?.notifications?.info?.(`Generated ${plan.hexes}x${plan.hexes} battlefield from seed ${plan.seed}.`);
  return { scene, plan };
}

export async function promptRandomBattleTechMap() {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.input) throw new Error("Foundry's map generator dialog is unavailable.");
  const result = await DialogV2.input({
    window: { title: "Generate BattleTech Hex Map" },
    content: `<div class="bmfs-map-generator">
      <p>Creates a seeded native hex Scene with selectable terrain Drawings and Regions. The generated documents work with Multiple Document Selection and Mass Edit.</p>
      <label>Map size <select name="size">${MAP_SIZES.map(size => `<option value="${size}">${size} × ${size} hexes</option>`).join("")}</select></label>
      <label>Hex pixel size <input name="hexSize" type="number" min="32" max="200" value="50"></label>
      <label>Seed <input name="seed" type="text" value="${Date.now()}"></label>
      <label>Scene name <input name="name" type="text" value="Generated Battlefield"></label>
    </div>`,
    ok: { label: "Generate and Activate" },
    rejectClose: false,
    modal: true
  });
  if (!result) return null;
  const value = key => typeof result.get === "function" ? result.get(key) : result.object?.[key] ?? result[key];
  return createRandomBattleTechScene({
    size: Number(value("size")),
    hexSize: Number(value("hexSize")),
    seed: value("seed"),
    name: value("name")
  });
}
