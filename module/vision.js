export const DEFAULT_SENSOR_RANGE = 30;

export function mechSensorRange(actor) {
  if (actor?.type !== "mech") return null;
  const base = Math.max(0, Number(actor.system?.sensors?.range) || DEFAULT_SENSOR_RANGE);
  const hits = Math.max(0, Number(actor.system?.criticals?.sensorHits) || 0);
  if (hits >= 2) return 0;
  if (hits === 1) return Math.floor(base / 2);
  return base;
}

export function tokenVisionUpdate(actor) {
  const range = mechSensorRange(actor);
  if (range === null) return null;
  return {
    "sight.enabled": range > 0,
    "sight.range": range,
    "sight.angle": 360,
    "sight.visionMode": "basic",
    "detectionModes": [{ id: "basicSight", enabled: true, range }]
  };
}

export async function synchronizeActorTokenVision(actor) {
  const update = tokenVisionUpdate(actor);
  if (!update) return [];
  const tokens = actor?.getActiveTokens?.(true, true) ?? [];
  await Promise.all(tokens.map(token => (token.document ?? token).update(update)));
  return tokens;
}
