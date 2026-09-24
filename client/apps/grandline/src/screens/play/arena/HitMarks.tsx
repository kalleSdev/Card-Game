import { useEffect, useState, type CSSProperties } from "react";
import { COLOR, text } from "../../../design/tokens";
import { CUE, hitsIn, hpAt, type Cue } from "./cues";

/**
 * The effects that sit on top of a card during a cue. They are their own
 * elements, so they never touch the card's transform.
 */
export default function HitMarks({ cues, shape, glow }: {
  cues: Cue[] | undefined;
  /** The outline the flash and glow are cut to. */
  shape?: CSSProperties;
  /** Colour of the attacker's glow. */
  glow: string;
}) {
  if (!cues?.length) return null;
  const strikes = cues.filter(c => c.kind === "strike");
  const hits = hitsIn(cues);

  return (
    <>
      {strikes.map((strike, i) => (
        <span
          key={`s${i}`}
          style={{
            position: "absolute",
            inset: -3,
            ...shape,
            boxShadow: `0 0 0 2px ${glow}, 0 0 14px ${glow}`,
            opacity: 0,
            pointerEvents: "none",
            animation: `ar-glow ${CUE.strike}ms ease-out ${strike.at}ms both`,
          }}
        />
      ))}
      {hits.map((hit, i) => (
        <span key={`h${i}`} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
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
          {/* A short streak in the direction of the blow */}
          <span
            style={{
              position: "absolute",
              left: "50%",
              top: "20%",
              width: 5,
              height: "60%",
              borderRadius: 3,
              background: "linear-gradient(to bottom, transparent, #FFF6E0, transparent)",
              boxShadow: `0 0 8px ${COLOR.signal}`,
              opacity: 0,
              animation: `ar-slash-${hit.dir} 260ms ease-out ${hit.at - 40}ms both`,
            }}
          />
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
        </span>
      ))}
    </>
  );
}

/**
 * An hp number that only changes when the blow lands. Key it by the cue set
 * id so it starts over for each batch.
 */
export function ImpactHp({ cues, real }: { cues: Cue[] | undefined; real: number }) {
  const [landed, setLanded] = useState(0);

  useEffect(() => {
    const timers = hitsIn(cues).map((hit, i) => setTimeout(() => setLanded(i + 1), hit.at));
    return () => timers.forEach(clearTimeout);
  }, [cues]);

  return <>{Math.max(0, hpAt(cues, real, landed))}</>;
}
