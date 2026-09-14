import { ENERGY, MOTION, STATION } from "../../../design/arenaStage";
import { MOTION as APP_MOTION, text } from "../../../design/tokens";
import type { ArenaTheme } from "../../../design/arenaThemes";

/**
 * Energy: a row of stones seated in the channel the board is cut with, and the
 * plate beside them that says the number.
 *
 * All ten sockets are cut into the rail from the first turn, so the row is the
 * same length in the opening turn as it is in the last one and a player learns
 * where the tenth stone will sit long before earning it. Stones fill left to
 * right, one more each round, and spending one takes its light away without
 * taking its place away: a row that reflowed as you spent it would be a row you
 * had to count again every time you looked at it.
 *
 * The stones are drawn in SVG rather than as rotated boxes because a diamond
 * here is a cut stone, with a lit crown, a mid girdle and a bottom in shadow.
 * Those are real shapes, and a CSS rotation could only give them one flat
 * colour between them.
 *
 * Neither piece places itself. The board's own geometry says where the channel
 * is and where inside it these two sit, so a station's parts cannot drift apart
 * from the hole they are supposed to be in.
 */

/** Two decimals is more than enough at this size, and keeps the paths short. */
function n(v: number): string {
  return v.toFixed(2);
}

/**
 * One user unit. Not a chosen thickness so much as the thinnest line there is,
 * which is what an edge on this board is drawn with.
 */
const HAIRLINE = 1;

/** Half a socket. Every radius on this drawing comes off it. */
const R = ENERGY.size / 2;

/**
 * The stone sits a hair inside its socket, so the rim of the recess reads all
 * the way round instead of disappearing under the stone.
 */
const GEM_R = R - HAIRLINE * 2;

/**
 * The points taken off the four corners. An eighth of the socket: enough that
 * the points stop reading as needles at this size, not enough to turn the
 * square back into a circle. Kept as a fraction so it still holds if the
 * sockets are ever measured larger.
 */
const CORNER = ENERGY.size / 8;

/** The stone's corners are softened by the same proportion as its socket's. */
const GEM_CORNER = CORNER * (GEM_R / R);

/**
 * How far in the four cut facets sit from the stone's outline. What is left
 * over is the girdle, the band of mid tone around the outside, and that band is
 * the whole reason a flat shape reads as a cut stone at twenty four across.
 */
const FACET_R = GEM_R * 0.68;

/**
 * Room around the row for the glow of a lit stone and for the extra size of the
 * newest one. Two socket gaps, which is about as far as the glow carries. The
 * drawing is wider than the row because of it; the row's own box is not, so a
 * caller still lines this up against ENERGY.width.
 */
const PAD = ENERGY.gap * 2;

/**
 * How much larger the newest stone draws while it is still the newest. Small on
 * purpose: it has to stay the same object as the nine beside it, only fresher.
 */
const SETTLE = 1.12;
/** Where the arrival starts, and how far past its resting size it swings. */
const ARRIVE_FROM = 0.55;
const ARRIVE_OVER = 1.24;

/**
 * The app's settled curve without its duration. The shape of the motion is
 * borrowed from the design tokens; the timing is the board's own, MOTION.glow.
 */
const EASE = APP_MOTION.settled.replace(/^\d+ms\s+/, "");

/**
 * A diamond centred on the origin: a square stood on one corner, with the four
 * points softened. `radius` is centre to point.
 */
function diamond(radius: number, corner: number): string {
  // Every edge of a diamond runs at 45 degrees, so pulling back along an edge
  // moves the same distance in x as in y.
  const k = corner / Math.SQRT2;
  return [
    `M ${n(-k)} ${n(-radius + k)}`,
    `Q 0 ${n(-radius)} ${n(k)} ${n(-radius + k)}`,
    `L ${n(radius - k)} ${n(-k)}`,
    `Q ${n(radius)} 0 ${n(radius - k)} ${n(k)}`,
    `L ${n(k)} ${n(radius - k)}`,
    `Q 0 ${n(radius)} ${n(-k)} ${n(radius - k)}`,
    `L ${n(-radius + k)} ${n(k)}`,
    `Q ${n(-radius)} 0 ${n(-radius + k)} ${n(-k)}`,
    "Z",
  ].join(" ");
}

/**
 * The two upper edges of a socket, west point to east point. Light on this
 * board falls from above, so only this half of the rim catches it.
 */
function upperRim(radius: number, corner: number): string {
  const k = corner / Math.SQRT2;
  return [
    `M ${n(-radius + k)} ${n(-k)}`,
    `L ${n(-k)} ${n(-radius + k)}`,
    `Q 0 ${n(-radius)} ${n(k)} ${n(-radius + k)}`,
    `L ${n(radius - k)} ${n(-k)}`,
  ].join(" ");
}

