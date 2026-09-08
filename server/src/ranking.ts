import {
  STARTING_MMR, nextMmr, rankForMmr, leaderboardRank, MASTER_FLOOR,
  type RankId,
} from "@cg/meta";
import { db, type RankingRow } from "./db.js";

/**
 * The ladder.
 *
 * MMR is kept here rather than derived from the results table, because a streak
 * has to be counted as it happens: replaying every match a player has ever
 * played to find out whether they are on three in a row is the kind of query
 * that is fine at ten players and hopeless at ten thousand.
 *
 * Emperor and Pirate King are not stored at all. They are a position on the
 * leaderboard, so they are worked out at read time and can change because
 * somebody else played, not because you did.
 */

export interface Standing {
  userId: string;
  username: string;
  mmr: number;
  peakMmr: number;
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  /** The threshold rank, before any leaderboard placing is applied. */
  rank: RankId;
  rankName: string;
  /** Set only for the five seats decided by the leaderboard. */
  topRank: RankId | null;
  /** Zero based, among everyone at or above the Master floor. Null below it. */
  position: number | null;
}

export function rankingOf(userId: string): RankingRow {
  const row = db.prepare("SELECT * FROM ranking WHERE user_id = ?").get(userId) as RankingRow | undefined;
  if (row) return row;
  const fresh: RankingRow = {
    user_id: userId,
    mmr: STARTING_MMR,
    peak_mmr: STARTING_MMR,
    wins: 0,
    losses: 0,
    streak: 0,
    best_streak: 0,
    updated_at: Date.now(),
  };
  db.prepare(
    `INSERT OR IGNORE INTO ranking (user_id, mmr, peak_mmr, wins, losses, streak, best_streak, updated_at)
     VALUES (?, ?, ?, 0, 0, 0, 0, ?)`,
  ).run(userId, fresh.mmr, fresh.peak_mmr, fresh.updated_at);
  return fresh;
}

export interface RankChange {
  before: number;
  after: number;
  /** Positive on a win, negative on a loss. */
  delta: number;
  rankedUp: boolean;
  rankedDown: boolean;
  rank: RankId;
  rankName: string;
  streak: number;
}

/** Applies a finished match. Returns what moved, so the client can say so. */
export function applyResult(userId: string, won: boolean): RankChange {
  return db.transaction(() => {
    const row = rankingOf(userId);
    const before = row.mmr;
    const after = nextMmr(before, won);
    // A streak counts wins in a row. A loss resets it rather than going negative:
    // a losing run is not something to put on the feed.
    const streak = won ? row.streak + 1 : 0;

    db.prepare(
      `UPDATE ranking SET
         mmr = ?, peak_mmr = ?, wins = ?, losses = ?, streak = ?, best_streak = ?, updated_at = ?
       WHERE user_id = ?`,
    ).run(
      after,
      Math.max(row.peak_mmr, after),
      row.wins + (won ? 1 : 0),
      row.losses + (won ? 0 : 1),
      streak,
      Math.max(row.best_streak, streak),
      Date.now(),
      userId,
    );

    const from = rankForMmr(before);
    const to = rankForMmr(after);
    return {
      before,
      after,
      delta: after - before,
      rankedUp: to.floor > from.floor,
      rankedDown: to.floor < from.floor,
      rank: to.id,
      rankName: to.name,
      streak,
    };
  })();
}

interface Row {
  user_id: string;
  username: string;
  mmr: number;
  peak_mmr: number;
  wins: number;
  losses: number;
  streak: number;
  best_streak: number;
}

function toStanding(row: Row, position: number | null): Standing {
  const rank = rankForMmr(row.mmr);
  return {
    userId: row.user_id,
    username: row.username,
    mmr: row.mmr,
    peakMmr: row.peak_mmr,
    wins: row.wins,
    losses: row.losses,
    streak: row.streak,
    bestStreak: row.best_streak,
    rank: rank.id,
    rankName: rank.name,
    topRank: position === null ? null : leaderboardRank(position, row.mmr),
    position,
  };
}

/** The ladder, best first. Only players who have actually played show up. */
export function leaderboard(limit = 50): Standing[] {
  const rows = db
    .prepare(
      `SELECT r.user_id, u.username, r.mmr, r.peak_mmr, r.wins, r.losses, r.streak, r.best_streak
       FROM ranking r
       JOIN users u ON u.id = r.user_id
       WHERE r.wins + r.losses > 0
       ORDER BY r.mmr DESC, r.peak_mmr DESC, u.username ASC
       LIMIT ?`,
    )
    .all(limit) as Row[];

  // Only players at or above the Master floor can hold a leaderboard rank, so
  // the position that decides it counts them and nobody else.
  let masterPosition = 0;
  return rows.map(row => {
    const position = row.mmr >= MASTER_FLOOR ? masterPosition++ : null;
    return toStanding(row, position);
  });
}

/** One player's standing, with their place on the ladder if they have one. */
export function standingOf(userId: string): Standing {
  const row = db
    .prepare(
      `SELECT r.user_id, u.username, r.mmr, r.peak_mmr, r.wins, r.losses, r.streak, r.best_streak
       FROM ranking r JOIN users u ON u.id = r.user_id WHERE r.user_id = ?`,
    )
    .get(userId) as Row | undefined;

  if (!row) {
    rankingOf(userId);
    const username = (db.prepare("SELECT username FROM users WHERE id = ?").get(userId) as
      | { username: string }
      | undefined)?.username ?? "Player";
    return toStanding(
      { user_id: userId, username, mmr: STARTING_MMR, peak_mmr: STARTING_MMR, wins: 0, losses: 0, streak: 0, best_streak: 0 },
      null,
    );
  }

  if (row.mmr < MASTER_FLOOR) return toStanding(row, null);

  // Below Master the position is not worth counting; at or above it, it decides
  // whether this is an Emperor seat.
  const ahead = db
    .prepare(
      `SELECT COUNT(*) AS n FROM ranking r JOIN users u ON u.id = r.user_id
       WHERE r.wins + r.losses > 0 AND r.mmr >= ?
         AND (r.mmr > ? OR (r.mmr = ? AND (r.peak_mmr > ? OR (r.peak_mmr = ? AND u.username < ?))))`,
    )
    .get(MASTER_FLOOR, row.mmr, row.mmr, row.peak_mmr, row.peak_mmr, row.username) as { n: number };

  return toStanding(row, ahead.n);
}
