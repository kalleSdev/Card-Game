import type { CSSProperties, ReactNode } from "react";
import { LAYER, STAGE, type LayerName } from "../../../design/arenaStage";

/**
 * One flat layer of the board. It covers the whole stage and takes its
 * z-index from LAYER. Layers never take clicks themselves, only the things
 * inside them that ask for it.
 */
export default function Layer({ name, crop = false, core = false, spread = 0, style, children }: {
  name: LayerName;
  /** Cut its contents off at the stage edge. */
  crop?: boolean;
  /** Gameplay layers stay the width of the composition and centred. */
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
        overflow: crop ? "hidden" : "visible",
        pointerEvents: "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
