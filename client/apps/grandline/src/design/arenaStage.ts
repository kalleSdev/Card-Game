import { useEffect, useRef, useState, type RefObject } from "react";
import { ENERGY_CAP } from "@cg/battle";

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
 * a leader, sockets in the right hand rim for the decks, and a base under the
 * corners for whatever is resting on it. Everything else is measured off those
 * parts, so moving a part moves what sits on it.
 *
 * The board is symmetrical about one line. `CENTRE.y` is the seam, the two rims
 * are the same thickness, the two halves of the well are the same depth, and
 * every seat on the board is given for the far side and asked for by side, with
 * `mirrorY` doing the other one. That is the only way two players get the same
 * board: not by writing each end out and keeping them in step by hand, but by
 * there only being one end to write.
 *
 * The camera is almost overhead. There is still a taper and the near edge still
 * shows its thickness, because without those the board is a diagram; but both
 * are shallow, because a player is looking down at a table rather than across
 * one. The whole camera lives in four pairs of numbers below — the slab's edges
 * and the well's — plus how much smaller the far side draws. Nothing else in
 * the arena decides the angle.
 */

/**
 * The composition, in the board's own units.
 *
 * The height is what decides how much of a screen the board takes: it is the
 * smaller of the two fits on every ordinary monitor, so a taller stage is a
 * camera further back. It used to be as tight as the hand allowed, and the
 * board touched every edge of the screen; there is room now above the board
 * for the far end of the room, and below it for the table the board is
 * standing on and the whole of your hand, which is what it takes for the
 * board to read as an object in a place rather than as the screen itself.
 */
export const STAGE = {
  width: 1440,
  height: 966,
  /**
   * The part of the stage that is on screen: from `top` down, `fit` deep.
   * Above it is the upper half of their hand, held beyond the far edge of the
   * table and cut off by the top of the window; below it is the foot of your
   * hand, cut off by the bottom. The stage is fitted to this band and the
   * rest runs past the window's edges, the way a table seen from a chair
   * runs past the edges of what you are looking at.
   */
  top: 110,
  fit: 826,
} as const;

/**
 * How much of a wider screen the board takes, against how much the room does.
 *
 * On a wide screen the stage grows past the composition by `spread` on each
 * side. The board used to take all of it and reach the edges of the screen;
 * now it takes this share and the table around it takes the rest, so a wider
 * screen shows more board *and* more room, in the same proportion at every
 * width.
 */
export const REACH = 0;

/** How far past the composition the board itself extends, for a given spread. */
export function boardReach(spread: number): number {
  return spread * REACH;
}

/**
 * The slab.
 *
 * Given at both depths, because everything on this board tapers. Ask
 * `slabEdges(y)` for the width at a depth rather than working it out again.
 */
export const BOARD = {
  /**
   * The slab's far edge, and where its near edge begins.
   *
   * The board sits low enough in the stage for their whole hand to be held
   * above it — a hand cut off by the top of the screen is a hand you cannot
   * count — and what is left below it is exactly a hand card deep, which is
   * all yours needs.
   */
  farY: 206,
  nearY: 802,
  /**
   * How much of the slab's thickness shows along the near edge.
   *
   * From almost overhead you catch the edge rather than see the side of it.
   */
  lip: 18,
  /**
   * The far edge is 4% narrower than the near one.
   *
   * That is the whole angle of the camera. Enough that the near rim reads as
   * the nearer one, little enough that the table reads as a table seen from
   * above rather than a stage seen from a seat.
   */
  farX0: 73,
  farX1: 1367,
  nearX0: 46,
  nearX1: 1394,
  round: 38,
} as const;

/**
 * How thick the rim is, at both ends.
 *
 * One number, so the two rims cannot drift apart. Everything a player has on
 * their side of the board — their leader, their name, their energy — is seated
 * in a band this deep, and a band this deep at the other end holds exactly the
 * same things at exactly the same distances from the edge.
 */
export const RIM_DEPTH = 115;

