import {
  COST, ENERGY_PER_TURN, TABLE_SIZE, TAKES_PER_TURN, TEAM, TEAM_SIZE,
  valueOf,
  type ScoreCard, type Seat,
} from "./rules";

/**
 * Score Battle, the reducer.
 *
 * One function, `applyScoreIntent(state, intent) -> { state, events }`. State is
 * plain data and never mutated, so the same call runs on the client for the
 * board, on the server for the truth, and in a loop for the bot.
 *
 * The game runs in two phases. In the draft you take cards to your hand, one a
 * turn, and spend energy looking at the table or locking cards out of it. When
 * both hands are full the placement phase begins: every card anybody drafted
 * turns face up, and each player sits their seven in the seats they choose.
 *
 * Splitting it that way is what makes a blind take a real gamble. You commit to
 * a card before you know what it is, and only later find out what you have to
 * build a team out of.
 *
 * The only hidden information is which card is face-down where. That lives in
 * `cards`, and `viewFor()` strips it before anything leaves the server, so a
 * blind take is genuinely blind rather than blind in the interface.
 */

export type ScorePlayer = "P1" | "P2";

export interface SeatRef {
  row: Seat;
  /** Always 0 for the captain. 0-2 for the other two rows. */
  index: number;
}

export interface TableSlot {
  /** Face up to both players. A deny can turn this back off. */
  revealed: boolean;
  /** Locked out of the game for good. Nobody can take or reveal it again. */
  denied: boolean;
  takenBy: ScorePlayer | null;
}

export interface Team {
  captain: string | null;
  combat: (string | null)[];
  support: (string | null)[];
}

export type ScorePhase = "draft" | "placement" | "over";

export interface ScoreState {
  phase: ScorePhase;
  /** Card ids by table position. The server holds this; a client view does not. */
  cards: (string | null)[];
  table: TableSlot[];
  /** What each player drafted, before any of it is placed. */
  hands: Record<ScorePlayer, string[]>;
  teams: Record<ScorePlayer, Team>;
  turn: ScorePlayer;
  energy: number;
  takesLeft: number;
  /** Counts a full go each, so both players always have the same number of turns. */
  round: number;
  over: boolean;
  winner: ScorePlayer | "draw" | null;
}

export type ScoreIntent =
  | { type: "REVEAL"; index: number }
  | { type: "DENY"; index: number }
  /** Draft phase. The card goes to your hand; where it sits is decided later. */
  | { type: "TAKE"; index: number }
  /** Placement phase. Sits one card you drafted in one of your seats. */
  | { type: "PLACE"; cardId: string; seat: SeatRef }
  /** Placement phase. Takes a card back out of a seat, before you are done. */
  | { type: "UNPLACE"; seat: SeatRef }
  | { type: "END_TURN" };

export type ScoreEvent =
  | { type: "REVEALED"; index: number; by: ScorePlayer; cardId: string }
  | { type: "DENIED"; index: number; by: ScorePlayer }
  | { type: "TAKEN"; index: number; by: ScorePlayer; cardId: string; blind: boolean }
  | { type: "PLACED"; by: ScorePlayer; cardId: string; seat: SeatRef }
  | { type: "UNPLACED"; by: ScorePlayer; cardId: string; seat: SeatRef }
  | { type: "PLACEMENT_BEGAN"; hands: Record<ScorePlayer, string[]> }
  | { type: "TURN_ENDED"; by: ScorePlayer; next: ScorePlayer }
  | { type: "GAME_OVER"; winner: ScorePlayer | "draw"; scores: Record<ScorePlayer, number> }
  | { type: "REJECTED"; reason: string };

export interface ScoreResult {
  state: ScoreState;
  events: ScoreEvent[];
}

const PLAYERS: ScorePlayer[] = ["P1", "P2"];

function emptyTeam(): Team {
  return {
    captain: null,
    combat: Array.from({ length: TEAM.combat }, () => null),
    support: Array.from({ length: TEAM.support }, () => null),
  };
}

/**
 * Deals a table. The pool is shuffled with the given seed, so the same seed is
 * the same game and a finished match can be replayed from its number alone.
 */
export function createScoreMatch(pool: ScoreCard[], seed: number, size = TABLE_SIZE): ScoreState {
  if (pool.length < size) {
    throw new Error(`Score needs ${size} cards to deal a table, and got ${pool.length}`);
  }
  const shuffled = shuffle(pool.map(card => card.id), seed);
  const cards = shuffled.slice(0, size);

  return {
    phase: "draft",
    cards,
    table: cards.map(() => ({ revealed: false, denied: false, takenBy: null })),
    hands: { P1: [], P2: [] },
    teams: { P1: emptyTeam(), P2: emptyTeam() },
    // The seed decides who starts, so neither seat is the better one to sit in
    turn: seed % 2 === 0 ? "P1" : "P2",
    energy: ENERGY_PER_TURN,
    takesLeft: TAKES_PER_TURN,
    round: 1,
    over: false,
    winner: null,
  };
}

