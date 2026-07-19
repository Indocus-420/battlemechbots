export const COMBAT_TEAMS = Object.freeze(["Team A", "Team B"]);
export const MAX_TEAM_SIZE = 4;

export function normalizeCombatTeam(team) {
  const value = String(team ?? "").trim().toLowerCase();
  if (["a", "team a", "teama"].includes(value)) return "Team A";
  if (["b", "team b", "teamb"].includes(value)) return "Team B";
  throw new RangeError(`Unknown BattleTech team: ${team}.`);
}

export function validateCombatTeamRosters(sides, { minimum = 1, maximum = MAX_TEAM_SIZE } = {}) {
  const entries = Object.entries(sides ?? {});
  if (entries.length !== 2) throw new RangeError("A BattleTech encounter requires exactly two teams.");
  for (const [team, ids] of entries) {
    if (!Array.isArray(ids)) throw new TypeError(`${team} roster must be an array.`);
    if (ids.length < minimum) throw new RangeError(`${team} needs at least ${minimum} unit(s).`);
    if (ids.length > maximum) throw new RangeError(`${team} cannot contain more than ${maximum} units.`);
    if (new Set(ids).size !== ids.length) throw new RangeError(`${team} contains a duplicate unit.`);
  }
  const all = entries.flatMap(([, ids]) => ids);
  if (new Set(all).size !== all.length) throw new RangeError("A unit cannot belong to both BattleTech teams.");
  return Object.fromEntries(entries.map(([team, ids]) => [team, [...ids]]));
}

export function combatTeamRoster(combatants, systemId = "battletech-foundry-system") {
  const roster = Object.fromEntries(COMBAT_TEAMS.map(team => [team, []]));
  const unassigned = [];
  for (const combatant of combatants ?? []) {
    const stored = combatant?.flags?.[systemId]?.side;
    let team;
    try {
      team = normalizeCombatTeam(stored);
    } catch {
      unassigned.push(combatant);
      continue;
    }
    roster[team].push(combatant);
  }
  return { roster, unassigned };
}