/** The opening cut into the slab, which the playing surface sits down inside. */
export const WELL = {
  farY: BOARD.farY + RIM_DEPTH,
  nearY: BOARD.nearY - RIM_DEPTH,
  farX0: 253,
  farX1: 1187,
  nearX0: 229,
  nearX1: 1211,
  /** How far the surface sits below the rim it is set into. */
  depth: 6,
  round: 28,
  /** Where the two halves meet. */
  get seamY() { return (this.farY + this.nearY) / 2; },
  get height() { return this.nearY - this.farY; },
} as const;

/**
 * The board's own middle.
 *
 * Not the stage's middle: the stage carries a hand below the board and the
 * board does not, so the two are a few dozen units apart. Everything that has
 * to match between the two players is measured from here.
 */
export const CENTRE = {
  x: (BOARD.nearX0 + BOARD.nearX1) / 2,
  y: (BOARD.farY + BOARD.nearY) / 2,
} as const;

/** The same depth, on the other side of the seam. */
export function mirrorY(y: number): number {
  return CENTRE.y * 2 - y;
}

/** Which end of the board something belongs to. */
export type Side = "far" | "near";

/** A stretch of the board's depth, as the box anything sitting in it gets. */
export interface Band {
  top: number;
  height: number;
}

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
 * How much smaller everything on the far side of the board draws.
 *
 * Nothing, now. The far end used to be shrunk by hand when the board was
 * seen from straight above; the camera is a real one now and does that
 * itself, and a second shrink on top was one more resampling of every far
 * card for no depth the pitch was not already giving.
 */
export const FAR_SCALE = 1;

/**
 * How much of the far half is taken by the air between here and there.
 *
 * The cheapest depth cue the board has, and the near half gets nothing at all,
 * so the whole of the near/far separation is this one number.
 */
export const HAZE = 0.14;

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
 *
 * The size is set against the board rather than against the screen: a card is
 * about a seventh of the width of the slab it is lying on, which is roughly
 * what a card is against a real table, and five of them plus their gaps come to
 * four fifths of the playing surface. Below that the board stops looking like a
 * board with cards on it and starts looking like a board with counters on it.
 */
export const CARD = {
  /**
   * A card on the field. Smaller than one in your hand: the field has two
   * rows to hold between two stations with room to spare round each, and a
   * card in play is read from further away for less — what it hits for and
   * what is left of it — while a card in hand is read for everything it says.
   */
  play: 104,
  get playHeight() { return cardHeight(this.play); },
  /** A card in your hand: a little larger than on the reference, so it can be read. */
  hand: 116,
  get handHeight() { return cardHeight(this.hand); },
  gap: 16,
  /** How much a card in a hand hides behind the one before it. */
  handOverlap: 42,
  /** How far a card lifts when it is pointed at, and when it is picked up. */
  hover: 40,
  lift: 86,
  /** How far a card's own furniture sits in from its edges. */
  inset: 12,
} as const;

/**
 * The battlefield: the parchment, as the one rectangle every card on it is
 * placed from.
 *
 * The parchment tapers with the board, so the rectangle is the parchment's
 * far width, which is the narrowest, and its full depth. Three zones are
 * measured off it and nothing draws them: the surface is one sheet, and the
 * zones are where things go on it, not marks on it. Each side's zone is a
 * row deep and starts one clearance in from where its own station stands out
 * over the parchment; what is left between the two is the middle, where the
 * sides meet. Given once for the far side and reflected, so the two are one
 * shape.
 */
export const ZONE = {
  /** Clear parchment between a station's edge and the row in front of it. */
  clearance: 4,
} as const;

export interface Battlefield extends Box {
  /** Their row. */
  opponent: Box;
  /** The open middle, where the two sides meet. */
  center: Box;
  /** Your row. */
  player: Box;
}

export function battlefield(): Battlefield {
  const x = WELL.farX0 + WELL.depth;
  const width = WELL.farX1 - WELL.farX0 - WELL.depth * 2;
  const y = WELL.farY + WELL.depth / 2;
  const height = WELL.nearY - WELL.farY - WELL.depth;

  const far = station("far").plate.body;
  const rowTop = far.y + far.height + ZONE.clearance;
  const row = CARD.playHeight;
  const opponent = { x, y: rowTop, width, height: row };
  const player = { x, y: mirrorY(rowTop + row), width, height: row };
  const center = { x, y: rowTop + row, width, height: player.y - (rowTop + row) };

  return { x, y, width, height, opponent, center, player };
}

