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
 * a leader, sockets in the right hand rim for the decks, and shelves at the
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
 * Wider than it is tall by rather more than a screen, because the board fills
 * the width and the near player's hand hangs off the bottom of it. The height
 * is what decides how much of a screen the board takes: it is the smaller of
 * the two fits on every ordinary monitor, so a shorter stage is a closer
 * camera. It is kept as tight as the hand allows.
 */
export const STAGE = {
  width: 1440,
  height: 1060,
} as const;

/**
 * The slab.
 *
 * Given at both depths, because everything on this board tapers. Ask
 * `slabEdges(y)` for the width at a depth rather than working it out again.
 */
export const BOARD = {
  /** The slab's far edge, and where its near edge begins. */
  farY: 52,
  nearY: 936,
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
  round: 46,
} as const;

/**
 * How thick the rim is, at both ends.
 *
 * One number, so the two rims cannot drift apart. Everything a player has on
 * their side of the board — their leader, their name, their energy — is seated
 * in a band this deep, and a band this deep at the other end holds exactly the
 * same things at exactly the same distances from the edge.
 */
export const RIM_DEPTH = 206;

/** The opening cut into the slab, which the playing surface sits down inside. */
export const WELL = {
  farY: BOARD.farY + RIM_DEPTH,
  nearY: BOARD.nearY - RIM_DEPTH,
  farX0: 224,
  farX1: 1216,
  nearX0: 200,
  nearX1: 1240,
  /** How far the surface sits below the rim it is set into. */
  depth: 20,
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
 * Barely. From overhead the far end of a table is hardly further away than the
 * near end, and a card that shrank noticeably would be saying the camera is
 * somewhere it is not.
 */
export const FAR_SCALE = 0.975;

/** How much of the far half is taken by the air between here and there. */
export const HAZE = 0.1;

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
  play: 152,
  get playHeight() { return cardHeight(this.play); },
  gap: 18,
  /**
   * How far a row sits back from the seam.
   *
   * The rows are placed against the middle of the board rather than centred in
   * their own half, so the two sides face each other across one line and the
   * space each side has left over is at its own end, where its leader is.
   */
  seamGap: 16,
  /** How much a card in a hand hides behind the one before it. */
  handOverlap: 32,
  /** How far a card lifts when it is pointed at, and when it is picked up. */
  hover: 40,
  lift: 86,
  /** How far a card's own furniture sits in from its edges. */
  inset: 12,
} as const;

/** The band one side's cards in play lie in: exactly a card deep. */
export function cardBand(side: Side): Band {
  const height = CARD.playHeight;
  // Written once for the far side; the near side is that band reflected.
  const farTop = CENTRE.y - CARD.seamGap - height;
  return { top: side === "far" ? farTop : mirrorY(farTop + height), height };
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
  window: { width: 188, height: 212 },
  /** The carved trim around the opening. */
  trim: 12,
  /** How far the window's outer edge sits inside the board's outer edge. */
  inset: 16,
  /** One of the two plates beside the window, and the gap it keeps from it. */
  stat: { width: 76, height: 34, gap: 12 },
} as const;

export interface LeaderSeat {
  /** The window, as a box on the stage. */
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * Where the plates sit inside that box, as a distance down from its top.
   *
   * The plates hold to the window's battlefield-facing edge, which is its
   * bottom at the far end and its top at the near one.
   */
  statTop: number;
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
  const farTop = BOARD.farY + LEADER.inset;
  const y = side === "far" ? farTop : mirrorY(farTop + height);

  return {
    x: CENTRE.x - width / 2,
    y,
    width,
    height,
    statTop: side === "far" ? height - LEADER.stat.height : 0,
    line: y + height / 2,
  };
}

/**
 * The two blocks that carry the leaders.
 *
 * A plinth is raised out of the rim and breaks into the well, so a leader has a
 * piece of the board built around it rather than a panel laid on top of it. It
 * is exactly wide enough to hold the window and both of its plates, and it
 * stops where the cards start, so the block behind a row is never the block
 * under it.
 */
export const PLINTH = {
  get width() {
    return LEADER.window.width + (LEADER.stat.gap + LEADER.stat.width) * 2;
  },
  get centreX() { return CENTRE.x; },
  get far() {
    return { top: BOARD.farY, bottom: cardOuter("far"), width: this.width };
  },
  get near() {
    return { top: cardOuter("near"), bottom: BOARD.nearY, width: this.width };
  },
} as const;

