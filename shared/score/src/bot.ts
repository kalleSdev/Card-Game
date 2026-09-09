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
 *   1. Look at a card, if there is anything worth learning and energy to do it.
 *   2. Decide what to take.
 *   3. Deny the best card it is not taking, if that card is good enough to hurt.
 *   4. Take, which ends the turn. Or skip, if the table is poor and it can.
 *
 * Spending comes before taking because taking ends the turn. A bot that played
 * perfectly here would be one that counts cards, and this mode is supposed to
 * be a gamble. The one number worth tuning is GOOD_ENOUGH.
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

  /** The best seat for a card: its own row if free, else the cheapest mistake. */
  const bestSeat = (card: ScoreCard | null): SeatRef | null => {
    const team = current.teams[me];
    const open = openSeats(team);
    if (open.length === 0) return null;
    if (!card) return open[0];
    return open.reduce((best, seat) =>
      valueOf(card, seat.row) > valueOf(card, best.row) ? seat : best,
    );
  };

  const takeIndex = (index: number) => {
    const seat = bestSeat(cardAt(index));
    return seat ? run({ type: "TAKE", index, seat }) : false;
  };

  // 1. Look at something, while there is energy and anything to look at
  if (current.energy > 0 && faceDown().length > 0) {
    const index = faceDown()[Math.floor(faceDown().length / 2)];
    run({ type: "REVEAL", index });
  }

  // 2. What it would take: the best it can see, or a blind card if it cannot
  //    see anything worth having
  const bestUp = pickBest(faceUp(), cardAt);
  const bestPoints = bestUp === null ? 0 : cardAt(bestUp)?.points ?? 0;
  const target = bestPoints >= GOOD_ENOUGH ? bestUp : (faceDown()[0] ?? bestUp);

  // 3. Deny the best card it is leaving behind, if it is worth denying
  while (current.energy > 0) {
    const best = pickBest(faceUp().filter(i => i !== target), cardAt);
    if (best === null || (cardAt(best)?.points ?? 0) < WORTH_DENYING) break;
    if (!run({ type: "DENY", index: best })) break;
  }

  // 4. Take, which ends the turn. A poor table is worth skipping while it can.
  const poor = bestPoints < GOOD_ENOUGH && faceDown().length === 0;
  if (poor && current.skipsLeft[me] > 0) {
    run({ type: "SKIP" });
  } else if (target !== null && target !== undefined && current.takesLeft > 0) {
    takeIndex(target);
  } else if (current.skipsLeft[me] > 0) {
    run({ type: "SKIP" });
  }

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
