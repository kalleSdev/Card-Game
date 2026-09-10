import { LAYER, TILT } from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";

/**
 * The room the board is standing in.
 *
 * It fills the window rather than the stage. That is the whole reason it
 * exists: the board is a fixed object with fixed proportions, so on a wide
 * screen there is always space beside it, and that space should be the room
 * the game is being played in rather than two black bars.
 *
 * It also drifts against the board's lean. A backdrop that leans with the
 * board is a picture of a board; one that leans the other way is something the
 * board is standing in front of, and the difference costs one transform.
 *
 * What is here now is the ground the board sits on, moved out of the frame it
 * used to be painted in. The lighting, the distance and the walls belong to the
 * layer above this one and are not built yet.
 */

export default function Scene({ theme, tilt }: {
  theme: ArenaTheme;
  /** The board's current lean, in degrees, which this moves against. */
  tilt: { x: number; y: number };
}) {
  const drift = TILT.sceneDrift / TILT.degrees;

  return (
    <div
      data-layer="scene"
      aria-hidden
      style={{
        position: "absolute",
        // Wider than the window, so drifting never uncovers an edge.
        inset: -TILT.sceneDrift * 2,
        zIndex: LAYER.scene,
        pointerEvents: "none",
        transform: `translate(${-tilt.y * drift}px, ${-tilt.x * drift}px)`,
        transition: `transform ${TILT.settle}ms cubic-bezier(0.2,0,0.2,1)`,
        background: `
          radial-gradient(60% 45% at 50% 38%, rgba(255,255,255,0.05), transparent 70%),
          repeating-linear-gradient(92deg, rgba(255,255,255,0.014) 0 2px, transparent 2px 46px),
          radial-gradient(130% 100% at 50% 40%, ${theme.table} 0%, #05070A 82%)`,
      }}
    />
  );
}
