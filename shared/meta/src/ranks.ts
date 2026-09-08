// The ladder. Eight ranks on fixed thresholds, then two decided by where you
// sit on the leaderboard rather than by a number.

export type RankId =
  | "iron" | "bronze" | "silver" | "gold" | "platinum"
  | "emerald" | "diamond" | "master" | "emperor" | "pirateKing";

export interface RankDef {
  id: RankId;
  name: string;
  /** Lowest MMR in this rank. */
  floor: number;
  /** Highest MMR, or null for the open-ended top rank. */
  ceiling: number | null;
  /** MMR lost on a defeat at this rank. */
  lossValue: number;
}

/** Every win is worth the same, wherever you are on the ladder. */
export const WIN_VALUE = 10;

export const STARTING_MMR = 0;

/** Ordered low to high. Emperor and Pirate King are not in here: they are earned on the leaderboard. */
export const RANKS: readonly RankDef[] = [
  { id: "iron",     name: "Iron",     floor: 0,   ceiling: 29,   lossValue: 5 },
  { id: "bronze",   name: "Bronze",   floor: 30,  ceiling: 59,   lossValue: 5 },
  { id: "silver",   name: "Silver",   floor: 60,  ceiling: 89,   lossValue: 5 },
  { id: "gold",     name: "Gold",     floor: 90,  ceiling: 119,  lossValue: 5 },
  { id: "platinum", name: "Platinum", floor: 120, ceiling: 149,  lossValue: 7 },
  { id: "emerald",  name: "Emerald",  floor: 150, ceiling: 179,  lossValue: 7 },
  { id: "diamond",  name: "Diamond",  floor: 180, ceiling: 209,  lossValue: 7 },
  { id: "master",   name: "Master",   floor: 210, ceiling: null, lossValue: 8 },
];

/** How many players hold each leaderboard rank. */
export const EMPEROR_SLOTS = 4;
export const PIRATE_KING_SLOTS = 1;

export const MASTER_FLOOR = 210;

export function rankForMmr(mmr: number): RankDef {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (mmr >= RANKS[i].floor) return RANKS[i];
  }
  return RANKS[0];
}

export function lossValueForMmr(mmr: number): number {
  return rankForMmr(mmr).lossValue;
}

/** MMR after a match, never dropping below zero. */
export function nextMmr(mmr: number, won: boolean): number {
  if (won) return mmr + WIN_VALUE;
  return Math.max(0, mmr - lossValueForMmr(mmr));
}

/**
 * Works out the leaderboard ranks. `standings` must be sorted best first and
 * contain only players at or above the Master floor.
 */
export function leaderboardRank(position: number, mmr: number): RankId | null {
  if (mmr < MASTER_FLOOR) return null;
  if (position === 0) return "pirateKing";
  if (position < PIRATE_KING_SLOTS + EMPEROR_SLOTS) return "emperor";
  return null;
}

/** The rank to show a player, leaderboard placing included. */
export function displayRank(mmr: number, leaderboardPosition: number | null): RankDef | { id: RankId; name: string } {
  if (leaderboardPosition !== null) {
    const top = leaderboardRank(leaderboardPosition, mmr);
    if (top === "pirateKing") return { id: "pirateKing", name: "Pirate King" };
    if (top === "emperor") return { id: "emperor", name: "Emperor" };
  }
  return rankForMmr(mmr);
}

/** Win rate needed to hold station at this MMR, as a fraction. */
export function breakEvenWinRate(mmr: number): number {
  const loss = lossValueForMmr(mmr);
  return loss / (WIN_VALUE + loss);
}
