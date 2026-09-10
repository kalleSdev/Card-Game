import {
  ABILITY, BAND, BANNER, FELT, FIELD, FRAME, HAND_RAIL, LEADER_WINDOW, RAIL, RIGHT, STAGE,
} from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";
import { RADIUS } from "../../../design/tokens";

/**
 * The board, as a painted object.
 *
 * This is the thing the game sits on. It draws no cards, holds no state and
 * takes no clicks, which is the point: the board can be repainted — a new
 * theme, a deeper bevel, a different sweep on the panels — without anyone
 * going near the rules, and the parts that do take clicks stay small enough
 * to read.
 *
 * It is one SVG rather than a stack of divs because the shapes are not
 * rectangles. The panels are cut back where they meet the banner, and the
 * playing surface has an outline that is pressed in at its corners and swells
 * out towards the button. Neither of those is a border radius.
 *
 * The viewBox is the stage, so every coordinate below is a stage unit and can
 * be written straight out of arenaStage. preserveAspectRatio is none because
 * whatever holds this has already scaled the stage to the screen; the drawing
 * only has to fill the box it is handed.
 */

const W = STAGE.width;
const H = STAGE.height;
const MID = W / 2;

/**
 * The two line weights the board is painted with: a hairline for the edge of a
 * panel, and a heavier one for the brass trim on a banner. Nothing else needs
 * its own weight.
 */
const EDGE = 2;
const TRIM = 3;

/**
 * How hard light and shadow are laid on.
 *
 * These are not measurements the rest of the board shares, they are decisions
 * inside this one drawing, which is why they live here rather than in
 * arenaStage. Anything fainter than the first of them does not survive the
 * board being scaled down to a laptop screen.
 */
const FAINT = 0.2;
const HALF = 0.45;
const STRONG = 0.7;

/** Grain has to be felt rather than seen, so it never gets above this. */
const GRAIN = 0.12;

/**
 * A raised panel's corner: the plate's own radius opened up by half the bezel,
 * so a panel corner reads a little rounder than the board it is set into.
 */
const CORNER = FRAME.radius + FRAME.bezel / 2;

/**
 * How far a wing is cut back at the corner facing the banner. Half the band's
 * height, which is as large a sweep as a panel that tall can carry before it
 * stops looking like a panel.
 */
const SWEEP = BAND.enemyWing.height / 2;

/** A stroke straddles its path, so a stroked rect is pulled in by half of it. */
const plateInset = EDGE / 2;

const bezel = {
  x: FRAME.thickness,
  y: FRAME.thickness,
  w: W - FRAME.thickness * 2,
  h: H - FRAME.thickness * 2,
};

const bannerX = MID - BANNER.width / 2;
const bannerThemY = BAND.enemyWing.top;
const bannerYouY = BAND.yourWing.top + BAND.yourWing.height - BANNER.height;

/**
 * The wings stop short of the banner's ends by the width of a leader window's
 * trim, so the cloth reads as one piece running underneath rather than as
 * three panels butted up against each other.
 */
const wingInnerL = bannerX + LEADER_WINDOW.trim;
const wingInnerR = bannerX + BANNER.width - LEADER_WINDOW.trim;

/** The surface, with the bleed that carries it under the frame on both sides. */
const feltX0 = FIELD.left - FELT.bleed;
const feltX1 = FIELD.right + FELT.bleed;
const feltY0 = FELT.top;
const feltY1 = FELT.top + FELT.height;

/**
 * Where the leaders stand. The niche and the dial share one banner, the niche
 * left of centre and the dial the same distance right of it, so the pair of
 * them is centred even though neither one is.
 */
const nicheX = MID - ABILITY.offset / 2;
const nicheW = LEADER_WINDOW.width + LEADER_WINDOW.trim * 2;
const nicheH = LEADER_WINDOW.height + LEADER_WINDOW.trim * 2;

/**
 * The window fills its band exactly, which is why LEADER_WINDOW.height and the
 * band's height are the same number. The recess is the window plus its trim on
 * every side, so it pokes a trim's width out of the band at both ends.
 */
const nicheThemY = BAND.enemyWing.top - LEADER_WINDOW.trim;
const nicheYouY = BAND.yourWing.top - LEADER_WINDOW.trim;

