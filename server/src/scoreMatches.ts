import { randomUUID } from "node:crypto";
import {
  applyScoreIntent, createScoreMatch, playScoreTurn, scoreCardsFrom, scores, viewFor,
  type ScoreCard, type ScoreIntent, type ScorePlayer, type ScoreState,
} from "@cg/score";
import { cardsFor, type UniverseId } from "./universes.js";

/**
 * Score Battle between two people, held by the server.
 *
 * The deal is the whole game, so the server keeps it. A client is sent the
 * table with every face-down card blanked out, which is what `viewFor` is for:
 * a blind take has to be genuinely blind, and it would not be if the browser
 * were holding the answers. The seed is kept back for the same reason — it
 * would reproduce the deal exactly.
 *
 * A seat that stops answering is played by the bot rather than losing on the
 * clock. The table runs out either way, and a game that finishes pays both
 * players, which is kinder than punishing a dropped connection.
 */

export interface ScoreSeat {
  name: string;
  /** Who to pay when it is over. Absent for a seat nobody is signed in to. */
  userId?: string;
  send: (msg: unknown) => void;
}

export interface ScoreGame {
  id: string;
  state: ScoreState;
  pool: ScoreCard[];
  universe: UniverseId;
  seats: Record<ScorePlayer, ScoreSeat>;
  createdAt: number;
}

const games = new Map<string, ScoreGame>();

export function createScoreGame(universe: UniverseId, p1: ScoreSeat, p2: ScoreSeat): ScoreGame {
  const pool = scoreCardsFrom(cardsFor(universe));
  const seed = (Math.random() * 0xffffffff) >>> 0;
  const game: ScoreGame = {
    id: randomUUID(),
    state: createScoreMatch(pool, seed),
    pool,
    universe,
    seats: { P1: p1, P2: p2 },
    createdAt: Date.now(),
  };
  games.set(game.id, game);
  return game;
}

export function getScoreGame(id: string): ScoreGame | undefined {
  return games.get(id);
}

export function endScoreGame(id: string): void {
  games.delete(id);
}

/** Points a seat at a new socket, after that player reconnects. */
export function rebindScoreSeat(game: ScoreGame, player: ScorePlayer, send: (msg: unknown) => void): void {
  game.seats[player].send = send;
}

/** Applies an intent, or says why it will not. */
export function submitScoreIntent(
  game: ScoreGame,
  player: ScorePlayer,
  intent: ScoreIntent,
): string | null {
  if (game.state.over) return "That match is over";
  if (game.state.turn !== player) return "It is not your turn";

  const { state, events } = applyScoreIntent(game.state, intent, player, game.pool);
  const refused = events.find(e => e.type === "REJECTED");
  if (refused && "reason" in refused) return refused.reason;

  game.state = state;
  return null;
}

/** The bot takes a turn for a seat that has gone quiet, so the game still ends. */
export function playScoreFor(game: ScoreGame, player: ScorePlayer): void {
  if (game.state.over || game.state.turn !== player) return;
  game.state = playScoreTurn(game.state, player, game.pool).state;
}

/** The state as one player is allowed to see it. */
export function scoreViewFor(game: ScoreGame, player: ScorePlayer): ScoreState {
  return viewFor(game.state, player);
}

export function scoreTotals(game: ScoreGame): Record<ScorePlayer, number> {
  return scores(game.state, game.pool);
}

/** How many games are being held, for the health check. */
export function liveScoreGames(): number {
  return games.size;
}
