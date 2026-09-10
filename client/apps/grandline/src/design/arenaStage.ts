import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * The arena, measured once.
 *
 * The board is drawn at one fixed size and then scaled to whatever screen it
 * lands on, the way a physical board keeps its proportions whichever table you
 * put it on. Every number below is in that fixed size, so a value here means
 * the same thing on a laptop and on a television.
 *
 * The board is built as an object rather than as a set of bands: a thick slab
 * with a well cut into it, a rim around the well, a plinth at each end holding
 * a leader, sockets in the right hand rim for the decks, and shelves at the
 * corners for whatever is resting on it. Everything else is measured off those
 * parts, so moving a part moves what sits on it.
 *
 * The board is seen from slightly above and in front, so it narrows towards the
 * far end and its near edge shows its thickness. That is not decoration: it is
 * what tells a player which end is theirs before they have read anything.
 */

export const STAGE = {
  width: 1440,
  height: 1120,
} as const;

/**
 * The slab.
 *
 * Given at both depths, because everything on this board tapers. Ask
 * `slabEdges(y)` for the width at a depth rather than working it out again.
 */
export const BOARD = {
  /** The slab's far edge, and where its near edge begins. */
  farY: 96,
  nearY: 976,
  /** How much of the slab's thickness shows along the near edge. */
  lip: 28,
  farX0: 150,
  farX1: 1290,
  nearX0: 60,
  nearX1: 1380,
  round: 46,
} as const;

/** The opening cut into the slab, which the playing surface sits down inside. */
export const WELL = {
  farY: 250,
  nearY: 770,
  farX0: 300,
  farX1: 1140,
  nearX0: 200,
  nearX1: 1240,
  /** How far the surface sits below the rim it is set into. */
  depth: 20,
  round: 28,
  /** Where the two halves meet. */
  get seamY() { return (this.farY + this.nearY) / 2; },
  get height() { return this.nearY - this.farY; },
} as const;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/** How far along the board a depth is: 0 at the far edge, 1 at the near one. */
export function depthOf(y: number): number {
  return clamp((y - BOARD.farY) / (BOARD.nearY - BOARD.farY));
}

/** The slab's two edges at a given depth. */
export function slabEdges(y: number): { x0: number; x1: number } {
  const t = depthOf(y);
  return { x0: lerp(BOARD.farX0, BOARD.nearX0, t), x1: lerp(BOARD.farX1, BOARD.nearX1, t) };
}

/** The well's two edges at a given depth. */
export function wellEdges(y: number): { x0: number; x1: number } {
  const t = clamp((y - WELL.farY) / (WELL.nearY - WELL.farY));
  return { x0: lerp(WELL.farX0, WELL.nearX0, t), x1: lerp(WELL.farX1, WELL.nearX1, t) };
}

/**
 * The two blocks that carry the leaders.
 *
 * A plinth is raised out of the rim and breaks into the well, so a leader has a
 * piece of the board built around it rather than a panel laid on top of it. The
 * far one is smaller because it is further away.
 */
export const PLINTH = {
  far: { top: BOARD.farY, bottom: 300, width: 320 },
  near: { top: 745, bottom: BOARD.nearY, width: 366 },
  get centreX() { return STAGE.width / 2; },
} as const;

/** How much smaller everything on the far side of the board draws. */
export const FAR_SCALE = 0.88;

/** How much of the far half is taken by the air between here and there. */
export const HAZE = 0.16;

export const CARD_RATIO = 217 / 168;

export function cardHeight(width: number): number {
  return Math.round(width * CARD_RATIO);
}

/**
 * One size for every playing card.
 *
 * A card is the same object in your hand and on the surface, so it is drawn at
 * one size in both. The far side draws its cards at FAR_SCALE of this, which is
 * distance rather than a different card.
 */
export const CARD = {
  play: 132,
  get playHeight() { return cardHeight(this.play); },
  gap: 16,
  /** How much a card in a hand hides behind the one before it. */
  handOverlap: 26,
  /** How far a card lifts when it is pointed at, and when it is picked up. */
  hover: 34,
  lift: 74,
} as const;

/** Where the two hands hang off the board's ends. */
export const HAND = {
  /**
   * Theirs is held over the far edge of the board, so it overlaps the slab
   * rather than floating above it. The leader is drawn after it and therefore
   * over it, which is what puts the cards behind the plinth where a hand held
   * at the far end of a table would be.
   */
  farTop: 26,
  farHeight: 104,
  /** Yours is held over the near edge, hanging off the board towards you. */
  nearTop: 966,
} as const;

/**
 * The window a leader stands in.
 *
 * A fixed opening in the plinth rather than a place a card is put down: the
 * picture is cropped to the window's shape and set into it, so the leader reads
 * as part of the board and every leader is framed identically.
 */
export const LEADER_WINDOW = {
  width: 148,
  height: 176,
  get archRadius() { return this.width / 2; },
  /** The carved trim around the opening. */
  trim: 10,
} as const;

/**
 * The two boxes under a leader, which is where its numbers live.
 *
 * A leader is a thing being worn down rather than a card you read, so its
 * attack and health are set into the plinth beneath it and updated there.
 */
export const LEADER_STATS = {
  boxWidth: 64,
  boxHeight: 30,
  gap: 10,
  drop: 6,
} as const;

