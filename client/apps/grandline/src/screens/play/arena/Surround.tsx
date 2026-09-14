import { BOARD, SHELL, STAGE, boardReach, slabEdges } from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";
import { BASE, apronPath } from "./board";
import { tableFor } from "./environment";

/**
 * The table the board is standing on, and what the board does to it.
 *
 * This is the only part of the arena further away than the board itself, so it
 * is the only part the board can stand in front of — and that is the whole of
 * its job. Everything here is a broad surface; there is not one object among
 * them. A board reads as heavy because of what it does to the light around it,
 * not because of what has been left beside it.
 *
 * The light is directional. There is one lamp, high and to the left, and every
 * surface here answers it the same way the board does: the margin on the lamp's
 * side takes warmth bounced off the board's lit face, the margin on the far side
 * takes the board's shadow, and neither is a circle. The earlier version bloomed
 * warmth in a ring all round the board, which is what a light *under* a board
 * would do and reads as a glow effect rather than as a room.
 *
 * Under the board, in order from the board outwards:
 *
 * The occlusion. Where anything heavy meets a floor, no light gets in: one
 * soft stroke on the board's own outline, so the darkness hugs the shape
 * exactly and falls off with distance from it. The board's own faces — the
 * slab's and the base's — are the board's to draw, and it draws them.
 *
 * The cast shadow, offset away from the lamp: welded to the board along the
 * near edge and out past the right hand side, gone at the far left where the
 * lamp is.
 *
 * The floor, going away into the dark below the near edge.
 *
 * Over a painted table, only the shadow work is drawn. The painting already
 * has the lamp in it — high on the left, with its light across the wood — so
 * the bounced warmth would be a second light laid over the first, and the
 * floor falling to black would bury the very table the board is meant to be
 * standing on. What the painting cannot know is where the board is, so
 * everything the board does to the table stays: its underside, the dark where
 * it meets the wood, and the shadow it throws away from the lamp.
 */

const H = STAGE.height;

export default function Surround({ theme, spread = 0 }: {
  theme: ArenaTheme;
  /** How far past the gameplay composition the board reaches on each side. */
  spread?: number;
}) {
  const W = STAGE.width + spread * 2;
  /** The bottom of the base's near face: where the board stops and the table begins. */
  const floor = BOARD.nearY + BOARD.lip + BASE.near + BASE.face;
  const reach = boardReach(spread);
  const plated = tableFor(theme.id) !== undefined;
  const near = slabEdges(BOARD.nearY);
  /** The board's near edge, out to where the board actually reaches. */
  const left = near.x0 - reach;
  const right = near.x1 + reach;
  const apron = apronPath(spread);

  return (
    <svg
      viewBox={`${-spread} 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        <filter id="sr-soft" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={SHELL.occlusion} />
        </filter>
        {/*
          Bounced warmth along the two edges nearest the lamp. Linear, running
          outwards from the board's edge, so it is a wash along a side and not
          a halo around an object.
        */}
        <linearGradient id="sr-warm-left" gradientUnits="userSpaceOnUse" x1={left - 260} y1={0} x2={left} y2={0}>
          <stop offset="0" stopColor={theme.lamp} stopOpacity="0" />
          <stop offset="0.6" stopColor={theme.lamp} stopOpacity="0.06" />
          <stop offset="1" stopColor={theme.lamp} stopOpacity="0.16" />
        </linearGradient>
        <linearGradient id="sr-warm-top" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={BOARD.farY}>
          <stop offset="0" stopColor={theme.lamp} stopOpacity="0" />
          <stop offset="1" stopColor={theme.lamp} stopOpacity="0.12" />
        </linearGradient>

        {/* The cast shadow: a soft dark shape offset away from the lamp. */}
        <radialGradient id="sr-cast" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={theme.shadow} stopOpacity="0.96" />
          <stop offset="0.6" stopColor={theme.shadow} stopOpacity="0.66" />
          <stop offset="1" stopColor={theme.shadow} stopOpacity="0" />
        </radialGradient>

        {/* The hard part of it, along the edge the board actually rests on. */}
        <linearGradient id="sr-contact" gradientUnits="userSpaceOnUse" x1={0} y1={floor - 4} x2={0} y2={floor + 84}>
          <stop offset="0" stopColor="#000000" stopOpacity="0.9" />
          <stop offset="0.4" stopColor="#000000" stopOpacity="0.5" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </linearGradient>

        {/* The floor, going away below the board. Cooler as it goes: the lamp's
            warmth does not reach the far end of the room, and what is left down
            there is the room's own colour. */}
        <linearGradient id="sr-floor" gradientUnits="userSpaceOnUse" x1={0} y1={floor} x2={0} y2={H}>
          <stop offset="0" stopColor="#000000" stopOpacity="0.14" />
          <stop offset="0.55" stopColor="#03050A" stopOpacity="0.5" />
          <stop offset="1" stopColor="#02040A" stopOpacity="0.78" />
        </linearGradient>
      </defs>

      {/* ── Light: the two edges on the lamp's side ──────────────────────── */}
      {!plated && (
        <>
          <rect x={-spread} y={0} width={left + spread} height={H} fill="url(#sr-warm-left)" />
          <rect x={-spread} y={0} width={W} height={BOARD.farY} fill="url(#sr-warm-top)" />
        </>
      )}

      {/* ── Shadow: the two edges away from the lamp ─────────────────────── */}
      <ellipse cx={STAGE.width / 2 + 110} cy={floor + 24} rx={(right - left) * 0.6} ry={160} fill="url(#sr-cast)" />
      <ellipse cx={right + 40} cy={(BOARD.farY + BOARD.nearY) / 2 + 80} rx={130} ry={H * 0.4} fill="url(#sr-cast)" opacity="0.6" />

      {/* ── Where the board meets the table ──────────────────────────────── */}
      {/* One soft stroke on the base's outline. Only the outer half shows,
          since the board covers the rest; it is the dark where a heavy thing
          sits on a surface and no light gets under it. */}
      <path d={apron} fill="none" stroke="#000000" strokeWidth={90} opacity="0.4" filter="url(#sr-soft)" />

      {/* And the contact shadow it throws straight down onto the table. */}
      <rect x={left - 60} y={floor - 4} width={right - left + 120} height={92} fill="url(#sr-contact)" />

      {/* ── The floor ─────────────────────────────────────────────────────── */}
      {!plated && <rect x={-spread} y={floor} width={W} height={H - floor} fill="url(#sr-floor)" />}
    </svg>
  );
}
