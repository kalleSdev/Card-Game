import type { RefObject } from "react";
import { LAYER, TILT } from "../../../design/arenaStage";
import type { ArenaTheme } from "../../../design/arenaThemes";
import { plateFor } from "./environment";

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
 * For a table that has one, the room is a painted plate: a hall, lit from a
 * high window on the left, with a wooden table running across the foot of it
 * for the board to stand on. It is drawn to cover the window and no further —
 * the same scale in both directions, cropped by at most a few per cent at
 * either aspect ratio, since the plate was painted to the screen's own shape.
 * The board covers the quiet middle of it, and what is left showing is the
 * architecture round the edges, which is what a room seen past a table looks
 * like. The plate carries its own light and its own dark, so nothing else in
 * this layer is drawn over it.
 *
 * A table without a plate gets the room in gradients, as every table did until
 * the first plate arrived.
 */

export default function Scene({ theme, nodeRef }: {
  theme: ArenaTheme;
  /** Handed to the frame loop, which drifts this against the board's lean. */
  nodeRef: RefObject<HTMLDivElement>;
}) {
  const plate = plateFor(theme.id);

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
        // The plate, if there is one: the whole window, uniform scale, held to
        // the middle. The room's own near black sits under it for the moment
        // before it has loaded, which is the plate's darkest tone and so the
        // least visible thing to arrive from.
        //
        // Otherwise, a large table in a dark room, lit from high on the left,
        // in gradients. There is one darkening and it runs along the light:
        // warm where the lamp reaches, falling away to the room's own dark in
        // the far corner from it. From the top down: the lamp's warmth from
        // the upper left; two very broad, very faint bands across the table at
        // a slight angle; the near edge of the table and the floor beyond it;
        // the table itself, going dark away from the lamp.
        background: plate
          ? `#04060A url("${plate}") center / cover no-repeat`
          : `
          linear-gradient(152deg, ${theme.lamp}2A 0%, ${theme.lamp}10 26%, transparent 50%),
          linear-gradient(97deg, transparent 0%, transparent 31%, rgba(255,255,255,0.03) 34%, transparent 38%, transparent 68%, rgba(0,0,0,0.18) 72%, transparent 77%),
          linear-gradient(180deg, transparent 0%, transparent 86%, rgba(0,0,0,0.55) 88.5%, #03040A 92%, #020308 100%),
          linear-gradient(148deg, ${theme.table} 0%, ${theme.table} 30%, #0A0C11 68%, #03050A 100%)`,
      }}
    />
  );
}
