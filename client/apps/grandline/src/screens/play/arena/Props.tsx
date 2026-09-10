import { SHELF, STAGE, slabEdges } from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";

/**
 * The things somebody left on the table.
 *
 * The board reaches the edges of the screen on purpose, so there is almost no
 * room around it — twenty to fifty units of floor, which is not enough to stand
 * anything in. What there is instead is the board's own outer body: a wide belt
 * of bare wood outside the rim's channel, which is the surface `SHELF` was
 * declared for and which has been empty since the board was built.
 *
 * Three objects, at three of the four corners, and nothing at the fourth. That
 * is the whole set. A prop at every corner is a border; three of unequal weight
 * with a gap where the fourth would go is somebody's table.
 *
 * All three are outside the channel that rings the play area, so nothing here
 * is ever between a player and a card, and the battlefield keeps the whole of
 * its own attention. They are placed off the slab's edge at their own depth
 * rather than off the stage, so they follow the board out to whatever width the
 * screen is and never drift onto the floor.
 *
 * Nothing is textured. The materials are the theme's own ramps — the frame's
 * wood, the wing's stone, the brass — painted with the same one-lamp rule the
 * board obeys: lit on the faces that turn up and left, dark where they turn
 * away. Borrowing the board's texture patterns would have meant a second copy
 * of every tile for the sake of grain nobody can resolve on a chest the size of
 * a card, and would have cost more than the props are worth.
 */

const H = STAGE.height;

/** How far in from the slab's own edge, at the depth the prop stands. */
function shelfX(y: number, side: "left" | "right", spread: number): number {
  const edge = slabEdges(y);
  return side === "left"
    ? edge.x0 - spread + SHELF.inset
    : edge.x1 + spread - SHELF.inset;
}

