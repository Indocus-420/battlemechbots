import {
  ammunitionTypeForWeapon,
  ammunitionUnitsPerAttack,
  planAmmunitionConsumption
} from "./missiles.js";

const SYSTEM_ID = "battletech-foundry-system";
const TOKENIZER_ID = "vtta-tokenizer";
export const FIRE_GROUPS = Object.freeze(["1", "2", "3", "alpha"]);
export const HUD_FACTIONS = Object.freeze(["independent", "davion", "kurita", "liao", "marik", "steiner"]);

export function normalizeHudFaction(value) {
  const faction = String(value ?? "").trim().toLowerCase();
  return HUD_FACTIONS.includes(faction) ? faction : "independent";
}

export function weaponFireGroup(item) {
  const stored = item?.getFlag?.(SYSTEM_ID, "fireGroup") ?? item?.flags?.[SYSTEM_ID]?.fireGroup;
  return FIRE_GROUPS.includes(String(stored)) ? String(stored) : "alpha";
}

function integer(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number)) throw new TypeError(`${label} must be a whole number.`);
  return number;
}

export function d6Formula(count = 2, modifier = 0) {
  const dice = integer(count, "D6 count");
  const bonus = integer(modifier, "D6 modifier");
  if (dice < 1 || dice > 20) throw new RangeError("D6 count must be between 1 and 20.");
  if (bonus < -99 || bonus > 99) throw new RangeError("D6 modifier must be between -99 and +99.");
  return `${dice}d6${bonus > 0 ? `+${bonus}` : bonus < 0 ? bonus : ""}`;
}

export function d6CheckOutcome(total, target) {
  const rolled = Number(total);
  const threshold = Number(target);
  return {
    total: rolled,
    target: threshold,
    margin: rolled - threshold,
    success: rolled >= threshold
  };
}

export function tokenizerIntegrationState({ modules = globalThis.game?.modules, user = globalThis.game?.user } = {}) {
  const module = modules?.get?.(TOKENIZER_ID);
  const api = module?.api ?? globalThis.Tokenizer;
  return {
    active: Boolean(module?.active && api),
    canUpload: Boolean(user?.can?.("FILES_UPLOAD")),
    api
  };
}

export async function editActorTokenImage(actor, options = {}) {
  if (!actor) throw new TypeError("Choose a BattleTech Actor before editing its token.");
  const state = tokenizerIntegrationState(options);
  if (!state.active) throw new RangeError("Install and enable Tokenizer to edit BattleTech token images.");
  if (!state.canUpload) throw new RangeError("This player needs Foundry's file-upload permission to save token images.");
  const tokenizeActor = state.api?.tokenizeActor ?? state.api?.tokenizeDoc;
  if (typeof tokenizeActor !== "function") throw new TypeError("The active Tokenizer version does not expose its Actor editing API.");
  return tokenizeActor.call(state.api, actor);
}

export function tokenActionHudModel(actor) {
  if (!actor || !["mech", "vehicle"].includes(actor.type)) return null;
  const mech = actor.type === "mech";
  const heat = mech ? Number(actor.system?.heat?.current ?? 0) : null;
  const items = mech ? [...(actor.items ?? [])] : [];
  const ammunitionBins = items.filter(item => item.type === "ammo" && !item.system?.destroyed);
  const weapons = items
    .filter(item => item.type === "weapon" && !item.system?.destroyed)
    .map(item => {
      const ammoPerShot = ammunitionUnitsPerAttack(item);
      const ammoType = ammunitionTypeForWeapon(item.name);
      const compatibleBins = ammunitionBins.filter(bin => bin.system?.ammoType === ammoType);
      const ammunition = {
        type: ammoType,
        current: compatibleBins.reduce((sum, bin) => sum + Number(bin.system?.shots ?? 0), 0),
        maximum: compatibleBins.reduce((sum, bin) => sum + Number(bin.system?.maxShots ?? bin.system?.shots ?? 0), 0),
        bins: compatibleBins.length,
        required: ammoPerShot,
        sufficient: ammoPerShot === 0 || compatibleBins.some(bin => Number(bin.system?.shots ?? 0) >= ammoPerShot)
      };
      return {
        id: item.id,
        name: item.name,
        img: item.img,
        category: item.system?.weaponType === "missile"
          ? "missile"
          : ["autocannon", "ballistic"].includes(item.system?.weaponType)
            ? "ballistic"
            : "energy",
        group: weaponFireGroup(item),
        damage: Number(item.system?.damage ?? 0),
        heat: Number(item.system?.heat ?? 0),
        ammoPerShot,
        ammunition,
        range: { ...(item.system?.range ?? {}) }
      };
    });
  const fireGroups = Object.fromEntries(FIRE_GROUPS.map(group => [group, weapons.filter(weapon => weapon.group === group)]));
  const fireGroupSummaries = Object.fromEntries(FIRE_GROUPS.map(group => {
    const groupedWeapons = fireGroups[group];
    const ammunitionPlan = planAmmunitionConsumption(items, groupedWeapons);
    return [group, {
      count: groupedWeapons.length,
      damage: groupedWeapons.reduce((sum, weapon) => sum + weapon.damage, 0),
      heat: groupedWeapons.reduce((sum, weapon) => sum + weapon.heat, 0),
      ammunition: groupedWeapons.reduce((sum, weapon) => sum + weapon.ammoPerShot, 0),
      ammunitionSufficient: ammunitionPlan.ready,
      short: groupedWeapons.length ? Math.min(...groupedWeapons.map(weapon => Number(weapon.range.short) || 0)) : 0,
      medium: groupedWeapons.length ? Math.min(...groupedWeapons.map(weapon => Number(weapon.range.medium) || 0)) : 0,
      long: groupedWeapons.length ? Math.min(...groupedWeapons.map(weapon => Number(weapon.range.long) || 0)) : 0
    }];
  }));
  const ammunition = {
    current: ammunitionBins.reduce((sum, item) => sum + Number(item.system?.shots ?? 0), 0),
    maximum: ammunitionBins.reduce((sum, item) => sum + Number(item.system?.maxShots ?? item.system?.shots ?? 0), 0),
    bins: ammunitionBins.length
  };
  return {
    actorId: actor.id,
    actorName: actor.name,
    actorImage: actor.img,
    actorType: actor.type,
    faction: mech ? normalizeHudFaction(actor.system?.mech?.faction) : "independent",
    pilotName: mech ? String(actor.system?.pilot?.name || "Unassigned Pilot") : String(actor.system?.crew?.name || "Vehicle Crew"),
    heat,
    heatMaximum: mech ? 30 : null,
    heatSegments: mech ? Math.min(5, Math.max(0, Math.ceil((heat / 30) * 5))) : 0,
    gunnery: Number(actor.system?.pilot?.gunnery ?? actor.system?.crew?.gunnery ?? 4),
    piloting: Number(actor.system?.pilot?.piloting ?? actor.system?.crew?.driving ?? 5),
    movement: mech
      ? `${actor.system?.movement?.mode ?? "stand"}: ${Number(actor.system?.movement?.mpSpent ?? 0)} MP`
      : `cruise ${Number(actor.system?.movement?.cruise ?? 0)} / flank ${Number(actor.system?.movement?.flank ?? 0)}`,
    weapons,
    fireGroups,
    fireGroupSummaries,
    ammunition,
    systemId: SYSTEM_ID
  };
}
