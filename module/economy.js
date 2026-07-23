import { CORE_ITEMS, CORE_MECHS, CORE_VEHICLES, itemCatalogGroup, mechWeightClass } from "./content.js";

const SYSTEM_ID = "battletech-foundry-system";
const ECONOMY_SOCKET = `system.${SYSTEM_ID}`;
const REQUEST_TIMEOUT = 20000;
const MAX_TRANSACTIONS = 250;
const pendingRequests = new Map();

const ITEM_PRICES = Object.freeze({
  "Small Laser": 11250,
  "Medium Laser": 40000,
  "Large Laser": 100000,
  "Particle Projection Cannon": 200000,
  "Machine Gun": 5000,
  "Flamer": 7500,
  "Autocannon/2": 75000,
  "Autocannon/5": 125000,
  "Autocannon/10": 200000,
  "Autocannon/20": 300000,
  "SRM 2": 10000,
  "SRM 4": 60000,
  "SRM 6": 80000,
  "LRM 5": 30000,
  "LRM 10": 100000,
  "LRM 15": 175000,
  "LRM 20": 250000,
  "Machine Gun Ammunition": 1000,
  "Autocannon/2 Ammunition": 1000,
  "Autocannon/5 Ammunition": 4500,
  "Autocannon/10 Ammunition": 6000,
  "Autocannon/20 Ammunition": 10000,
  "SRM 2 Ammunition": 27000,
  "SRM 4 Ammunition": 27000,
  "SRM 6 Ammunition": 27000,
  "LRM 5 Ammunition": 30000,
  "LRM 10 Ammunition": 30000,
  "LRM 15 Ammunition": 30000,
  "LRM 20 Ammunition": 30000,
  "Fusion Engine": 500000,
  "Gyro": 300000,
  "Sensors": 100000,
  "Life Support": 50000,
  "Cockpit": 200000,
  "Heat Sink": 2000,
  "Jump Jet": 20000,
  "Hatchet": 100000,
  "Shoulder Actuator": 50000,
  "Upper Arm Actuator": 30000,
  "Lower Arm Actuator": 25000,
  "Hand Actuator": 20000,
  "Hip Actuator": 60000,
  "Upper Leg Actuator": 40000,
  "Lower Leg Actuator": 35000,
  "Foot Actuator": 25000
});

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function cloneSource(source) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(source);
  return structuredClone(source);
}

function collectionValues(collection) {
  return Array.isArray(collection) ? collection : [...(collection ?? [])];
}

