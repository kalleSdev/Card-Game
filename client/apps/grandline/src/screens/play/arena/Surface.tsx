import { HAZE, LIGHT, STAGE, WELL } from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";
import { surfacePath, wellPath } from "./board";
import Materials, { MATERIAL_MIX, materialFill } from "./materials";

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
 * The parchment is the quietest material on the board on purpose. Cards sit on
 * this and nothing else does, so the surface has to hold grain without holding
 * attention. Its tile is larger than the surface itself, which means the one
 * thing a player stares at all game has no repeat in it anywhere.
 */

const W = STAGE.width;
const H = STAGE.height;

export default function Surface({ theme, spread = 0 }: {
  theme: ArenaTheme;
  /** Only widens the box this is drawn into. The surface itself never moves. */
  spread?: number;
}) {
  const surface = surfacePath();

  return (
    <svg
      viewBox={`${-spread} 0 ${W + spread * 2} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        <Materials only={["parchment"]} />

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
          <stop offset="1" stopColor="#000000" stopOpacity="0.34" />
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

      {/* The grain, mixed into the tint rather than painted over it. */}
      <g
        clipPath="url(#sf-clip)"
        style={{ mixBlendMode: MATERIAL_MIX.parchment.blend }}
        opacity={MATERIAL_MIX.parchment.opacity}
      >
        <rect x={-spread} y={0} width={W + spread * 2} height={H} fill={materialFill("parchment")} />
      </g>

      <g clipPath="url(#sf-clip)">
        {/* What the rim above it throws onto it. */}
        <path
          d={wellPath()}
          fill="none"
          stroke={theme.shadow}
          strokeWidth={WELL.depth * 3.4}
          filter="url(#sf-soft)"
          opacity="0.92"
        />
        {/* And again along the near edge only, unblurred and tight, because
            the rim there stands between the surface and the lamp and is the
            one wall of the recess that throws a hard shadow. */}
        <path
          d={`M ${WELL.nearX0} ${WELL.nearY - WELL.depth / 2} L ${WELL.nearX1} ${WELL.nearY - WELL.depth / 2}`}
          stroke={theme.shadow}
          strokeWidth={WELL.depth * 1.5}
          opacity="0.5"
        />

        <rect x={-spread} y={WELL.farY} width={W + spread * 2} height={WELL.height / 2} fill="url(#sf-haze)" />
        <rect x={-spread} y={WELL.seamY} width={W + spread * 2} height={WELL.height / 2} fill="url(#sf-fall)" />

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