const SOCKET_PATH = diamond(R, CORNER);
const GEM_PATH = diamond(GEM_R, GEM_CORNER);
const RIM_PATH = upperRim(R, CORNER);

/**
 * The four facets, each a triangle from the middle of the stone out to one of
 * its points. They stop short of the outline, so none of them needs clipping.
 */
const FACET_NW = `M 0 0 L ${n(-FACET_R)} 0 L 0 ${n(-FACET_R)} Z`;
const FACET_NE = `M 0 0 L 0 ${n(-FACET_R)} L ${n(FACET_R)} 0 Z`;
const FACET_SW = `M 0 0 L ${n(-FACET_R)} 0 L 0 ${n(FACET_R)} Z`;
const FACET_SE = `M 0 0 L 0 ${n(FACET_R)} L ${n(FACET_R)} 0 Z`;

/** The glint, out near the edge of the lit crown where the light lands. */
const SPECULAR = { x: -FACET_R * 0.42, y: -FACET_R * 0.42, r: GEM_R * 0.14 };

/** How far the glow of a lit stone carries, and of a brand new one. */
const GLOW = ENERGY.gap;
const GLOW_NEW = ENERGY.gap * 1.6;

/**
 * Reduced motion is already handled once for the whole app in global.css, so
 * there is nothing about it here. The transition sits in a class because its
 * timing is fixed; the values it animates are inline, because they are made of
 * theme colours and the class cannot know them.
 */
const CSS = `
.ar-energy-stone {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform ${MOTION.glow}ms ${EASE}, filter ${MOTION.glow}ms ${EASE};
}
.ar-energy-new {
  animation: ar-energy-arrive ${MOTION.glow}ms ${EASE} 1;
}
@keyframes ar-energy-arrive {
  from { transform: scale(${ARRIVE_FROM}); }
  55%  { transform: scale(${ARRIVE_OVER}); }
  to   { transform: scale(${SETTLE}); }
}
`;

/**
 * What a stone is made of, as one filter.
 *
 * Colour, light and glow all live in the filter so the whole change from lit to
 * spent, or from newest to merely old, can ride on one transition. The three
 * functions are always given in the same order, and a spent stone keeps a glow
 * of zero rather than dropping it, because two filters interpolate only if they
 * list the same things.
 */
function stoneFilter(theme: ArenaTheme, spent: boolean, newest: boolean): string {
  if (spent) return `saturate(0.1) brightness(0.5) drop-shadow(0 0 0px ${theme.gem.mid})`;
  if (newest) {
    return `saturate(1.12) brightness(1.2) drop-shadow(0 0 ${n(GLOW_NEW)}px ${theme.gem.light})`;
  }
  return `saturate(1) brightness(1) drop-shadow(0 0 ${n(GLOW)}px ${theme.gem.mid})`;
}

