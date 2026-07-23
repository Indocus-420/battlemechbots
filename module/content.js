const range = (minimum, short, medium, long) => ({ minimum, short, medium, long });
const SYSTEM_ID = "battletech-foundry-system";
const SYSTEM_PATH = `systems/${SYSTEM_ID}`;

export function mechWeightClass(tonnage) {
  const weight = Number(tonnage);
  if (weight <= 35) return "light";
  if (weight <= 55) return "medium";
  if (weight <= 75) return "heavy";
  return "assault";
}

function assetSlug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function itemIcon(name) {
  return `${SYSTEM_PATH}/assets/items/${assetSlug(name)}.svg`;
}

function mechPresentation(name, variant, tonnage) {
  const key = `${name} ${variant}`;
  const seed = [...key].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 7);
  const slug = assetSlug(key);
  const weightClass = mechWeightClass(tonnage);
  return {
    weightClass,
    accent: `hsl(${seed % 360} 72% 55%)`,
    frequency: 72 + (seed % 89),
    duration: 420 + (seed % 280),
    image: `${SYSTEM_PATH}/assets/mechs/${slug}.svg`,
    sound: `${SYSTEM_PATH}/assets/audio/mechs/${slug}.wav`
  };
}

function vehiclePresentation(name, tonnage) {
  const seed = [...name].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 11);
  const slug = assetSlug(name);
  return {
    weightClass: "vehicle",
    accent: `hsl(${seed % 360} 68% 54%)`,
    frequency: 64 + (seed % 70),
    duration: 460 + (seed % 300),
    image: `${SYSTEM_PATH}/assets/vehicles/${slug}.svg`,
    sound: `${SYSTEM_PATH}/assets/audio/vehicles/${slug}.wav`,
    tonnage
  };
}

function weapon(name, weaponType, damage, heat, ranges, slots, notes = "") {
  const missileRack = name.match(/\b(?:SRM|LRM)\s*(2|4|5|6|10|15|20)\b/i);
  const ammoPerShot = /\bMachine Gun\b/i.test(name)
    ? 200
    : missileRack
      ? Number(missileRack[1])
      : ["missile", "autocannon"].includes(weaponType) ? 1 : 0;
  return {
    name,
    type: "weapon",
    img: itemIcon(name),
    system: {
      weaponType,
      location: "rightArm",
      damage,
      heat,
      ammoPerShot,
      shots: 0,
      slotStart: 1,
      slots,
      damagedSlots: [],
      criticalHits: 0,
      destroyed: false,
      range: ranges,
      notes
    }
  };
}

function ammo(name, ammoType, shots, damagePerShot, notes = "") {
  return {
    name,
    type: "ammo",
    img: itemIcon(name),
    system: {
      ammoType,
      location: "leftTorso",
      shots,
      maxShots: shots,
      damagePerShot,
      slotStart: 1,
      slots: 1,
      damagedSlots: [],
      criticalHits: 0,
      destroyed: false,
      notes
    }
  };
}

function equipment(name, criticalEffect, location, slots = 1, notes = "") {
  return {
    name,
    type: "equipment",
    img: itemIcon(name),
    system: {
      location,
      slotStart: 1,
      slots,
      damagedSlots: [],
      criticalEffect,
      criticalHits: 0,
      destroyed: false,
      notes
    }
  };
}

