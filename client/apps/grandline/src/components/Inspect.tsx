import { useEffect, useState } from "react";
import { PRINT_INFO, type PrintId } from "@cg/meta";
import { CARD_SIZE, COLOR, PRINT_COLOR, RADIUS, SPACE, text } from "../design/tokens";
import PrintCard, { type CardFace } from "./PrintCard";
import ScoreCard, { GRADE_LABEL, GRADE_TONE } from "./ScoreCard";
import { TierPip } from "./primitives";
import { scoreCard } from "../data/pool";

/**
 * One card, held up to the light.
 *
 * Two sizes: the card as you would hold it, and a step closer for reading the
 * artwork. Clicking the card moves between them, so a second look costs one
 * click rather than a menu.
 *
 * It is also the one place both faces of a character are on offer. A card has a
 * collection face and a Score Battle face, and this flips between them without
 * either one borrowing anything from the other.
 */

/** Held, and held closer. */
const HELD = CARD_SIZE.xl;
const CLOSER = 320;
export default function Inspect({
  card,
  print,
  count,
  onClose,
}: {
  card: CardFace;
  print: PrintId;
  /** How many copies are held, if it is worth saying. */
  count?: number;
  onClose: () => void;
}) {
  const [face, setFace] = useState<"collection" | "score">("collection");
  const [closer, setCloser] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const info = PRINT_INFO[print];
  const score = scoreCard(card.id);
  const showingScore = face === "score" && score !== null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        background: "rgba(4, 8, 14, 0.62)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACE.xl,
        cursor: "zoom-out",
      }}
    >
      <div
        onClick={e => { e.stopPropagation(); setCloser(!closer); }}
        style={{
          cursor: closer ? "zoom-out" : "zoom-in",
          transition: "width 260ms cubic-bezier(0.16, 1, 0.3, 1)",
          filter: "drop-shadow(0 26px 60px rgba(0,0,0,0.6))",
        }}
      >
        {showingScore && score ? (
          <ScoreCard card={score} name={card.name} width={closer ? CLOSER : HELD} />
        ) : (
          <PrintCard card={card} print={print} width={closer ? CLOSER : HELD} count={count} />
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, pointerEvents: "none" }}>
          {showingScore && score ? (
            <>
              <span
                style={{
                  width: 9, height: 9, borderRadius: "50%",
                  background: GRADE_TONE[score.grade].tone,
                }}
              />
              <span style={{ ...text("heading"), color: GRADE_TONE[score.grade].tone }}>
                {GRADE_LABEL[score.grade]} · {score.points} points
              </span>
            </>
          ) : (
            <>
              <TierPip tier={info.tier} />
              <span style={{ ...text("heading"), color: PRINT_COLOR[print] }}>{info.name}</span>
            </>
          )}
        </div>
        <span style={{ ...text("small"), color: COLOR.mist, pointerEvents: "none" }}>{card.name}</span>

        {/* Both faces of the same character, one click apart */}
        {score && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              display: "flex",
              gap: 2,
              padding: 3,
              marginTop: SPACE.sm,
              borderRadius: RADIUS.sm,
              border: `1px solid ${COLOR.rope}`,
              background: COLOR.hull,
            }}
          >
            {(["collection", "score"] as const).map(id => (
              <button
                key={id}
                onClick={() => setFace(id)}
                style={{
                  ...text("label"),
                  fontSize: 9,
                  padding: "5px 11px",
                  borderRadius: RADIUS.sm,
                  border: "none",
                  cursor: "pointer",
                  background: face === id ? COLOR.swell : "transparent",
                  color: face === id ? COLOR.foam : COLOR.mist,
                }}
              >
                {id === "collection" ? "Collection" : "Score battle"}
              </button>
            ))}
          </div>
        )}

        <span
          style={{
            ...text("label"), fontSize: 9, color: COLOR.fathom,
            marginTop: SPACE.sm, pointerEvents: "none",
          }}
        >
          {closer ? "Click the card to step back" : "Click the card for a closer look"} · click
          anywhere else to close
        </span>
      </div>
    </div>
  );
}
