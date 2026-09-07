import { randomUUID, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db, type UserRow, type CollectionRow } from "./db.js";

export interface PublicUser {
  id: string;
  username: string;
  wins: number;
  losses: number;
}

export class AuthError extends Error {}

const MIN_NAME = 3;
const MIN_PASSWORD = 8;

function publicUser(row: UserRow): PublicUser {
  const tally = db
    .prepare(`SELECT
        COALESCE(SUM(won), 0)          AS wins,
        COALESCE(SUM(1 - won), 0)      AS losses
      FROM results WHERE user_id = ?`)
    .get(row.id) as { wins: number; losses: number };
  return { id: row.id, username: row.username, wins: tally.wins, losses: tally.losses };
}

export function register(username: string, password: string): { token: string; user: PublicUser } {
  const name = username.trim();
  if (name.length < MIN_NAME) throw new AuthError(`Username needs at least ${MIN_NAME} characters`);
  if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new AuthError("Username can only use letters, numbers and underscores");
  if (password.length < MIN_PASSWORD) throw new AuthError(`Password needs at least ${MIN_PASSWORD} characters`);

  const taken = db.prepare("SELECT 1 FROM users WHERE username = ?").get(name);
  if (taken) throw new AuthError("That username is taken");

  const row: UserRow = {
    id: randomUUID(),
    username: name,
    password_hash: bcrypt.hashSync(password, 10),
    created_at: Date.now(),
  };
  db.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)")
    .run(row.id, row.username, row.password_hash, row.created_at);

  return { token: createSession(row.id), user: publicUser(row) };
}

export function login(username: string, password: string): { token: string; user: PublicUser } {
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username.trim()) as UserRow | undefined;
  // Same message either way, so this cannot be used to probe which names exist
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    throw new AuthError("Wrong username or password");
  }
  return { token: createSession(row.id), user: publicUser(row) };
}

function createSession(userId: string): string {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)")
    .run(token, userId, Date.now());
  return token;
}

export function userForToken(token: string | undefined): PublicUser | null {
  if (!token) return null;
  const row = db
    .prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?")
    .get(token) as UserRow | undefined;
  return row ? publicUser(row) : null;
}

export function logout(token: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

// ── Collection ───────────────────────────────────────────────────────────────

export function getCollection(userId: string): CollectionRow[] {
  return db.prepare("SELECT def_id, dupes, kills FROM collection WHERE user_id = ?")
    .all(userId) as CollectionRow[];
}

// Adding a card you already own bumps its duplicate count instead.
export function addCards(userId: string, defIds: string[]): void {
  const stmt = db.prepare(`
    INSERT INTO collection (user_id, def_id, dupes, kills) VALUES (?, ?, 0, 0)
    ON CONFLICT(user_id, def_id) DO UPDATE SET dupes = dupes + 1
  `);
  const tx = db.transaction((ids: string[]) => ids.forEach(id => stmt.run(userId, id)));
  tx(defIds);
}

export function recordResult(userId: string, opponent: string, won: boolean, turns: number): void {
  db.prepare("INSERT INTO results (id, user_id, opponent, won, turns, played_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), userId, opponent, won ? 1 : 0, turns, Date.now());
}
