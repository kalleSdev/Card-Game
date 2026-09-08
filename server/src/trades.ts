import { randomUUID } from "node:crypto";
import { PRINTS, type PrintId } from "@cg/meta";
import { db, type TradeRow } from "./db.js";
import { copiesOf, moveCurrency } from "./packs.js";
import { normaliseCode } from "./lobbies.js";
import { postTrade } from "./feed.js";

/**
 * Player to player trading.
 *
 * Two rules carry the whole module.
 *
 * Editing an offer clears both confirmations. Without that, the oldest scam in
 * the genre works: swap your side for something worthless in the instant after
 * the other person clicks accept. Every confirmation here belongs to the exact
 * pair of offers that were on the table when it was given.
 *
 * The swap is one transaction. Ownership is checked again inside it, because
 * anything could have been scrapped, crafted or spent between the confirmation
 * and the commit, and a trade that half happens would either duplicate or
 * destroy something.
 */

export interface OfferLine {
  cardId: string;
  print: PrintId;
  count: number;
}

export interface Offer {
  prints: OfferLine[];
  berries: number;
}

export type TradeState = "open" | "done" | "cancelled";

export interface Trade {
  id: string;
  code: string;
  state: TradeState;
  /** Always the reader's own side, so a client never has to work out which it is. */
  you: { userId: string; username: string; offer: Offer; confirmed: boolean };
  them: { userId: string; username: string; offer: Offer; confirmed: boolean } | null;
  createdAt: number;
  updatedAt: number;
}

export interface TradeLogEntry {
  id: string;
  at: number;
  /** What the reader gave and got, rather than which side of the table they sat on. */
  gave: Offer;
  got: Offer;
  withName: string;
}

const EMPTY: Offer = { prints: [], berries: 0 };
const MAX_LINES = 12;
const CODE_LENGTH = 5;
const ALPHABET = "ABCDFGHJKLMNPQRSTVWXYZ23456789";

// ── Reading ──────────────────────────────────────────────────────────────────

function parse(body: string): Offer {
  try {
    const raw = JSON.parse(body) as Partial<Offer>;
    return {
      prints: Array.isArray(raw.prints) ? raw.prints : [],
      berries: typeof raw.berries === "number" ? raw.berries : 0,
    };
  } catch {
    return { ...EMPTY };
  }
}

function nameOf(userId: string): string {
  const row = db.prepare("SELECT username FROM users WHERE id = ?").get(userId) as
    | { username: string }
    | undefined;
  return row?.username ?? "Someone";
}

