/**
 * Score Battle, the numbers.
 *
 * Everything tunable lives in this file. The reducer next door reads these and
 * has no opinions of its own, so rebalancing the mode means editing constants
 * rather than logic.
 *
 * The mode is deliberately thin: no synergies, no weapons, no vows. A card is
 * worth its points, the captain seat doubles, and a card in the wrong seat
 * costs two. Everything else is what you know and what you deny.
 */

export type Seat = "captain" | "combat" | "support";

/** Where a card belongs. The same three words as the seats, on purpose. */
export type ScoreRole = Seat;

export type Grade = "common" | "rare" | "epic" | "legendary" | "mythic";

/** What each grade is worth. A card's own points sit inside its band. */
export const GRADE_POINTS: Record<Grade, { min: number; max: number }> = {
  common: { min: 1, max: 3 },
  rare: { min: 4, max: 6 },
  epic: { min: 7, max: 10 },
  legendary: { min: 12, max: 15 },
  mythic: { min: 16, max: 20 },
};

export const GRADES = ["common", "rare", "epic", "legendary", "mythic"] as const;

/** One player's team: one captain, three combat, three support. */
export const TEAM = { captain: 1, combat: 3, support: 3 } as const;
export const TEAM_SIZE = TEAM.captain + TEAM.combat + TEAM.support;

/** Cards face-down on the table at the start. Two teams take 14; six are left. */
export const TABLE_SIZE = 20;

/** Energy a turn, and what the two spendable actions cost. */
export const ENERGY_PER_TURN = 2;
export const COST = { reveal: 1, deny: 1 } as const;

/** Taking is free, but only once a turn. That limit is the whole clock. */
export const TAKES_PER_TURN = 1;

/** The captain seat doubles whatever sits in it. */
export const CAPTAIN_MULTIPLIER = 2;

/**
 * What a card in the wrong seat costs.
 *
 * This is what stops a player ever being fully denied. A seat is a price rather
 * than a wall: if the only thing you can reach is a combat card and your last
 * open seat is support, you can still take it, and you pay two points for the
 * mismatch instead of losing your turn.
 */
export const MISPLACED_PENALTY = 2;

export interface ScoreCard {
  id: string;
  role: ScoreRole;
  grade: Grade;
  /** Inside the band for its grade. Checked by assertGraded at load time. */
  points: number;
}

/** What one card in one seat is worth. Double first, then pay for the mismatch. */
export function valueOf(card: ScoreCard, seat: Seat): number {
  let value = card.points;
  if (seat === "captain") value *= CAPTAIN_MULTIPLIER;
  if (card.role !== seat) value -= MISPLACED_PENALTY;
  return value;
}

/** Throws on a card whose points fall outside its grade, at import rather than mid-game. */
export function assertGraded(cards: ScoreCard[]): void {
  for (const card of cards) {
    const band = GRADE_POINTS[card.grade];
    if (!band) throw new Error(`${card.id} has an unknown grade: ${card.grade}`);
    if (card.points < band.min || card.points > band.max) {
      throw new Error(
        `${card.id} is ${card.grade} but worth ${card.points}, outside ${band.min}-${band.max}`,
      );
    }
  }
}
