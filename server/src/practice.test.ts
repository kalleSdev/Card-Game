import { describe, it, expect, beforeEach } from "vitest";
import {
  applyScoreIntent, createScoreMatch, scoreCardsFrom,
  type ScoreIntent, type ScorePlayer, type ScoreState,
} from "@cg/score";
import type { PlayerDraftResult } from "@cg/contracts";
import { createBattleState, playBotTurn, type BattleIntent } from "@cg/battle";
import { db } from "./db.js";
import { walletOf, unopenedPacks } from "./packs.js";
import { rankingOf } from "./ranking.js";
import { recent } from "./feed.js";
import { settleBattleMatch, settleScoreMatch, ReplayError } from "./practice.js";
import { cardsFor } from "./universes.js";

let seq = 0;
function freshUser(): { id: string; username: string } {
  const id = `p${++seq}-${Math.random().toString(36).slice(2)}`;
  db.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)")
    .run(id, id, "x", Date.now());
  db.prepare("INSERT OR IGNORE INTO wallets (user_id, berries, stardust) VALUES (?, 0, 0)").run(id);
  return { id, username: id };
}

const POOL = scoreCardsFrom(cardsFor("jjk"));
const SEED = 42;

/**
 * A whole Score match, played by taking the first thing available every turn,
 * with every intent written down the way the client writes them down.
 */
function playScoreMatch(): { intents: { intent: ScoreIntent; by: ScorePlayer }[]; state: ScoreState } {
  let state = createScoreMatch(POOL, SEED);
  const intents: { intent: ScoreIntent; by: ScorePlayer }[] = [];
  let guard = 0;

  while (!state.over && guard++ < 40) {
    const index = state.table.findIndex(slot => !slot.takenBy && !slot.denied);
    if (index < 0) break;

    const team = state.teams[state.turn];
    const seat = !team.captain
      ? { row: "captain" as const, index: 0 }
      : team.combat.findIndex(x => x === null) >= 0
        ? { row: "combat" as const, index: team.combat.findIndex(x => x === null) }
        : { row: "support" as const, index: team.support.findIndex(x => x === null) };

    const intent: ScoreIntent = { type: "TAKE", index, seat };
    const by = state.turn;
    state = applyScoreIntent(state, intent, by, POOL).state;
    intents.push({ intent, by });
  }

  return { intents, state };
}

const CARD_DB = cardsFor("jjk");

/** A deck built the same way every time, so the match below is repeatable. */
function draftFrom(offset: number): PlayerDraftResult {
  const ids = Object.keys(CARD_DB).sort();
  const by = (affinity: string, n: number) =>
    ids.filter(id => CARD_DB[id].affinity === affinity).slice(offset, offset + n);
  const combat = by("COMBAT", 5);
  const support = by("SUPPORT", 4);
  const rest = ids.filter(id => !combat.includes(id) && !support.includes(id)).slice(offset, offset + 3);
  return { leaderId: combat[0], combatIds: combat, supportIds: support, extraIds: rest, weaponIds: [] };
}

/** A whole card battle, both seats played by the bot, written down as it goes. */
function playBattleMatch(): { intents: BattleIntent[]; winner: string } {
  const p1 = draftFrom(0);
  const p2 = draftFrom(1);
  let state = createBattleState(p1, p2, CARD_DB, undefined, SEED);
  const intents: BattleIntent[] = [];
  let guard = 0;

  while (!state.winner && guard++ < 120) {
    const turn = playBotTurn(state, state.activePlayer, { plain: true });
    intents.push(...turn.intents);
    state = turn.state;
  }

  return { intents, winner: String(state.winner) };
}

let user: { id: string; username: string };

beforeEach(() => {
  db.exec("DELETE FROM feed");
  user = freshUser();
});