function view(row: TradeRow, userId: string): Trade {
  const youAreA = row.a_user === userId;
  const themId = youAreA ? row.b_user : row.a_user;
  return {
    id: row.id,
    code: row.code,
    state: row.state as TradeState,
    you: {
      userId,
      username: nameOf(userId),
      offer: parse(youAreA ? row.a_offer : row.b_offer),
      confirmed: (youAreA ? row.a_ok : row.b_ok) === 1,
    },
    them: themId
      ? {
          userId: themId,
          username: nameOf(themId),
          offer: parse(youAreA ? row.b_offer : row.a_offer),
          confirmed: (youAreA ? row.b_ok : row.a_ok) === 1,
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowFor(tradeId: string, userId: string): TradeRow {
  const row = db.prepare("SELECT * FROM trades WHERE id = ?").get(tradeId) as TradeRow | undefined;
  if (!row) throw new Error("No such trade");
  if (row.a_user !== userId && row.b_user !== userId) throw new Error("That trade is not yours");
  return row;
}

/** The one trade a player has going, if any. Only ever one at a time. */
export function openTradeFor(userId: string): Trade | null {
  const row = db
    .prepare("SELECT * FROM trades WHERE state = 'open' AND (a_user = ? OR b_user = ?) ORDER BY created_at DESC")
    .get(userId, userId) as TradeRow | undefined;
  return row ? view(row, userId) : null;
}

export function historyFor(userId: string, limit = 20): TradeLogEntry[] {
  const rows = db
    .prepare(
      `SELECT * FROM trade_log WHERE a_user = ? OR b_user = ? ORDER BY at DESC LIMIT ?`,
    )
    .all(userId, userId, limit) as {
    id: string;
    a_user: string;
    b_user: string;
    a_name: string;
    b_name: string;
    a_offer: string;
    b_offer: string;
    at: number;
  }[];

  return rows.map(r => {
    const youAreA = r.a_user === userId;
    return {
      id: r.id,
      at: r.at,
      gave: parse(youAreA ? r.a_offer : r.b_offer),
      got: parse(youAreA ? r.b_offer : r.a_offer),
      withName: youAreA ? r.b_name : r.a_name,
    };
  });
}

// ── Opening and joining ──────────────────────────────────────────────────────

function newCode(): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    const taken = db.prepare("SELECT 1 FROM trades WHERE code = ? AND state = 'open'").get(code);
    if (!taken) return code;
  }
  throw new Error("Could not find a free trade code");
}

/** Opens a table and hands back a code to give to the other person. */
export function openTrade(userId: string): Trade {
  if (openTradeFor(userId)) throw new Error("You already have a trade open");

  const now = Date.now();
  const row: TradeRow = {
    id: randomUUID(),
    code: newCode(),
    a_user: userId,
    b_user: null,
    a_offer: JSON.stringify(EMPTY),
    b_offer: JSON.stringify(EMPTY),
    a_ok: 0,
    b_ok: 0,
    state: "open",
    created_at: now,
    updated_at: now,
    closed_at: null,
  };
  db.prepare(
    `INSERT INTO trades (id, code, a_user, b_user, a_offer, b_offer, a_ok, b_ok, state, created_at, updated_at)
     VALUES (@id, @code, @a_user, @b_user, @a_offer, @b_offer, 0, 0, 'open', @created_at, @updated_at)`,
  ).run(row);
  return view(row, userId);
}

export function joinTrade(userId: string, code: string): Trade {
  if (openTradeFor(userId)) throw new Error("You already have a trade open");

  const row = db
    .prepare("SELECT * FROM trades WHERE code = ? AND state = 'open'")
    .get(normaliseCode(code)) as TradeRow | undefined;
  if (!row) throw new Error("No trade with that code");
  if (row.b_user) throw new Error("Somebody is already at that table");
  if (row.a_user === userId) throw new Error("That is your own trade");

  db.prepare("UPDATE trades SET b_user = ?, updated_at = ? WHERE id = ?")
    .run(userId, Date.now(), row.id);
  return view({ ...row, b_user: userId }, userId);
}

export function cancelTrade(userId: string, tradeId: string): void {
  const row = rowFor(tradeId, userId);
  if (row.state !== "open") throw new Error("That trade is already closed");
  db.prepare("UPDATE trades SET state = 'cancelled', closed_at = ?, updated_at = ? WHERE id = ?")
    .run(Date.now(), Date.now(), tradeId);
}

// ── Offering ─────────────────────────────────────────────────────────────────

/** Keeps only lines the player can actually back, and folds duplicates together. */
function clean(offer: Offer): Offer {
  const berries = Math.max(0, Math.floor(offer.berries ?? 0));

  const merged = new Map<string, OfferLine>();
  for (const line of offer.prints ?? []) {
    if (typeof line?.cardId !== "string" || !(PRINTS as readonly string[]).includes(line?.print)) {
      throw new Error("That is not a card you can offer");
    }
    const key = `${line.cardId}:${line.print}`;
    const count = Math.max(1, Math.floor(line.count ?? 1));
    const existing = merged.get(key);
    if (existing) existing.count += count;
    else merged.set(key, { cardId: line.cardId, print: line.print, count });
  }
  if (merged.size > MAX_LINES) throw new Error(`That is more than ${MAX_LINES} kinds of card`);

  return { prints: [...merged.values()], berries };
}

/** Throws unless the player still holds every card and Berry they promised. */
function checkBacked(userId: string, offer: Offer): void {
  for (const line of offer.prints) {
    if (copiesOf(userId, line.cardId, line.print) < line.count) {
      throw new Error("Somebody no longer owns what they offered");
    }
  }
  if (offer.berries > 0) {
    const wallet = db.prepare("SELECT berries FROM wallets WHERE user_id = ?").get(userId) as
      | { berries: number }
      | undefined;
    if ((wallet?.berries ?? 0) < offer.berries) throw new Error("Somebody no longer has the Berries");
  }
}

/**
 * Replaces one side of the table. Both confirmations are cleared, always: a
 * confirmation means "these two offers", so the moment either changes it stops
 * meaning anything.
 */
export function setOffer(userId: string, tradeId: string, offer: Offer): Trade {
  const row = rowFor(tradeId, userId);
  if (row.state !== "open") throw new Error("That trade is already closed");

  const cleaned = clean(offer);
  checkBacked(userId, cleaned);

  const side = row.a_user === userId ? "a" : "b";
  db.prepare(
    `UPDATE trades SET ${side}_offer = ?, a_ok = 0, b_ok = 0, updated_at = ? WHERE id = ?`,
  ).run(JSON.stringify(cleaned), Date.now(), tradeId);

  return view(rowFor(tradeId, userId), userId);
}

// ── Committing ───────────────────────────────────────────────────────────────

function movePrint(from: string, to: string, line: OfferLine): void {
  const left = copiesOf(from, line.cardId, line.print) - line.count;
  if (left < 0) throw new Error("Somebody no longer owns what they offered");

  if (left === 0) {
    db.prepare("DELETE FROM prints WHERE user_id = ? AND card_id = ? AND print_id = ?")
      .run(from, line.cardId, line.print);
  } else {
    db.prepare("UPDATE prints SET copies = ? WHERE user_id = ? AND card_id = ? AND print_id = ?")
      .run(left, from, line.cardId, line.print);
  }

  db.prepare(
    `INSERT INTO prints (user_id, card_id, print_id, copies, first_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, card_id, print_id) DO UPDATE SET copies = copies + excluded.copies`,
  ).run(to, line.cardId, line.print, line.count, Date.now());
}

/**
 * Confirms this side, and runs the swap once both sides have. Returns the trade
 * as it now stands, so a client can tell "waiting on them" from "done".
 */
export function confirmTrade(userId: string, tradeId: string): Trade {
  return db.transaction(() => {
    const row = rowFor(tradeId, userId);
    if (row.state !== "open") throw new Error("That trade is already closed");
    if (!row.b_user) throw new Error("Nobody has joined yet");

    const side = row.a_user === userId ? "a" : "b";
    db.prepare(`UPDATE trades SET ${side}_ok = 1, updated_at = ? WHERE id = ?`)
      .run(Date.now(), tradeId);

    const now = db.prepare("SELECT * FROM trades WHERE id = ?").get(tradeId) as TradeRow;
    if (now.a_ok !== 1 || now.b_ok !== 1) return view(now, userId);

    const a = parse(now.a_offer);
    const b = parse(now.b_offer);
    const bUser = now.b_user as string;

    // Checked again here rather than trusted from when the offer was staged
    checkBacked(now.a_user, a);
    checkBacked(bUser, b);

    for (const line of a.prints) movePrint(now.a_user, bUser, line);
    for (const line of b.prints) movePrint(bUser, now.a_user, line);

    if (a.berries > 0) {
      moveCurrency(now.a_user, "berries", -a.berries, "trade", now.id);
      moveCurrency(bUser, "berries", a.berries, "trade", now.id);
    }
    if (b.berries > 0) {
      moveCurrency(bUser, "berries", -b.berries, "trade", now.id);
      moveCurrency(now.a_user, "berries", b.berries, "trade", now.id);
    }

    const at = Date.now();
    db.prepare(
      `INSERT INTO trade_log (id, trade_id, a_user, b_user, a_name, b_name, a_offer, b_offer, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(randomUUID(), now.id, now.a_user, bUser, nameOf(now.a_user), nameOf(bUser),
      now.a_offer, now.b_offer, at);

    db.prepare("UPDATE trades SET state = 'done', closed_at = ?, updated_at = ? WHERE id = ?")
      .run(at, at, tradeId);

    const count = (offer: Offer) => offer.prints.reduce((sum, line) => sum + line.count, 0);
    postTrade(
      { id: now.a_user, username: nameOf(now.a_user) },
      nameOf(bUser),
      count(a), count(b), a.berries, b.berries,
    );

    return view({ ...now, state: "done", closed_at: at, updated_at: at }, userId);
  })();
}
