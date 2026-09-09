import type { PlayerDraftResult } from "@cg/contracts";
import { applyBattleIntent, createBattleState, type BattleIntent } from "@cg/battle";
import {
  applyScoreIntent, createScoreMatch, scoreCardsFrom, scores,
  type ScoreIntent, type ScorePlayer,
} from "@cg/score";
import { cardsFor, type UniverseId } from "./universes.js";
import { payOutMatch, type OwnedPack } from "./packs.js";
import { postMatch } from "./feed.js";
import { recordResult } from "./auth.js";

/**
 * Matches played against the computer, paid for by the server.
 *
 * The client plays these on its own — there is no live socket for a practice
 * game and no reason to hold one open — so the result arrives after the fact.
 * A result the browser simply asserts would be worth exactly what it costs to
 * type, which is nothing, so nothing here is taken on trust: the client sends
 * the seed and every intent it played, and the server replays the whole match
 * through the same engine and works out the winner itself.
 *
 * That works because both engines are pure and seeded. The same seed and the
 * same intents can only produce the same game.
 *
 * What a practice match pays: the packs and Berries a match pays, and a line on
 * the feed. What it does not pay is MMR. The ladder is the one thing that has
 * to mean something, and a game against a bot you can restart until you win is
 * not evidence of anything.
 */

export interface Payout {
  won: boolean;
  packs: OwnedPack[];
  berries: number;
}

export class ReplayError extends Error {}

/** How many intents a submitted match may contain before it is refused. */
const MAX_INTENTS = 600;

function checkLength(intents: unknown[]): void {
  if (!Array.isArray(intents)) throw new ReplayError("No intents to replay");
  if (intents.length > MAX_INTENTS) throw new ReplayError("That is too long to be a match");
}

/**
 * Replays a Score match and pays the player if they won it.
 *
 * `you` is the seat the submitting player sat in, because the client decides
 * which side it played and the server has no other way to know.
 */
export function settleScoreMatch(
  user: { id: string; username: string },
  input: { seed: number; intents: { intent: ScoreIntent; by: ScorePlayer }[]; you: ScorePlayer },
  universe: UniverseId,
): Payout {
  checkLength(input.intents);

  const pool = scoreCardsFrom(cardsFor(universe));
  let state = createScoreMatch(pool, input.seed);

  for (const step of input.intents) {
    const { state: next, events } = applyScoreIntent(state, step.intent, step.by, pool);
    if (events.some(e => e.type === "REJECTED")) throw new ReplayError("That match does not replay");
    state = next;
  }

  if (!state.over) throw new ReplayError("That match is not finished");

  const table = scores(state, pool);
  const won = state.winner === input.you;
  return pay(user, won, "the computer", table.P1 + table.P2, universe);
}

/** The same, for a card battle. The drafts are part of what is replayed. */
export function settleBattleMatch(
  user: { id: string; username: string },
  input: {
    seed: number;
    p1: PlayerDraftResult;
    p2: PlayerDraftResult;
    intents: BattleIntent[];
    you: "P1" | "P2";
  },
  universe: UniverseId,
): Payout {
  checkLength(input.intents);

  const cardDb = cardsFor(universe);
  let state = createBattleState(input.p1, input.p2, cardDb, undefined, input.seed);

  for (const intent of input.intents) {
    const { state: next, events } = applyBattleIntent(state, intent);
    if (events.some(e => e.type === "ILLEGAL")) throw new ReplayError("That match does not replay");
    state = next;
  }

  if (!state.winner) throw new ReplayError("That match is not finished");

  const won = state.winner === input.you;
  return pay(user, won, "the computer", state.turn, universe);
}

/** What both modes do once the replay agrees on who won. */
function pay(
  user: { id: string; username: string },
  won: boolean,
  opponent: string,
  turns: number,
  universe: UniverseId,
): Payout {
  recordResult(user.id, opponent, won, turns);
  const { packs, berries } = payOutMatch(user.id, won, universe);
  postMatch(user, opponent, won, turns);
  return { won, packs, berries };
}