/** The band one side's cards in play lie in: its zone of the battlefield. */
export function cardBand(side: Side): Band {
  const zone = side === "far" ? battlefield().opponent : battlefield().player;
  return { top: zone.y, height: zone.height };
}

/** The outer edge of that band, which is where the plinth behind it stops. */
export function cardOuter(side: Side): number {
  const band = cardBand(side);
  return side === "far" ? band.top : band.top + band.height;
}

/**
 * The leader's seat, as one piece of geometry for both players.
 *
 * A leader is the centrepiece of its own end of the board, so it is big, it is
 * centred exactly on the board's middle line, and it is set into the board's
 * outer edge at a fixed inset — the same inset at both ends, which is what
 * stops one leader sticking out of the frame further than the other.
 *
 * Its two numbers flank the window rather than hanging under it. Under is where
 * the eye goes for a number, but under is also where the cards are: a plate
 * below the far window and a plate below the near one are in two completely
 * different places relative to the play area, and one of them ends up behind a
 * card. Beside the window they are in the same place at both ends, they mirror
 * each other about the middle line as well as about the seam, and they sit on
 * the rim where nothing is ever laid on top of them.
 *
 * The ability dial and the energy channel are not part of this: they are the
 * rest of the same station, and they live in `station()` because they are cut
 * into the rim rather than measured off the window.
 */
export const LEADER = {
  window: { width: 110, height: 133 },
  /** The brass retaining frame around the opening. */
  trim: 12,
  /**
   * The smallest step the niche takes: a third of the frame. It is the dark
   * seat between the opening and the picture, and the rounding of the
   * picture's bottom corners; every layer outside the picture widens it by
   * its own offset, which is what keeps an arch an arch at every size.
   */
  foot: 4,
  /** How far in from the opening the picture starts: the seat. */
  get picture() { return this.foot; },
  /**
   * One of the two number plates, and how far in from a shoulder's outer edge
   * its middle sits. They stand on the plate's shoulders, at the corners that
   * face the field, half over the edge the way a plaque screwed to the foot
   * of a frame is.
   */
  stat: { width: 54, height: 30, gap: 33 },
} as const;

export interface LeaderSeat {
  /** The window, as a box on the stage. */
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * The depth everything else on this rim lines up with: the window's own
   * middle, so the leader, the name, the dial and the energy row all sit on one
   * line and that line is the mirror of the other player's.
   */
  line: number;
}

export function leaderSeat(side: Side): LeaderSeat {
  const { width, height } = LEADER.window;
  // As with the rows: given for the far end and reflected for the near one.
  // The window sits in the station's face, one pad in from its outer edge.
  const farTop = BOARD.farY - STATION.plate.out + STATION.plate.pad;
  const y = side === "far" ? farTop : mirrorY(farTop + height);

  return {
    x: CENTRE.x - width / 2,
    y,
    width,
    height,
    line: y + height / 2,
  };
}

/**
 * The fittings down the two sides of the board, mounted on the rim.
 *
 * On the left the board's information — which game this is, whose turn it
 * is — and the way out; on the right the two decks and the
 * button that ends a turn. None of that is the game, so it is all out at the
 * sides away from the field, and each piece is its own fitting set into the
 * rim: a plate with a brass edge, a stone in a ring, a well with a brass
 * frame. There is no housing behind them. The wood, the brass and the stone
 * frame run on underneath, and the fittings sit across them where the rim is
 * too narrow to hold them on the wood alone.
 *
 * Each column is centred on the board's own middle, so it reads as one thing
 * rather than as two clusters at opposite ends of the rim, and each fitting
 * is measured from the rim's own edges at its depth, so the column follows
 * the board's taper.
 */