// ── Reading a state ──────────────────────────────────────────────────────────

export function seatOf(team: Team, ref: SeatRef): string | null {
  if (ref.row === "captain") return team.captain;
  return team[ref.row][ref.index] ?? null;
}

export function seatsFilled(team: Team): number {
  return (
    (team.captain ? 1 : 0) +
    team.combat.filter(Boolean).length +
    team.support.filter(Boolean).length
  );
}

/** Every card still on the table: not taken, not denied. */
export function available(state: ScoreState): number[] {
  return state.table.flatMap((slot, i) => (slot.takenBy || slot.denied ? [] : [i]));
}

/** True once nobody can draft any more: hands full, or nothing left to take. */
export function draftIsDone(state: ScoreState): boolean {
  const handsFull = PLAYERS.every(p => state.hands[p].length >= TEAM_SIZE);
  return handsFull || available(state).length === 0;
}

/** True once both players have sat every card they drafted. */
export function placementIsDone(state: ScoreState): boolean {
  return PLAYERS.every(p => state.hands[p].length === 0);
}

/** What is still in a hand, waiting for a seat. */
export function unplaced(state: ScoreState, player: ScorePlayer): string[] {
  return state.hands[player];
}

export function scoreOf(state: ScoreState, player: ScorePlayer, pool: ScoreCard[]): number {
  const by = new Map(pool.map(card => [card.id, card]));
  const team = state.teams[player];
  let total = 0;

  const add = (cardId: string | null, seat: Seat) => {
    if (!cardId) return;
    const card = by.get(cardId);
    if (card) total += valueOf(card, seat);
  };

  add(team.captain, "captain");
  for (const id of team.combat) add(id, "combat");
  for (const id of team.support) add(id, "support");
  return total;
}

export function scores(state: ScoreState, pool: ScoreCard[]): Record<ScorePlayer, number> {
  return { P1: scoreOf(state, "P1", pool), P2: scoreOf(state, "P2", pool) };
}

/**
 * What one player is allowed to see: their own team, the table's face-up cards,
 * and nothing else. Everything hidden comes back as null rather than as a card
 * id the browser could read out of a network response.
 */
export function viewFor(state: ScoreState, player: ScorePlayer): ScoreState {
  const hidden = state.phase === "draft";
  return {
    ...state,
    cards: state.cards.map((id, i) => (state.table[i].revealed ? id : null)),
    hands: {
      ...state.hands,
      // During the draft a hand is private, right down to its length being the
      // only thing the other player can count.
      [other(player)]: hidden ? state.hands[other(player)].map(() => "") : state.hands[other(player)],
    },
  };
}

// ── The reducer ──────────────────────────────────────────────────────────────

