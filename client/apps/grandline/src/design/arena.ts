import { CARD_SIZE, SPACE, tallCardHeight } from "./tokens";

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
 * A match takes the whole window and never scrolls, so these are sized against
 * a screen rather than against a page with a sidebar in it.
 *
 * Two rules decide the numbers. The two teams are the same size as each other,
 * because a board where your side is bigger than theirs reads as a board that
 * is lying to you about the score. And the pool gives up the height when there
 * is not enough: it is twenty cards you glance across, against seven you are
 * building something out of.
 */

/**
 * How big the board draws, at the largest size the window can hold.
 *
 * The board must never scroll, and two things decide whether it does: the seats
 * and the pool. Rather than pick sizes that fit the worst case and look mean on
 * a large screen, the board asks the window and steps down the CARD_SIZE scale.
 *
 * The pool gives up its size first. It is twenty cards you glance across
 * against seven you are building a team out of, so when something has to shrink
 * it should be the shelf and not the hand.
 *
 * Each threshold is the height that board actually measures, rounded up, taken
 * from the rendered page rather than guessed. The last step is the floor: below
 * it there is nothing smaller on the scale, and a shorter window scrolls.
 */
export interface BoardSizes {
  seat: number;
  table: number;
}

const BOARD_STEPS: { minHeight: number; sizes: BoardSizes }[] = [
  { minHeight: 1100, sizes: { seat: CARD_SIZE.lg, table: CARD_SIZE.sm } },
  { minHeight: 1010, sizes: { seat: CARD_SIZE.md, table: CARD_SIZE.xs } },
  { minHeight: 0, sizes: { seat: CARD_SIZE.sm, table: CARD_SIZE.xs } },
];

export function boardSizesFor(windowHeight: number): BoardSizes {
  return (BOARD_STEPS.find(step => windowHeight >= step.minHeight) ?? BOARD_STEPS[2]).sizes;
}

/** The widest the pool ever draws, which is what sets the arena's width. */
export const ARENA_CARD = {
  table: CARD_SIZE.sm,
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

/** The gap between the three seat groups inside a team. */
export const SEAT_GROUP_GAP = SPACE.md;

/** One captain, three combat, three support. */
export const TEAM_COLUMNS = 7;

/**
 * The widest the play surface ever gets, so every band shares an edge. Seven
 * seats at full size are wider than ten pool cards, so the teams set it.
 */
export const ARENA_WIDTH = Math.max(
  gridWidth(TABLE_COLUMNS, ARENA_CARD.table, ARENA_GAP.card),
  gridWidth(TEAM_COLUMNS, CARD_SIZE.lg, ARENA_GAP.card) + 2 * SEAT_GROUP_GAP,
);

/** The strip down the left that holds everything which is not the game. */
export const ARENA_RAIL_WIDTH = 104;

/** A row of seats, measured the same way, so a team lines up under the table. */
export function seatRowWidth(count: number, card: number): number {
  return gridWidth(count, card, ARENA_GAP.card);
}


/**
 * Every slot is measured for the tallest card that could sit in it, so a row of
 * mixed grades shares one baseline and the two teams line up with each other.
 */
export function tableSlotHeight(tableCard: number): number {
  return tallCardHeight(tableCard);
}

export function seatSlotHeight(seatCard: number): number {
  return tallCardHeight(seatCard);
}

/**
 * The height of a plain card — the shape a common or rare Score card is cut to,
 * and the same proportions a base or foil collection card has.
 *
 * Face-down cards and empty seats draw at this height rather than at the slot's
 * full height. Most of what turns over is one of the two plain grades, so this
 * is the size that moves least when a card is revealed.
 */
const PLAIN_CARD_RATIO = 217 / 168;

export function plainCardHeight(width: number): number {
  return Math.round(width * PLAIN_CARD_RATIO);
}

/** The bar that says whose turn it is and what they have left to spend. */
export const TURN_BAR_HEIGHT = 48;

/** How long the board takes to acknowledge a click, in milliseconds. */
export const ARENA_MOTION = {
  flip: 420,
  settle: 260,
  handover: 520,
} as const;