export const SIDE = {
  /** Clear wood between the slab's edge and a fitting. */
  margin: 8,
  /** Clear wood between the slab's edge and the right column. */
  edge: 19,
  /** Rim between one fitting and the next. */
  gap: 10,
  /** The left column: the actions plate, the two plates, and the key. */
  width: 108,
  actions: 34,
  plaque: 58,
  status: 62,
  leave: 42,
  /** The left column sits a little above the board's middle, as it does on
      the reference. */
  lift: 12,
  /** And the right column sits higher still. */
  rightLift: 34,
  /** The two marks engraved on the left rim, above and below the column. */
  emblem: { radius: 38, offset: 196 },
  /** The right column: how far a deck's frame sits past the deck. */
  deckSeat: 6,
  /** The button that ends a turn, and the frame round it. */
  button: { width: 104, height: 46, seat: 5 },
} as const;

export interface LeftFittings {
  /** What has happened so far: a plate that shows the history when pointed at. */
  actions: Box;
  /** The match: its name, and who it is against. */
  plaque: Box;
  /** Whose turn it is, and which turn. */
  status: Box;
  /** The way out. */
  leave: Box;
  /** Bare rim below the column, where a note is engraved. */
  note: Box;
  /** The two compass marks. */
  emblems: { cx: number; cy: number; radius: number }[];
}

export function leftFittings(): LeftFittings {
  const { gap, width } = SIDE;
  const height = SIDE.actions + gap + SIDE.plaque + gap + SIDE.status + gap + SIDE.leave;
  const top = CENTRE.y - SIDE.lift - height / 2;
  const bottom = top + height;
  // The column hangs off the slab's edge at its narrowest, so no fitting
  // ever reaches past the wood at either end.
  const x = Math.max(slabEdges(top).x0, slabEdges(bottom).x0) + SIDE.margin;

  const plaqueTop = top + SIDE.actions + gap;
  const statusTop = plaqueTop + SIDE.plaque + gap;
  const leaveTop = statusTop + SIDE.status + gap;

  const emblemX = x + width / 2;
  return {
    actions: { x, y: top, width, height: SIDE.actions },
    plaque: { x, y: plaqueTop, width, height: SIDE.plaque },
    status: { x, y: statusTop, width, height: SIDE.status },
    leave: { x, y: leaveTop, width, height: SIDE.leave },
    note: { x, y: bottom + gap, width, height: WELL.nearY - gap - (bottom + gap) },
    emblems: [
      { cx: emblemX, cy: CENTRE.y - SIDE.emblem.offset, radius: SIDE.emblem.radius },
      { cx: emblemX, cy: CENTRE.y + SIDE.emblem.offset, radius: SIDE.emblem.radius },
    ],
  };
}

export interface RightFittings {
  /** The two decks' frames, the same distance either side of the seam. */
  decks: Record<Side, Box>;
  /** The button's frame, on the seam. */
  button: Box;
}

export function rightFittings(): RightFittings {
  const deck = { width: RIGHT.deckWidth + SIDE.deckSeat * 2, height: RIGHT.deckHeight + SIDE.deckSeat * 2 };
  /** Where every fitting is centred at a depth: hard against the board's
      outer edge, one margin in, as on the reference. */
  const middle = (y: number) => slabEdges(y).x1 - SIDE.edge - deck.width / 2;
  const seam = WELL.seamY - SIDE.rightLift;

  const socket = (side: Side): Box => {
    const cy = side === "far" ? seam - RIGHT.deckOffset : seam + RIGHT.deckOffset;
    return { x: middle(cy) - deck.width / 2, y: cy - deck.height / 2, width: deck.width, height: deck.height };
  };
  const button = {
    width: SIDE.button.width + SIDE.button.seat * 2,
    height: SIDE.button.height + SIDE.button.seat * 2,
  };

  return {
    decks: { far: socket("far"), near: socket("near") },
    button: {
      x: middle(seam) - button.width / 2,
      y: seam - button.height / 2,
      width: button.width,
      height: button.height,
    },
  };
}

