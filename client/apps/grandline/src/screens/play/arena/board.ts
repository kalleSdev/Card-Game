import {
  BOARD, LEADER, SHELL, STAGE, WELL, boardReach, station,
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
    SHELL.radius.slab,
  );
}

/** How far the base shows past the slab on every side. */
export const BASE = { out: 8, far: 6, near: 6, face: 0 } as const;

/**
 * The base the slab stands on.
 *
 * The board is two tiers: a base that owns the whole footprint and stands on
 * the table, and the slab raised on it. That is what makes it an object with
 * thickness rather than a plate with a hole in it, and it is drawn on every
 * screen — it used to appear only when the screen was wide enough to leave
 * room for it, which made the board a different construction on a laptop.
 */
export function apronPath(spread = 0): string {
  const out = boardReach(spread) + BASE.out;
  return roundedPolygon(
    [
      { x: BOARD.farX0 - out, y: BOARD.farY - BASE.far },
      { x: BOARD.farX1 + out, y: BOARD.farY - BASE.far },
      { x: BOARD.nearX1 + out, y: BOARD.nearY + BOARD.lip + BASE.near },
      { x: BOARD.nearX0 - out, y: BOARD.nearY + BOARD.lip + BASE.near },
    ],
    SHELL.radius.base,
  );
}

/** The base's near face: its own thickness, seen end on below the slab's. */
export function baseFacePath(spread = 0): string {
  const out = boardReach(spread) + BASE.out;
  const top = BOARD.nearY + BOARD.lip + BASE.near;
  const inset = SHELL.radius.base / 3;
  return roundedPolygon(
    [
      { x: BOARD.nearX0 - out, y: top },
      { x: BOARD.nearX1 + out, y: top },
      { x: BOARD.nearX1 + out - inset, y: top + BASE.face },
      { x: BOARD.nearX0 - out + inset, y: top + BASE.face },
    ],
    SHELL.radius.base / 2,
  );
}

/**
 * The slab's near edge, seen end on.
 *
 * This is the whole reason the board reads as a thick object rather than a
 * picture of one: you can see how deep it is.
 */
export function lipPath(spread = 0): string {
  const inset = SHELL.radius.slab / 3;
  const reach = boardReach(spread);
  return roundedPolygon(
    [
      { x: BOARD.nearX0 - reach, y: BOARD.nearY },
      { x: BOARD.nearX1 + reach, y: BOARD.nearY },
      { x: BOARD.nearX1 + reach - inset, y: BOARD.nearY + BOARD.lip },
      { x: BOARD.nearX0 - reach + inset, y: BOARD.nearY + BOARD.lip },
    ],
    SHELL.radius.slab / 2,
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
    SHELL.radius.frame,
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
    SHELL.radius.frame + out,
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
    SHELL.radius.frame,
  );
}

/**
 * A station's plate: a body with two shoulders at its foot, the foot being
 * the end that faces the field. Eight corners, all rounded the board's way.
 */
export function platePath(side: "far" | "near"): string {
  const { body, shoulders } = station(side).plate;
  const b = { x0: body.x, x1: body.x + body.width, y0: body.y, y1: body.y + body.height };
  const s = { x0: shoulders.x, x1: shoulders.x + shoulders.width, y0: shoulders.y, y1: shoulders.y + shoulders.height };
  const points = side === "far"
    ? [
      { x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 },
      { x: b.x1, y: s.y0 }, { x: s.x1, y: s.y0 },
      { x: s.x1, y: s.y1 }, { x: s.x0, y: s.y1 },
      { x: s.x0, y: s.y0 }, { x: b.x0, y: s.y0 },
    ]
    : [
      { x: s.x0, y: s.y0 }, { x: s.x1, y: s.y0 },
      { x: s.x1, y: s.y1 }, { x: b.x1, y: s.y1 },
      { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 },
      { x: b.x0, y: s.y1 }, { x: s.x0, y: s.y1 },
    ];
  return roundedPolygon(points, SHELL.radius.hole);
}

/**
 * The niche's outline: a half circle on straight sides, which is what makes it
 * an arch rather than a rounded box.
 *
 * `inset` is how far inside the window's own edge the outline sits: 0 is the
 * opening as it is cut into the stone, a positive number is a layer inside
 * it, a negative one reaches outside. Offsetting works evenly because the
 * dome's radius is half the window's width, so every layer shares the dome's
 * centre and comes out the same thickness the whole way round. The bottom
 * corners widen by the offset for the same reason.
 *
 * Given once here, so the stone cavity the board cuts and the picture the
 * leader drops into it are the same shape from the same numbers.
 */
export function nichePath(x: number, y: number, width: number, height: number, inset: number): string {
  const w = width - inset * 2;
  const h = height - inset * 2;
  const dome = w / 2;
  const f = LEADER.foot + LEADER.picture - inset;
  const ox = x + inset;
  const oy = y + inset;
  return `M ${round(ox)} ${round(oy + dome)}`
    + ` A ${round(dome)} ${round(dome)} 0 0 1 ${round(ox + w)} ${round(oy + dome)}`
    + ` L ${round(ox + w)} ${round(oy + h - f)}`
    + ` A ${round(f)} ${round(f)} 0 0 1 ${round(ox + w - f)} ${round(oy + h)}`
    + ` L ${round(ox + f)} ${round(oy + h)}`
    + ` A ${round(f)} ${round(f)} 0 0 1 ${round(ox)} ${round(oy + h - f)}`
    + ` Z`;
}

/** The whole stage, for anything that has to cover it. */
export const STAGE_RECT = { x: 0, y: 0, w: STAGE.width, h: STAGE.height } as const;
