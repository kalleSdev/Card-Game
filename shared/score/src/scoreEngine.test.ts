import { describe, it, expect } from "vitest";
import {
  CAPTAIN_MULTIPLIER, ENERGY_PER_TURN, GRADE_POINTS, MISPLACED_PENALTY,
  TABLE_SIZE, TEAM_SIZE, assertGraded, valueOf,
  type ScoreCard,
} from "./rules";
import {
  applyScoreIntent, available, createScoreMatch, isFinished, scoreOf, scores, seatOf, seatsFilled,
  viewFor,
  type ScoreIntent, type ScorePlayer, type ScoreState,
} from "./scoreEngine";
import { scoreCardsFrom } from "./fromCards";

/** A pool big enough to deal from, with a predictable spread of roles. */
function pool(size = 30): ScoreCard[] {
  const roles = ["captain", "combat", "support"] as const;
  const grades = ["common", "rare", "epic", "legendary"] as const;
  return Array.from({ length: size }, (_, i) => {
    const grade = grades[i % grades.length];
    return {
      id: `c${i}`,
      role: roles[i % roles.length],
      grade,
      points: GRADE_POINTS[grade].min,
    };
  });
}

const CARDS = pool();
const cardOf = (id: string) => CARDS.find(c => c.id === id) as ScoreCard;

function run(state: ScoreState, intent: ScoreIntent, actor = state.turn) {
  return applyScoreIntent(state, intent, actor, CARDS);
}

/** Takes any card that is still on the table, into the first free seat. */
function takeAnything(state: ScoreState): ScoreState {
  const index = available(state)[0];
  const team = state.teams[state.turn];
  const seat = team.captain === null
    ? { row: "captain" as const, index: 0 }
    : team.combat.findIndex(x => x === null) >= 0
      ? { row: "combat" as const, index: team.combat.findIndex(x => x === null) }
      : { row: "support" as const, index: team.support.findIndex(x => x === null) };
  return run(state, { type: "TAKE", index, seat }).state;
}

describe("the table", () => {
  it("deals the right number of cards, all face down", () => {
    const state = createScoreMatch(CARDS, 7);
    expect(state.cards).toHaveLength(TABLE_SIZE);
    expect(state.table.every(s => !s.revealed && !s.denied && s.takenBy === null)).toBe(true);
    expect(state.energy).toBe(ENERGY_PER_TURN);
  });

  it("deals the same table for the same seed, and a different one otherwise", () => {
    expect(createScoreMatch(CARDS, 12).cards).toEqual(createScoreMatch(CARDS, 12).cards);
    expect(createScoreMatch(CARDS, 12).cards).not.toEqual(createScoreMatch(CARDS, 13).cards);
  });

  it("refuses to deal from a pool that is too small", () => {
    expect(() => createScoreMatch(pool(5), 1)).toThrow(/needs 20 cards/i);
  });

  it("hides what is face down, even in the state a client is handed", () => {
    let state = createScoreMatch(CARDS, 2);
    state = run(state, { type: "REVEAL", index: 3 }).state;

    const view = viewFor(state, "P1");
    expect(view.cards[3]).toBe(state.cards[3]);
    expect(view.cards.filter(Boolean)).toHaveLength(1);
  });
});

