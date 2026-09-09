import { useEffect, useState } from "react";

/**
 * The arena, measured once.
 *
 * The board is drawn at one fixed size and then scaled to whatever screen it
 * lands on, the way a physical board keeps its proportions whichever table you
 * put it on. Everything below is in that fixed size, so a number here means the
 * same thing on a laptop and on a television, and the two halves of the board
 * cannot drift apart because they are measured from the same middle.
 *
 * The stage is a little squarer than a widescreen monitor, which is why there
 * is a margin down the sides on a 16:9 screen. That is deliberate: the board is
 * an object on a dark table rather than a page that stretches to the corners.
 *
 * Vertical budget, top to bottom, adding up to STAGE.height exactly:
 *
 *   92   their hand, face down along the top edge
 *   178  their wing band: leader, ability, energy, and the two panels
 *   194  their half of the surface
 *   194  your half of the surface
 *   178  your wing band, mirrored
 *   164  your hand along the bottom edge
 */

export const STAGE = {
  width: 1440,
  height: 1000,
  /** The painted frame around the whole thing. */
  frame: 15,
  /** The strip down the left for the things that are not the game. */
  leftRail: 92,
  /** The strip down the right: two decks and the button that ends a turn. */
  rightRail: 104,
} as const;

/** Every band, as a top edge and a height, measured from the stage. */
export const BAND = {
  enemyHand: { top: 0, height: 92 },
  enemyWing: { top: 92, height: 178 },
  enemyFelt: { top: 270, height: 194 },
  yourFelt: { top: 464, height: 194 },
  yourWing: { top: 658, height: 178 },
  yourHand: { top: 836, height: 164 },
} as const;

/** Where the surface starts and stops, since both halves share it. */
export const FELT = {
  top: BAND.enemyFelt.top,
  height: BAND.enemyFelt.height + BAND.yourFelt.height,
  /** Inset from the rails, so the frame reads as holding the surface. */
  inset: 26,
} as const;

/**
 * Card sizes on the board.
 *
 * A slot is sized to the band that holds it rather than picked by eye: the
 * tallest card that fits a 190 band with room to breathe is 176, and every card
 * on the board is cut to the same proportions, so the width follows from that.
 */
export const CARD_RATIO = 217 / 168;

export const ARENA_CARDS = {
  /** A card in play. Both sides use the same one, always. */
  slot: 132,
  /** The leader, standing in its arch. */
  leader: 118,
  /** A card in your hand, which is the one you actually read. */
  hand: 110,
  /** Their hand, face down. Nothing to read, so it only has to be countable. */
  enemyHand: 58,
} as const;

export function cardHeight(width: number): number {
  return Math.round(width * CARD_RATIO);
}

/** The gap between two cards in the same row. */
export const ARENA_GAPS = {
  slot: 16,
  hand: -18,
  enemyHand: -22,
} as const;

/** The arch a leader stands in, and the dial beside it. */
export const LEADER = {
  archWidth: ARENA_CARDS.leader + 24,
  archHeight: cardHeight(ARENA_CARDS.leader) + 24,
  dial: 104,
  /** Where the arch starts, measured from the outer edge of its band. */
  inset: 14,
  /** How far it hangs over the surface, so it stands in front of it. */
  overlap: 22,
} as const;

/** The banner behind a leader, which is how the sides are told apart. */
export const BANNER = {
  width: 470,
  height: 116,
} as const;

/** The deck stacks and the button, down the right. */
export const RIGHT = {
  deckWidth: 62,
  deckHeight: 86,
  buttonWidth: 140,
  buttonHeight: 54,
} as const;

/** How many pips the energy rail can show before it stops drawing them. */
export const ENERGY_PIPS = 10;

/**
 * The scale that fits the stage on this screen, with a hair of margin so the
 * frame never touches the edge of the window.
 */
export function stageScale(width: number, height: number): number {
  return Math.min(width / STAGE.width, height / STAGE.height) * 0.985;
}

export function useStageScale(): number {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return stageScale(size.w, size.h);
}
