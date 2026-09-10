import type { CSSProperties, ReactNode } from "react";
import { DEPTH, LAYER, LAYER_TAKES_CLICKS, depthTransform, type LayerName } from "../../../design/arenaStage";

/**
 * One layer of the board.
 *
 * A layer covers the whole stage, sits at its own height above the surface, and
 * takes its place in the stack from its name. Nothing inside a layer sets a
 * z-index against anything outside it, which is the point: the order of the
 * board is a property of the board, not an argument between the components that
 * happen to be drawn on it.
 *
 * Only the layers that hold something a person can click take the cursor. The
 * rest let it through, so a card is never unreachable because a sheet of
 * atmosphere was painted over it.
 *
 * A layer that has to crop or blur its contents flattens them, because that is
 * what the browser does with overflow and filters. That is fine for a layer
 * whose contents are flat anyway — a hand of cards, a sheet of haze — and it is
 * why the flag is on the layer rather than on the board.
 */
export default function Layer({ name, crop = false, style, children }: {
  name: LayerName;
  /** True for a layer whose contents are cut off at the board's edge. */
  crop?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div
      data-layer={name}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: LAYER[name],
        transform: depthTransform(DEPTH[name]),
        transformOrigin: "center",
        transformStyle: crop ? "flat" : "preserve-3d",
        overflow: crop ? "hidden" : "visible",
        pointerEvents: LAYER_TAKES_CLICKS[name] ? "auto" : "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
