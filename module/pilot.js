const TARGETS = Object.freeze([null, 3, 5, 7, 10, 11, null]);

export function consciousnessTarget(hits) {
  const value = Math.max(0, Math.min(6, Number(hits) || 0));
  return TARGETS[value];
}

export function pilotConsciousnessState({ hits = 0, unconscious = false, roll = null } = {}) {
  const wounds = Math.max(0, Math.min(6, Number(hits) || 0));
  if (wounds >= 6) return { hits: 6, unconscious: true, dead: true, target: null, roll: null, recovered: false };
  if (wounds === 0) return { hits: 0, unconscious: false, dead: false, target: null, roll: null, recovered: false };
  const target = consciousnessTarget(wounds);
  if (roll === null) return { hits: wounds, unconscious: Boolean(unconscious), dead: false, target, roll: null, recovered: false };
  const total = Number(roll);
  const awake = total >= target;
  return { hits: wounds, unconscious: !awake, dead: false, target, roll: total, recovered: Boolean(unconscious && awake) };
}
