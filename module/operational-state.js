function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mechDestructionReason(system = {}) {
  if (system.status?.destroyed) return "destroyed";
  if (number(system.criticals?.engineHits) >= 3) return "engine destroyed";
  if (system.criticals?.cockpitDestroyed) return "cockpit destroyed";
  if (number(system.pilot?.hits) >= 6) return "pilot killed";
  return null;
}

export function mechOperationalState(system = {}) {
  const destructionReason = mechDestructionReason(system);
  return {
    destroyed: Boolean(destructionReason),
    destructionReason,
    unconscious: Boolean(system.pilot?.unconscious),
    shutdown: Boolean(system.heat?.shutdown),
    heat: Math.max(0, number(system.heat?.current)),
    sensorHits: Math.max(0, number(system.criticals?.sensorHits))
  };
}

export function mechActionBlockReason(system = {}, action = "act") {
  const state = mechOperationalState(system);
  if (state.destroyed) return `is ${state.destructionReason} and cannot ${action}`;
  if (state.unconscious) return `has an unconscious pilot and cannot ${action}`;
  if (state.shutdown) return `is shut down and cannot ${action}`;
  if (action === "operate sensors" && state.sensorHits >= 2) return "has destroyed sensors and cannot operate sensors";
  return null;
}

export function reactorControlState(system = {}) {
  const state = mechOperationalState(system);
  if (state.destroyed) return { ...state, canShutdown: false, canRestart: false, reason: state.destructionReason };
  if (state.unconscious) return { ...state, canShutdown: false, canRestart: false, reason: "pilot unconscious" };
  if (state.shutdown && state.heat >= 30) return { ...state, canShutdown: false, canRestart: false, reason: "heat 30+" };
  return {
    ...state,
    canShutdown: !state.shutdown,
    canRestart: state.shutdown,
    reason: null
  };
}

export function operationalStateUpdates(system = {}) {
  const state = mechOperationalState(system);
  if (!state.destroyed) return {};
  return {
    "system.status.destroyed": true,
    "system.heat.shutdown": true
  };
}
