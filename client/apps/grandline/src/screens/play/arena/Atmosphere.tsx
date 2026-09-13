import { LIGHT, STAGE } from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";

/**
 * The air in front of the board.
 *
 * Two things, and they are the last two things drawn before the writing: the
 * corners of the screen going dark, and a very small amount of something in
 * the air catching the lamp.
 *
 * The darkening at the edges is the only part of the arena that is allowed
 * over the cards, which is why it is shaped the way it is: nothing at all
 * across the middle, and what there is arrives late and stays at the edges.
 * A vignette that reaches the battlefield is a filter over a game; one that
 * stays at the edges is a room the game is being played in.
 *
 * It is not a circle. Two linear washes — one down the sides, one along the
 * top and bottom — each dark only in its last fifth, and the lamp's side lifted
 * back out with a third wash coming in from the upper left. A radial vignette
 * is a lens; edges going dark independently is a room, and the difference is
 * the one thing a person can point at when a screen looks like a screenshot
 * with an effect on it.
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
        {/* The sides going dark, and the top and bottom. Bounding box units,
            so each is a share of the screen whatever shape the screen is. */}
        <linearGradient id="at-sides" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000000" stopOpacity="0.5" />
          <stop offset="0.14" stopColor="#000000" stopOpacity="0" />
          <stop offset="0.86" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.62" />
        </linearGradient>
        <linearGradient id="at-ends" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000000" stopOpacity="0.34" />
          <stop offset="0.12" stopColor="#000000" stopOpacity="0" />
          <stop offset="0.84" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.66" />
        </linearGradient>

        {/* The lamp's side of the room, lifted back out of it. */}
        <linearGradient id="at-lift" gradientUnits="userSpaceOnUse" x1={LIGHT.x - 600} y1={0} x2={LIGHT.x + 380} y2={H * 0.7}>
          <stop offset="0" stopColor={theme.lamp} stopOpacity="0.14" />
          <stop offset="0.5" stopColor={theme.lamp} stopOpacity="0.04" />
          <stop offset="1" stopColor={theme.lamp} stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x={-spread} y={0} width={W} height={H} fill="url(#at-sides)" />
      <rect x={-spread} y={0} width={W} height={H} fill="url(#at-ends)" />
      <rect x={-spread} y={0} width={W} height={H} fill="url(#at-lift)" />

      <g fill={theme.lamp}>
        {MOTES.map(mote => (
          <circle key={`${mote.x}-${mote.y}`} cx={mote.x} cy={mote.y} r={mote.r} opacity={mote.o} />
        ))}
      </g>
    </svg>
  );
}
