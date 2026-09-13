import {
  BOARD, PLINTH, RIGHT, STAGE, WELL, boardReach, slabEdges, wellEdges,
} from "../../../design/arenaStage";

/**
 * The board's shapes, as paths.
 *
 * Kept apart from the drawing so the geometry can be read on its own. Every
 * shape here is a rounded polygon rather than a rectangle, because the board is
 * seen from in front and above: its far end is narrower than its near end, and
 * a rectangle would flatten the one thing that says which end is yours.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * A polygon with its corners cut round.
 *
 * Each corner is pulled back along both of its edges by the radius and joined
 * with a quadratic through the original corner. It works on any polygon, which
 * is the point: the slab, the well and the plinths are all four sided but none
 * of them are rectangles, and they should all round the same way.
 */
export function roundedPolygon(points: Point[], radius: number): string {
  const n = points.length;
  const parts: string[] = [];

  for (let i = 0; i < n; i++) {
    const previous = points[(i - 1 + n) % n];
    const corner = points[i];
    const next = points[(i + 1) % n];

    const from = pullBack(corner, previous, radius);
    const to = pullBack(corner, next, radius);

    if (i === 0) parts.push(`M ${round(from.x)} ${round(from.y)}`);
    else parts.push(`L ${round(from.x)} ${round(from.y)}`);
    parts.push(`Q ${round(corner.x)} ${round(corner.y)} ${round(to.x)} ${round(to.y)}`);
  }

  parts.push("Z");
  return parts.join(" ");
}

