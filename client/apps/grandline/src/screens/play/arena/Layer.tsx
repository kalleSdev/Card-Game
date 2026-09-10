import type { CSSProperties, ReactNode } from "react";
import { DEPTH, LAYER, STAGE, depthTransform, type LayerName } from "../../../design/arenaStage";

/**
 * One layer of the board.
 *
 * A layer covers the whole stage, sits at its own height above the surface, and
 * takes its place in the stack from its name. Nothing inside a layer sets a
 * z-index against anything outside it, which is the point: the order of the
 * board is a property of the board, not an argument between the components that
 * happen to be drawn on it.
 *
 * No layer ever takes the cursor itself. A layer is a sheet the width and
 * height of the whole board, so a layer that took clicks would swallow every
 * click aimed at the layers under it — the writing layer sits over the cards,
 * and a transparent sheet is as solid to a click as an opaque one. Only the
 * things a person can actually press ask for the cursor, and they get it even
 * inside a layer that has refused it, which is how pointer-events works.
 *
 * A layer that has to crop or blur its contents flattens them, because that is
 * what the browser does with overflow and filters. That is fine for a layer
 * whose contents are flat anyway — a hand of cards, a sheet of haze — and it is
 * why the flag is on the layer rather than on the board.
 */
export default function Layer({ name, crop = false, core = false, spread = 0, style, children }: {
  name: LayerName;
  /** True for a layer whose contents are cut off at the board's edge. */
  crop?: boolean;
  /**
   * True for a layer that holds gameplay geometry.
   *
   * Those layers are exactly as wide as the composition and sit in the middle
   * of the board however wide the board has become, so nothing the rules care
   * about moves when the screen does. Everything else spans the whole board.
   */
  core?: boolean;
  spread?: number;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const box: CSSProperties = core
    ? { left: spread, top: 0, width: STAGE.width, height: STAGE.height }
    : { inset: 0 };

  return (
    <div
      data-layer={name}
      style={{
        position: "absolute",
        ...box,
        zIndex: LAYER[name],
        transform: depthTransform(DEPTH[name]),
        transformOrigin: "center",
        transformStyle: crop ? "flat" : "preserve-3d",
        overflow: crop ? "hidden" : "visible",
        pointerEvents: "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