export default function Props({ theme, spread = 0 }: {
  theme: ArenaTheme;
  /** How far past the gameplay composition the board reaches on each side. */
  spread?: number;
}) {
  const W = STAGE.width + spread * 2;

  return (
    <svg
      viewBox={`${-spread} 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        {/*
          One shadow for every prop. Small, dark and tight to the object: these
          are sitting on the board, not floating over it, and the difference
          between the two is entirely in how far the shadow spreads.
        */}
        <radialGradient id="pp-contact" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={theme.shadow} stopOpacity="0.72" />
          <stop offset="0.6" stopColor={theme.shadow} stopOpacity="0.34" />
          <stop offset="1" stopColor={theme.shadow} stopOpacity="0" />
        </radialGradient>

        {/* Wood, turned: the top face takes the lamp, the front falls away. */}
        <linearGradient id="pp-wood" x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0" stopColor={theme.frame.light} />
          <stop offset="0.4" stopColor={theme.frame.mid} />
          <stop offset="1" stopColor={theme.frameEdge} />
        </linearGradient>

        {/* Brass. Bright where it turns to the lamp and dull, not dark, where
            it turns away — metal loses its shine before it loses its colour. */}
        <linearGradient id="pp-brass" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={theme.gold.light} />
          <stop offset="0.5" stopColor={theme.gold.mid} />
          <stop offset="1" stopColor={theme.gold.dark} />
        </linearGradient>

        {/* Stone: flatter than either, because a rough surface scatters. */}
        <linearGradient id="pp-stone" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor={theme.wing.light} />
          <stop offset="0.6" stopColor={theme.wing.mid} />
          <stop offset="1" stopColor={theme.wing.dark} />
        </linearGradient>

        {/* Paper, which is the palest thing on the board and has to stay under
            the cards rather than competing with them. */}
        <linearGradient id="pp-paper" x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0" stopColor={theme.frameInlay} />
          <stop offset="0.55" stopColor={theme.frame.light} />
          <stop offset="1" stopColor={theme.frame.dark} />
        </linearGradient>
      </defs>

      <Chest theme={theme} x={shelfX(252, "left", spread)} y={152} />
      <Chart theme={theme} x={shelfX(884, "left", spread)} y={788} />
      <Dividers theme={theme} x={shelfX(196, "right", spread)} y={92} />
    </svg>
  );
}

/**
 * A chest, at the far left where the lamp is.
 *
 * The heaviest silhouette in the set and the only one with height, so it goes
 * nearest the light, where its top face can catch something and its front can
 * fall into shadow. Drawn as two faces rather than one rectangle: from almost
 * overhead you see the lid and a little of the front, which is the same read
 * the board's own near lip gives.
 */
function Chest({ theme, x, y }: { theme: ArenaTheme; x: number; y: number }) {
  const w = 148;
  /** The lid, then the front you can just see under it. */
  const lid = 68;
  const face = 30;

  return (
    <g>
      <ellipse cx={x + w / 2 + 8} cy={y + lid + face + 4} rx={w * 0.58} ry={16} fill="url(#pp-contact)" />

      {/* The lid: narrower at the back, because the back of it is further off. */}
      <path
        d={`M ${x + 12} ${y} L ${x + w - 12} ${y} L ${x + w} ${y + lid} L ${x} ${y + lid} Z`}
        fill="url(#pp-wood)"
      />
      <rect x={x} y={y + lid} width={w} height={face} rx={3} fill={theme.frameEdge} />

      {/* Two straps over the lid and down the face, and the hasp between them.
          Brass is the board's own metal, so the chest is of a piece with it. */}
      {[0.24, 0.72].map(at => (
        <path
          key={at}
          d={`M ${x + 12 + (w - 24) * at} ${y} L ${x + (w) * at} ${y + lid + face}`}
          stroke="url(#pp-brass)"
          strokeWidth={11}
          opacity="0.9"
        />
      ))}
      <rect x={x + w / 2 - 13} y={y + lid - 7} width={26} height={22} rx={3} fill="url(#pp-brass)" stroke={theme.bezel} strokeWidth={1.5} />
      <circle cx={x + w / 2} cy={y + lid + 5} r={3.4} fill={theme.bezel} />

      {/* The lit back edge of the lid, and the dark line where it shuts. */}
      <path d={`M ${x + 14} ${y + 2} L ${x + w - 14} ${y + 2}`} stroke={theme.frame.light} strokeWidth={2.5} opacity="0.75" />
      <path d={`M ${x + 1} ${y + lid} L ${x + w - 1} ${y + lid}`} stroke={theme.shadow} strokeWidth={2.5} opacity="0.55" />
      <path
        d={`M ${x + 12} ${y} L ${x + w - 12} ${y} L ${x + w} ${y + lid} L ${x + w} ${y + lid + face} L ${x} ${y + lid + face} L ${x} ${y + lid} Z`}
        fill="none"
        stroke={theme.bezel}
        strokeWidth={2.5}
        opacity="0.8"
      />
    </g>
  );
}

/**
 * A rolled chart with a stone holding it down, at the near left.
 *
 * Lying flat, because everything at this end of the board is lying flat, and
 * angled off the board's axis: the one object in the set that is not square to
 * anything says a person put it there rather than a layout engine.
 */
function Chart({ theme, x, y }: { theme: ArenaTheme; x: number; y: number }) {
  const length = 168;
  const thick = 34;

  return (
    <g transform={`rotate(-8 ${x + length / 2} ${y + thick / 2})`}>
      <ellipse cx={x + length / 2 + 6} cy={y + thick + 2} rx={length * 0.54} ry={12} fill="url(#pp-contact)" />

      {/* The roll, with its far end open so it reads as paper and not a dowel. */}
      <rect x={x} y={y} width={length} height={thick} rx={thick / 2} fill="url(#pp-paper)" />
      <ellipse cx={x + 4} cy={y + thick / 2} rx={7} ry={thick / 2 - 1} fill={theme.frameEdge} opacity="0.55" />
      <ellipse cx={x + 4} cy={y + thick / 2} rx={3} ry={thick / 2 - 8} fill={theme.bezel} opacity="0.5" />

      {/* Where the outer turn of the paper laps over the one under it. */}
      <path
        d={`M ${x + 22} ${y + thick - 7} L ${x + length - 10} ${y + thick - 9}`}
        stroke={theme.frameEdge}
        strokeWidth={2}
        opacity="0.5"
      />
      <path d={`M ${x + 18} ${y + 3} L ${x + length - 12} ${y + 2}`} stroke={theme.frameInlay} strokeWidth={2} opacity="0.5" />

      {/* A ribbon round it, in the trim the board uses for the near player. */}
      <rect x={x + length * 0.62} y={y - 3} width={9} height={thick + 6} rx={2} fill={theme.bannerTrim.you} opacity="0.9" />

      {/* The weight, sitting on the roll rather than beside it. */}
      <ellipse cx={x + length * 0.26} cy={y + 2} rx={31} ry={19} fill="url(#pp-stone)" />
      <ellipse cx={x + length * 0.26 - 6} cy={y - 3} rx={17} ry={9} fill={theme.wing.light} opacity="0.45" />
      <ellipse cx={x + length * 0.26} cy={y + 2} rx={31} ry={19} fill="none" stroke={theme.bezel} strokeWidth={2} opacity="0.7" />

      <rect x={x} y={y} width={length} height={thick} rx={thick / 2} fill="none" stroke={theme.bezel} strokeWidth={2} opacity="0.7" />
    </g>
  );
}

/**
 * A pair of dividers lying open, with two coins beside them, at the far right.
 *
 * The quiet corner. It gets the smallest and flattest thing in the set, because
 * the right hand rim already carries the decks, the button and a row of energy,
 * and a third heavy object out here would make that side of the board louder
 * than the side with the lamp on it.
 */
function Dividers({ theme, x, y }: { theme: ArenaTheme; x: number; y: number }) {
  /** Measured from its right hand edge inwards, since that is what is fixed. */
  const left = x - 132;

  return (
    <g>
      <ellipse cx={left + 62} cy={y + 76} rx={74} ry={17} fill="url(#pp-contact)" />

      {/* Two legs from one hinge. Round caps, because a drawn instrument this
          small reads by its joint and its points and nothing else. */}
      <g stroke="url(#pp-brass)" strokeWidth={11} strokeLinecap="round" fill="none">
        <path d={`M ${left + 44} ${y + 8} L ${left + 10} ${y + 78}`} />
        <path d={`M ${left + 44} ${y + 8} L ${left + 92} ${y + 70}`} />
      </g>
      <circle cx={left + 44} cy={y + 8} r={10} fill="url(#pp-brass)" stroke={theme.bezel} strokeWidth={1.5} />
      <circle cx={left + 44} cy={y + 8} r={3.2} fill={theme.bezel} />
      <path
        d={`M ${left + 42} ${y + 4} L ${left + 12} ${y + 72}`}
        stroke={theme.gold.light}
        strokeWidth={2}
        opacity="0.6"
      />

      {/* Two coins, one over the other, which is the smallest way to say that
          more than one of a thing is lying there. */}
      <ellipse cx={left + 112} cy={y + 40} rx={17} ry={11} fill="url(#pp-brass)" />
      <ellipse cx={left + 112} cy={y + 40} rx={9} ry={5} fill="none" stroke={theme.gold.dark} strokeWidth={1.5} opacity="0.8" />
      <ellipse cx={left + 122} cy={y + 52} rx={17} ry={11} fill="url(#pp-brass)" />
      <ellipse cx={left + 122} cy={y + 52} rx={17} ry={11} fill="none" stroke={theme.gold.dark} strokeWidth={1.5} opacity="0.7" />
      <path d={`M ${left + 108} ${y + 44} A 17 11 0 0 1 ${left + 132} ${y + 50}`} stroke={theme.gold.light} strokeWidth={1.5} fill="none" opacity="0.55" />
    </g>
  );
}