describe("settling a practice match", () => {
  it("replays the match and pays whoever actually won it", () => {
    const { intents, state } = playScoreMatch();
    const you: ScorePlayer = state.winner === "P1" ? "P1" : "P2";

    const payout = settleScoreMatch(user, { seed: SEED, intents, you }, "jjk");

    expect(payout.won).toBe(true);
    expect(payout.berries).toBeGreaterThan(0);
    expect(walletOf(user.id).berries).toBe(payout.berries);
    expect(unopenedPacks(user.id).length).toBe(payout.packs.length);
    expect(payout.packs.length).toBeGreaterThan(0);
  });

  it("pays a loss too, because a loss still opens something", () => {
    const { intents, state } = playScoreMatch();
    const loser: ScorePlayer = state.winner === "P1" ? "P2" : "P1";

    const payout = settleScoreMatch(user, { seed: SEED, intents, you: loser }, "jjk");
    expect(payout.won).toBe(false);
    expect(payout.packs).toHaveLength(1);
  });

  it("leaves the ladder alone: a bot is not evidence of anything", () => {
    const { intents, state } = playScoreMatch();
    const you: ScorePlayer = state.winner === "P1" ? "P1" : "P2";

    settleScoreMatch(user, { seed: SEED, intents, you }, "jjk");
    const rank = rankingOf(user.id);
    expect(rank.mmr).toBe(0);
    expect(rank.wins).toBe(0);
  });

  it("says so on the feed", () => {
    const { intents, state } = playScoreMatch();
    const you: ScorePlayer = state.winner === "P1" ? "P1" : "P2";

    settleScoreMatch(user, { seed: SEED, intents, you }, "jjk");
    const [entry] = recent();
    expect(entry).toMatchObject({ kind: "match", username: user.username });
    expect(entry.body).toMatchObject({ opponent: "the computer", won: true });
  });

  it("refuses a match that does not replay", () => {
    const { intents } = playScoreMatch();
    // The same intents against a different deal cannot possibly be legal
    expect(() => settleScoreMatch(user, { seed: SEED + 1, intents, you: "P1" }, "jjk"))
      .toThrow(ReplayError);
    expect(walletOf(user.id).berries).toBe(0);
  });

  it("refuses a match that has not finished", () => {
    const { intents } = playScoreMatch();
    expect(() => settleScoreMatch(user, { seed: SEED, intents: intents.slice(0, 3), you: "P1" }, "jjk"))
      .toThrow(/not finished/i);
    expect(unopenedPacks(user.id)).toHaveLength(0);
  });

  it("refuses to sit and replay something absurdly long", () => {
    const { intents } = playScoreMatch();
    const padded = Array.from({ length: 900 }, () => intents[0]);
    expect(() => settleScoreMatch(user, { seed: SEED, intents: padded, you: "P1" }, "jjk"))
      .toThrow(/too long/i);
  });

  it("replays a card battle too, drafts and all", () => {
    const { intents, winner } = playBattleMatch();
    const you = winner === "P1" ? "P1" : "P2";

    const payout = settleBattleMatch(
      user,
      { seed: SEED, p1: draftFrom(0), p2: draftFrom(1), intents, you },
      "jjk",
    );

    expect(payout.won).toBe(true);
    expect(walletOf(user.id).berries).toBe(payout.berries);
    expect(rankingOf(user.id).mmr).toBe(0);
  });

  it("refuses a card battle played from a different deck", () => {
    const { intents } = playBattleMatch();
    expect(() => settleBattleMatch(
      user,
      { seed: SEED, p1: draftFrom(2), p2: draftFrom(1), intents, you: "P1" },
      "jjk",
    )).toThrow(ReplayError);
    expect(walletOf(user.id).berries).toBe(0);
  });

  it("cannot be told a loss was a win", () => {
    const { intents, state } = playScoreMatch();
    const loser: ScorePlayer = state.winner === "P1" ? "P2" : "P1";

    // The claim is the seat, and the seat decides the outcome. Claiming the
    // losing seat cannot produce a win however the client asks for it.
    const payout = settleScoreMatch(user, { seed: SEED, intents, you: loser }, "jjk");
    expect(payout.won).toBe(false);
  });
});