function sourceUrl(name) {
  const page = String(name)
    .replace("Particle Projection Cannon", "Particle_Projector_Cannon")
    .replace(/\s+Ammunition$/, "")
    .replace(/\//g, "_")
    .replace(/\s+/g, "_");
  return `https://www.sarna.net/wiki/${encodeURIComponent(page).replace(/%5F/g, "_")}`;
}

function itemEntry(item) {
  return Object.freeze({
    id: `item-${slug(item.type)}-${slug(item.name)}`,
    kind: "item",
    group: itemCatalogGroup(item),
    name: item.name,
    image: item.img,
    price: ITEM_PRICES[item.name] ?? 25000,
    description: item.system?.notes || `${item.type === "ammo" ? "Ammunition bin" : item.type} for supported BattleMech and vehicle actors.`,
    sourceUrl: sourceUrl(item.name),
    document: item
  });
}

function unitPrice(unit, vehicle = false) {
  const tonnage = numeric(vehicle ? unit.system?.vehicle?.tonnage : unit.system?.mech?.tonnage);
  const equipmentValue = collectionValues(unit.items).reduce((total, item) => total + numeric(ITEM_PRICES[item.name]), 0);
  return Math.max(500000, Math.round(((tonnage * (vehicle ? 35000 : 70000)) + equipmentValue) / 1000) * 1000);
}

const MECH_SOURCE_PAGES = Object.freeze({
  Blackjack: "Blackjack_(BattleMech)",
  Banshee: "Banshee_(BattleMech)",
  Firestarter: "Firestarter_(BattleMech)"
});

function mechSourceUrl(unit) {
  const chassis = String(unit.system?.mech?.chassis ?? unit.name).trim();
  const page = MECH_SOURCE_PAGES[chassis] ?? chassis.replace(/\s+/g, "_");
  return `https://www.sarna.net/wiki/${page}`;
}

function unitEntry(unit, vehicle = false) {
  const tonnage = numeric(vehicle ? unit.system?.vehicle?.tonnage : unit.system?.mech?.tonnage);
  const kind = vehicle ? "vehicle" : "mech";
  return Object.freeze({
    id: `${kind}-${slug(unit.name)}`,
    kind,
    group: vehicle ? "vehicles" : mechWeightClass(tonnage),
    name: unit.name,
    image: unit.img,
    price: unitPrice(unit, vehicle),
    description: `${tonnage}-ton ${vehicle ? unit.system?.vehicle?.role ?? "support vehicle" : `${mechWeightClass(tonnage)} BattleMech`}.`,
    sourceUrl: vehicle
      ? "https://www.sarna.net/wiki/Combat_Vehicle"
      : mechSourceUrl(unit),
    document: unit
  });
}

export const STORE_CATALOG = Object.freeze([
  ...CORE_ITEMS.map(itemEntry),
  ...CORE_MECHS.map(unit => unitEntry(unit, false)),
  ...CORE_VEHICLES.map(unit => unitEntry(unit, true))
]);

export const STORE_CATALOG_BY_ID = Object.freeze(Object.fromEntries(STORE_CATALOG.map(entry => [entry.id, entry])));

export function campaignLedger(user) {
  const campaign = user?.getFlag?.(SYSTEM_ID, "campaign") ?? user?.flags?.[SYSTEM_ID]?.campaign ?? {};
  return {
    ...campaign,
    mNotes: Math.max(0, Math.trunc(numeric(campaign.mNotes))),
    transactions: Array.isArray(campaign.transactions) ? campaign.transactions : []
  };
}

export function createTransaction({ amount, balance, description, type = "adjustment", userName = "", itemName = "", timestamp = Date.now() }) {
  return {
    id: globalThis.foundry?.utils?.randomID?.() ?? `${timestamp}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp,
    amount: Math.trunc(numeric(amount)),
    balance: Math.max(0, Math.trunc(numeric(balance))),
    description: String(description || "M-Notes adjustment"),
    type,
    userName,
    itemName
  };
}

async function saveLedger(user, campaign) {
  if (!user?.setFlag) throw new Error("The selected user cannot store campaign data.");
  await user.setFlag(SYSTEM_ID, "campaign", campaign);
  return campaign;
}

export async function adjustMNotes(user, amount, reason = "GM adjustment", { actingUser = globalThis.game?.user } = {}) {
  if (!actingUser?.isGM) throw new Error("Only a Gamemaster can adjust M-Notes.");
  const delta = Math.trunc(numeric(amount));
  if (!delta) throw new Error("Enter a non-zero M-Notes adjustment.");
  const campaign = campaignLedger(user);
  const balance = campaign.mNotes + delta;
  if (balance < 0) throw new Error(`${user.name} has only ${campaign.mNotes.toLocaleString()} M-Notes.`);
  const transaction = createTransaction({
    amount: delta,
    balance,
    description: reason,
    type: "adjustment",
    userName: actingUser.name
  });
  await saveLedger(user, {
    ...campaign,
    mNotes: balance,
    transactions: [transaction, ...campaign.transactions].slice(0, MAX_TRANSACTIONS)
  });
  return { balance, transaction };
}

function actorOwnedBy(actor, user) {
  return Boolean(actor && user && (user.isGM || actor.testUserPermission?.(user, "OWNER") || actor.ownership?.[user.id] >= 3));
}

async function deliverPurchase(entry, buyer, targetActorId, game) {
  const source = cloneSource(entry.document);
  if (entry.kind === "item") {
    const actor = game.actors?.get?.(targetActorId) ?? collectionValues(game.actors).find(candidate => candidate.id === targetActorId);
    if (!actorOwnedBy(actor, buyer)) throw new Error("Choose a BattleMech or vehicle owned by the buyer.");
    if (!["mech", "vehicle"].includes(actor.type)) throw new Error("Store items can only be delivered to a BattleMech or vehicle.");
    const [created] = await actor.createEmbeddedDocuments("Item", [source]);
    return { document: created, destination: actor.name };
  }
  source.ownership = { ...(source.ownership ?? {}), default: 0, [buyer.id]: 3 };
  const created = await globalThis.Actor.create(source);
  return { document: created, destination: "Mech Bay" };
}

export async function executePurchase({ buyer, entryId, targetActorId = "", game = globalThis.game, actingUser = game?.user } = {}) {
  if (!actingUser?.isGM) throw new Error("Purchases must be approved by the connected Gamemaster.");
  const entry = STORE_CATALOG_BY_ID[entryId];
  if (!entry) throw new Error("That storefront item is unavailable.");
  const campaign = campaignLedger(buyer);
  if (campaign.mNotes < entry.price) {
    throw new Error(`${buyer.name} needs ${(entry.price - campaign.mNotes).toLocaleString()} more M-Notes.`);
  }
  const delivery = await deliverPurchase(entry, buyer, targetActorId, game);
  const balance = campaign.mNotes - entry.price;
  const transaction = createTransaction({
    amount: -entry.price,
    balance,
    description: `Purchased ${entry.name} → ${delivery.destination}`,
    type: "purchase",
    userName: actingUser.name,
    itemName: entry.name
  });
  try {
    await saveLedger(buyer, {
      ...campaign,
      mNotes: balance,
      transactions: [transaction, ...campaign.transactions].slice(0, MAX_TRANSACTIONS)
    });
  } catch (error) {
    await delivery.document?.delete?.();
    throw error;
  }
  return { balance, entry, transaction, destination: delivery.destination };
}

function activeGM(game) {
  return collectionValues(game?.users).find(user => user.active && user.isGM);
}

function requestId() {
  return globalThis.foundry?.utils?.randomID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function requestStorePurchase(entryId, targetActorId = "", { game = globalThis.game } = {}) {
  if (game?.user?.isGM) return executePurchase({ buyer: game.user, entryId, targetActorId, game });
  if (!activeGM(game)) return Promise.reject(new Error("A Gamemaster must be connected to approve purchases."));
  if (!game?.socket?.emit) return Promise.reject(new Error("The M-Notes storefront connection is unavailable."));
  const id = requestId();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error("The purchase request timed out."));
    }, REQUEST_TIMEOUT);
    pendingRequests.set(id, { resolve, reject, timer });
    game.socket.emit(ECONOMY_SOCKET, {
      type: "economy-purchase-request",
      id,
      buyerId: game.user.id,
      entryId,
      targetActorId
    });
  });
}

export function configureEconomySocket({ game = globalThis.game } = {}) {
  game?.socket?.on?.(ECONOMY_SOCKET, async (payload, senderId) => {
    if (payload?.type === "economy-purchase-response" && payload.recipientId === game.user?.id) {
      const pending = pendingRequests.get(payload.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingRequests.delete(payload.id);
      if (payload.ok) pending.resolve(payload.result);
      else pending.reject(new Error(payload.error || "Purchase failed."));
      return;
    }
    if (payload?.type !== "economy-purchase-request" || !game.user?.isGM) return;
    const buyer = game.users?.get?.(payload.buyerId) ?? collectionValues(game.users).find(user => user.id === payload.buyerId);
    const senderMatches = senderId ? senderId === payload.buyerId : true;
    let response;
    try {
      if (!buyer || !senderMatches) throw new Error("The purchase requester could not be verified.");
      const result = await executePurchase({
        buyer,
        entryId: payload.entryId,
        targetActorId: payload.targetActorId,
        game,
        actingUser: game.user
      });
      response = {
        type: "economy-purchase-response",
        id: payload.id,
        recipientId: buyer.id,
        ok: true,
        result: { balance: result.balance, itemName: result.entry.name, destination: result.destination }
      };
    } catch (error) {
      response = {
        type: "economy-purchase-response",
        id: payload.id,
        recipientId: payload.buyerId,
        ok: false,
        error: error.message
      };
    }
    game.socket.emit(ECONOMY_SOCKET, response);
  });
}