/** A point `distance` back from `corner` towards `towards`, never past halfway. */
function pullBack(corner: Point, towards: Point, distance: number): Point {
  const dx = towards.x - corner.x;
  const dy = towards.y - corner.y;
  const length = Math.hypot(dx, dy) || 1;
  const step = Math.min(distance, length / 2) / length;
  return { x: corner.x + dx * step, y: corner.y + dy * step };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The slab: the whole board, tapering away from you.
 *
 * `spread` carries its two side edges outwards on a wider screen. Only the
 * edges move: the taper between them is the same taper, so the board grows
 * without being stretched, and everything cut into it stays where it was.
 */
export function slabPath(spread = 0): string {
  const reach = boardReach(spread);
  return roundedPolygon(
    [
      { x: BOARD.farX0 - reach, y: BOARD.farY },
      { x: BOARD.farX1 + reach, y: BOARD.farY },
      { x: BOARD.nearX1 + reach, y: BOARD.nearY },
      { x: BOARD.nearX0 - reach, y: BOARD.nearY },
    ],
    BOARD.round,
  );
}

/**
 * The step the slab stands on, on a screen wider than the composition.
 *
 * Without it a wide board is one enormous flat plate with a small hole in the
 * middle. With it the board is two tiers: the apron reaches the edges of the
 * screen and the slab sits on top of it, which is a shape rather than an
 * expanse. It is the same material, one level down, and it is drawn only when
 * there is room for it.
 */
export function apronPath(spread: number): string {
  const out = boardReach(spread) + 26;
  return roundedPolygon(
    [
      { x: BOARD.farX0 - out, y: BOARD.farY - 20 },
      { x: BOARD.farX1 + out, y: BOARD.farY - 20 },
      { x: BOARD.nearX1 + out, y: BOARD.nearY + BOARD.lip + 12 },
      { x: BOARD.nearX0 - out, y: BOARD.nearY + BOARD.lip + 12 },
    ],
    BOARD.round + 10,
  );
}

/**
 * The slab's near edge, seen end on.
 *
 * This is the whole reason the board reads as a thick object rather than a
 * picture of one: you can see how deep it is.
 */
export function lipPath(spread = 0): string {
  const inset = BOARD.round / 3;
  const reach = boardReach(spread);
  return roundedPolygon(
    [
      { x: BOARD.nearX0 - reach, y: BOARD.nearY },
      { x: BOARD.nearX1 + reach, y: BOARD.nearY },
      { x: BOARD.nearX1 + reach - inset, y: BOARD.nearY + BOARD.lip },
      { x: BOARD.nearX0 - reach + inset, y: BOARD.nearY + BOARD.lip },
    ],
    BOARD.round / 2,
  );
}

/** The well: the opening the playing surface is set down inside. */
export function wellPath(): string {
  return roundedPolygon(
    [
      { x: WELL.farX0, y: WELL.farY },
      { x: WELL.farX1, y: WELL.farY },
      { x: WELL.nearX1, y: WELL.nearY },
      { x: WELL.nearX0, y: WELL.nearY },
    ],
    WELL.round,
  );
}

/**
 * The well's outline, pushed outwards by `out`.
 *
 * The rim is built out of these: a chamfer falling into the well, a band of
 * brass inlay a little further out, and the wood between them. Offsetting the
 * well rather than insetting the slab is what keeps every band parallel to the
 * play area as the board tapers — a band drawn parallel to the outside edge
 * instead would drift away from the well and the board would look assembled
 * out of two different objects.
 */
export function wellOffsetPath(out: number): string {
  return roundedPolygon(
    [
      { x: WELL.farX0 - out, y: WELL.farY - out },
      { x: WELL.farX1 + out, y: WELL.farY - out },
      { x: WELL.nearX1 + out, y: WELL.nearY + out },
      { x: WELL.nearX0 - out, y: WELL.nearY + out },
    ],
    WELL.round + out,
  );
}

/**
 * A ring between two offsets of the well.
 *
 * Two subpaths in one path, wound so the inner one cuts a hole in the outer.
 * That is what makes a band a band rather than two shapes that have to be kept
 * in step by hand.
 */
export function wellBandPath(inner: number, outer: number): string {
  return `${wellOffsetPath(outer)} ${wellOffsetPath(inner)}`;
}

/** The playing surface, which sits below the rim and so is a little smaller. */
export function surfacePath(): string {
  const drop = WELL.depth;
  return roundedPolygon(
    [
      { x: WELL.farX0 + drop, y: WELL.farY + drop / 2 },
      { x: WELL.farX1 - drop, y: WELL.farY + drop / 2 },
      { x: WELL.nearX1 - drop, y: WELL.nearY - drop / 2 },
      { x: WELL.nearX0 + drop, y: WELL.nearY - drop / 2 },
    ],
    WELL.round,
  );
}

/**
 * A plinth: the block a leader stands in.
 *
 * It is cut from the rim and pushed forward into the well, so the leader has a
 * piece of board built around it. Its far face is narrower than its near one
 * for the same reason the slab's is.
 */
export function plinthPath(side: "far" | "near"): string {
  const block = PLINTH[side];
  const centre = PLINTH.centreX;
  const outer = side === "far" ? block.top : block.bottom;
  const inner = side === "far" ? block.bottom : block.top;

  // The face towards the well is the wider one, because it is nearer the eye
  // on the near plinth and further into the light on the far one.
  const outerHalf = block.width / 2 - 16;
  const innerHalf = block.width / 2;

  return roundedPolygon(
    [
      { x: centre - outerHalf, y: outer },
      { x: centre + outerHalf, y: outer },
      { x: centre + innerHalf, y: inner },
      { x: centre - innerHalf, y: inner },
    ],
    22,
  );
}

/** Where a deck sits in the right hand rim. */
export function deckSocket(side: "far" | "near"): { x: number; y: number; w: number; h: number } {
  const y = side === "far" ? WELL.seamY - RIGHT.deckOffset : WELL.seamY + RIGHT.deckOffset;
  const rim = rimRight(y);
  const w = RIGHT.deckWidth + 22;
  const h = RIGHT.deckHeight + 22;
  return { x: rim.middle - w / 2, y: y - h / 2, w, h };
}

/** Where the button sits: on the rim at the seam, overhanging the well. */
export function buttonSocket(): { x: number; y: number; w: number; h: number } {
  const rim = rimRight(WELL.seamY);
  const w = RIGHT.buttonWidth + 18;
  const h = RIGHT.buttonHeight + 16;
  return { x: rim.outer - w - 10, y: WELL.seamY - h / 2, w, h };
}

/** The right hand rim at a depth: where it starts, stops, and its middle. */
export function rimRight(y: number): { inner: number; outer: number; middle: number } {
  const inner = wellEdges(y).x1;
  const outer = slabEdges(y).x1;
  return { inner, outer, middle: (inner + outer) / 2 };
}

/** The left hand rim at a depth, which is where the writing goes. */
export function rimLeft(y: number): { inner: number; outer: number; middle: number } {
  const inner = wellEdges(y).x0;
  const outer = slabEdges(y).x0;
  return { inner, outer, middle: (inner + outer) / 2 };
}

/**
 * The four corners of the rim, where anything resting on the board stands.
 *
 * Given as a box each, so a prop can be placed by its own footprint rather than
 * by a number somebody guessed.
 */
export function shelves(): { key: string; x: number; y: number; w: number; h: number }[] {
  const farRim = { top: BOARD.farY, bottom: WELL.farY };
  const nearRim = { top: WELL.nearY, bottom: BOARD.nearY };
  const plinthFar = PLINTH.far.width / 2 + 20;
  const plinthNear = PLINTH.near.width / 2 + 20;
  const centre = PLINTH.centreX;

  const box = (key: string, y0: number, y1: number, x0: number, x1: number) => ({
    key, x: x0, y: y0, w: x1 - x0, h: y1 - y0,
  });

  const far = slabEdges((farRim.top + farRim.bottom) / 2);
  const near = slabEdges((nearRim.top + nearRim.bottom) / 2);

  return [
    box("far-left", farRim.top + 12, farRim.bottom - 8, far.x0 + 24, centre - plinthFar),
    box("far-right", farRim.top + 12, farRim.bottom - 8, centre + plinthFar, far.x1 - 24),
    box("near-left", nearRim.top + 8, nearRim.bottom - 12, near.x0 + 24, centre - plinthNear),
    box("near-right", nearRim.top + 8, nearRim.bottom - 12, centre + plinthNear, near.x1 - 24),
  ];
}

/** The whole stage, for anything that has to cover it. */
export const STAGE_RECT = { x: 0, y: 0, w: STAGE.width, h: STAGE.height } as const;
