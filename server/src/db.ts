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

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_results_user  ON results(user_id);
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
