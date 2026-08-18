export const ACTIVATION_ACTIONS = Object.freeze({
  move: Object.freeze({ label: "Move", hotkey: "2", mode: "walk", consumesFire: false, icon: "person-walking", bonus: "Walk MP; attacker +1; keeps Fire Action" }),
  sprint: Object.freeze({ label: "Sprint", hotkey: "3", mode: "run", consumesFire: true, icon: "person-running", bonus: "Run MP; attacker +2; consumes Fire Action" }),
  jump: Object.freeze({ label: "Jump", hotkey: "4", mode: "jump", consumesFire: false, icon: "jet-fighter-up", bonus: "Jump MP; attacker +3; target +1; generates heat" }),
  brace: Object.freeze({ label: "Brace", hotkey: "-", mode: "stand", consumesFire: true, icon: "shield-halved", bonus: "Guarded: half front/side damage; Entrenched: half stability damage" })
});

export function activationActionState(actor, action) {
  const profile = ACTIVATION_ACTIONS[action];
  if (!profile) throw new RangeError(`Unknown activation action: ${action}`);
  const mech = actor?.type === "mech";
  const jump = Number(actor?.system?.movement?.jump) || 0;
  const reason = !mech ? "Movement actions require a BattleMech." : action === "jump" && jump <= 0 ? "No operational Jumping MP." : null;
  return { ...profile, action, enabled: !reason, reason };
}

export function activationActionUpdate(action) {
  const profile = ACTIVATION_ACTIONS[action];
  if (!profile) throw new RangeError(`Unknown activation action: ${action}`);
  return {
    "system.movement.mode": profile.mode,
    flags: {
      action,
      firingActionConsumed: profile.consumesFire,
      guarded: action === "brace",
      entrenched: action === "brace"
    }
  };
}

export function guardedDamage(damage, { guarded = false, rear = false } = {}) {
  const incoming = Math.max(0, Number(damage) || 0);
  return guarded && !rear ? Math.ceil(incoming / 2) : incoming;
}
