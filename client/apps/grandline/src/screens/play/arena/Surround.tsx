import { BOARD, STAGE } from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";

/**
 * What is behind the board, and what the board is standing on.
 *
 * This is the only part of the arena that lives further away than the board
 * itself, so it is the only part that can be occluded by it — which is the
 * whole reason it exists. A crate whose top half is hidden behind the table
 * says more about where the table is than any amount of shading on the table
 * could, because something has to be behind it for behind to mean anything.
 *
 * Three things, in order of how much work they do:
 *
 * The board's own shadow on the floor. The slab already casts a shadow onto
 * itself, but nothing put the board in the room; this is what sits it down.
 *
 * The floor falling away at the near edge. A room lit from over the board gets
 * darker towards the viewer, and the near strip is the only floor there is room
 * to see, so it is the only place the falloff can read.
 *
 * One crate, tucked in behind the near left corner. Not two, not a stack, not
 * a corner of the room full of barrels: there are ninety units of floor below
 * the board and a single strong silhouette in them is worth more than a row of
 * small ones. It is at one corner and there is deliberately nothing at the
 * other three, because a room with something in every corner reads as a
 * pattern rather than as a place somebody works in.
 */

const H = STAGE.height;

export default function Surround({ theme, spread = 0 }: {
  theme: ArenaTheme;
  /** How far past the gameplay composition the board reaches on each side. */
  spread?: number;
}) {
  const W = STAGE.width + spread * 2;
  /** The floor below the board's near edge, which is all the floor there is. */
  const floor = BOARD.nearY + BOARD.lip + 12;

  return (
    <svg
      viewBox={`${-spread} 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        {/* What the board drops onto the floor. Wide, shallow and soft: the
            lamp is high, so the shadow is close in under the object. */}
        <radialGradient id="sr-ground" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={theme.shadow} stopOpacity="0.85" />
          <stop offset="0.55" stopColor={theme.shadow} stopOpacity="0.5" />
          <stop offset="1" stopColor={theme.shadow} stopOpacity="0" />
        </radialGradient>

        {/* The floor going away towards the viewer. */}
        <linearGradient id="sr-floor" gradientUnits="userSpaceOnUse" x1={0} y1={floor} x2={0} y2={H}>
          <stop offset="0" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.55" />
        </linearGradient>

        {/* A prop's own contact shadow: where it meets the floor and no light
            can get in. Tight, because a shadow that spreads reads as a hover. */}
        <radialGradient id="sr-contact" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={theme.shadow} stopOpacity="0.8" />
          <stop offset="1" stopColor={theme.shadow} stopOpacity="0" />
        </radialGradient>

        {/*
          The crate's wood. It stands behind the table and inside the shadow
          the table throws, so it is the darkest wood in the arena — which is
          the point of it: the board's own near edge only reads as lit if there
          is something unlit beside it. Darker still towards the floor, where
          not even bounced light gets in.
        */}
        <linearGradient id="sr-crate" gradientUnits="userSpaceOnUse" x1={0} y1={900} x2={0} y2={1074}>
          <stop offset="0" stopColor={theme.frame.dark} />
          <stop offset="0.5" stopColor={theme.frameEdge} />
          <stop offset="1" stopColor={theme.bezel} />
        </linearGradient>
      </defs>

      <ellipse cx={STAGE.width / 2} cy={floor + 6} rx={W * 0.52} ry={62} fill="url(#sr-ground)" />
      <rect x={-spread} y={floor} width={W} height={H - floor} fill="url(#sr-floor)" />

      <Crate theme={theme} />
    </svg>
  );
}

/**
 * A crate on the floor behind the near left corner of the table.
 *
 * Drawn whole and let the board cover most of it, rather than drawn as the
 * sliver that shows. The sliver is what you see; the crate is what is there,
 * and the difference is that the lid line and the brace run off under the
 * table instead of stopping at a border.
 *
 * Its near face is what the lamp cannot reach, so it is the darkest wood on
 * screen — which is what makes the board's own near edge read as lit.
 */
function Crate({ theme }: { theme: ArenaTheme }) {
  /** Kept clear of the near hand, which reaches this far left at ten cards. */
  const x = -76;
  const y = 884;
  const w = 172;
  const h = 190;

  return (
    <g>
      <ellipse cx={x + w / 2 + 10} cy={y + h - 6} rx={w * 0.62} ry={20} fill="url(#sr-contact)" />

      {/* The body, and the lid sitting a little proud of it. */}
      <rect x={x} y={y + 22} width={w} height={h - 22} rx={5} fill="url(#sr-crate)" />
      <rect x={x - 6} y={y} width={w + 12} height={30} rx={5} fill={theme.frame.dark} />

      {/* Two braces and a strap, in the board's own brass so the crate belongs
          to the same set of objects. Their heights are picked so one of them
          lands in the band below the table, which is the only band you see. */}
      <rect x={x} y={y + 96} width={w} height={10} fill={theme.gold.dark} opacity="0.8" />
      <rect x={x} y={y + 152} width={w} height={10} fill={theme.gold.dark} opacity="0.8" />
      <path
        d={`M ${x} ${y + 97} L ${x + w} ${y + 97} M ${x} ${y + 153} L ${x + w} ${y + 153}`}
        stroke={theme.gold.mid}
        strokeWidth={2}
        opacity="0.5"
      />
      <rect x={x + w * 0.34} y={y} width={14} height={h} fill={theme.gold.dark} opacity="0.6" />

      {/* Two boards' worth of grain, which is as much as reads at this size. */}
      <path
        d={`M ${x + 14} ${y + 126} L ${x + w - 20} ${y + 122} M ${x + 22} ${y + 176} L ${x + w - 14} ${y + 180}`}
        stroke={theme.bezel}
        strokeWidth={2}
        opacity="0.5"
      />

      <rect x={x} y={y + 22} width={w} height={h - 22} rx={5} fill="none" stroke={theme.bezel} strokeWidth={2.5} opacity="0.8" />
    </g>
  );
}
