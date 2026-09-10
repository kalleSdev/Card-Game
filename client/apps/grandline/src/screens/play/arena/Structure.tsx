import {
  BOARD, LIGHT, PLINTH, STAGE, WELL, slabEdges,
} from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";
import {
  apronPath, buttonSocket, deckSocket, lipPath, plinthPath, rimLeft, rimRight, slabPath, wellPath,
} from "./board";

/**
 * The board as an object.
 *
 * A slab with a well cut into it, a rim around the well, a block at each end
 * holding a leader, and sockets cut into the right hand rim for the decks and
 * the button. Nothing here knows about the game; it is the thing the game is
 * played on.
 *
 * Everything is lit by one lamp, hung high and a little to the left. That is
 * the only reason any of this reads as carved: an edge facing the lamp is pale,
 * the edge opposite it is dark, and a hole is the one where those two are the
 * wrong way round. Light from two directions would make it a diagram again.
 *
 * Materials are not painted here yet. Each surface is filled from its theme's
 * own ramp and lit, and the texture that belongs on it goes over the top when
 * it exists. Faking wood with a gradient would only make the missing texture
 * harder to see.
 */

const W = STAGE.width;
const H = STAGE.height;

/** How wide a carved edge reads at this size. */
const EDGE = 3;

/** The strength of a lit edge, and of the one in shadow. */
const LIT = 0.75;
const DARK = 0.6;

