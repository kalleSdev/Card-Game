import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * The arena, measured once.
 *
 * The board is drawn at one fixed size and then scaled to whatever screen it
 * lands on, the way a physical board keeps its proportions whichever table you
 * put it on. Every number below is in that fixed size, so a value here means
 * the same thing on a laptop and on a television, and the two halves of the
 * board cannot drift apart because they are measured from the same middle.
 *
 * The measurements are taken off the board painting itself, scaled so that the
 * painted frame is the stage: in the reference the frame is 1438 x 973 inside a
 * 1920 x 1080 screen, which is why there is a margin down both sides here too.
 * The stage is taller than the painting by the height of one card, because a
 * painting does not have to hold a hand of real cards and this does.
 *
 * Vertical budget, top to bottom:
 *
 *      6   the rail their hand hangs from
 *    106   their hand, face down, cropped by the rail
 *    180   their wing band: two panels, the leader niche, the ability dial
 *     28   their leader's two stat boxes, hanging over the surface
 *    400   the surface, split by a seam into two halves of 200
 *    180   your wing band, mirrored
 *     28   your leader's two stat boxes
 *     88   your hand, cropped by the rail it sits behind
 *     44   the rail your hand sits on
 */

export const STAGE = {
  width: 1440,
  height: 1120,
} as const;

/** The painted frame around everything. */
export const FRAME = {
  /** How thick the painted plate reads at the edge. */
  thickness: 15,
  radius: 34,
  /** The dark surround the panels are set into, inside the plate. */
  bezel: 12,
  bezelRadius: 24,
} as const;

/** The two strips that are not the game. */
export const RAIL = {
  left: 92,
  right: 102,
} as const;

/** Everything between the rails, which is where the game happens. */
export const FIELD = {
  left: RAIL.left,
  right: STAGE.width - RAIL.right,
  get width() { return this.right - this.left; },
} as const;

/** The rails the two hands sit against, top and bottom. */
export const HAND_RAIL = {
  height: 44,
  topY: 6,
  bottomY: STAGE.height - 56,
  /** How far the rail runs past the field, towards the frame. */
  bleed: 68,
} as const;

/** Every band, as a top edge and a height, measured from the stage. */
export const BAND = {
  enemyHand: { top: 44, height: 106 },
  enemyWing: { top: 140, height: 180 },
  felt: { top: 340, height: 400 },
  yourWing: { top: 760, height: 180 },
  yourHand: { top: 976, height: 88 },
} as const;

/** The surface, and the seam that halves it. */
export const FELT = {
  top: BAND.felt.top,
  height: BAND.felt.height,
  get middle() { return this.top + this.height / 2; },
  /** How far the surface reaches past the field, under the frame. */
  bleed: 16,
} as const;

export const CARD_RATIO = 217 / 168;

export function cardHeight(width: number): number {
  return Math.round(width * CARD_RATIO);
}

/**
 * One size for every playing card.
 *
 * A card is the same object in your hand, on the surface, and in the other
 * player's hand, so it is drawn at one size everywhere. Nothing on this board
 * picks a card size of its own: a row that had to shrink to fit would be a row
 * that was measured wrong.
 */
export const CARD = {
  play: 132,
  get playHeight() { return cardHeight(this.play); },
  /** Between two cards laid side by side on the surface. */
  gap: 16,
  /** How much a card in a hand hides behind the one before it. */
  handOverlap: 26,
  /** How far a card lifts when it is pointed at, and when it is picked up. */
  hover: 34,
  lift: 74,
} as const;

/**
 * The window a leader stands in.
 *
 * It is a fixed opening in the board rather than a place a card is put down:
 * the card is cropped to the window's shape and set into it, so the leader
 * reads as part of the board and every leader is framed identically.
 */
export const LEADER_WINDOW = {
  width: 150,
  height: 180,
  /** The arch: a half circle on top of straight sides. */
  get archRadius() { return this.width / 2; },
  /** The painted trim around the opening. */
  trim: 9,
} as const;

/**
 * The two boxes under a leader, which is where its numbers live.
 *
 * A leader is not a card you read, it is a thing that is being worn down, so
 * its attack and health are set into the board beneath it and updated there
 * rather than printed on the picture.
 */
export const LEADER_STATS = {
  boxWidth: 64,
  boxHeight: 30,
  gap: 10,
  /** How far under the window the boxes hang. */
  drop: 4,
} as const;

/** The dial beside a leader. */
export const ABILITY = {
  size: 112,
  /** How far its centre sits from the centre of the leader window. */
  offset: 132,
} as const;

/**
 * Energy, as diamonds along the hand rail.
 *
 * One more appears each round, filling left to right, and a spent one goes
 * dark in place. Ten is the cap, and ten sockets are drawn from the start so
 * the row never changes length.
 */
export const ENERGY = {
  sockets: 10,
  size: 24,
  gap: 7,
  get width() { return this.sockets * this.size + (this.sockets - 1) * this.gap; },
} as const;

/** The deck stacks and the button, down the right. */
export const RIGHT = {
  deckWidth: 78,
  deckHeight: 106,
  /** Where the two decks sit, as a distance from the seam. */
  deckOffset: 116,
  buttonWidth: 152,
  buttonHeight: 56,
} as const;

/** The banner behind a leader, which is how the sides are told apart. */
export const BANNER = {
  width: 520,
  height: 122,
} as const;

/** How long the board takes to acknowledge a click, in milliseconds. */
export const MOTION = {
  card: 170,
  lift: 200,
  glow: 320,
} as const;

/**
 * The scale that fits the stage on this screen, with a hair of margin so the
 * frame never touches the edge of the window.
 */
export function stageScale(width: number, height: number): number {
  return Math.min(width / STAGE.width, height / STAGE.height) * 0.985;
}

/**
 * Fits the stage to whatever it has been given to sit in.
 *
 * It watches the element rather than the window, because the two are not the
 * same thing: a window event is late by a frame and misses anything that
 * resizes the page without resizing the window. Watching the box the board is
 * being drawn into catches every case and catches it before the next paint,
 * which is the difference between a board that resizes and a board that jumps.
 */
export function useStageFit(): { ref: RefObject<HTMLDivElement>; scale: number } {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(() => stageScale(window.innerWidth, window.innerHeight));

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const watch = new ResizeObserver(entries => {
      const size = entries[0]?.contentRect;
      if (size && size.width > 0 && size.height > 0) setScale(stageScale(size.width, size.height));
    });
    watch.observe(box);
    return () => watch.disconnect();
  }, []);

  return { ref, scale };
}