/**
 * Where the two hands are held: just outside the board's two ends, the same
 * clearance from each.
 *
 * Yours hangs just past the near edge, compact and gently fanned, with its
 * foot running off the bottom of the window. Theirs is held beyond the far
 * edge, large and fanned towards them, with its upper half running off the
 * top of the window: what shows is the lower half of each back, which is
 * all a hand of backs has to show. Neither covers its leader.
 */
export const HAND = {
  /**
   * How far your hand's top edge sits inside the board's near edge — or,
   * negative, past it. It sits just past the plate's foot, which hangs over
   * the edge, so the leader's name is never under a card.
   */
  over: -28,
  /** Where your hand's top edge sits. */
  get nearTop() { return BOARD.nearY - this.over; },
  far: {
    /**
     * How much larger their cards are drawn than yours. Theirs are held
     * beyond the far edge with the upper half past the top of the window,
     * so what shows is the lower half of a large card; yours are held close
     * and read whole.
     */
    scale: 1.052,
    /** Clear stage between the fan and the leader's plate, which stands out
        past the board's far edge. */
    gap: 32,
    /** Degrees of splay per card from the middle of the fan. */
    tilt: 2.5,
    /** How much of a card hides behind the one before it, at their scale. */
    overlap: 50,
    get width() { return Math.round(CARD.hand * this.scale); },
    get height() { return Math.round(CARD.handHeight * this.scale); },
    /** The line the fan hangs from: its cards' top edge. */
    get top() { return BOARD.farY - this.gap - this.height; },
  },
} as const;

/**
 * Energy, seated in a channel carved into the rim in front of each player.
 *
 * One more stone fills each round, left to right, and a spent one goes dark in
 * place. Every socket is cut from the first turn, so the row never changes
 * length — and there are exactly as many as the rules allow, which is why the
 * count comes from the engine rather than from a number written down twice.
 */
export const ENERGY = {
  sockets: ENERGY_CAP,
  size: 18,
  gap: 4,
  get width() { return this.sockets * this.size + (this.sockets - 1) * this.gap; },
} as const;

/**
 * The player's station: three fittings mounted on the rim at the end of the
 * board, with the rim's own wood, brass and stone running on underneath.
 *
 * In the middle, the plate: a piece of ivory standing on the rim from the
 * board's outer edge to the parchment's, with the leader's arched cavity cut
 * into it and a brass retaining frame round the opening. Its foot steps out
 * into two shoulders, and a dark plate for a number is mounted on each, at
 * the corners that face the field. To its left, a gap of rim, then the dial
 * in its socket; to its right, a gap of rim, then the counter rail — one
 * horizontal brass frame with the number and the ten stones in it. Three
 * pieces, spaced, and nothing joining them but the board: a station is a
 * place on the board where a player's things are, not a thing itself.
 *
 * The dial and the rail sit as high on the rim as they can, on the wood.
 * The plate is taller than the rim is deep, so it hangs a hair over the
 * board's outer edge and reaches to the parchment; that is what it is for.
 *
 * Everything is worked out for the far end and reflected for the near one,
 * so the two stations are one construction seen from opposite ends of the
 * table.
 */
export const STATION = {
  /** The plate. */
  plate: {
    /** Ivory showing round the brass frame. */
    pad: 6,
    /** How far the plate hangs out past the slab's edge. */
    out: 25,
    /** How far each shoulder steps out, and how tall the shoulders are. */
    shoulder: 68,
    shoulderHeight: 42,
  },
  /** Rim between the plate and the fittings either side of it. */
  gap: 34,
  /** Where the dial's and the rail's middles sit, in from the board's edge. */
  line: 50,
  /** The dial that sits in the socket, and the recess left around it. */
  dial: 78,
  ring: 6,
  /** The counter rail: how deep, and its own frame round what is in it. */
  rail: { height: 48, pad: 14, gap: 10 },
  /** The plate the number is on, set into the rail's floor. */
  readout: { width: 80, height: 30 },
} as const;

