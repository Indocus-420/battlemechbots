const CLUSTER_HITS = Object.freeze({
  2: Object.freeze({ 2: 1, 4: 1, 5: 1, 6: 2, 10: 3, 15: 5, 20: 6 }),
  3: Object.freeze({ 2: 1, 4: 2, 5: 2, 6: 2, 10: 3, 15: 5, 20: 6 }),
  4: Object.freeze({ 2: 1, 4: 2, 5: 2, 6: 3, 10: 4, 15: 6, 20: 9 }),
  5: Object.freeze({ 2: 1, 4: 2, 5: 3, 6: 3, 10: 6, 15: 9, 20: 12 }),
  6: Object.freeze({ 2: 1, 4: 2, 5: 3, 6: 4, 10: 6, 15: 9, 20: 12 }),
  7: Object.freeze({ 2: 1, 4: 3, 5: 3, 6: 4, 10: 6, 15: 9, 20: 12 }),
  8: Object.freeze({ 2: 2, 4: 3, 5: 3, 6: 4, 10: 6, 15: 9, 20: 12 }),
  9: Object.freeze({ 2: 2, 4: 3, 5: 4, 6: 5, 10: 8, 15: 12, 20: 16 }),
  10: Object.freeze({ 2: 2, 4: 3, 5: 4, 6: 5, 10: 8, 15: 12, 20: 16 }),
  11: Object.freeze({ 2: 2, 4: 4, 5: 5, 6: 6, 10: 10, 15: 15, 20: 20 }),
  12: Object.freeze({ 2: 2, 4: 4, 5: 5, 6: 6, 10: 10, 15: 15, 20: 20 })
});

function integer(value, label, { min = 0, max = Infinity } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new RangeError(`${label} must be an integer from ${min} to ${max}.`);
  }
  return number;
}

export function missileLauncherProfile(weaponName) {
  const match = String(weaponName).match(/\b(SRM|LRM)\s*[-/]?\s*(2|4|5|6|10|15|20)\b/i);
  if (!match) return null;
  const family = match[1].toUpperCase();
  const size = Number(match[2]);
  if (family === "SRM" && ![2, 4, 6].includes(size)) return null;
  if (family === "LRM" && ![5, 10, 15, 20].includes(size)) return null;
  return { family, size };
}

export function resolveMissileCluster(weaponName, roll) {
  const profile = missileLauncherProfile(weaponName);
  if (!profile) throw new RangeError(`${weaponName} is not a supported missile launcher.`);
  const total = integer(roll, "Cluster roll", { min: 2, max: 12 });
  const missilesHit = CLUSTER_HITS[total][profile.size];
  const damageGroups = profile.family === "SRM"
    ? Array.from({ length: missilesHit }, () => 2)
    : [
        ...Array.from({ length: Math.floor(missilesHit / 5) }, () => 5),
        ...(missilesHit % 5 ? [missilesHit % 5] : [])
      ];
  return { ...profile, roll: total, missilesHit, damageGroups };
}

export function ammunitionTypeForWeapon(weaponName) {
  const name = String(weaponName);
  const autocannon = name.match(/\b(?:Autocannon|AC)\s*\/\s*(2|5|10|20)\b/i);
  if (autocannon) return `AC/${autocannon[1]}`;
  const missile = missileLauncherProfile(name);
  if (missile) return `${missile.family} ${missile.size}`;
  if (/\bMachine Gun\b/i.test(name)) return "Machine Gun";
  return null;
}

export function selectAmmunitionBin(items, weaponName) {
  const ammoType = ammunitionTypeForWeapon(weaponName);
  if (!ammoType) return null;
  const candidates = [...items].filter(item => item.type === "ammo"
    && item.system.ammoType === ammoType
    && !item.system.destroyed
    && Number(item.system.shots) > 0);
  candidates.sort((left, right) => Number(left.system.shots) - Number(right.system.shots)
    || String(left.name).localeCompare(String(right.name)));
  return candidates[0] ?? null;
}

