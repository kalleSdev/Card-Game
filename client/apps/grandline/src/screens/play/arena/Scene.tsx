import type { RefObject } from "react";
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
 * That transform is not written here. It belongs to the same frame loop that
 * leans the board, because the two have to move on the same frame or the room
 * and the object in it disagree about where the viewer is. All this does is
 * hand the loop the node to write on — and it never lists `transform` in its
 * own style, so React has no opinion about the property and will not overwrite
 * what the loop puts there.
 *
 * What is here now is the ground the board sits on, moved out of the frame it
 * used to be painted in. The lighting, the distance and the walls belong to the
 * layer above this one and are not built yet.
 */

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
        // A dark table in a dark room, lit from high on the left. Every layer
        // here is linear on purpose: a room's light comes from a direction,
        // and the earlier warm radial pool read as a spotlight on a floor
        // rather than as light in a room. From the top down:
        //
        //   the lamp's warmth, coming in from the upper left and gone by the
        //   middle of the screen;
        //   two very broad, very faint bands across the table at a slight
        //   angle, which is as much as a large wooden surface needs to stop
        //   being one flat tone without a plank pattern anyone could count;
        //   the table darkening towards both sides;
        //   the table going cold and dark towards the bottom, away from the
        //   lamp, where the room's own colour takes over from the table's.
        //
        // No repeating gradient: one over the whole viewport was the most
        // expensive thing on this layer and bought detail nobody could see
        // through the board that covers it.
        background: `
          linear-gradient(152deg, ${theme.lamp}24 0%, ${theme.lamp}0A 28%, transparent 52%),
          linear-gradient(97deg, transparent 0%, transparent 33%, rgba(255,255,255,0.028) 36%, transparent 40%, transparent 70%, rgba(0,0,0,0.16) 74%, transparent 79%),
          linear-gradient(90deg, #04060A 0%, transparent 18%, transparent 82%, #04060A 100%),
          linear-gradient(180deg, ${theme.table} 0%, ${theme.table} 44%, #07090E 76%, #02040A 100%)`,
      }}
    />
  );
}