/** A box on the stage. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Station {
  /** The depth the dial and the rail line up on. */
  line: number;
  /** The plate: its upper body, and its shoulders. */
  plate: { body: Box; shoulders: Box };
  /** The two number plates, on the shoulders: attack, then health. */
  stats: [Box, Box];
  /** The socket cut for the dial, and the dial that sits in it. */
  ability: { cx: number; cy: number; radius: number; dial: number };
  /** The rail, which everything about energy sits in. */
  channel: Box;
  /** The plate inside it that carries the number. */
  readout: Box;
  /** The row of stone sockets inside it. */
  gems: Box;
}

/** A box given for the far side, reflected whole for the near one. */
function seatBox(side: Side, x: number, top: number, width: number, height: number): Box {
  return { x, y: side === "far" ? top : mirrorY(top + height), width, height };
}

export function station(side: Side): Station {
  // Everything is worked out for the far end and reflected for the near one.
  const seat = leaderSeat("far");
  const { plate, gap, rail, readout } = STATION;
  const { stat } = LEADER;

  // The plate: the frame with a pad of ivory round it, from a hair over the
  // board's edge to just past the parchment's.
  const bodyX = seat.x - LEADER.trim - plate.pad;
  const bodyWidth = seat.width + (LEADER.trim + plate.pad) * 2;
  const top = BOARD.farY - plate.out;
  const bottom = seat.y + seat.height + plate.pad;
  const shouldersX = bodyX - plate.shoulder;
  const shouldersWidth = bodyWidth + plate.shoulder * 2;
  const shouldersTop = bottom - plate.shoulderHeight;

  // The number plates, on the shoulders' outer corners, half over the edge.
  const statY = bottom - plate.pad - stat.height;
  const statLeft = shouldersX - stat.width / 2 + stat.gap;
  const statRight = shouldersX + shouldersWidth - stat.width / 2 - stat.gap;

  // The dial and the rail, on the wood, as high as they go.
  const radius = STATION.dial / 2 + STATION.ring;
  const line = BOARD.farY + STATION.line;
  const dialCx = bodyX - gap - radius;
  const channelWidth = rail.pad * 2 + readout.width + rail.gap + ENERGY.width;
  const channelX = bodyX + bodyWidth + gap + 16;

  return {
    line: side === "far" ? line : mirrorY(line),
    plate: {
      body: seatBox(side, bodyX, top, bodyWidth, bottom - top),
      shoulders: seatBox(side, shouldersX, shouldersTop, shouldersWidth, plate.shoulderHeight),
    },
    stats: [
      seatBox(side, statLeft, statY, stat.width, stat.height),
      seatBox(side, statRight, statY, stat.width, stat.height),
    ],
    ability: { cx: dialCx, cy: side === "far" ? line : mirrorY(line), radius, dial: STATION.dial },
    channel: seatBox(side, channelX, line - rail.height / 2, channelWidth, rail.height),
    readout: seatBox(side, channelX + rail.pad, line - readout.height / 2, readout.width, readout.height),
    gems: seatBox(
      side,
      channelX + channelWidth - rail.pad - ENERGY.width,
      line - ENERGY.size / 2,
      ENERGY.width,
      ENERGY.size,
    ),
  };
}

/** The decks, on the right hand rim. */
export const RIGHT = {
  deckWidth: 78,
  deckHeight: 106,
  /** How far each socket sits from the seam: close enough that the housing
      round them clears the station's rail at the corner. */
  deckOffset: 100,
} as const;

/** The banner behind a leader, which is how the sides are told apart. */
export const BANNER = {
  farWidth: 470,
  nearWidth: 540,
  height: 104,
} as const;

/**
 * How the rim is built up, as distances outward from the well's edge.
 *
 * Read from the play surface outwards: a chamfer of stone falling into the
 * well, the stone frame, a band of brass where the wood's edge stands over
 * the stone, then wood out to the slab's edge. Three bands at three heights
 * — stone below wood, brass at the step between them — which is what a rim
 * has to have before it reads as constructed rather than as a border. The
 * brass is a finger wide. It is the accent on this board and nothing else,
 * so it is the narrowest band; any wider and it becomes a gold racetrack
 * drawing the eye off the battlefield it is supposed to frame.
 */
