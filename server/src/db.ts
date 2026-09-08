import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

// SQLite for now. Everything goes through this file, so swapping to Postgres
// later means rewriting one module rather than hunting queries all over.

const DB_PATH = process.env.DB_PATH ?? "server/data/cardgame.db";

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

  CREATE INDEX IF NOT EXISTS idx_decks_user    ON decks(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_results_user  ON results(user_id);
  CREATE INDEX IF NOT EXISTS idx_prints_user   ON prints(user_id);
  CREATE INDEX IF NOT EXISTS idx_packs_user    ON packs(user_id, opened_at);
  CREATE INDEX IF NOT EXISTS idx_ledger_user   ON ledger(user_id, at);
`);

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
