import { GRADE_POINTS, TEAM, valueOf, type ScoreCard, type Seat } from "./rules";
import {
  applyScoreIntent, available, seatOf,
  type ScoreIntent, type ScorePlayer, type ScoreState, type SeatRef, type Team,
} from "./scoreEngine";

/**
 * The computer, playing Score.
 *
 * Deliberately legible rather than strong. It follows the same reasoning a
 * person would out loud on their first game, in order:
 *
 *   1. Take something good that is already face up.
 *   2. Otherwise look at a card, and take it if it turns out to be good.
 *   3. Otherwise take a blind card, because a free take is free.
 *   4. Spend anything left denying the best card still on the table.
 *
 * Placement is a separate job and a simpler one: it seats its best card as
 * captain and then puts everything else where it belongs, taking the mismatch
 * penalty only when it runs out of the right kind of seat.
 *
 * A bot that plays perfectly here would be a bot that counts cards, and this
 * mode is supposed to be a gamble. The one number worth tuning is GOOD_ENOUGH.
 */

/** Points at which the bot stops looking and takes. Mid rare. */
const GOOD_ENOUGH = 5;

/** Points above which the bot would rather nobody had it. */
const WORTH_DENYING = GRADE_POINTS.epic.min;

export function playScoreTurn(
  state: ScoreState,
  me: ScorePlayer,
  pool: ScoreCard[],
): { state: ScoreState; intents: ScoreIntent[] } {
  if (state.phase === "placement") return placeHand(state, me, pool);

  const by = new Map(pool.map(card => [card.id, card]));
  let current = state;
  const played: ScoreIntent[] = [];

  const run = (intent: ScoreIntent) => {
    const result = applyScoreIntent(current, intent, me, pool);
    // A rejected intent means the bot asked for something illegal. Stop rather
    // than loop: a turn that ends early is a bug worth seeing, not one to hide.
    if (result.events.some(e => e.type === "REJECTED")) return false;
    current = result.state;
    played.push(intent);
    return true;
  };

  const cardAt = (index: number) => {
    const id = current.cards[index];
    return id ? by.get(id) ?? null : null;
  };

  const faceUp = () => available(current).filter(i => current.table[i].revealed);
  const faceDown = () => available(current).filter(i => !current.table[i].revealed);

  const takeIndex = (index: number) => run({ type: "TAKE", index });

  // 1. Something good already face up
  if (current.takesLeft > 0) {
    const best = pickBest(faceUp(), cardAt);
    if (best !== null && (cardAt(best)?.points ?? 0) >= GOOD_ENOUGH) takeIndex(best);
  }

  // 2. Look, then decide
  if (current.takesLeft > 0 && current.energy > 0 && faceDown().length > 0) {
    const index = faceDown()[Math.floor(faceDown().length / 2)];
    if (run({ type: "REVEAL", index })) {
      const looked = cardAt(index);
      if (looked && looked.points >= GOOD_ENOUGH) takeIndex(index);
    }
  }

  // 3. A free take is free
  if (current.takesLeft > 0) {
    const pool2 = faceDown().length > 0 ? faceDown() : faceUp();
    if (pool2.length > 0) takeIndex(pool2[0]);
  }

  // 4. Deny the best thing left, if anything is worth it
  while (current.energy > 0 && !current.over) {
    const best = pickBest(faceUp(), cardAt);
    if (best === null || (cardAt(best)?.points ?? 0) < WORTH_DENYING) break;
    if (!run({ type: "DENY", index: best })) break;
  }

  if (!current.over) run({ type: "END_TURN" });
  return { state: current, intents: played };
}

function openSeats(team: Team): SeatRef[] {
  const seats: SeatRef[] = [];
  if (!team.captain) seats.push({ row: "captain", index: 0 });
  for (const row of ["combat", "support"] as Seat[]) {
    for (let i = 0; i < TEAM[row as "combat" | "support"]; i++) {
      if (!seatOf(team, { row, index: i })) seats.push({ row, index: i });
    }
  }
  return seats;
}

function pickBest(indexes: number[], cardAt: (i: number) => ScoreCard | null): number | null {
  let best: number | null = null;
  let bestPoints = -Infinity;
  for (const index of indexes) {
    const points = cardAt(index)?.points ?? -Infinity;
    if (points > bestPoints) {
      bestPoints = points;
      best = index;
    }
  }
  return best;
}

/**
 * Sits a whole hand at once. Highest value first, so the biggest number gets
 * the captain seat, and the rest fall into their own rows while there is room.
 */
export function placeHand(
  state: ScoreState,
  me: ScorePlayer,
  pool: ScoreCard[],
): { state: ScoreState; intents: ScoreIntent[] } {
  const by = new Map(pool.map(card => [card.id, card]));
  let current = state;
  const intents: ScoreIntent[] = [];

  const hand = () =>
    current.hands[me]
      .map(id => by.get(id))
      .filter((card): card is ScoreCard => Boolean(card))
      .sort((a, b) => b.points - a.points);

  let guard = 0;
  while (current.hands[me].length > 0 && guard++ < 32) {
    const cards = hand();
    if (cards.length === 0) break;

    const open = openSeats(current.teams[me]);
    if (open.length === 0) break;

    // Take the best pairing available: every card against every free seat
    let best: { card: ScoreCard; seat: SeatRef; value: number } | null = null;
    for (const card of cards) {
      for (const seat of open) {
        const value = valueOf(card, seat.row);
        if (!best || value > best.value) best = { card, seat, value };
      }
    }
    if (!best) break;

    const result = applyScoreIntent(
      current,
      { type: "PLACE", cardId: best.card.id, seat: best.seat },
      me,
      pool,
    );
    if (result.events.some(e => e.type === "REJECTED")) break;
    current = result.state;
    intents.push({ type: "PLACE", cardId: best.card.id, seat: best.seat });
  }

  return { state: current, intents };
}
