import { describe, it, expect, beforeEach } from "vitest";
import { RANKS, WIN_VALUE, MASTER_FLOOR, rankForMmr } from "@cg/meta";
import { db } from "./db.js";
import { rankingOf, applyResult, leaderboard, standingOf } from "./ranking.js";

let seq = 0;
function freshUser(name?: string): string {
  const id = `r${++seq}-${Math.random().toString(36).slice(2)}`;
  db.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)")
    .run(id, name ?? id, "x", Date.now());
  return id;
}

/** Drives a player up the ladder without pretending to play matches. */
function climbTo(userId: string, mmr: number): void {
  db.prepare("UPDATE ranking SET mmr = ?, peak_mmr = ?, wins = 1 WHERE user_id = ?")
    .run(mmr, mmr, userId);
}

let user: string;
beforeEach(() => {
  user = freshUser();
  rankingOf(user);
});

describe("a place on the ladder", () => {
  it("starts everyone at the bottom", () => {
    const start = rankingOf(freshUser());
    expect(start.mmr).toBe(0);
    expect(start.wins).toBe(0);
    expect(rankForMmr(start.mmr).id).toBe("iron");
  });

  it("pays a win and charges a loss", () => {
    const win = applyResult(user, true);
    expect(win.delta).toBe(WIN_VALUE);
    expect(win.after).toBe(WIN_VALUE);

    const loss = applyResult(user, false);
    expect(loss.delta).toBeLessThan(0);
    expect(loss.after).toBe(WIN_VALUE - 5);
  });

  it("never drops below zero, however many losses", () => {
    for (let i = 0; i < 10; i++) applyResult(user, false);
    expect(rankingOf(user).mmr).toBe(0);
  });

  it("charges more the higher the rank", () => {
    climbTo(user, 130);
    expect(applyResult(user, false).delta).toBe(-7);
    climbTo(user, 260);
    expect(applyResult(user, false).delta).toBe(-8);
  });

  it("says when a rank was crossed, and stays quiet otherwise", () => {
    climbTo(user, 25);
    const up = applyResult(user, true);
    expect(up.rankedUp).toBe(true);
    expect(up.rankName).toBe("Bronze");

    const flat = applyResult(user, true);
    expect(flat.rankedUp).toBe(false);
  });

  it("counts wins in a row, and forgets them on a loss", () => {
    applyResult(user, true);
    applyResult(user, true);
    expect(applyResult(user, true).streak).toBe(3);
    expect(rankingOf(user).best_streak).toBe(3);

    expect(applyResult(user, false).streak).toBe(0);
    // The best is kept even once the run is over
    expect(rankingOf(user).best_streak).toBe(3);
  });

  it("remembers the highest it ever reached", () => {
    climbTo(user, 200);
    applyResult(user, true);
    for (let i = 0; i < 10; i++) applyResult(user, false);
    const row = rankingOf(user);
    expect(row.peak_mmr).toBe(210);
    expect(row.mmr).toBeLessThan(row.peak_mmr);
  });

  it("keeps wins and losses apart from MMR", () => {
    applyResult(user, true);
    applyResult(user, false);
    applyResult(user, false);
    const row = rankingOf(user);
    expect(row.wins).toBe(1);
    expect(row.losses).toBe(2);
  });
});

describe("the leaderboard", () => {
  it("leaves out anyone who has not played", () => {
    const idle = freshUser();
    rankingOf(idle);
    expect(leaderboard().map(s => s.userId)).not.toContain(idle);
  });

  it("orders by MMR, best first", () => {
    const a = freshUser(); const b = freshUser(); const c = freshUser();
    rankingOf(a); rankingOf(b); rankingOf(c);
    climbTo(a, 300); climbTo(b, 500); climbTo(c, 100);
    const order = leaderboard().map(s => s.userId);
    expect(order.indexOf(b)).toBeLessThan(order.indexOf(a));
    expect(order.indexOf(a)).toBeLessThan(order.indexOf(c));
  });

  it("hands Pirate King to one and Emperor to four, and nothing below Master", () => {
    const players = Array.from({ length: 8 }, () => freshUser());
    players.forEach((id, i) => { rankingOf(id); climbTo(id, 400 - i * 10); });

    const top = leaderboard().filter(s => s.mmr >= MASTER_FLOOR);
    expect(top[0].topRank).toBe("pirateKing");
    expect(top.slice(1, 5).every(s => s.topRank === "emperor")).toBe(true);
    expect(top.slice(5).every(s => s.topRank === null)).toBe(true);
  });

  it("gives nobody below Master a leaderboard seat, even in first place", () => {
    const only = freshUser();
    rankingOf(only);
    climbTo(only, MASTER_FLOOR - 1);
    const row = leaderboard().find(s => s.userId === only);
    expect(row?.topRank).toBeNull();
    expect(row?.position).toBeNull();
  });

  it("covers every threshold rank with no gaps", () => {
    for (const rank of RANKS) {
      const id = freshUser();
      rankingOf(id);
      climbTo(id, rank.floor);
      expect(standingOf(id).rank).toBe(rank.id);
    }
  });
});

describe("one player's standing", () => {
  it("works for someone who has never played", () => {
    const standing = standingOf(freshUser());
    expect(standing.mmr).toBe(0);
    expect(standing.rank).toBe("iron");
    expect(standing.position).toBeNull();
  });

  it("agrees with the leaderboard about who is on top", () => {
    const a = freshUser(); const b = freshUser();
    rankingOf(a); rankingOf(b);
    climbTo(a, 900); climbTo(b, 800);
    expect(standingOf(a).topRank).toBe("pirateKing");
    expect(standingOf(b).topRank).toBe("emperor");
    expect(leaderboard()[0].userId).toBe(a);
  });
});
