import { randomUUID } from "node:crypto";
import {
  MATCH_REWARDS, PACKS, openPack, randomSeed, berriesForMatch,
  DUPLICATE_VALUE, craftCost, PRINT_INFO,
  type PackId, type PrintId, type Pull, type Currency,
} from "@cg/meta";
import { db, type PackRow, type PrintRow, type WalletRow } from "./db.js";
import { cardsFor, DEFAULT_UNIVERSE, type UniverseId } from "./universes.js";

/**
 * Packs, prints and money.
 *
 * Two rules the whole module is built around.
 *
 * A pack is rolled when it is opened, never when it is earned. Storing the
 * contents up front would mean the result exists before the player is watching,
 * and anyone who read the row would know what was coming.
 *
 * The seed is kept after opening. That makes an opening reproducible: a player
 * who disputes a pull can have the same pack rolled again and see the same
 * cards, and the feed can show the exact print that came out rather than a
 * description of it.
 */

export type PackSource = "matchWin" | "matchLoss" | "purchase";

export interface OwnedPack {
  id: string;
  packId: PackId;
  universe: UniverseId;
  source: PackSource;
  earnedAt: number;
}

export interface OpenedPack {
  id: string;
  packId: PackId;
  seed: number;
  pulls: Pull[];
  /** Parallel to pulls: whether each was the first of that print. */
  isNew: boolean[];
}

// ── Wallet ───────────────────────────────────────────────────────────────────

export function walletOf(userId: string): WalletRow {
  const row = db.prepare("SELECT berries, stardust FROM wallets WHERE user_id = ?").get(userId) as
    | WalletRow
    | undefined;
  if (row) return row;
  db.prepare("INSERT OR IGNORE INTO wallets (user_id, berries, stardust) VALUES (?, 0, 0)").run(userId);
  return { berries: 0, stardust: 0 };
}

/**
 * Moves money and writes it down in the same breath. Refuses to leave a balance
 * negative, so a double click cannot spend what is not there.
 */
