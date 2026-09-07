const SYSTEM_ID = "battletech-foundry-system";
const TOKENIZER_ID = "vtta-tokenizer";

export const TOKENIZER_TARGETING_FRAMES = Object.freeze([
  {
    key: `systems/${SYSTEM_ID}/assets/tokenizer/bmfs-fire-arcs.svg`,
    label: "BattleMech Fire Arcs",
    selected: false
  },
  {
    key: `systems/${SYSTEM_ID}/assets/tokenizer/bmfs-hit-zones.svg`,
    label: "BattleMech Hit Zones",
    selected: false
  },
  {
    key: `systems/${SYSTEM_ID}/assets/tokenizer/bmfs-aerospace-fire-arcs.svg`,
    label: "BattleMech Aerospace Fire Arcs",
    selected: false
  }
]);

export function normalizeDegrees(value) {
  return ((Number(value) % 360) + 360) % 360;
}

export function relativeBearing(origin, target, facing = 0) {
  const dx = Number(target?.x ?? 0) - Number(origin?.x ?? 0);
  const dy = Number(target?.y ?? 0) - Number(origin?.y ?? 0);
  if (!dx && !dy) return 0;
  const absolute = normalizeDegrees((Math.atan2(dx, -dy) * 180) / Math.PI);
  return normalizeDegrees(absolute - Number(facing || 0));
}

export function firingArcForBearing(bearing) {
  const value = normalizeDegrees(bearing);
  if (value <= 60 || value >= 300) return "front";
  if (value < 120) return "rightArm";
  if (value <= 240) return "rear";
  return "leftArm";
}

export function hitZoneForBearing(bearing) {
  const value = normalizeDegrees(bearing);
  if (value <= 60 || value >= 300) return "front";
  if (value < 150) return "rightSide";
  if (value <= 210) return "rear";
  return "leftSide";
}

export function aerospaceFiringArcForBearing(bearing) {
  const value = normalizeDegrees(bearing);
  if (value <= 30 || value >= 330) return "nose";
  if (value < 90) return "noseRightWing";
  if (value < 150) return "rightWing";
  if (value < 180) return "aftRightWing";
  if (value <= 210) return "aftLeftWing";
  if (value <= 270) return "leftWing";
  return "noseLeftWing";
}

export function targetingArc(origin, target, facing = 0) {
  const bearing = relativeBearing(origin, target, facing);
  return {
    bearing,
    firingArc: firingArcForBearing(bearing),
    hitZone: hitZoneForBearing(bearing)
  };
}

export function aerospaceTargetingArc(origin, target, facing = 0) {
  const bearing = relativeBearing(origin, target, facing);
  return { bearing, firingArc: aerospaceFiringArcForBearing(bearing) };
}

export async function registerTokenizerTargetingFrames({
  modules = globalThis.game?.modules,
  settings = globalThis.game?.settings
} = {}) {
  if (!modules?.get?.(TOKENIZER_ID)?.active || !settings?.get || !settings?.set) return false;
  let frames;
  try {
    frames = settings.get(TOKENIZER_ID, "custom-frames");
  } catch {
    return false;
  }
  const current = Array.isArray(frames) ? frames : [];
  const additions = TOKENIZER_TARGETING_FRAMES.filter(frame => !current.some(existing => existing?.key === frame.key));
  if (!additions.length) return true;
  await settings.set(TOKENIZER_ID, "custom-frames", [...current, ...additions]);
  return true;
}
