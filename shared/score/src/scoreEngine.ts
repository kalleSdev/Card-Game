import {
  COST, ENERGY_PER_TURN, SKIPS_PER_GAME, TABLE_SIZE, TAKES_PER_TURN, TEAM, TEAM_SIZE,
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

export interface ScoreState {
  /** Card ids by table position. The server holds this; a client view does not. */
  cards: (string | null)[];
  table: TableSlot[];
  teams: Record<ScorePlayer, Team>;
  turn: ScorePlayer;
  energy: number;
  takesLeft: number;
  /** Passes each player has left for the whole game, not the turn. */
  skipsLeft: Record<ScorePlayer, number>;
  /** Counts a full go each, so both players always have the same number of turns. */
  round: number;
  over: boolean;
  winner: ScorePlayer | "draw" | null;
}

export type ScoreIntent =
  | { type: "REVEAL"; index: number }
  | { type: "DENY"; index: number }
  | { type: "TAKE"; index: number; seat: SeatRef }
  /** Ends a turn without taking. Limited, and gone once spent. */
  | { type: "SKIP" };

export type ScoreEvent =
  | { type: "REVEALED"; index: number; by: ScorePlayer; cardId: string }
  | { type: "DENIED"; index: number; by: ScorePlayer }
  | { type: "TAKEN"; index: number; by: ScorePlayer; cardId: string; seat: SeatRef; blind: boolean }
  | { type: "SKIPPED"; by: ScorePlayer; left: number }
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
    cards,
    table: cards.map(() => ({ revealed: false, denied: false, takenBy: null })),
    teams: { P1: emptyTeam(), P2: emptyTeam() },
    // The seed decides who starts, so neither seat is the better one to sit in
    turn: seed % 2 === 0 ? "P1" : "P2",
    energy: ENERGY_PER_TURN,
    takesLeft: TAKES_PER_TURN,
    skipsLeft: { P1: SKIPS_PER_GAME, P2: SKIPS_PER_GAME },
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

/** True once neither player can take anything, whether or not the seats are full. */
export function isFinished(state: ScoreState): boolean {
  const bothFull = PLAYERS.every(p => seatsFilled(state.teams[p]) >= TEAM_SIZE);
  return bothFull || available(state).length === 0;
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
export function viewFor(state: ScoreState, _player: ScorePlayer): ScoreState {
  return {
    ...state,
    cards: state.cards.map((id, i) =>
      state.table[i].revealed || state.table[i].takenBy ? id : null,
    ),
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
  if (actor !== state.turn) return reject("Not your turn");

  switch (intent.type) {
    case "REVEAL": {
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
      const slot = state.table[intent.index];
      if (!slot) return reject("No such card");
      if (slot.takenBy) return reject("That card has been taken");
      if (slot.denied) return reject("That card is already locked");
      if (state.energy < COST.deny) return reject("Not enough energy");

      const next = withSlot(state, intent.index, { revealed: false, denied: true });
      next.energy -= COST.deny;
      return settle(next, pool, [{ type: "DENIED", index: intent.index, by: actor }]);
    }

    case "TAKE": {
      const slot = state.table[intent.index];
      if (!slot) return reject("No such card");
      if (slot.takenBy) return reject("That card has been taken");
      if (slot.denied) return reject("That card is locked");
      if (state.takesLeft < 1) return reject("You have already taken a card this turn");

      const ref = intent.seat;
      if (ref.row === "captain" ? ref.index !== 0 : ref.index < 0 || ref.index >= TEAM[ref.row]) {
        return reject("No such seat");
      }
      if (seatOf(state.teams[actor], ref)) return reject("That seat is taken");

      const cardId = state.cards[intent.index] as string;
      const blind = !slot.revealed;

      let next = withSlot(state, intent.index, { takenBy: actor, revealed: true });
      next.takesLeft -= 1;
      next.teams = { ...next.teams, [actor]: place(next.teams[actor], ref, cardId) };

      // Taking is how a turn ends. There is nothing left to decide once the
      // card is in a seat, so the board does not wait to be told.
      const handover = other(actor);
      next = { ...next, ...freshTurn(next, handover) };

      return settle(next, pool, [
        { type: "TAKEN", index: intent.index, by: actor, cardId, seat: ref, blind },
        { type: "TURN_ENDED", by: actor, next: next.turn },
      ]);
    }

    case "SKIP": {
      if (state.skipsLeft[actor] < 1) return reject("You have no skips left");

      const left = state.skipsLeft[actor] - 1;
      const passed: ScoreState = {
        ...state,
        skipsLeft: { ...state.skipsLeft, [actor]: left },
      };
      const next = { ...passed, ...freshTurn(passed, other(actor)) };

      return settle(next, pool, [
        { type: "SKIPPED", by: actor, left },
        { type: "TURN_ENDED", by: actor, next: next.turn },
      ]);
    }

    default:
      return reject("Unknown action");
  }
}

/**
 * Hands the turn over. A player with a full team is skipped: they have nothing
 * left to do, and making them pass would only be a button to press. Both are
 * full means the game is over, which settle() picks up.
 */
function freshTurn(state: ScoreState, next: ScorePlayer): Partial<ScoreState> {
  const to = seatsFilled(state.teams[next]) >= TEAM_SIZE && seatsFilled(state.teams[other(next)]) < TEAM_SIZE
    ? other(next)
    : next;
  const bumped = to === "P1" ? state.round + 1 : state.round;
  return { turn: to, energy: ENERGY_PER_TURN, takesLeft: TAKES_PER_TURN, round: bumped };
}

function withSlot(state: ScoreState, index: number, patch: Partial<TableSlot>): ScoreState {
  return {
    ...state,
    table: state.table.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)),
  };
}

function place(team: Team, ref: SeatRef, cardId: string): Team {
  if (ref.row === "captain") return { ...team, captain: cardId };
  return { ...team, [ref.row]: team[ref.row].map((id, i) => (i === ref.index ? cardId : id)) };
}

function other(player: ScorePlayer): ScorePlayer {
  return player === "P1" ? "P2" : "P1";
}

/** Ends the game if there is nothing left to play for, and works out who won. */
function settle(state: ScoreState, pool: ScoreCard[], events: ScoreEvent[]): ScoreResult {
  if (!isFinished(state)) return { state, events };

  const table = scores(state, pool);
  const winner: ScorePlayer | "draw" =
    table.P1 === table.P2 ? "draw" : table.P1 > table.P2 ? "P1" : "P2";

  return {
    state: { ...state, over: true, winner },
    events: [...events, { type: "GAME_OVER", winner, scores: table }],
  };
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
