export const TURN_PHASES = Object.freeze([
  "initiative",
  "movement",
  "weaponAttack",
  "physicalAttack",
  "heat",
  "end"
]);

export const ALTERNATING_PHASES = Object.freeze([
  "movement",
  "weaponAttack",
  "physicalAttack"
]);

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new RangeError(`${label} must be a non-negative integer.`);
  return number;
}

export function determineInitiative(rolls) {
  const entries = Object.entries(rolls ?? {});
  if (entries.length < 2) throw new RangeError("Initiative requires at least two sides.");
  for (const [side, roll] of entries) positiveInteger(roll, `${side} initiative`);
  const maximum = Math.max(...entries.map(([, roll]) => Number(roll)));
  const winners = entries.filter(([, roll]) => Number(roll) === maximum).map(([side]) => side);
  return winners.length === 1 ? { winner: winners[0], tied: [] } : { winner: null, tied: winners };
}

export function declarationBatchSize(activeRemaining, opposingRemaining) {
  const active = positiveInteger(activeRemaining, "Active units remaining");
  const opposing = positiveInteger(opposingRemaining, "Opposing units remaining");
  if (!active) return 0;
  if (!opposing) return active;
  return Math.min(active, Math.max(1, Math.floor(active / opposing)));
}

export function combatantSide(combatant, systemId = "battletech-foundry-system") {
  const assigned = combatant?.flags?.[systemId]?.side?.trim?.();
  if (assigned) return assigned;
  const disposition = Number(combatant?.token?.disposition);
  if (disposition > 0) return "Friendly";
  if (disposition < 0) return "Hostile";
  throw new RangeError(`${combatant?.name ?? "Combatant"} needs a Friendly or Hostile token disposition, or an explicit BattleTech side flag.`);
}

export function groupCombatantsBySide(combatants, systemId = "battletech-foundry-system") {
  const sides = {};
  for (const combatant of combatants) {
    const side = combatantSide(combatant, systemId);
    (sides[side] ??= []).push(combatant.id);
  }
  if (Object.keys(sides).length !== 2) throw new RangeError("The Combat Tracker must contain exactly two BattleTech sides.");
  return sides;
}

export function createTurnSequence({ round = 1, sides, rolls }) {
  const sideEntries = Object.entries(sides ?? {});
  if (sideEntries.length !== 2) throw new RangeError("The current turn-sequence foundation requires exactly two sides.");
  const sideIds = sideEntries.map(([side]) => side);
  const units = Object.fromEntries(sideEntries.map(([side, ids]) => {
    if (!Array.isArray(ids)) throw new TypeError(`${side} units must be an array.`);
    if (new Set(ids).size !== ids.length) throw new RangeError(`${side} contains duplicate units.`);
    return [side, [...ids]];
  }));
  const allUnits = Object.values(units).flat();
  if (new Set(allUnits).size !== allUnits.length) throw new RangeError("A unit cannot belong to both sides.");

  const initiative = determineInitiative(rolls);
  if (!initiative.winner) throw new RangeError("Tied Initiative must be rerolled before starting the turn.");
  const loser = sideIds.find(side => side !== initiative.winner);
  return {
    round: positiveInteger(round, "Round") || 1,
    phase: "initiative",
    sides: units,
    rolls: Object.fromEntries(sideIds.map(side => [side, Number(rolls[side])])),
    winner: initiative.winner,
    loser,
    sideToAct: null,
    remaining: Object.fromEntries(sideIds.map(side => [side, []])),
    completed: Object.fromEntries(sideIds.map(side => [side, []]))
  };
}

export function beginPhase(sequence, phase) {
  if (!TURN_PHASES.includes(phase)) throw new RangeError(`Unknown BattleTech phase: ${phase}.`);
  const alternating = ALTERNATING_PHASES.includes(phase);
  return {
    ...sequence,
    phase,
    sideToAct: alternating ? sequence.loser : null,
    remaining: Object.fromEntries(Object.entries(sequence.sides).map(([side, ids]) => [side, alternating ? [...ids] : []])),
    completed: Object.fromEntries(Object.keys(sequence.sides).map(side => [side, []]))
  };
}

export function requiredSelectionCount(sequence) {
  const active = sequence.sideToAct;
  if (!active) return 0;
  const opposing = Object.keys(sequence.sides).find(side => side !== active);
  return declarationBatchSize(sequence.remaining[active].length, sequence.remaining[opposing].length);
}

export function recordSelections(sequence, unitIds) {
  if (!ALTERNATING_PHASES.includes(sequence.phase)) throw new RangeError(`${sequence.phase} does not use alternating selections.`);
  const active = sequence.sideToAct;
  const opposing = Object.keys(sequence.sides).find(side => side !== active);
  const selected = [...unitIds];
  const required = requiredSelectionCount(sequence);
  if (selected.length !== required) throw new RangeError(`${active} must select ${required} unit(s).`);
  if (new Set(selected).size !== selected.length || selected.some(id => !sequence.remaining[active].includes(id))) {
    throw new RangeError("Selections must be unique units still awaiting action for the active side.");
  }

  const remaining = {
    ...sequence.remaining,
    [active]: sequence.remaining[active].filter(id => !selected.includes(id))
  };
  const completed = {
    ...sequence.completed,
    [active]: [...sequence.completed[active], ...selected]
  };
  const sideToAct = remaining[opposing].length ? opposing : remaining[active].length ? active : null;
  return { ...sequence, remaining, completed, sideToAct };
}

export function nextPhase(sequence) {
  const index = TURN_PHASES.indexOf(sequence.phase);
  if (index < 0) throw new RangeError(`Unknown BattleTech phase: ${sequence.phase}.`);
  if (ALTERNATING_PHASES.includes(sequence.phase) && sequence.sideToAct) {
    throw new RangeError(`${sequence.phase} cannot end while units still await selections.`);
  }
  if (index === TURN_PHASES.length - 1) return { ...beginPhase(sequence, "initiative"), round: sequence.round + 1 };
  return beginPhase(sequence, TURN_PHASES[index + 1]);
}
