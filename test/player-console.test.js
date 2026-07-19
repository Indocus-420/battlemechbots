import test from "node:test";
import assert from "node:assert/strict";
import { playerConsoleModel, unitCondition, unitReadiness } from "../module/player-console.js";

function actor(id, type = "mech") {
  return {
    id,
    name: id,
    type,
    img: `${id}.webp`,
    isOwner: true,
    items: [],
    system: type === "mech" ? {
      pilot: { name: "Pilot", gunnery: 4, piloting: 5, hits: 0 },
      mech: { chassis: "Test", variant: "TST", faction: "independent" },
      heat: { current: 0 },
      armor: { head: { front: 9, maxFront: 9 } },
      structure: { head: { value: 3, max: 3 } },
      status: { destroyed: false }
    } : {
      crew: { name: "Crew" },
      vehicle: { chassis: "Carrier", variant: "A" },
      armor: { front: 10, left: 5, right: 5, rear: 3, turret: 4 },
      structure: 10,
      status: { destroyed: false }
    }
  };
}

test("player console fills four mech and three vehicle slots", () => {
  const actors = [actor("m1"), actor("m2"), actor("v1", "vehicle")];
  const game = {
    user: { id: "u", name: "Player", getFlag: () => ({}), isGM: false },
    actors,
    settings: { get: () => ({ name: "Test Mission" }) }
  };
  const model = playerConsoleModel({ game, controlled: [] });
  assert.equal(model.lance.mechs.length, 4);
  assert.equal(model.lance.vehicles.length, 3);
  assert.equal(model.lance.mechs[0].name, "m1");
  assert.equal(model.mission.name, "Test Mission");
});

test("unit readiness and condition report damage and ammunition", () => {
  const mech = actor("m1");
  mech.items.push({ type: "ammo", system: { shots: 0, maxShots: 10, destroyed: false } });
  assert.equal(unitReadiness(mech).label, "Rearm");
  assert.equal(unitCondition(mech).ammoMaximum, 10);
});
