const PROBE_PATTERN = /(?:beagle|bloodhound|light|clan)?\s*(?:active\s*)?probe|radar sensor|x-?1\s+ew/i;
const X1_EW_PATTERN = /x-?1\s+ew/i;

function operational(item) {
  return item?.type === "weapon" && !item.system?.destroyed && !item.system?.disabled;
}

export function longestWeaponRange(items = []) {
  return Math.max(0, ...Array.from(items).filter(operational).map(item => Number(item.system?.range?.long) || 0));
}

export function activeProbeProfile(items = []) {
  const probe = Array.from(items).find(item => item?.type === "equipment" && !item.system?.destroyed && PROBE_PATTERN.test(item.name ?? ""));
  if (!probe) return { equipped: false, name: null, range: 0, heat: 1 };
  const prototype = X1_EW_PATTERN.test(probe.name ?? "");
  const clan = /clan/i.test(probe.name ?? "");
  const bloodhound = /bloodhound/i.test(probe.name ?? "");
  const profile = {
    equipped: true,
    name: probe.name,
    range: prototype ? 6 : (bloodhound ? 8 : (clan ? 5 : 4)),
    heat: prototype ? 0 : 2
  };
  return prototype ? { ...profile, areaSensorLock: true, ecm: true } : profile;
}

export function x1AreaSensorLockUpdate(targetModifier = 0) {
  return {
    targetModifier: Math.max(0, (Number(targetModifier) || 0) - 2),
    sensorLocked: true,
    evasiveChargesRemoved: 2
  };
}

export function radarSweepProfile(actor) {
  const range = longestWeaponRange(actor?.items ?? []);
  const probe = activeProbeProfile(actor?.items ?? []);
  return { range, heat: probe.heat, attackPenalty: 2, probe };
}

export function radarContact({ distance, profile }) {
  if (!profile?.range || distance > profile.range) return null;
  const precise = Boolean(profile.probe?.equipped && distance <= profile.probe.range);
  return {
    distance,
    precision: precise ? "precise" : "approximate",
    attackPenalty: precise ? 0 : profile.attackPenalty,
    uncertaintyHexes: precise ? 0 : 1
  };
}
