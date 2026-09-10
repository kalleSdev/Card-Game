import { BOARD, LIGHT, STAGE, slabEdges } from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";

/**
 * The room the board is standing in, and what the board does to it.
 *
 * This is the only part of the arena further away than the board itself, so it
 * is the only part the board can stand in front of — and that is the whole of
 * its job. Everything here is a broad surface, and there is not one object
 * among them. A table reads as sitting in a place because of what the place
 * does with light and what the table does to the light, not because somebody
 * left a crate beside it.
 *
 * Three surfaces, in order of how much work they do:
 *
 * The shadow the board drops on the floor. Wide, offset down and to the right
 * away from the lamp, and much darker close in under the near edge than out at
 * the far one — a board lit from high and to one side is welded to its own
 * shadow along the edge nearest the viewer and floats free of it at the back.
 * Without this the board is a picture of a board on a picture of a floor.
 *
 * A bloom of the lamp's own colour hugging the board's outline. Light bounces
 * off a lit wooden surface onto whatever is beside it, and this is the margin
 * catching some of the board's own warmth. It is what stops the board's edge
 * reading as a cut-out against the dark.
 *
 * The floor going away under the near edge. The only floor there is room to see
 * is the strip below the board, so it is the only place a falloff can read at
 * all, and it goes properly dark because that strip is the furthest thing on
 * screen from the lamp.
 */

const H = STAGE.height;

export default function Surround({ theme, spread = 0 }: {
  theme: ArenaTheme;
  /** How far past the gameplay composition the board reaches on each side. */
  spread?: number;
}) {
  const W = STAGE.width + spread * 2;
  /** Where the board's own underside stops and the floor begins. */
  const floor = BOARD.nearY + BOARD.lip + 12;
  const edge = slabEdges(BOARD.nearY);

  return (
    <svg
      viewBox={`${-spread} 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        {/*
          The board's shadow. Two gradients rather than a blur: a blur over an
          area this size is the most expensive thing a browser can be asked to
          do, and a shadow is only ever a soft dark shape, which is what a
          gradient already is.
        */}
        <radialGradient id="sr-cast" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={theme.shadow} stopOpacity="0.95" />
          <stop offset="0.62" stopColor={theme.shadow} stopOpacity="0.62" />
          <stop offset="1" stopColor={theme.shadow} stopOpacity="0" />
        </radialGradient>

        {/* The hard part of it, along the edge the board actually rests on. */}
        <linearGradient id="sr-contact" gradientUnits="userSpaceOnUse" x1={0} y1={floor - 14} x2={0} y2={floor + 74}>
          <stop offset="0" stopColor="#000000" stopOpacity="0.82" />
          <stop offset="0.45" stopColor="#000000" stopOpacity="0.44" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </linearGradient>

        {/* The lamp's own colour, bounced off the board onto the margin. */}
        <radialGradient
          id="sr-bloom"
          gradientUnits="userSpaceOnUse"
          cx={LIGHT.x}
          cy={LIGHT.y + 260}
          r={LIGHT.reach * 1.05}
        >
          <stop offset="0" stopColor={theme.lamp} stopOpacity="0.2" />
          <stop offset="0.5" stopColor={theme.lamp} stopOpacity="0.08" />
          <stop offset="1" stopColor={theme.lamp} stopOpacity="0" />
        </radialGradient>

        {/* The floor, going away below the board. */}
        <linearGradient id="sr-floor" gradientUnits="userSpaceOnUse" x1={0} y1={floor} x2={0} y2={H}>
          <stop offset="0" stopColor="#000000" stopOpacity="0.1" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.68" />
        </linearGradient>
      </defs>

      {/* Bloom first, so everything after it lands on top of the warmth. */}
      <ellipse cx={STAGE.width / 2} cy={(BOARD.farY + BOARD.nearY) / 2} rx={W * 0.56} ry={H * 0.56} fill="url(#sr-bloom)" />

      {/* The cast shadow, offset away from the lamp. */}
      <ellipse cx={STAGE.width / 2 + 26} cy={floor - 40} rx={W * 0.53} ry={132} fill="url(#sr-cast)" />
      <rect x={edge.x0 - spread - 40} y={floor - 14} width={edge.x1 - edge.x0 + spread * 2 + 80} height={88} fill="url(#sr-contact)" />

      <rect x={-spread} y={floor} width={W} height={H - floor} fill="url(#sr-floor)" />
    </svg>
  );
}
