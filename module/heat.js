function integer(value, label, { min = 0, max = Infinity } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RangeError(`${label} must be an integer from ${min} to ${max}.`);
  }
  return number;
}

export function heatWeaponModifier(heat) {
  const value = integer(heat, "Heat");
  if (value >= 24) return 4;
  if (value >= 17) return 3;
  if (value >= 13) return 2;
  if (value >= 8) return 1;
  return 0;
}

export function heatMovementPenalty(heat) {
  const value = integer(heat, "Heat");
  if (value >= 25) return 5;
  if (value >= 20) return 4;
  if (value >= 15) return 3;
  if (value >= 10) return 2;
  if (value >= 5) return 1;
  return 0;
}

export function shutdownAvoidTarget(heat) {
  const value = integer(heat, "Heat");
  if (value >= 30) return null;
  if (value >= 26) return 10;
  if (value >= 22) return 8;
  if (value >= 18) return 6;
  if (value >= 14) return 4;
  return 0;
}

export function ammoExplosionAvoidTarget(heat) {
  const value = integer(heat, "Heat");
  if (value >= 28) return 8;
  if (value >= 23) return 6;
  if (value >= 19) return 4;
  return 0;
}

export function engineHeat(engineHits) {
  const hits = integer(engineHits, "Engine hits", { max: 3 });
  if (hits >= 2) return 10;
  if (hits === 1) return 5;
  return 0;
}

export function heatEffectProfile(heat) {
  const value = integer(heat, "Heat");
  return {
    heat: value,
    movementPenalty: heatMovementPenalty(value),
    weaponModifier: heatWeaponModifier(value),
    shutdownTarget: shutdownAvoidTarget(value),
    ammoTarget: ammoExplosionAvoidTarget(value)
  };
}

export function calculateHeatPhase({
  current,
  sinks,
  engineHits = 0,
  shutdown = false,
  shutdownRoll = null,
  ammoRoll = null,
  hasAmmo = false
}) {
  const startingHeat = integer(current, "Current heat");
  const availableSinks = integer(sinks, "Heat sinks");
  const engineHeatGenerated = shutdown ? 0 : engineHeat(engineHits);
  const heatBeforeDissipation = startingHeat + engineHeatGenerated;
  const dissipated = Math.min(heatBeforeDissipation, availableSinks);
  const nextHeat = heatBeforeDissipation - dissipated;
  const effects = heatEffectProfile(nextHeat);

  let nextShutdown = Boolean(shutdown);
  let shutdownCheck = null;
  if (effects.shutdownTarget === null) {
    nextShutdown = true;
    shutdownCheck = { automatic: true, target: null, roll: null, success: false };
  } else if (effects.shutdownTarget === 0) {
    nextShutdown = false;
  } else {
    const roll = integer(shutdownRoll, "Shutdown roll", { min: 2, max: 12 });
    const success = roll >= effects.shutdownTarget;
    nextShutdown = shutdown ? !success : !success;
    shutdownCheck = {
      automatic: false,
      target: effects.shutdownTarget,
      roll,
      success
    };
  }

  let ammoCheck = null;
  if (hasAmmo && effects.ammoTarget > 0) {
    const roll = integer(ammoRoll, "Ammunition explosion roll", { min: 2, max: 12 });
    ammoCheck = {
      target: effects.ammoTarget,
      roll,
      success: roll >= effects.ammoTarget,
      exploded: roll < effects.ammoTarget
    };
  }

  return {
    startingHeat,
    engineHeat: engineHeatGenerated,
    heatBeforeDissipation,
    dissipated,
    current: nextHeat,
    overflow: Math.max(0, nextHeat - 30),
    shutdown: nextShutdown,
    shutdownCheck,
    ammoCheck,
    effects
  };
}

export function ammunitionExplosionDamage(shots, damagePerShot) {
  return integer(shots, "Shots remaining")
    * integer(damagePerShot, "Ammunition damage per shot");
}