export default function EnergyRail({
  theme,
  have,
  max,
}: {
  theme: ArenaTheme;
  /** How much is left to spend this turn. */
  have: number;
  /** How many the player has earned so far, which grows by one a round. */
  max: number;
}): JSX.Element {
  // The rail is ten sockets long and cannot grow, so anything past ten is
  // dropped here rather than drawn off the end of the board.
  //
  // A player can hold more than they have earned — the opening hand comes with
  // a spare — so the row counts out whichever is larger. Otherwise the stones
  // would say one and the number beside them in the same channel would say two,
  // and the channel would be arguing with itself.
  const spendable = Math.round(have);
  const earned = Math.max(0, Math.min(ENERGY.sockets, Math.max(Math.round(max), spendable)));
  const lit = Math.max(0, Math.min(earned, spendable));

  const width = ENERGY.width + PAD * 2;
  const height = ENERGY.size + PAD * 2;

  return (
    <>
      <style>{CSS}</style>

      {/*
        The row's box is exactly the row, and the board has a hole exactly that
        size waiting for it. The drawing is bigger, and hangs out of the box by
        PAD on every side, so a glow can spill without the box it is measured by
        growing to make space for it.
      */}
      <div style={{ position: "relative", width: ENERGY.width, height: ENERGY.size }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ position: "absolute", left: -PAD, top: -PAD, display: "block" }}
          role="img"
          aria-label={`${lit} of ${earned} energy`}
        >
          {Array.from({ length: ENERGY.sockets }, (_unused, i) => {
            const cx = PAD + i * (ENERGY.size + ENERGY.gap) + R;
            const cy = PAD + R;
            const filled = i < earned;
            const spent = filled && i >= lit;
            // The one that arrived this round. A spent stone still settles, since
            // it is the same age; it just has no light for the brightening to
            // work on.
            const newest = filled && i === earned - 1;

            return (
              <g key={i} transform={`translate(${n(cx)} ${n(cy)})`}>
                {/* The recess: a hole in the rail, brass rimmed like every other
                    opening cut into this board, lit along its upper edges. */}
                <path d={SOCKET_PATH} fill={theme.gemEmpty} />
                <path
                  d={SOCKET_PATH}
                  fill="none"
                  stroke={theme.gold.dark}
                  strokeWidth={HAIRLINE}
                  opacity={0.7}
                />
                <path
                  d={RIM_PATH}
                  fill="none"
                  stroke={theme.gold.light}
                  strokeWidth={HAIRLINE}
                  strokeLinecap="round"
                  opacity={0.55}
                />

                {filled ? (
                  <g
                    className={newest ? "ar-energy-stone ar-energy-new" : "ar-energy-stone"}
                    style={{
                      transform: `scale(${newest ? SETTLE : 1})`,
                      filter: stoneFilter(theme, spent, newest),
                    }}
                  >
                    {/* The body, which shows around the facets as the girdle. */}
                    <path d={GEM_PATH} fill={theme.gem.mid} />

                    {/* The crown, then the pavilion. The left of each pair takes
                        a little more light than the right, so the stone looks
                        lit from over your shoulder rather than dead on. */}
                    <path d={FACET_NW} fill={theme.gem.light} />
                    <path d={FACET_NE} fill={theme.gem.light} opacity={0.72} />
                    <path d={FACET_SW} fill={theme.gem.dark} opacity={0.72} />
                    <path d={FACET_SE} fill={theme.gem.dark} />

                    <path
                      d={GEM_PATH}
                      fill="none"
                      stroke={theme.gem.light}
                      strokeWidth={HAIRLINE}
                      opacity={0.55}
                    />

                    {/* The glint is white light rather than the stone's own
                        colour, and the whitest paint on this board is the line
                        inlaid into the frame, so it borrows that. */}
                    <circle
                      cx={n(SPECULAR.x)}
                      cy={n(SPECULAR.y)}
                      r={n(SPECULAR.r)}
                      fill={theme.frameInlay}
                      opacity={0.85}
                    />
                  </g>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
}

/**
 * The number, on the plate set into the same channel as the stones.
 *
 * The stones say how much energy there is at a glance and how much of it has
 * gone; they are bad at the one question a player asks while working out
 * whether a card is affordable, which is exactly how many. So the channel
 * carries both. The plate is the board's — the same hole with a brass lip as
 * the two at the foot of a leader's frame, cut by the station — and this is
 * the number painted onto its floor.
 *
 * The denominator is the rules' own cap, taken from the engine. Nothing here
 * decides how much energy a player may have.
 */
export function EnergyReadout({ theme, have }: {
  theme: ArenaTheme;
  have: number;
}): JSX.Element {
  const value = Math.max(0, Math.min(ENERGY.sockets, Math.round(have)));
  const spent = value === 0;

  return (
    <div
      style={{
        width: STATION.readout.width,
        height: STATION.readout.height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/*
        No word on the plate. One would have to be drawn at seven units to fit
        the channel, which is four pixels on a small screen and therefore not a
        label at all — and a number in a channel full of energy stones does not
        need telling what it counts. What the plate holds instead is a number as
        large as it will take.

        Two boxes rather than one: the pair sit on a shared baseline, which is
        the only way two sizes of digit read as one number, and the group is
        then centred in the plate as a block. Aligning the two against the plate
        itself would either pin them to its top edge, which is what a
        baseline-aligned flex line does, or put the slash on a different line
        from the digits.
      */}
      <span
        style={{
          display: "flex",
          alignItems: "baseline",
          // Digits carry no descender, so their ink sits high in the box the
          // font reserves for them. A unit down centres what you can see
          // rather than what the font asked for.
          transform: "translateY(1px)",
        }}
      >
        <span
          style={{
            ...text("data"),
            fontSize: 24,
            lineHeight: 1,
            // Empty is still a number a player reads, so it goes pale rather
            // than dim: the board's own light paint, not its shadow.
            color: spent ? theme.paint : theme.gem.light,
            transition: `color ${MOTION.glow}ms ease-out`,
          }}
        >
          {value}
        </span>
        <span
          style={{
            ...text("data"),
            fontSize: 14,
            lineHeight: 1,
            // A hair of air, so the cap reads as a denominator and not as a
            // third digit. Any more and ten out of ten stops fitting the plate.
            marginLeft: 3,
            color: theme.paint,
            opacity: 0.55,
          }}
        >
          {`/${ENERGY.sockets}`}
        </span>
      </span>
    </div>
  );
}
