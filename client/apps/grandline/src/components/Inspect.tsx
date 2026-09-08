import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { PRINT_INFO, type PrintId } from "@cg/meta";
import { CARD_SIZE, COLOR, PRINT_COLOR, SPACE, text } from "../design/tokens";
import PrintCard, { type CardFace } from "./PrintCard";
import { TierPip } from "./primitives";

/** How far the card leans toward the pointer, in degrees. */
const MAX_TILT = 9;

/**
 * One card, held up to the light.
 *
 * This is the only place in the app where a card tilts. Everywhere else a
 * pointer moving over a card would be noise, because there are twenty of them
 * and you are trying to read the grid. Here there is exactly one card and
 * turning it is the entire point.
 */
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
  const ref = useRef<HTMLDivElement>(null);

  // Written straight onto the node: this fires every pointer move, and a
  // re-render per frame would be waste.
  const onMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    const y = (e.clientY - box.top) / box.height;
    el.style.transform =
      `rotateY(${((x - 0.5) * MAX_TILT * 2).toFixed(2)}deg) ` +
      `rotateX(${((0.5 - y) * MAX_TILT * 2).toFixed(2)}deg)`;
  }, []);

  const rest = useCallback(() => {
    const el = ref.current;
    if (el) el.style.transform = "";
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const info = PRINT_INFO[print];

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
        // Only the pointer that moves over the card should turn it, so the
        // whole overlay tracks nothing
        perspective: 1600,
      }}
    >
      <div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={rest}
        onClick={e => e.stopPropagation()}
        style={{
          transformStyle: "preserve-3d",
          transition: "transform 380ms cubic-bezier(0.16, 1, 0.3, 1)",
          cursor: "default",
          filter: "drop-shadow(0 26px 60px rgba(0,0,0,0.6))",
        }}
      >
        <PrintCard card={card} print={print} width={CARD_SIZE.xl} count={count} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, pointerEvents: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <TierPip tier={info.tier} />
          <span style={{ ...text("heading"), color: PRINT_COLOR[print] }}>{info.name}</span>
        </div>
        <span style={{ ...text("small"), color: COLOR.mist }}>{card.name}</span>
        <span style={{ ...text("label"), fontSize: 9, color: COLOR.fathom, marginTop: SPACE.sm }}>
          Click anywhere to close
        </span>
      </div>
    </div>
  );
}