describe("what a turn costs", () => {
  it("spends a point of energy to reveal, and shows the card to both", () => {
    const state = createScoreMatch(CARDS, 2);
    const { state: after, events } = run(state, { type: "REVEAL", index: 0 });

    expect(after.energy).toBe(ENERGY_PER_TURN - 1);
    expect(after.table[0].revealed).toBe(true);
    expect(events[0]).toMatchObject({ type: "REVEALED", cardId: state.cards[0] });
  });

  it("allows two reveals and no more", () => {
    let state = createScoreMatch(CARDS, 2);
    state = run(state, { type: "REVEAL", index: 0 }).state;
    state = run(state, { type: "REVEAL", index: 1 }).state;

    const { events } = run(state, { type: "REVEAL", index: 2 });
    expect(events[0]).toMatchObject({ type: "REJECTED", reason: /energy/i });
  });

  it("denies a revealed card, and locks it for good", () => {
    let state = createScoreMatch(CARDS, 2);
    state = run(state, { type: "REVEAL", index: 4 }).state;
    state = run(state, { type: "DENY", index: 4 }).state;

    expect(state.table[4]).toMatchObject({ denied: true, revealed: false });
    expect(available(state)).not.toContain(4);
    expect(run(state, { type: "REVEAL", index: 4 }).events[0]).toMatchObject({ reason: /locked/i });

    const seat = { row: "captain" as const, index: 0 };
    expect(run(state, { type: "TAKE", index: 4, seat }).events[0]).toMatchObject({ reason: /locked/i });
  });

  it("will not deny something nobody has looked at", () => {
    const state = createScoreMatch(CARDS, 2);
    expect(run(state, { type: "DENY", index: 0 }).events[0]).toMatchObject({ reason: /face up/i });
    expect(state.energy).toBe(ENERGY_PER_TURN);
  });

  it("takes for free, but only once a turn", () => {
    let state = createScoreMatch(CARDS, 2);
    const before = state.energy;
    state = run(state, { type: "TAKE", index: 0, seat: { row: "captain", index: 0 } }).state;

    expect(state.energy).toBe(before);
    expect(state.takesLeft).toBe(0);
    expect(state.teams[state.turn].captain).toBe(state.cards[0]);

    const again = run(state, { type: "TAKE", index: 1, seat: { row: "combat", index: 0 } });
    expect(again.events[0]).toMatchObject({ reason: /already taken/i });
  });

  it("takes blind or face up, and says which it was", () => {
    let state = createScoreMatch(CARDS, 2);
    const blind = run(state, { type: "TAKE", index: 0, seat: { row: "captain", index: 0 } });
    expect(blind.events[0]).toMatchObject({ type: "TAKEN", blind: true });

    state = run(blind.state, { type: "END_TURN" }).state;
    state = run(state, { type: "REVEAL", index: 5 }).state;
    const seen = run(state, { type: "TAKE", index: 5, seat: { row: "captain", index: 0 } });
    expect(seen.events[0]).toMatchObject({ type: "TAKEN", blind: false });
  });

  it("lets you take the card your opponent revealed", () => {
    let state = createScoreMatch(CARDS, 2);
    const first = state.turn;
    state = run(state, { type: "REVEAL", index: 6 }).state;
    state = run(state, { type: "END_TURN" }).state;

    const { state: after, events } = run(state, {
      type: "TAKE", index: 6, seat: { row: "captain", index: 0 },
    });
    expect(events[0]).toMatchObject({ type: "TAKEN", blind: false });
    expect(after.teams[first === "P1" ? "P2" : "P1"].captain).toBe(state.cards[6]);
  });

  it("refuses a seat that is already sat in, and one that does not exist", () => {
    let state = createScoreMatch(CARDS, 2);
    state = run(state, { type: "TAKE", index: 0, seat: { row: "captain", index: 0 } }).state;
    state = run(state, { type: "END_TURN" }).state;
    state = run(state, { type: "END_TURN" }).state;

    expect(run(state, { type: "TAKE", index: 1, seat: { row: "captain", index: 0 } }).events[0])
      .toMatchObject({ reason: /seat is taken/i });
    expect(run(state, { type: "TAKE", index: 1, seat: { row: "combat", index: 9 } }).events[0])
      .toMatchObject({ reason: /no such seat/i });
  });

  it("gives each player their own energy and take back at the start of a turn", () => {
    let state = createScoreMatch(CARDS, 2);
    state = run(state, { type: "REVEAL", index: 0 }).state;
    state = takeAnything(state);
    state = run(state, { type: "END_TURN" }).state;

    expect(state.energy).toBe(ENERGY_PER_TURN);
    expect(state.takesLeft).toBe(1);
  });

  it("keeps everyone else out of the turn", () => {
    const state = createScoreMatch(CARDS, 2);
    const notTheirTurn = state.turn === "P1" ? "P2" : "P1";
    expect(run(state, { type: "REVEAL", index: 0 }, notTheirTurn).events[0])
      .toMatchObject({ reason: /not your turn/i });
  });
});

describe("what a team is worth", () => {
  const card = (over: Partial<ScoreCard>): ScoreCard =>
    ({ id: "x", role: "combat", grade: "rare", points: 5, ...over });

  it("doubles the captain seat", () => {
    const c = card({ role: "captain", points: 6 });
    expect(valueOf(c, "captain")).toBe(6 * CAPTAIN_MULTIPLIER);
  });

  it("charges for a card in the wrong seat", () => {
    const c = card({ role: "combat", points: 5 });
    expect(valueOf(c, "support")).toBe(5 - MISPLACED_PENALTY);
  });

  it("doubles first, then charges, for a misplaced captain", () => {
    const c = card({ role: "support", points: 5 });
    expect(valueOf(c, "captain")).toBe(5 * CAPTAIN_MULTIPLIER - MISPLACED_PENALTY);
  });

  it("adds a whole team up", () => {
    let state = createScoreMatch(CARDS, 2);
    const first = state.turn;
    state = run(state, { type: "TAKE", index: 0, seat: { row: "captain", index: 0 } }).state;

    const taken = cardOf(state.cards[0] as string);
    expect(scoreOf(state, first, CARDS)).toBe(valueOf(taken, "captain"));
  });
});