export const CORE_ITEMS = Object.freeze([
  weapon("Small Laser", "laser", 3, 1, range(0, 1, 2, 3), 1),
  weapon("Medium Laser", "laser", 5, 3, range(0, 3, 6, 9), 1),
  weapon("Large Laser", "laser", 8, 8, range(0, 5, 10, 15), 2),
  weapon("Particle Projection Cannon", "ppc", 10, 10, range(3, 6, 12, 18), 3),
  weapon("Machine Gun", "autocannon", 2, 0, range(0, 1, 2, 3), 1),
  weapon("Flamer", "laser", 2, 3, range(0, 1, 2, 3), 1, "May apply heat instead of normal damage when that combat option is implemented."),
  weapon("Autocannon/2", "autocannon", 2, 1, range(4, 8, 16, 24), 1),
  weapon("Autocannon/5", "autocannon", 5, 1, range(3, 6, 12, 18), 4),
  weapon("Autocannon/10", "autocannon", 10, 3, range(0, 5, 10, 15), 7),
  weapon("Autocannon/20", "autocannon", 20, 7, range(0, 3, 6, 9), 10),
  weapon("SRM 2", "missile", 2, 2, range(0, 3, 6, 9), 1, "Damage is per missile; cluster resolution remains a later combat increment."),
  weapon("SRM 4", "missile", 2, 3, range(0, 3, 6, 9), 1, "Damage is per missile; cluster resolution remains a later combat increment."),
  weapon("SRM 6", "missile", 2, 4, range(0, 3, 6, 9), 2, "Damage is per missile; cluster resolution remains a later combat increment."),
  weapon("LRM 5", "missile", 1, 2, range(6, 7, 14, 21), 1, "Damage is per missile; cluster resolution remains a later combat increment."),
  weapon("LRM 10", "missile", 1, 4, range(6, 7, 14, 21), 2, "Damage is per missile; cluster resolution remains a later combat increment."),
  weapon("LRM 15", "missile", 1, 5, range(6, 7, 14, 21), 3, "Damage is per missile; cluster resolution remains a later combat increment."),
  weapon("LRM 20", "missile", 1, 6, range(6, 7, 14, 21), 5, "Damage is per missile; cluster resolution remains a later combat increment."),

  ammo("Machine Gun Ammunition", "Machine Gun", 1000, 2, "Each machine gun attack consumes 200 rounds."),
  ammo("Autocannon/2 Ammunition", "AC/2", 45, 2),
  ammo("Autocannon/5 Ammunition", "AC/5", 20, 5),
  ammo("Autocannon/10 Ammunition", "AC/10", 10, 10),
  ammo("Autocannon/20 Ammunition", "AC/20", 5, 20),
  ammo("SRM 2 Ammunition", "SRM 2", 100, 2, "Tracked as individual missiles; an SRM 2 volley consumes 2."),
  ammo("SRM 4 Ammunition", "SRM 4", 100, 2, "Tracked as individual missiles; an SRM 4 volley consumes 4."),
  ammo("SRM 6 Ammunition", "SRM 6", 90, 2, "Tracked as individual missiles; an SRM 6 volley consumes 6."),
  ammo("LRM 5 Ammunition", "LRM 5", 120, 1, "Tracked as individual missiles; an LRM 5 volley consumes 5."),
  ammo("LRM 10 Ammunition", "LRM 10", 120, 1, "Tracked as individual missiles; an LRM 10 volley consumes 10."),
  ammo("LRM 15 Ammunition", "LRM 15", 120, 1, "Tracked as individual missiles; an LRM 15 volley consumes 15."),
  ammo("LRM 20 Ammunition", "LRM 20", 120, 1, "Tracked as individual missiles; an LRM 20 volley consumes 20."),

  equipment("Fusion Engine", "engine", "centerTorso", 6),
  equipment("Gyro", "gyro", "centerTorso", 4),
  equipment("Sensors", "sensors", "head", 2),
  equipment("Life Support", "lifeSupport", "head", 2),
  equipment("Cockpit", "cockpit", "head", 1),
  equipment("Heat Sink", "heatSink", "centerTorso", 1),
  equipment("Jump Jet", "jumpJet", "leftTorso", 1),
  equipment("Hatchet", "hatchet", "rightArm", 3, "Physical weapon carried by the Hatchetman. Dedicated hatchet-attack automation is planned; use standard physical-attack adjudication until implemented."),
  equipment("Shoulder Actuator", "shoulder", "rightArm", 1),
  equipment("Upper Arm Actuator", "upperArm", "rightArm", 1),
  equipment("Lower Arm Actuator", "lowerArm", "rightArm", 1),
  equipment("Hand Actuator", "hand", "rightArm", 1),
  equipment("Hip Actuator", "hip", "rightLeg", 1),
  equipment("Upper Leg Actuator", "upperLeg", "rightLeg", 1),
  equipment("Lower Leg Actuator", "lowerLeg", "rightLeg", 1),
  equipment("Foot Actuator", "foot", "rightLeg", 1)
]);

export function itemCatalogGroup(item) {
  if (item.type === "equipment") return "equipment";
  if (item.type === "ammo") return /^(SRM|LRM)/i.test(item.system.ammoType) ? "missile" : "ballistic";
  if (item.system.weaponType === "missile") return "missile";
  if (item.system.weaponType === "autocannon") return "ballistic";
  return "energy";
}

export const CORE_ITEMS_BY_GROUP = Object.freeze(Object.fromEntries(
  ["energy", "ballistic", "missile", "equipment"].map(group => [
    group,
    Object.freeze(CORE_ITEMS.filter(item => itemCatalogGroup(item) === group))
  ])
));

function vehicle(name, chassis, tonnage, motiveType, role, cruise, flank, armor, structure, weapons, notes) {
  const presentation = vehiclePresentation(name, tonnage);
  return {
    name,
    type: "vehicle",
    img: presentation.image,
    prototypeToken: {
      name,
      actorLink: true,
      disposition: 0,
      texture: { src: presentation.image, scaleX: 1, scaleY: 1 }
    },
    flags: { [SYSTEM_ID]: { presentation } },
    system: {
      schemaVersion: 1,
      vehicle: { chassis, variant: "Standard", tonnage, motiveType, role },
      crew: { name: "", gunnery: 4, driving: 5, hits: 0 },
      movement: { cruise, flank },
      armor,
      structure,
      status: { immobilized: false, destroyed: false },
      notes
    },
    items: weapons
  };
}

