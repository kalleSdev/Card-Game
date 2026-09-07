import { randomUUID } from "node:crypto";
import type { BattleState, BattleIntent } from "@cg/battle";
import { createBattleState, applyBattleIntent, viewFor } from "@cg/battle";
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
}

const matches = new Map<string, Match>();

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
  if (match.state.winner) endMatch(match.id);
  return null;
}
