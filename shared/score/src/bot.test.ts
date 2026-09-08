import { describe, it, expect } from "vitest";
import { GRADE_POINTS, TEAM_SIZE, type ScoreCard } from "./rules";
import { applyScoreIntent, createScoreMatch, seatsFilled, scores } from "./scoreEngine";
import { playScoreTurn } from "./bot";

function pool(size = 40): ScoreCard[] {
  const roles = ["captain", "combat", "support"] as const;
  const grades = ["common", "rare", "epic", "legendary"] as const;
  return Array.from({ length: size }, (_, i) => {
    const grade = grades[i % grades.length];
    return {
      id: `c${i}`,
      role: roles[i % roles.length],
      grade,
      points: GRADE_POINTS[grade].min + (i % 2),
    };
  });
}

const CARDS = pool();

/**
 * Both sides played by the bot, which is the cheapest way to see a whole game.
 * The draft is taken in turns; placement is not, so both sides are asked in
 * that phase rather than whoever the turn happens to point at.
 */
function playOut(seed: number) {
  let state = createScoreMatch(CARDS, seed);
  let turns = 0;
  while (!state.over && turns < 200) {
    if (state.phase === "draft") {
      state = playScoreTurn(state, state.turn, CARDS).state;
    } else {
      for (const player of ["P1", "P2"] as const) state = playScoreTurn(state, player, CARDS).state;
    }
    turns++;
  }
  return { state, turns };
}

describe("the bot", () => {
  it("drafts a card every turn it can", () => {
    const state = createScoreMatch(CARDS, 4);
    const me = state.turn;
    const after = playScoreTurn(state, me, CARDS).state;
    expect(after.hands[me]).toHaveLength(1);
  });

  it("sits a whole hand once the draft is over", () => {
    let state = createScoreMatch(CARDS, 4);
    while (state.phase === "draft") state = playScoreTurn(state, state.turn, CARDS).state;

    const after = playScoreTurn(state, "P1", CARDS).state;
    expect(after.hands.P1).toHaveLength(0);
    expect(seatsFilled(after.teams.P1)).toBe(TEAM_SIZE);
  });

  it("never leaves a turn half played, and never gets stuck", () => {
    for (const seed of [1, 2, 3, 17, 99, 1234]) {
      const { state, turns } = playOut(seed);
      expect(state.over).toBe(true);
      expect(turns).toBeLessThan(60);
    }
  });

  it("fills both teams when the table allows it", () => {
    const { state } = playOut(8);
    expect(seatsFilled(state.teams.P1)).toBe(TEAM_SIZE);
    expect(seatsFilled(state.teams.P2)).toBe(TEAM_SIZE);
  });

  it("finishes on a score that matches the teams it built", () => {
    const { state } = playOut(21);
    const table = scores(state, CARDS);
    const expected = table.P1 === table.P2 ? "draw" : table.P1 > table.P2 ? "P1" : "P2";
    expect(state.winner).toBe(expected);
  });

  it("only ever plays legal moves", () => {
    let state = createScoreMatch(CARDS, 5);
    while (!state.over) {
      const me = state.phase === "draft" ? state.turn : state.hands.P1.length > 0 ? "P1" : "P2";
      const { intents } = playScoreTurn(state, me, CARDS);
      // Replay them against the state the bot started from
      for (const intent of intents) {
        const result = applyScoreIntent(state, intent, me, CARDS);
        expect(result.events.some(e => e.type === "REJECTED")).toBe(false);
        state = result.state;
      }
    }
    expect(state.over).toBe(true);
  });

  it("prefers a seat that matches the card it took", () => {
    // A table of nothing but support cards: the bot should still fill combat
    // seats rather than refusing to play, and take the penalty knowingly.
    const supportOnly: ScoreCard[] = Array.from({ length: 30 }, (_, i) => ({
      id: `s${i}`, role: "support", grade: "rare", points: 5,
    }));
    let state = createScoreMatch(supportOnly, 3);
    let turns = 0;
    while (!state.over && turns < 100) {
      if (state.phase === "draft") {
        state = playScoreTurn(state, state.turn, supportOnly).state;
      } else {
        for (const player of ["P1", "P2"] as const) {
          state = playScoreTurn(state, player, supportOnly).state;
        }
      }
      turns++;
    }
    expect(state.over).toBe(true);
    expect(seatsFilled(state.teams.P1)).toBe(TEAM_SIZE);
  });
});