export default function Structure({ theme, spread = 0 }: {
  theme: ArenaTheme;
  /** How far past the gameplay composition this board reaches on each side. */
  spread?: number;
}) {
  const slab = slabPath(spread);
  const well = wellPath();
  const lip = lipPath(spread);
  const apron = spread > 8 ? apronPath(spread) : null;
  const farPlinth = plinthPath("far");
  const nearPlinth = plinthPath("near");
  const decks = [deckSocket("far"), deckSocket("near")];
  const button = buttonSocket();

  return (
    <svg
      viewBox={`${-spread} 0 ${W + spread * 2} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        {/* The lamp. Everything on the board is shaded against this one shape,
            which is what keeps the whole object lit from the same place. */}
        <radialGradient id="st-lamp" gradientUnits="userSpaceOnUse" cx={LIGHT.x} cy={LIGHT.y} r={LIGHT.reach}>
          <stop offset="0" stopColor={theme.lamp} stopOpacity="0.5" />
          <stop offset="0.4" stopColor={theme.lamp} stopOpacity="0.16" />
          <stop offset="1" stopColor={theme.lamp} stopOpacity="0" />
        </radialGradient>

        {/* What the lamp does not reach. Not a vignette over the screen: it is
            centred on the lamp, so the far corner from it is the dark one. */}
        <radialGradient id="st-falloff" gradientUnits="userSpaceOnUse" cx={LIGHT.x} cy={LIGHT.y} r={LIGHT.reach * 1.15}>
          <stop offset="0" stopColor="#000000" stopOpacity="0" />
          <stop offset="0.42" stopColor="#000000" stopOpacity="0.14" />
          <stop offset="0.75" stopColor="#000000" stopOpacity="0.38" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.62" />
        </radialGradient>

        {/* The slab's own body: pale where the lamp strikes it, deeper along
            the near edge where it turns away. */}
        <linearGradient id="st-slab" gradientUnits="userSpaceOnUse" x1={0} y1={BOARD.farY} x2={0} y2={BOARD.nearY + BOARD.lip}>
          <stop offset="0" stopColor={theme.frame.light} />
          <stop offset="0.45" stopColor={theme.frame.mid} />
          <stop offset="1" stopColor={theme.frame.dark} />
        </linearGradient>

        {/* The near edge, seen end on. Always darker than the face above it. */}
        <linearGradient id="st-lip" gradientUnits="userSpaceOnUse" x1={0} y1={BOARD.nearY} x2={0} y2={BOARD.nearY + BOARD.lip}>
          <stop offset="0" stopColor={theme.frame.dark} />
          <stop offset="1" stopColor={theme.frameEdge} />
        </linearGradient>

        {/* A plinth is the same material as the slab, stood up into the light. */}
        <linearGradient id="st-plinth-far" gradientUnits="userSpaceOnUse" x1={0} y1={PLINTH.far.top} x2={0} y2={PLINTH.far.bottom}>
          <stop offset="0" stopColor={theme.frame.light} />
          <stop offset="1" stopColor={theme.frame.mid} />
        </linearGradient>
        <linearGradient id="st-plinth-near" gradientUnits="userSpaceOnUse" x1={0} y1={PLINTH.near.top} x2={0} y2={PLINTH.near.bottom}>
          <stop offset="0" stopColor={theme.frame.mid} />
          <stop offset="0.6" stopColor={theme.frame.light} />
          <stop offset="1" stopColor={theme.frame.dark} />
        </linearGradient>

        {/* A hole. Dark at its far wall, because that is the wall facing you. */}
        <linearGradient id="st-hole" gradientUnits="userSpaceOnUse" x1={0} y1={WELL.farY} x2={0} y2={WELL.nearY}>
          <stop offset="0" stopColor={theme.bezel} />
          <stop offset="1" stopColor={theme.frameEdge} stopOpacity="0.85" />
        </linearGradient>

        <filter id="st-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={WELL.depth / 2} />
        </filter>

        <filter id="st-cast" x="-30%" y="-40%" width="160%" height="190%">
          <feDropShadow dx="0" dy={10} stdDeviation={14} floodColor={theme.shadow} floodOpacity={DARK} />
        </filter>

        <clipPath id="st-slab-clip"><path d={slab} /></clipPath>
        <clipPath id="st-well-clip"><path d={well} /></clipPath>
      </defs>

      {/* ── The board ────────────────────────────────────────────────────── */}
      {/* On a wide screen the slab stands on a step that carries the board out
          to the edges of the room, so the extra width is a tier of the object
          rather than more of the same flat plate. */}
      {apron && (
        <g filter="url(#st-cast)">
          <path d={apron} fill="url(#st-slab)" opacity="0.92" />
          <path d={apron} fill="url(#st-falloff)" />
          <path d={apron} fill="none" stroke={theme.frameEdge} strokeWidth={2} />
        </g>
      )}

      <g filter="url(#st-cast)">
        <path d={lip} fill="url(#st-lip)" />
        <path d={slab} fill="url(#st-slab)" />
      </g>

      <g clipPath="url(#st-slab-clip)">
        {/* Lit, then unlit, in that order, so the far corner from the lamp is
            the one that goes dark rather than the middle of the board. */}
        <rect x={-spread} y="0" width={W + spread * 2} height={H} fill="url(#st-lamp)" style={{ mixBlendMode: "soft-light" }} />
        <rect x={-spread} y="0" width={W + spread * 2} height={H} fill="url(#st-falloff)" />

        {/* The edge where the slab's face turns over into its near edge. */}
        <path
          d={slab}
          fill="none"
          stroke={theme.frameInlay}
          strokeWidth={EDGE}
          opacity={LIT * 0.6}
          transform="translate(0 2)"
        />
      </g>

      <path d={slab} fill="none" stroke={theme.frameEdge} strokeWidth={2} />
      <path d={lip} fill="none" stroke={theme.frameEdge} strokeWidth={2} />

      {/* ── The well ─────────────────────────────────────────────────────── */}
      <path d={well} fill="url(#st-hole)" />
      <g clipPath="url(#st-well-clip)">
        {/* Ambient occlusion: the corner where the rim meets the floor of the
            well never sees the lamp, so it is dark all the way round. */}
        <path
          d={well}
          fill="none"
          stroke={theme.shadow}
          strokeWidth={WELL.depth * 2}
          filter="url(#st-soft)"
          opacity={DARK}
        />
      </g>
      {/* The rim's inner lip: lit on the far wall, which faces the lamp. */}
      <path d={well} fill="none" stroke={theme.frameEdge} strokeWidth={2} />
      <RimLight theme={theme} d={well} />

      {/* ── Sockets cut into the right hand rim ──────────────────────────── */}
      {decks.map((socket, i) => (
        <Socket key={`deck${i}`} theme={theme} {...socket} r={12} />
      ))}
      <Socket theme={theme} {...button} r={14} />

      {/* ── The plinths ──────────────────────────────────────────────────── */}
      <g filter="url(#st-cast)">
        <path d={farPlinth} fill="url(#st-plinth-far)" />
        <path d={nearPlinth} fill="url(#st-plinth-near)" />
      </g>
      <path d={farPlinth} fill="none" stroke={theme.frameEdge} strokeWidth={2} />
      <path d={nearPlinth} fill="none" stroke={theme.frameEdge} strokeWidth={2} />
      <g clipPath="url(#st-slab-clip)">
        <rect x={-spread} y="0" width={W + spread * 2} height={H} fill="url(#st-lamp)" style={{ mixBlendMode: "soft-light" }} opacity={0.5} />
      </g>

      {/* A carved line following each rim, a hand's width in from the edge.
          It is what stops the rim reading as a plain border. */}
      <RimGroove theme={theme} spread={spread} />
    </svg>
  );
}

/**
 * The lit lip of a hole.
 *
 * A hole's far wall faces the lamp and its near wall faces away, which is the
 * opposite of a raised block. Getting this backwards is the difference between
 * something set into the board and something sitting on it.
 */
function RimLight({ theme, d }: { theme: ArenaTheme; d: string }) {
  return (
    <g clipPath="url(#st-well-clip)">
      <path
        d={d}
        fill="none"
        stroke={theme.frame.light}
        strokeWidth={EDGE}
        opacity={LIT}
        transform="translate(0 3)"
      />
    </g>
  );
}

/** A recess cut into the rim, for a deck or for the button. */
function Socket({ theme, x, y, w, h, r }: {
  theme: ArenaTheme;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={r} fill="url(#st-hole)" />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        fill="none"
        stroke={theme.shadow}
        strokeWidth={10}
        filter="url(#st-soft)"
        opacity={DARK}
        clipPath="none"
      />
      {/* Lit on the far lip, dark on the near one: a hole, not a bump. */}
      <path
        d={`M ${x + r} ${y + 2} L ${x + w - r} ${y + 2}`}
        stroke={theme.frame.light}
        strokeWidth={EDGE}
        opacity={LIT * 0.8}
      />
      <rect x={x} y={y} width={w} height={h} rx={r} fill="none" stroke={theme.frameEdge} strokeWidth={1.5} />
    </g>
  );
}

/**
 * The groove that runs round the rim.
 *
 * It follows the rim rather than the slab, a fixed distance in from the well,
 * so it stays parallel to the play area as the board tapers. A border drawn
 * parallel to the outside instead would drift away from the well and the board
 * would look like it had been assembled out of two different objects.
 */
function RimGroove({ theme, spread }: { theme: ArenaTheme; spread: number }) {
  const inset = 26 + spread;
  const steps = 24;
  const points: string[] = [];

  // Down the left rim, across the near edge, and back up the right.
  for (let i = 0; i <= steps; i++) {
    const y = BOARD.farY + ((BOARD.nearY - BOARD.farY) * i) / steps;
    points.push(`${slabEdges(y).x0 + inset},${y}`);
  }
  for (let i = steps; i >= 0; i--) {
    const y = BOARD.farY + ((BOARD.nearY - BOARD.farY) * i) / steps;
    points.push(`${slabEdges(y).x1 - inset},${y}`);
  }

  const d = `M ${points.join(" L ")} Z`;

  return (
    <g>
      <path d={d} fill="none" stroke={theme.shadow} strokeWidth={2.5} opacity={0.5} />
      <path d={d} fill="none" stroke={theme.frame.light} strokeWidth={1.5} opacity={LIT * 0.7} transform="translate(0 2)" />
    </g>
  );
}

/** Where the writing goes on each rim, for whatever needs to sit there. */
export const RIM = {
  left: rimLeft,
  right: rimRight,
};
