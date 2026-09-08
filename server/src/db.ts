import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// SQLite for now. Everything goes through this file, so swapping to Postgres
// later means rewriting one module rather than hunting queries all over.

// Resolved against this file rather than the working directory. npm runs a
// workspace script from the package folder, so a relative default landed the
// database in server/server/data depending on where it was started from.
const DEFAULT_DB = fileURLToPath(new URL("../data/cardgame.db", import.meta.url));
const DB_PATH = process.env.DB_PATH ?? DEFAULT_DB;

function open() {
  if (DB_PATH !== ":memory:") mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export const db = open();

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );

  -- One row per card a user owns. dupes drives ascension, kills drives the
  -- kill marks on the card.
  CREATE TABLE IF NOT EXISTS collection (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    def_id  TEXT NOT NULL,
    dupes   INTEGER NOT NULL DEFAULT 0,
    kills   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, def_id)
  );

  CREATE TABLE IF NOT EXISTS results (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opponent   TEXT NOT NULL,
    won        INTEGER NOT NULL,
    turns      INTEGER NOT NULL,
    played_at  INTEGER NOT NULL
  );

  -- ── Prints ────────────────────────────────────────────────────────────────
  -- What a player owns, keyed by card and print together, because the same card
  -- in two treatments is two different things to own. The copies column is the
  -- whole holding: one means no spares, and scrapping never takes it below one.
  CREATE TABLE IF NOT EXISTS prints (
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id  TEXT NOT NULL,
    print_id TEXT NOT NULL,
    copies   INTEGER NOT NULL DEFAULT 0,
    first_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, card_id, print_id)
  );

  -- Packs a player has been given or has bought but not yet opened. A pack is
  -- rolled when it is opened, not when it is earned, so nothing is decided
  -- before the player is watching.
  CREATE TABLE IF NOT EXISTS packs (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pack_id     TEXT NOT NULL,
    universe    TEXT NOT NULL,
    source      TEXT NOT NULL,
    earned_at   INTEGER NOT NULL,
    opened_at   INTEGER,
    -- Kept after opening so the exact pack can be replayed and shown again
    seed        INTEGER,
    contents    TEXT
  );

  -- Berries and Stardust. Balance plus a log, because a balance on its own
  -- cannot answer where it went.
  CREATE TABLE IF NOT EXISTS wallets (
    user_id  TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    berries  INTEGER NOT NULL DEFAULT 0,
    stardust INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS ledger (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency TEXT NOT NULL,
    amount   INTEGER NOT NULL,
    reason   TEXT NOT NULL,
    note     TEXT,
    at       INTEGER NOT NULL
  );

  -- A saved deck. Stored as JSON because a deck is only ever read and written
  -- whole, and there is nothing to query inside it.
  CREATE TABLE IF NOT EXISTS decks (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Where a player sits on the ladder. Separate from users so it can be reset
  -- for a season without touching an account, and so a streak is counted as it
  -- happens rather than derived from the whole result history on every read.
  CREATE TABLE IF NOT EXISTS ranking (
    user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    mmr         INTEGER NOT NULL DEFAULT 0,
    peak_mmr    INTEGER NOT NULL DEFAULT 0,
    wins        INTEGER NOT NULL DEFAULT 0,
    losses      INTEGER NOT NULL DEFAULT 0,
    streak      INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    updated_at  INTEGER NOT NULL
  );

  -- Cosmetics a player owns. No count: a title is a title, you either have it
  -- or you do not, and a second copy would mean nothing.
  CREATE TABLE IF NOT EXISTS cosmetics (
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cosmetic_id TEXT NOT NULL,
    earned_at   INTEGER NOT NULL,
    PRIMARY KEY (user_id, cosmetic_id)
  );

  -- What a player is currently wearing, plus the cards they are showing off.
  -- One row per player, all columns nullable, because a fresh account wears
  -- nothing and that is a valid profile rather than a broken one.
  CREATE TABLE IF NOT EXISTS profiles (
    user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    icon_id    TEXT,
    title_id   TEXT,
    banner_id  TEXT,
    border_id  TEXT,
    showcase   TEXT,
    updated_at INTEGER NOT NULL
  );

  -- A trade in progress. Both offers live here rather than in memory so a
  -- restart cannot lose one halfway through, and so the confirmations are
  -- stored next to the offer they were given for.
  CREATE TABLE IF NOT EXISTS trades (
    id         TEXT PRIMARY KEY,
    code       TEXT NOT NULL,
    a_user     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    b_user     TEXT REFERENCES users(id) ON DELETE CASCADE,
    a_offer    TEXT NOT NULL,
    b_offer    TEXT NOT NULL,
    a_ok       INTEGER NOT NULL DEFAULT 0,
    b_ok       INTEGER NOT NULL DEFAULT 0,
    state      TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    closed_at  INTEGER
  );

  -- Every completed trade, written once and never touched again. A trade moves
  -- things that took real time to get, so what was swapped has to outlive the
  -- trade row itself.
  CREATE TABLE IF NOT EXISTS trade_log (
    id       TEXT PRIMARY KEY,
    trade_id TEXT NOT NULL,
    a_user   TEXT NOT NULL,
    b_user   TEXT NOT NULL,
    a_name   TEXT NOT NULL,
    b_name   TEXT NOT NULL,
    a_offer  TEXT NOT NULL,
    b_offer  TEXT NOT NULL,
    at       INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_trades_a      ON trades(a_user, state);
  CREATE INDEX IF NOT EXISTS idx_trades_b      ON trades(b_user, state);
  CREATE INDEX IF NOT EXISTS idx_trade_log_a   ON trade_log(a_user, at);
  CREATE INDEX IF NOT EXISTS idx_trade_log_b   ON trade_log(b_user, at);
  CREATE INDEX IF NOT EXISTS idx_cosmetics_user ON cosmetics(user_id);
  CREATE INDEX IF NOT EXISTS idx_ranking_mmr   ON ranking(mmr DESC);
  CREATE INDEX IF NOT EXISTS idx_decks_user    ON decks(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_results_user  ON results(user_id);
  CREATE INDEX IF NOT EXISTS idx_prints_user   ON prints(user_id);
  CREATE INDEX IF NOT EXISTS idx_packs_user    ON packs(user_id, opened_at);
  CREATE INDEX IF NOT EXISTS idx_ledger_user   ON ledger(user_id, at);
`);

/**
 * Adds a column to a table that already exists. CREATE TABLE IF NOT EXISTS
 * only ever runs once, so a schema change needs saying twice: in the statement
 * above for a new database, and here for one that is already on disk.
 */
function addColumn(table: string, column: string, type: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

addColumn("profiles", "icon_id", "TEXT");

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: number;
}

export interface CollectionRow {
  def_id: string;
  dupes: number;
  kills: number;
}

export interface PrintRow {
  card_id: string;
  print_id: string;
  copies: number;
  first_at: number;
}

export interface PackRow {
  id: string;
  user_id: string;
  pack_id: string;
  universe: string;
  source: string;
  earned_at: number;
  opened_at: number | null;
  seed: number | null;
  contents: string | null;
}

export interface WalletRow {
  berries: number;
  stardust: number;
}

export interface ProfileRow {
  user_id: string;
  icon_id: string | null;
  title_id: string | null;
  banner_id: string | null;
  border_id: string | null;
  showcase: string | null;
  updated_at: number;
}

export interface TradeRow {
  id: string;
  code: string;
  a_user: string;
  b_user: string | null;
  a_offer: string;
  b_offer: string;
  a_ok: number;
  b_ok: number;
  state: string;
  created_at: number;
  updated_at: number;
  closed_at: number | null;
}

export interface RankingRow {
  user_id: string;
  mmr: number;
  peak_mmr: number;
  wins: number;
  losses: number;
  streak: number;
  best_streak: number;
  updated_at: number;
}
