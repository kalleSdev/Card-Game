import { CARD_SIZE, SPACE, cardSlotHeight } from "./tokens";

/**
 * The play surface, measured.
 *
 * Every board in the game — Score, Draft, Deck — is laid out from this file.
 * Nothing on an arena picks its own width, gap or card size, because a board is
 * the one screen where a value invented in passing shows up as a row that does
 * not line up with the row above it.
 *
 * The shape is always the same three bands, top to bottom:
 *
 *   OPPONENT   what they have, at a glance, never interactive
 *   TABLE      the contested middle, where every click happens
 *   YOU        what you are building, and the thing you read most
 *
 * A match takes the whole window, so these are sized against a screen rather
 * than against a page with a sidebar in it. The rule is still fit: twenty cards
 * have to sit on the table at once. Your own team is the largest thing on the
 * board because it is the part you read closely; theirs matches the table,
 * since it is a glance and nothing more.
 */

export const ARENA_CARD = {
  /** Twenty of these at once, across the full width of the window. */
  table: CARD_SIZE.sm,
  /** Your own team, read closely and often. The biggest thing on the board. */
  yours: CARD_SIZE.md,
  /** Theirs. A glance and nothing more, and the row the board can afford to
      give up height on when a window is short. */
  theirs: CARD_SIZE.xs,
} as const;

export const ARENA_GAP = {
  /** Between cards in the same row. */
  card: SPACE.sm,
  /** Between a row and the next one. */
  row: SPACE.lg,
  /** Between the three bands. Tight on purpose: the whole board has to fit a
      laptop screen, and the bands are already separated by their own edges. */
  band: SPACE.md,
} as const;

/**
 * The table is a fixed grid, not a scatter: two rows of ten read as a shelf,
 * and both rows are reachable without the board moving under the cursor.
 */
export const TABLE_COLUMNS = 10;

export function gridWidth(columns: number, card: number, gap: number): number {
  return columns * card + (columns - 1) * gap;
}

/** The widest the play surface ever gets, so the bands always share an edge. */
export const ARENA_WIDTH = gridWidth(TABLE_COLUMNS, ARENA_CARD.table, ARENA_GAP.card);

/** A row of seats, measured the same way, so a team lines up under the table. */
export function seatRowWidth(count: number, card: number): number {
  return gridWidth(count, card, ARENA_GAP.card);
}

export const ARENA_SLOT = {
  table: cardSlotHeight(ARENA_CARD.table),
  yours: cardSlotHeight(ARENA_CARD.yours),
  theirs: cardSlotHeight(ARENA_CARD.theirs),
} as const;

/** The bar that says whose turn it is and what they have left to spend. */
export const TURN_BAR_HEIGHT = 48;

/** How long the board takes to acknowledge a click, in milliseconds. */
export const ARENA_MOTION = {
  flip: 420,
  settle: 260,
  handover: 520,
} as const;