/** The channel down the right, stopping exactly on the bezel's inner edge. */
const channelX = FIELD.right + FRAME.bezel / 2;
const channelW = W - FRAME.thickness - channelX;

const socketW = RIGHT.deckWidth + FRAME.bezel;
const socketH = RIGHT.deckHeight + FRAME.bezel;
const socketX = channelX + (channelW - socketW) / 2;

/** The button's recess is a bleed wider and taller than the button itself. */
const buttonW = RIGHT.buttonWidth + FELT.bleed;
const buttonH = RIGHT.buttonHeight + FELT.bleed;
const buttonX = channelX + channelW - buttonW;

const railX0 = FIELD.left - HAND_RAIL.bleed;
const railW = FIELD.width + HAND_RAIL.bleed * 2;
const railR = HAND_RAIL.height / 2;

/**
 * The left bar carries the game's own controls. It runs from a panel corner
 * above the surface down to the mirror of that about the middle of the stage,
 * so it belongs to neither player.
 */
const barX = FRAME.thickness / 2 + plateInset;
const barW = RAIL.left - FRAME.thickness - plateInset * 2;
const barY0 = FELT.top - CORNER;
const barY1 = H - barY0;

/** The top edge of a rounded box, for painting light along it. */
function topEdge(x: number, y: number, w: number, r: number): string {
  return `M ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} L ${x + w - r} ${y} A ${r} ${r} 0 0 1 ${x + w} ${y + r}`;
}

/** And the bottom edge, for the shadow under it, or the light under a mirrored one. */
function bottomEdge(x: number, y: number, w: number, h: number, r: number): string {
  return `M ${x} ${y + h - r} A ${r} ${r} 0 0 0 ${x + r} ${y + h} L ${x + w - r} ${y + h} A ${r} ${r} 0 0 0 ${x + w} ${y + h - r}`;
}

type Corner = "tl" | "tr" | "br" | "bl";

/**
 * A wing panel.
 *
 * Three of its corners are simply rounded. The fourth, the one that faces the
 * banner and the surface, is cut away by an arc centred on the corner itself,
 * which is what makes the panel look as though it has been swept back to make
 * room rather than merely trimmed. Both kinds of corner are the same arc with
 * a different centre, so they are drawn by the same code: a rounded corner
 * turns with the path, a cut one turns against it.
 */
function panelPath(x0: number, y0: number, x1: number, y1: number, cut: Corner): string {
  const size = (c: Corner) => (c === cut ? SWEEP : CORNER);
  const flag = (c: Corner) => (c === cut ? 0 : 1);
  const arc = (c: Corner, x: number, y: number) =>
    `A ${size(c)} ${size(c)} 0 0 ${flag(c)} ${x} ${y}`;

  return [
    `M ${x0 + size("tl")} ${y0}`,
    `L ${x1 - size("tr")} ${y0}`,
    arc("tr", x1, y0 + size("tr")),
    `L ${x1} ${y1 - size("br")}`,
    arc("br", x1 - size("br"), y1),
    `L ${x0 + size("bl")} ${y1}`,
    arc("bl", x0, y1 - size("bl")),
    `L ${x0} ${y0 + size("tl")}`,
    arc("tl", x0 + size("tl"), y0),
    "Z",
  ].join(" ");
}

/**
 * A smooth run from one point on an edge to the next, flat at both ends.
 *
 * Putting each control point a third of the way along leaves the curve
 * horizontal where it starts and where it stops, so a chain of these meets
 * cleanly at every crest and dip instead of kinking.
 */
function wave(x0: number, y0: number, x1: number, y1: number): string {
  const reach = (x1 - x0) / 3;
  return `C ${x0 + reach} ${y0} ${x1 - reach} ${y1} ${x1} ${y1}`;
}

/** An arch: a half circle standing on straight sides, as the leader window is. */
function archPath(cx: number, y: number, w: number, h: number): string {
  const r = w / 2;
  return [
    `M ${cx - r} ${y + h}`,
    `L ${cx - r} ${y + r}`,
    `A ${r} ${r} 0 0 1 ${cx + r} ${y + r}`,
    `L ${cx + r} ${y + h}`,
    "Z",
  ].join(" ");
}

