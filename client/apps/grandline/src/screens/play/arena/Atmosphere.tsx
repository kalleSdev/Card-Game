import { LIGHT, STAGE } from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";

/**
 * The air in front of the board.
 *
 * Two things, and they are the last two things drawn before the writing: the
 * corners of the screen going dark, and a very small amount of something in
 * the air catching the lamp.
 *
 * The vignette is the only part of the arena that is allowed over the cards,
 * which is why it is shaped the way it is: nothing at all across the middle
 * two thirds, and what darkening there is arrives late and lands on the
 * corners. A vignette that reaches the battlefield is a filter over a game;
 * one that stops at the corners is a room the game is being played in. It is
 * also brighter on the lamp's side than the other, because a corner near a
 * light is not as dark as a corner away from one.
 *
 * The motes are twenty two circles. Not a texture, not a particle system and
 * not animated — a still scatter reads as air at rest, and anything that moved
 * would put the whole three dimensional stack back to recompositing every
 * frame for the sake of something nobody is supposed to notice. They are kept
 * out of the middle of the board on purpose: the battlefield is the one surface
 * that has to stay completely clean, and dust drawn over a card is dirt on the
 * screen rather than dust in the room.
 */

const H = STAGE.height;

/**
 * How much of the width either side of the middle gets no motes at all.
 *
 * The battlefield and both hands live in the middle, so the air is only drawn
 * where there is nothing to read.
 */
const CLEAR = 0.3;

/**
 * A fixed number between nought and one, for a given pair of whole numbers.
 *
 * A function rather than a generator, so the same mote is always in the same
 * place. Dust that re-rolled whenever anything else on the board changed would
 * shimmer, which is the one thing dust must not do.
 */
function noise(a: number, b: number): number {
  const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

const MOTES = Array.from({ length: 22 }, (_unused, i) => {
  const side = noise(i, 0) < 0.5 ? -1 : 1;
  // Out from the middle by at least the clear band, then anywhere beyond it.
  const across = side * (CLEAR + noise(i, 1) * (0.5 - CLEAR + 0.16));
  return {
    x: Math.round(STAGE.width * (0.5 + across)),
    y: Math.round(H * (0.06 + noise(i, 2) * 0.88)),
    r: Math.round((1.1 + noise(i, 3) * 2.6) * 10) / 10,
    o: Math.round((0.05 + noise(i, 4) * 0.16) * 100) / 100,
  };
});

export default function Atmosphere({ theme, spread = 0 }: {
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
          Nothing until two thirds of the way out, so the battlefield, both
          hands and every card is untouched, and then the corners drop away.
          Object bounding box units on purpose: it wants to be an ellipse the
          shape of the screen, whatever shape the screen turns out to be.
        */}
        <radialGradient id="at-vignette" cx="0.5" cy="0.46" r="0.62">
          <stop offset="0.58" stopColor="#000000" stopOpacity="0" />
          <stop offset="0.82" stopColor="#000000" stopOpacity="0.2" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.62" />
        </radialGradient>

        {/* The lamp's side of the room, lifted back out of the vignette. */}
        <radialGradient
          id="at-lift"
          gradientUnits="userSpaceOnUse"
          cx={LIGHT.x}
          cy={LIGHT.y}
          r={LIGHT.reach * 0.92}
        >
          <stop offset="0" stopColor={theme.lamp} stopOpacity="0.1" />
          <stop offset="0.55" stopColor={theme.lamp} stopOpacity="0.03" />
          <stop offset="1" stopColor={theme.lamp} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x={-spread} y={0} width={W} height={H} fill="url(#at-vignette)" />
      <rect x={-spread} y={0} width={W} height={H} fill="url(#at-lift)" />

      <g fill={theme.lamp}>
        {MOTES.map(mote => (
          <circle key={`${mote.x}-${mote.y}`} cx={mote.x} cy={mote.y} r={mote.r} opacity={mote.o} />
        ))}
      </g>
    </svg>
  );
}
