import { HAZE, LIGHT, STAGE, WELL } from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";
import { surfacePath, wellPath } from "./board";

/**
 * The playing surface, set down inside the well.
 *
 * It is smaller than the opening it sits in, because it is lower: the rim
 * overhangs it all the way round, which is what puts it inside the board
 * rather than on top of it. The overhang throws a shadow onto it, heaviest
 * along the near edge where the rim is between it and the lamp.
 *
 * The far half is greyer than the near one. That is the air between the two
 * ends of the board, and it is the cheapest depth cue there is: it costs one
 * gradient and it does more work than any amount of shading on the rim.
 *
 * The material that belongs on this surface is not painted yet. What is here is
 * the surface lit and shaded correctly, waiting for it.
 */

const W = STAGE.width;
const H = STAGE.height;

export default function Surface({ theme }: { theme: ArenaTheme }) {
  const surface = surfacePath();

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        {/* Lit from the lamp's side of the board, not from the middle of it. */}
        <radialGradient
          id="sf-body"
          gradientUnits="userSpaceOnUse"
          cx={LIGHT.x}
          cy={WELL.farY + WELL.height * 0.2}
          r={WELL.height * 0.92}
        >
          <stop offset="0" stopColor={theme.felt.light} />
          <stop offset="0.42" stopColor={theme.felt.mid} />
          <stop offset="1" stopColor={theme.felt.dark} />
        </radialGradient>

        {/* The near end of the surface is furthest from the lamp, and the
            board's own near rim stands between the two. */}
        <linearGradient id="sf-fall" gradientUnits="userSpaceOnUse" x1={0} y1={WELL.seamY} x2={0} y2={WELL.nearY}>
          <stop offset="0" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.26" />
        </linearGradient>

        {/* The air over the far half. */}
        <linearGradient id="sf-haze" gradientUnits="userSpaceOnUse" x1={0} y1={WELL.farY} x2={0} y2={WELL.seamY}>
          <stop offset="0" stopColor={theme.hazeTint} stopOpacity={HAZE} />
          <stop offset="1" stopColor={theme.hazeTint} stopOpacity="0" />
        </linearGradient>

        {/* The seam: drawn, then rubbed out at both ends, so it separates the
            halves without fencing them off. */}
        <linearGradient id="sf-seam" gradientUnits="userSpaceOnUse" x1={WELL.nearX0} y1={0} x2={WELL.nearX1} y2={0}>
          <stop offset="0" stopColor={theme.seam} stopOpacity="0" />
          <stop offset="0.25" stopColor={theme.seam} stopOpacity="1" />
          <stop offset="0.75" stopColor={theme.seam} stopOpacity="1" />
          <stop offset="1" stopColor={theme.seam} stopOpacity="0" />
        </linearGradient>

        <filter id="sf-soft" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation={WELL.depth} />
        </filter>

        <clipPath id="sf-clip"><path d={surface} /></clipPath>
      </defs>

      <path d={surface} fill="url(#sf-body)" />

      <g clipPath="url(#sf-clip)">
        {/* What the rim above it throws onto it. */}
        <path
          d={wellPath()}
          fill="none"
          stroke={theme.shadow}
          strokeWidth={WELL.depth * 2.6}
          filter="url(#sf-soft)"
          opacity="0.7"
        />

        <rect x="0" y={WELL.farY} width={W} height={WELL.height / 2} fill="url(#sf-haze)" />
        <rect x="0" y={WELL.seamY} width={W} height={WELL.height / 2} fill="url(#sf-fall)" />

        <path
          d={`M ${WELL.nearX0} ${WELL.seamY} L ${WELL.nearX1} ${WELL.seamY}`}
          stroke="url(#sf-seam)"
          strokeWidth="1.5"
        />
      </g>

      <path d={surface} fill="none" stroke={theme.feltEdge} strokeWidth="1.5" opacity="0.8" />
    </svg>
  );
}