/**
 * The playing surface.
 *
 * Not a rectangle. Its corners are bitten out by the wings above and below,
 * its top and bottom edges rise between the panels and dip where a leader
 * stands in front of them, and its right edge swells towards the button that
 * ends a turn. All of it is drawn from the surface's own measurements: the
 * bleed that carries it under the frame is reused as the amount its edges
 * move, halved for a rise and doubled for the swell, so the outline stays in
 * proportion if the surface is ever remeasured.
 */
function feltPath(): string {
  const crest = FELT.bleed / 2;
  const dip = FELT.bleed;
  const swell = FELT.bleed * 2;
  const press = `A ${CORNER} ${CORNER} 0 0 0`;

  // A cubic reaches only three quarters of the way towards its control points,
  // so a control pushed out by four thirds of the swell gives exactly the swell.
  const reach = feltX1 + (swell * 4) / 3;
  const third = (feltY1 - feltY0 - CORNER * 2) / 3;

  return [
    `M ${feltX0} ${feltY0 + CORNER}`,
    `${press} ${feltX0 + CORNER} ${feltY0}`,
    wave(feltX0 + CORNER, feltY0, wingInnerL, feltY0 - crest),
    wave(wingInnerL, feltY0 - crest, nicheX, feltY0 + dip),
    wave(nicheX, feltY0 + dip, wingInnerR, feltY0 - crest),
    wave(wingInnerR, feltY0 - crest, feltX1 - CORNER, feltY0),
    `${press} ${feltX1} ${feltY0 + CORNER}`,
    `C ${reach} ${feltY0 + CORNER + third} ${reach} ${feltY1 - CORNER - third} ${feltX1} ${feltY1 - CORNER}`,
    `${press} ${feltX1 - CORNER} ${feltY1}`,
    wave(feltX1 - CORNER, feltY1, wingInnerR, feltY1 + crest),
    wave(wingInnerR, feltY1 + crest, nicheX, feltY1 - dip),
    wave(nicheX, feltY1 - dip, wingInnerL, feltY1 + crest),
    wave(wingInnerL, feltY1 + crest, feltX0 + CORNER, feltY1),
    `${press} ${feltX0} ${feltY1 - CORNER}`,
    "Z",
  ].join(" ");
}

const FELT_PATH = feltPath();

/**
 * How far inside a panel its moulding runs.
 *
 * A painted panel has a raised border a little way in from its edge. Without
 * one a wing is a slab of colour; with one it is a piece of furniture. The
 * inset is the bezel's own thickness so the board keeps to two or three
 * measurements rather than inventing a new one here.
 */
const MOULDING = FRAME.bezel;

const WINGS: { d: string; lit: string; inner: string }[] = [
  {
    d: panelPath(FIELD.left, BAND.enemyWing.top, wingInnerL, BAND.enemyWing.top + BAND.enemyWing.height, "br"),
    lit: topEdge(FIELD.left, BAND.enemyWing.top, wingInnerL - FIELD.left, CORNER),
    inner: panelPath(
      FIELD.left + MOULDING, BAND.enemyWing.top + MOULDING,
      wingInnerL - MOULDING, BAND.enemyWing.top + BAND.enemyWing.height - MOULDING, "br",
    ),
  },
  {
    d: panelPath(wingInnerR, BAND.enemyWing.top, FIELD.right, BAND.enemyWing.top + BAND.enemyWing.height, "bl"),
    lit: topEdge(wingInnerR, BAND.enemyWing.top, FIELD.right - wingInnerR, CORNER),
    inner: panelPath(
      wingInnerR + MOULDING, BAND.enemyWing.top + MOULDING,
      FIELD.right - MOULDING, BAND.enemyWing.top + BAND.enemyWing.height - MOULDING, "bl",
    ),
  },
  {
    d: panelPath(FIELD.left, BAND.yourWing.top, wingInnerL, BAND.yourWing.top + BAND.yourWing.height, "tr"),
    lit: bottomEdge(FIELD.left, BAND.yourWing.top, wingInnerL - FIELD.left, BAND.yourWing.height, CORNER),
    inner: panelPath(
      FIELD.left + MOULDING, BAND.yourWing.top + MOULDING,
      wingInnerL - MOULDING, BAND.yourWing.top + BAND.yourWing.height - MOULDING, "tr",
    ),
  },
  {
    d: panelPath(wingInnerR, BAND.yourWing.top, FIELD.right, BAND.yourWing.top + BAND.yourWing.height, "tl"),
    lit: bottomEdge(wingInnerR, BAND.yourWing.top, FIELD.right - wingInnerR, BAND.yourWing.height, CORNER),
    inner: panelPath(
      wingInnerR + MOULDING, BAND.yourWing.top + MOULDING,
      FIELD.right - MOULDING, BAND.yourWing.top + BAND.yourWing.height - MOULDING, "tl",
    ),
  },
];

