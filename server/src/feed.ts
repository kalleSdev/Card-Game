import { randomUUID } from "node:crypto";
import { PRINT_INFO, type PrintId, type RankId } from "@cg/meta";
import { db } from "./db.js";

/**
 * The global feed.
 *
 * Everything worth telling the room about: matches finishing, streaks running,
 * ranks changing, rare prints coming out of packs and trades landing.
 *
 * Written at the moment it happens rather than worked out from the other
 * tables, for two reasons. Some of it cannot be reconstructed later at all — a
 * pull is only rare relative to the table it was rolled against — and the rest
 * would need a join per row on a list that is read far more often than it is
 * written. A name is stored as it was, so nothing here changes retroactively.
 *
 * Posting is never allowed to break the thing being reported. Every writer goes
 * through post(), which swallows its own failures: a match that pays out but
 * does not make the feed is a far better outcome than the reverse.
 */

export type FeedKind = "match" | "streak" | "rank" | "pull" | "trade";

export interface FeedEntry {
  id: string;
  kind: FeedKind;
  userId: string | null;
  username: string;
  at: number;
  /** Shape depends on the kind. The client switches on kind to read it. */
  body: Record<string, unknown>;
}

/** How good a print has to be before the room hears about it. */
export const FEED_TIER = 5;

interface FeedRow {
  id: string;
  kind: string;
  user_id: string | null;
  username: string;
  body: string;
  at: number;
}

export function post(
  kind: FeedKind,
  user: { id: string | null; username: string },
  body: Record<string, unknown>,
): void {
  try {
    db.prepare("INSERT INTO feed (id, kind, user_id, username, body, at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(randomUUID(), kind, user.id, user.username, JSON.stringify(body), Date.now());
  } catch (err) {
    // Nothing that posts to the feed should fail because of the feed
    console.warn("feed write failed", kind, err);
  }
}

export function recent(limit = 50): FeedEntry[] {
  const rows = db
    // rowid breaks the tie: two things can land in the same millisecond, and
    // when they do the later one is still the later one.
    .prepare("SELECT * FROM feed ORDER BY at DESC, rowid DESC LIMIT ?")
    .all(Math.min(Math.max(limit, 1), 100)) as FeedRow[];

  return rows.map(row => {
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(row.body) as Record<string, unknown>;
    } catch {
      // An unreadable row is better shown bare than dropped
    }
    return {
      id: row.id,
      kind: row.kind as FeedKind,
      userId: row.user_id,
      username: row.username,
      at: row.at,
      body,
    };
  });
}

// ── The writers ──────────────────────────────────────────────────────────────

export function postMatch(
  user: { id: string; username: string },
  opponent: string,
  won: boolean,
  turns: number,
): void {
  post("match", user, { opponent, won, turns });
}

export function postStreak(user: { id: string; username: string }, streak: number): void {
  post("streak", user, { streak });
}

export function postRank(
  user: { id: string; username: string },
  rank: RankId,
  rankName: string,
  up: boolean,
  mmr: number,
): void {
  post("rank", user, { rank, rankName, up, mmr });
}

/** Only prints at or above FEED_TIER, so the feed stays worth reading. */
export function postPull(
  user: { id: string; username: string },
  cardId: string,
  print: PrintId,
): void {
  if (PRINT_INFO[print].tier < FEED_TIER) return;
  post("pull", user, { cardId, print, tier: PRINT_INFO[print].tier });
}

export function postTrade(
  a: { id: string; username: string },
  bName: string,
  aCards: number,
  bCards: number,
  aBerries: number,
  bBerries: number,
): void {
  post("trade", a, { with: bName, aCards, bCards, aBerries, bBerries });
}