export function applyScoreIntent(
  state: ScoreState,
  intent: ScoreIntent,
  actor: ScorePlayer,
  pool: ScoreCard[],
): ScoreResult {
  const reject = (reason: string): ScoreResult => ({
    state,
    events: [{ type: "REJECTED", reason }],
  });

  if (state.over) return reject("The game is over");
  // Placement is not taken in turns: both players sit their own cards at once,
  // and neither can see the other's board until everybody is done.
  if (state.phase === "draft" && actor !== state.turn) return reject("Not your turn");

  switch (intent.type) {
    case "REVEAL": {
      if (state.phase !== "draft") return reject("The draft is over");
      const slot = state.table[intent.index];
      if (!slot) return reject("No such card");
      if (slot.takenBy) return reject("That card has been taken");
      if (slot.denied) return reject("That card is locked");
      if (slot.revealed) return reject("That card is already face up");
      if (state.energy < COST.reveal) return reject("Not enough energy");

      const next = withSlot(state, intent.index, { revealed: true });
      next.energy -= COST.reveal;
      return settle(next, pool, [
        { type: "REVEALED", index: intent.index, by: actor, cardId: state.cards[intent.index] as string },
      ]);
    }

    case "DENY": {
      if (state.phase !== "draft") return reject("The draft is over");
      const slot = state.table[intent.index];
      if (!slot) return reject("No such card");
      if (slot.takenBy) return reject("That card has been taken");
      if (slot.denied) return reject("That card is already locked");
      // Deny only bites something face up: it is the answer to a reveal, not a
      // way to quietly delete cards nobody has looked at.
      if (!slot.revealed) return reject("You can only deny a card that is face up");
      if (state.energy < COST.deny) return reject("Not enough energy");

      const next = withSlot(state, intent.index, { revealed: false, denied: true });
      next.energy -= COST.deny;
      return settle(next, pool, [{ type: "DENIED", index: intent.index, by: actor }]);
    }

    case "TAKE": {
      if (state.phase !== "draft") return reject("The draft is over");
      const slot = state.table[intent.index];
      if (!slot) return reject("No such card");
      if (slot.takenBy) return reject("That card has been taken");
      if (slot.denied) return reject("That card is locked");
      if (state.takesLeft < 1) return reject("You have already taken a card this turn");
      if (state.hands[actor].length >= TEAM_SIZE) return reject("Your hand is full");

      const cardId = state.cards[intent.index] as string;
      const blind = !slot.revealed;

      // Taken cards stay face down on the table until the placement phase: a
      // blind take is only a gamble if the other player cannot read it either.
      const next = withSlot(state, intent.index, { takenBy: actor });
      next.takesLeft -= 1;
      next.hands = { ...next.hands, [actor]: [...next.hands[actor], cardId] };

      return settle(next, pool, [
        { type: "TAKEN", index: intent.index, by: actor, cardId, blind },
      ]);
    }

    case "PLACE": {
      if (state.phase !== "placement") return reject("Nothing to place yet");
      if (!state.hands[actor].includes(intent.cardId)) return reject("That card is not yours to place");

      const ref = intent.seat;
      if (ref.row === "captain" ? ref.index !== 0 : ref.index < 0 || ref.index >= TEAM[ref.row]) {
        return reject("No such seat");
      }
      if (seatOf(state.teams[actor], ref)) return reject("That seat is taken");

      const next: ScoreState = {
        ...state,
        hands: { ...state.hands, [actor]: state.hands[actor].filter(id => id !== intent.cardId) },
        teams: { ...state.teams, [actor]: place(state.teams[actor], ref, intent.cardId) },
      };
      return settle(next, pool, [
        { type: "PLACED", by: actor, cardId: intent.cardId, seat: ref },
      ]);
    }

    case "UNPLACE": {
      if (state.phase !== "placement") return reject("Nothing to move");
      const cardId = seatOf(state.teams[actor], intent.seat);
      if (!cardId) return reject("That seat is empty");

      const next: ScoreState = {
        ...state,
        hands: { ...state.hands, [actor]: [...state.hands[actor], cardId] },
        teams: { ...state.teams, [actor]: place(state.teams[actor], intent.seat, null) },
      };
      return { state: next, events: [{ type: "UNPLACED", by: actor, cardId, seat: intent.seat }] };
    }

    case "END_TURN": {
      if (state.phase !== "draft") return reject("There are no turns to end");
      const next = { ...state, ...freshTurn(state, other(actor)) };
      return settle(next, pool, [{ type: "TURN_ENDED", by: actor, next: next.turn }]);
    }

    default:
      return reject("Unknown action");
  }
}

/**
 * Hands the turn over. A player whose hand is already full is skipped: they
 * have nothing left to draft, and making them pass would only be a button to
 * press. Both full ends the draft, which settle() picks up.
 */
function freshTurn(state: ScoreState, next: ScorePlayer): Partial<ScoreState> {
  const full = (p: ScorePlayer) => state.hands[p].length >= TEAM_SIZE;
  const to = full(next) && !full(other(next)) ? other(next) : next;
  const bumped = to === "P1" ? state.round + 1 : state.round;
  return { turn: to, energy: ENERGY_PER_TURN, takesLeft: TAKES_PER_TURN, round: bumped };
}

function withSlot(state: ScoreState, index: number, patch: Partial<TableSlot>): ScoreState {
  return {
    ...state,
    table: state.table.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)),
  };
}

function place(team: Team, ref: SeatRef, cardId: string | null): Team {
  if (ref.row === "captain") return { ...team, captain: cardId };
  return { ...team, [ref.row]: team[ref.row].map((id, i) => (i === ref.index ? cardId : id)) };
}

function other(player: ScorePlayer): ScorePlayer {
  return player === "P1" ? "P2" : "P1";
}

/**
 * Moves the game on when a phase has nothing left in it.
 *
 * The draft ends when both hands are full or the table is empty; that turns
 * every drafted card face up and opens the placement phase. The game ends when
 * both players have sat everything they drafted.
 */
function settle(state: ScoreState, pool: ScoreCard[], events: ScoreEvent[]): ScoreResult {
  if (state.phase === "draft") {
    if (!draftIsDone(state)) return { state, events };

    // Everything anybody drafted is now public, and so is everything still on
    // the table: there is nothing left to hide once nobody can take.
    const opened: ScoreState = {
      ...state,
      phase: "placement",
      table: state.table.map(slot => (slot.denied ? slot : { ...slot, revealed: true })),
    };
    return {
      state: opened,
      events: [...events, { type: "PLACEMENT_BEGAN", hands: opened.hands }],
    };
  }

  if (state.phase === "placement" && placementIsDone(state)) {
    const table = scores(state, pool);
    const winner: ScorePlayer | "draw" =
      table.P1 === table.P2 ? "draw" : table.P1 > table.P2 ? "P1" : "P2";

    return {
      state: { ...state, phase: "over", over: true, winner },
      events: [...events, { type: "GAME_OVER", winner, scores: table }],
    };
  }

  return { state, events };
}

// ── The shuffle ──────────────────────────────────────────────────────────────

/** mulberry32, the same generator the packs use, so a seed means one deal. */
function shuffle(ids: string[], seed: number): string[] {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const out = ids.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