/** The top pair are lit from above and the bottom pair from below, so they mirror. */
const WING_FILL = ["url(#ar-panel-top)", "url(#ar-panel-top)", "url(#ar-panel-bottom)", "url(#ar-panel-bottom)"];

/**
 * A hole cut into the board: dark, with the light on its lower lip rather than
 * its upper one, which is the whole difference between a hole and a bump.
 */
function Recess({ theme, x, y, w, h, r }: {
  theme: ArenaTheme;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={r} fill={theme.bezel} />
      <path d={bottomEdge(x, y, w, h, r)} fill="none" stroke={theme.wing.light} strokeWidth={EDGE} opacity={FAINT} />
      <rect x={x} y={y} width={w} height={h} rx={r} fill="none" stroke={theme.wingEdge} strokeWidth={1} opacity={HALF} />
    </>
  );
}

export default function Chrome({ theme }: { theme: ArenaTheme }): JSX.Element {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        {/* Vertical ramps. Left in the default box units so one gradient can
            serve every panel whatever size it is. */}
        <linearGradient id="ar-plate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={theme.frame.light} />
          <stop offset="0.55" stopColor={theme.frame.mid} />
          <stop offset="1" stopColor={theme.frame.dark} />
        </linearGradient>

        <linearGradient id="ar-panel-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={theme.wing.light} />
          <stop offset="0.5" stopColor={theme.wing.mid} />
          <stop offset="1" stopColor={theme.wing.dark} />
        </linearGradient>

        <linearGradient id="ar-panel-bottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={theme.wing.dark} />
          <stop offset="0.5" stopColor={theme.wing.mid} />
          <stop offset="1" stopColor={theme.wing.light} />
        </linearGradient>

        <linearGradient id="ar-banner-them" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={theme.banner.them.light} />
          <stop offset="0.45" stopColor={theme.banner.them.mid} />
          <stop offset="1" stopColor={theme.banner.them.dark} />
        </linearGradient>

        <linearGradient id="ar-banner-you" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={theme.banner.you.dark} />
          <stop offset="0.55" stopColor={theme.banner.you.mid} />
          <stop offset="1" stopColor={theme.banner.you.light} />
        </linearGradient>

        {/* The channel darkens away from its lit left lip. */}
        <linearGradient id="ar-channel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={theme.wing.dark} />
          <stop offset="1" stopColor={theme.bezel} />
        </linearGradient>

        {/* The surface is lit from a little above its own middle, so the far
            half reads as the one further from the lamp. */}
        <radialGradient
          id="ar-felt"
          gradientUnits="userSpaceOnUse"
          cx={MID}
          cy={FELT.top + FELT.height / 4}
          r={FIELD.width / 2}
        >
          <stop offset="0" stopColor={theme.felt.light} />
          <stop offset="0.55" stopColor={theme.felt.mid} />
          <stop offset="1" stopColor={theme.felt.dark} />
        </radialGradient>

        {/* The seam is a line that has been drawn and then rubbed out at both
            ends, so it separates the halves without fencing them off. */}
        <linearGradient
          id="ar-seam"
          gradientUnits="userSpaceOnUse"
          x1={feltX0}
          y1={FELT.middle}
          x2={feltX1}
          y2={FELT.middle}
        >
          <stop offset="0" stopColor={theme.seam} stopOpacity="0" />
          <stop offset="0.2" stopColor={theme.seam} stopOpacity="1" />
          <stop offset="0.8" stopColor={theme.seam} stopOpacity="1" />
          <stop offset="1" stopColor={theme.seam} stopOpacity="0" />
        </linearGradient>

        <radialGradient id="ar-vignette" gradientUnits="userSpaceOnUse" cx={MID} cy={H / 2} r={MID}>
          <stop offset="0" stopColor={theme.shadow} stopOpacity="0" />
          <stop offset="0.6" stopColor={theme.shadow} stopOpacity="0" />
          <stop offset="1" stopColor={theme.shadow} stopOpacity={FAINT} />
        </radialGradient>

        {/* What a raised layer throws onto the one under it. Offset down,
            because everything on this board is lit from above. */}
        <filter id="ar-cast">
          <feDropShadow
            dx="0"
            dy={FRAME.bezel / 2}
            stdDeviation={FRAME.bezel}
            floodColor={theme.shadow}
            floodOpacity={STRONG}
          />
        </filter>

        {/* Used on a shape's own outline, clipped to the shape, which is how
            every hole here gets its inner shadow. */}
        <filter id="ar-soft">
          <feGaussianBlur stdDeviation={FRAME.bezel / 2} />
        </filter>

        <clipPath id="ar-plate-clip">
          <rect x="0" y="0" width={W} height={H} rx={FRAME.radius} />
        </clipPath>
        <clipPath id="ar-bezel-clip">
          <rect x={bezel.x} y={bezel.y} width={bezel.w} height={bezel.h} rx={FRAME.bezelRadius} />
        </clipPath>
        <clipPath id="ar-felt-clip">
          <path d={FELT_PATH} />
        </clipPath>
        <clipPath id="ar-banner-them-clip">
          <rect x={bannerX} y={bannerThemY} width={BANNER.width} height={BANNER.height} rx={FRAME.bezelRadius} />
        </clipPath>
        <clipPath id="ar-banner-you-clip">
          <rect x={bannerX} y={bannerYouY} width={BANNER.width} height={BANNER.height} rx={FRAME.bezelRadius} />
        </clipPath>
        <clipPath id="ar-niche-them-clip">
          <path d={archPath(nicheX, nicheThemY, nicheW, nicheH)} />
        </clipPath>
        <clipPath id="ar-niche-you-clip">
          <path d={archPath(nicheX, nicheYouY, nicheW, nicheH)} />
        </clipPath>
      </defs>

      {/* ── 1. The plate ─────────────────────────────────────────────────── */}
      <rect
        x={plateInset}
        y={plateInset}
        width={W - EDGE}
        height={H - EDGE}
        rx={FRAME.radius}
        fill="url(#ar-plate)"
        stroke={theme.frameEdge}
        strokeWidth={EDGE}
      />
      {/* An inlay along the top and a dark line along the bottom. Without
          these the plate is a rectangle; with them it is a thick painted
          board with a top and an underside. */}
      <path
        d={topEdge(EDGE + plateInset, EDGE + plateInset, W - (EDGE + plateInset) * 2, FRAME.radius - EDGE)}
        fill="none"
        stroke={theme.frameInlay}
        strokeWidth={EDGE}
      />
      <path
        d={bottomEdge(
          EDGE + plateInset,
          EDGE + plateInset,
          W - (EDGE + plateInset) * 2,
          H - (EDGE + plateInset) * 2,
          FRAME.radius - EDGE,
        )}
        fill="none"
        stroke={theme.shadow}
        strokeWidth={EDGE}
      />

      {/* ── 2. The bezel the panels are set down into ─────────────────────── */}
      <rect
        x={bezel.x}
        y={bezel.y}
        width={bezel.w}
        height={bezel.h}
        rx={FRAME.bezelRadius}
        fill={theme.bezel}
      />
      <g clipPath="url(#ar-bezel-clip)">
        <rect
          x={bezel.x}
          y={bezel.y}
          width={bezel.w}
          height={bezel.h}
          rx={FRAME.bezelRadius}
          fill="none"
          stroke={theme.shadow}
          strokeWidth={FRAME.bezel * 2}
          filter="url(#ar-soft)"
        />
      </g>

      {/* ── 3. The banners ───────────────────────────────────────────────────
          Drawn before the wings on purpose. Their ends run past where the
          wings start, and letting the wings cover them is what makes the
          cloth read as one length pinned under two panels. */}
      <g filter="url(#ar-cast)">
        <rect
          x={bannerX}
          y={bannerThemY}
          width={BANNER.width}
          height={BANNER.height}
          rx={FRAME.bezelRadius}
          fill="url(#ar-banner-them)"
        />
        <rect
          x={bannerX}
          y={bannerYouY}
          width={BANNER.width}
          height={BANNER.height}
          rx={FRAME.bezelRadius}
          fill="url(#ar-banner-you)"
        />
      </g>
      <g clipPath="url(#ar-banner-them-clip)">
        <rect
          x={bannerX}
          y={bannerThemY}
          width={BANNER.width}
          height={BANNER.height}
          rx={FRAME.bezelRadius}
          fill="none"
          stroke={theme.shadow}
          strokeWidth={FRAME.bezel}
          filter="url(#ar-soft)"
        />
      </g>
      <g clipPath="url(#ar-banner-you-clip)">
        <rect
          x={bannerX}
          y={bannerYouY}
          width={BANNER.width}
          height={BANNER.height}
          rx={FRAME.bezelRadius}
          fill="none"
          stroke={theme.shadow}
          strokeWidth={FRAME.bezel}
          filter="url(#ar-soft)"
        />
      </g>
      {/* The trim follows the edge that faces the middle of the board, since
          that is the edge anyone looks at. */}
      <path
        d={bottomEdge(bannerX, bannerThemY, BANNER.width, BANNER.height, FRAME.bezelRadius)}
        fill="none"
        stroke={theme.bannerTrim.them}
        strokeWidth={TRIM}
      />
      <path
        d={topEdge(bannerX, bannerYouY, BANNER.width, FRAME.bezelRadius)}
        fill="none"
        stroke={theme.bannerTrim.you}
        strokeWidth={TRIM}
      />

      {/* ── 4. The four wings ────────────────────────────────────────────── */}
      <g filter="url(#ar-cast)">
        {WINGS.map((wing, i) => (
          <path key={wing.d} d={wing.d} fill={WING_FILL[i]} />
        ))}
      </g>
      {WINGS.map(wing => (
        <path key={wing.d} d={wing.d} fill="none" stroke={theme.wingEdge} strokeWidth={EDGE} />
      ))}
      {WINGS.map(wing => (
        <path key={wing.lit} d={wing.lit} fill="none" stroke={theme.wing.light} strokeWidth={EDGE} opacity={STRONG} />
      ))}
      {/* The moulding. Two lines, one dark and one light a hair inside it, which
          is the cheapest way to make an edge look like it stands up. */}
      {WINGS.map(wing => (
        <g key={`m${wing.inner}`}>
          <path d={wing.inner} fill="none" stroke={theme.wingEdge} strokeWidth={1} opacity={HALF} />
          <path
            d={wing.inner}
            fill="none"
            stroke={theme.wing.light}
            strokeWidth={1}
            opacity={FAINT}
            transform="translate(0 1.5)"
          />
        </g>
      ))}

      {/* ── 5. The playing surface ───────────────────────────────────────── */}
      <g filter="url(#ar-cast)">
        <path d={FELT_PATH} fill="url(#ar-felt)" />
      </g>
      <g clipPath="url(#ar-felt-clip)">
        {/* The rim, shaded from inside, is what sits the surface down in the
            board instead of laying it on top. */}
        <path
          d={FELT_PATH}
          fill="none"
          stroke={theme.shadow}
          strokeWidth={FELT.bleed * 2}
          filter="url(#ar-soft)"
        />
        {/* Grain. Three passes at the quarters, each fainter than the last. */}
        {[FELT.top + FELT.height / 4, FELT.middle + FELT.height / 8, FELT.middle + FELT.height / 4].map((y, i) => (
          <path
            key={y}
            d={`M ${feltX0} ${y} ${wave(feltX0, y, MID, y + FELT.bleed / 4)} ${wave(MID, y + FELT.bleed / 4, feltX1, y)}`}
            fill="none"
            stroke={theme.feltEdge}
            strokeWidth={1}
            opacity={GRAIN - i * (GRAIN / 3)}
          />
        ))}
        <line x1={feltX0} y1={FELT.middle} x2={feltX1} y2={FELT.middle} stroke="url(#ar-seam)" strokeWidth={1} />
      </g>
      <path d={FELT_PATH} fill="none" stroke={theme.feltEdge} strokeWidth={EDGE} />

      {/* ── 6. The rails the two hands sit against ───────────────────────── */}
      <g filter="url(#ar-cast)">
        <rect x={railX0} y={HAND_RAIL.topY} width={railW} height={HAND_RAIL.height} rx={railR} fill="url(#ar-panel-top)" />
        <rect x={railX0} y={HAND_RAIL.bottomY} width={railW} height={HAND_RAIL.height} rx={railR} fill="url(#ar-panel-top)" />
      </g>
      {[HAND_RAIL.topY, HAND_RAIL.bottomY].map(y => (
        <g key={y}>
          <rect
            x={railX0}
            y={y}
            width={railW}
            height={HAND_RAIL.height}
            rx={railR}
            fill="none"
            stroke={theme.wingEdge}
            strokeWidth={EDGE}
          />
          <path
            d={topEdge(railX0, y, railW, railR)}
            fill="none"
            stroke={theme.wing.light}
            strokeWidth={EDGE}
            opacity={STRONG}
          />
        </g>
      ))}

      {/* ── 7. The bar everything that is not the game is drawn on ────────── */}
      <g filter="url(#ar-cast)">
        <rect x={barX} y={barY0} width={barW} height={barY1 - barY0} rx={barW / 2} fill="url(#ar-panel-top)" />
      </g>
      <rect
        x={barX}
        y={barY0}
        width={barW}
        height={barY1 - barY0}
        rx={barW / 2}
        fill="none"
        stroke={theme.wingEdge}
        strokeWidth={EDGE}
      />
      <path
        d={topEdge(barX, barY0, barW, barW / 2)}
        fill="none"
        stroke={theme.wing.light}
        strokeWidth={EDGE}
        opacity={STRONG}
      />

      {/* ── 8. The channel down the right, and what is cut into it ────────── */}
      <rect
        x={channelX}
        y={FELT.top}
        width={channelW}
        height={FELT.height}
        rx={FRAME.bezelRadius}
        fill="url(#ar-channel)"
        stroke={theme.wingEdge}
        strokeWidth={EDGE}
      />
      {/* The lit lip is on the left, the side the surface hands the eye over from. */}
      <line
        x1={channelX + EDGE}
        y1={FELT.top + FRAME.bezelRadius}
        x2={channelX + EDGE}
        y2={FELT.top + FELT.height - FRAME.bezelRadius}
        stroke={theme.wing.light}
        strokeWidth={EDGE}
        opacity={HALF}
      />
      <Recess
        theme={theme}
        x={socketX}
        y={FELT.middle - RIGHT.deckOffset - socketH / 2}
        w={socketW}
        h={socketH}
        r={RADIUS.lg}
      />
      <Recess
        theme={theme}
        x={socketX}
        y={FELT.middle + RIGHT.deckOffset - socketH / 2}
        w={socketW}
        h={socketH}
        r={RADIUS.lg}
      />
      {/* Wider than the channel, so its left end lies out over the surface's
          swell. That overhang is why the swell is there. */}
      <Recess
        theme={theme}
        x={buttonX}
        y={FELT.middle - buttonH / 2}
        w={buttonW}
        h={buttonH}
        r={FRAME.bezelRadius}
      />

      {/* ── 9. The two niches ────────────────────────────────────────────────
          Holes only. The brass around the opening belongs to the window that
          stands in it, which is the piece that knows whose leader it is. */}
      {[
        { y: nicheThemY, clip: "ar-niche-them-clip" },
        { y: nicheYouY, clip: "ar-niche-you-clip" },
      ].map(niche => (
        <g key={niche.clip}>
          <path d={archPath(nicheX, niche.y, nicheW, nicheH)} fill={theme.bezel} />
          <g clipPath={`url(#${niche.clip})`}>
            <path
              d={archPath(nicheX, niche.y, nicheW, nicheH)}
              fill="none"
              stroke={theme.shadow}
              strokeWidth={LEADER_WINDOW.trim * 2}
              filter="url(#ar-soft)"
            />
          </g>
        </g>
      ))}

      {/* The lamp is over the middle of the table, so the corners fall away. */}
      <g clipPath="url(#ar-plate-clip)">
        <rect x="0" y="0" width={W} height={H} fill="url(#ar-vignette)" />
      </g>
    </svg>
  );
}
