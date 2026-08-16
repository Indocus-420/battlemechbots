import assert from "node:assert/strict";
import test from "node:test";

import {
  combatTeamRoster,
  COMBAT_TEAMS,
  MAX_TEAM_SIZE,
  normalizeCombatTeam,
  validateCombatTeamRosters
} from "../module/teams.js";

test("team names normalize to the two supported encounter teams", () => {
  assert.deepEqual(COMBAT_TEAMS, ["Team A", "Team B"]);
  assert.equal(MAX_TEAM_SIZE, 4);
  assert.equal(normalizeCombatTeam("a"), "Team A");
  assert.equal(normalizeCombatTeam("TEAM B"), "Team B");
  assert.throws(() => normalizeCombatTeam("Team C"), /Unknown/);
});

test("team validation supports 1v1 through 4v4 and rejects oversized rosters", () => {
  for (let size = 1; size <= 4; size += 1) {
    const sides = {
      "Team A": Array.from({ length: size }, (_, index) => `a${index}`),
      "Team B": Array.from({ length: size }, (_, index) => `b${index}`)
    };
    assert.deepEqual(validateCombatTeamRosters(sides), sides);
  }
  assert.throws(() => validateCombatTeamRosters({
    "Team A": ["a1", "a2", "a3", "a4", "a5"],
    "Team B": ["b1", "b2", "b3", "b4"]
  }), /more than 4/);
  assert.throws(() => validateCombatTeamRosters({
    "Team A": ["same"],
    "Team B": ["same"]
  }), /both/);
});

test("team roster separates Team A, Team B, and unassigned combatants", () => {
  const systemId = "battletech-foundry-system";
  const combatants = [
    { id: "a1", name: "Alpha", flags: { [systemId]: { side: "Team A" } } },
    { id: "b1", name: "Bravo", flags: { [systemId]: { side: "b" } } },
    { id: "u1", name: "Unassigned", flags: {} }
  ];
  const result = combatTeamRoster(combatants, systemId);
  assert.deepEqual(result.roster["Team A"].map(entry => entry.id), ["a1"]);
  assert.deepEqual(result.roster["Team B"].map(entry => entry.id), ["b1"]);
  assert.deepEqual(result.unassigned.map(entry => entry.id), ["u1"]);
});
