export const RESOLVE_PER_ROUND = 15;
export const RESOLVE_COST = 30;
export const INSPIRED_THRESHOLD = 50;

export const PILOT_ABILITIES = Object.freeze({
  multiTarget: Object.freeze({ label: "Multi-Target", kind: "action", icon: "crosshairs", description: "Assign weapons to as many as three targets in the current firing arc." }),
  breachingShot: Object.freeze({ label: "Breaching Shot", kind: "passive", icon: "shield-halved", description: "A single-weapon attack ignores Cover and Guarded." }),
  evasiveMove: Object.freeze({ label: "Evasive Move", kind: "passive", icon: "person-running", description: "Movement generates one additional Evasive charge, to a maximum of six." }),
  angelOfDeath: Object.freeze({ label: "Angel of Death", kind: "passive", icon: "jet-fighter-up", description: "Jump distance +25%; half self-damage from Death From Above; cannot become Unsteady from DFA." }),
  sensorLock: Object.freeze({ label: "Sensor Lock", kind: "action", icon: "satellite-dish", description: "Reveal one target in sensor range through the end of the round and remove two Evasive charges." }),
  masterTactician: Object.freeze({ label: "Master Tactician", kind: "passive", icon: "chess-knight", description: "+1 Initiative; reserving removes one stability bar." }),
  bulwark: Object.freeze({ label: "Bulwark", kind: "passive", icon: "shield", description: "Gain Guarded while stationary; rotation does not count as movement." })
});

export const RESOLVE_ABILITIES = Object.freeze({
  precisionStrike: Object.freeze({ label: "Precision Strike", hotkey: "8", icon: "bullseye", description: "Called Shot at -4 Difficulty; target suffers -1 next Initiative.", cost: RESOLVE_COST }),
  vigilance: Object.freeze({ label: "Vigilance", hotkey: "9", icon: "diamond", description: "Gain Guarded and Entrenched, clear stability damage, and gain +1 next Initiative.", cost: RESOLVE_COST })
});

export function resolveAfterRound(current, gain = RESOLVE_PER_ROUND) {
  return Math.max(0, Math.min(100, (Number(current) || 0) + (Number(gain) || 0)));
}

export function spendResolve(current, cost = RESOLVE_COST) {
  const pool = Math.max(0, Number(current) || 0);
  if (pool < cost) throw new RangeError(`${cost} Resolve is required; ${pool} is available.`);
  return pool - cost;
}

export function resolveCombatModifier(current) {
  return Number(current) >= INSPIRED_THRESHOLD ? -1 : 0;
}

export function specialAttackModifier({ precisionStrike = false, resolve = 0 } = {}) {
  return (precisionStrike ? -4 : 0) + resolveCombatModifier(resolve);
}