const vehicleWeapon = (name, damage, heat, ranges, location = "turret") => {
  const weaponType = name.includes("Laser") ? "laser" : name.includes("Missile") || name.includes("LRM") || name.includes("SRM") ? "missile" : "autocannon";
  const item = weapon(name, weaponType, damage, heat, ranges, 1);
  return { ...item, system: { ...item.system, location } };
};

export const CORE_VEHICLES = Object.freeze([
  vehicle("Generic Light Scout Car", "Light Scout Car", 20, "wheeled", "Reconnaissance", 8, 12,
    { front: 8, left: 6, right: 6, rear: 4, turret: 6 }, 8,
    [vehicleWeapon("Machine Gun", 2, 0, range(0, 1, 2, 3))],
    "Fast original sample vehicle for scouting and objective play."),
  vehicle("Generic Medium Battle Tank", "Medium Battle Tank", 50, "tracked", "Line Combat", 4, 6,
    { front: 28, left: 20, right: 20, rear: 14, turret: 22 }, 25,
    [vehicleWeapon("Autocannon/10", 10, 3, range(0, 5, 10, 15)), vehicleWeapon("Medium Laser", 5, 3, range(0, 3, 6, 9), "front")],
    "Balanced original tracked combat vehicle."),
  vehicle("Generic Heavy Assault Tank", "Heavy Assault Tank", 80, "tracked", "Assault", 3, 5,
    { front: 45, left: 32, right: 32, rear: 20, turret: 38 }, 40,
    [vehicleWeapon("Autocannon/20", 20, 7, range(0, 3, 6, 9)), vehicleWeapon("Medium Laser", 5, 3, range(0, 3, 6, 9), "front")],
    "Slow original assault vehicle with a heavy direct-fire weapon."),
  vehicle("Generic Missile Support Carrier", "Missile Support Carrier", 60, "tracked", "Fire Support", 3, 5,
    { front: 20, left: 15, right: 15, rear: 10, turret: 18 }, 25,
    [vehicleWeapon("LRM 20 Missile Rack", 1, 6, range(6, 7, 14, 21))],
    "Original long-range support vehicle; cluster resolution remains manual."),
  vehicle("Generic Hover Skirmisher", "Hover Skirmisher", 35, "hover", "Flanker", 7, 11,
    { front: 14, left: 10, right: 10, rear: 8, turret: 12 }, 15,
    [vehicleWeapon("Medium Laser", 5, 3, range(0, 3, 6, 9))],
    "Fast original hover vehicle for flanking maneuvers."),
  vehicle("Generic VTOL Gunship", "VTOL Gunship", 30, "vtol", "Air Support", 8, 12,
    { front: 12, left: 9, right: 9, rear: 7, turret: 10 }, 12,
    [vehicleWeapon("SRM 6 Missile Rack", 2, 4, range(0, 3, 6, 9))],
    "Original VTOL sample; altitude and aerospace movement remain manual.")
]);

const INTERNAL_STRUCTURE = Object.freeze({
  20: [6, 5, 3, 4], 25: [8, 6, 4, 6], 30: [10, 7, 5, 7], 35: [11, 8, 6, 8],
  40: [12, 10, 6, 10], 45: [14, 11, 7, 11], 50: [16, 12, 8, 12], 55: [18, 13, 9, 13],
  60: [20, 14, 10, 14], 65: [21, 15, 10, 15], 70: [22, 15, 11, 15], 75: [23, 16, 12, 16],
  80: [25, 17, 13, 17], 85: [27, 18, 14, 18], 90: [29, 19, 15, 19], 95: [30, 20, 16, 20],
  100: [31, 21, 17, 21]
});

const loadout = (name, location, slotStart, itemName = name) => ({ name, location, slotStart, itemName });

function catalogItem(name, location, slotStart, itemName = name, slots = null) {
  const source = CORE_ITEMS.find(item => item.name === name);
  if (!source) throw new Error(`Unknown core catalog item: ${name}`);
  return {
    ...source,
    name: itemName,
    system: {
      ...source.system,
      location,
      slotStart,
      ...(slots === null ? {} : { slots }),
      damagedSlots: [],
      criticalHits: 0,
      destroyed: false
    }
  };
}

function standardMechComponents() {
  const components = [
    catalogItem("Life Support", "head", 1, "Life Support - Upper", 1),
    catalogItem("Sensors", "head", 2, "Sensors - Upper", 1),
    catalogItem("Cockpit", "head", 3),
    catalogItem("Life Support", "head", 4, "Life Support - Lower", 1),
    catalogItem("Sensors", "head", 5, "Sensors - Lower", 1),
    catalogItem("Fusion Engine", "centerTorso", 1, "Fusion Engine", 6),
    catalogItem("Gyro", "centerTorso", 7, "Gyro", 4)
  ];
  const actuatorSets = [
    ["leftArm", ["Shoulder Actuator", "Upper Arm Actuator", "Lower Arm Actuator", "Hand Actuator"]],
    ["rightArm", ["Shoulder Actuator", "Upper Arm Actuator", "Lower Arm Actuator", "Hand Actuator"]],
    ["leftLeg", ["Hip Actuator", "Upper Leg Actuator", "Lower Leg Actuator", "Foot Actuator"]],
    ["rightLeg", ["Hip Actuator", "Upper Leg Actuator", "Lower Leg Actuator", "Foot Actuator"]]
  ];
  for (const [location, names] of actuatorSets) {
    names.forEach((name, index) => components.push(catalogItem(name, location, index + 1, `${location} ${name}`)));
  }
  return components;
}

