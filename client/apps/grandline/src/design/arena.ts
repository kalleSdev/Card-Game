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

export const ARENA_CARD = {
  /** Twenty of these at once. The row that shrinks when a window is short. */
  table: CARD_SIZE.sm,
} as const;

/**
 * A seat, on either side of the board, at the largest size the window can hold.
 *
 * The board must never scroll, and the two things that decide whether it does
 * are the seat size and the window. Rather than pick a size that fits the worst
 * case and looks mean on a large screen, the board asks: a tall window gets the
 * full-size seat, a short one steps down. Both are on the CARD_SIZE scale, and
 * the threshold is the height the full-size board actually needs.
 */
/**
 * What the board actually measures at each seat size, rounded up. Taken from
 * the rendered board rather than guessed: the full-size seat needs 1052, the
 * step below it 940, and the smallest 894. That last one is the floor — the
 * card scale has nothing smaller — so a window shorter than that scrolls.
 */
export const FULL_BOARD_HEIGHT = 1055;
export const MID_BOARD_HEIGHT = 920;

export function seatCardFor(windowHeight: number): number {
  if (windowHeight >= FULL_BOARD_HEIGHT) return CARD_SIZE.md;
  if (windowHeight >= MID_BOARD_HEIGHT) return CARD_SIZE.sm;
  return CARD_SIZE.xs;
}

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
export const SEAT_GROUP_GAP = SPACE.lg;

/** One captain, three combat, three support. */
export const TEAM_COLUMNS = 7;

/**
 * The widest the play surface ever gets, so every band shares an edge. Seven
 * seats at full size are wider than ten pool cards, so the teams set it.
 */
export const ARENA_WIDTH = Math.max(
  gridWidth(TABLE_COLUMNS, ARENA_CARD.table, ARENA_GAP.card),
  gridWidth(TEAM_COLUMNS, CARD_SIZE.md, ARENA_GAP.card) + 2 * SEAT_GROUP_GAP,
);

/** A row of seats, measured the same way, so a team lines up under the table. */
export function seatRowWidth(count: number, card: number): number {
  return gridWidth(count, card, ARENA_GAP.card);
}


/**
 * Every slot is measured for the tallest card that could sit in it, so a row of
 * mixed grades shares one baseline and the two teams line up with each other.
 */
export const ARENA_SLOT = {
  table: tallCardHeight(ARENA_CARD.table),
} as const;

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
