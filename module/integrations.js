const SYSTEM_ID = "battletech-foundry-system";
const TOKENIZER_ID = "vtta-tokenizer";
export const FIRE_GROUPS = Object.freeze(["1", "2", "3", "alpha"]);

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
  const weapons = (mech ? [...(actor.items ?? [])] : [])
    .filter(item => item.type === "weapon" && !item.system?.destroyed)
    .map(item => ({
      id: item.id,
      name: item.name,
      img: item.img,
      group: weaponFireGroup(item),
      damage: Number(item.system?.damage ?? 0),
      heat: Number(item.system?.heat ?? 0),
      ammoPerShot: Number(item.system?.ammoPerShot ?? 0),
      range: { ...(item.system?.range ?? {}) }
    }));
  const fireGroups = Object.fromEntries(FIRE_GROUPS.map(group => [group, weapons.filter(weapon => weapon.group === group)]));
  return {
    actorId: actor.id,
    actorName: actor.name,
    actorImage: actor.img,
    actorType: actor.type,
    heat: mech ? Number(actor.system?.heat?.current ?? 0) : null,
    gunnery: Number(actor.system?.pilot?.gunnery ?? actor.system?.crew?.gunnery ?? 4),
    piloting: Number(actor.system?.pilot?.piloting ?? actor.system?.crew?.driving ?? 5),
    movement: mech
      ? `${actor.system?.movement?.mode ?? "stand"}: ${Number(actor.system?.movement?.mpSpent ?? 0)} MP`
      : `cruise ${Number(actor.system?.movement?.cruise ?? 0)} / flank ${Number(actor.system?.movement?.flank ?? 0)}`,
    weapons,
    fireGroups,
    systemId: SYSTEM_ID
  };
}