function structureForTonnage(tonnage) {
  const values = INTERNAL_STRUCTURE[tonnage];
  if (!values) throw new Error(`No internal-structure profile for ${tonnage} tons.`);
  const [centerTorso, sideTorso, arm, leg] = values;
  const section = value => ({ value, max: value });
  return {
    head: section(3), centerTorso: section(centerTorso),
    leftTorso: section(sideTorso), rightTorso: section(sideTorso),
    leftArm: section(arm), rightArm: section(arm),
    leftLeg: section(leg), rightLeg: section(leg)
  };
}

function armorForStructure(structure, factor) {
  const simple = internal => {
    const value = Math.max(1, Math.floor(internal.max * 2 * factor));
    return { front: value, maxFront: value };
  };
  const torso = (internal, rearRatio) => {
    const total = Math.max(2, Math.floor(internal.max * 2 * factor));
    const rear = Math.max(1, Math.round(total * rearRatio));
    const front = total - rear;
    return { front, maxFront: front, rear, maxRear: rear };
  };
  const head = Math.max(1, Math.floor(9 * factor));
  return {
    head: { front: head, maxFront: head },
    centerTorso: torso(structure.centerTorso, 0.25),
    leftTorso: torso(structure.leftTorso, 0.2),
    rightTorso: torso(structure.rightTorso, 0.2),
    leftArm: simple(structure.leftArm), rightArm: simple(structure.rightArm),
    leftLeg: simple(structure.leftLeg), rightLeg: simple(structure.rightLeg)
  };
}

function externalHeatSinkItems(items, totalSinks) {
  const count = Math.max(0, totalSinks - 10);
  const capacity = {
    leftTorso: 12, rightTorso: 12, leftLeg: 6, rightLeg: 6,
    leftArm: 12, rightArm: 12, centerTorso: 12, head: 6
  };
  const occupied = new Set();
  for (const item of items) {
    for (let slot = item.system.slotStart; slot < item.system.slotStart + item.system.slots; slot += 1) {
      occupied.add(`${item.system.location}:${slot}`);
    }
  }
  const sinks = [];
  for (let index = 1; index <= count; index += 1) {
    let placement = null;
    for (const [location, slots] of Object.entries(capacity)) {
      for (let slot = 1; slot <= slots; slot += 1) {
        if (!occupied.has(`${location}:${slot}`)) {
          placement = { location, slot };
          break;
        }
      }
      if (placement) break;
    }
    if (!placement) throw new Error(`No critical slot remains for external Heat Sink ${index}.`);
    occupied.add(`${placement.location}:${placement.slot}`);
    sinks.push(catalogItem("Heat Sink", placement.location, placement.slot, `External Heat Sink ${index}`));
  }
  return sinks;
}

function originalMech({ name, variant, tonnage, role, walk, run, jump, sinks, armorFactor, equipment }) {
  const structure = structureForTonnage(tonnage);
  const presentation = mechPresentation(name, variant, tonnage);
  const zeroTerrain = {
    roughHexes: 0, lightWoodsHexes: 0, heavyWoodsHexes: 0, rubbleHexes: 0,
    waterDepth1Hexes: 0, waterDepth2Hexes: 0, waterDepth3PlusHexes: 0,
    levelChanges: 0, facingChanges: 0, terrainCost: 0, requiredMp: 0, pilotingChecks: 0
  };
  const pending = Object.fromEntries([
    "head", "centerTorso", "leftTorso", "rightTorso", "leftArm", "rightArm", "leftLeg", "rightLeg"
  ].map(location => [location, 0]));
  const installedItems = [
    ...standardMechComponents(),
    ...equipment.map(entry => catalogItem(entry.name, entry.location, entry.slotStart, entry.itemName))
  ];
  return {
    name: `${name} ${variant}`,
    type: "mech",
    img: presentation.image,
    prototypeToken: {
      name: `${name} ${variant}`,
      actorLink: true,
      disposition: 0,
      sight: { enabled: true, range: 30, angle: 360, visionMode: "basic" },
      detectionModes: [{ id: "basicSight", enabled: true, range: 30 }],
      texture: { src: presentation.image, scaleX: 1, scaleY: 1 }
    },
    flags: { [SYSTEM_ID]: { presentation } },
    system: {
      schemaVersion: 4,
      pilot: { name: "", gunnery: 4, piloting: 5, hits: 0 },
      mech: { chassis: name, variant, tonnage, bv: 0, role },
      movement: {
        walk, run, jump, mode: "stand", hexesMoved: 0, mpSpent: 0,
        attackerModifier: 0, targetModifier: 0, heatGenerated: 0, terrain: zeroTerrain
      },
      heat: { current: 0, sinks, overflow: 0, shutdown: false },
      sensors: { range: 30 },
      criticals: {
        engineHits: 0, gyroHits: 0, sensorHits: 0, lifeSupportHits: 0,
        cockpitDestroyed: false, pending
      },
      armor: armorForStructure(structure, armorFactor),
      structure,
      status: { prone: false, destroyed: false }
    },
    items: [...installedItems, ...externalHeatSinkItems(installedItems, sinks)]
  };
}

