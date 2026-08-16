function integer(value, label, { min = 0, max = Infinity } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RangeError(`${label} must be an integer from ${min} to ${max}.`);
  }
  return number;
}

export function pilotingCheckProfile({
  piloting,
  gyroHits = 0,
  shutdown = false,
  leftLegDestroyed = false,
  rightLegDestroyed = false,
  destroyedActuators = [],
  situationalModifier = 0
}) {
  const base = integer(piloting, "Piloting skill");
  const gyro = integer(gyroHits, "Gyro hits", { max: 2 });
  const situation = integer(situationalModifier, "Situational modifier", { min: -10, max: 20 });
  const actuatorModifier = destroyedActuators.reduce((sum, effect) => {
    if (effect === "hip") return sum + 2;
    if (["upperLeg", "lowerLeg", "foot"].includes(effect)) return sum + 1;
    return sum;
  }, 0);
  const gyroModifier = gyro * 3;
  const legModifier = (leftLegDestroyed ? 5 : 0) + (rightLegDestroyed ? 5 : 0);
  const shutdownModifier = shutdown ? 3 : 0;
  const automaticFall = Boolean(shutdown || leftLegDestroyed || rightLegDestroyed || gyro >= 2);
  return {
    base,
    gyroModifier,
    legModifier,
    shutdownModifier,
    actuatorModifier,
    situationalModifier: situation,
    targetNumber: base + gyroModifier + legModifier + shutdownModifier + actuatorModifier + situation,
    automaticFall
  };
}

export function fallDamage(tonnage, levels = 0, { water = false } = {}) {
  const weight = integer(tonnage, "BattleMech tonnage", { min: 1 });
  const distance = integer(levels, "Fall levels");
  const standard = Math.ceil(weight / 10) * (distance + 1);
  const total = water ? Math.floor(standard / 2) : standard;
  const groups = [
    ...Array.from({ length: Math.floor(total / 5) }, () => 5),
    ...(total % 5 ? [total % 5] : [])
  ];
  return { levels: distance, total, groups };
}

export function facingAfterFall(roll) {
  const total = integer(roll, "Facing-after-fall roll", { min: 1, max: 6 });
  return {
    roll: total,
    rotationDelta: [0, 0, 60, 120, 180, -120, -60][total],
    direction: [null, "front", "right", "right", "rear", "left", "left"][total]
  };
}
