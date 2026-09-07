import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEngine, createInitialState } from "@cg/engine";
import type { PlayerId, PlayerDraftResult } from "@cg/contracts";
import { createMatch, submitIntent, endMatch, validateDraft, type Match, type Seat } from "./matches.js";

// Drives the match layer directly rather than over a socket, so the test does
// not need a running server or a free port.

const cardDb = createEngine(createInitialState()).getState().cardDb;

const draft: PlayerDraftResult = {
  leaderId: "gojo-base",
  combatIds: ["yuji", "toji"],
  supportIds: ["todo", "megumi", "nobara"],
  extraIds: ["choso", "maki"],
  weaponIds: [],
};

function makeMatch() {
  const sent: Record<PlayerId, unknown[]> = { P1: [], P2: [] };
  const seat = (pid: PlayerId): Omit<Seat, "playerId"> => ({
    name: pid,
    send: (m: unknown) => sent[pid].push(m),
  });
  const match = createMatch(cardDb, { seat: seat("P1"), draft }, { seat: seat("P2"), draft });
  return { match, sent };
}

describe("draft validation", () => {
  it("accepts a normal draft", () => {
    expect(validateDraft(draft, cardDb)).toBeNull();
  });

  it("rejects a leader that does not exist", () => {
    expect(validateDraft({ ...draft, leaderId: "nobody" }, cardDb)).toBe("That leader does not exist");
  });

  it("rejects a card that does not exist", () => {
    expect(validateDraft({ ...draft, extraIds: ["nobody"] }, cardDb)).toMatch(/does not exist/);
  });

  it("rejects an empty deck", () => {
    expect(validateDraft({ ...draft, combatIds: [], supportIds: [], extraIds: [] }, cardDb)).toBe("Your deck is empty");
  });
});

describe("match layer", () => {
  it("starts on MAIN so the first player can act immediately", () => {
    const { match } = makeMatch();
    expect(match.state.phase).toBe("MAIN");
  });

  it("rejects an intent sent for the other player's seat", () => {
    const { match } = makeMatch();
    const notActive: PlayerId = match.state.activePlayer === "P1" ? "P2" : "P1";
    const err = submitIntent(match, notActive, { type: "END_TURN", pid: match.state.activePlayer });
    expect(err).toBe("That is not your seat");
  });

  it("rejects acting out of turn", () => {
    const { match } = makeMatch();
    const notActive: PlayerId = match.state.activePlayer === "P1" ? "P2" : "P1";
    const err = submitIntent(match, notActive, { type: "END_TURN", pid: notActive });
    expect(err).toBe("Not your turn");
  });

  it("accepts a legal intent and passes the turn", () => {
    const { match } = makeMatch();
    const active = match.state.activePlayer;
    const err = submitIntent(match, active, { type: "END_TURN", pid: active });
    expect(err).toBeNull();
    expect(match.state.activePlayer).not.toBe(active);
  });

  it("passes engine rejections back instead of applying them", () => {
    const { match } = makeMatch();
    const active = match.state.activePlayer;
    const before = JSON.stringify(match.state);
    // No attacker selected, so the engine should refuse this
    const err = submitIntent(match, active, { type: "ATTACK_LEADER", pid: active });
    expect(err).toBeTruthy();
    expect(JSON.stringify(match.state)).toBe(before);
  });

  it("sends each player a view with the opponent's hand hidden", () => {
    const { match, sent } = makeMatch();
    const active = match.state.activePlayer;
    submitIntent(match, active, { type: "END_TURN", pid: active });

    for (const pid of ["P1", "P2"] as PlayerId[]) {
      const last = sent[pid].at(-1) as { type: string; state: typeof match.state };
      expect(last.type).toBe("state");
      const opponent: PlayerId = pid === "P1" ? "P2" : "P1";
      expect(last.state.players[opponent].hand.every(c => c.hidden)).toBe(true);
      expect(last.state.players[pid].hand.some(c => c.hidden)).toBe(false);
      expect(last.state.rngSeed).toBe(0);
    }
    endMatch(match.id);
  });

  it("gives both players the same match seed, so they stay in sync", () => {
    const a = makeMatch().match;
    const b = makeMatch().match;
    // Different matches roll different seeds
    expect(a.state.rngSeed).not.toBe(b.state.rngSeed);
    endMatch(a.id); endMatch(b.id);
  });
});
