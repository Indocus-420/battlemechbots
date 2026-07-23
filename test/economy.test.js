import assert from "node:assert/strict";
import test from "node:test";
import {
  adjustMNotes,
  campaignLedger,
  executePurchase,
  STORE_CATALOG,
  STORE_CATALOG_BY_ID
} from "../module/economy.js";
import { CORE_ITEMS, CORE_MECHS, CORE_VEHICLES } from "../module/content.js";

function user(id, mNotes = 0, isGM = false) {
  const subject = {
    id,
    name: id,
    isGM,
    active: true,
    flags: { "battletech-foundry-system": { campaign: { mNotes, transactions: [] } } },
    getFlag(system, key) {
      return this.flags?.[system]?.[key];
    },
    async setFlag(system, key, value) {
      this.flags[system] ??= {};
      this.flags[system][key] = value;
      return value;
    }
  };
  return subject;
}

function actor(id, ownerId) {
  return {
    id,
    name: id,
    type: "mech",
    ownership: { [ownerId]: 3 },
    created: [],
    testUserPermission(candidate) {
      return this.ownership[candidate.id] >= 3;
    },
    async createEmbeddedDocuments(type, sources) {
      assert.equal(type, "Item");
      const documents = sources.map(source => ({ ...source, delete: async () => undefined }));
      this.created.push(...documents);
      return documents;
    }
  };
}

test("storefront contains every supported item, BattleMech, and vehicle with a positive price", () => {
  assert.equal(STORE_CATALOG.length, CORE_ITEMS.length + CORE_MECHS.length + CORE_VEHICLES.length);
  assert.equal(new Set(STORE_CATALOG.map(entry => entry.id)).size, STORE_CATALOG.length);
  assert.ok(STORE_CATALOG.every(entry => Number.isInteger(entry.price) && entry.price > 0));
  assert.ok(STORE_CATALOG.every(entry => entry.sourceUrl.startsWith("https://")));
  assert.deepEqual([...new Set(STORE_CATALOG.map(entry => entry.kind))].sort(), ["item", "mech", "vehicle"]);
  const mechs = STORE_CATALOG.filter(entry => entry.kind === "mech");
  assert.equal(mechs.length, 20);
  assert.ok(mechs.every(entry => entry.sourceUrl.startsWith("https://www.sarna.net/wiki/")));
  assert.equal(mechs.find(entry => entry.name === "Firestarter FS9-H").sourceUrl, "https://www.sarna.net/wiki/Firestarter_(BattleMech)");
});

test("Gamemasters can add and remove M-Notes with a transaction ledger", async () => {
  const gm = user("GM", 0, true);
  const player = user("Player", 10000);
  const credit = await adjustMNotes(player, 40000, "Mission payout", { actingUser: gm });
  assert.equal(credit.balance, 50000);
  const debit = await adjustMNotes(player, -5000, "DropShip fee", { actingUser: gm });
  assert.equal(debit.balance, 45000);
  const ledger = campaignLedger(player);
  assert.equal(ledger.transactions.length, 2);
  assert.equal(ledger.transactions[0].amount, -5000);
  await assert.rejects(() => adjustMNotes(player, -50000, "Invalid", { actingUser: gm }), /has only/);
});

test("equipment purchase deducts the exact price and delivers to an owned unit", async () => {
  const gm = user("GM", 0, true);
  const player = user("Player", 100000);
  const mech = actor("Owned Mech", player.id);
  const entry = Object.values(STORE_CATALOG_BY_ID).find(candidate => candidate.name === "Medium Laser");
  const game = { user: gm, actors: { get: id => id === mech.id ? mech : null } };
  const result = await executePurchase({ buyer: player, entryId: entry.id, targetActorId: mech.id, game, actingUser: gm });
  assert.equal(result.balance, 100000 - entry.price);
  assert.equal(mech.created.length, 1);
  assert.equal(mech.created[0].name, "Medium Laser");
  assert.equal(campaignLedger(player).transactions[0].amount, -entry.price);
});

test("an unaffordable purchase neither delivers an item nor changes the balance", async () => {
  const gm = user("GM", 0, true);
  const player = user("Player", 1);
  const mech = actor("Owned Mech", player.id);
  const entry = Object.values(STORE_CATALOG_BY_ID).find(candidate => candidate.name === "Large Laser");
  const game = { user: gm, actors: { get: () => mech } };
  await assert.rejects(() => executePurchase({ buyer: player, entryId: entry.id, targetActorId: mech.id, game, actingUser: gm }), /more M-Notes/);
  assert.equal(mech.created.length, 0);
  assert.equal(campaignLedger(player).mNotes, 1);
});

test("unit purchases create an owned actor and deduct the catalog price", async () => {
  const gm = user("GM", 0, true);
  const player = user("Player", 20000000);
  const entry = STORE_CATALOG.find(candidate => candidate.kind === "mech");
  let createdSource;
  const previousActor = globalThis.Actor;
  globalThis.Actor = {
    async create(source) {
      createdSource = source;
      return { name: source.name, delete: async () => undefined };
    }
  };
  try {
    const result = await executePurchase({ buyer: player, entryId: entry.id, game: { user: gm }, actingUser: gm });
    assert.equal(result.balance, 20000000 - entry.price);
    assert.equal(createdSource.ownership[player.id], 3);
  } finally {
    globalThis.Actor = previousActor;
  }
});
