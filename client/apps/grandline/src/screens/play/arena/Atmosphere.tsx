import { STAGE } from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";

/**
 * The air in front of the board.
 *
 * One thing, and it is the last thing drawn before the writing: a very small
 * amount of something in the air catching the lamp.
 *
 * There used to be a vignette here too — first a ring, then edges darkening
 * separately — and both were the same mistake at different strengths: paint
 * laid over the finished picture to make it look like a room, when what makes
 * a room is the room. The darkness comes from the table now: it is lit from
 * one side and falls away from the lamp on the other, and nothing in front of
 * the cards touches them at all.
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
      <g fill={theme.lamp}>
        {MOTES.map(mote => (
          <circle key={`${mote.x}-${mote.y}`} cx={mote.x} cy={mote.y} r={mote.r} opacity={mote.o} />
        ))}
      </g>
    </svg>
  );
}
