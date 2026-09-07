import { describe, it, expect } from "vitest";
import { createEngine, createInitialState } from "@cg/engine";
import type { PlayerDraftResult, PlayerId } from "@cg/contracts";
import { createBattleState, applyBattleIntent, playBotTurn } from "./index";

const cardDb = createEngine(createInitialState()).getState().cardDb;

const draft: PlayerDraftResult = {
  leaderId: "gojo-base",
  combatIds: ["yuji", "toji", "maki"],
  supportIds: ["todo", "megumi", "nobara"],
  extraIds: ["choso", "nanami"],
  weaponIds: [],
};

function freshMatch(seed: number) {
  let state = createBattleState(draft, draft, cardDb, undefined, seed);
  if (state.phase === "DRAW") {
    state = applyBattleIntent(state, { type: "END_TURN", pid: state.activePlayer }).state;
  }
  return state;
}

describe("bot opponent", () => {
  it("hands the turn back when it is done", () => {
    const before = freshMatch(1);
    const { state } = playBotTurn(before, before.activePlayer);
    expect(state.activePlayer).not.toBe(before.activePlayer);
  });

  it("does nothing on a turn that is not its own", () => {
    const state = freshMatch(2);
    const other: PlayerId = state.activePlayer === "P1" ? "P2" : "P1";
    const { state: after, events } = playBotTurn(state, other);
    expect(after).toBe(state);
    expect(events).toHaveLength(0);
  });

  it("never produces an illegal move", () => {
    for (let seed = 1; seed <= 20; seed++) {
      let state = freshMatch(seed);
      for (let turn = 0; turn < 12 && !state.winner; turn++) {
        const { state: next, events } = playBotTurn(state, state.activePlayer);
        expect(events.some(e => e.type === "ILLEGAL")).toBe(false);
        state = next;
      }
    }
  });

  it("gets cards onto the board", () => {
    let state = freshMatch(7);
    for (let turn = 0; turn < 6 && !state.winner; turn++) {
      state = playBotTurn(state, state.activePlayer).state;
    }
    const onBoard = state.players.P1.board.filter(Boolean).length
      + state.players.P2.board.filter(Boolean).length;
    expect(onBoard).toBeGreaterThan(0);
  });

  it("finishes a game when both seats are bots", () => {
    let state = freshMatch(11);
    let turns = 0;
    while (!state.winner && turns < 80) {
      state = playBotTurn(state, state.activePlayer).state;
      turns++;
    }
    expect(state.winner).not.toBeNull();
  });
});
