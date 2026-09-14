import type { RefObject } from "react";
import { LAYER, TILT } from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";
import Tabletop from "./Tabletop";

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
 * That transform is not written here. It belongs to the same frame loop that
 * leans the board, because the two have to move on the same frame or the room
 * and the object in it disagree about where the viewer is. All this does is
 * hand the loop the node to write on — and it never lists `transform` in its
 * own style, so React has no opinion about the property and will not overwrite
 * what the loop puts there.
 *
 * For a room with a painted table, the painting is laid over all of this and
 * is the room. It fills the window and it does not take the board's pitch:
 * the board is an object standing in the room, and the room is what the
 * window shows. For a room without one, the gradients below are the room.
 *
 * The window breathes. One sheet of the lamp's colour, laid diagonally over
 * the room from the window's corner at a few per cent, whose opacity drifts
 * up and down over eighteen seconds — which is a candle in a draught, or the
 * sun going behind and out of a thin cloud, and is the least a room can do to
 * stop being a photograph. It is deliberately below the level anyone can point
 * at. It is the foundation for a scene that moves, not the scene moving.
 *
 * It is a div, and only its opacity is animated, so the browser composites it
 * without repainting anything. Whatever is built on this later has to obey the
 * same rule: a sheet of its own, opacity or transform only, never a value
 * inside one of the SVGs, because animating an SVG's insides repaints the
 * whole board every frame.
 */

/** How long one breath takes, and how far the light swings. */
const BREATH = { seconds: 18, low: 0.55 };

const CSS = `
@keyframes ar-breath {
  0%   { opacity: ${BREATH.low}; }
  50%  { opacity: 1; }
  100% { opacity: ${BREATH.low}; }
}
.ar-breath {
  animation: ar-breath ${BREATH.seconds}s ease-in-out infinite;
  will-change: opacity;
}
@media (prefers-reduced-motion: reduce) {
  .ar-breath { animation: none; opacity: 0.78; }
}
`;

export default function Scene({ theme, nodeRef }: {
  theme: ArenaTheme;
  /** Handed to the frame loop, which drifts this against the board's lean. */
  nodeRef: RefObject<HTMLDivElement>;
}) {
  return (
    <div
      ref={nodeRef}
      data-layer="scene"
      aria-hidden
      style={{
        position: "absolute",
        // Wider than the window, so drifting never uncovers an edge.
        inset: -TILT.sceneDrift * 2,
        zIndex: LAYER.scene,
        pointerEvents: "none",
        // A large table in a dark room, lit from high on the left, in
        // gradients. There is one darkening and it runs along the light: warm
        // where the lamp reaches, falling away to the room's own dark in the
        // far corner from it. From the top down: the lamp's warmth from the
        // upper left; two very broad, very faint bands across the table at a
        // slight angle; the near edge of the table and the floor beyond it;
        // the table itself, going dark away from the lamp.
        background: `
          linear-gradient(152deg, ${theme.lamp}2A 0%, ${theme.lamp}10 26%, transparent 50%),
          linear-gradient(97deg, transparent 0%, transparent 31%, rgba(255,255,255,0.03) 34%, transparent 38%, transparent 68%, rgba(0,0,0,0.18) 72%, transparent 77%),
          linear-gradient(180deg, transparent 0%, transparent 86%, rgba(0,0,0,0.55) 88.5%, #03040A 92%, #020308 100%),
          linear-gradient(148deg, ${theme.table} 0%, ${theme.table} 30%, #0A0C11 68%, #03050A 100%)`,
      }}
    >
      <style>{CSS}</style>
      {/* The breath: the lamp's colour from the window's corner, fading out
          before the middle of the room, so it lands on the hall and the table
          and never on the battlefield. */}
      <div
        className="ar-breath"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `linear-gradient(150deg, ${theme.lamp}1C 0%, ${theme.lamp}0A 24%, transparent 46%)`,
        }}
      />
      <Tabletop theme={theme} />
    </div>
  );
}
