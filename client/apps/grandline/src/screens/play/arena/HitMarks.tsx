import type { CSSProperties } from "react";
import { COLOR, text } from "../../../design/tokens";
import { CUE, type Cue } from "./cues";

/** The flash and the damage number for each hit on a card or leader. */
export default function HitMarks({ cues, shape }: {
  cues: Cue[] | undefined;
  /** The outline the flash is cut to. */
  shape?: CSSProperties;
}) {
  const hits = cues?.filter(c => c.kind === "hit") ?? [];
  if (hits.length === 0) return null;

  return (
    <>
      {hits.map((hit, i) => (
        <span key={i} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <span
            style={{
              position: "absolute",
              inset: 0,
              ...shape,
              background: `radial-gradient(circle, #FFF6E0 0%, ${COLOR.signal} 70%)`,
              mixBlendMode: "screen",
              opacity: 0,
              animation: `ar-flash ${CUE.hit}ms ease-out ${hit.at}ms both`,
            }}
          />
          {hit.kind === "hit" && (
            <span
              style={{
                position: "absolute",
                left: "50%",
                top: "30%",
                ...text("data"),
                fontSize: 22,
                fontWeight: 700,
                color: "#FFF1E6",
                textShadow: `0 0 6px ${COLOR.signal}, 0 2px 2px rgba(0,0,0,0.8)`,
                opacity: 0,
                animation: `ar-float ${CUE.hit + 200}ms ease-out ${hit.at}ms both`,
              }}
            >
              -{hit.damage}
            </span>
          )}
        </span>
      ))}
    </>
  );
}