describe("the end", () => {
  it("finishes when both teams are full, and calls it", () => {
    let state = createScoreMatch(CARDS, 2);
    for (let i = 0; i < TEAM_SIZE * 2; i++) {
      state = takeAnything(state);
      if (!state.over) state = run(state, { type: "END_TURN" }).state;
    }

    expect(state.over).toBe(true);
    expect(seatsFilled(state.teams.P1)).toBe(TEAM_SIZE);
    expect(seatsFilled(state.teams.P2)).toBe(TEAM_SIZE);

    const table = scores(state, CARDS);
    const expected = table.P1 === table.P2 ? "draw" : table.P1 > table.P2 ? "P1" : "P2";
    expect(state.winner).toBe(expected);
  });

  it("finishes when the table runs out, however full the teams are", () => {
    let state = createScoreMatch(CARDS, 2);
    // Deny everything, two a turn, taking nothing
    while (available(state).length > 0 && !state.over) {
      const index = available(state)[0];
      state = run(state, { type: "REVEAL", index }).state;
      state = run(state, { type: "DENY", index }).state;
      if (!state.over) state = run(state, { type: "END_TURN" }).state;
    }

    expect(isFinished(state)).toBe(true);
    expect(state.over).toBe(true);
    expect(state.winner).toBe("draw");
  });

  it("refuses anything at all once it is over", () => {
    let state = createScoreMatch(CARDS, 2);
    for (let i = 0; i < TEAM_SIZE * 2; i++) {
      state = takeAnything(state);
      if (!state.over) state = run(state, { type: "END_TURN" }).state;
    }
    expect(run(state, { type: "REVEAL", index: 19 }, state.turn).events[0])
      .toMatchObject({ reason: /over/i });
  });

  it("skips a player whose team is already full", () => {
    let state = createScoreMatch(CARDS, 2);
    const first: ScorePlayer = state.turn;

    // First player fills up while the other only ever passes
    for (let i = 0; i < TEAM_SIZE; i++) {
      state = takeAnything(state);
      state = run(state, { type: "END_TURN" }).state;
      if (state.turn !== first) state = run(state, { type: "END_TURN" }).state;
    }

    expect(seatsFilled(state.teams[first])).toBe(TEAM_SIZE);
    expect(state.over).toBe(false);
    expect(state.turn).not.toBe(first);
  });
});

describe("the pool itself", () => {
  it("accepts cards inside their band", () => {
    expect(() => assertGraded(CARDS)).not.toThrow();
  });

  it("rejects a card worth more than its grade allows", () => {
    expect(() => assertGraded([{ id: "bad", role: "combat", grade: "common", points: 9 }]))
      .toThrow(/outside 1-3/);
  });

  it("puts every seat reference where it belongs", () => {
    const state = createScoreMatch(CARDS, 2);
    const after = run(state, { type: "TAKE", index: 0, seat: { row: "support", index: 2 } }).state;
    expect(seatOf(after.teams[state.turn], { row: "support", index: 2 })).toBe(state.cards[0]);
    expect(seatOf(after.teams[state.turn], { row: "support", index: 0 })).toBeNull();
  });
});

describe("cards from a card database", () => {
  const db = {
    leader: { name: "A", rarity: "X", affinity: "LEADER" },
    fighter: { name: "B", rarity: "S", affinity: "COMBAT" },
    helper: { name: "C", rarity: "B", affinity: "SUPPORT" },
    odd: { name: "D", rarity: "?", affinity: "?" },
  } as unknown as Record<string, import("@cg/contracts").CardDef>;

  it("reads the seat and the grade off the definition", () => {
    const cards = scoreCardsFrom(db);
    const by = Object.fromEntries(cards.map(c => [c.id, c]));
    expect(by.leader).toMatchObject({ role: "captain", grade: "mythic" });
    expect(by.fighter).toMatchObject({ role: "combat", grade: "rare" });
    expect(by.helper).toMatchObject({ role: "support", grade: "common" });
  });

  it("falls back rather than throwing on something it does not recognise", () => {
    const by = Object.fromEntries(scoreCardsFrom(db).map(c => [c.id, c]));
    expect(by.odd).toMatchObject({ role: "combat", grade: "common" });
  });

  it("gives every card points inside its band, and the same ones every time", () => {
    const once = scoreCardsFrom(db);
    expect(() => assertGraded(once)).not.toThrow();
    expect(scoreCardsFrom(db)).toEqual(once);
  });

  it("does not put every card of a grade on the same number", () => {
    const many = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [`c${i}`, { name: "x", rarity: "SS", affinity: "COMBAT" }]),
    ) as unknown as Record<string, import("@cg/contracts").CardDef>;
    const values = new Set(scoreCardsFrom(many).map(c => c.points));
    expect(values.size).toBeGreaterThan(1);
  });
});
