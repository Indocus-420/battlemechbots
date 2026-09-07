import assert from "node:assert/strict";
import test from "node:test";

import {
  beginPhase,
  createTurnSequence,
  combatantSide,
  declarationBatchSize,
  determineInitiative,
  groupCombatantsBySide,
  nextPhase,
  recordSelections,
  requiredSelectionCount,
  TURN_PHASES
} from "../module/turn-sequence.js";

test("turn phases follow the rulebook sequence", () => {
  assert.deepEqual(TURN_PHASES, ["initiative", "movement", "weaponAttack", "physicalAttack", "heat", "end"]);
});

test("initiative identifies a winner and requires tied sides to reroll", () => {
  assert.deepEqual(determineInitiative({ red: 7, blue: 10 }), { winner: "blue", tied: [] });
  assert.deepEqual(determineInitiative({ red: 8, blue: 8 }), { winner: null, tied: ["red", "blue"] });
  assert.throws(() => createTurnSequence({ sides: { red: ["r1"], blue: ["b1"] }, rolls: { red: 8, blue: 8 } }), /rerolled/);
});

test("the initiative loser acts first in alternating phases", () => {
  const turn = createTurnSequence({ sides: { red: ["r1"], blue: ["b1"] }, rolls: { red: 5, blue: 9 } });
  const movement = beginPhase(turn, "movement");
  assert.equal(movement.winner, "blue");
  assert.equal(movement.sideToAct, "red");
  assert.equal(requiredSelectionCount(movement), 1);
});

test("unequal forces use the remaining-unit ratio from the rulebook", () => {
  assert.equal(declarationBatchSize(18, 10), 1);
  assert.equal(declarationBatchSize(16, 8), 2);
  assert.equal(declarationBatchSize(14, 5), 2);
  assert.equal(declarationBatchSize(12, 4), 3);
  assert.equal(declarationBatchSize(3, 1), 3);
});

test("combatants use explicit side flags or token disposition", () => {
  assert.equal(combatantSide({ name: "A", token: { disposition: 1 } }), "Friendly");
  assert.equal(combatantSide({ name: "B", token: { disposition: -1 } }), "Hostile");
  assert.equal(combatantSide({ flags: { "battletech-foundry-system": { side: "Mercenary" } } }), "Mercenary");
  assert.throws(() => combatantSide({ name: "Neutral", token: { disposition: 0 } }), /needs a Friendly or Hostile/);
});

test("combatants are grouped into exactly two sides", () => {
  assert.deepEqual(groupCombatantsBySide([
    { id: "f1", token: { disposition: 1 } },
    { id: "f2", token: { disposition: 1 } },
    { id: "h1", token: { disposition: -1 } }
  ]), { Friendly: ["f1", "f2"], Hostile: ["h1"] });
  assert.throws(() => groupCombatantsBySide([{ id: "f1", token: { disposition: 1 } }]), /exactly two/);
});

test("selections alternate and consume the required number of units", () => {
  const turn = createTurnSequence({
    sides: { small: ["s1", "s2"], large: ["l1", "l2", "l3", "l4"] },
    rolls: { small: 4, large: 9 }
  });
  let movement = beginPhase(turn, "movement");
  movement = recordSelections(movement, ["s1"]);
  assert.equal(movement.sideToAct, "large");
  assert.equal(requiredSelectionCount(movement), 4);
  movement = recordSelections(movement, ["l1", "l2", "l3", "l4"]);
  assert.equal(movement.sideToAct, "small");
  movement = recordSelections(movement, ["s2"]);
  assert.equal(movement.sideToAct, null);
  assert.equal(nextPhase(movement).phase, "weaponAttack");
});

test("an alternating phase cannot advance while selections remain", () => {
  const turn = createTurnSequence({ sides: { red: ["r1"], blue: ["b1"] }, rolls: { red: 4, blue: 6 } });
  assert.throws(() => nextPhase(beginPhase(turn, "movement")), /cannot end/);
});
