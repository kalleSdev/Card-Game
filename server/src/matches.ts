import { randomUUID } from "node:crypto";
import type { BattleState, BattleIntent } from "@cg/battle";
import { createBattleState, applyBattleIntent, viewFor, playBotTurn } from "@cg/battle";
import type { CardDef, PlayerId, PlayerDraftResult } from "@cg/contracts";

// Holds every live match. The server owns the real state; clients only ever get
// their own redacted view of it, and only ever send intents.

export interface Seat {
  playerId: PlayerId;
  name: string;
  send: (msg: unknown) => void;
}

export interface Match {
  id: string;
  state: BattleState;
  seats: Record<PlayerId, Seat>;
  /** Set on practice matches: the seat the computer plays. */
  botSeat?: PlayerId;
}

const matches = new Map<string, Match>();

// Checked before a player is put in the queue, so one bad deck cannot take the
// other player's place in the queue with it.
export function validateDraft(
  draft: PlayerDraftResult | undefined,
  cardDb: Record<string, CardDef>,
): string | null {
  if (!draft) return "No deck was sent";
  if (!draft.leaderId || !cardDb[draft.leaderId]) return "That leader does not exist";
  const cards = [
    ...(draft.combatIds ?? []),
    ...(draft.supportIds ?? []),
    ...(draft.extraIds ?? []),
  ];
  if (cards.length === 0) return "Your deck is empty";
  const unknown = cards.find(id => !cardDb[id]);
  if (unknown) return `Your deck has a card that does not exist: ${unknown}`;
  return null;
}

export function createMatch(
  cardDb: Record<string, CardDef>,
  p1: { seat: Omit<Seat, "playerId">; draft: PlayerDraftResult },
  p2: { seat: Omit<Seat, "playerId">; draft: PlayerDraftResult },
): Match {
  const id = randomUUID();
  // Server picks the seed, so both clients and any replay agree on every roll
  const seed = (Math.random() * 0xffffffff) >>> 0;
  const match: Match = {
    id,
    state: createBattleState(p1.draft, p2.draft, cardDb, undefined, seed),
    seats: {
      P1: { ...p1.seat, playerId: "P1" },
      P2: { ...p2.seat, playerId: "P2" },
    },
  };
  // A fresh match starts in the DRAW phase. Advance it here so the first player
  // opens on MAIN with a card drawn, rather than making the client ask for it.
  if (match.state.phase === "DRAW") {
    match.state = applyBattleIntent(match.state, {
      type: "END_TURN",
      pid: match.state.activePlayer,
    }).state;
  }

  matches.set(id, match);
  return match;
}

// Lets the computer take its turn (and any turns after it) once the human is done.
export function runBotIfItsTurn(match: Match): void {
  let guard = 0;
  while (match.botSeat && match.state.activePlayer === match.botSeat && !match.state.winner && guard++ < 4) {
    const { state, events } = playBotTurn(match.state, match.botSeat);
    match.state = state;
    broadcast(match, events);
  }
  if (match.state.winner) endMatch(match.id);
}

/**
 * Ends a match for a reason the rules know nothing about: a surrender, a player
 * who never came back, or one who stopped taking their turns. The winner is
 * recorded on the state so both sides settle it the same way a real win does.
 */
export function forfeit(match: Match, loser: PlayerId, reason: string): PlayerId {
  const winner: PlayerId = loser === "P1" ? "P2" : "P1";
  match.state = { ...match.state, winner };
  for (const pid of ["P1", "P2"] as PlayerId[]) {
    match.seats[pid].send({ type: "matchOver", winner, reason });
  }
  broadcast(match);
  return winner;
}

/** Points a seat at a new socket, for a player who dropped and came back. */
export function rebindSeat(match: Match, pid: PlayerId, send: Seat["send"]): void {
  match.seats[pid] = { ...match.seats[pid], send };
}

/** Ends the turn on behalf of a player who ran out of time. */
export function forceEndTurn(match: Match): void {
  const pid = match.state.activePlayer;
  const result = applyBattleIntent(match.state, { type: "END_TURN", pid });
  if (result.events.some(e => e.type === "ILLEGAL")) return;
  match.state = result.state;
  broadcast(match, result.events);
}

export function getMatch(id: string): Match | undefined {
  return matches.get(id);
}

export function endMatch(id: string): void {
  matches.delete(id);
}

// Push each player their own view of the state.
export function broadcast(match: Match, events: unknown[] = []): void {
  for (const pid of ["P1", "P2"] as PlayerId[]) {
    match.seats[pid].send({
      type: "state",
      state: viewFor(match.state, pid),
      events,
    });
  }
}

// Run an intent. Rejects anything sent by the player whose turn it is not, or
// on behalf of the other seat, before the engine even sees it.
export function submitIntent(match: Match, from: PlayerId, intent: BattleIntent): string | null {
  if (intent.pid !== from) return "That is not your seat";
  if (match.state.activePlayer !== from) return "Not your turn";

  const result = applyBattleIntent(match.state, intent);
  const illegal = result.events.find(e => e.type === "ILLEGAL");
  if (illegal && illegal.type === "ILLEGAL") return illegal.reason;

  match.state = result.state;
  broadcast(match, result.events);
  if (match.state.winner) { endMatch(match.id); return null; }
  runBotIfItsTurn(match);
  return null;
}