export const RIM = {
  /** The chamfer, from the well's edge outwards. */
  bevel: 6,
  /** The stone frame's flat, from the top of the chamfer outwards. */
  stone: 34,
  /** The brass, at the foot of the wood's step. */
  brass: 8,
  /** Where the brass starts and stops, from the well's edge. */
  get brassIn() { return this.bevel + this.stone; },
  get brassOut() { return this.brassIn + this.brass; },
} as const;

/**
 * The one scale every edge on the board is cut to.
 *
 * A board is machined from a handful of settings — one cutter for its edges,
 * one for its corners, one depth for its holes — and it reads as machined
 * because those settings repeat. Before this existed the board carried
 * eleven corner radii and four outline weights, one per component, and it
 * read as assembled from parts that had never met. Everything here is taken
 * from the two numbers the board already had: the slab's own corner and the
 * well's.
 */
export const SHELL = {
  /** The weight of every physical edge: where one surface stops. */
  edge: 2,
  /** The weight of a lit edge, a hairline seam, or a brass lip. */
  lit: 1.5,
  /**
   * Corners, one family. The base is the slab's corner plus its own reach;
   * the slab is the slab's; the frame is the well's; and a hole cut into any
   * of them takes half the well's.
   */
  radius: {
    base: BOARD.round + 10,
    slab: BOARD.round,
    frame: WELL.round,
    hole: WELL.round / 2,
  },
  /**
   * The contact shadow a raised layer drops onto the one below it, from the
   * lamp: down and a little to the right, tight, because the layers are
   * close.
   */
  cast: { dx: 5, dy: 10, blur: 9 },
  /** How far into a hole the walls' shadow reaches across the floor. */
  occlusion: 18,
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
  /** The two stations: stone standing on the frame and out over the field. */
  stations: 40,
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
 * The board and everything set into it are at one depth. The layers used to
 * be spread along Z so they slid against each other under the lean, but the
 * board is pitched all the time now, not only when the cursor moves, and a
 * layer standing 150 units in front of the wood is drawn 36 units further
 * down the screen than the hole it is supposed to be sitting in: every
 * number missed its plate. A fitting is drawn where its hole is, so the
 * content sits at the board's own depth. Only the dust stands off it.
 */
export const DEPTH: Record<LayerName, number> = {
  scene: -420,
  atmosphere: 0,
  structure: 0,
  surface: 0,
  stations: 0,
  play: 0,
  highlight: 0,
  particles: 60,
  hud: 0,
};

/**
 * How far the eye is from the board.
 *
 * One value, shared by the whole arena, because perspective only reads as
 * perspective if every layer agrees where the viewer is standing. Shorter than
 * it was: the painted hall behind the board was drawn with a wider lens than
 * the board had, and a lens is not something two things in one picture can
 * disagree about.
 */
export const PERSPECTIVE = 1900;

/**
 * Where the eye is.
 *
 * The board used to be seen from almost straight above, with the whole of its
 * depth faked by the slab drawing a little narrower at the far end. The hall it
 * now stands in was painted from a chair: high, but a chair, with its floor
 * running away to a horizon somewhere above the middle of the picture. A board
 * seen from straight above in a room seen from a chair is a board stuck onto
 * a room, so the board is pitched to agree with it.
 *
 * `pitch` is how far the board's far edge is turned away, in degrees. It is
 * real perspective — the whole stage turns as one object, so the far edge
 * draws smaller, the near edge larger, and every card, plate and word on the
 * board keeps its place on it. The slab's own taper stays underneath as the
 * small part it always was.
 *
 * `horizon` is how far down the screen the eye is looking, which is where the
 * far edges converge. It sits above the middle, so the table runs away above
 * the board rather than stopping at its far edge.
 *
 * `distance` is how far the chair is from the table: the share of the screen
 * the composition is allowed to fill. At 1 the board ran to the top and bottom
 * of the screen and the table was a strip down each side, which is a board
 * held up to the eye. Backed off, the table shows all the way round and the
 * board is a thing sitting on it.
 */
export const CAMERA = {
  pitch: 3,
  horizon: 0.42,
  distance: 0.96,
} as const;

/**
 * The lean towards the cursor.
 *
 * Small on purpose. It is enough that the board answers you and not enough that
 * anybody has to aim, which is the only budget a board that is also a control
 * surface can afford.
 *
 * The board used to reach its new lean through a CSS transition. That is the
 * wrong tool for a value the cursor rewrites sixty times a second: every event
 * restarted the transition, so the board was permanently part way through a
 * move it never finished, and the whole three dimensional stack had to be
 * recomposited the entire time. The easing lives in the frame loop now — the
 * board closes some of the distance to the cursor each frame and stops when
 * there is nothing left to close.
 */
export const TILT = {
  degrees: 0.35,
  /**
   * How far the room slides the other way, which is what sells the distance.
   *
   * Less than the board's own edges move when it leans. The room is the far
   * end of the arena, and the far end of anything moves least; a backdrop that
   * swung further than the object in front of it would be nearer than it, not
   * further.
   */
  sceneDrift: 2,
  /**
   * How much of the way to the cursor the board travels each frame.
   *
   * A fifth. Enough that the board is where you asked within a few frames, so
   * it reads as answering you rather than following you, and not so much that
   * a jumped cursor snaps the board across.
   */
  ease: 0.22,
  /** Closer than this in degrees and the board has arrived. */
  rest: 0.002,
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
  x: 360,
  y: BOARD.farY - 60,
  /** How far the light reaches before the board is left to the dark. */
  reach: 1260,
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
 * How the board is framed on a given screen.
 *
 * The stage is the gameplay composition and nothing else: the well, the
 * plinths, the sockets, the cards and their sizes all live in it and none of
 * them ever move. What is elastic is the board around them.
 *
 * A screen wider than the gameplay composition does not get bigger cards and
 * does not get a stretched board. It gets more board: the slab carries on
 * outwards past the rim until it runs out of screen, the way a real board
 * would if you sat closer to a wider table. `spread` is how much further it
 * reaches on each side, in stage units.
 *
 * The scale is chosen so the gameplay composition always fits whole, and
 * then backed off by the camera's distance so that it does not fill the
 * screen either. On a short or narrow screen that means the board stops
 * filling every pixel, which is the right way round: a cropped battlefield is
 * worse than a margin.
 */
export interface StageFrame {
  /** How much of a stage unit a screen pixel is worth. */
  scale: number;
  /** The stage's width at this scale, which is at least the composition's. */
  width: number;
  /** How far the board reaches past the composition on each side. */
  spread: number;
  /** Where the stage's top edge sits relative to the window's, in stage units;
      negative when the stage runs off the top. */
  top: number;
}

export function frameFor(width: number, height: number): StageFrame {
  // A window can report no size at all — hidden, minimised, or a frame that has
  // not been laid out yet. Without a floor here that divides through to a scale
  // of zero and a stage width of NaN, and every measurement on the board goes
  // with it.
  const scale = Math.max(
    0.01,
    Math.min(Math.max(width, 1) / STAGE.width, Math.max(height, 1) / STAGE.fit) * CAMERA.distance,
  );
  const stageWidth = Math.max(STAGE.width, width / scale);
  // The band of the stage that has to be seen is centred in the window; what
  // is above it hangs off the top, and what is below it off the bottom.
  const top = Math.max(0, (height / scale - STAGE.fit) / 2) - STAGE.top;
  return { scale, width: stageWidth, spread: (stageWidth - STAGE.width) / 2, top };
}

/**
 * Fits the stage to whatever it has been given to sit in.
 *
 * It watches the element rather than the window, because the two are not the
 * same thing: a window event is late by a frame and misses anything that
 * resizes the page without resizing the window.
 */
export function useStageFit(): { ref: RefObject<HTMLDivElement>; frame: StageFrame } {
  const ref = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(() => frameFor(window.innerWidth, window.innerHeight));

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const watch = new ResizeObserver(entries => {
      const size = entries[0]?.contentRect;
      if (size && size.width > 0 && size.height > 0) setFrame(frameFor(size.width, size.height));
    });
    watch.observe(box);
    return () => watch.disconnect();
  }, []);

  return { ref, frame };
}