/**
 * The information area, carved down the left rim.
 *
 * Which game this is, whose turn it is, which table you are playing on and the
 * way out. None of it is the game, so it is all at one end of the board away
 * from the middle — but it is still part of the board, so it is cut into the
 * rim rather than laid on it.
 *
 * Three fittings rather than one panel: a plaque at the top for the match, a
 * plaque under it for the turn, and the controls at the bottom. A single box
 * behind all of it would be the thing this is trying to stop being.
 *
 * The column is one x and one width for its whole height, taken where the rim
 * is narrowest at each end — the slab's edge at the top, the well's at the
 * bottom, since both slide left as the board comes towards you. Its two ends
 * are mirrors of each other about the seam, which is the only symmetry a strip
 * down one side can have.
 */
export const RAIL = {
  /** Clear rim either side of the column. */
  margin: 10,
  /** Air between two fittings, and between the words and the controls. */
  gap: 20,
  wide: 44,
  /** The plaque that carries the match, and the one that carries the turn. */
  plaque: 80,
  status: 62,
  /** A theme gem, the air between two of them, and the way out. */
  gem: 20,
  gemGap: 14,
  leave: 32,
  /** How far a fitting's contents sit inside the recess cut for them. */
  seat: 4,
  /** The socket a gem sits in reaches this far past it. */
  gemRing: 4,
  get height() {
    return this.plaque + this.gap + this.status + this.wide
      + (this.gem + this.gemRing * 2) + this.gap + this.leave;
  },
} as const;

export interface RailSeat {
  x: number;
  width: number;
  /** The match: its name, and who it is against. */
  plaque: Band;
  /** Whose turn it is, and which turn. */
  status: Band;
  /** Bare rim between the plaques and the controls, where a note is engraved. */
  note: Band;
  /** One socket per table you can play on. */
  gems: { cx: number; cy: number; radius: number }[];
  /** The way out. */
  leave: { x: number; y: number; width: number; height: number };
}

export function railSeat(gems: number): RailSeat {
  // The column is centred on the board's own middle, so its four fittings read
  // as one thing rather than as two clusters at opposite ends of the rim, and
  // the bare wood it leaves over is shared equally above and below it.
  const top = CENTRE.y - RAIL.height / 2;
  const bottom = top + RAIL.height;
  const x = slabEdges(top).x0 + RAIL.margin;
  const width = wellEdges(bottom).x0 - RAIL.margin - x;

  const statusTop = top + RAIL.plaque + RAIL.gap;
  const gemRadius = RAIL.gem / 2 + RAIL.gemRing;
  const gemCy = statusTop + RAIL.status + RAIL.wide + gemRadius;
  const leaveTop = gemCy + gemRadius + RAIL.gap;
  const row = gems * RAIL.gem + (gems - 1) * RAIL.gemGap;

  return {
    x,
    width,
    plaque: { top, height: RAIL.plaque },
    status: { top: statusTop, height: RAIL.status },
    // Under the whole column, on bare rim, in the room the board has left
    // over before the well's own near edge.
    note: {
      top: bottom + RAIL.gap,
      height: WELL.nearY - RAIL.gap - (bottom + RAIL.gap),
    },
    gems: Array.from({ length: gems }, (_unused, i) => ({
      cx: x + width / 2 - row / 2 + RAIL.gem / 2 + i * (RAIL.gem + RAIL.gemGap),
      cy: gemCy,
      radius: gemRadius,
    })),
    leave: { x: x + RAIL.seat * 3, y: leaveTop, width: width - RAIL.seat * 6, height: RAIL.leave },
  };
}

/**
 * Where the two hands hang off the board's ends.
 *
 * Both are held over the board's outer edge by the same amount, so a card in
 * either hand overlaps the slab by the same strip. What differs is how much of
 * the card there is to see: yours runs off the bottom of the stage on purpose,
 * because the stage stops where it stops and a hand of readable cards is worth
 * more than a hand of whole ones. Theirs is cropped to a countable sliver,
 * since a card back has nothing on it worth the room.
 */