export const CORE_MECHS = Object.freeze([
  // Light BattleMechs
  originalMech({ name: "Jenner", variant: "JR7-D", tonnage: 35, role: "Fast Striker", walk: 7, run: 11, jump: 5, sinks: 10, armorFactor: 0.72, equipment: [
    loadout("Medium Laser", "rightArm", 5), loadout("Medium Laser", "rightArm", 6, "Medium Laser 2"),
    loadout("Medium Laser", "leftArm", 5, "Medium Laser 3"), loadout("Medium Laser", "leftArm", 6, "Medium Laser 4"),
    loadout("SRM 4", "centerTorso", 11), loadout("SRM 4 Ammunition", "rightTorso", 1),
    loadout("Jump Jet", "leftTorso", 1, "Jump Jet 1"), loadout("Jump Jet", "rightTorso", 2, "Jump Jet 2"),
    loadout("Jump Jet", "centerTorso", 12, "Jump Jet 3"),
    loadout("Jump Jet", "leftLeg", 5, "Jump Jet 4"), loadout("Jump Jet", "rightLeg", 5, "Jump Jet 5")
  ]}),
  originalMech({ name: "Firestarter", variant: "FS9-H", tonnage: 35, role: "Anti-Infantry Skirmisher", walk: 6, run: 9, jump: 6, sinks: 10, armorFactor: 0.8, equipment: [
    loadout("Medium Laser", "rightArm", 5), loadout("Medium Laser", "leftArm", 5, "Medium Laser 2"),
    loadout("Machine Gun", "rightArm", 6), loadout("Machine Gun", "leftArm", 6, "Machine Gun 2"),
    loadout("Machine Gun Ammunition", "leftTorso", 2),
    loadout("Flamer", "rightArm", 7), loadout("Flamer", "leftArm", 7, "Flamer 2"),
    loadout("Flamer", "leftTorso", 1, "Flamer 3"), loadout("Flamer", "rightTorso", 1, "Flamer 4"),
    loadout("Jump Jet", "leftTorso", 3, "Jump Jet 1"), loadout("Jump Jet", "leftTorso", 4, "Jump Jet 2"),
    loadout("Jump Jet", "rightTorso", 2, "Jump Jet 3"), loadout("Jump Jet", "rightTorso", 3, "Jump Jet 4"),
    loadout("Jump Jet", "leftLeg", 5, "Jump Jet 5"), loadout("Jump Jet", "rightLeg", 5, "Jump Jet 6")
  ]}),
  originalMech({ name: "Javelin", variant: "JVN-10N", tonnage: 30, role: "Ambusher", walk: 6, run: 9, jump: 6, sinks: 10, armorFactor: 0.76, equipment: [
    loadout("SRM 6", "leftTorso", 1), loadout("SRM 6 Ammunition", "leftTorso", 3),
    loadout("SRM 6", "rightTorso", 1, "SRM 6 - Right"), loadout("SRM 6 Ammunition", "rightTorso", 3, "SRM 6 Ammunition - Right"),
    loadout("Jump Jet", "leftTorso", 4, "Jump Jet 1"), loadout("Jump Jet", "leftTorso", 5, "Jump Jet 2"),
    loadout("Jump Jet", "rightTorso", 4, "Jump Jet 3"), loadout("Jump Jet", "rightTorso", 5, "Jump Jet 4"),
    loadout("Jump Jet", "leftLeg", 5, "Jump Jet 5"), loadout("Jump Jet", "rightLeg", 5, "Jump Jet 6")
  ]}),
  originalMech({ name: "Commando", variant: "COM-2D", tonnage: 25, role: "Missile Striker", walk: 6, run: 9, jump: 0, sinks: 10, armorFactor: 0.74, equipment: [
    loadout("Medium Laser", "leftArm", 5),
    loadout("SRM 6", "rightTorso", 1), loadout("SRM 6 Ammunition", "rightTorso", 3),
    loadout("SRM 4", "leftArm", 6), loadout("SRM 4 Ammunition", "leftTorso", 1)
  ]}),
  originalMech({ name: "UrbanMech", variant: "UM-R60", tonnage: 30, role: "Urban Defender", walk: 2, run: 3, jump: 2, sinks: 11, armorFactor: 0.8, equipment: [
    loadout("Autocannon/10", "rightArm", 5), loadout("Autocannon/10 Ammunition", "rightTorso", 1),
    loadout("Small Laser", "leftArm", 5),
    loadout("Jump Jet", "leftLeg", 5, "Jump Jet 1"), loadout("Jump Jet", "rightLeg", 5, "Jump Jet 2")
  ]}),

  // Medium BattleMechs
  originalMech({ name: "Assassin", variant: "ASN-21", tonnage: 40, role: "Recon Hunter", walk: 7, run: 11, jump: 7, sinks: 10, armorFactor: 0.7, equipment: [
    loadout("Medium Laser", "rightArm", 5),
    loadout("LRM 5", "leftTorso", 1), loadout("LRM 5 Ammunition", "leftTorso", 2),
    loadout("SRM 2", "rightTorso", 1), loadout("SRM 2 Ammunition", "rightTorso", 2),
    loadout("Jump Jet", "leftTorso", 3, "Jump Jet 1"), loadout("Jump Jet", "leftTorso", 4, "Jump Jet 2"),
    loadout("Jump Jet", "rightTorso", 3, "Jump Jet 3"), loadout("Jump Jet", "rightTorso", 4, "Jump Jet 4"),
    loadout("Jump Jet", "centerTorso", 11, "Jump Jet 5"),
    loadout("Jump Jet", "leftLeg", 5, "Jump Jet 6"), loadout("Jump Jet", "rightLeg", 5, "Jump Jet 7")
  ]}),
  originalMech({ name: "Blackjack", variant: "BJ-1", tonnage: 45, role: "Fire Support", walk: 4, run: 6, jump: 4, sinks: 11, armorFactor: 0.8, equipment: [
    loadout("Autocannon/2", "rightArm", 5), loadout("Autocannon/2", "leftArm", 5, "Autocannon/2 - Left"),
    loadout("Autocannon/2 Ammunition", "rightTorso", 1), loadout("Autocannon/2 Ammunition", "leftTorso", 1, "Autocannon/2 Ammunition - Left"),
    loadout("Medium Laser", "rightTorso", 2), loadout("Medium Laser", "rightTorso", 3, "Medium Laser 2"),
    loadout("Medium Laser", "leftTorso", 2, "Medium Laser 3"), loadout("Medium Laser", "leftTorso", 3, "Medium Laser 4"),
    loadout("Jump Jet", "leftTorso", 4, "Jump Jet 1"), loadout("Jump Jet", "rightTorso", 4, "Jump Jet 2"),
    loadout("Jump Jet", "leftLeg", 5, "Jump Jet 3"), loadout("Jump Jet", "rightLeg", 5, "Jump Jet 4")
  ]}),
  originalMech({ name: "Hatchetman", variant: "HCT-3F", tonnage: 45, role: "Close-Quarters Fighter", walk: 4, run: 6, jump: 4, sinks: 11, armorFactor: 0.84, equipment: [
    loadout("Autocannon/10", "rightTorso", 1), loadout("Autocannon/10 Ammunition", "rightTorso", 8),
    loadout("Medium Laser", "leftTorso", 1), loadout("Medium Laser", "rightTorso", 9, "Medium Laser 2"),
    loadout("Hatchet", "rightArm", 5),
    loadout("Jump Jet", "leftTorso", 2, "Jump Jet 1"), loadout("Jump Jet", "rightTorso", 10, "Jump Jet 2"),
    loadout("Jump Jet", "leftLeg", 5, "Jump Jet 3"), loadout("Jump Jet", "rightLeg", 5, "Jump Jet 4")
  ]}),
  originalMech({ name: "Phoenix Hawk", variant: "PXH-1", tonnage: 45, role: "Mobile Skirmisher", walk: 6, run: 9, jump: 6, sinks: 10, armorFactor: 0.78, equipment: [
    loadout("Large Laser", "rightArm", 5), loadout("Medium Laser", "rightArm", 7),
    loadout("Medium Laser", "leftArm", 5, "Medium Laser 2"),
    loadout("Machine Gun", "leftArm", 6), loadout("Machine Gun", "leftArm", 7, "Machine Gun 2"),
    loadout("Machine Gun Ammunition", "leftTorso", 1),
    loadout("Jump Jet", "leftTorso", 2, "Jump Jet 1"), loadout("Jump Jet", "leftTorso", 3, "Jump Jet 2"),
    loadout("Jump Jet", "rightTorso", 1, "Jump Jet 3"), loadout("Jump Jet", "rightTorso", 2, "Jump Jet 4"),
    loadout("Jump Jet", "leftLeg", 5, "Jump Jet 5"), loadout("Jump Jet", "rightLeg", 5, "Jump Jet 6")
  ]}),
  originalMech({ name: "Hunchback", variant: "HBK-4G", tonnage: 50, role: "Urban Brawler", walk: 4, run: 6, jump: 0, sinks: 13, armorFactor: 0.9, equipment: [
    loadout("Autocannon/20", "rightTorso", 1),
    loadout("Autocannon/20 Ammunition", "leftTorso", 1), loadout("Autocannon/20 Ammunition", "leftTorso", 2, "Autocannon/20 Ammunition 2"),
    loadout("Medium Laser", "rightArm", 5), loadout("Medium Laser", "leftArm", 5, "Medium Laser 2"),
    loadout("Small Laser", "head", 6)
  ]}),

  // Heavy BattleMechs
  originalMech({ name: "Catapult", variant: "CPLT-C1", tonnage: 65, role: "Missile Fire Support", walk: 4, run: 6, jump: 4, sinks: 15, armorFactor: 0.86, equipment: [
    loadout("LRM 15", "rightArm", 5), loadout("LRM 15", "leftArm", 5, "LRM 15 - Left"),
    loadout("LRM 15 Ammunition", "rightTorso", 1), loadout("LRM 15 Ammunition", "rightTorso", 2, "LRM 15 Ammunition 2"),
    loadout("LRM 15 Ammunition", "leftTorso", 1, "LRM 15 Ammunition - Left"), loadout("LRM 15 Ammunition", "leftTorso", 2, "LRM 15 Ammunition - Left 2"),
    loadout("Medium Laser", "rightTorso", 3), loadout("Medium Laser", "rightTorso", 4, "Medium Laser 2"),
    loadout("Medium Laser", "leftTorso", 3, "Medium Laser 3"), loadout("Medium Laser", "leftTorso", 4, "Medium Laser 4"),
    loadout("Jump Jet", "leftTorso", 5, "Jump Jet 1"), loadout("Jump Jet", "leftTorso", 6, "Jump Jet 2"),
    loadout("Jump Jet", "rightTorso", 5, "Jump Jet 3"), loadout("Jump Jet", "rightTorso", 6, "Jump Jet 4")
  ]}),
  originalMech({ name: "JagerMech", variant: "JM6-S", tonnage: 65, role: "Long-Range Fire Support", walk: 4, run: 6, jump: 0, sinks: 10, armorFactor: 0.68, equipment: [
    loadout("Autocannon/5", "rightArm", 5), loadout("Autocannon/5", "leftArm", 5, "Autocannon/5 - Left"),
    loadout("Autocannon/2", "rightTorso", 1), loadout("Autocannon/2", "leftTorso", 1, "Autocannon/2 - Left"),
    loadout("Autocannon/5 Ammunition", "rightTorso", 2), loadout("Autocannon/5 Ammunition", "leftTorso", 2, "Autocannon/5 Ammunition - Left"),
    loadout("Autocannon/2 Ammunition", "rightTorso", 3), loadout("Autocannon/2 Ammunition", "leftTorso", 3, "Autocannon/2 Ammunition - Left"),
    loadout("Medium Laser", "rightTorso", 4), loadout("Medium Laser", "leftTorso", 4, "Medium Laser 2")
  ]}),
  originalMech({ name: "Archer", variant: "ARC-2R", tonnage: 70, role: "Heavy Fire Support", walk: 4, run: 6, jump: 0, sinks: 10, armorFactor: 0.88, equipment: [
    loadout("LRM 20", "rightTorso", 1), loadout("LRM 20", "leftTorso", 1, "LRM 20 - Left"),
    loadout("LRM 20 Ammunition", "rightTorso", 6), loadout("LRM 20 Ammunition", "rightTorso", 7, "LRM 20 Ammunition 2"),
    loadout("LRM 20 Ammunition", "leftTorso", 6, "LRM 20 Ammunition - Left"), loadout("LRM 20 Ammunition", "leftTorso", 7, "LRM 20 Ammunition - Left 2"),
    loadout("Medium Laser", "rightArm", 5), loadout("Medium Laser", "rightArm", 6, "Medium Laser 2"),
    loadout("Medium Laser", "leftArm", 5, "Medium Laser 3"), loadout("Medium Laser", "leftArm", 6, "Medium Laser 4")
  ]}),
  originalMech({ name: "Thunderbolt", variant: "TDR-5S", tonnage: 65, role: "Heavy Line Fighter", walk: 4, run: 6, jump: 0, sinks: 15, armorFactor: 0.9, equipment: [
    loadout("Large Laser", "rightArm", 5),
    loadout("LRM 15", "leftTorso", 1), loadout("LRM 15 Ammunition", "leftTorso", 4),
    loadout("SRM 2", "leftTorso", 5), loadout("SRM 2 Ammunition", "leftTorso", 6),
    loadout("Medium Laser", "rightTorso", 1), loadout("Medium Laser", "rightTorso", 2, "Medium Laser 2"),
    loadout("Medium Laser", "rightTorso", 3, "Medium Laser 3"),
    loadout("Machine Gun", "leftArm", 5), loadout("Machine Gun", "leftArm", 6, "Machine Gun 2"),
    loadout("Machine Gun Ammunition", "rightTorso", 4)
  ]}),
  originalMech({ name: "Marauder", variant: "MAD-3R", tonnage: 75, role: "Heavy Command Fighter", walk: 4, run: 6, jump: 0, sinks: 16, armorFactor: 0.84, equipment: [
    loadout("Particle Projection Cannon", "rightArm", 5), loadout("Particle Projection Cannon", "leftArm", 5, "Particle Projection Cannon - Left"),
    loadout("Autocannon/5", "rightTorso", 1), loadout("Autocannon/5 Ammunition", "rightTorso", 5),
    loadout("Medium Laser", "rightArm", 8), loadout("Medium Laser", "leftArm", 8, "Medium Laser - Left")
  ]}),

  // Assault BattleMechs
  originalMech({ name: "Atlas", variant: "AS7-D", tonnage: 100, role: "Assault Command", walk: 3, run: 5, jump: 0, sinks: 20, armorFactor: 0.98, equipment: [
    loadout("Autocannon/20", "rightTorso", 1),
    loadout("Autocannon/20 Ammunition", "leftTorso", 1), loadout("Autocannon/20 Ammunition", "leftTorso", 2, "Autocannon/20 Ammunition 2"),
    loadout("LRM 20", "leftTorso", 3), loadout("LRM 20 Ammunition", "leftTorso", 8), loadout("LRM 20 Ammunition", "leftTorso", 9, "LRM 20 Ammunition 2"),
    loadout("SRM 6", "leftTorso", 10), loadout("SRM 6 Ammunition", "leftTorso", 12),
    loadout("Medium Laser", "rightArm", 5), loadout("Medium Laser", "rightArm", 6, "Medium Laser 2"),
    loadout("Medium Laser", "leftArm", 5, "Medium Laser 3"), loadout("Medium Laser", "leftArm", 6, "Medium Laser 4")
  ]}),
  originalMech({ name: "Banshee", variant: "BNC-3E", tonnage: 95, role: "Assault Brawler", walk: 4, run: 6, jump: 0, sinks: 16, armorFactor: 0.9, equipment: [
    loadout("Particle Projection Cannon", "rightArm", 5),
    loadout("Autocannon/5", "leftArm", 5), loadout("Autocannon/5 Ammunition", "leftTorso", 1),
    loadout("Small Laser", "head", 6)
  ]}),
  originalMech({ name: "Stalker", variant: "STK-3F", tonnage: 85, role: "Assault Fire Support", walk: 3, run: 5, jump: 0, sinks: 20, armorFactor: 0.94, equipment: [
    loadout("LRM 10", "leftTorso", 1), loadout("LRM 10 Ammunition", "leftTorso", 3),
    loadout("LRM 10", "rightTorso", 1, "LRM 10 - Right"), loadout("LRM 10 Ammunition", "rightTorso", 3, "LRM 10 Ammunition - Right"),
    loadout("SRM 6", "leftTorso", 4), loadout("SRM 6 Ammunition", "leftTorso", 6),
    loadout("SRM 6", "rightTorso", 4, "SRM 6 - Right"), loadout("SRM 6 Ammunition", "rightTorso", 6, "SRM 6 Ammunition - Right"),
    loadout("Large Laser", "rightArm", 5), loadout("Large Laser", "leftArm", 5, "Large Laser - Left"),
    loadout("Medium Laser", "rightArm", 7), loadout("Medium Laser", "rightArm", 8, "Medium Laser 2"),
    loadout("Medium Laser", "leftArm", 7, "Medium Laser 3"), loadout("Medium Laser", "leftArm", 8, "Medium Laser 4")
  ]}),
  originalMech({ name: "Awesome", variant: "AWS-8Q", tonnage: 80, role: "Energy Assault", walk: 3, run: 5, jump: 0, sinks: 28, armorFactor: 0.96, equipment: [
    loadout("Particle Projection Cannon", "rightArm", 5),
    loadout("Particle Projection Cannon", "leftArm", 5, "Particle Projection Cannon - Left"),
    loadout("Particle Projection Cannon", "rightTorso", 1, "Particle Projection Cannon - Torso"),
    loadout("Small Laser", "head", 6)
  ]}),
  originalMech({ name: "Zeus", variant: "ZEU-6S", tonnage: 80, role: "Mobile Assault", walk: 4, run: 6, jump: 0, sinks: 17, armorFactor: 0.88, equipment: [
    loadout("Large Laser", "rightArm", 5),
    loadout("Autocannon/5", "leftArm", 5), loadout("Autocannon/5 Ammunition", "leftTorso", 1),
    loadout("LRM 15", "rightTorso", 1), loadout("LRM 15 Ammunition", "rightTorso", 4),
    loadout("Medium Laser", "leftTorso", 2), loadout("Medium Laser", "leftTorso", 3, "Medium Laser 2")
  ]})
]);

export const CORE_MECHS_BY_CLASS = Object.freeze(Object.fromEntries(
  ["light", "medium", "heavy", "assault"].map(weightClass => [
    weightClass,
    Object.freeze(CORE_MECHS.filter(actor => actor.flags[SYSTEM_ID].presentation.weightClass === weightClass))
  ])
));
