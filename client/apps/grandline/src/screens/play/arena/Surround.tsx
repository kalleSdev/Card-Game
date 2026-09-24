import { BOARD, SHELL, STAGE, boardReach, slabEdges } from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";
import { BASE, apronPath } from "./board";
import { tableFor } from "./environment";

/**
 * The table around the board. One even contact shadow where the board sits,
 * plus some lamp warmth and a floor when there is no painted table.
 */

const H = STAGE.height;

export default function Surround({ theme, spread = 0 }: {
  theme: ArenaTheme;
  spread?: number;
}) {
  const W = STAGE.width + spread * 2;
  const floor = BOARD.nearY + BOARD.lip + BASE.near + BASE.face;
  const reach = boardReach(spread);
  const plated = tableFor(theme.id) !== undefined;
  const left = slabEdges(BOARD.nearY).x0 - reach;

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
        <linearGradient id="sr-warm-left" gradientUnits="userSpaceOnUse" x1={left - 260} y1={0} x2={left} y2={0}>
          <stop offset="0" stopColor={theme.lamp} stopOpacity="0" />
          <stop offset="0.6" stopColor={theme.lamp} stopOpacity="0.06" />
          <stop offset="1" stopColor={theme.lamp} stopOpacity="0.16" />
        </linearGradient>
        <linearGradient id="sr-warm-top" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={BOARD.farY}>
          <stop offset="0" stopColor={theme.lamp} stopOpacity="0" />
          <stop offset="1" stopColor={theme.lamp} stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id="sr-floor" gradientUnits="userSpaceOnUse" x1={0} y1={floor} x2={0} y2={H}>
          <stop offset="0" stopColor="#000000" stopOpacity="0.14" />
          <stop offset="0.55" stopColor="#03050A" stopOpacity="0.5" />
          <stop offset="1" stopColor="#02040A" stopOpacity="0.78" />
        </linearGradient>
      </defs>

      {!plated && (
        <>
          <rect x={-spread} y={0} width={left + spread} height={H} fill="url(#sr-warm-left)" />
          <rect x={-spread} y={0} width={W} height={BOARD.farY} fill="url(#sr-warm-top)" />
        </>
      )}

      {/* Contact shadow, the same on every side */}
      <path d={apronPath(spread)} fill="none" stroke="#000000" strokeWidth={70} opacity="0.5" filter="url(#sr-soft)" />

      {!plated && <rect x={-spread} y={floor} width={W} height={H - floor} fill="url(#sr-floor)" />}
    </svg>
  );
}