/** The dial beside a leader. */
export const ABILITY = {
  size: 104,
  /** How far its centre sits from the centre of the leader window. */
  offset: 130,
} as const;

/**
 * Energy, carved into the rim in front of each player.
 *
 * One more socket fills each round, left to right, and a spent one goes dark in
 * place. Ten are cut from the start so the row never changes length.
 */
export const ENERGY = {
  sockets: 10,
  size: 24,
  gap: 7,
  get width() { return this.sockets * this.size + (this.sockets - 1) * this.gap; },
  /** Where the row starts, measured from the middle of the board. */
  offsetX: 200,
} as const;

/** The deck sockets and the button, cut into the right hand rim. */
export const RIGHT = {
  deckWidth: 78,
  deckHeight: 106,
  /** How far each socket sits from the seam. */
  deckOffset: 138,
  buttonWidth: 148,
  buttonHeight: 54,
} as const;

/** The banner behind a leader, which is how the sides are told apart. */
export const BANNER = {
  farWidth: 470,
  nearWidth: 540,
  height: 104,
} as const;

/** The corners of the rim, where anything resting on the board stands. */
export const SHELF = {
  /** How far in from the slab's edge a prop may stand. */
  inset: 36,
} as const;

/** How long the board takes to acknowledge a click, in milliseconds. */
export const MOTION = {
  card: 170,
  lift: 200,
  glow: 320,
} as const;

/**
 * The stack, from the table up.
 *
 * Every layer of the arena is named here once and nowhere else. Before this
 * existed each component picked its own z-index and the order was whatever the
 * numbers happened to say. A board is a physical stack of things, so the stack
 * is declared in one place and components take their place in it rather than
 * arguing about it.
 *
 * The gaps of ten leave room to slip a layer in without renumbering the rest.
 */
export const LAYER = {
  /** The room the board is standing in. */
  scene: 0,
  /** Air between the room and the board: haze, light, distance. */
  atmosphere: 10,
  /** The board as an object: its slab, its rim, its plinths, its sockets. */
  structure: 20,
  /** The surface that is played on, set down inside the well. */
  surface: 30,
  /** Things resting on the board that are not part of the game. */
  props: 40,
  /** Leaders, cards, decks, hands: everything the rules know about. */
  play: 50,
  /** What the board says about what you can do right now. */
  highlight: 60,
  /** Dust, sparks, and whatever a blow throws up. */
  particles: 70,
  /** Writing, and the one button. */
  hud: 80,
} as const;

export type LayerName = keyof typeof LAYER;

/**
 * How far each layer stands from the surface, in the board's own units.
 *
 * The surface is zero, the room is a long way behind it, and the cards and
 * their dust stand in front. These are what turn the lean into depth: with
 * everything at zero the board tips as one flat sheet, and with the layers
 * spread along Z they slide against each other the way a real stack does.
 */
export const DEPTH: Record<LayerName, number> = {
  scene: -420,
  atmosphere: -260,
  structure: -40,
  surface: 0,
  props: 26,
  play: 60,
  highlight: 72,
  particles: 120,
  hud: 150,
};

/** Which layers can be clicked. Everything else lets the cursor through. */
export const LAYER_TAKES_CLICKS: Record<LayerName, boolean> = {
  scene: false,
  atmosphere: false,
  structure: false,
  surface: false,
  props: false,
  play: true,
  highlight: false,
  particles: false,
  hud: true,
};

/**
 * How far the eye is from the board.
 *
 * One value, shared by the whole arena, because perspective only reads as
 * perspective if every layer agrees where the viewer is standing.
 */
export const PERSPECTIVE = 2400;

/**
 * The lean towards the cursor.
 *
 * Small on purpose. It is enough that the board answers you and not enough that
 * anybody has to aim, which is the only budget a board that is also a control
 * surface can afford.
 */
export const TILT = {
  degrees: 1.6,
  /** How far the room slides the other way, which is what sells the distance. */
  sceneDrift: 14,
  settle: 220,
} as const;

/**
 * Where the light is.
 *
 * One lamp, hung high and a little to the left, over the far half of the board.
 * Every lit edge, every shadow and every falloff is worked out from this and
 * nothing else, because a board lit from two directions reads as a drawing
 * rather than as an object.
 */
export const LIGHT = {
  x: 596,
  y: 40,
  /** How far the light reaches before the board is left to the dark. */
  reach: 1180,
} as const;

/**
 * Where a layer sits, as a transform.
 *
 * Standing a layer off the surface makes it bigger or smaller, because that is
 * what distance does. The scale here undoes exactly that much, so a layer keeps
 * the footprint its measurements gave it and only its parallax changes.
 */
export function depthTransform(z: number): string {
  return `translateZ(${z}px) scale(${(PERSPECTIVE - z) / PERSPECTIVE})`;
}

/**
 * The scale that fits the stage on this screen, with a hair of margin so the
 * board never touches the edge of the window.
 */
export function stageScale(width: number, height: number): number {
  return Math.min(width / STAGE.width, height / STAGE.height) * 0.985;
}

/**
 * Fits the stage to whatever it has been given to sit in.
 *
 * It watches the element rather than the window, because the two are not the
 * same thing: a window event is late by a frame and misses anything that
 * resizes the page without resizing the window.
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