export const HAND = {
  /** How far a hand card's outer edge rides over the board's own edge. */
  lift: 16,
  get nearTop() { return BOARD.nearY - this.lift; },
  /**
   * Their hand, as a fan held beyond the far edge of the table.
   *
   * The near hand is a fan pivoting on its bottom edge, camber pushing the
   * middle card furthest onto the board, and it runs off the bottom of the
   * stage because the stage stops before the card does. The far hand is that
   * same object reflected: it pivots on its top edge, its camber pushes the
   * middle card furthest onto the board from the other direction, and it runs
   * off the top of the stage. What differs is only how much of it there is to
   * see, because there is less room above the board than below it.
   *
   * `reach` is the exact mirror of where the near hand's cards begin, so the
   * deepest card at each end of the board stops at the same distance from its
   * own leader: level with the window, sixteen units over the plinth's outer
   * edge, and clear of the dial, the channel and every fitting on the rim.
   */
  far: {
    /** Degrees of splay per card from the middle of the fan. */
    tilt: 2.2,
    /**
     * How much of a card hides behind the one before it.
     *
     * Less than yours hides behind its neighbour, for two reasons. There is far
     * less of each of their cards to see, so what there is has to be wide
     * enough to read as a card; and a wider fan puts the cards at its ends out
     * past the leader's plinth, where the rim is bare and they can come further
     * onto the board.
     */
    overlap: 30,
    /**
     * How far onto the board a card may reach where the leader's plinth is
     * behind it: level with the window, which is the mirror of where the near
     * hand's own cards begin.
     */
    get reach() { return leaderSeat("far").y; },
    /**
     * How far it may reach anywhere else: level with the outer edge of the
     * energy channel, so a card at the end of the fan comes further onto the
     * rim without ever lying over a fitting cut into it.
     */
    get deep() { return station("far").channel.y; },
    /**
     * The line the fan is held on.
     *
     * A whole card above the shallowest reach, which puts it off the top of the
     * stage. That is the point: the cards are not cropped to a band, they are
     * whole cards held beyond the edge of the table, and what bounds each one
     * at the bottom is its own rounded edge rather than a line drawn across the
     * row. The layer's own crop takes care of the rest, at the edge of the
     * screen, where a crop is honest.
     */
    get pivotY() { return this.reach - CARD.playHeight; },
    /**
     * How far a card may come onto the board, given where it is and how far the
     * fan has turned it.
     *
     * The deepest it can go without lying over anything cut into the rim: the
     * leader's plinth stops it level with the window, the dial's socket stops
     * it at the socket, and out on bare rim it reaches the channel's line. So
     * the middle of the fan tucks away behind the plinth and its ends come
     * forward, and the row has a shape instead of an edge.
     *
     * `turn` is the card's own rotation, which carries its lower corners
     * sideways: a card at the end of the fan leans out over rim its upright
     * self would never have reached.
     *
     * The answer is taken on both sides of the board's middle and the shallower
     * one wins. The fan is symmetrical, so its silhouette has to be — and the
     * two rims are not mirror images of each other, since the dial's socket
     * sits closer in on the left than the energy channel does on the right.
     */
    floorFor(x0: number, turn: number): number {
      const shift = CARD.playHeight * Math.sin((turn * Math.PI) / 180);
      const from = x0 + shift;
      const to = from + CARD.play;

      const socket = station("far").ability;
      const bands: [number, number, number][] = [
        [CENTRE.x - PLINTH.width / 2, CENTRE.x + PLINTH.width / 2, this.reach],
        [socket.cx - socket.radius, socket.cx + socket.radius, socket.cy - socket.radius],
      ];

      let floor = this.deep;
      for (const side of [0, 1]) {
        // The card's own span, then the same span reflected about the middle.
        const a = side === 0 ? from : CENTRE.x * 2 - to;
        const b = side === 0 ? to : CENTRE.x * 2 - from;
        for (const [start, end, limit] of bands) {
          if (b > start && a < end) floor = Math.min(floor, limit);
        }
      }
      return floor;
    },
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
  size: 24,
  gap: 7,
  get width() { return this.sockets * this.size + (this.sockets - 1) * this.gap; },
} as const;

/**
 * The player's station: the fittings the board is cut to hold.
 *
 * A leader, a dial, a row of stones and a number are four different things, and
 * until now three of them were placed by their own constants and only met on
 * the rim by luck. They are one construction: a plinth in the middle of the
 * rim, a socket cut to the left of it for the dial, and a channel cut to the
 * right of it holding the energy readout and the stones.
 *
 * The two bays either side of the plinth are the same width, because the slab
 * is symmetrical about the board's middle and both are measured from the slab's
 * edge inwards. So the dial keeps exactly the clearance from the plinth that
 * the channel does, and neither is a number anybody chose.
 *
 * Nothing here takes FAR_SCALE. These are holes in the board, not objects
 * standing on it: their perspective is the slab's own taper, and a hole drawn
 * 2.5% small would simply not line up with the hole it is supposed to be.
 */
export const STATION = {
  /** Clear rim left outside the outermost fitting, at the narrower end. */
  margin: 18,
  /** The energy channel: how deep across the rim, and how it is cut. */
  channel: { height: 64, round: 14, pad: 12, gap: 14 },
  /**
   * The plate the number is on, set into the channel's floor.
   *
   * The same fitting as the two plates beside a leader — same height, same
   * corner — because it is the same thing: a number set into the board.
   */
  readout: { width: 80, height: 34, round: 7 },
  /** The dial that sits in the socket, and the recess left around it. */
  dial: 112,
  ring: 12,
} as const;

export interface Station {
  /** The depth this station lines up on: its own leader's middle. */
  line: number;
  /** The channel cut into the rim, which everything about energy sits in. */
  channel: { x: number; y: number; width: number; height: number };
  /** The plate inside it that carries the number. */
  readout: { x: number; y: number; width: number; height: number };
  /** The row of stone sockets inside it. */
  gems: { x: number; y: number; width: number; height: number };
  /** The socket cut for the dial, and the dial that sits in it. */
  ability: { cx: number; cy: number; radius: number; dial: number };
}

/** A box given for the far side, reflected whole for the near one. */
function seatBox(side: Side, x: number, top: number, width: number, height: number) {
  return { x, y: side === "far" ? top : mirrorY(top + height), width, height };
}

export function station(side: Side): Station {
  // Measured at the far line, which is the narrower end of the slab, so a
  // channel that fits there fits at the other end too — and both ends get the
  // same box rather than one each.
  const farLine = leaderSeat("far").line;
  const { channel, readout } = STATION;
  const plinthLeft = CENTRE.x - PLINTH.width / 2;
  const plinthRight = CENTRE.x + PLINTH.width / 2;

  const width = channel.pad * 2 + readout.width + channel.gap + ENERGY.width;
  const right = slabEdges(farLine).x1 - STATION.margin;
  const left = right - width;
  /** The clear rim between the plinth and the channel, whatever that came to. */
  const bay = left - plinthRight;

  const line = side === "far" ? farLine : mirrorY(farLine);
  const radius = STATION.dial / 2 + STATION.ring;

  return {
    line,
    channel: seatBox(side, left, farLine - channel.height / 2, width, channel.height),
    readout: seatBox(side, left + channel.pad, farLine - readout.height / 2, readout.width, readout.height),
    gems: seatBox(side, right - channel.pad - ENERGY.width, farLine - ENERGY.size / 2, ENERGY.width, ENERGY.size),
    // The dial's socket takes the same clearance from the plinth on its side.
    ability: { cx: plinthLeft - bay - radius, cy: line, radius, dial: STATION.dial },
  };
}

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

/**
 * How the rim is built up, as distances outward from the well's edge.
 *
 * Read from the play surface outwards: a chamfer falling into the well, wood,
 * a band of brass inlay, then wood again out to the slab's edge. Five surfaces
 * at four different heights, which is what a rim has to have before it reads
 * as constructed rather than as a border. The bands keep their share of a rim
 * that is now thicker at both ends than the far one used to be.
 */
export const RIM = {
  /** The chamfer, from the well's edge outwards. */
  bevel: 34,
  /**
   * The brass inlay: where it starts and where it stops.
   *
   * A finger's width. Brass is the accent on this board and nothing else, so
   * it is the narrowest band on the rim; any wider and it becomes a gold
   * racetrack drawing the eye off the battlefield it is supposed to frame.
   */
  inlayIn: 46,
  inlayOut: 56,
  /** The channel cut into the wood further out, for shadow to sit in. */
  channelIn: 78,
  channelOut: 92,
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
  /** How far the room slides the other way, which is what sells the distance. */
  sceneDrift: 12,
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
  x: 596,
  y: 36,
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
 * The scale is chosen so the gameplay composition always fits whole. On a
 * short or narrow screen that means the board stops filling every pixel, which
 * is the right way round: a cropped battlefield is worse than a margin.
 */
export interface StageFrame {
  /** How much of a stage unit a screen pixel is worth. */
  scale: number;
  /** The stage's width at this scale, which is at least the composition's. */
  width: number;
  /** How far the board reaches past the composition on each side. */
  spread: number;
}

export function frameFor(width: number, height: number): StageFrame {
  // A window can report no size at all — hidden, minimised, or a frame that has
  // not been laid out yet. Without a floor here that divides through to a scale
  // of zero and a stage width of NaN, and every measurement on the board goes
  // with it.
  const scale = Math.max(
    0.01,
    Math.min(Math.max(width, 1) / STAGE.width, Math.max(height, 1) / STAGE.height),
  );
  const stageWidth = Math.max(STAGE.width, width / scale);
  return { scale, width: stageWidth, spread: (stageWidth - STAGE.width) / 2 };
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
