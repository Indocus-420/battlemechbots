const LOCATION_LAYOUT = Object.freeze([
  ["head", "Head", "head"],
  ["leftArm", "Left Arm", "left-arm"],
  ["leftTorso", "Left Torso", "left-torso"],
  ["centerTorso", "Center Torso", "center-torso"],
  ["rightTorso", "Right Torso", "right-torso"],
  ["rightArm", "Right Arm", "right-arm"],
  ["leftLeg", "Left Leg", "left-leg"],
  ["rightLeg", "Right Leg", "right-leg"]
]);

function condition(values) {
  const ratios = values.filter(({ maximum }) => maximum > 0).map(({ current, maximum }) => current / maximum);
  if (!ratios.length || ratios.some(ratio => ratio <= 0)) return "destroyed";
  const ratio = Math.min(...ratios);
  if (ratio <= 0.25) return "critical";
  if (ratio <= 0.5) return "damaged";
  return "healthy";
}

export function armorDiagramModel(system) {
  return LOCATION_LAYOUT.map(([key, label, position]) => {
    const armor = system?.armor?.[key] ?? {};
    const structure = system?.structure?.[key] ?? {};
    const front = Number(armor.front) || 0;
    const maxFront = Number(armor.maxFront) || 0;
    const rear = Number(armor.rear) || 0;
    const maxRear = Number(armor.maxRear) || 0;
    const internal = Number(structure.value) || 0;
    const maxInternal = Number(structure.max) || 0;
    return {
      key,
      label,
      position,
      front,
      maxFront,
      rear,
      maxRear,
      hasRear: maxRear > 0,
      internal,
      maxInternal,
      condition: condition([
        { current: front, maximum: maxFront },
        { current: rear, maximum: maxRear },
        { current: internal, maximum: maxInternal }
      ])
    };
  });
}