export function moveCurrency(
  userId: string,
  currency: Currency,
  amount: number,
  reason: string,
  note?: string,
): number {
  const wallet = walletOf(userId);
  const next = wallet[currency] + amount;
  if (next < 0) throw new Error(`Not enough ${currency}`);

  db.prepare(`UPDATE wallets SET ${currency} = ? WHERE user_id = ?`).run(next, userId);
  db.prepare(
    "INSERT INTO ledger (id, user_id, currency, amount, reason, note, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(randomUUID(), userId, currency, amount, reason, note ?? null, Date.now());
  return next;
}

// ── Prints ───────────────────────────────────────────────────────────────────

export function printsOf(userId: string): PrintRow[] {
  return db
    .prepare("SELECT card_id, print_id, copies, first_at FROM prints WHERE user_id = ? AND copies > 0")
    .all(userId) as PrintRow[];
}

export function copiesOf(userId: string, cardId: string, print: PrintId): number {
  const row = db
    .prepare("SELECT copies FROM prints WHERE user_id = ? AND card_id = ? AND print_id = ?")
    .get(userId, cardId, print) as { copies: number } | undefined;
  return row?.copies ?? 0;
}

/** Adds one copy. Returns true when it is the first of that print. */
function addPrint(userId: string, cardId: string, print: PrintId): boolean {
  const before = copiesOf(userId, cardId, print);
  db.prepare(
    `INSERT INTO prints (user_id, card_id, print_id, copies, first_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT (user_id, card_id, print_id) DO UPDATE SET copies = copies + 1`,
  ).run(userId, cardId, print, Date.now());
  return before === 0;
}

export type ScrapAction = "dust" | "sell";

/**
 * Scraps spares for Stardust or Berries. Never touches the last copy, and does
 * the removal and the payment as one transaction so a crash cannot do one
 * without the other.
 */
export function scrapSpares(
  userId: string,
  cardId: string,
  print: PrintId,
  amount: number,
  action: ScrapAction,
): { removed: number; gained: number; currency: Currency } {
  const currency: Currency = action === "dust" ? "stardust" : "berries";
  const rate = action === "dust" ? DUPLICATE_VALUE[print].stardust : DUPLICATE_VALUE[print].berries;

  const run = db.transaction(() => {
    const held = copiesOf(userId, cardId, print);
    const removed = Math.max(0, Math.min(amount, held - 1));
    if (removed === 0) return { removed: 0, gained: 0, currency };

    db.prepare("UPDATE prints SET copies = copies - ? WHERE user_id = ? AND card_id = ? AND print_id = ?")
      .run(removed, userId, cardId, print);
    const gained = removed * rate;
    moveCurrency(userId, currency, gained, action === "dust" ? "duplicateDusted" : "duplicateSold",
      `${cardId}:${print} x${removed}`);
    return { removed, gained, currency };
  });

  return run();
}

/** Spends Stardust on a print that has a price. Only alt art does. */
export function craftPrint(userId: string, cardId: string, print: PrintId): void {
  const cost = craftCost(print);
  if (cost === null) throw new Error(`${PRINT_INFO[print].name} cannot be crafted`);

  db.transaction(() => {
    moveCurrency(userId, "stardust", -cost, "craft", `${cardId}:${print}`);
    addPrint(userId, cardId, print);
  })();
}

// ── Packs ────────────────────────────────────────────────────────────────────

export function unopenedPacks(userId: string): OwnedPack[] {
  const rows = db
    .prepare("SELECT * FROM packs WHERE user_id = ? AND opened_at IS NULL ORDER BY earned_at")
    .all(userId) as PackRow[];
  return rows.map(r => ({
    id: r.id,
    packId: r.pack_id as PackId,
    universe: r.universe as UniverseId,
    source: r.source as PackSource,
    earnedAt: r.earned_at,
  }));
}

export function grantPack(
  userId: string,
  packId: PackId,
  source: PackSource,
  universe: UniverseId = DEFAULT_UNIVERSE,
): OwnedPack {
  const pack: OwnedPack = {
    id: randomUUID(),
    packId,
    universe,
    source,
    earnedAt: Date.now(),
  };
  db.prepare(
    "INSERT INTO packs (id, user_id, pack_id, universe, source, earned_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(pack.id, userId, packId, universe, source, pack.earnedAt);
  return pack;
}

/** Everything a finished match pays: packs, Berries, and the result row. */
export function payOutMatch(userId: string, won: boolean, universe: UniverseId = DEFAULT_UNIVERSE): {
  packs: OwnedPack[];
  berries: number;
} {
  return db.transaction(() => {
    const packs = (won ? MATCH_REWARDS.winner : MATCH_REWARDS.loser).map(packId =>
      grantPack(userId, packId, won ? "matchWin" : "matchLoss", universe),
    );
    const berries = berriesForMatch(won);
    moveCurrency(userId, "berries", berries, "matchReward", won ? "win" : "loss");
    return { packs, berries };
  })();
}

/**
 * What a new account starts with. Without this the first thing a player sees is
 * an empty binder and a shop they cannot afford, which is a poor way in.
 */
export const STARTER = {
  packs: ["goldCard", "goldCard", "goldCard", "goldCosmetic"] as PackId[],
  berries: 500,
};

export function grantStarter(userId: string, universe: UniverseId = DEFAULT_UNIVERSE): void {
  db.transaction(() => {
    for (const packId of STARTER.packs) grantPack(userId, packId, "purchase", universe);
    moveCurrency(userId, "berries", STARTER.berries, "matchReward", "welcome");
  })();
}

export function buyPack(
  userId: string,
  packId: PackId,
  universe: UniverseId = DEFAULT_UNIVERSE,
): OwnedPack {
  const price = PACKS[packId].price;
  if (price === null) throw new Error(`${PACKS[packId].name} is not for sale`);

  return db.transaction(() => {
    moveCurrency(userId, "berries", -price, "packPurchase", packId);
    return grantPack(userId, packId, "purchase", universe);
  })();
}

/**
 * Rolls a pack and files what came out. The whole thing is one transaction: a
 * pack is either opened and its cards owned, or neither.
 */
export function openOwnedPack(userId: string, packRowId: string): OpenedPack {
  return db.transaction(() => {
    const row = db.prepare("SELECT * FROM packs WHERE id = ? AND user_id = ?").get(packRowId, userId) as
      | PackRow
      | undefined;
    if (!row) throw new Error("No such pack");
    if (row.opened_at !== null) throw new Error("That pack is already open");

    const universe = row.universe as UniverseId;
    const seed = randomSeed();
    const result = openPack(row.pack_id as PackId, Object.keys(cardsFor(universe)), seed);

    const isNew = result.pulls.map(pull => {
      if (pull.kind !== "card") return false;
      return addPrint(userId, pull.cardId, pull.print);
    });

    db.prepare("UPDATE packs SET opened_at = ?, seed = ?, contents = ? WHERE id = ?")
      .run(Date.now(), seed, JSON.stringify(result.pulls), packRowId);

    return { id: packRowId, packId: row.pack_id as PackId, seed, pulls: result.pulls, isNew };
  })();
}

/** Replays an opened pack from its stored seed, to prove it was what it was. */
export function replayPack(userId: string, packRowId: string): OpenedPack | null {
  const row = db.prepare("SELECT * FROM packs WHERE id = ? AND user_id = ?").get(packRowId, userId) as
    | PackRow
    | undefined;
  if (!row || row.opened_at === null || row.seed === null) return null;

  const result = openPack(
    row.pack_id as PackId,
    Object.keys(cardsFor(row.universe as UniverseId)),
    row.seed,
  );
  return {
    id: row.id,
    packId: row.pack_id as PackId,
    seed: row.seed,
    pulls: result.pulls,
    isNew: result.pulls.map(() => false),
  };
}

// ── Decks ────────────────────────────────────────────────────────────────────

export interface StoredDeck {
  id: string;
  name: string;
  leaderId: string | null;
  cardIds: string[];
  prints: Record<string, PrintId>;
  updatedAt: number;
}

export function decksOf(userId: string): StoredDeck[] {
  const rows = db.prepare("SELECT body FROM decks WHERE user_id = ? ORDER BY updated_at")
    .all(userId) as { body: string }[];
  return rows.flatMap(r => {
    try {
      return [JSON.parse(r.body) as StoredDeck];
    } catch {
      // A row that will not parse is worth skipping rather than crashing a load
      return [];
    }
  });
}

export function saveDeck(userId: string, deck: StoredDeck): void {
  const body = JSON.stringify({ ...deck, updatedAt: Date.now() });
  db.prepare(
    `INSERT INTO decks (id, user_id, body, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at
     WHERE decks.user_id = excluded.user_id`,
  ).run(deck.id, userId, body, Date.now());
}

export function deleteDeck(userId: string, id: string): void {
  db.prepare("DELETE FROM decks WHERE id = ? AND user_id = ?").run(id, userId);
}
